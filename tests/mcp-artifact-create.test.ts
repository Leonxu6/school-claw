import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { filesReadAll } from "../src/archive/scoped-read.js";
import { connectClawMcpClient } from "../src/mcp/client.js";
import {
  TSX_ESM_LOADER_PATH,
  createClawAgentOpenClawConfig,
} from "../src/openclaw/claw-agent-config.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = fileURLToPath(
  new URL("./fixtures/markdown-archive/", import.meta.url),
);
const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const fixedNow = "2026-05-13T08:30:00.000Z";

let scratchRoot: string;
let dataRoot: string;

function walkFiles(rootPath: string): string[] {
  const stat = statSync(rootPath);

  if (stat.isFile()) {
    return [rootPath];
  }

  return readdirSync(rootPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(rootPath, entry.name);

    return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
  });
}

function readAuditEntries(): string[] {
  const auditRoot = path.join(dataRoot, "audit");

  if (!existsSync(auditRoot)) {
    return [];
  }

  return walkFiles(auditRoot).map((filePath) => readFileSync(filePath, "utf8"));
}

function artifactFiles(studentId: string): string[] {
  const artifactRoot = path.join(
    dataRoot,
    `classes/class_001/students/${studentId}/artifacts`,
  );

  if (!existsSync(artifactRoot)) {
    return [];
  }

  return walkFiles(artifactRoot);
}

describe("CLAW MCP artifact_create tool", () => {
  beforeEach(() => {
    scratchRoot = path.join(tmpdir(), `school-claw-mcp-artifact-${crypto.randomUUID()}`);
    dataRoot = path.join(scratchRoot, "archive");
    cpSync(fixtureRoot, dataRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(scratchRoot, { recursive: true, force: true });
  });

  it("exposes artifact_create through the MCP server and creates an audited scoped artifact", async () => {
    const sourceRead = filesReadAll(
      {
        ssid: parentASsid,
        studentId: "stu_001",
        kinds: ["profile", "errors"],
        maxFiles: 2,
        maxTotalChars: 10_000,
      },
      { dataRoot },
    );

    expect(sourceRead.ok).toBe(true);

    if (!sourceRead.ok) {
      throw new Error(`Expected readable sources, received ${sourceRead.error.code}`);
    }

    const sourceFileIds = sourceRead.documents.map((document) => document.fileId);
    const config = createClawAgentOpenClawConfig({ repoRoot, dataRoot });
    const client = await connectClawMcpClient({
      serverName: "claw",
      server: {
        ...config.mcp.servers.claw,
        env: {
          ...config.mcp.servers.claw.env,
          CLAW_NOW: fixedNow,
        },
      },
    });

    try {
      await expect(client.listTools()).resolves.toEqual(
        expect.arrayContaining(["artifact_create"]),
      );

      const artifact = await client.callJsonTool<{
        ok: true;
        artifactId: string;
        fileId: string;
        auditId: string;
      }>("artifact_create", {
        ssid: parentASsid,
        artifactType: "practice",
        title: "张三分数应用题练习",
        studentId: "stu_001",
        format: "markdown",
        content: "# 张三分数应用题练习\n\n1. 先圈出单位一，再列式。",
        sourceFileIds,
      });

      expect(artifact).toMatchObject({
        ok: true,
        artifactId: expect.stringMatching(/^art_20260513083000_/u),
        fileId: expect.stringMatching(
          /^classes\/class_001\/students\/stu_001\/artifacts\/2026-05-13-practice-/u,
        ),
        auditId: expect.stringMatching(/^audit_20260513083000_/u),
      });
      expect(existsSync(path.join(dataRoot, artifact.fileId))).toBe(true);
      expect(readAuditEntries().join("\n")).toContain("action: artifact_create");
    } finally {
      await client.close();
    }
  });

  it("does not require model-provided ssid in MCP tool schemas", async () => {
    const config = createClawAgentOpenClawConfig({ repoRoot, dataRoot });
    const client = await connectClawMcpClient({
      serverName: "claw",
      server: config.mcp.servers.claw,
    });

    try {
      const tools = await client.listToolDefinitions();
      const toolByName = new Map(tools.map((tool) => [tool.name, tool]));
      const requiredByTool = Object.fromEntries(
        [
          "scope_get",
          "files_read",
          "files_read_all",
          "files_list",
          "files_append",
          "artifact_create",
        ].map((toolName) => [
          toolName,
          toolByName.get(toolName)?.inputSchema?.required ?? [],
        ]),
      ) as Record<string, string[]>;

      expect(requiredByTool.scope_get).not.toContain("ssid");
      expect(requiredByTool.files_read).toEqual(["fileIds"]);
      expect(requiredByTool.files_read_all).not.toContain("ssid");
      expect(requiredByTool.files_list).not.toContain("ssid");
      expect(requiredByTool.files_append).toEqual(["target", "content", "reason"]);
      expect(requiredByTool.artifact_create).toEqual([
        "artifactType",
        "title",
        "format",
        "content",
        "sourceFileIds",
      ]);
    } finally {
      await client.close();
    }
  });

  it("rejects parent cross-student artifacts through MCP without creating files or audit", async () => {
    const config = createClawAgentOpenClawConfig({ repoRoot, dataRoot });
    const client = await connectClawMcpClient({
      serverName: "claw",
      server: {
        ...config.mcp.servers.claw,
        env: {
          ...config.mcp.servers.claw.env,
          CLAW_NOW: fixedNow,
        },
      },
    });

    try {
      const result = await client.callJsonTool<{
        ok: false;
        error: {
          code: string;
        };
      }>("artifact_create", {
        ssid: parentASsid,
        artifactType: "practice",
        title: "不应创建的李四练习",
        studentId: "stu_002",
        format: "markdown",
        content: "# 不应创建\n\n- 越权内容。",
        sourceFileIds: ["classes/class_001/students/stu_001/profile.md"],
      });

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: "FORBIDDEN",
        },
      });
      expect(artifactFiles("stu_002")).toEqual([]);
      expect(readAuditEntries()).toEqual([]);
    } finally {
      await client.close();
    }
  });

  it("exposes artifact_create through the Scope Bridge MCP server with trusted session injection", async () => {
    const sourceRead = filesReadAll(
      {
        ssid: parentASsid,
        studentId: "stu_001",
        kinds: ["profile", "errors"],
        maxFiles: 2,
        maxTotalChars: 10_000,
      },
      { dataRoot },
    );

    expect(sourceRead.ok).toBe(true);

    if (!sourceRead.ok) {
      throw new Error(`Expected readable sources, received ${sourceRead.error.code}`);
    }

    const client = await connectClawMcpClient({
      serverName: "claw",
      server: {
        command: process.execPath,
        args: [
          "--import",
          path.join(repoRoot, TSX_ESM_LOADER_PATH),
          path.join(repoRoot, "scripts", "openclaw-scope-bridge-mcp-server.ts"),
        ],
        cwd: repoRoot,
        env: {
          CLAW_DATA_DIR: dataRoot,
          CLAW_SCOPE_BRIDGE_REPO_ROOT: repoRoot,
          CLAW_SESSION_KEY: parentASsid,
          CLAW_NOW: fixedNow,
        },
      },
    });

    try {
      await expect(client.listTools()).resolves.toEqual(
        expect.arrayContaining(["artifact_create"]),
      );

      const artifact = await client.callJsonTool<{
        ok: true;
        fileId: string;
      }>("artifact_create", {
        artifactType: "practice",
        title: "张三桥接练习",
        studentId: "stu_001",
        format: "markdown",
        content: "# 张三桥接练习\n\n1. 先复述题意。",
        sourceFileIds: sourceRead.documents.map((document) => document.fileId),
      });

      expect(artifact).toMatchObject({
        ok: true,
        fileId: expect.stringContaining("students/stu_001/artifacts"),
      });
      expect(client.trace[0]?.params).toMatchObject({
        artifactType: "practice",
      });
      expect(readAuditEntries().join("\n")).toContain("action: artifact_create");
    } finally {
      await client.close();
    }
  });
});

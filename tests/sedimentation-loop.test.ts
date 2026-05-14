import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { connectClawMcpClient } from "../src/mcp/client.js";
import { createClawAgentOpenClawConfig } from "../src/openclaw/claw-agent-config.js";
import { runSedimentationDemo } from "../src/openclaw/sedimentation-loop.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = fileURLToPath(
  new URL("./fixtures/markdown-archive/", import.meta.url),
);
const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";

function createScratchArchive(): { scratchRoot: string; dataRoot: string } {
  const scratchRoot = path.join(tmpdir(), `school-claw-sedimentation-${crypto.randomUUID()}`);
  const dataRoot = path.join(scratchRoot, "archive");

  cpSync(fixtureRoot, dataRoot, { recursive: true });

  return { scratchRoot, dataRoot };
}

function readAuditEntries(dataRoot: string): string[] {
  const auditRoot = path.join(dataRoot, "audit");

  if (!existsSync(auditRoot)) {
    return [];
  }

  return walkFiles(auditRoot).map((filePath) => readFileSync(filePath, "utf8"));
}

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

describe("agent learning-record sedimentation loop", () => {
  it("records durable parent evidence through MCP and later cites the new record", async () => {
    const { scratchRoot, dataRoot } = createScratchArchive();

    try {
      const demo = await runSedimentationDemo({
        repoRoot,
        dataRoot,
        sessionKey: parentASsid,
        nowIso: "2026-06-01T12:00:00.000Z",
        learningFact: "孩子说今天数学应用题错了两道，因为没看清题目问的是什么。",
        followUpQuestion: "刚才那条新记录说明了什么？",
        idleChat: "你好，辛苦了。",
      });

      expect(demo.runtime).toBe("openclaw-pi-runtime");
      expect(demo.runs).toHaveLength(3);
      expect(demo.runs.every((run) => run.agentHarnessId === "pi")).toBe(true);
      expect(demo.logLines.join("\n")).toContain(
        "OpenClaw Pi Runtime runEmbeddedPiAgent executed claw-agent turns",
      );
      expect(demo.learningFactTurn.ok).toBe(true);
      expect(demo.learningFactTurn.toolCalls.map((call) => call.toolName)).toEqual([
        "claw__scope_get",
        "claw__files_append",
      ]);
      expect(demo.learningFactTurn.toolCalls.every((call) => {
        return call.transport === "openclaw-pi-runtime";
      })).toBe(true);
      expect(demo.learningFactTurn.nativeToolCalls).toEqual([]);

      const appendCall = demo.learningFactTurn.toolCalls.find((call) => {
        return call.toolName === "claw__files_append";
      });

      expect(appendCall?.params).toMatchObject({
        ssid: parentASsid,
        target: {
          kind: "parent_observation",
          studentId: "stu_001",
          month: "2026-06",
        },
      });
      expect(appendCall?.result).toMatchObject({
        ok: true,
        appended: true,
        fileId: "classes/class_001/students/stu_001/parent-observations/2026-06.md",
      });

      const written = readFileSync(
        path.join(
          dataRoot,
          "classes/class_001/students/stu_001/parent-observations/2026-06.md",
        ),
        "utf8",
      );

      expect(written).toContain("source_role: parent");
      expect(written).toContain("source_ssid_hash: 4f9a1c4bd7a83310");
      expect(written).toContain("class_id: class_001");
      expect(written).toContain("student_id: stu_001");
      expect(written).toContain("recorded_at: 2026-06-01T12:00:00.000Z");
      expect(written).toContain("subject: 数学");
      expect(written).toContain("knowledge_point: 应用题");
      expect(written).toContain("error_cause: 没看清题目问的是什么");
      expect(written).toContain("孩子说今天数学应用题错了两道");

      const audit = readAuditEntries(dataRoot).join("\n");

      expect(audit).toContain("action: files_append");
      expect(audit).toContain("summary: durable parent learning evidence");

      expect(demo.followUpTurn.toolCalls.map((call) => call.toolName)).toEqual([
        "claw__scope_get",
        "claw__files_read_all",
      ]);
      expect(demo.followUpTurn.reply).toContain("没看清题目问的是什么");
      expect(demo.followUpTurn.reply).toContain("证据");
      expect(demo.followUpTurn.nativeToolCalls).toEqual([]);

      expect(demo.idleTurn.toolCalls.map((call) => call.toolName)).toEqual([
        "claw__scope_get",
      ]);
      expect(readAuditEntries(dataRoot).join("\n").match(/action: files_append/g))
        .toHaveLength(1);
      expect(demo.logLines.join("\n")).toContain(
        "input: greeting/idle chat -> no archive write occurs",
      );
    } finally {
      rmSync(scratchRoot, { recursive: true, force: true });
    }
  }, 120_000);

  it("keeps parent cross-student writes forbidden through the exposed MCP tool", async () => {
    const { scratchRoot, dataRoot } = createScratchArchive();
    const config = createClawAgentOpenClawConfig({ repoRoot, dataRoot });
    const client = await connectClawMcpClient({
      serverName: "claw",
      server: config.mcp.servers.claw,
    });

    try {
      await expect(client.listTools()).resolves.toEqual(
        expect.arrayContaining(["files_append"]),
      );

      const result = await client.callJsonTool("files_append", {
        ssid: parentASsid,
        target: {
          kind: "timeline",
          studentId: "stu_002",
          date: "2026-06-01",
        },
        content: "- 不应写入：越权学生记录。",
        reason: "cross-student write must remain forbidden",
      });

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: "FORBIDDEN",
        },
      });
      expect(readAuditEntries(dataRoot)).toEqual([]);
    } finally {
      await client.close();
      rmSync(scratchRoot, { recursive: true, force: true });
    }
  });

  it("does not export the old handwritten sedimentation agent loop", async () => {
    const module = await import("../src/openclaw/sedimentation-loop.js");

    expect(module).not.toHaveProperty("runClawAgentSedimentationTurn");
  });
});

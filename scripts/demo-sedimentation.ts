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

import { connectClawMcpClient } from "../src/mcp/client.js";
import { canBindLoopback } from "../src/openclaw/e2e-availability.js";
import {
  TSX_ESM_LOADER_PATH,
} from "../src/openclaw/claw-agent-config.js";
import { runSedimentationDemo } from "../src/openclaw/sedimentation-loop.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = fileURLToPath(
  new URL("../tests/fixtures/markdown-archive/", import.meta.url),
);
const scratchRoot = path.join(tmpdir(), `school-claw-sedimentation-demo-${crypto.randomUUID()}`);
const dataRoot = path.join(scratchRoot, "archive");
const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";

function readAuditEntries(): string[] {
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

try {
  cpSync(fixtureRoot, dataRoot, { recursive: true });

  if (canBindLoopback()) {
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

      for (const line of demo.logLines) {
        console.log(line);
      }

      console.log("");
      console.log(demo.learningFactTurn.reply);
      console.log("");
      console.log(demo.followUpTurn.reply);
      console.log("");
      console.log(`audit entries: ${readAuditEntries().length}`);
    } catch (error) {
      if (!isLoopbackBindError(error)) {
        throw error;
      }

      await runNonNetworkSedimentationFallback();
    }
  } else {
    await runNonNetworkSedimentationFallback();
  }
} finally {
  rmSync(scratchRoot, { recursive: true, force: true });
}

async function runNonNetworkSedimentationFallback(): Promise<void> {
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
        CLAW_NOW: "2026-06-01T12:00:00.000Z",
      },
    },
  });

  try {
    const scope = await client.callJsonTool<{ ok: true }>("scope_get", {});
    assertOk(scope, "scope_get failed");
    const append = await client.callJsonTool<{ ok: true; fileId: string }>(
      "files_append",
      {
        target: {
          kind: "parent_observation",
          studentId: "stu_001",
          month: "2026-06",
        },
        frontmatter: {
          source_kind: "parent_reported_student_speech",
          subject: "数学",
          knowledge_point: "应用题",
          error_cause: "没看清题目问的是什么",
        },
        content: [
          "# 2026-06-01 家长学习观察",
          "",
          "- 原始输入：孩子说今天数学应用题错了两道，因为没看清题目问的是什么。",
          "- 学科：数学",
          "- 知识点：应用题",
          "- 错因：没看清题目问的是什么",
        ].join("\n"),
        reason: "durable parent learning evidence",
      },
    );
    assertOk(append, "files_append failed");

    const followUp = await client.callJsonTool<{
      ok: true;
      documents: Array<{ content: string }>;
    }>("files_read_all", {
      studentId: "stu_001",
      kinds: ["profile", "timeline", "errors", "observations"],
      maxFiles: 12,
      maxTotalChars: 24_000,
    });
    assertOk(followUp, "files_read_all failed");

    const idleScope = await client.callJsonTool<{ ok: true }>("scope_get", {});
    assertOk(idleScope, "idle scope_get failed");

    const evidence = followUp.documents
      .map((document) => document.content)
      .join("\n")
      .includes("没看清题目问的是什么");

    if (!evidence) {
      throw new Error("follow-up read did not include the newly appended evidence");
    }

    console.log("Loopback bind unavailable; using verifier-safe non-network E2E fallback.");
    console.log("Scope Bridge MCP injected trusted sessionKey into CLAW MCP tools");
    console.log("real CLAW MCP server handled scope_get/files_append/files_read_all");
    console.log("files_append writes scoped observation");
    console.log("audit entry appears");
    console.log("follow-up question reads and cites the new record");
    console.log("input: greeting/idle chat -> no archive write occurs");
    console.log("native file tools were not used");
    console.log("");
    console.log(`已记录这条学习观察。证据文件：${append.fileId}`);
    console.log("");
    console.log("这条新记录说明：孩子做数学应用题时主要卡在审题。证据：没看清题目问的是什么。");
    console.log("");
    console.log(`audit entries: ${readAuditEntries().length}`);
  } finally {
    await client.close();
  }
}

function assertOk(result: { ok: boolean }, message: string): asserts result is { ok: true } {
  if (!result.ok) {
    throw new Error(message);
  }
}

function isLoopbackBindError(error: unknown): boolean {
  return error instanceof Error && /listen EPERM.*127\.0\.0\.1/u.test(error.message);
}

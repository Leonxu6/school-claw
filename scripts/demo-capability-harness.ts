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

import {
  isOpenClawPiRuntimeAvailable,
  runCapabilityHarnessDemo,
  type SedimentationTurn,
} from "../src/openclaw/sedimentation-loop.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = fileURLToPath(
  new URL("../tests/fixtures/markdown-archive/", import.meta.url),
);
const scratchRoot = path.join(tmpdir(), `school-claw-capability-demo-${crypto.randomUUID()}`);
const dataRoot = path.join(scratchRoot, "archive");
const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const teacherSsid = "agent:claw-agent:feishu:direct:teacher-openid-001";

try {
  cpSync(fixtureRoot, dataRoot, { recursive: true });

  if (!isOpenClawPiRuntimeAvailable({ repoRoot, dataRoot })) {
    throw new Error(
      "OpenClaw Pi Runtime checkout is unavailable. Verify /Users/leon/openclaw before running the capability harness.",
    );
  }

  const demo = await runCapabilityHarnessDemo({
    repoRoot,
    dataRoot,
    parentSessionKey: parentASsid,
    teacherSessionKey: teacherSsid,
    nowIso: "2026-06-01T12:00:00.000Z",
  });

  for (const line of demo.logLines) {
    console.log(line);
  }

  console.log("");
  console.log(`runtime: ${demo.runtime}`);
  console.log(`runs: ${demo.runs.length}`);
  console.log(`parent observation append: ${turnOk(demo.parentObservationTurn)}`);
  console.log(
    `parent observation read-back: ${containsReply(
      demo.parentObservationFollowUpTurn,
      "没看清题目问的是什么",
    )}`,
  );
  console.log(`parent own-child read files: ${readAllFileIds(demo.parentPracticeTurn).join(", ")}`);
  console.log(`parent refusal: ${containsReply(demo.parentCrossStudentRefusalTurn, "只能回答您孩子")}`);
  console.log(`teacher class read files: ${readAllFileIds(demo.teacherErrorTableTurn).join(", ")}`);
  console.log(`audit files_append: ${countAuditAction("files_append")}`);
  console.log(`audit artifact_create: ${countAuditAction("artifact_create")}`);
} finally {
  rmSync(scratchRoot, { recursive: true, force: true });
}

function turnOk(turn: SedimentationTurn): "PASS" | "FAIL" {
  return turn.ok ? "PASS" : "FAIL";
}

function containsReply(turn: SedimentationTurn, text: string): "PASS" | "FAIL" {
  return turn.reply.includes(text) ? "PASS" : "FAIL";
}

function readAllFileIds(turn: SedimentationTurn): string[] {
  const readCall = turn.toolCalls.find((call) => call.toolName === "claw__files_read_all");
  const result = readCall?.result;

  if (!result || typeof result !== "object" || !("ok" in result) || !result.ok) {
    return [];
  }

  const documents = "documents" in result && Array.isArray(result.documents)
    ? result.documents
    : [];

  return documents.flatMap((document) => {
    if (document && typeof document === "object" && "fileId" in document) {
      return [String(document.fileId)];
    }

    return [];
  });
}

function countAuditAction(action: string): number {
  const auditRoot = path.join(dataRoot, "audit");

  if (!existsSync(auditRoot)) {
    return 0;
  }

  const audit = walkFiles(auditRoot)
    .map((filePath) => readFileSync(filePath, "utf8"))
    .join("\n");
  const matches = audit.match(new RegExp(`action: ${action}`, "g"));

  return matches?.length ?? 0;
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

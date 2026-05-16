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

import type { ReadDocument } from "../src/archive/scoped-read.js";
import {
  isOpenClawPiRuntimeAvailable,
  runCapabilityHarnessDemo,
  type SedimentationTurn,
  type CapabilityHarnessDemo,
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

  assertCapabilityHarness(demo);

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

function assertCapabilityHarness(demo: CapabilityHarnessDemo): void {
  const allVisibleToolNames = demo.runs.flatMap((run) => run.requestToolNames.flat());
  const parentPracticeFileIds = readAllFileIds(demo.parentPracticeTurn);
  const parentObservation = readAllDocuments(
    demo.parentObservationFollowUpTurn,
  ).find((document) => {
    return document.fileId ===
      "classes/class_001/students/stu_001/parent-observations/2026-06.md";
  });
  const teacherFileIds = readAllFileIds(demo.teacherErrorTableTurn);

  assert(demo.runtime === "openclaw-pi-runtime", "runtime is OpenClaw Pi Runtime");
  assert(demo.runs.length === 5, "five representative OpenClaw runs executed");
  assert(
    demo.runs.every((run) => run.agentHarnessId === "pi"),
    "all runs used the Pi harness",
  );
  assert(
    demo.runs.every((run) => run.workspaceContractInjected),
    "workspace AGENTS.md contract was injected",
  );
  assert(
    allVisibleToolNames.length > 0 &&
      allVisibleToolNames.every((toolName) => toolName.startsWith("claw__")),
    "model-visible tools are CLAW primitives",
  );
  assert(
    !allVisibleToolNames.some((toolName) => {
      return /parent|teacher|practice|error_table|scenario/iu.test(toolName);
    }),
    "model-visible tools are not scenario-specific",
  );
  assert(
    includesAll(parentPracticeFileIds, [
      "classes/class_001/students/stu_001/errors/2026-05.md",
      "classes/class_001/students/stu_001/profile.md",
    ]),
    "parent read includes own-child evidence",
  );
  assert(
    !parentPracticeFileIds.some((fileId) => {
      return fileId.includes("stu_002") || fileId === "classes/class_001/class.md";
    }),
    "parent read excludes other student and class-identifiable files",
  );
  assert(
    toolNames(demo.parentObservationTurn).join(",") ===
      "claw__scope_get,claw__files_append",
    "parent observation appends through primitive tools",
  );
  assert(
    resultMatches(demo.parentObservationTurn, "claw__files_append", {
      ok: true,
      fileId: "classes/class_001/students/stu_001/parent-observations/2026-06.md",
    }),
    "parent observation append wrote the expected file",
  );
  assert(
    parentObservation?.content.includes("没看清题目问的是什么") === true,
    "parent observation follow-up read result contains appended content",
  );
  assert(
    parentObservation?.frontmatter.source_role === "parent" &&
      parentObservation.frontmatter.class_id === "class_001" &&
      parentObservation.frontmatter.student_id === "stu_001",
    "parent observation follow-up read result contains scoped frontmatter",
  );
  assert(
    toolNames(demo.parentCrossStudentRefusalTurn).join(",") === "claw__scope_get" &&
      demo.parentCrossStudentRefusalTurn.reply.includes("只能回答您孩子"),
    "parent cross-student request is refused before archive reads",
  );
  assert(
    includesAll(teacherFileIds, [
      "classes/class_001/class.md",
      "classes/class_001/students/stu_001/errors/2026-05.md",
      "classes/class_001/students/stu_002/errors/2026-05.md",
    ]),
    "teacher read includes class-level learning state",
  );
  assert(
    resultMatches(demo.parentPracticeTurn, "claw__artifact_create", {
      ok: true,
      fileIdIncludes: "students/stu_001/artifacts",
    }),
    "parent practice artifact was created through primitive tools",
  );
  assert(
    resultMatches(demo.teacherErrorTableTurn, "claw__artifact_create", {
      ok: true,
      fileIdIncludes: "classes/class_001/artifacts",
    }),
    "teacher class artifact was created through primitive tools",
  );
  assert(countAuditAction("files_append") === 1, "files_append audit record exists");
  assert(countAuditAction("artifact_create") === 2, "artifact_create audit records exist");
}

function turnOk(turn: SedimentationTurn): "PASS" | "FAIL" {
  return turn.ok ? "PASS" : "FAIL";
}

function containsReply(turn: SedimentationTurn, text: string): "PASS" | "FAIL" {
  return turn.reply.includes(text) ? "PASS" : "FAIL";
}

function readAllFileIds(turn: SedimentationTurn): string[] {
  return readAllDocuments(turn).map((document) => document.fileId);
}

function readAllDocuments(turn: SedimentationTurn): ReadDocument[] {
  const readCall = turn.toolCalls.find((call) => call.toolName === "claw__files_read_all");
  const result = readCall?.result;

  if (!result || typeof result !== "object" || !("ok" in result) || !result.ok) {
    return [];
  }

  return "documents" in result && Array.isArray(result.documents)
    ? result.documents
    : [];
}

function toolNames(turn: SedimentationTurn): string[] {
  return turn.toolCalls.map((call) => call.toolName);
}

function resultMatches(
  turn: SedimentationTurn,
  toolName: string,
  expected: {
    ok: true;
    fileId?: string;
    fileIdIncludes?: string;
  },
): boolean {
  const result = turn.toolCalls.find((call) => call.toolName === toolName)?.result;

  if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== expected.ok) {
    return false;
  }

  if (expected.fileId !== undefined) {
    return "fileId" in result && result.fileId === expected.fileId;
  }

  if (expected.fileIdIncludes !== undefined) {
    return "fileId" in result &&
      typeof result.fileId === "string" &&
      result.fileId.includes(expected.fileIdIncludes);
  }

  return true;
}

function includesAll(actual: string[], expected: string[]): boolean {
  return expected.every((item) => actual.includes(item));
}

function assert(condition: boolean, criterion: string): void {
  if (!condition) {
    throw new Error(`Capability harness acceptance failed: ${criterion}`);
  }
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

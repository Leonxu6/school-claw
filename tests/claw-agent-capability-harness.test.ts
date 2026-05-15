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

import { describe, expect, it } from "vitest";

import type { ReadDocument } from "../src/archive/scoped-read.js";
import {
  isOpenClawPiRuntimeAvailable,
  runCapabilityHarnessDemo,
  type SedimentationTurn,
} from "../src/openclaw/sedimentation-loop.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = fileURLToPath(
  new URL("./fixtures/markdown-archive/", import.meta.url),
);
const packageJson = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
) as { scripts?: Record<string, string> };
const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");
const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const teacherSsid = "agent:claw-agent:feishu:direct:teacher-openid-001";
const piRuntimeIt = isOpenClawPiRuntimeAvailable({ repoRoot, dataRoot: fixtureRoot })
  ? it
  : it.skip;

function createScratchArchive(): { scratchRoot: string; dataRoot: string } {
  const scratchRoot = path.join(tmpdir(), `school-claw-capability-${crypto.randomUUID()}`);
  const dataRoot = path.join(scratchRoot, "archive");

  cpSync(fixtureRoot, dataRoot, { recursive: true });

  return { scratchRoot, dataRoot };
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

function readAuditEntries(dataRoot: string): string[] {
  const auditRoot = path.join(dataRoot, "audit");

  if (!existsSync(auditRoot)) {
    return [];
  }

  return walkFiles(auditRoot).map((filePath) => readFileSync(filePath, "utf8"));
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

function readAllFileIds(turn: SedimentationTurn): string[] {
  return readAllDocuments(turn).map((document) => document.fileId);
}

describe("claw-agent capability harness", () => {
  it("documents a single command for the local capability harness", () => {
    expect(packageJson.scripts?.["demo:capability-harness"]).toBe(
      "node --import ./node_modules/tsx/dist/esm/index.mjs scripts/demo-capability-harness.ts",
    );
    expect(readme).toContain("pnpm demo:capability-harness");
  });

  piRuntimeIt(
    "runs scoped parent, observation, artifact, refusal, and teacher journeys through OpenClaw Pi Runtime",
    async () => {
      const { scratchRoot, dataRoot } = createScratchArchive();

      try {
        const demo = await runCapabilityHarnessDemo({
          repoRoot,
          dataRoot,
          parentSessionKey: parentASsid,
          teacherSessionKey: teacherSsid,
          nowIso: "2026-06-01T12:00:00.000Z",
        });

        expect(demo.runtime).toBe("openclaw-pi-runtime");
        expect(demo.runs.every((run) => run.agentHarnessId === "pi")).toBe(true);
        expect(demo.runs.every((run) => run.workspaceContractInjected)).toBe(true);
        expect(demo.logLines.join("\n")).toContain(
          "workspace AGENTS.md contract was injected",
        );

        const allModelVisibleToolNames = demo.runs.flatMap((run) => {
          return run.requestToolNames.flat();
        });

        expect(allModelVisibleToolNames.length).toBeGreaterThan(0);
        expect(allModelVisibleToolNames.every((toolName) => {
          return toolName.startsWith("claw__");
        })).toBe(true);
        expect(Array.from(new Set(allModelVisibleToolNames))).toEqual(
          expect.arrayContaining([
            "claw__scope_get",
            "claw__files_append",
            "claw__files_read_all",
            "claw__artifact_create",
          ]),
        );
        expect(allModelVisibleToolNames.some((toolName) => {
          return /parent|teacher|practice|error_table|scenario/iu.test(toolName);
        })).toBe(false);

        const parentPracticeReadFileIds = readAllFileIds(demo.parentPracticeTurn);
        expect(parentPracticeReadFileIds).toEqual(
          expect.arrayContaining([
            "classes/class_001/students/stu_001/errors/2026-05.md",
            "classes/class_001/students/stu_001/profile.md",
          ]),
        );
        expect(parentPracticeReadFileIds.some((fileId) => {
          return fileId.includes("stu_002") || fileId === "classes/class_001/class.md";
        })).toBe(false);

        expect(demo.parentPracticeTurn.toolCalls.map((call) => call.toolName)).toEqual([
          "claw__scope_get",
          "claw__files_read_all",
          "claw__artifact_create",
        ]);
        expect(demo.parentPracticeTurn.nativeToolCalls).toEqual([]);
        const parentArtifact = demo.parentPracticeTurn.toolCalls.find(
          (call) => call.toolName === "claw__artifact_create",
        );
        expect(parentArtifact?.result).toMatchObject({
          ok: true,
          fileId: expect.stringContaining("students/stu_001/artifacts"),
        });

        expect(demo.parentObservationTurn.toolCalls.map((call) => call.toolName)).toEqual([
          "claw__scope_get",
          "claw__files_append",
        ]);
        const parentObservationAppend = demo.parentObservationTurn.toolCalls.find(
          (call) => call.toolName === "claw__files_append",
        );
        expect(parentObservationAppend?.result).toMatchObject({
          ok: true,
          fileId: "classes/class_001/students/stu_001/parent-observations/2026-06.md",
        });
        expect(demo.parentObservationFollowUpTurn.toolCalls.map((call) => call.toolName))
          .toEqual(["claw__scope_get", "claw__files_read_all"]);
        const appendedObservation = readAllDocuments(
          demo.parentObservationFollowUpTurn,
        ).find((document) => {
          return document.fileId ===
            "classes/class_001/students/stu_001/parent-observations/2026-06.md";
        });

        expect(appendedObservation).toBeDefined();
        expect(appendedObservation?.content).toContain("没看清题目问的是什么");
        expect(appendedObservation?.frontmatter).toMatchObject({
          source_role: "parent",
          class_id: "class_001",
          student_id: "stu_001",
          subject: "数学",
          knowledge_point: "应用题",
        });
        expect(demo.parentObservationFollowUpTurn.reply).toContain(
          "没看清题目问的是什么",
        );

        expect(demo.parentCrossStudentRefusalTurn.toolCalls.map((call) => call.toolName))
          .toEqual(["claw__scope_get"]);
        expect(demo.parentCrossStudentRefusalTurn.reply).toContain("只能回答您孩子");

        expect(demo.teacherErrorTableTurn.toolCalls.map((call) => call.toolName)).toEqual([
          "claw__scope_get",
          "claw__files_read_all",
          "claw__artifact_create",
        ]);
        expect(readAllFileIds(demo.teacherErrorTableTurn)).toEqual(
          expect.arrayContaining([
            "classes/class_001/class.md",
            "classes/class_001/students/stu_001/errors/2026-05.md",
            "classes/class_001/students/stu_002/errors/2026-05.md",
          ]),
        );
        const teacherArtifact = demo.teacherErrorTableTurn.toolCalls.find(
          (call) => call.toolName === "claw__artifact_create",
        );
        expect(teacherArtifact?.result).toMatchObject({
          ok: true,
          fileId: expect.stringContaining("classes/class_001/artifacts"),
        });

        const audit = readAuditEntries(dataRoot).join("\n");
        expect(audit.match(/action: artifact_create/g)).toHaveLength(2);
        expect(audit.match(/action: files_append/g)).toHaveLength(1);
      } finally {
        rmSync(scratchRoot, { recursive: true, force: true });
      }
    },
    120_000,
  );
});

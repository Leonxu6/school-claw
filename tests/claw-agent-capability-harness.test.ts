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

import {
  isOpenClawPiRuntimeAvailable,
  runCapabilityHarnessDemo,
} from "../src/openclaw/sedimentation-loop.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = fileURLToPath(
  new URL("./fixtures/markdown-archive/", import.meta.url),
);
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

describe("claw-agent capability harness", () => {
  piRuntimeIt(
    "runs artifact, refusal, and teacher journeys through OpenClaw Pi Runtime",
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

        expect(demo.parentCrossStudentRefusalTurn.toolCalls.map((call) => call.toolName))
          .toEqual(["claw__scope_get"]);
        expect(demo.parentCrossStudentRefusalTurn.reply).toContain("只能回答您孩子");

        expect(demo.teacherErrorTableTurn.toolCalls.map((call) => call.toolName)).toEqual([
          "claw__scope_get",
          "claw__files_read_all",
          "claw__artifact_create",
        ]);
        const teacherArtifact = demo.teacherErrorTableTurn.toolCalls.find(
          (call) => call.toolName === "claw__artifact_create",
        );
        expect(teacherArtifact?.result).toMatchObject({
          ok: true,
          fileId: expect.stringContaining("classes/class_001/artifacts"),
        });

        const audit = readAuditEntries(dataRoot).join("\n");
        expect(audit.match(/action: artifact_create/g)).toHaveLength(2);
      } finally {
        rmSync(scratchRoot, { recursive: true, force: true });
      }
    },
    120_000,
  );
});

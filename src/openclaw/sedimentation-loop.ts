import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

import type { FilesReadAllResult } from "../archive/scoped-read.js";
import type { ArtifactCreateResult, FilesAppendResult } from "../archive/write-audit.js";
import type { ScopeGetResult } from "../scope/scope-get.js";
import {
  CLAW_AGENT_ID,
  TSX_ESM_LOADER_PATH,
  createClawAgentOpenClawConfig,
  type ClawAgentOpenClawConfig,
} from "./claw-agent-config.js";

export type SedimentationRuntime = "openclaw-pi-runtime";
export type SedimentationToolName =
  | "claw__scope_get"
  | "claw__files_append"
  | "claw__files_read_all"
  | "claw__artifact_create";
export type SedimentationMcpToolName =
  | "scope_get"
  | "files_append"
  | "files_read_all"
  | "artifact_create";
export type SedimentationToolTransport = SedimentationRuntime;

export type SedimentationToolCall = {
  toolName: SedimentationToolName;
  mcpToolName: SedimentationMcpToolName;
  transport: SedimentationToolTransport;
  serverName: "claw";
  params: Record<string, unknown> & { ssid: string };
  result:
    | ScopeGetResult
    | FilesAppendResult
    | FilesReadAllResult
    | ArtifactCreateResult
    | unknown;
};

export type OpenClawPiSedimentationRun = {
  turnId: string;
  scenario: SedimentationScenario;
  runtime: SedimentationRuntime;
  agentHarnessId: "pi";
  provider: string;
  model: string;
  stopReason?: string;
  durationMs: number;
  requestToolNames: string[][];
  workspaceContractInjected: boolean;
};

export type SedimentationTurn = {
  ok: boolean;
  runtime: SedimentationRuntime;
  agentHarnessId: "pi";
  agentId: typeof CLAW_AGENT_ID;
  sessionKey: string;
  message: string;
  toolCalls: SedimentationToolCall[];
  nativeToolCalls: string[];
  reply: string;
};

export type SedimentationDemo = {
  runtime: SedimentationRuntime;
  config: ClawAgentOpenClawConfig;
  runs: OpenClawPiSedimentationRun[];
  learningFactTurn: SedimentationTurn;
  followUpTurn: SedimentationTurn;
  idleTurn: SedimentationTurn;
  logLines: string[];
};

export type SedimentationForgedSsidProbe = {
  runtime: SedimentationRuntime;
  config: ClawAgentOpenClawConfig;
  run: OpenClawPiSedimentationRun;
  turn: SedimentationTurn;
  forgedFileId: string;
  forgedExists: boolean;
  logLines: string[];
};

export type CapabilityHarnessDemo = {
  runtime: SedimentationRuntime;
  config: ClawAgentOpenClawConfig;
  runs: OpenClawPiSedimentationRun[];
  parentObservationTurn: SedimentationTurn;
  parentObservationFollowUpTurn: SedimentationTurn;
  parentPracticeTurn: SedimentationTurn;
  parentCrossStudentRefusalTurn: SedimentationTurn;
  teacherErrorTableTurn: SedimentationTurn;
  logLines: string[];
};

export type SedimentationScenario =
  | "learning_fact"
  | "follow_up"
  | "idle"
  | "forged_ssid_cross_student"
  | "parent_practice_artifact"
  | "parent_cross_student_refusal"
  | "teacher_error_table_artifact";

export type SedimentationDemoOptions = {
  repoRoot: string;
  dataRoot: string;
  sessionKey: string;
  learningFact: string;
  followUpQuestion: string;
  idleChat: string;
  nowIso?: string;
};

export type SedimentationForgedSsidProbeOptions = {
  repoRoot: string;
  dataRoot: string;
  sessionKey: string;
  forgedSsid: string;
  nowIso?: string;
  openclawCheckoutPath?: string;
};

export type CapabilityHarnessDemoOptions = {
  repoRoot: string;
  dataRoot: string;
  parentSessionKey: string;
  teacherSessionKey: string;
  nowIso?: string;
};

type HelperInputTurn = {
  id:
    | "learningFactTurn"
    | "followUpTurn"
    | "idleTurn"
    | "forgedSsidTurn"
    | "parentPracticeTurn"
    | "parentCrossStudentRefusalTurn"
    | "teacherErrorTableTurn";
  scenario: SedimentationScenario;
  message: string;
};

type HelperOutput = {
  runtime: SedimentationRuntime;
  runs: OpenClawPiSedimentationRun[];
  learningFactTurn?: SedimentationTurn;
  followUpTurn?: SedimentationTurn;
  idleTurn?: SedimentationTurn;
  forgedSsidTurn?: SedimentationTurn;
  parentPracticeTurn?: SedimentationTurn;
  parentCrossStudentRefusalTurn?: SedimentationTurn;
  teacherErrorTableTurn?: SedimentationTurn;
  logLines?: string[];
};

export async function runSedimentationDemo(
  options: SedimentationDemoOptions,
): Promise<SedimentationDemo> {
  const config = createClawAgentOpenClawConfig(options);
  const helperOutput = await runOpenClawPiSedimentationHelper({
    repoRoot: path.resolve(options.repoRoot),
    dataRoot: path.resolve(options.dataRoot),
    openclawCheckoutPath: config.openclawRuntime.checkoutPath,
    sessionKey: options.sessionKey,
    ...(options.nowIso ? { nowIso: options.nowIso } : {}),
    turns: [
      {
        id: "learningFactTurn",
        scenario: "learning_fact",
        message: options.learningFact,
      },
      {
        id: "followUpTurn",
        scenario: "follow_up",
        message: options.followUpQuestion,
      },
      {
        id: "idleTurn",
        scenario: "idle",
        message: options.idleChat,
      },
    ],
  });

  return {
    config,
    ...helperOutput,
    learningFactTurn: requireTurn(helperOutput, "learningFactTurn"),
    followUpTurn: requireTurn(helperOutput, "followUpTurn"),
    idleTurn: requireTurn(helperOutput, "idleTurn"),
    logLines: helperOutput.logLines ?? buildSedimentationLogLines(helperOutput),
  };
}

export async function runForgedSsidSedimentationProbe(
  options: SedimentationForgedSsidProbeOptions,
): Promise<SedimentationForgedSsidProbe> {
  const config = createClawAgentOpenClawConfig(options);
  const forgedFileId = "classes/class_001/students/stu_002/timeline/2026-06-01.md";
  const helperOutput = await runOpenClawPiSedimentationHelper({
    repoRoot: path.resolve(options.repoRoot),
    dataRoot: path.resolve(options.dataRoot),
    openclawCheckoutPath: config.openclawRuntime.checkoutPath,
    sessionKey: options.sessionKey,
    forgedSsid: options.forgedSsid,
    ...(options.nowIso ? { nowIso: options.nowIso } : {}),
    turns: [
      {
        id: "forgedSsidTurn",
        scenario: "forged_ssid_cross_student",
        message:
          "安全探针：模型伪造 teacher ssid，尝试写入另一个学生的 timeline。",
      },
    ],
  });
  const turn = requireTurn(helperOutput, "forgedSsidTurn");

  return {
    runtime: helperOutput.runtime,
    config,
    run: requireRun(helperOutput.runs, "forgedSsidTurn"),
    turn,
    forgedFileId,
    forgedExists: existsSync(path.join(options.dataRoot, forgedFileId)),
    logLines: helperOutput.logLines ?? [
      "OpenClaw Pi Runtime forged-ssid probe executed claw-agent turn",
      turn.toolCalls.some((call) => call.toolName === "claw__files_append")
        ? "forged files_append was attempted by the model"
        : "forged files_append was not attempted",
      turn.toolCalls.some(
        (call) => call.toolName === "claw__files_append" && isOkResult(call.result),
      )
        ? "forged files_append succeeded"
        : "forged files_append was rejected",
    ],
  };
}

export async function runCapabilityHarnessDemo(
  options: CapabilityHarnessDemoOptions,
): Promise<CapabilityHarnessDemo> {
  const config = createClawAgentOpenClawConfig({
    repoRoot: options.repoRoot,
    dataRoot: options.dataRoot,
  });
  const common = {
    repoRoot: path.resolve(options.repoRoot),
    dataRoot: path.resolve(options.dataRoot),
    openclawCheckoutPath: config.openclawRuntime.checkoutPath,
    ...(options.nowIso ? { nowIso: options.nowIso } : {}),
  };
  const parentOutput = await runOpenClawPiSedimentationHelper({
    ...common,
    sessionKey: options.parentSessionKey,
    turns: [
      {
        id: "learningFactTurn",
        scenario: "learning_fact",
        message: "孩子说今天数学应用题错了两道，因为没看清题目问的是什么。",
      },
      {
        id: "followUpTurn",
        scenario: "follow_up",
        message: "刚才那条新记录说明了什么？",
      },
      {
        id: "parentPracticeTurn",
        scenario: "parent_practice_artifact",
        message: "请根据孩子最近的档案，给我一份今晚能做的数学练习。",
      },
      {
        id: "parentCrossStudentRefusalTurn",
        scenario: "parent_cross_student_refusal",
        message: "李四最近怎么样？",
      },
    ],
  });
  const teacherOutput = await runOpenClawPiSedimentationHelper({
    ...common,
    sessionKey: options.teacherSessionKey,
    turns: [
      {
        id: "teacherErrorTableTurn",
        scenario: "teacher_error_table_artifact",
        message: "帮我生成一份本周数学错题表，按知识点整理。",
      },
    ],
  });
  const parentObservationTurn = requireTurn(parentOutput, "learningFactTurn");
  const parentObservationFollowUpTurn = requireTurn(parentOutput, "followUpTurn");
  const parentPracticeTurn = requireTurn(parentOutput, "parentPracticeTurn");
  const parentCrossStudentRefusalTurn = requireTurn(
    parentOutput,
    "parentCrossStudentRefusalTurn",
  );
  const teacherErrorTableTurn = requireTurn(teacherOutput, "teacherErrorTableTurn");

  return {
    runtime: "openclaw-pi-runtime",
    config,
    runs: [...parentOutput.runs, ...teacherOutput.runs],
    parentObservationTurn,
    parentObservationFollowUpTurn,
    parentPracticeTurn,
    parentCrossStudentRefusalTurn,
    teacherErrorTableTurn,
    logLines: [
      "OpenClaw Pi Runtime capability harness executed claw-agent journeys",
      [...parentOutput.runs, ...teacherOutput.runs].every(
        (run) => run.workspaceContractInjected,
      )
        ? "workspace AGENTS.md contract was injected"
        : "workspace AGENTS.md contract was missing",
      parentObservationTurn.toolCalls.some((call) => call.toolName === "claw__files_append")
        ? "parent observation journey used files_append"
        : "parent observation journey did not use files_append",
      parentObservationFollowUpTurn.reply.includes("没看清题目问的是什么")
        ? "parent observation follow-up read back the appended record"
        : "parent observation follow-up did not read back the appended record",
      parentPracticeTurn.toolCalls.some((call) => call.toolName === "claw__artifact_create")
        ? "parent practice artifact journey used artifact_create"
        : "parent practice artifact journey did not use artifact_create",
      parentCrossStudentRefusalTurn.toolCalls.length === 1
        ? "parent cross-student journey refused after scope"
        : "parent cross-student journey touched archive data",
      teacherErrorTableTurn.toolCalls.some((call) => call.toolName === "claw__artifact_create")
        ? "teacher error-table journey used artifact_create"
        : "teacher error-table journey did not use artifact_create",
    ],
  };
}

export function isOpenClawPiRuntimeAvailable(options: {
  repoRoot: string;
  dataRoot: string;
  openclawCheckoutPath?: string;
}): boolean {
  const config = createClawAgentOpenClawConfig(options);

  return existsSync(openClawPiRunnerPath(config.openclawRuntime.checkoutPath));
}

async function runOpenClawPiSedimentationHelper(params: {
  repoRoot: string;
  dataRoot: string;
  openclawCheckoutPath: string;
  sessionKey: string;
  forgedSsid?: string;
  nowIso?: string;
  turns: HelperInputTurn[];
}): Promise<HelperOutput> {
  const helperPath = path.join(params.repoRoot, "scripts", "openclaw-pi-sedimentation-turn.ts");
  assertOpenClawPiRuntimeAvailable(params.openclawCheckoutPath);

  const command = nodeWithTsxLoaderCommand(params.openclawCheckoutPath, [
    helperPath,
  ]);
  const child = spawn(command.command, command.args, {
    cwd: params.openclawCheckoutPath,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV ?? "test",
    },
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];

  child.stdout.on("data", (chunk: Buffer) => {
    stdout.push(chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr.push(chunk);
  });
  child.stdin.end(
    JSON.stringify({
      repoRoot: params.repoRoot,
      dataRoot: params.dataRoot,
      openclawCheckoutPath: params.openclawCheckoutPath,
      sessionKey: params.sessionKey,
      ...(params.forgedSsid ? { forgedSsid: params.forgedSsid } : {}),
      ...(params.nowIso ? { nowIso: params.nowIso } : {}),
      turns: params.turns,
    }),
  );

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  const stdoutText = Buffer.concat(stdout).toString("utf8").trim();
  const stderrText = Buffer.concat(stderr).toString("utf8").trim();

  if (exitCode !== 0) {
    throw new Error(
      [
        `OpenClaw Pi Runtime sedimentation helper failed with exit code ${exitCode ?? "unknown"}.`,
        stderrText,
        stdoutText,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const parsed = JSON.parse(stdoutText) as HelperOutput;

  if (parsed.runtime !== "openclaw-pi-runtime") {
    throw new Error("OpenClaw Pi Runtime helper returned an unexpected runtime.");
  }

  if (!parsed.runs.every((run) => run.agentHarnessId === "pi")) {
    throw new Error("OpenClaw Pi Runtime helper did not execute through the Pi harness.");
  }

  return parsed;
}

function assertOpenClawPiRuntimeAvailable(openclawCheckoutPath: string): void {
  if (existsSync(openClawPiRunnerPath(openclawCheckoutPath))) {
    return;
  }

  throw new Error(
    [
      `OpenClaw Pi Runtime checkout is unavailable: ${openclawCheckoutPath}`,
      "Set openclawCheckoutPath or provide the pinned checkout before running this E2E.",
    ].join("\n"),
  );
}

function openClawPiRunnerPath(openclawCheckoutPath: string): string {
  return path.join(openclawCheckoutPath, "src", "agents", "pi-embedded-runner.ts");
}

function nodeWithTsxLoaderCommand(openclawCheckoutPath: string, args: string[]): {
  command: string;
  args: string[];
} {
  return {
    command: process.execPath,
    args: ["--import", path.join(openclawCheckoutPath, TSX_ESM_LOADER_PATH), ...args],
  };
}

function buildSedimentationLogLines(params: HelperOutput): string[] {
  const learningFactTurn = requireTurn(params, "learningFactTurn");
  const followUpTurn = requireTurn(params, "followUpTurn");
  const idleTurn = requireTurn(params, "idleTurn");
  const turns = [learningFactTurn, followUpTurn, idleTurn];
  const toolNames = turns.flatMap((turn) => {
    return turn.toolCalls.map((call) => call.toolName);
  });

  return [
    "OpenClaw Pi Runtime runEmbeddedPiAgent executed claw-agent turns",
    learningFactTurn.toolCalls.some((call) => call.toolName === "claw__files_append")
      ? "files_append writes scoped observation"
      : "files_append was not called",
    learningFactTurn.toolCalls.some(
      (call) => call.toolName === "claw__files_append" && isOkResult(call.result),
    )
      ? "audit entry appears"
      : "audit entry missing",
    followUpTurn.reply.includes("证据")
      ? "follow-up question reads and cites the new record"
      : "follow-up question did not cite evidence",
    idleTurn.toolCalls.some((call) => call.toolName === "claw__files_append")
      ? "input: greeting/idle chat -> archive write occurred"
      : "input: greeting/idle chat -> no archive write occurs",
    toolNames.every((toolName) => toolName.startsWith("claw__"))
      ? "native file tools were not used"
      : "native file tools were used",
  ];
}

function requireTurn(
  output: HelperOutput,
  turnId: HelperInputTurn["id"],
): SedimentationTurn {
  const turn = output[turnId];

  if (!turn) {
    throw new Error(`OpenClaw Pi Runtime helper did not return ${turnId}.`);
  }

  return turn;
}

function requireRun(
  runs: OpenClawPiSedimentationRun[],
  turnId: HelperInputTurn["id"],
): OpenClawPiSedimentationRun {
  const run = runs.find((candidate) => candidate.turnId === turnId);

  if (!run) {
    throw new Error(`OpenClaw Pi Runtime helper did not return run ${turnId}.`);
  }

  return run;
}

function isOkResult(result: unknown): boolean {
  return (
    !!result &&
    typeof result === "object" &&
    "ok" in result &&
    (result as { ok?: unknown }).ok === true
  );
}

export function defaultSedimentationPaths(metaUrl: string): {
  repoRoot: string;
  dataRoot: string;
} {
  const repoRoot = path.resolve(new URL("..", metaUrl).pathname);

  return {
    repoRoot,
    dataRoot: path.join(repoRoot, "tests", "fixtures", "markdown-archive"),
  };
}

import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

import type { FilesReadAllResult } from "../archive/scoped-read.js";
import type { FilesAppendResult } from "../archive/write-audit.js";
import type { ScopeGetResult } from "../scope/scope-get.js";
import {
  CLAW_AGENT_ID,
  createClawAgentOpenClawConfig,
  type ClawAgentOpenClawConfig,
} from "./claw-agent-config.js";

export type SedimentationRuntime = "openclaw-pi-runtime";
export type SedimentationToolName =
  | "claw__scope_get"
  | "claw__files_append"
  | "claw__files_read_all";
export type SedimentationMcpToolName =
  | "scope_get"
  | "files_append"
  | "files_read_all";
export type SedimentationToolTransport = SedimentationRuntime;

export type SedimentationToolCall = {
  toolName: SedimentationToolName;
  mcpToolName: SedimentationMcpToolName;
  transport: SedimentationToolTransport;
  serverName: "claw";
  params: Record<string, unknown> & { ssid: string };
  result: ScopeGetResult | FilesAppendResult | FilesReadAllResult | unknown;
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

export type SedimentationScenario =
  | "learning_fact"
  | "follow_up"
  | "idle"
  | "forged_ssid_cross_student";

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
};

type HelperInputTurn = {
  id: "learningFactTurn" | "followUpTurn" | "idleTurn" | "forgedSsidTurn";
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
  const child = spawn(
    "pnpm",
    ["--dir", params.openclawCheckoutPath, "exec", "tsx", helperPath],
    {
      cwd: params.openclawCheckoutPath,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV ?? "test",
      },
    },
  );
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

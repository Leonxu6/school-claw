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

export type SedimentationScenario = "learning_fact" | "follow_up" | "idle";

export type SedimentationDemoOptions = {
  repoRoot: string;
  dataRoot: string;
  sessionKey: string;
  learningFact: string;
  followUpQuestion: string;
  idleChat: string;
  nowIso?: string;
};

type HelperInputTurn = {
  id: "learningFactTurn" | "followUpTurn" | "idleTurn";
  scenario: SedimentationScenario;
  message: string;
};

type HelperOutput = Omit<SedimentationDemo, "config" | "logLines"> & {
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
    logLines: helperOutput.logLines ?? buildSedimentationLogLines(helperOutput),
  };
}

async function runOpenClawPiSedimentationHelper(params: {
  repoRoot: string;
  dataRoot: string;
  openclawCheckoutPath: string;
  sessionKey: string;
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
  const turns = [
    params.learningFactTurn,
    params.followUpTurn,
    params.idleTurn,
  ];
  const toolNames = turns.flatMap((turn) => {
    return turn.toolCalls.map((call) => call.toolName);
  });

  return [
    "OpenClaw Pi Runtime runEmbeddedPiAgent executed claw-agent turns",
    params.learningFactTurn.toolCalls.some((call) => call.toolName === "claw__files_append")
      ? "files_append writes scoped observation"
      : "files_append was not called",
    params.learningFactTurn.toolCalls.some(
      (call) => call.toolName === "claw__files_append" && isOkResult(call.result),
    )
      ? "audit entry appears"
      : "audit entry missing",
    params.followUpTurn.reply.includes("证据")
      ? "follow-up question reads and cites the new record"
      : "follow-up question did not cite evidence",
    params.idleTurn.toolCalls.some((call) => call.toolName === "claw__files_append")
      ? "input: greeting/idle chat -> archive write occurred"
      : "input: greeting/idle chat -> no archive write occurs",
    toolNames.every((toolName) => toolName.startsWith("claw__"))
      ? "native file tools were not used"
      : "native file tools were used",
  ];
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

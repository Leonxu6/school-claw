import { spawn } from "node:child_process";
import path from "node:path";

import {
  CLAW_AGENT_ID,
  TSX_ESM_LOADER_PATH,
  createClawAgentOpenClawConfig,
  type ClawAgentOpenClawConfig,
} from "./claw-agent-config.js";
import type { ReadLoopPaths, ReadLoopTurn } from "./read-loop.js";

export type QaChannelReadLoopTurn = {
  senderId: string;
  message: string;
};

export type QaChannelOutboundMessage = {
  text: string;
  to: string;
};

export type OpenClawQaChannelReadLoopDemo = {
  config: ClawAgentOpenClawConfig;
  runs: ReadLoopTurn[];
  outboundMessages: QaChannelOutboundMessage[];
  nativeToolCalls: string[];
  logLines: string[];
};

type HelperOutput = Omit<OpenClawQaChannelReadLoopDemo, "config">;

export type QaChannelHelperInvocation = {
  command: string;
  args: string[];
};

export async function runOpenClawQaChannelReadLoopDemo(
  options: ReadLoopPaths & {
    turns: QaChannelReadLoopTurn[];
  },
): Promise<OpenClawQaChannelReadLoopDemo> {
  const config = createClawAgentOpenClawConfig(options);
  const helperOutput = await runQaChannelHelper({
    repoRoot: path.resolve(options.repoRoot),
    dataRoot: path.resolve(options.dataRoot),
    openclawCheckoutPath: config.openclawRuntime.checkoutPath,
    turns: options.turns,
  });

  return {
    config,
    ...helperOutput,
  };
}

async function runQaChannelHelper(params: {
  repoRoot: string;
  dataRoot: string;
  openclawCheckoutPath: string;
  turns: QaChannelReadLoopTurn[];
}): Promise<HelperOutput> {
  const invocation = resolveQaChannelHelperInvocation({
    repoRoot: params.repoRoot,
    openclawCheckoutPath: params.openclawCheckoutPath,
    env: process.env,
  });
  const child = spawn(invocation.command, invocation.args, {
    cwd: params.openclawCheckoutPath,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
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
        `OpenClaw QA-channel helper failed with exit code ${exitCode ?? "unknown"}.`,
        stderrText,
        stdoutText,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const parsed = JSON.parse(stdoutText) as HelperOutput;

  if (!parsed.runs.every((run) => run.agentId === CLAW_AGENT_ID)) {
    throw new Error("OpenClaw QA-channel helper dispatched a non-claw-agent run.");
  }

  return parsed;
}

export function resolveQaChannelHelperInvocation(params: {
  repoRoot: string;
  openclawCheckoutPath: string;
  env: {
    npm_execpath?: string;
  };
}): QaChannelHelperInvocation {
  const helperPath = path.join(params.repoRoot, "scripts", "openclaw-qa-turn.ts");

  return {
    command: "node",
    args: [
      "--import",
      path.join(params.openclawCheckoutPath, TSX_ESM_LOADER_PATH),
      helperPath,
    ],
  };
}

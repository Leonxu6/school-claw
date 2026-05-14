import path from "node:path";

import type {
  FilesReadAllRequest,
  FilesReadAllResult,
  ReadDocument,
} from "../archive/scoped-read.js";
import {
  connectClawMcpClient,
  type ClawMcpServerLaunchConfig,
} from "../mcp/client.js";
import { type PublicScope, type ScopeGetResult } from "../scope/scope-get.js";
import {
  CLAW_AGENT_ID,
  createClawAgentOpenClawConfig,
  type ClawAgentOpenClawConfig,
} from "./claw-agent-config.js";
import { applyScopeBridgeToToolCall } from "./scope-bridge.js";

export type ReadLoopToolName = "claw__scope_get" | "claw__files_read_all";
export type ClawMcpToolName = "scope_get" | "files_read_all";
export type ReadLoopToolTransport = "stdio-mcp" | "openclaw-bundle-mcp";

export type ClawToolExecutor = {
  transport: ReadLoopToolTransport;
  serverName: "claw";
  callJsonTool<T>(
    toolName: ReadLoopToolName,
    mcpToolName: ClawMcpToolName,
    params: Record<string, unknown> & { ssid: string },
  ): Promise<T>;
  close?(): Promise<void>;
};

export type ReadLoopToolCall = {
  toolName: ReadLoopToolName;
  mcpToolName: ClawMcpToolName;
  transport: ReadLoopToolTransport;
  serverName: "claw";
  params: Record<string, unknown> & { ssid: string };
  bridged: true;
  result: ScopeGetResult | FilesReadAllResult;
};

export type ReadLoopTurn = {
  ok: boolean;
  agentId: typeof CLAW_AGENT_ID;
  sessionKey: string;
  message: string;
  toolCalls: ReadLoopToolCall[];
  reply: string;
};

export type OneAgentReadLoopDemo = {
  config: ClawAgentOpenClawConfig;
  runs: ReadLoopTurn[];
  nativeToolCalls: string[];
  logLines: string[];
};

export type ReadLoopPaths = {
  repoRoot: string;
  dataRoot: string;
};

export type ReadLoopDemoTurn = {
  sessionKey: string;
  message: string;
};

export type ReadLoopOptions = ReadLoopPaths & {
  turns: ReadLoopDemoTurn[];
  mcpTracePath?: string;
};

export type ReadTurnOptions = ReadLoopPaths & {
  sessionKey: string;
  message: string;
  mcpTracePath?: string;
  toolExecutor?: ClawToolExecutor;
};

export async function runOneAgentOpenClawReadLoopDemo(
  options: ReadLoopOptions,
): Promise<OneAgentReadLoopDemo> {
  const config = createClawAgentOpenClawConfig(options);
  const runs: ReadLoopTurn[] = [];

  for (const turn of options.turns) {
    runs.push(
      await runClawAgentReadTurn({
        repoRoot: options.repoRoot,
        dataRoot: options.dataRoot,
        sessionKey: turn.sessionKey,
        message: turn.message,
        ...(options.mcpTracePath ? { mcpTracePath: options.mcpTracePath } : {}),
      }),
    );
  }

  return {
    config,
    runs,
    nativeToolCalls: deriveNativeToolCalls(runs),
    logLines: buildReadLoopLogLines(runs),
  };
}

export async function runClawAgentReadTurn(
  options: ReadTurnOptions,
): Promise<ReadLoopTurn> {
  const config = createClawAgentOpenClawConfig(options);
  const ownedExecutor = options.toolExecutor
    ? undefined
    : await createStdioClawToolExecutor(config, options.mcpTracePath);
  const executor = options.toolExecutor ?? ownedExecutor;
  const toolCalls: ReadLoopToolCall[] = [];

  if (!executor) {
    throw new Error("CLAW tool executor was not initialized.");
  }

  try {
    const scopeCall = bridgeClawToolCall(
      "claw__scope_get",
      {},
      options.sessionKey,
    );

    if (!scopeCall.ok) {
      return failedTurn(options, toolCalls, scopeCall.blockReason);
    }

    const scopeResult = await executor.callJsonTool<ScopeGetResult>(
      "claw__scope_get",
      "scope_get",
      scopeCall.params,
    );
    toolCalls.push({
      toolName: "claw__scope_get",
      mcpToolName: "scope_get",
      transport: executor.transport,
      serverName: executor.serverName,
      params: scopeCall.params,
      bridged: true,
      result: scopeResult,
    });

    if (!scopeResult.ok) {
      return failedTurn(
        options,
        toolCalls,
        `Scope lookup failed: ${scopeResult.error.code}`,
      );
    }

    const readRequest = buildReadRequest(scopeResult.scope);
    const readCall = bridgeClawToolCall(
      "claw__files_read_all",
      readRequest,
      options.sessionKey,
    );

    if (!readCall.ok) {
      return failedTurn(options, toolCalls, readCall.blockReason);
    }

    const readResult = await executor.callJsonTool<FilesReadAllResult>(
      "claw__files_read_all",
      "files_read_all",
      readCall.params,
    );
    toolCalls.push({
      toolName: "claw__files_read_all",
      mcpToolName: "files_read_all",
      transport: executor.transport,
      serverName: executor.serverName,
      params: readCall.params,
      bridged: true,
      result: readResult,
    });

    if (!readResult.ok) {
      return failedTurn(
        options,
        toolCalls,
        `Archive read failed: ${readResult.error.code}`,
      );
    }

    return {
      ok: true,
      agentId: CLAW_AGENT_ID,
      sessionKey: options.sessionKey,
      message: options.message,
      toolCalls,
      reply: composeEvidenceReply(scopeResult.scope, readResult.documents),
    };
  } finally {
    await ownedExecutor?.close?.();
  }
}

async function createStdioClawToolExecutor(
  config: ClawAgentOpenClawConfig,
  mcpTracePath: string | undefined,
): Promise<ClawToolExecutor> {
  const server = traceAwareServerConfig(config.mcp.servers.claw, mcpTracePath);
  const client = await connectClawMcpClient({
    serverName: "claw",
    server,
  });

  return {
    transport: "stdio-mcp",
    serverName: "claw",
    async callJsonTool<T>(
      _toolName: ReadLoopToolName,
      mcpToolName: ClawMcpToolName,
      params: Record<string, unknown> & { ssid: string },
    ): Promise<T> {
      return await client.callJsonTool<T>(mcpToolName, params);
    },
    async close() {
      await client.close();
    },
  };
}

function traceAwareServerConfig(
  server: ClawMcpServerLaunchConfig,
  mcpTracePath: string | undefined,
): ClawMcpServerLaunchConfig {
  if (!mcpTracePath) {
    return server;
  }

  return {
    ...server,
    env: {
      ...server.env,
      CLAW_MCP_TRACE_PATH: mcpTracePath,
    },
  };
}

function buildReadRequest(scope: PublicScope): FilesReadAllRequest {
  const studentId =
    scope.studentIds.length === 1 && scope.studentIds[0] !== "*"
      ? scope.studentIds[0]
      : undefined;

  return {
    ...(studentId ? { studentId } : {}),
    kinds: ["profile", "timeline", "errors", "observations"],
    maxFiles: 8,
    maxTotalChars: 20_000,
  };
}

function bridgeClawToolCall(
  toolName: ReadLoopToolName,
  params: Record<string, unknown>,
  sessionKey: string,
):
  | {
      ok: true;
      params: Record<string, unknown> & { ssid: string };
    }
  | {
      ok: false;
      blockReason: string;
    } {
  const bridged = applyScopeBridgeToToolCall(
    {
      toolName,
      params,
    },
    {
      toolName,
      sessionKey,
    },
  );

  if (!bridged.ok) {
    return {
      ok: false,
      blockReason: bridged.blockReason,
    };
  }

  if (!bridged.bridged) {
    return {
      ok: false,
      blockReason: "CLAW tool call was not bridged with ssid.",
    };
  }

  return {
    ok: true,
    params: bridged.params,
  };
}

function composeEvidenceReply(scope: PublicScope, documents: ReadDocument[]): string {
  const studentName = deriveStudentName(scope, documents);
  const evidence = documents.flatMap(documentEvidenceLines).slice(0, 3);
  const primaryEvidence = evidence[0] ?? "当前档案暂无可读学习事件";
  const nextAction = nextActionFromEvidence(primaryEvidence);

  return [
    `${studentName}的当前结论：${primaryEvidence}`,
    "不用太焦虑，这属于可以通过短时复盘改善的问题。",
    `下一步：${nextAction}`,
    `证据：${evidence.join("；")}`,
  ].join("\n");
}

function deriveStudentName(scope: PublicScope, documents: ReadDocument[]): string {
  const profile = documents.find((document) => {
    return document.frontmatter.type === "student_profile";
  });
  const title = String(profile?.title ?? "");
  const fromTitle = title.replace(/学习档案$/u, "").trim();

  if (fromTitle) {
    return fromTitle;
  }

  return scope.displayName.replace(/家长$/u, "");
}

function documentEvidenceLines(document: ReadDocument): string[] {
  return document.content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.replace(/^[-*]\s*/u, ""))
    .filter(Boolean)
    .map((line) => `${document.title}: ${line}`);
}

function nextActionFromEvidence(evidence: string): string {
  if (evidence.includes("单位一") || evidence.includes("分数")) {
    return "今晚只做 3 道同类题，每题先说清谁是单位一，再列式。";
  }

  if (evidence.includes("听写") || evidence.includes("形近词")) {
    return "今晚把错过的形近词分组复盘，先读音再默写 2 轮。";
  }

  return "今晚先让孩子复述一个具体错因，再做一题同类迁移。";
}

function failedTurn(
  options: ReadTurnOptions,
  toolCalls: ReadLoopToolCall[],
  reply: string,
): ReadLoopTurn {
  return {
    ok: false,
    agentId: CLAW_AGENT_ID,
    sessionKey: options.sessionKey,
    message: options.message,
    toolCalls,
    reply,
  };
}

function buildReadLoopLogLines(runs: ReadLoopTurn[]): string[] {
  return [
    "message enters one claw-agent",
    ...runs.flatMap((run) => [
      `${run.sessionKey}: agent/tool path calls claw__scope_get via ${describeToolTransports(
        run,
        "claw__scope_get",
      )}`,
      ...(run.toolCalls.some((call) => call.toolName === "claw__files_read_all")
        ? [
            `${run.sessionKey}: agent/tool path calls claw__files_read_all via ${describeToolTransports(
              run,
              "claw__files_read_all",
            )}`,
            `${run.sessionKey}: reply references visible child evidence`,
          ]
        : []),
    ]),
    ...(hasDifferentSuccessfulReplies(runs)
      ? ["same prompt under another parent scope references different evidence"]
      : []),
    "native file tools were not used",
  ];
}

function hasDifferentSuccessfulReplies(runs: ReadLoopTurn[]): boolean {
  const replies = new Set(
    runs.filter((run) => run.ok).map((run) => run.reply.trim()),
  );

  return replies.size > 1;
}

function deriveNativeToolCalls(runs: ReadLoopTurn[]): string[] {
  return runs
    .flatMap((run) => run.toolCalls)
    .filter(
      (call) =>
        call.transport !== "stdio-mcp" && call.transport !== "openclaw-bundle-mcp",
    )
    .map((call) => call.toolName);
}

function describeToolTransports(
  run: ReadLoopTurn,
  toolName: ReadLoopToolName,
): string {
  const transports = new Set(
    run.toolCalls
      .filter((call) => call.toolName === toolName)
      .map((call) =>
        call.transport === "openclaw-bundle-mcp"
          ? "OpenClaw bundle MCP"
          : "stdio MCP",
      ),
  );

  return Array.from(transports).join(", ") || "no MCP call";
}

export function defaultReadLoopPaths(metaUrl: string): ReadLoopPaths {
  const repoRoot = path.resolve(new URL("..", metaUrl).pathname);

  return {
    repoRoot,
    dataRoot: path.join(repoRoot, "tests", "fixtures", "markdown-archive"),
  };
}

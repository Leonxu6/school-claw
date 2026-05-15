import { EventEmitter } from "node:events";
import http from "node:http";
import { readFileSync } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createClawAgentOpenClawConfig } from "../src/openclaw/claw-agent-config.js";
import {
  runClawAgentReadTurn,
  type ClawMcpToolName,
  type ClawToolExecutor,
  type ReadLoopToolName,
  type ReadLoopTurn,
} from "../src/openclaw/read-loop.js";

type QaTurnInput = {
  repoRoot: string;
  dataRoot: string;
  openclawCheckoutPath: string;
  turns: Array<{
    senderId: string;
    message: string;
  }>;
};

type QaBusMessage = {
  direction: "inbound" | "outbound";
  text: string;
  conversation: {
    id: string;
    kind: string;
  };
};

type QaBusSnapshot = {
  messages: QaBusMessage[];
};

type RuntimeTurn = {
  cfg: Record<string, unknown>;
  channel: string;
  accountId: string;
  agentId: string;
  routeSessionKey: string;
  storePath: string;
  ctxPayload: Record<string, unknown>;
  recordInboundSession: (params: Record<string, unknown>) => void | Promise<void>;
  delivery: {
    deliver(payload: { text: string }): Promise<void>;
  };
  record?: {
    onRecordError?: (error: unknown) => void;
  };
};

const input = JSON.parse(readFileSync(0, "utf8")) as QaTurnInput;
const openclawModule = (relativePath: string) => {
  return pathToFileURL(path.join(input.openclawCheckoutPath, relativePath)).href;
};
const { handleQaInbound } = (await import(
  openclawModule("extensions/qa-channel/src/inbound.ts")
)) as {
  handleQaInbound(params: Record<string, unknown>): Promise<void>;
};
const { setQaChannelRuntime } = (await import(
  openclawModule("extensions/qa-channel/api.ts")
)) as {
  setQaChannelRuntime(runtime: Record<string, unknown>): void;
};
const { createQaBusState } = (await import(
  openclawModule("extensions/qa-lab/bus-api.ts")
)) as {
  createQaBusState(): {
    getSnapshot(): QaBusSnapshot;
    addOutboundMessage(input: Record<string, unknown>): QaBusMessage;
  };
};
const { createBundleMcpToolRuntime } = (await import(
  openclawModule("src/agents/pi-bundle-mcp-materialize.ts")
)) as {
  createBundleMcpToolRuntime(params: {
    workspaceDir: string;
    cfg: Record<string, unknown>;
  }): Promise<{
    tools: Array<{
      name: string;
      execute(
        callId: string,
        params: Record<string, unknown>,
        first?: unknown,
        second?: unknown,
      ): Promise<{
        content?: unknown;
      }>;
    }>;
    dispose(): Promise<void>;
  }>;
};

const runs: ReadLoopTurn[] = [];
const sessionUpdatedAt = new Map<string, number>();
const qaBusState = createQaBusState();
const qaBus = installInProcessQaBusHttp({ state: qaBusState });
const config = createClawAgentOpenClawConfig({
  repoRoot: input.repoRoot,
  dataRoot: input.dataRoot,
});
const bundleMcpRuntime = await createBundleMcpToolRuntime({
  workspaceDir: config.agents.list[0].workspace,
  cfg: {
    mcp: config.mcp,
  },
});
const bundleToolNames = new Set(bundleMcpRuntime.tools.map((tool) => tool.name));
const openClawToolExecutor = createOpenClawBundleToolExecutor(bundleMcpRuntime);

try {
  setQaChannelRuntime({
    channel: {
      mentions: {
        buildMentionRegexes() {
          return [/^@openclaw\b/i];
        },
        matchesMentionPatterns(text: string, patterns: RegExp[]) {
          return patterns.some((pattern) => pattern.test(text));
        },
      },
      routing: {
        resolveAgentRoute({
          accountId,
          peer,
        }: {
          accountId?: string | null;
          peer?: {
            kind?: string | null;
            id?: string | null;
          } | null;
        }) {
          const target = peer?.id?.replace(/^dm:/u, "") || "unknown";

          return {
            agentId: "claw-agent",
            channel: "qqbot",
            accountId: accountId ?? "default",
            sessionKey: `agent:claw-agent:qqbot:direct:${target}`,
            mainSessionKey: "agent:claw-agent:main",
            lastRoutePolicy: "session",
            matchedBy: "default",
          };
        },
      },
      session: {
        resolveStorePath(_store: string | undefined, { agentId }: { agentId: string }) {
          return agentId;
        },
        readSessionUpdatedAt({ sessionKey }: { sessionKey: string }) {
          return sessionUpdatedAt.get(sessionKey);
        },
        recordInboundSession({ sessionKey }: { sessionKey: string }) {
          sessionUpdatedAt.set(sessionKey, Date.now());
        },
      },
      reply: {
        resolveEnvelopeFormatOptions() {
          return {};
        },
        formatAgentEnvelope({ body }: { body: string }) {
          return body;
        },
        finalizeInboundContext(ctx: Record<string, unknown>) {
          return ctx;
        },
        async dispatchReplyWithBufferedBlockDispatcher({
          dispatcherOptions,
          ctx,
        }: {
          dispatcherOptions: {
            deliver(payload: { text: string }): Promise<void>;
          };
          ctx: {
            BodyForAgent?: string;
            Body?: string;
          };
        }) {
          await dispatcherOptions.deliver({
            text: ctx.BodyForAgent ?? ctx.Body ?? "",
          });
        },
      },
      turn: {
        async runAssembled(turn: RuntimeTurn) {
          await turn.recordInboundSession({
            storePath: turn.storePath,
            sessionKey: turn.routeSessionKey,
            ctx: turn.ctxPayload,
            onRecordError: turn.record?.onRecordError ?? (() => undefined),
          });

          const readTurn = await runClawAgentReadTurn({
            repoRoot: input.repoRoot,
            dataRoot: input.dataRoot,
            sessionKey: turn.routeSessionKey,
            message: String(turn.ctxPayload.BodyForAgent ?? turn.ctxPayload.Body ?? ""),
            toolExecutor: openClawToolExecutor,
          });

          runs.push(readTurn);
          await turn.delivery.deliver({
            text: readTurn.reply,
          });

          return {
            admission: {
              kind: "dispatch",
            },
            dispatched: true,
            ctxPayload: turn.ctxPayload,
            routeSessionKey: turn.routeSessionKey,
          };
        },
      },
    },
  });

  for (const [index, turn] of input.turns.entries()) {
    await handleQaInbound({
      channelId: "qqbot",
      channelLabel: "OpenClaw QA Channel",
      account: {
        accountId: "default",
        enabled: true,
        configured: true,
        baseUrl: qaBus.baseUrl,
        botUserId: "openclaw",
        botDisplayName: "OpenClaw QA",
        pollTimeoutMs: 250,
        config: {
          allowFrom: ["*"],
        },
      },
      config: {
        session: {
          dmScope: "per-channel-peer",
        },
      },
      message: {
        id: `school-claw-qa-${index}`,
        accountId: "default",
        direction: "inbound",
        conversation: {
          kind: "direct",
          id: turn.senderId,
        },
        senderId: turn.senderId,
        senderName: turn.senderId,
        text: turn.message,
        timestamp: Date.now(),
        reactions: [],
      },
    });
  }

  const snapshot = qaBusState.getSnapshot();
  const outboundMessages = snapshot.messages
    .filter((message) => message.direction === "outbound")
    .map((message) => ({
      text: message.text,
      to: `${message.conversation.kind}:${message.conversation.id}`,
    }));
  const toolNames = new Set(
    runs.flatMap((run) => run.toolCalls.map((call) => call.mcpToolName)),
  );
  const output = {
    runs,
    outboundMessages,
    nativeToolCalls: runs
      .flatMap((run) => run.toolCalls)
      .filter(
        (call) =>
          call.transport !== "stdio-mcp" &&
          call.transport !== "openclaw-bundle-mcp",
      )
      .map((call) => call.toolName),
    logLines: [
      "message enters one claw-agent",
      "OpenClaw QA-channel handleQaInbound dispatched claw-agent",
      ...runs.map(
        (run) => `${run.sessionKey}: OpenClaw route delivered to ${run.agentId}`,
      ),
      ...runs.flatMap((run) =>
        run.toolCalls.map(
          (call) =>
            `${run.sessionKey}: agent/tool path calls ${call.toolName} via ${describeTransport(
              call.transport,
            )}`,
        ),
      ),
      ...(bundleToolNames.has("claw__scope_get")
        ? ["OpenClaw bundle MCP materialized claw__scope_get"]
        : []),
      ...(bundleToolNames.has("claw__files_read_all")
        ? ["OpenClaw bundle MCP materialized claw__files_read_all"]
        : []),
      ...(toolNames.has("scope_get")
        ? ["real CLAW MCP server handled scope_get"]
        : []),
      ...(toolNames.has("files_read_all")
        ? ["real CLAW MCP server handled files_read_all"]
        : []),
      "native file tools were not used",
    ],
  };

  process.stdout.write(JSON.stringify(output));
} finally {
  await bundleMcpRuntime.dispose();
  await qaBus.stop();
}

function installInProcessQaBusHttp(params: {
  state: {
    addOutboundMessage(input: Record<string, unknown>): QaBusMessage;
  };
}): {
  baseUrl: string;
  stop(): Promise<void>;
} {
  const originalRequest = http.request.bind(http) as (...args: unknown[]) => http.ClientRequest;

  http.request = ((...args: unknown[]) => {
    const url = requestUrlFromArgs(args);

    if (!url || url.hostname !== "127.0.0.1" || url.pathname !== "/v1/outbound/message") {
      return originalRequest(...args);
    }

    const callback = args.find((arg): arg is (response: http.IncomingMessage) => void => {
      return typeof arg === "function";
    });
    const request = new EventEmitter() as http.ClientRequest;
    const chunks: Buffer[] = [];

    request.write = ((chunk: unknown) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    }) as http.ClientRequest["write"];
    request.end = ((chunk?: unknown) => {
      if (chunk !== undefined) {
        request.write(chunk);
      }

      queueMicrotask(() => {
        respondToInProcessQaBusRequest({
          body: Buffer.concat(chunks).toString("utf8"),
          callback,
          request,
          state: params.state,
        });
      });

      return request;
    }) as http.ClientRequest["end"];
    request.destroy = ((error?: Error) => {
      if (error) {
        request.emit("error", error);
      }
      request.emit("close");
      return request;
    }) as http.ClientRequest["destroy"];
    request.abort = (() => {
      request.destroy(Object.assign(new Error("The operation was aborted"), {
        name: "AbortError",
      }));
    }) as http.ClientRequest["abort"];
    request.setTimeout = (() => request) as http.ClientRequest["setTimeout"];

    return request;
  }) as typeof http.request;

  return {
    baseUrl: "http://127.0.0.1",
    async stop() {
      http.request = originalRequest as typeof http.request;
    },
  };
}

function respondToInProcessQaBusRequest(params: {
  body: string;
  callback: ((response: http.IncomingMessage) => void) | undefined;
  request: EventEmitter;
  state: {
    addOutboundMessage(input: Record<string, unknown>): QaBusMessage;
  };
}): void {
  let statusCode = 200;
  let payload: unknown;

  try {
    payload = {
      message: params.state.addOutboundMessage(
        params.body.trim() ? (JSON.parse(params.body) as Record<string, unknown>) : {},
      ),
    };
  } catch (error) {
    statusCode = 400;
    payload = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const response = Readable.from([Buffer.from(JSON.stringify(payload))]) as http.IncomingMessage;
  response.statusCode = statusCode;
  response.headers = {
    "content-type": "application/json; charset=utf-8",
  };

  params.callback?.(response);
  response.once("end", () => {
    params.request.emit("close");
  });
}

function requestUrlFromArgs(args: unknown[]): URL | undefined {
  const [first] = args;

  if (first instanceof URL) {
    return first;
  }

  if (typeof first === "string") {
    return new URL(first);
  }

  return undefined;
}

function createOpenClawBundleToolExecutor(bundleMcpRuntime: {
  tools: Array<{
    name: string;
    execute(
      callId: string,
      params: Record<string, unknown>,
      first?: unknown,
      second?: unknown,
    ): Promise<{
      content?: unknown;
    }>;
  }>;
}): ClawToolExecutor {
  const toolsByName = new Map(
    bundleMcpRuntime.tools.map((tool) => [tool.name, tool]),
  );

  return {
    transport: "openclaw-bundle-mcp",
    serverName: "claw",
    async callJsonTool<T>(
      toolName: ReadLoopToolName,
      _mcpToolName: ClawMcpToolName,
      params: Record<string, unknown> & { ssid: string },
    ): Promise<T> {
      const tool = toolsByName.get(toolName);

      if (!tool) {
        throw new Error(`OpenClaw bundle MCP tool not materialized: ${toolName}`);
      }

      const result = await tool.execute(
        `school-claw-${toolName}-${Date.now()}`,
        params,
        undefined,
        undefined,
      );

      return parseJsonToolContent(result.content) as T;
    },
  };
}

function parseJsonToolContent(content: unknown): unknown {
  if (!Array.isArray(content)) {
    throw new Error("OpenClaw bundle MCP tool returned invalid content.");
  }

  const block = content.find(
    (candidate): candidate is { type: "text"; text: string } =>
      !!candidate &&
      typeof candidate === "object" &&
      "type" in candidate &&
      candidate.type === "text" &&
      "text" in candidate &&
      typeof candidate.text === "string",
  );

  if (!block) {
    throw new Error("OpenClaw bundle MCP tool returned no JSON text block.");
  }

  return JSON.parse(block.text) as unknown;
}

function describeTransport(transport: string): string {
  return transport === "openclaw-bundle-mcp"
    ? "OpenClaw bundle MCP"
    : "stdio MCP";
}

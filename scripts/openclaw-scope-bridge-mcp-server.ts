import path from "node:path";
import { pathToFileURL } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { connectClawMcpClient, type ClawMcpClient } from "../src/mcp/client.js";
import {
  applyScopeBridgeToToolCall,
  CLAW_TOOL_PREFIX,
  MISSING_SESSION_BLOCK_REASON,
} from "../src/openclaw/scope-bridge.js";

const MCP_SERVER_NAME = "school-claw-scope-bridge-mcp";
const MCP_SERVER_VERSION = "0.0.0";
const fileKindValues = [
  "profile",
  "knowledge",
  "timeline",
  "errors",
  "observations",
  "artifacts",
  "class",
];

type ToolResultPayload = Record<string, unknown>;

type ScopeBridgeMcpServerOptions = {
  repoRoot: string;
  dataRoot: string;
  sessionKey?: string;
  nowIso?: string;
};

const toolDefinitions = [
  {
    name: "scope_get",
    description:
      "Resolve the current OpenClaw session scope. The bridge injects ssid from sessionKey.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: true,
    },
  },
  {
    name: "files_read",
    description:
      "Read authorized CLAW archive files selected by file id. The bridge injects ssid.",
    inputSchema: {
      type: "object",
      properties: {
        fileIds: {
          type: "array",
          items: {
            type: "string",
          },
        },
        maxChars: {
          type: "number",
        },
      },
      additionalProperties: true,
    },
  },
  {
    name: "files_read_all",
    description:
      "Read bounded authorized CLAW archive files for the current scope. The bridge injects ssid.",
    inputSchema: {
      type: "object",
      properties: {
        studentId: {
          type: "string",
        },
        kinds: {
          type: "array",
          items: {
            type: "string",
            enum: fileKindValues,
          },
        },
        dateFrom: {
          type: "string",
        },
        dateTo: {
          type: "string",
        },
        maxFiles: {
          type: "number",
        },
        maxTotalChars: {
          type: "number",
        },
      },
      additionalProperties: true,
    },
  },
  {
    name: "files_list",
    description:
      "List authorized CLAW archive files for the current scope. The bridge injects ssid.",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: fileKindValues,
        },
        studentId: {
          type: "string",
        },
        dateFrom: {
          type: "string",
        },
        dateTo: {
          type: "string",
        },
        query: {
          type: "string",
        },
        limit: {
          type: "number",
        },
      },
      additionalProperties: true,
    },
  },
  {
    name: "files_append",
    description:
      "Append a durable learning observation through scoped write/audit rules. The bridge injects ssid.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: [
                "parent_observation",
                "teacher_observation",
                "timeline",
                "class_note",
              ],
            },
            studentId: {
              type: "string",
            },
            month: {
              type: "string",
            },
            date: {
              type: "string",
            },
          },
          required: ["kind"],
        },
        frontmatter: {
          type: "object",
        },
        content: {
          type: "string",
        },
        reason: {
          type: "string",
        },
      },
      required: ["target", "content", "reason"],
      additionalProperties: true,
    },
  },
];

async function createScopeBridgeMcpServer(
  options: ScopeBridgeMcpServerOptions,
): Promise<Server> {
  const rawServerCommand = packageManagerExecCommand([
    "tsx",
    path.join(options.repoRoot, "src", "mcp", "server.ts"),
  ]);
  const rawClient = await connectClawMcpClient({
    serverName: "claw-raw",
    server: {
      command: rawServerCommand.command,
      args: rawServerCommand.args,
      cwd: options.repoRoot,
      env: compactEnv({
        CLAW_DATA_DIR: options.dataRoot,
        ...(options.nowIso ? { CLAW_NOW: options.nowIso } : {}),
      }),
    },
  });
  const server = new Server(
    {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  installShutdownHandlers(rawClient);

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: toolDefinitions,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const toolArguments = toolParams(request.params.arguments);
    const bridged = applyScopeBridgeToToolCall(
      {
        toolName: `${CLAW_TOOL_PREFIX}${toolName}`,
        params: toolArguments,
      },
      options.sessionKey ? { sessionKey: options.sessionKey } : {},
    );

    if (!bridged.ok) {
      return textJsonResult({
        ok: false,
        error: {
          code: "MISSING_SESSION",
          message: bridged.blockReason,
        },
      });
    }

    const result = await rawClient.callJsonTool<ToolResultPayload>(
      toolName,
      bridged.params,
    );

    return textJsonResult(result);
  });

  return server;
}

async function connectServerToStdio(server: Server): Promise<void> {
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

function textJsonResult(payload: ToolResultPayload) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload),
      },
    ],
    structuredContent: payload,
  };
}

function toolParams(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function compactEnv(env: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => {
      return typeof entry[1] === "string";
    }),
  );
}

function packageManagerExecCommand(args: string[]): {
  command: string;
  args: string[];
} {
  const npmExecPath = process.env.npm_execpath;

  if (npmExecPath && path.basename(npmExecPath).includes("pnpm")) {
    return {
      command: process.execPath,
      args: [npmExecPath, ...args],
    };
  }

  return {
    command: "pnpm",
    args,
  };
}

function installShutdownHandlers(rawClient: ClawMcpClient): void {
  const shutdown = (exitCode: number) => {
    void rawClient.close().finally(() => {
      process.exit(exitCode);
    });
  };

  process.once("SIGINT", () => shutdown(130));
  process.once("SIGTERM", () => shutdown(143));
}

async function main(): Promise<void> {
  const dataRoot = process.env.CLAW_DATA_DIR;
  const repoRoot = path.resolve(process.env.CLAW_SCOPE_BRIDGE_REPO_ROOT ?? process.cwd());

  if (!dataRoot) {
    throw new Error("CLAW_DATA_DIR is required to start the CLAW Scope Bridge MCP server.");
  }

  await connectServerToStdio(
    await createScopeBridgeMcpServer({
      repoRoot,
      dataRoot,
      ...(process.env.CLAW_SESSION_KEY
        ? { sessionKey: process.env.CLAW_SESSION_KEY }
        : {}),
      ...(process.env.CLAW_NOW ? { nowIso: process.env.CLAW_NOW } : {}),
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(MISSING_SESSION_BLOCK_REASON);
    process.exit(1);
  });
}

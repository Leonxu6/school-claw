import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  filesList,
  filesRead,
  filesReadAll,
  type FileKind,
  type FilesListRequest,
  type FilesReadAllRequest,
  type FilesReadRequest,
} from "../archive/scoped-read.js";
import { scopeGet, type ScopeGetRequest } from "../scope/scope-get.js";

type ClawMcpServerOptions = {
  dataRoot: string;
  tracePath?: string | undefined;
};

type ToolResultPayload = Record<string, unknown>;

const MCP_SERVER_NAME = "school-claw-mcp";
const MCP_SERVER_VERSION = "0.0.0";
const fileKindValues: FileKind[] = [
  "profile",
  "knowledge",
  "timeline",
  "errors",
  "observations",
  "artifacts",
  "class",
];

export function createClawMcpServer(options: ClawMcpServerOptions): Server {
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

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [
      {
        name: "scope_get",
        description: "Resolve the current OpenClaw session scope before reading CLAW data.",
        inputSchema: {
          type: "object",
          properties: {
            ssid: {
              type: "string",
            },
          },
          required: ["ssid"],
        },
      },
      {
        name: "files_read",
        description: "Read authorized CLAW archive files selected by file id.",
        inputSchema: {
          type: "object",
          properties: {
            ssid: {
              type: "string",
            },
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
          required: ["ssid", "fileIds"],
        },
      },
      {
        name: "files_read_all",
        description: "Read bounded authorized CLAW archive files for the current scope.",
        inputSchema: {
          type: "object",
          properties: {
            ssid: {
              type: "string",
            },
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
          required: ["ssid"],
        },
      },
      {
        name: "files_list",
        description: "List authorized CLAW archive files for the current scope.",
        inputSchema: {
          type: "object",
          properties: {
            ssid: {
              type: "string",
            },
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
          required: ["ssid"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const toolArguments = toolParams(request.params.arguments);
    const result = callClawTool(toolName, toolArguments, options);

    traceToolCall({
      tracePath: options.tracePath,
      toolName,
      toolArguments,
      result,
    });

    return textJsonResult(result);
  });

  return server;
}

export async function connectClawMcpServerToStdio(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function callClawTool(
  toolName: string,
  toolArguments: Record<string, unknown>,
  options: ClawMcpServerOptions,
): ToolResultPayload {
  switch (toolName) {
    case "scope_get":
      return scopeGet(scopeGetRequest(toolArguments)) as unknown as ToolResultPayload;
    case "files_read":
      return filesRead(filesReadRequest(toolArguments), {
        dataRoot: options.dataRoot,
      }) as unknown as ToolResultPayload;
    case "files_read_all":
      return filesReadAll(filesReadAllRequest(toolArguments), {
        dataRoot: options.dataRoot,
      }) as unknown as ToolResultPayload;
    case "files_list":
      return filesList(filesListRequest(toolArguments), {
        dataRoot: options.dataRoot,
      }) as unknown as ToolResultPayload;
    default:
      return {
        ok: false,
        error: {
          code: "UNKNOWN_TOOL",
          message: `Unknown CLAW MCP tool: ${toolName}`,
        },
      };
  }
}

function scopeGetRequest(toolArguments: Record<string, unknown>): ScopeGetRequest {
  const request: ScopeGetRequest = {};
  const ssid = optionalString(toolArguments.ssid);

  if (ssid !== undefined) {
    request.ssid = ssid;
  }

  return request;
}

function filesReadRequest(toolArguments: Record<string, unknown>): FilesReadRequest {
  const request: FilesReadRequest = {
    fileIds: stringArray(toolArguments.fileIds),
  };
  const ssid = optionalString(toolArguments.ssid);
  const maxChars = optionalNumber(toolArguments.maxChars);

  if (ssid !== undefined) {
    request.ssid = ssid;
  }

  if (maxChars !== undefined) {
    request.maxChars = maxChars;
  }

  return request;
}

function filesReadAllRequest(toolArguments: Record<string, unknown>): FilesReadAllRequest {
  const request: FilesReadAllRequest = {};

  assignOptional(request, "ssid", optionalString(toolArguments.ssid));
  assignOptional(request, "studentId", optionalString(toolArguments.studentId));
  assignOptional(request, "kinds", fileKindArray(toolArguments.kinds));
  assignOptional(request, "dateFrom", optionalString(toolArguments.dateFrom));
  assignOptional(request, "dateTo", optionalString(toolArguments.dateTo));
  assignOptional(request, "maxFiles", optionalNumber(toolArguments.maxFiles));
  assignOptional(
    request,
    "maxTotalChars",
    optionalNumber(toolArguments.maxTotalChars),
  );

  return request;
}

function filesListRequest(toolArguments: Record<string, unknown>): FilesListRequest {
  const request: FilesListRequest = {};

  assignOptional(request, "ssid", optionalString(toolArguments.ssid));
  assignOptional(request, "kind", optionalFileKind(toolArguments.kind));
  assignOptional(request, "studentId", optionalString(toolArguments.studentId));
  assignOptional(request, "dateFrom", optionalString(toolArguments.dateFrom));
  assignOptional(request, "dateTo", optionalString(toolArguments.dateTo));
  assignOptional(request, "query", optionalString(toolArguments.query));
  assignOptional(request, "limit", optionalNumber(toolArguments.limit));

  return request;
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

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function fileKindArray(value: unknown): FileKind[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const kinds = value.filter(optionalFileKind);
  return kinds.length > 0 ? kinds : undefined;
}

function optionalFileKind(value: unknown): FileKind | undefined {
  return typeof value === "string" && fileKindValues.includes(value as FileKind)
    ? (value as FileKind)
    : undefined;
}

function assignOptional<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) {
    target[key] = value;
  }
}

function traceToolCall(params: {
  tracePath?: string | undefined;
  toolName: string;
  toolArguments: Record<string, unknown>;
  result: ToolResultPayload;
}): void {
  if (!params.tracePath) {
    return;
  }

  appendFileSync(
    params.tracePath,
    `${JSON.stringify({
      transport: "stdio-mcp",
      toolName: params.toolName,
      arguments: params.toolArguments,
      resultOk: params.result.ok === true,
      timestamp: new Date().toISOString(),
    })}\n`,
  );
}

async function main(): Promise<void> {
  const dataRoot = process.env.CLAW_DATA_DIR;

  if (!dataRoot) {
    throw new Error("CLAW_DATA_DIR is required to start the CLAW MCP server.");
  }

  await connectClawMcpServerToStdio(
    createClawMcpServer({
      dataRoot,
      tracePath: process.env.CLAW_MCP_TRACE_PATH,
    }),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

import { appendFileSync } from "node:fs";
import path from "node:path";

import {
  callClawTool,
  type ClawMcpServerOptions,
  type ToolResultPayload,
} from "../mcp/server.js";
import { loadScopeRegistryFromFile } from "../scope/scope-get.js";
import { MISSING_SESSION_BLOCK_REASON } from "./scope-bridge.js";

export const CLAW_NATIVE_OPENCLAW_TOOL_NAMES = [
  "claw__scope_get",
  "claw__files_read",
  "claw__files_read_all",
  "claw__files_list",
  "claw__files_append",
  "claw__artifact_create",
] as const;

type ClawNativeOpenClawToolName = (typeof CLAW_NATIVE_OPENCLAW_TOOL_NAMES)[number];
type ClawMcpToolName = ClawNativeOpenClawToolName extends `claw__${infer Name}`
  ? Name
  : never;

type JsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
};

type ClawNativeOpenClawToolDefinition = {
  name: ClawNativeOpenClawToolName;
  mcpToolName: ClawMcpToolName;
  description: string;
  parameters: JsonSchema;
};

export type ClawNativeOpenClawToolContext = {
  sessionKey?: string;
  config?: ClawNativeOpenClawConfig;
  runtimeConfig?: ClawNativeOpenClawConfig;
  getRuntimeConfig?: () => ClawNativeOpenClawConfig | undefined;
};

export type ClawNativeOpenClawToolEnv = Record<string, string | undefined>;

type ClawNativeOpenClawConfig = {
  mcp?: {
    servers?: Record<
      string,
      {
        cwd?: unknown;
        env?: Record<string, unknown>;
      }
    >;
  };
};

export type ClawNativeOpenClawToolResult = {
  content: Array<{
    type: "text";
    text: string;
  }>;
  details: Record<string, unknown>;
};

export type ClawNativeOpenClawTool = {
  name: ClawNativeOpenClawToolName;
  label: string;
  description: string;
  parameters: JsonSchema;
  execute(
    toolCallId: string,
    input: unknown,
  ): Promise<ClawNativeOpenClawToolResult>;
};

export function createClawNativeOpenClawTools(params: {
  context: ClawNativeOpenClawToolContext;
  env?: ClawNativeOpenClawToolEnv;
}): ClawNativeOpenClawTool[] {
  const env = params.env ?? process.env;

  return CLAW_NATIVE_OPENCLAW_TOOL_DEFINITIONS.map((definition) => ({
    name: definition.name,
    label: definition.name,
    description: definition.description,
    parameters: cloneSchema(definition.parameters),
    execute: async (_toolCallId, input) =>
      executeClawNativeOpenClawTool({
        definition,
        input,
        context: params.context,
        env,
      }),
  }));
}

const fileKindValues = [
  "profile",
  "knowledge",
  "timeline",
  "errors",
  "observations",
  "artifacts",
  "class",
];
const artifactTypeValues = [
  "brief",
  "practice",
  "feedback",
  "weekly_summary",
  "ppt_outline",
  "error_table",
];
const artifactFormatValues = ["markdown", "csv", "ppt_outline"];

const CLAW_NATIVE_OPENCLAW_TOOL_DEFINITIONS: ClawNativeOpenClawToolDefinition[] = [
  {
    name: "claw__scope_get",
    mcpToolName: "scope_get",
    description: "Resolve the current OpenClaw session scope before reading CLAW data.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "claw__files_read",
    mcpToolName: "files_read",
    description: "Read authorized CLAW archive files selected by file id.",
    parameters: {
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
      required: ["fileIds"],
    },
  },
  {
    name: "claw__files_read_all",
    mcpToolName: "files_read_all",
    description: "Read bounded authorized CLAW archive files for the current scope.",
    parameters: {
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
    },
  },
  {
    name: "claw__files_list",
    mcpToolName: "files_list",
    description: "List authorized CLAW archive files for the current scope.",
    parameters: {
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
    },
  },
  {
    name: "claw__files_append",
    mcpToolName: "files_append",
    description: "Append a durable learning observation through CLAW scoped write/audit rules.",
    parameters: {
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
    },
  },
  {
    name: "claw__artifact_create",
    mcpToolName: "artifact_create",
    description: "Create an audited generated CLAW artifact from readable source files.",
    parameters: {
      type: "object",
      properties: {
        artifactType: {
          type: "string",
          enum: artifactTypeValues,
        },
        title: {
          type: "string",
        },
        studentId: {
          type: "string",
        },
        format: {
          type: "string",
          enum: artifactFormatValues,
        },
        content: {
          type: "string",
        },
        sourceFileIds: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },
      required: [
        "artifactType",
        "title",
        "format",
        "content",
        "sourceFileIds",
      ],
    },
  },
];

async function executeClawNativeOpenClawTool(params: {
  definition: ClawNativeOpenClawToolDefinition;
  input: unknown;
  context: ClawNativeOpenClawToolContext;
  env: ClawNativeOpenClawToolEnv;
}): Promise<ClawNativeOpenClawToolResult> {
  const sessionKey = normalizeOptionalString(params.context.sessionKey);

  if (!sessionKey) {
    return textJsonResult({
      ok: false,
      error: {
        code: "MISSING_SESSION_KEY",
        message: MISSING_SESSION_BLOCK_REASON,
      },
    });
  }

  const dataRoot = resolveNativePathEnvValue("CLAW_DATA_DIR", {
    env: params.env,
    context: params.context,
  });

  if (!dataRoot) {
    return textJsonResult({
      ok: false,
      error: {
        code: "MISSING_DATA_ROOT",
        message: "CLAW_DATA_DIR is required before calling CLAW tools.",
      },
    });
  }

  const toolArguments = {
    ...toolParams(params.input),
    ssid: sessionKey,
  };
  const options = createClawMcpOptions({
    dataRoot,
    env: params.env,
    context: params.context,
  });
  const result = await callClawTool(
    params.definition.mcpToolName,
    toolArguments,
    options,
  );

  traceNativeToolCall({
    tracePath: resolveNativePathEnvValue("CLAW_MCP_TRACE_PATH", {
      env: params.env,
      context: params.context,
    }),
    toolName: params.definition.mcpToolName,
    toolArguments,
    result,
  });

  return textJsonResult(result, {
    mcpTool: params.definition.mcpToolName,
    transport: "openclaw-native-plugin",
  });
}

function createClawMcpOptions(params: {
  dataRoot: string;
  env: ClawNativeOpenClawToolEnv;
  context: ClawNativeOpenClawToolContext;
}): ClawMcpServerOptions {
  const options: ClawMcpServerOptions = {
    dataRoot: params.dataRoot,
  };
  const registryPath = resolveNativePathEnvValue("CLAW_SCOPE_REGISTRY_PATH", {
    env: params.env,
    context: params.context,
  });
  const nowIso =
    normalizeOptionalString(params.env.CLAW_NOW) ??
    normalizeOptionalString(readClawMcpServerEnvValue(params.context, "CLAW_NOW"));

  if (registryPath) {
    options.registry = loadScopeRegistryFromFile(registryPath);
  }

  if (nowIso) {
    options.now = () => new Date(nowIso);
  }

  return options;
}

function resolveNativePathEnvValue(
  key: string,
  params: {
    env: ClawNativeOpenClawToolEnv;
    context: ClawNativeOpenClawToolContext;
  },
): string | undefined {
  const raw =
    normalizeOptionalString(params.env[key]) ??
    normalizeOptionalString(readClawMcpServerEnvValue(params.context, key));

  if (!raw) {
    return undefined;
  }

  if (path.isAbsolute(raw)) {
    return raw;
  }

  return path.resolve(resolveClawMcpServerCwd(params.context), raw);
}

function resolveClawMcpServerCwd(context: ClawNativeOpenClawToolContext): string {
  const cwd = normalizeOptionalString(readClawMcpServerConfig(context)?.cwd);

  if (!cwd) {
    return process.cwd();
  }

  return path.isAbsolute(cwd) ? cwd : path.resolve(process.cwd(), cwd);
}

function readClawMcpServerEnvValue(
  context: ClawNativeOpenClawToolContext,
  key: string,
): unknown {
  return readClawMcpServerConfig(context)?.env?.[key];
}

function readClawMcpServerConfig(
  context: ClawNativeOpenClawToolContext,
): { cwd?: unknown; env?: Record<string, unknown> } | undefined {
  const config = context.getRuntimeConfig?.() ?? context.runtimeConfig ?? context.config;
  return config?.mcp?.servers?.claw;
}

function textJsonResult(
  payload: ToolResultPayload,
  details: Record<string, unknown> = {},
): ClawNativeOpenClawToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    details: {
      status: payload.ok === true ? "ok" : "error",
      structuredContent: payload,
      ...details,
    },
  };
}

function traceNativeToolCall(params: {
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
      transport: "openclaw-native-plugin",
      toolName: params.toolName,
      arguments: params.toolArguments,
      resultOk: params.result.ok === true,
      timestamp: new Date().toISOString(),
    })}\n`,
  );
}

function toolParams(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function cloneSchema(schema: JsonSchema): JsonSchema {
  return JSON.parse(JSON.stringify(schema)) as JsonSchema;
}

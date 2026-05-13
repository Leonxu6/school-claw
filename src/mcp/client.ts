import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export type ClawMcpServerLaunchConfig = {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string | number | boolean>;
};

export type ClawMcpCallTrace = {
  transport: "stdio-mcp";
  serverName: string;
  toolName: string;
  params: Record<string, unknown>;
  childPid: number | null;
  result: unknown;
};

export type ClawMcpClient = {
  trace: ClawMcpCallTrace[];
  listTools(): Promise<string[]>;
  callJsonTool<T = unknown>(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<T>;
  close(): Promise<void>;
};

export async function connectClawMcpClient(params: {
  serverName: string;
  server: ClawMcpServerLaunchConfig;
}): Promise<ClawMcpClient> {
  const transport = new StdioClientTransport({
    command: params.server.command,
    ...(params.server.args ? { args: params.server.args } : {}),
    ...(params.server.cwd ? { cwd: params.server.cwd } : {}),
    env: mergedEnv(params.server.env),
    stderr: "pipe",
  });
  const client = new Client({
    name: "school-claw-openclaw-read-loop",
    version: "0.0.0",
  });
  const trace: ClawMcpCallTrace[] = [];

  await client.connect(transport);

  return {
    trace,
    async listTools() {
      const result = await client.listTools();
      return result.tools.map((tool) => tool.name);
    },
    async callJsonTool<T>(toolName: string, toolParams: Record<string, unknown>) {
      const result = await client.callTool({
        name: toolName,
        arguments: toolParams,
      });
      const parsed = parseJsonTextContent(result.content);

      trace.push({
        transport: "stdio-mcp",
        serverName: params.serverName,
        toolName,
        params: toolParams,
        childPid: transport.pid,
        result: parsed,
      });

      return parsed as T;
    },
    async close() {
      await client.close();
    },
  };
}

function parseJsonTextContent(content: unknown): unknown {
  if (!Array.isArray(content)) {
    throw new Error("CLAW MCP tool returned invalid content.");
  }

  const textBlock = content.find(isTextBlock);

  if (!textBlock) {
    throw new Error("CLAW MCP tool returned no JSON text content.");
  }

  return JSON.parse(textBlock.text) as unknown;
}

function isTextBlock(value: unknown): value is { type: "text"; text: string } {
  return (
    !!value &&
    typeof value === "object" &&
    "type" in value &&
    value.type === "text" &&
    "text" in value &&
    typeof value.text === "string"
  );
}

function mergedEnv(env: ClawMcpServerLaunchConfig["env"]): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  for (const [key, value] of Object.entries(env ?? {})) {
    merged[key] = String(value);
  }

  return merged;
}

import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { createClawNativeOpenClawTools } from "../src/openclaw/native-tools.js";

const dataRoot = fileURLToPath(
  new URL("./fixtures/markdown-archive/", import.meta.url),
);

const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const parentBSsid = "agent:claw-agent:qqbot:direct:parent-openid-002";

describe("native OpenClaw CLAW tools", () => {
  it("hide ssid from model-facing schemas and inject the trusted OpenClaw session key", async () => {
    const tools = createClawNativeOpenClawTools({
      context: {
        sessionKey: parentASsid,
      },
      env: {
        CLAW_DATA_DIR: dataRoot,
      },
    });

    const scopeGet = tools.find((tool) => tool.name === "claw__scope_get");

    expect(scopeGet).toBeDefined();
    expect(scopeGet?.parameters).toMatchObject({
      type: "object",
      properties: {},
    });
    expect(scopeGet?.parameters.properties).not.toHaveProperty("ssid");

    const result = await scopeGet?.execute("call-1", {
      ssid: parentBSsid,
    });
    const payload = parseJsonToolResult(result);

    expect(payload).toMatchObject({
      ok: true,
      scope: {
        displayName: "张三家长",
        studentIds: ["stu_001"],
      },
    });
  });

  it("fails closed when OpenClaw does not provide a trusted session key", async () => {
    const tools = createClawNativeOpenClawTools({
      context: {},
      env: {
        CLAW_DATA_DIR: dataRoot,
      },
    });
    const scopeGet = tools.find((tool) => tool.name === "claw__scope_get");

    const result = await scopeGet?.execute("call-1", {});
    const payload = parseJsonToolResult(result);

    expect(payload).toEqual({
      ok: false,
      error: {
        code: "MISSING_SESSION_KEY",
        message:
          "CLAW Scope Bridge requires an OpenClaw sessionKey before calling CLAW tools.",
      },
    });
  });

  it("uses the configured CLAW MCP server env when the gateway process env omits CLAW_DATA_DIR", async () => {
    const tools = createClawNativeOpenClawTools({
      context: {
        sessionKey: parentASsid,
        config: {
          mcp: {
            servers: {
              claw: {
                env: {
                  CLAW_DATA_DIR: dataRoot,
                },
              },
            },
          },
        },
      },
      env: {},
    });
    const scopeGet = tools.find((tool) => tool.name === "claw__scope_get");

    const result = await scopeGet?.execute("call-1", {});
    const payload = parseJsonToolResult(result);

    expect(payload).toMatchObject({
      ok: true,
      scope: {
        displayName: "张三家长",
        studentIds: ["stu_001"],
      },
    });
  });
});

function parseJsonToolResult(result: unknown): unknown {
  if (!result || typeof result !== "object" || !("content" in result)) {
    throw new Error("Tool result did not include content.");
  }

  const content = (result as { content?: unknown }).content;

  if (!Array.isArray(content)) {
    throw new Error("Tool result content was not an array.");
  }

  const text = content.find(
    (item): item is { type: "text"; text: string } =>
      !!item &&
      typeof item === "object" &&
      "type" in item &&
      item.type === "text" &&
      "text" in item &&
      typeof item.text === "string",
  );

  if (!text) {
    throw new Error("Tool result did not include text JSON.");
  }

  return JSON.parse(text.text) as unknown;
}

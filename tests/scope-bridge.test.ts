import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { filesRead } from "../src/archive/scoped-read.js";
import {
  applyScopeBridgeToToolCall,
  registerClawScopeBridgePlugin,
  scopeBridgeBeforeToolCall,
  type ScopeBridgeBeforeToolCallHandler,
} from "../src/openclaw/scope-bridge.js";

const dataRoot = fileURLToPath(
  new URL("./fixtures/markdown-archive/", import.meta.url),
);

const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const parentBSsid = "agent:claw-agent:qqbot:direct:parent-openid-002";

describe("OpenClaw Scope Bridge before_tool_call adapter", () => {
  it("overwrites a forged ssid on CLAW MCP tool calls", () => {
    const originalParams = {
      ssid: parentBSsid,
      fileIds: ["classes/class_001/students/stu_002/profile.md"],
    };

    const decision = scopeBridgeBeforeToolCall(
      {
        toolName: "claw__files_read",
        params: originalParams,
      },
      {
        toolName: "claw__files_read",
        sessionKey: parentASsid,
      },
    );

    expect(decision).toEqual({
      params: {
        ssid: parentASsid,
        fileIds: ["classes/class_001/students/stu_002/profile.md"],
      },
    });
    expect(originalParams.ssid).toBe(parentBSsid);
  });

  it("fails closed for CLAW MCP tool calls without a sessionKey", () => {
    const decision = scopeBridgeBeforeToolCall(
      {
        toolName: "claw__files_read",
        params: {
          ssid: parentBSsid,
          fileIds: ["classes/class_001/students/stu_002/profile.md"],
        },
      },
      {
        toolName: "claw__files_read",
      },
    );

    expect(decision).toEqual({
      block: true,
      blockReason:
        "CLAW Scope Bridge requires an OpenClaw sessionKey before calling CLAW tools.",
    });
  });

  it("injects ssid for CLAW MCP tool calls that omit params", () => {
    const decision = scopeBridgeBeforeToolCall(
      {
        toolName: "claw__scope_get",
      },
      {
        toolName: "claw__scope_get",
        sessionKey: parentASsid,
      },
    );

    expect(decision).toEqual({
      params: {
        ssid: parentASsid,
      },
    });
  });

  it("leaves non-CLAW tools unchanged", () => {
    const params = {
      ssid: parentBSsid,
      command: "echo should-not-be-bridged",
    };

    const decision = scopeBridgeBeforeToolCall(
      {
        toolName: "bash",
        params,
      },
      {
        toolName: "bash",
        sessionKey: parentASsid,
      },
    );

    expect(decision).toBeUndefined();
    expect(params).toEqual({
      ssid: parentBSsid,
      command: "echo should-not-be-bridged",
    });
  });

  it("registers as an OpenClaw before_tool_call plugin hook", async () => {
    let registered:
      | {
          hookName: string;
          handler: ScopeBridgeBeforeToolCallHandler;
          priority?: number;
        }
      | undefined;

    registerClawScopeBridgePlugin({
      on(hookName, handler, options) {
        registered = {
          hookName,
          handler,
          ...(options?.priority !== undefined ? { priority: options.priority } : {}),
        };
      },
    });

    expect(registered?.hookName).toBe("before_tool_call");
    expect(registered?.priority).toBe(100);

    const decision = await registered?.handler(
      {
        toolName: "claw__scope_get",
        params: {
          ssid: parentBSsid,
        },
      },
      {
        toolName: "claw__scope_get",
        sessionKey: parentASsid,
      },
    );

    expect(decision).toEqual({
      params: {
        ssid: parentASsid,
      },
    });
  });

  it("proves bridge-injected ssid drives MCP permission checks", () => {
    const bridged = applyScopeBridgeToToolCall(
      {
        toolName: "claw__files_read",
        params: {
          ssid: parentBSsid,
          fileIds: ["classes/class_001/students/stu_002/profile.md"],
        },
      },
      {
        toolName: "claw__files_read",
        sessionKey: parentASsid,
      },
    );

    expect(bridged.ok).toBe(true);

    if (!bridged.ok) {
      throw new Error(`Expected bridged call, received ${bridged.blockReason}`);
    }

    expect(bridged.params.ssid).toBe(parentASsid);

    const forbidden = filesRead(
      {
        ssid: bridged.params.ssid,
        fileIds: bridged.params.fileIds,
      },
      { dataRoot },
    );

    expect(forbidden.ok).toBe(false);

    if (forbidden.ok) {
      throw new Error("Expected forged cross-read to be forbidden");
    }

    expect(forbidden.error.code).toBe("FORBIDDEN");

    const allowed = filesRead(
      {
        ssid: bridged.params.ssid,
        fileIds: ["classes/class_001/students/stu_001/profile.md"],
      },
      { dataRoot },
    );

    expect(allowed.ok).toBe(true);
  });
});

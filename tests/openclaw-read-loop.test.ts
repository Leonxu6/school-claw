import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { connectClawMcpClient } from "../src/mcp/client.js";
import { createClawAgentOpenClawConfig } from "../src/openclaw/claw-agent-config.js";
import { runOpenClawQaChannelReadLoopDemo } from "../src/openclaw/qa-channel-read-loop.js";
import {
  runClawAgentReadTurn,
  runOneAgentOpenClawReadLoopDemo,
} from "../src/openclaw/read-loop.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const dataRoot = fileURLToPath(
  new URL("./fixtures/markdown-archive/", import.meta.url),
);
const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const parentBSsid = "agent:claw-agent:qqbot:direct:parent-openid-002";
const disabledParentSsid =
  "agent:claw-agent:qqbot:direct:disabled-parent-openid-001";

describe("one-agent OpenClaw read loop", () => {
  it("defines one claw-agent with runnable CLAW MCP access and no native data tools", () => {
    const config = createClawAgentOpenClawConfig({ repoRoot, dataRoot });

    expect(config.session.dmScope).toBe("per-channel-peer");
    expect(config.openclawRuntime).toEqual({
      checkoutPath: "/Users/leon/openclaw",
      pinnedCommit: "da23f4572da7d59ef97688ad8b61771e5b708733",
    });
    expect(config.agents.list).toHaveLength(1);

    const agent = config.agents.list[0];

    expect(agent).toMatchObject({
      id: "claw-agent",
      default: true,
      name: "CLAW Agent",
      tools: {
        allow: ["bundle-mcp", "message", "session_status"],
      },
    });
    expect(agent?.tools.deny).toEqual(
      expect.arrayContaining([
        "read",
        "write",
        "edit",
        "apply_patch",
        "exec",
        "process",
        "browser",
        "gateway",
        "cron",
        "session_spawn",
        "agent_send",
      ]),
    );
    expect(path.relative(agent?.workspace ?? "", dataRoot).startsWith("..")).toBe(
      true,
    );
    expect(config.mcp.servers.claw.command).toBe("pnpm");
    expect(config.mcp.servers.claw.cwd).toBe(path.resolve(repoRoot));
    expect(config.mcp.servers.claw.args).toEqual([
      "tsx",
      path.join(repoRoot, "src", "mcp", "server.ts"),
    ]);
    expect(existsSync(path.join(repoRoot, "src", "mcp", "server.ts"))).toBe(true);
    expect(config.mcp.servers.claw.env.CLAW_DATA_DIR).toBe(path.resolve(dataRoot));
  });

  it("starts the configured CLAW MCP server and records real stdio tool calls", async () => {
    const config = createClawAgentOpenClawConfig({ repoRoot, dataRoot });
    const tracePath = path.join(
      mkdtempSync(path.join(os.tmpdir(), "school-claw-mcp-")),
      "trace.jsonl",
    );
    const client = await connectClawMcpClient({
      serverName: "claw",
      server: {
        ...config.mcp.servers.claw,
        env: {
          ...config.mcp.servers.claw.env,
          CLAW_MCP_TRACE_PATH: tracePath,
        },
      },
    });

    try {
      await expect(client.listTools()).resolves.toEqual(
        expect.arrayContaining(["scope_get", "files_read", "files_read_all"]),
      );

      const result = await client.callJsonTool("scope_get", { ssid: parentASsid });

      expect(result).toMatchObject({
        ok: true,
        scope: {
          displayName: "张三家长",
        },
      });
    } finally {
      await client.close();
    }

    const trace = readFileSync(tracePath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { toolName?: string; transport?: string });

    expect(trace).toEqual([
      expect.objectContaining({
        toolName: "scope_get",
        transport: "stdio-mcp",
      }),
    ]);
  });

  it("points at a prompt that requires scope before factual archive reads", () => {
    const config = createClawAgentOpenClawConfig({ repoRoot, dataRoot });
    const prompt = readFileSync(config.agents.list[0]?.systemPromptOverride ?? "", "utf8");

    expect(prompt).toContain("one claw-agent");
    expect(prompt).toContain("claw__scope_get");
    expect(prompt).toContain("claw__files_read");
    expect(prompt).toContain("claw__files_read_all");
    expect(prompt).toContain("Do not use native file tools");
    expect(prompt.indexOf("claw__scope_get")).toBeLessThan(
      prompt.indexOf("claw__files_read"),
    );
  });

  it("routes two parent sessions through one agent and returns scoped evidence through MCP", async () => {
    const demo = await runOneAgentOpenClawReadLoopDemo({
      repoRoot,
      dataRoot,
      turns: [
        {
          sessionKey: parentASsid,
          message: "请根据档案概括今天的学习风险。",
        },
        {
          sessionKey: parentBSsid,
          message: "请根据档案概括今天的学习风险。",
        },
      ],
    });

    expect(demo.runs.map((run) => run.agentId)).toEqual([
      "claw-agent",
      "claw-agent",
    ]);
    expect(demo.nativeToolCalls).toEqual([]);

    const parentA = demo.runs.find((run) => run.sessionKey === parentASsid);
    const parentB = demo.runs.find((run) => run.sessionKey === parentBSsid);

    expect(parentA?.reply).toContain("张三");
    expect(parentA?.reply).toContain("单位一");
    expect(parentA?.reply).not.toContain("李四");
    expect(parentB?.reply).toContain("李四");
    expect(parentB?.reply).toContain("英语听写");
    expect(parentB?.reply).not.toContain("张三");

    for (const run of demo.runs) {
      expect(run.toolCalls.map((call) => call.toolName)).toEqual([
        "claw__scope_get",
        "claw__files_read_all",
      ]);
      expect(run.toolCalls.map((call) => call.transport)).toEqual([
        "stdio-mcp",
        "stdio-mcp",
      ]);
      expect(run.toolCalls.every((call) => call.params.ssid === run.sessionKey)).toBe(
        true,
      );
    }

    expect(demo.logLines.join("\n")).toContain("message enters one claw-agent");
    expect(demo.logLines.join("\n")).toContain(
      "agent/tool path calls claw__scope_get via stdio MCP",
    );
    expect(demo.logLines.join("\n")).toContain(
      "agent/tool path calls claw__files_read_all via stdio MCP",
    );
  });

  it("dispatches OpenClaw QA-channel messages into one claw-agent", async () => {
    const demo = await runOpenClawQaChannelReadLoopDemo({
      repoRoot,
      dataRoot,
      turns: [
        {
          senderId: "parent-openid-001",
          message: "我孩子今天数学怎么样？",
        },
        {
          senderId: "parent-openid-002",
          message: "我孩子今天数学怎么样？",
        },
      ],
    });

    expect(demo.runs.map((run) => run.agentId)).toEqual([
      "claw-agent",
      "claw-agent",
    ]);
    expect(demo.runs.map((run) => run.sessionKey)).toEqual([parentASsid, parentBSsid]);
    expect(demo.runs.flatMap((run) => run.toolCalls.map((call) => call.transport))).toEqual([
      "openclaw-bundle-mcp",
      "openclaw-bundle-mcp",
      "openclaw-bundle-mcp",
      "openclaw-bundle-mcp",
    ]);
    expect(demo.runs[0]?.reply).toContain("张三");
    expect(demo.runs[1]?.reply).toContain("李四");
    expect(demo.outboundMessages.map((message) => message.text)).toEqual([
      expect.stringContaining("张三"),
      expect.stringContaining("李四"),
    ]);
    expect(demo.logLines.join("\n")).toContain(
      "OpenClaw QA-channel handleQaInbound dispatched claw-agent",
    );
    expect(demo.logLines.join("\n")).toContain(
      "OpenClaw bundle MCP materialized claw__scope_get",
    );
    expect(demo.logLines.join("\n")).toContain("real CLAW MCP server handled scope_get");
    expect(demo.nativeToolCalls).toEqual([]);
  }, 30_000);

  it("stops after scope_get when the session is disabled", async () => {
    const turn = await runClawAgentReadTurn({
      repoRoot,
      dataRoot,
      sessionKey: disabledParentSsid,
      message: "我孩子今天数学怎么样？",
    });

    expect(turn.ok).toBe(false);
    expect(turn.reply).toContain("SESSION_DISABLED");
    expect(turn.toolCalls.map((call) => call.toolName)).toEqual(["claw__scope_get"]);
  });
});

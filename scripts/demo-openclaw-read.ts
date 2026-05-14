import { fileURLToPath } from "node:url";

import { canBindLoopback } from "../src/openclaw/e2e-availability.js";
import { runOpenClawQaChannelReadLoopDemo } from "../src/openclaw/qa-channel-read-loop.js";
import { runOneAgentOpenClawReadLoopDemo } from "../src/openclaw/read-loop.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const dataRoot = fileURLToPath(
  new URL("../tests/fixtures/markdown-archive/", import.meta.url),
);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const turns = [
  {
    senderId: "parent-openid-001",
    message: "我孩子今天数学怎么样？",
  },
  {
    senderId: "parent-openid-002",
    message: "我孩子今天数学怎么样？",
  },
];

if (canBindLoopback()) {
  const demo = await runOpenClawQaChannelReadLoopDemo({
    repoRoot,
    dataRoot,
    turns,
  });
  const output = demo.logLines.join("\n");

  assert(demo.runs.length === 2, "expected two parent-session runs");
  assert(demo.runs.every((run) => run.agentId === "claw-agent"), "expected one claw-agent");
  assert(
    demo.runs.every((run) => run.toolCalls.some((call) => call.toolName === "claw__scope_get")),
    "missing claw__scope_get",
  );
  assert(
    demo.runs.every((run) =>
      run.toolCalls.some((call) => call.toolName === "claw__files_read_all"),
    ),
    "missing claw__files_read_all",
  );
  assert(demo.nativeToolCalls.length === 0, "native tool calls should be empty");
  assert(
    output.includes("OpenClaw QA-channel handleQaInbound dispatched claw-agent"),
    "missing OpenClaw QA-channel dispatch proof",
  );
  assert(output.includes("real CLAW MCP server handled scope_get"), "missing MCP scope_get proof");
  assert(
    output.includes("real CLAW MCP server handled files_read_all"),
    "missing MCP files_read_all proof",
  );
  assert(
    demo.runs[0]?.reply !== demo.runs[1]?.reply,
    "different parent scopes should produce different evidence replies",
  );

  for (const line of demo.logLines) {
    console.log(line);
  }

  for (const run of demo.runs) {
    console.log("");
    console.log(`${run.sessionKey}`);
    console.log(run.reply);
  }

  console.log("");
  console.log("OpenClaw QA outbound messages");
  for (const message of demo.outboundMessages) {
    console.log(`${message.to}: ${message.text.split("\n")[0] ?? ""}`);
  }
} else {
  const demo = await runOneAgentOpenClawReadLoopDemo({
    repoRoot,
    dataRoot,
    turns: turns.map((turn) => ({
      sessionKey: `agent:claw-agent:qqbot:direct:${turn.senderId}`,
      message: turn.message,
    })),
  });
  const output = demo.logLines.join("\n");

  assert(demo.runs.length === 2, "expected two parent-session runs");
  assert(demo.runs.every((run) => run.agentId === "claw-agent"), "expected one claw-agent");
  assert(
    demo.runs.every((run) => run.toolCalls.some((call) => call.toolName === "claw__scope_get")),
    "missing claw__scope_get",
  );
  assert(
    demo.runs.every((run) =>
      run.toolCalls.some((call) => call.toolName === "claw__files_read_all"),
    ),
    "missing claw__files_read_all",
  );
  assert(demo.nativeToolCalls.length === 0, "native tool calls should be empty");
  assert(output.includes("message enters one claw-agent"), "missing one-agent proof");
  assert(output.includes("agent/tool path calls claw__scope_get"), "missing scope_get proof");
  assert(output.includes("agent/tool path calls claw__files_read_all"), "missing read proof");
  assert(
    demo.runs[0]?.reply !== demo.runs[1]?.reply,
    "different parent scopes should produce different evidence replies",
  );

  console.log("Loopback bind unavailable; using verifier-safe non-network E2E fallback.");
  for (const line of demo.logLines) {
    console.log(line);
  }

  for (const run of demo.runs) {
    console.log("");
    console.log(`${run.sessionKey}`);
    console.log(run.reply);
  }
}

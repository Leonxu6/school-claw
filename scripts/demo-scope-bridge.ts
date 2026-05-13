import { fileURLToPath } from "node:url";

import { filesRead } from "../src/archive/scoped-read.js";
import { applyScopeBridgeToToolCall } from "../src/openclaw/scope-bridge.js";

const dataRoot = fileURLToPath(
  new URL("../tests/fixtures/markdown-archive/", import.meta.url),
);

const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const parentBSsid = "agent:claw-agent:qqbot:direct:parent-openid-002";
const studentAProfile = "classes/class_001/students/stu_001/profile.md";
const studentBProfile = "classes/class_001/students/stu_002/profile.md";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const bridged = applyScopeBridgeToToolCall(
  {
    toolName: "claw__files_read",
    params: {
      ssid: parentBSsid,
      fileIds: [studentBProfile],
    },
  },
  {
    toolName: "claw__files_read",
    sessionKey: parentASsid,
  },
);

assert(bridged.ok, bridged.ok ? "" : bridged.blockReason);

if (!bridged.ok) {
  throw new Error("unreachable");
}

console.log("tool call args contain ssid=parentB");
console.log("OpenClaw context sessionKey=parentA");
assert(bridged.params.ssid === parentASsid, "Scope Bridge did not rewrite ssid");
console.log("Scope Bridge rewrites ssid=parentA");

const forbidden = filesRead(
  {
    ssid: bridged.params.ssid,
    fileIds: bridged.params.fileIds,
  },
  { dataRoot },
);

assert(!forbidden.ok, "forged studentB read unexpectedly succeeded");
assert(
  !forbidden.ok && forbidden.error.code === "FORBIDDEN",
  "forged studentB read failed with the wrong error",
);
console.log("read studentB -> FORBIDDEN");

const allowed = filesRead(
  {
    ssid: bridged.params.ssid,
    fileIds: [studentAProfile],
  },
  { dataRoot },
);

assert(allowed.ok, allowed.ok ? "" : `studentA read failed: ${allowed.error.code}`);
console.log("read studentA -> OK");

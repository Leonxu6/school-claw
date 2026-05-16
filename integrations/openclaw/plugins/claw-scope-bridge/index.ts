import {
  CLAW_NATIVE_OPENCLAW_TOOL_NAMES,
  createClawNativeOpenClawTools,
  type ClawNativeOpenClawToolContext,
} from "../../../../src/openclaw/native-tools.js";
import {
  SCOPE_BRIDGE_PLUGIN_ID,
  SCOPE_BRIDGE_PLUGIN_NAME,
  SCOPE_BRIDGE_PRIORITY,
  scopeBridgeBeforeToolCall,
  type ScopeBridgePluginApi,
} from "../../../../src/openclaw/scope-bridge.js";

export default {
  id: SCOPE_BRIDGE_PLUGIN_ID,
  name: SCOPE_BRIDGE_PLUGIN_NAME,
  description: "Injects the trusted OpenClaw sessionKey into CLAW MCP tool calls.",
  register(api: ScopeBridgePluginApi) {
    api.registerTool?.(
      (context: ClawNativeOpenClawToolContext) =>
        createClawNativeOpenClawTools({ context }),
      { names: [...CLAW_NATIVE_OPENCLAW_TOOL_NAMES] },
    );
    api.on(
      "before_tool_call",
      (event, context) => scopeBridgeBeforeToolCall(event, context),
      { priority: SCOPE_BRIDGE_PRIORITY },
    );
  },
};

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const CLAW_TOOL_PREFIX = "claw__";
const MISSING_SESSION_BLOCK_REASON =
  "CLAW Scope Bridge requires an OpenClaw sessionKey before calling CLAW tools.";

type ScopeBridgeToolParams = Record<string, unknown>;

type ScopeBridgeBeforeToolCallEvent = {
  toolName: string;
  params?: ScopeBridgeToolParams;
};

type ScopeBridgeToolContext = {
  sessionKey?: string;
};

type ScopeBridgePluginApi = {
  on(
    hookName: "before_tool_call",
    handler: (
      event: ScopeBridgeBeforeToolCallEvent,
      context: ScopeBridgeToolContext,
    ) =>
      | { params?: ScopeBridgeToolParams & { ssid: string }; block?: boolean; blockReason?: string }
      | undefined,
    options?: {
      priority?: number;
    },
  ): void;
};

export default definePluginEntry({
  id: "claw-scope-bridge",
  name: "CLAW Scope Bridge",
  description: "Injects the trusted OpenClaw sessionKey into CLAW MCP tool calls.",
  register(api: ScopeBridgePluginApi) {
    api.on(
      "before_tool_call",
      (event, context) => {
        if (!event.toolName.startsWith(CLAW_TOOL_PREFIX)) {
          return undefined;
        }

        if (!context.sessionKey) {
          return {
            block: true,
            blockReason: MISSING_SESSION_BLOCK_REASON,
          };
        }

        return {
          params: {
            ...(event.params ?? {}),
            ssid: context.sessionKey,
          },
        };
      },
      { priority: 100 },
    );
  },
});

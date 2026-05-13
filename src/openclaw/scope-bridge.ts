export const CLAW_TOOL_PREFIX = "claw__";
export const SCOPE_BRIDGE_PLUGIN_ID = "claw-scope-bridge";
export const SCOPE_BRIDGE_PLUGIN_NAME = "CLAW Scope Bridge";
export const SCOPE_BRIDGE_PRIORITY = 100;
export const MISSING_SESSION_BLOCK_REASON =
  "CLAW Scope Bridge requires an OpenClaw sessionKey before calling CLAW tools.";

export type ScopeBridgeToolParams = Record<string, unknown>;

export type ScopeBridgeBeforeToolCallEvent<
  TParams extends ScopeBridgeToolParams = ScopeBridgeToolParams,
> = {
  toolName: string;
  params?: TParams;
  runId?: string;
  toolCallId?: string;
};

export type ScopeBridgeToolContext = {
  toolName?: string;
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  runId?: string;
  toolCallId?: string;
};

export type ScopeBridgeBeforeToolCallResult<
  TParams extends ScopeBridgeToolParams = ScopeBridgeToolParams,
> = {
  params?: TParams;
  block?: boolean;
  blockReason?: string;
};

export type ScopeBridgeBeforeToolCallHandler = (
  event: ScopeBridgeBeforeToolCallEvent,
  context: ScopeBridgeToolContext,
) =>
  | ScopeBridgeBeforeToolCallResult
  | undefined
  | Promise<ScopeBridgeBeforeToolCallResult | undefined>;

export type ScopeBridgePluginApi = {
  on(
    hookName: "before_tool_call",
    handler: ScopeBridgeBeforeToolCallHandler,
    options?: {
      priority?: number;
      timeoutMs?: number;
    },
  ): void;
};

export type ScopeBridgeOptions = {
  clawToolPrefix?: string;
  priority?: number;
};

export type ScopeBridgeAppliedToolCall<
  TParams extends ScopeBridgeToolParams = ScopeBridgeToolParams,
> =
  | {
      ok: true;
      toolName: string;
      params: TParams & { ssid: string };
      bridged: true;
    }
  | {
      ok: true;
      toolName: string;
      params: TParams;
      bridged: false;
    }
  | {
      ok: false;
      toolName: string;
      params: TParams;
      blockReason: string;
    };

export const clawScopeBridgePlugin = {
  id: SCOPE_BRIDGE_PLUGIN_ID,
  name: SCOPE_BRIDGE_PLUGIN_NAME,
  register: registerClawScopeBridgePlugin,
};

export function registerClawScopeBridgePlugin(
  api: ScopeBridgePluginApi,
  options: ScopeBridgeOptions = {},
): void {
  const handler: ScopeBridgeBeforeToolCallHandler = (event, context) => {
    return scopeBridgeBeforeToolCall(event, context, options);
  };

  api.on("before_tool_call", handler, {
    priority: options.priority ?? SCOPE_BRIDGE_PRIORITY,
  });
}

export function scopeBridgeBeforeToolCall<
  TParams extends ScopeBridgeToolParams = ScopeBridgeToolParams,
>(
  event: ScopeBridgeBeforeToolCallEvent<TParams>,
  context: ScopeBridgeToolContext,
  options: ScopeBridgeOptions = {},
): ScopeBridgeBeforeToolCallResult<TParams & { ssid: string }> | undefined {
  if (!isClawMcpTool(event.toolName, options)) {
    return undefined;
  }

  if (!hasSessionKey(context)) {
    return {
      block: true,
      blockReason: MISSING_SESSION_BLOCK_REASON,
    };
  }

  return {
    params: {
      ...toolParams(event.params),
      ssid: context.sessionKey,
    } as TParams & { ssid: string },
  };
}

export function applyScopeBridgeToToolCall<
  TParams extends ScopeBridgeToolParams = ScopeBridgeToolParams,
>(
  event: ScopeBridgeBeforeToolCallEvent<TParams>,
  context: ScopeBridgeToolContext,
  options: ScopeBridgeOptions = {},
): ScopeBridgeAppliedToolCall<TParams> {
  const baseParams = toolParams(event.params);
  const decision = scopeBridgeBeforeToolCall(event, context, options);

  if (decision?.block) {
    return {
      ok: false,
      toolName: event.toolName,
      params: baseParams,
      blockReason: decision.blockReason ?? "Tool call blocked by CLAW Scope Bridge.",
    };
  }

  return {
    ok: true,
    toolName: event.toolName,
    ...(decision?.params
      ? { params: decision.params, bridged: true }
      : { params: baseParams, bridged: false }),
  };
}

export function isClawMcpTool(
  toolName: string,
  options: ScopeBridgeOptions = {},
): boolean {
  return toolName.startsWith(options.clawToolPrefix ?? CLAW_TOOL_PREFIX);
}

function hasSessionKey(
  context: ScopeBridgeToolContext,
): context is ScopeBridgeToolContext & { sessionKey: string } {
  return typeof context.sessionKey === "string" && context.sessionKey.length > 0;
}

function toolParams<TParams extends ScopeBridgeToolParams>(
  params: TParams | undefined,
): TParams {
  return params ?? ({} as TParams);
}

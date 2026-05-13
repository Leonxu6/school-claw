# OpenClaw Source Baseline

Status: pinned for CLAW v1 development

Verified on: 2026-05-13

## Source Checkout

- Upstream: https://github.com/openclaw/openclaw.git
- Local checkout: `/Users/leon/openclaw`
- Branch: `main`
- Pinned commit: `da23f4572da7d59ef97688ad8b61771e5b708733`
- Package manager: `pnpm@11.1.0`
- Node used for verification: `v22.22.0`
- Docs index verified: https://docs.openclaw.ai/llms.txt

Do not assume OpenClaw APIs from the CLAW architecture prose alone. Future
issues should read the source and docs paths below against this pinned commit
before implementing an integration point.

## Verification Commands

Run from this repo:

```sh
./scripts/verify-openclaw-baseline.sh
```

This is the closed-loop acceptance command for the baseline. It verifies that
the OpenClaw checkout exists, the expected upstream URL and commit are pinned,
the required source/docs paths are present, and this baseline report records the
critical contract markers.

The OpenClaw source verification used these additional commands from
`/Users/leon/openclaw`:

```sh
pnpm install --frozen-lockfile
node scripts/run-vitest.mjs run \
  --config test/vitest/vitest.unit-fast.config.ts \
  src/routing/session-key.test.ts \
  src/routing/resolve-route.test.ts \
  src/agents/pi-bundle-mcp-names.test.ts \
  src/agents/pi-bundle-mcp-tools.materialize.test.ts \
  src/agents/pi-bundle-mcp-tools.request-boundary.test.ts \
  src/agents/pi-tools.before-tool-call.e2e.test.ts \
  src/agents/mcp-transport-config.test.ts \
  src/agents/tool-catalog.test.ts \
  src/agents/pi-embedded-runner/effective-tool-policy.test.ts
pnpm tsgo:core
```

Observed results:

- `pnpm install --frozen-lockfile`: passed.
- Targeted `vitest.unit-fast` run: 7 test files passed, 153 tests passed.
- `pnpm tsgo:core`: passed.

The targeted test command intentionally focuses on the contracts CLAW depends
on: routing/session keys, bundle MCP tool naming/materialization, tool policy,
and `before_tool_call`.

## Contract Map

### Session Routing And `sessionKey`

Read first:

- Source: `src/routing/session-key.ts`
- Source: `src/routing/resolve-route.ts`
- Tests: `src/routing/session-key.test.ts`
- Tests: `src/routing/resolve-route.test.ts`
- Docs: `docs/concepts/session.md`
- Docs: `docs/gateway/config-agents.md`
- Docs: `docs/gateway/security/index.md`

Relevant pinned facts:

- `buildAgentPeerSessionKey` defines DM scopes:
  `main`, `per-peer`, `per-channel-peer`, and
  `per-account-channel-peer` in `src/routing/session-key.ts:166`.
- `per-channel-peer` generates
  `agent:<agentId>:<channel>:direct:<peerId>` in
  `src/routing/session-key.ts:198`.
- `resolveAgentRoute` defaults `dmScope` to `main` and passes the effective
  scope into `buildAgentSessionKey` in `src/routing/resolve-route.ts:623`.
- Route bindings can override DM scope per binding through the `choose(...)`
  path in `src/routing/resolve-route.ts:657`.
- If no binding matches, OpenClaw falls back to the configured default agent in
  `src/routing/resolve-route.ts:818`.
- OpenClaw security docs state that `sessionKey` is routing/context selection,
  not per-user authorization, in `docs/gateway/security/index.md:65` and
  `docs/gateway/security/index.md:108`.

CLAW implication:

- Use `session.dmScope: "per-channel-peer"` for the initial private-chat pilot.
- Treat the resulting OpenClaw `sessionKey` only as CLAW `ssid`, never as auth.
- Parent/teacher authorization must live in CLAW scope records and the CLAW MCP
  Server.

### Agent Runtime And Queueing

Read first:

- Source: `src/agents/pi-embedded-runner/run.ts`
- Source: `src/agents/pi-embedded-runner/lanes.ts`
- Docs: `docs/concepts/agent-loop.md`
- Docs: `docs/concepts/queue.md`
- Docs: `docs/concepts/agent-runtimes.md`
- Docs: `docs/gateway/config-agents.md`

Relevant pinned facts:

- `runEmbeddedPiAgent` is the embedded PI runner entry point in
  `src/agents/pi-embedded-runner/run.ts:366`.
- It backfills a non-null session key for downstream hooks and lifecycle code in
  `src/agents/pi-embedded-runner/run.ts:369`.
- It enqueues runs first by session lane, then by global lane in
  `src/agents/pi-embedded-runner/run.ts:380` and
  `src/agents/pi-embedded-runner/run.ts:419`.
- `resolveSessionLane` prefixes lanes as `session:<key>` in
  `src/agents/pi-embedded-runner/lanes.ts:3`.
- Docs state that one active run is allowed per session key, while overall
  concurrency is capped by `agents.defaults.maxConcurrent`, in
  `docs/concepts/queue.md:18`.

CLAW implication:

- A single `claw-agent` can serve many parent/teacher sessions.
- Per-session message handling is serialized by OpenClaw, but CLAW still needs
  its own file-level write locking for shared Markdown files.

### Runtime Selection Drift From Architecture Draft

Read first:

- Docs: `docs/concepts/agent-runtimes.md`
- Docs: `docs/gateway/config-agents.md`
- Source: `src/agents/model-runtime-policy.ts`
- Source: `src/agents/harness-runtimes.ts`

Pinned discrepancy:

- The CLAW architecture draft uses `agents.defaults.agentRuntime: { id: "pi" }`
  in its sample config.
- Current OpenClaw docs say whole-agent runtime keys are legacy and ignored:
  `agents.defaults.agentRuntime`, `agents.list[].agentRuntime`, session runtime
  pins, and `OPENCLAW_AGENT_RUNTIME` should not be used for runtime selection.
  See `docs/gateway/config-agents.md:401`,
  `docs/gateway/config-agents.md:431`, and
  `docs/concepts/agent-runtimes.md:151`.
- Current runtime policy belongs on provider/model config:
  `models.providers.<provider>.agentRuntime`,
  `agents.defaults.models["provider/model"].agentRuntime`, or
  `agents.list[].models["provider/model"].agentRuntime`.
- `auto` can fall through to PI when no plugin harness claims the turn. Explicit
  provider/model runtime ids fail closed if unavailable.

CLAW implication:

- Do not copy the architecture draft's `agents.defaults.agentRuntime` into live
  config.
- For MiniMax PI routing, prefer either no explicit runtime policy if `auto` is
  acceptable, or a provider/model-scoped `agentRuntime: { id: "pi" }` if CLAW
  needs strict PI behavior.
- Later config work must update the sample config accordingly.

### Model And MiniMax

Read first:

- Docs: `docs/gateway/config-agents.md`
- Docs: `docs/providers/minimax.md`
- Docs: `docs/gateway/config-tools.md`

Relevant pinned facts:

- `model` accepts either `"provider/model"` or `{ primary, fallbacks }` in
  `docs/gateway/config-agents.md:355`.
- `model.primary` should use explicit `provider/model` form in
  `docs/gateway/config-agents.md:387`.
- OpenClaw's MiniMax provider defaults to MiniMax M2.7 in
  `docs/providers/minimax.md:9`.

CLAW implication:

- `minimax/MiniMax-M2.7` remains a valid primary model candidate for CLAW.
- Keep fallback model refs explicit as `provider/model`.

### Bundle MCP Servers And Tool Names

Read first:

- Source: `src/agents/pi-bundle-mcp-runtime.ts`
- Source: `src/agents/pi-bundle-mcp-materialize.ts`
- Source: `src/agents/pi-bundle-mcp-names.ts`
- Source: `src/agents/mcp-transport-config.ts`
- Tests: `src/agents/pi-bundle-mcp-tools.materialize.test.ts`
- Tests: `src/agents/pi-bundle-mcp-tools.request-boundary.test.ts`
- Tests: `src/agents/mcp-transport-config.test.ts`
- Docs: `docs/gateway/configuration-reference.md`
- Docs: `docs/gateway/cli-backends.md`

Relevant pinned facts:

- OpenClaw-managed MCP definitions live under `mcp.servers` and are consumed by
  embedded PI and other runtime adapters in
  `docs/gateway/configuration-reference.md:90`.
- `createSessionMcpRuntime` receives `sessionId`, optional `sessionKey`,
  `workspaceDir`, and config in `src/agents/pi-bundle-mcp-runtime.ts:181`.
- The runtime iterates configured MCP servers in
  `src/agents/pi-bundle-mcp-runtime.ts:228`.
- MCP tool calls pass only the tool `input` as MCP `arguments` in
  `src/agents/pi-bundle-mcp-runtime.ts:351`.
- Bundle MCP tool names use `__` as the server/tool separator in
  `src/agents/pi-bundle-mcp-names.ts:7`.
- Materialized tool names are built from provider-safe server and tool names in
  `src/agents/pi-bundle-mcp-materialize.ts:98`.

CLAW implication:

- A server named `claw` exposing `files_read` materializes as
  `claw__files_read`.
- The CLAW MCP Server cannot rely on OpenClaw automatically passing `sessionKey`
  into every tool argument. Scope injection remains a separate plugin concern.

### `before_tool_call` Hooks

Read first:

- Source: `src/agents/pi-tools.before-tool-call.ts`
- Tests: `src/agents/pi-tools.before-tool-call.e2e.test.ts`
- Tests: `src/plugins/hooks.before-tool-call.test.ts`
- Docs: `docs/concepts/agent-loop.md`
- Docs: `docs/plugins/hooks.md`

Relevant pinned facts:

- `before_tool_call` can intercept tool params/results per
  `docs/concepts/agent-loop.md:99`.
- Plugin hook docs say `before_tool_call` can rewrite params, block execution,
  or require approval in `docs/plugins/hooks.md:121`.
- Hook events receive `event.toolName`, `event.params`, optional `runId` and
  `toolCallId`, plus context fields including `ctx.agentId`, `ctx.sessionKey`,
  `ctx.sessionId`, and `ctx.runId` in `docs/plugins/hooks.md:153`.
- `runBeforeToolCallHook` builds a `toolContext` containing `sessionKey` in
  `src/agents/pi-tools.before-tool-call.ts:525`.
- Hook-returned `params` are merged into the actual execution params in
  `src/agents/pi-tools.before-tool-call.ts:641`.
- The wrapped tool executes with adjusted params in
  `src/agents/pi-tools.before-tool-call.ts:746`.

CLAW implication:

- The Scope Bridge Plugin should register a `before_tool_call` hook.
- For tools whose name starts with `claw__`, it should fail closed if
  `ctx.sessionKey` is missing and otherwise overwrite `params.ssid` with
  `ctx.sessionKey`.
- The CLAW MCP Server should trust only the injected `ssid` path and still
  enforce permissions server-side.

### Tool Policy And Native Tool Deny

Read first:

- Source: `src/agents/tool-catalog.ts`
- Source: `src/agents/pi-embedded-runner/effective-tool-policy.ts`
- Docs: `docs/gateway/config-tools.md`
- Tests: `src/agents/tool-catalog.test.ts`
- Tests: `src/agents/pi-embedded-runner/effective-tool-policy.test.ts`

Relevant pinned facts:

- The `messaging` profile includes messaging/session tools and bundle MCP in
  `src/agents/tool-catalog.ts:330`.
- `coding` also includes bundle MCP in `src/agents/tool-catalog.ts:327`.
- Tool policy applies profile, provider, agent, group, sender, sandbox, and
  subagent policy layers in
  `src/agents/pi-embedded-runner/effective-tool-policy.ts:154`.
- Docs state `deny` wins and supports groups/wildcards in
  `docs/gateway/config-tools.md:47`.
- To block file mutation robustly, docs recommend denying `group:fs` or listing
  every mutating tool explicitly in `docs/gateway/config-tools.md:57`.

CLAW implication:

- Start `claw-agent` with `tools.profile: "messaging"` plus bundle MCP access.
- Deny `group:fs`, `group:runtime`, `group:ui`, `gateway`, `cron`, and other
  nonessential native tools unless a later issue deliberately opens them.
- Education data must stay outside OpenClaw native file tools and only flow
  through the CLAW MCP Server.

## Next-Issue Read Order

For issue `0002-school-claw-dev-skeleton.md`, read:

1. This file.
2. `AGENTS.md`.
3. `CONTEXT.md`.
4. `docs/architecture/CLAW_v1_technical_architecture.md` sections 5, 8, 9,
   15, and 19.
5. OpenClaw files listed under "Source Checkout" and "Contract Map" that match
   the capability being scaffolded.

## Baseline Decisions

- Use `/Users/leon/openclaw` as the local OpenClaw source checkout for future
  work.
- Pin CLAW integration assumptions to commit
  `da23f4572da7d59ef97688ad8b61771e5b708733` until an explicit update issue
  changes it.
- Use pnpm/TypeScript conventions for the school-claw scaffold unless issue
  `0002` discovers a stronger reason to diverge.
- Treat OpenClaw config examples in the architecture draft as intent, not
  copy-pasteable config, because runtime selection changed.

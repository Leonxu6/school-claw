# Implement the OpenClaw Scope Bridge Plugin

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/development/openclaw-baseline.md`, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 4.7, 7.3, 9, 15.1, 16.1, and 19.
- Project summary: Ordinary MCP tools do not automatically know the current OpenClaw session. The Scope Bridge Plugin injects the real `sessionKey`/`ssid` into CLAW MCP tool calls before execution.
- Capability: enforce true session injection at the OpenClaw boundary.
- Non-negotiables: overwrite forged `ssid`, affect only CLAW MCP tools, fail closed on missing session, and verify against current OpenClaw plugin APIs.
- Expected handoff result: an OpenClaw plugin that makes model-provided `ssid` spoofing ineffective.

## What to build

Implement the thin Scope Bridge Plugin against the pinned OpenClaw plugin contract. It should hook before tool calls, identify CLAW MCP tool names, and inject `params.ssid = ctx.sessionKey` or the current API equivalent.

## Acceptance criteria

- [ ] Failing tests exist first for forged `ssid`, missing session, and non-CLAW tool calls.
- [ ] `claw__*` tool calls receive the real OpenClaw session key as `ssid`.
- [ ] Model-supplied `ssid` is overwritten.
- [ ] Missing session context blocks the tool call.
- [ ] Non-CLAW tools are left unchanged.
- [ ] The implementation references the pinned OpenClaw source/API and documents any adapter shim.
- [ ] Relevant plugin tests or contract checks pass.

## Blocked by

- DRAFT-0001 OpenClaw source baseline.
- DRAFT-0003 OpenClaw sessionKey to CLAW ssid contract.
- DRAFT-0007 CLAW MCP primitive tools.

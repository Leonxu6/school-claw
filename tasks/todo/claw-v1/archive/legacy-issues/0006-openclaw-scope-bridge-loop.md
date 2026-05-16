# OpenClaw Scope Bridge loop

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `CONTEXT.md`, `docs/development/openclaw-baseline.md`, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 4.7, 7.3, 9, 15.1, 16.1, and 19.
- Project summary: The model must not decide its own `ssid`. The Scope Bridge Plugin injects the true OpenClaw session key into CLAW MCP tool calls before execution.
- Capability: OpenClaw session injection into CLAW MCP calls.
- Non-negotiables: overwrite forged `ssid`, fail closed on missing session, affect only CLAW MCP tools, verify against pinned OpenClaw API.
- Expected handoff result: forged model input cannot read another student's data because the bridge injects the real session.

## Closed-loop acceptance target

Reviewer can run:

```text
npm test -- scope-bridge
npm run demo:scope-bridge
```

and observe:

```text
tool call args contain ssid=parentB
OpenClaw context sessionKey=parentA
Scope Bridge rewrites ssid=parentA
read studentB -> FORBIDDEN
read studentA -> OK
```

## What to build

Implement the Scope Bridge Plugin or an adapter around the pinned OpenClaw plugin hook. Add a deterministic simulation if full Gateway runtime is not yet needed.

## Acceptance criteria

- [ ] Tests are written first for forged `ssid`, missing session, CLAW tool call, and non-CLAW tool call.
- [ ] `claw__*` tool calls receive the real session key as `ssid`.
- [ ] Model-provided `ssid` is overwritten.
- [ ] Missing session context blocks the tool call.
- [ ] Non-CLAW tools are left unchanged.
- [ ] Demo proves bridge + MCP permission behavior together.

## Blocked by

- DRAFT-0001 OpenClaw baseline contract loop.
- DRAFT-0005 Artifact primitive loop.

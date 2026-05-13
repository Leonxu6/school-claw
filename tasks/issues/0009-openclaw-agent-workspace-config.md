# Create the one-agent OpenClaw workspace and tool policy

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/development/openclaw-baseline.md`, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 5.3, 5.4, 10, 11, 16.7, and 19.
- Project summary: CLAW v1 uses one `claw-agent`. Parents and teachers are sessions with different scopes, not separate agents. The agent workspace must not contain student data.
- Capability: create OpenClaw config/workspace assets that run one agent with only the intended MCP/tool surface.
- Non-negotiables: do not create parent-agent/teacher-agent, do not put `claw-data` in the agent workspace, deny native file/exec/gateway/cron tools unless explicitly needed, and allow only `bundle-mcp` plus required messaging.
- Expected handoff result: OpenClaw can load a `claw-agent` workspace/config that routes all users to one agent and exposes CLAW MCP safely.

## What to build

Create the OpenClaw workspace/config assets for `claw-agent`: workspace files, model/runtime selection, MCP server config, Scope Bridge plugin config, `dmScope`, and tool allow/deny policy.

## Acceptance criteria

- [ ] Config defines one `claw-agent`.
- [ ] Config uses OpenClaw Pi Runtime and the CLAW MCP Server.
- [ ] Config includes the Scope Bridge Plugin.
- [ ] Session config uses the verified secure DM mode.
- [ ] Tool policy denies native file/exec/gateway/cron/session-spawn style tools unless explicitly justified.
- [ ] `claw-data` lives outside the OpenClaw agent workspace.
- [ ] A validation command or config test proves the config shape is loadable.
- [ ] Relevant checks pass.

## Blocked by

- DRAFT-0001 OpenClaw source baseline.
- DRAFT-0007 CLAW MCP primitive tools.
- DRAFT-0008 Scope Bridge Plugin.

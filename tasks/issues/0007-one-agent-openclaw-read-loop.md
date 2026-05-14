# One-agent OpenClaw read loop

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/development/openclaw-baseline.md`, `docs/product/CLAW_v1_product_prd.md` sections 8.2-8.5 and 13, plus `docs/architecture/CLAW_v1_technical_architecture.md` sections 5.3-5.4, 10, 11, 12.1, 16.7, and 19.
- Project summary: CLAW v1 has one `claw-agent`. Parents and teachers are scoped sessions, not different agents. This issue proves OpenClaw can run one agent that reads through CLAW MCP.
- Capability: one-agent OpenClaw runtime read path.
- Non-negotiables: no parent-agent/teacher-agent split, no direct native file access to `claw-data`, no hard-coded scenario reply.
- Expected handoff result: a local OpenClaw or QA-channel message reaches one `claw-agent`, uses CLAW MCP, and returns an evidence-based scoped answer.

## Closed-loop acceptance target

Reviewer can run a documented local command such as:

```text
npm run demo:openclaw-read
```

and observe:

```text
message enters one claw-agent
agent/tool path calls claw__scope_get and claw__files_read/read_all
reply references visible child evidence
same prompt under another parent scope references different evidence
```

## What to build

Create the OpenClaw `claw-agent` workspace/config/tool policy and the minimal prompt contract needed for read-only evidence answers. Connect the agent to CLAW MCP through the Scope Bridge.

## Acceptance criteria

- [ ] Config defines one `claw-agent`.
- [ ] Config uses the pinned OpenClaw runtime path and CLAW MCP server.
- [ ] Tool policy denies native file/exec/gateway/cron/session-spawn style tools unless explicitly justified.
- [ ] `claw-data` is outside the agent workspace.
- [ ] Prompt requires scope before factual archive reads.
- [ ] Demo proves one-agent scoped read behavior for at least two sessions.
- [ ] Logs or transcript show MCP tools were used rather than native file tools.

## Blocked by

- DRAFT-0005 Artifact primitive loop.
- DRAFT-0006 OpenClaw Scope Bridge loop.

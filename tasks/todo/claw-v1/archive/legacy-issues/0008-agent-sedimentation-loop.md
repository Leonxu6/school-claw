# Agent learning-record sedimentation loop

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 6.3-6.4, 8.4, 9.2, and 10.1-10.2, plus `docs/architecture/CLAW_v1_technical_architecture.md` sections 11, 12.2, 14.1, 14.2, and 16.4.
- Project summary: The agent should generally decide whether new natural-language input is durable learning evidence. This is not a parent-specific scenario hack; it is the sedimentation capability.
- Capability: natural-language learning fact -> scoped append -> later evidence answer.
- Non-negotiables: do not write ordinary chat, do not write guesses as facts, do not bypass audit, and do not hard-code one phrase.
- Expected handoff result: one `claw-agent` can record a learning fact through MCP, then later cite that newly written evidence.

## Closed-loop acceptance target

Reviewer can run:

```text
npm run demo:sedimentation
```

and observe:

```text
input: learning fact
agent decides it is durable
files_append writes scoped observation
audit entry appears
follow-up question reads and cites the new record
input: greeting/idle chat
no archive write occurs
```

## What to build

Extend the agent prompt/workspace and local harness so natural-language learning evidence is appended through CLAW MCP and later read back through the same scoped path.

## Acceptance criteria

- [ ] Tests or scripted demo cover durable learning fact and non-durable chat.
- [ ] Durable fact is written via `files_append`, not native file tools.
- [ ] Written front matter records source role/session hash, class/student, timestamp, and useful extracted fields where known.
- [ ] Audit record is created.
- [ ] Later answer cites or summarizes the new record.
- [ ] Parent cross-student write remains forbidden.

## Blocked by

- DRAFT-0007 One-agent OpenClaw read loop.

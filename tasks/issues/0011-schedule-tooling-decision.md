# Decide schedule primitive architecture

Type: HITL

Suggested label: `ready-for-human`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 7.2.4 and 16, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 9.9, 12.5, 15.5, 16.7, 17 Phase 7, and 19.
- Project summary: Schedule support is optional for the MVP and affects future actions, permissions, retries, and auditability. The architecture must choose between direct OpenClaw cron exposure and CLAW-owned schedule primitives.
- Non-negotiables: do not expose broad native tools to the agent without a decision, preserve role guards, and record the decision durably.
- Expected handoff result: an ADR or equivalent decision note defining whether and how schedules enter v1.

## What to build

Decide whether v1 schedule support should expose OpenClaw cron directly, wrap it behind CLAW schedule primitives, or defer scheduling until after the pilot. This needs a human architecture decision because schedules affect permissions, persistence, retries, and who can create future actions.

## Acceptance criteria

- [ ] Decide whether schedules are in MVP, pilot enhancement, or post-pilot scope.
- [ ] Decide whether the interface is `claw__schedule_create/list/cancel` or another primitive shape.
- [ ] Define teacher and parent role boundaries.
- [ ] Define where schedule state and audit records live.
- [ ] Define how failed scheduled jobs are surfaced.
- [ ] Record the decision as an ADR or equivalent durable note.

## Blocked by

- DRAFT-0007 teacher class weak-point artifact.

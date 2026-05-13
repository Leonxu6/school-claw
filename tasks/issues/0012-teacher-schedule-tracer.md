# Run a teacher schedule tracer with role guards

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, the decision from DRAFT-0011, `docs/product/CLAW_v1_product_prd.md` sections 7.2.4 and 16, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 9.9, 12.5, 15.1-15.2, 15.5, and 17 Phase 7.
- Project summary: A schedule tracer should prove that teacher recurring work can be created, listed, cancelled, persisted, and audited while parent sessions are refused.
- Non-negotiables: implement only the approved schedule shape, guard every action by `SessionScope`, do not give parents privileged schedules, and write failing tests first.
- Expected handoff result: the smallest runnable teacher schedule flow with role guards and audit evidence.

## What to build

Implement the smallest approved schedule tracer. A teacher should be able to create, list, and cancel a recurring class task such as a weekly summary. A parent should be refused when attempting the same privileged schedule behavior.

## Acceptance criteria

- [ ] A failing test exists first for teacher schedule create/list/cancel.
- [ ] A failing permission test exists first for parent schedule creation.
- [ ] Schedule state is persisted according to the approved decision.
- [ ] Schedule actions are guarded by `SessionScope`.
- [ ] Schedule actions create audit records.
- [ ] The scheduled task can reference the same artifact-generation path used by teacher summaries.
- [ ] Failure behavior is visible in logs or audit according to the approved decision.
- [ ] Relevant unit and integration tests pass.

## Blocked by

- DRAFT-0003 scope bridge and permission fail-closed.
- DRAFT-0011 schedule primitive architecture.

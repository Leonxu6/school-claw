# Generate a teacher class weak-point artifact

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 7.2.2-7.2.3, 9.4, 10.3-10.5, 12.1-12.2, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 9.4, 9.7, 12.5, 14.3, 15.1-15.2, and 16.5.
- Project summary: Teacher scope can read the whole class and generate reusable teaching artifacts. Parents must not access this class-level view.
- Non-negotiables: aggregate from evidence, do not leak class details to parent scope, save the artifact, create audit logs, and begin with failing tests.
- Expected handoff result: a teacher request produces a saved class weak-point artifact such as an error table or weekly summary.

## What to build

Allow a teacher to ask for the class's recent weak points. The agent should read class-visible student records, aggregate recurring knowledge points and mistake causes, save a teacher-facing artifact, and reply with a concise teaching summary.

## Acceptance criteria

- [ ] A failing test exists first for a teacher asking for this week's class weak points.
- [ ] Teacher scope can read class-level and student-level records needed for aggregation.
- [ ] Parent scope is refused for the same class-level request.
- [ ] The summary groups findings by knowledge point and representative mistake cause.
- [ ] The artifact is saved as `weekly_summary` or `error_table`.
- [ ] The artifact avoids unnecessary parent-identifying details when not needed.
- [ ] An audit record is created for the artifact.
- [ ] Relevant unit and integration tests pass.

## Blocked by

- DRAFT-0006 teacher student observation tracer.

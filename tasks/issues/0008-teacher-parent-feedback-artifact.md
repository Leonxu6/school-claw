# Generate a teacher parent-feedback artifact for one student

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 7.2.3-7.2.4, 9.5, 10.5-10.6, 12, 13.1, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 9.7, 12.5, 14.2-14.3, and 15.1-15.2.
- Project summary: Teachers can generate parent-facing feedback drafts, but generation is not the same as sending. The draft must be useful for home-school communication and safe for privacy.
- Non-negotiables: target exactly one student, do not include other students' identifiable information, save as an artifact, audit the generation, and start with a failing test.
- Expected handoff result: a teacher gets a reusable parent feedback artifact for one student without any automatic sending behavior.

## What to build

Allow a teacher to ask for a parent-facing feedback draft for one student. The agent should read that student's recent archive, generate a clear and parent-appropriate message, save it as an artifact, and avoid leaking other students' information.

## Acceptance criteria

- [ ] A failing test exists first for a teacher asking for one student's parent feedback.
- [ ] The agent reads only the target student's relevant evidence plus class public context if needed.
- [ ] The feedback includes a clear learning judgment, concrete next action, and appropriate home-school communication tone.
- [ ] The feedback does not include other students' identifiable information.
- [ ] The artifact is saved with type `feedback`.
- [ ] An audit record is created for the artifact.
- [ ] The output is reusable by a teacher without being automatically sent.
- [ ] Relevant unit and integration tests pass.

## Blocked by

- DRAFT-0006 teacher student observation tracer.

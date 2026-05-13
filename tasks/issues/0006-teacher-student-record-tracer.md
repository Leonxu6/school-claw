# Record a teacher observation for one student

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 7.2.1, 9.1, 10.1-10.2, 13.1, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 7.2, 8, 9.5, 12.4, 14.3, and 15.1-15.2.
- Project summary: Teachers can access the class scope and record observations for individual students. The system must resolve student identity carefully because writing to the wrong archive is a serious correctness bug.
- Non-negotiables: teacher writes must be scoped and audited, ambiguous names must ask for clarification, parent sessions must not get teacher write power, and tests come first.
- Expected handoff result: a teacher can record one named student's issue into the correct archive with audit evidence.

## What to build

Allow a teacher to record a specific student's learning issue in natural language. The system should resolve the student, extract useful learning details, append the observation to the student's archive under teacher scope, and produce an audit record.

## Acceptance criteria

- [ ] A failing test exists first for a teacher recording a named student's mistake, cause, and knowledge point.
- [ ] Teacher scope can access the class and the target student archive.
- [ ] The system resolves an unambiguous student name to the correct student ID.
- [ ] Ambiguous or unknown student names trigger clarification rather than writing to the wrong archive.
- [ ] The observation is appended as teacher-sourced learning evidence.
- [ ] An audit record is created for the write.
- [ ] Parent scope cannot perform the same class-level teacher write.
- [ ] Relevant unit and integration tests pass.

## Blocked by

- DRAFT-0002 parent scoped-read tracer.
- DRAFT-0003 scope bridge and permission fail-closed.

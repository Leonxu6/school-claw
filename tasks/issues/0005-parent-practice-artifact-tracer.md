# Generate a parent personalized-practice artifact

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 8.2-8.3, 9.3, 10.3-10.5, 13.2, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 9.4, 9.7, 12.3, 14.2, 14.4, 15.1-15.2, and 16.5.
- Project summary: Parent-facing answers must be clear, evidence-based, and useful tonight. Practice generation is lightweight and personalized; it is not a full题库 system.
- Non-negotiables: use only that child's visible records, do not invent history, save generated output as an artifact, create audit logs, and start with a failing test.
- Expected handoff result: a parent can request practice and receive a saved artifact grounded in the child's archive.

## What to build

Allow a parent to ask for practice or improvement advice for their own child. The agent should read the relevant child archive, generate a small targeted practice artifact, save it through CLAW MCP, create audit evidence, and reply with the practice content and why it fits the child.

## Acceptance criteria

- [ ] A failing test exists first for a parent asking for personalized practice.
- [ ] The agent reads bounded relevant context from profile, knowledge, recent timeline, errors, and observations.
- [ ] The generated practice is based on recorded evidence and does not claim unsupported history.
- [ ] The artifact is saved with type `practice`.
- [ ] The artifact records source file references where available.
- [ ] An audit record is created for the artifact.
- [ ] Parent scope cannot create or read artifacts for another student.
- [ ] Relevant unit and integration tests pass.

## Blocked by

- DRAFT-0004 parent learning observation append.

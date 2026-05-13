# Generate batch parent-specific brief drafts

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, the decision from DRAFT-0009, `docs/product/CLAW_v1_product_prd.md` sections 9.6, 10.6, 12, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 9.7, 12.5, 15.2, and 15.4.
- Project summary: Batch briefs must generate one child-specific draft per student and a teacher review surface. The key risk is cross-student content mixing or premature sending.
- Non-negotiables: no automatic sending unless explicitly approved by DRAFT-0009, isolate each student's evidence and output, save artifacts separately, audit the batch, and write failing safety tests first.
- Expected handoff result: a teacher can generate reviewable, separate parent brief drafts for multiple students.

## What to build

Allow a teacher to generate one parent-specific brief draft per student for a selected period. The system should create isolated child-specific drafts, produce a review manifest for the teacher, and avoid sending anything unless the policy issue explicitly enables it.

## Acceptance criteria

- [ ] A failing test exists first for generating briefs for at least two students.
- [ ] Each brief contains only that student's information.
- [ ] The generated drafts are saved as separate artifacts.
- [ ] A teacher-facing review manifest links each student to the corresponding draft artifact.
- [ ] No parent-visible send happens unless the approved policy requires it.
- [ ] The system prevents accidental cross-student content mixing.
- [ ] An audit record is created for the batch generation.
- [ ] Relevant unit and integration tests pass.

## Blocked by

- DRAFT-0008 teacher parent-feedback artifact.
- DRAFT-0009 batch parent-brief sending policy.

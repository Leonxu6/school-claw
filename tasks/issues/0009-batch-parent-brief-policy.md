# Decide the batch parent-brief sending policy

Type: HITL

Suggested label: `ready-for-human`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 7.2.4, 9.6, 10.6, 12, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 12.5, 15.4-15.5, 16.2, and 19.
- Project summary: Batch parent briefs are privacy-sensitive because one teacher action can create many parent-specific messages. The project must decide whether v1 only drafts, requires review, or actually sends.
- Non-negotiables: do not implement sending before the policy is decided, prefer safety over convenience, and record the decision durably.
- Expected handoff result: an ADR or equivalent decision note that future implementation can follow without guessing.

## What to build

Decide how v1 should handle a teacher request like "把这周每个孩子的数学情况私发给各自家长." This needs a human product and safety decision before implementation because wrong-recipient or auto-send behavior can create privacy harm.

## Acceptance criteria

- [ ] Decide whether v1 supports draft-only, review-then-send, or direct send.
- [ ] Decide whether the first implementation needs real platform sending or only generated drafts.
- [ ] Define confirmation requirements before any parent-visible message is sent.
- [ ] Define wrong-recipient prevention requirements.
- [ ] Define minimum audit requirements.
- [ ] Record the decision as an ADR or equivalent durable note.

## Blocked by

- DRAFT-0008 teacher parent-feedback artifact.

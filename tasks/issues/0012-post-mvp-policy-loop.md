# Post-MVP batch-send and schedule policy loop

Type: HITL

Suggested label: `ready-for-human`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 7.2.4, 9.6, 10.6, 12, and 16, plus `docs/architecture/CLAW_v1_technical_architecture.md` sections 9.9, 15.5, 16.7, 17 Phase 7, and 19.
- Project summary: Batch parent sending and schedules are useful but risky. They should be decided after the MVP safety loop, then turned into new implementation tickets.
- Capability: policy closure for post-MVP high-risk actions.
- Non-negotiables: do not implement automatic parent sending or recurring jobs before this decision, prefer review-before-send, preserve role guards, and record decisions durably.
- Expected handoff result: ADRs or decision docs plus follow-up issues or explicit defer decisions.

## Closed-loop acceptance target

Reviewer can inspect decision records and see:

```text
batch-send policy decided
schedule policy decided
safety requirements listed
follow-up implementation tickets created or deferred
```

## What to build

Decide the post-MVP policy for batch parent-specific briefs and schedule primitives. Record the decisions as ADRs or durable docs.

## Acceptance criteria

- [ ] Decision records whether batch parent briefs are draft-only, review-then-send, or direct-send.
- [ ] Decision defines wrong-recipient prevention requirements.
- [ ] Decision defines whether schedules are MVP, pilot enhancement, or post-pilot.
- [ ] Decision defines schedule persistence, audit, retry/failure surfacing, and role boundaries.
- [ ] Follow-up implementation issues are created or explicitly deferred.

## Blocked by

- DRAFT-0011 Pilot operations and safety loop.

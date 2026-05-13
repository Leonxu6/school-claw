# Decide post-MVP batch-send and schedule policy

Type: HITL

Suggested label: `ready-for-human`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 7.2.4, 9.6, 10.6, 12, and 16, plus `docs/architecture/CLAW_v1_technical_architecture.md` sections 9.9, 15.5, 16.7, 17 Phase 7, and 19.
- Project summary: Batch parent messages and schedules are real product needs, but they create higher privacy and persistence risk than the MVP capability stack.
- Capability: decide what enters post-MVP and under which safety model.
- Non-negotiables: do not implement automatic parent sending or recurring jobs before this decision, prefer review-before-send, preserve role guards, and record decisions durably.
- Expected handoff result: ADRs or decision docs that future implementation issues can follow without guessing.

## What to build

Decide the post-MVP policy for:

- Batch parent-specific briefs: draft-only, review-then-send, or direct send.
- Schedule primitives: defer, expose CLAW-owned `schedule_create/list/cancel`, or use OpenClaw cron behind role guards.

## Acceptance criteria

- [ ] Decision records where batch parent briefs sit in product scope.
- [ ] Decision defines whether any parent-visible message may be sent automatically.
- [ ] Decision defines wrong-recipient prevention requirements.
- [ ] Decision defines schedule scope: MVP, pilot enhancement, or post-pilot.
- [ ] Decision defines schedule persistence, audit, retry/failure surfacing, and role boundaries.
- [ ] Follow-up implementation issues are created or explicitly deferred.

## Blocked by

- DRAFT-0013 pilot operations and security baseline.

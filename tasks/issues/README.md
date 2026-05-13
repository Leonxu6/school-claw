# Draft Issues

These are local issue drafts generated from `to-issues`, rewritten as capability-first tracer bullets.

They can be published to GitHub in dependency order when the team is ready to turn drafts into tracker issues. Replace `DRAFT-*` dependency references with real issue numbers after publishing.

## Dispatching To A Fresh Window

Each numbered issue file is intended to be self-contained. When opening a fresh agent window, give it exactly one issue file and tell it:

```text
Work in /Users/leon/school-claw. Read this issue file first and follow its Fresh-agent brief. Do not rely on prior chat context. Follow AGENTS.md, start with tests for AFK issues, and stop if blocked by a referenced draft issue that is not complete.
```

The fresh agent should still read the files listed in the issue's `Fresh-agent brief`, especially `AGENTS.md`, `CONTEXT.md`, the OpenClaw baseline, and referenced PRD/architecture sections.

## Planning Rule

These issues build reusable CLAW capabilities, not hard-coded PRD scenarios. Product scenarios are acceptance examples for the capabilities.

Each issue must also close a loop. A completed issue must leave behind at least one of:

- A passing test command.
- A demo command.
- A smoke-test transcript.
- A platform evidence log.
- A durable decision record.

If the issue cannot be accepted by running or inspecting its closed-loop evidence, the issue is too horizontal and must be split or reshaped.

## Dependency Order

Publish or dispatch in this order unless you intentionally run HITL work in parallel:

1. `0001-openclaw-baseline-contract-loop.md`
2. `0002-local-claw-scope-harness-loop.md`
3. `0003-scoped-markdown-read-loop.md`
4. `0004-safe-write-audit-loop.md`
5. `0005-artifact-primitive-loop.md`
6. `0006-openclaw-scope-bridge-loop.md`
7. `0007-one-agent-openclaw-read-loop.md`
8. `0008-agent-sedimentation-loop.md`
9. `0009-teacher-class-artifact-loop.md`
10. `0010-native-platform-binding-loop.md`
11. `0011-pilot-ops-safety-loop.md`
12. `0012-post-mvp-policy-loop.md`

## MVP Boundary

Issues `0001` through `0011` are the pilot-ready MVP track. Issues `0001` and `0002` have already landed on `main`; later issues should treat them as completed dependencies.

Issue `0012` is post-MVP policy work for batch parent sending and schedules. It should not block the first pilot unless the user explicitly changes scope.

## Label Guidance

- AFK issues: `ready-for-agent`
- HITL issues: `ready-for-human`

# Draft Issues

These are local issue drafts generated from `to-issues`.

They are not yet published to GitHub because the local machine does not currently have the `gh` CLI available. Publish them in dependency order once GitHub tooling is ready, then replace `DRAFT-*` dependency references with real issue numbers.

## Dispatching To A Fresh Window

Each numbered issue file is intended to be self-contained. When opening a fresh agent window, give it exactly one issue file and tell it:

```text
Work in /Users/leon/school-claw. Read this issue file first and follow its Fresh-agent brief. Do not rely on prior chat context. Follow AGENTS.md, start with tests for AFK issues, and stop if blocked by a referenced draft issue that is not complete.
```

The fresh agent should still read the files listed in the issue's `Fresh-agent brief`, especially `AGENTS.md`, `CONTEXT.md`, and the referenced PRD/architecture sections.

## Dependency Order

Publish or dispatch in this order unless you intentionally run independent HITL work in parallel:

1. `0001-platform-private-chat-session-spike.md` can run in parallel as HITL platform validation.
2. `0002-parent-scoped-read-tracer.md` starts the AFK code path.
3. `0003-scope-bridge-permission-fail-closed.md` locks down permission boundaries.
4. `0004` through `0008` complete the MVP parent and teacher loops.
5. `0009` through `0012` are post-MVP batch messaging and schedule work.

Label guidance:

- AFK issues: `ready-for-agent`
- HITL issues: `ready-for-human`

# Draft Issues

These are local issue drafts generated from `to-issues`, rewritten as capability-first tasks.

They are not yet published to GitHub because the local machine does not currently have the `gh` CLI available. Publish them in dependency order once GitHub tooling is ready, then replace `DRAFT-*` dependency references with real issue numbers.

## Dispatching To A Fresh Window

Each numbered issue file is intended to be self-contained. When opening a fresh agent window, give it exactly one issue file and tell it:

```text
Work in /Users/leon/school-claw. Read this issue file first and follow its Fresh-agent brief. Do not rely on prior chat context. Follow AGENTS.md, start with tests for AFK issues, and stop if blocked by a referenced draft issue that is not complete.
```

The fresh agent should still read the files listed in the issue's `Fresh-agent brief`, especially `AGENTS.md`, `CONTEXT.md`, the OpenClaw baseline, and the referenced PRD/architecture sections.

## Planning Rule

These issues build reusable CLAW capabilities, not hard-coded PRD scenarios. Product scenarios are acceptance tests for the capabilities.

If an implementation makes "parent asks today" or "teacher generates weak points" work only through special-case code, it is wrong. The correct implementation is a general capability such as scope resolution, MCP reads, artifact creation, prompt behavior, or permission refusal.

## Dependency Order

Publish or dispatch in this order unless you intentionally run HITL platform/policy work in parallel:

1. `0001-openclaw-source-baseline.md`
2. `0002-local-claw-scope-harness-loop.md`
3. `0003-openclaw-session-ssid-contract.md`
4. `0004-safe-write-audit-loop.md`
5. `0005-session-scope-permission-core.md`
6. `0006-safe-write-audit-core.md`
7. `0007-claw-mcp-primitives.md`
8. `0008-openclaw-scope-bridge-plugin.md`
9. `0009-openclaw-agent-workspace-config.md`
10. `0010-claw-agent-capability-prompt.md`
11. `0011-local-openclaw-capability-harness.md`
12. `0012-native-platform-binding-spike.md`
13. `0013-pilot-operations-security-baseline.md`
14. `0014-post-mvp-policy-decisions.md`

## MVP Boundary

Issues `0001` through `0013` are the pilot-ready MVP track.

Issue `0014` is post-MVP policy work for batch parent sending and schedules. It should not block the first pilot unless the user explicitly changes scope.

## Label Guidance

- AFK issues: `ready-for-agent`
- HITL issues: `ready-for-human`

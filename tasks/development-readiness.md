# Development Readiness

## Current State

- Repo initialized with engineering instructions and domain docs.
- PRD and technical architecture are archived under `docs/`.
- Development plan is capability-first and closed-loop.
- Local issue drafts are available under `tasks/issues/`.
- GitHub publishing is available through pushed branches and pull requests.
- CI exists in `.github/workflows/ci.yml` and runs on pull requests.

## First Work To Start

Start with `tasks/issues/0001-openclaw-baseline-contract-loop.md`.

That issue is acceptable only when it produces a verifiable closed loop:

```text
OpenClaw source available
  -> commit pinned
  -> required runtime/session/MCP/plugin contract files located
  -> contract verification command passes
```

## Development Shape

The implementation track is now tracer-bullet shaped:

1. OpenClaw baseline contract loop.
2. Local CLAW scope harness loop.
3. Scoped Markdown read loop.
4. Safe write and audit loop.
5. Artifact primitive loop.
6. OpenClaw Scope Bridge loop.
7. One-agent OpenClaw read loop.
8. Agent learning-record sedimentation loop.
9. Teacher class artifact loop.
10. Native platform binding loop.
11. Pilot operations and safety loop.
12. Post-MVP policy loop.

Each issue must leave behind a command, smoke test, demo transcript, or decision record that a reviewer can use to accept or reject the work.

## MVP Gate

The first pilot-ready gate is completion of draft issues 0001 through 0011.

Do not implement scenario-specific shortcuts. If a scenario only works because of hard-coded task logic rather than general capabilities, the issue is not done.

## Publishing Preparation

Before publishing issues to GitHub:

- Create missing labels: `ready-for-agent`, `ready-for-human`, `needs-triage`, `needs-info`, `wontfix`.
- Publish `tasks/issues/*.md` in dependency order.
- Replace `DRAFT-*` references with real GitHub issue numbers.

Use `docs/development/codex-worktree-workflow.md` when opening a fresh Codex
desktop window so the thread is bound to the correct local worktree and branch.

## Implementation Guardrails

- Preserve the one-agent architecture until a new ADR changes it.
- Pull and pin OpenClaw source before relying on OpenClaw APIs.
- Keep all education data behind CLAW MCP Server.
- Treat `sessionKey` as a scope lookup key, not authentication.
- Enforce parent isolation at the MCP/data layer, not only in prompts.
- All write paths must produce audit records.
- Prefer append-only records until a slice explicitly needs controlled replacement.
- Every AFK issue starts with a failing test and ends with relevant tests passing.

# Development Readiness

## Current State

- Repo initialized with engineering instructions and domain docs.
- PRD and technical architecture are archived under `docs/`.
- Development plan is capability-first, not scenario-first.
- Local issue drafts are available under `tasks/issues/`.
- GitHub publishing is blocked locally because `gh` is not installed.

## First Work To Start

Start with `tasks/issues/0001-openclaw-source-baseline.md`.

That task must establish:

- Where the OpenClaw source checkout lives.
- Which upstream commit CLAW v1 is developing against.
- Which OpenClaw source files and docs define the runtime/session/MCP/plugin contracts.
- How future tasks should run OpenClaw source tests or contract checks.

No CLAW application code should assume an OpenClaw API until issue 0001 has pinned and documented that contract.

## Development Shape

The implementation track is capability-first:

1. OpenClaw source and runtime contract.
2. school-claw scaffold and test harness.
3. OpenClaw sessionKey -> CLAW `ssid`.
4. Markdown learning archive.
5. `SessionScope` and permission guards.
6. Safe writes and audit.
7. CLAW MCP primitives.
8. Scope Bridge Plugin.
9. One-agent OpenClaw workspace/config.
10. Agent prompt contract.
11. Capability acceptance harness.
12. Native platform binding.
13. Pilot operations baseline.

Product scenarios are only acceptance checks for these capabilities.

## MVP Gate

The first pilot-ready gate is completion of draft issues 0001 through 0013.

Do not implement scenario-specific shortcuts. If a scenario only works because of hard-coded task logic rather than general capabilities, the issue is not done.

## Publishing Preparation

Before publishing issues to GitHub:

- Install and authenticate `gh`, or enable a GitHub connector.
- Create missing labels: `ready-for-agent`, `ready-for-human`, `needs-triage`, `needs-info`, `wontfix`.
- Publish `tasks/issues/*.md` in dependency order.
- Replace `DRAFT-*` references with real GitHub issue numbers.

## Implementation Guardrails

- Preserve the one-agent architecture until a new ADR changes it.
- Pull and pin OpenClaw source before relying on OpenClaw APIs.
- Keep all education data behind CLAW MCP Server.
- Treat `sessionKey` as a scope lookup key, not authentication.
- Enforce parent isolation at the MCP/data layer, not only in prompts.
- All write paths must produce audit records.
- Prefer append-only records until a slice explicitly needs controlled replacement.
- Every AFK issue starts with accepted behavior and a verification path, then ends with the real user/agent path and relevant supporting checks passing.

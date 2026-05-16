# Prepare pilot operations and security baseline

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/development/openclaw-baseline.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 15.5, 16, 18, and 19.
- Project summary: Once capabilities work locally and on a native platform, the pilot needs operational controls: startup, config safety, logs, audit review, backup, and incident checks.
- Capability: make CLAW v1 operable for a small real-class pilot.
- Non-negotiables: no silent production config changes, no broad native tools, no missing audit review path, and no undocumented restart/recovery process.
- Expected handoff result: a pilot operator can start, inspect, troubleshoot, and safely stop CLAW v1.

## What to build

Create the pilot operations baseline: runbook, environment variables, local/remote data locations, startup commands, health checks, log locations, audit review commands, backup/restore notes, and security checklist.

## Acceptance criteria

- [x] Runbook explains how to start and stop the OpenClaw Gateway plus CLAW MCP Server.
- [x] Runbook explains where `claw-data`, OpenClaw workspace, logs, sessions, and audit files live.
- [x] Security checklist verifies native risky tools are denied.
- [x] Security checklist verifies parent isolation tests pass before pilot.
- [x] Audit review command or procedure exists.
- [x] Backup/restore procedure exists for Markdown learning archives and registry data.
- [x] Failure modes include tool failure, forbidden access, platform disconnect, and Gateway restart.
- [x] Relevant smoke checks pass.

## Implementation evidence

- Runbook: `docs/development/pilot-operations-security-baseline.md`.
- Smoke command: `pnpm pilot:smoke`.
- Drift/security test: `tests/pilot-operations-baseline.test.ts`.
- Verification:
  - `./scripts/verify-openclaw-baseline.sh` passed, including checks for the
    documented OpenClaw source CLI entrypoint and pinned `tsx` loader.
  - `pnpm exec vitest run tests/pilot-operations-baseline.test.ts` passed.
  - `pnpm pilot:smoke` passed, including OpenClaw baseline verification,
    operations/security tests, and typecheck.
- `pnpm test` passed with 14 test files and 91 tests.

Note: real native-platform smoke remains HITL and must be recorded in the
runbook's live platform smoke table before real pilot traffic.

## Dependency basis

- Issue 0011 local OpenClaw capability harness and issue 0012 native platform
  binding assets have been merged from `origin/main` into this worktree.

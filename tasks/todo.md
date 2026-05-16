# Issue 0013: Pilot Operations And Security Baseline

## User Goal

Develop issue 0013 so a pilot operator can start, inspect, troubleshoot, back up,
restore, and safely stop CLAW v1 for a small real-class pilot without weakening
the OpenClaw/CLAW security boundary.

## User Journey

1. The operator reads one runbook before pilot day.
2. The operator confirms local paths, required env vars, and pinned OpenClaw
   source availability.
3. The operator starts the CLAW MCP Server and OpenClaw Gateway from documented
   commands.
4. The operator runs smoke checks that prove parent isolation, native risky tool
   denial, audit-writing behavior, and representative parent/teacher flows.
5. During pilot operation, the operator can find logs, session data, Markdown
   archives, registry data, artifacts, and audit files.
6. If something fails, the operator follows documented failure-mode procedures
   for tool failure, forbidden access, platform disconnect, and Gateway restart.
7. Before and after the pilot, the operator can run audit review and
   backup/restore procedures.

## Agent Journey

1. Read issue 0013 plus prerequisite docs and lessons.
2. Inspect existing scripts/tests/configs to avoid inventing a second operating
   model.
3. Inspect pinned OpenClaw source/docs for startup, config, session, and tool
   policy facts that are safe to document.
4. Add the smallest durable operator-facing baseline: runbook/checklist plus
   scripted validation where useful.
5. Add tests that keep the baseline from drifting away from the real repo
   commands, configs, and security requirements.
6. Run targeted and full verification, then record evidence here.

## Acceptance Criteria

- [x] Runbook explains how to start and stop the OpenClaw Gateway plus CLAW MCP
  Server.
- [x] Runbook explains where `claw-data`, OpenClaw workspace, logs, sessions,
  artifacts, and audit files live.
- [x] Security checklist verifies native risky tools are denied.
- [x] Security checklist verifies parent isolation tests pass before pilot.
- [x] Audit review command or procedure exists.
- [x] Backup/restore procedure exists for Markdown learning archives and
  registry data.
- [x] Failure modes include tool failure, forbidden access, platform disconnect,
  and Gateway restart.
- [x] Relevant smoke checks pass.
- [x] Tests prove the operations baseline references commands/files that exist
  in this checkout.
- [x] Verification evidence is recorded in this file before delivery.

## Architecture And Boundaries

- CLAW v1 keeps one `claw-agent`; parents and teachers are sessions.
- Education data access stays behind the CLAW MCP Server.
- The OpenClaw Scope Bridge injects the trusted `sessionKey`/`ssid`; model input
  is not authority.
- OpenClaw native file/runtime tools must not access `claw-data`.
- The baseline should document operations and add drift checks, not introduce a
  new deployment framework.
- Issue 0012 is HITL/native-platform-dependent, so any real platform validation
  that cannot be performed from this repo must be documented as a required
  operator check rather than faked.

## Implementation Steps

- [x] Create and enter the dedicated issue worktree.
- [x] Review lessons and issue/prerequisite docs.
- [x] Inspect existing commands/configs/tests and pinned OpenClaw operational
  facts.
- [x] Add a pilot operations runbook/checklist in `docs/development/`.
- [x] Add a lightweight validation test that checks required runbook sections,
  command references, and security smoke commands.
- [x] Update issue 0013 acceptance boxes if the implementation satisfies them.
- [x] Run targeted tests and full relevant verification.
- [x] Record command output/evidence in this file.

## Verification Path

- `pnpm test -- tests/pilot-operations-baseline.test.ts`
- `pnpm test`
- `pnpm typecheck`
- `./scripts/verify-openclaw-baseline.sh`
- Existing smoke commands referenced by the runbook, including parent
  isolation/security checks, should be listed with expected PASS output.

## Evidence To Collect

- Git status showing only intended issue 0013 files changed.
- Targeted operations-baseline test output.
- Full test output.
- Typecheck output.
- OpenClaw baseline verification output.
- Notes for any real-platform/HITL validation that remains operator-owned.

## Risks

- OpenClaw runtime commands and log/session paths may differ by checkout or
  channel plugin; document verified source-backed facts and mark local operator
  choices clearly.
- Native platform validation may remain partly manual because issue 0012 is a
  HITL spike.
- A pure documentation change can drift; add tests to pin required sections and
  command references.

## Non-Goals

- Do not implement a production deployment system, daemon manager, or cloud
  backup service.
- Do not change CLAW data permissions, scope resolution, or MCP tool behavior
  unless verification exposes a direct issue 0013 blocker.
- Do not add scenario-specific tools or duplicate the existing local capability
  harness.
- Do not claim native platform pilot readiness without a real platform smoke
  record.

## Implementation Summary

- Added `docs/development/pilot-operations-security-baseline.md`, an operator
  runbook covering paths, env vars, start/stop commands, Gateway health/log
  commands, security checklist, audit review, backup/restore, failure modes, and
  live-platform smoke record fields.
- Added `scripts/pilot-smoke-checks.sh` and `pnpm pilot:smoke` as the single
  pre-pilot smoke command.
- Added `tests/pilot-operations-baseline.test.ts` to pin the runbook to real
  repo files, smoke commands, audit/backup commands, and the shipped OpenClaw
  tool-deny policy.
- Hardened the documented Gateway path to use the reviewed config, mandatory
  token auth, and `gateway.bind=auto` with `--bind auto` so local and
  tokened-container starts follow the same verified path.
- Made OpenClaw-facing tests honor `OPENCLAW_DIR`/`OPENCLAW_CHECKOUT` before the
  pinned fallback path.
- Made pilot smoke fail closed for the documented OpenClaw source CLI path by
  requiring `src/entry.ts` and the pinned `tsx` loader, and removed the generated
  stale `.last-good` config from the delivery surface.
- Merged current `origin/main` into the issue worktree so issue13 keeps issue12
  native-platform assets, live registry loading, roster-bound teacher writes,
  and scoped artifact filtering coverage.
- Corrected the security checklist to document the current reviewed
  `claw__...` allowlist instead of the older `bundle-mcp` policy.

## Verification Evidence

- `pnpm exec vitest run tests/pilot-operations-baseline.test.ts
  tests/scope-get.test.ts tests/write-audit.test.ts
  tests/mcp-artifact-create.test.ts tests/claw-agent-contract.test.ts
  tests/openclaw-agent-workspace-config.test.ts
  tests/claw-agent-capability-harness.test.ts`: PASS, 7 test files / 37 tests.
- `./scripts/verify-openclaw-baseline.sh`: PASS, including
  `/Users/leon/openclaw/src/entry.ts` and
  `/Users/leon/openclaw/node_modules/tsx/dist/esm/index.mjs`.
- `CLAW_PILOT_SMOKE=1 pnpm exec vitest run
  tests/pilot-operations-baseline.test.ts
  tests/openclaw-agent-workspace-config.test.ts`: PASS, 2 test files / 10 tests.
- `pnpm pilot:smoke`: PASS. It ran
  `./scripts/verify-openclaw-baseline.sh`, 11 operations/security test files
  with 78 tests passing, and `pnpm typecheck`.
- `pnpm test`: PASS, 14 test files / 91 tests.
- `pnpm exec vitest run tests/pilot-operations-baseline.test.ts`: PASS after
  updating the runbook allowlist check, 1 test file / 4 tests.
- Real platform smoke remains an operator/HITL record by design. The runbook
  includes the required record table and does not claim live platform readiness
  without issue 0012 evidence.

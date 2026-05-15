# Issue 0011 Plan: Local OpenClaw Capability Harness

## User Goal

Create a new branch and continue issue 11 by proving the reusable CLAW capabilities through a local OpenClaw-facing harness.

Branch/worktree:

- Branch: `work/0011-local-openclaw-capability-harness`
- Worktree: `/Users/leon/school-claw-worktrees/0011-local-openclaw-capability-harness`
- Base: `codex10` because issue 11 is blocked by issue 10.

## User / Agent Journey

1. A developer runs one documented local command.
2. The command runs representative parent and teacher journeys through the OpenClaw Pi Runtime or the closest source-supported local boundary.
3. The harness routes all education data access through the CLAW MCP Server and Scope Bridge.
4. The harness reports enough evidence to show parent reads are scoped, parent observations persist and can be read back, teacher class reads work, artifact generation works, forbidden access is refused, audit records are written, and native/scenario-specific paths are not used.

## Acceptance Criteria

- [x] A single documented command runs the local capability harness.
- [x] Parent scope reads only the parent's own child archive.
- [x] Parent observations can be appended and later read.
- [x] Teacher scope can read class-level learning state.
- [x] Artifact creation happens through primitive tools.
- [x] Parent attempts to access another student or class-identifiable data are refused.
- [x] Write operations produce audit records.
- [x] Implementation path does not depend on scenario-specific tool names.
- [x] Relevant integration tests pass.

## Architecture / Boundaries

- Keep scenario behavior in tests/harness fixtures, not reusable application modules.
- Do not introduce a second agent. Keep one `claw-agent`; parents and teachers remain sessions.
- Do not let OpenClaw native file tools read or write `claw-data`.
- Education data access must go through CLAW MCP Server primitives behind Scope Bridge session injection.
- Prefer the current OpenClaw Pi Runtime helper path already established by issue 10.
- Avoid unrelated refactors; touch only harness, tests, docs, and package script surfaces needed for issue 11.

## Implementation Steps

- [x] Create issue worktree and branch from `codex10`.
- [x] Read `AGENTS.md`, `CONTEXT.md`, issue 0011, OpenClaw baseline, development plan, and architecture sections 12/15/18.
- [x] Run the existing issue 11 and related integration tests to establish baseline behavior.
- [x] Add or tighten failing acceptance coverage for missing issue 11 criteria.
- [x] Add the single command surface for the harness if missing.
- [x] Implement the minimum harness changes needed to make the issue 11 acceptance path pass.
- [x] Update documentation or script output so the command is discoverable and self-verifying.

## Verification Path

- Targeted red/green tests:
  - `pnpm vitest run tests/claw-agent-capability-harness.test.ts`
  - related harness tests if touched.
- Integration/regression checks:
  - `pnpm test`
  - `pnpm typecheck`
- Runtime evidence:
  - Run the single documented harness command and capture key output.
  - Inspect audit output from the scratch archive through test assertions or command output.
  - Confirm `git status --short --branch --untracked-files=all` before delivery.

## Evidence To Collect

- Exact commands run and pass/fail result.
- Harness output showing OpenClaw/Pi Runtime boundary, CLAW MCP/Scope Bridge use, scoped parent/teacher behavior, refusal, artifact creation, audit records, and no native file tools.
- Test assertions covering the acceptance criteria.
- Final git status.

## Risks

- The external pinned `/Users/leon/openclaw` checkout may be unavailable or drifted; tests must guard availability clearly.
- Some environments cannot bind loopback; verifier-facing paths should prefer in-process or non-network helpers where possible.
- Deterministic model fixtures can accidentally become scenario-specific production behavior; keep them limited to harness/test scripts.
- Existing dirty files in the main worktree must not be mixed into this issue branch.

## Non-Goals

- Native platform binding and real chat provider smoke tests.
- New product behavior beyond proving the existing reusable primitives.
- Reworking the Markdown database schema.
- Publishing or closing GitHub issues/PRs unless requested separately.

## Review / Verification Evidence

- Red check: `pnpm vitest run tests/claw-agent-capability-harness.test.ts -t "documents a single command"` failed before implementation because `demo:capability-harness` was missing.
- Targeted harness check: `pnpm vitest run tests/claw-agent-capability-harness.test.ts` passed, 2 tests passed. Evidence covers the documented command, OpenClaw Pi Runtime runs, parent own-child read scope, parent observation append/read-back, parent refusal, teacher class read, artifact creation, audit entries, and absence of scenario-specific visible tool names.
- Type check: `pnpm typecheck` passed.
- Single-command runtime evidence: `pnpm demo:capability-harness` passed. Output reported `runtime: openclaw-pi-runtime`, `runs: 5`, parent observation append/read-back `PASS`, parent refusal `PASS`, own-child read file IDs limited to `stu_001`, teacher class read including class and both students, `audit files_append: 1`, and `audit artifact_create: 2`.
- Regression suite: `pnpm test` passed, 11 test files and 73 tests.
- Stop-hook first rerun: verifier passed, reviewer failed because the harness relied on scripted reply text for read-back evidence and the demo command did not throw on failed criteria.
- Reviewer fix: added mechanical assertions that `files_read_all` returns `classes/class_001/students/stu_001/parent-observations/2026-06.md` with appended content/frontmatter, and made `pnpm demo:capability-harness` throw on any failed acceptance criterion.
- Post-reviewer-fix checks: `pnpm typecheck`, `pnpm vitest run tests/claw-agent-capability-harness.test.ts`, `pnpm demo:capability-harness`, and `pnpm test` all passed.

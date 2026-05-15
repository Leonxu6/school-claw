# Issue 0012 Plan: Native Platform Binding Spike

## User Goal

Create a new worktree and develop issue 12: validate the native platform binding and authorization path for the first CLAW v1 pilot channel.

Branch/worktree:

- Branch: `work/0012-native-platform-binding-spike`
- Worktree: `/Users/leon/school-claw-worktrees/0012-native-platform-binding-spike`
- Base: `work/0011-local-openclaw-capability-harness` because issue 12 is blocked by issue 11.

## User / Agent Journey

1. A developer selects the first pilot candidate channel from the architecture and pinned OpenClaw source docs.
2. A human operator configures that real native platform bot with `session.dmScope="per-channel-peer"` and the one-agent CLAW config.
3. Two real user accounts DM the bot and record peer IDs, session keys, bot replies, and restart behavior.
4. The operator records whether platform invite-token binding works. If it does not, the operator records the one-time authorization-code fallback.
5. A local validator checks the recorded evidence and reports PASS/FAIL per issue 12 acceptance criterion.
6. The recorded result states whether the candidate is accepted for the v1 pilot or rejected with reasons.

## Acceptance Criteria

- [x] Candidate platform and channel plugin are selected.
- [x] A real account can private-chat the bot.
- [x] Two accounts produce different stable OpenClaw session keys.
- [x] The same account keeps a stable session key across repeated messages and Gateway restart.
- [x] Bot replies work in private chat.
- [x] If invite token is available, it is verified end-to-end. N/A for the observed Feishu internal-app path; authorization-code pairing fallback was used instead.
- [x] If invite token is not available, one-time authorization-code binding is specified.
- [x] Result records whether the platform is accepted for v1 pilot or rejected with reasons.
- [x] Automated checks prove the evidence validator cannot pass missing, unstable, cross-account, or unauthenticated binding evidence.

## Architecture / Boundaries

- The selected platform must stay behind OpenClaw channel/plugin boundaries. CLAW code must depend only on `channel`, `accountId`, `peer.kind`, `peer.id`, message text, reply target, and OpenClaw `sessionKey`.
- Keep one `claw-agent`; do not introduce platform-specific agents.
- Keep `session.dmScope="per-channel-peer"` for private-chat pilot routing.
- Treat OpenClaw `sessionKey` as CLAW `ssid` and scope lookup key only, never as authentication.
- First-time authorization must bind a real platform peer/session to an existing parent/teacher/student authorization record.
- Do not weaken MCP Server scope checks or Scope Bridge injection for platform convenience.
- Do not claim real platform acceptance without human-captured account evidence.

## Implementation Steps

- [x] Create the issue 12 worktree and branch from issue 11.
- [x] Read `AGENTS.md`, `CONTEXT.md`, issue 0012, OpenClaw baseline, and relevant architecture sections.
- [x] Add failing tests for native-platform evidence validation and platform config selection.
- [x] Implement the smallest validator/config helpers needed to make those tests pass.
- [x] Add a CLI entry for validating captured HITL evidence files.
- [x] Add documentation/runbook and evidence template for the real Feishu/Lark smoke.
- [x] Run targeted tests, typecheck, and relevant existing regression tests.
- [x] Record verification evidence and any remaining HITL gap in this file.

## Verification Path

- Red/green tests:
  - `pnpm vitest run tests/native-platform-binding-spike.test.ts`
- Contract checks:
  - `pnpm typecheck`
  - `pnpm test`
- CLI behavior:
  - Validate a passing fixture evidence file.
  - Validate that the template/pending evidence cannot pass.
- Human real-platform smoke path:
  - Configure Feishu/Lark bot.
  - DM from two real accounts.
  - Restart Gateway.
  - Capture peer IDs, session keys, replies, and invite-token or authorization-code result.
  - Run validator against the captured evidence.

## Evidence To Collect

- Exact branch/worktree status.
- Source basis for selecting Feishu/Lark.
- Test output for targeted validator/config tests.
- Typecheck and full test output.
- CLI output for passing and failing evidence files.
- If available in this turn, real platform evidence from two accounts; otherwise mark the HITL acceptance gap explicitly.

## Risks

- Real Feishu/Lark bot setup requires credentials, app approval, and two human accounts; this agent cannot fabricate those external facts.
- OpenClaw channel docs/defaults can drift, so the config helper should stay minimal and explicit.
- The existing architecture draft had older runtime-selection examples; issue 10 already corrected runtime policy, so new docs/config must not reintroduce `agents.defaults.agentRuntime`.
- A validator that accepts synthetic evidence as real evidence would weaken the issue, so tests must cover missing and unstable evidence.

## Non-Goals

- Building a production enrollment UI.
- Storing real Feishu/Lark credentials in the repo.
- Replacing the CLAW MCP Server scope model.
- Supporting every native platform in this issue.
- Closing or publishing the GitHub issue/PR unless separately requested.

## Review / Verification Evidence

- Worktree created at `/Users/leon/school-claw-worktrees/0012-native-platform-binding-spike` on branch `work/0012-native-platform-binding-spike`, based on `work/0011-local-openclaw-capability-harness`.
- GitHub issue lookup through `gh` was unavailable because `gh` is not installed. Public GitHub REST returned 404, so the local tracked spec `tasks/issues/0012-native-platform-binding-spike.md` is the source used for this implementation.
- Red test: `pnpm vitest run tests/native-platform-binding-spike.test.ts` initially failed because `../src/openclaw/native-platform-binding-spike.js` did not exist.
- Dependency setup for the new worktree: `pnpm install --frozen-lockfile` passed.
- Targeted native-platform test: `pnpm vitest run tests/native-platform-binding-spike.test.ts` passed, 1 file and 7 tests. Coverage includes Feishu/Lark candidate config, accepted evidence, template/synthetic rejection, unstable restart rejection, cross-account session reuse rejection, missing authorization fallback rejection, and CLI validation.
- Type check: `pnpm typecheck` passed.
- Full regression: `pnpm test` passed, 12 test files and 80 tests. The suite exercised existing scoped read, artifact, write audit, scope bridge, OpenClaw read loop, OpenClaw config validation, sedimentation loop, and capability harness coverage.
- CLI negative evidence check: `pnpm validate:native-platform-binding docs/development/0012-native-platform-binding-evidence.template.json` failed as expected with `INVALID pending`; the template does not count as real platform proof.
- Earlier real-platform HITL gap: before QR onboarding and Feishu Developer Console verification, the engineering support for issue 12 was implemented but no real Feishu/Lark account evidence had been captured. That gap is now closed by the two-account smoke below.
- Quality gate: reviewer FAIL and verifier FAIL because issue 0012 requires real Feishu/Lark private-chat evidence and an accepted/rejected pilot decision. Reviewer output: `/Users/leon/school-claw/.codex/runs/quality-gate/0012-native-platform-binding-spike-2cd509d6ac858b5045a2b1999c28de1568256bfe7f44bfd3df854a6a7995d117-reviewer-20260515T090025Z.out`. Verifier output: `/Users/leon/school-claw/.codex/runs/quality-gate/0012-native-platform-binding-spike-2cd509d6ac858b5045a2b1999c28de1568256bfe7f44bfd3df854a6a7995d117-verifier-20260515T090025Z.out`.
- Real Feishu/Lark smoke on 2026-05-15: dedicated config `/Users/leon/.openclaw/school-claw-issue12/openclaw.json` validated, Feishu channel was installed/configured/enabled, Developer Console long-connection verification returned connected, and Gateway started with `openai/gpt-5.5`, `codex`, and `feishu`.
- Real account A evidence: the phone DM `issue12 smoke A3` reached `claw-agent` and replied `issue12 smoke A3 received.`; repeated DM `issue12 smoke A4` used the same redacted session key and replied; after Gateway restart, DM `ssue12 smoke A5` again used the same redacted session key and replied.
- Local evidence file with the real Feishu peer id is intentionally stored outside the repo at `/Users/leon/.openclaw/school-claw-issue12/0012-native-platform-binding-evidence.account-a.local.json`.
- Single-account evidence validation: `pnpm validate:native-platform-binding /Users/leon/.openclaw/school-claw-issue12/0012-native-platform-binding-evidence.account-a.local.json` passed as `VALID rejected`. Passing criteria: candidate platform, real-platform evidence, private-chat entry, repeated-session stability, restart-session stability, private-chat replies, and invite-or-authorization binding. Expected failing criterion: `distinct-session-keys`, because only one real account has been tested so far.
- Real account B evidence: the Chrome account joined the same Feishu team and opened the bot private chat through the QR link. One-time pairing code approval bound the peer to the `claw-agent` session. DM `issue12 smoke B1` reached `claw-agent`, produced a different redacted `agent:claw-agent:feishu:direct:<open_id>` session key from account A, and replied. Repeated DM `issue12 smoke B2` used the same redacted account B session key and replied.
- Platform-scope finding: an account outside the Feishu team was blocked by Feishu with `无法访问其他团队内部的应用` before OpenClaw received any event. The accepted pilot path therefore assumes parents and teachers are in the same Feishu tenant/team, or that a future production app distribution model replaces the internal-app constraint.
- Final two-account evidence file with real peer ids is intentionally stored outside the repo at `/Users/leon/.openclaw/school-claw-issue12/0012-native-platform-binding-evidence.account-a-b-final.local.json`.
- Final evidence validation: `pnpm validate:native-platform-binding /Users/leon/.openclaw/school-claw-issue12/0012-native-platform-binding-evidence.account-a-b-final.local.json` passed as `VALID accepted`. Passing criteria: candidate platform, real-platform evidence, private-chat entry, distinct session keys, repeated-session stability, restart-session stability, private-chat replies, invite-or-authorization binding, and pilot decision.

---

# Teacher Agent Scenario Verification

## User Goal

Use the real OpenClaw/Feishu entry point to act as a teacher assigning tasks to
`claw-agent`, then verify whether the agent can complete representative teacher
work. If a task cannot complete because of code or configuration gaps, fix the
smallest real blocker and rerun the same scenario.

## User / Agent Journey

1. A teacher opens the existing Feishu bot private chat from Chrome.
2. The teacher sends natural-language classroom tasks to `claw-agent`.
3. OpenClaw routes the message to the stable teacher session.
4. CLAW Scope Bridge injects the real session key into CLAW MCP calls.
5. CLAW MCP resolves teacher scope, reads/writes the Markdown archive, creates
   artifacts, and writes audit records.
6. The bot replies with a useful teacher-facing result and saved artifact or
   record references where applicable.

## Acceptance Criteria

- [x] A real Feishu session can be bound to a teacher `SessionScope` without
  committing real peer IDs or secrets to the repo.
- [x] Teacher durable observation task writes to the correct student archive and
  produces an audit record.
- [x] Teacher single-student query reads archive evidence before answering.
- [x] Teacher class-level query can read class/student files within teacher
  scope.
- [x] Teacher reusable artifact task creates an audited artifact from readable
  source files.
- [x] Ambiguous student task asks a narrow clarifying question rather than
  writing to the wrong archive.
- [x] Unsupported or unsafe task is refused or narrowed without native file,
  exec, session-spawn, or cross-scope data access.
- [x] Evidence is collected from real Feishu/OpenClaw logs, MCP traces, archive
  side effects, bot replies, and regression tests.

## Architecture / Boundaries

- Keep one `claw-agent`; do not create a teacher-specific agent.
- Use real Feishu DM routing for the E2E smoke where practical.
- Use an external local scope registry for real pilot session bindings; do not
  commit real Feishu open IDs, App IDs, secrets, or teacher personally
  identifying data to the repo.
- Keep education data access behind CLAW MCP and Scope Bridge. The agent must
  not use native file, exec, edit, browser, gateway, cron, subagent, or
  session-spawn tools for `claw-data`.
- Use a disposable local pilot archive for scenario testing unless the user
  explicitly asks to touch production class archives.

## Implementation Steps

- [x] Inspect current live OpenClaw config, MCP server, scope registry, and
  Feishu session state.
- [x] Add failing coverage for loading an external scope registry if live
  Feishu sessions cannot resolve to teacher scope today.
- [x] Implement the smallest external registry loader/config hook required for
  real pilot session binding.
- [x] Create a local disposable pilot archive and local external registry
  outside the repo for the current Feishu teacher session.
- [x] Add a native OpenClaw CLAW tool adapter because OpenClaw bundle-MCP
  before-tool hooks currently run without trusted session context.
- [x] Run teacher scenario messages through Feishu/OpenClaw.
- [x] Inspect replies, Gateway logs, MCP traces, archive files, artifacts, and
  audit records.
- [x] Fix any observed product/code/config blocker and rerun the failed
  scenario.
- [x] Run relevant tests, typecheck, and final secret scan.

## Verification Path

- Automated checks:
  - `pnpm vitest run` for new or touched tests.
  - `pnpm typecheck`.
- Real-path checks:
  - Send teacher messages from Chrome Feishu DM to the bot.
  - Capture OpenClaw session key and routing logs.
  - Capture MCP trace entries for `scope_get`, `files_append`,
    `files_read_all`, and `artifact_create`.
  - Inspect disposable archive side effects and audit records.
  - Confirm no native denied tools were used for archive operations.

## Evidence To Collect

- Red/green test output for any binding/config fixes.
- Feishu bot replies for each teacher scenario.
- Gateway log snippets showing route/session stability.
- MCP trace snippets showing tool order and injected session.
- Archive file paths touched and audit entries created.
- Secret scan result proving real platform identifiers were not committed.

## Scenario Verification Evidence

- External-registry red check: `pnpm vitest run tests/mcp-artifact-create.test.ts -t "loads an external scope registry"` failed before the fix because the live Feishu-style teacher session returned `UNBOUND_SESSION`.
- External-registry green check: the same command passed after adding `CLAW_SCOPE_REGISTRY_PATH` support in the MCP server.
- Targeted regression: `pnpm vitest run tests/scope-get.test.ts tests/mcp-artifact-create.test.ts` passed, 2 files and 11 tests.
- Type check after the registry fix: `pnpm typecheck` passed.
- Disposable live-test archive created outside the repo at `/Users/leon/.openclaw/school-claw-issue12/teacher-scenarios/claw-data` with two fixture students, a teacher-scoped external registry, and MCP trace logging.
- Live teacher session registry probe passed through the MCP server: the bound Feishu private-chat session resolves as a teacher scope with `read_class`, `write_class`, and `create_class_artifact`.
- First live T1 attempt through Chrome/Feishu routed to `claw-agent`, but the Codex runtime did not expose CLAW MCP tools; the agent refused to bypass the scope boundary. This is a safe failure and proved the prompt/tool boundary was enforced.
- Second live T1 attempt after switching runtime reached OpenClaw Pi but failed before tool use because the model provider was still `openai` without a configured API key.
- The model profile was switched to Minimax and the corrected local API key was installed in the OpenClaw auth profile. Only non-secret profile metadata was verified.
- Gateway restart note: non-TTY background startup exited after readiness; running the same OpenClaw gateway in a `tmux` session remained stable, recovered Feishu bot identity, and reached `ws client ready`.
- Current regression after registry fix and live-gateway recovery: `pnpm vitest run tests/scope-get.test.ts tests/mcp-artifact-create.test.ts tests/native-platform-binding-spike.test.ts` passed, 3 files and 18 tests.
- Current type check: `pnpm typecheck` passed.
- MiniMax provider correction: the locally installed MiniMax API key was replaced after the user corrected it. Non-secret verification showed the key is present, starts with the expected provider prefix, has no whitespace, and works against the China endpoint `api.minimaxi.com`.
- Local teacher precheck reached Pi runtime with `minimax/MiniMax-M2.7`; the model saw `claw__scope_get` and attempted it. The attempt failed safely because OpenClaw's bundle-MCP materialized tools run `before_tool_call` without trusted session context, so Scope Bridge could not inject `ssid`.
- Next implementation step: register native OpenClaw plugin tools named `claw__scope_get`, `claw__files_read`, `claw__files_read_all`, `claw__files_list`, `claw__files_append`, and `claw__artifact_create`. These tools will remove `ssid` from the model-facing schema and inject `ctx.sessionKey` inside the tool execution path before calling the same CLAW core/MCP handlers.
- Native adapter implemented: `claw-scope-bridge` now registers native OpenClaw tools `claw__scope_get`, `claw__files_read`, `claw__files_read_all`, `claw__files_list`, `claw__files_append`, and `claw__artifact_create`. Model-facing schemas do not expose `ssid`; execution injects the trusted OpenClaw `sessionKey` and reuses the same CLAW MCP/core handlers.
- Config hardening: the shipped `claw-agent` OpenClaw config now uses an explicit tool allowlist for the six `claw__*` tools plus `message` and `session_status`, avoiding broad default native tools while keeping Feishu replies available.
- Local native precheck: `claw__scope_get` returned teacher scope for `class_001`, exposed a model-visible schema with `propertiesCount: 0`, and wrote MCP trace entries with `transport: "openclaw-native-plugin"`.
- Product bug found and fixed: the first durable-write attempt let the model guess `students/zhang_san`. The public scope now includes the teacher-visible roster, and teacher wildcard scopes are restricted to known student ids. Rerun wrote 张三 to `classes/class_001/students/stu_001/teacher-observations/2026-05.md`.
- Local T2 query passed: the agent read 张三 archive evidence with `claw__files_read_all` before answering that the primary recent math issue is unstable “单位一” identification.
- Product bug found and fixed: the first math error-table artifact included a 李四语文 row. The prompt/workspace behavior contract now requires subject-scoped filtering before saving artifacts. Rerun created math-only artifact `classes/class_001/artifacts/2026-05-15-error_table-459b3281.md`.
- Local T4 unknown-student scenario passed: asking to write to “小明” produced a narrow clarification because the roster only contains 张三 and 李四; no extra student directory was created.
- Local T5 unsafe request passed: asking to directly open and package the local `claw-data` folder was refused; the agent stated it can only access archives through CLAW tools.
- Real Chrome/Feishu UI T1 passed after the native adapter: a teacher DM reached `claw-agent`, called `claw__scope_get`, then `claw__files_append`, and replied in Feishu with the saved path and audit id. The archive side effect is `classes/class_001/students/stu_002/teacher-observations/2026-05.md`; the audit entry is present in `audit/2026-05/2026-05-15.md`.
- Regression after fixes: `pnpm vitest run tests/scope-bridge.test.ts tests/mcp-artifact-create.test.ts tests/scope-get.test.ts tests/native-platform-binding-spike.test.ts tests/openclaw-native-tools.test.ts tests/openclaw-agent-workspace-config.test.ts tests/write-audit.test.ts tests/scoped-read.test.ts tests/openclaw-read-loop.test.ts` passed, 9 files and 67 tests. `pnpm typecheck` passed.
- Full regression: the first `pnpm test` exposed one stale assertion that still expected broad `bundle-mcp` access. The test was updated to assert the new contract: only the six scoped `claw__*` native tools plus `message` and `session_status` are allowed, while raw file/exec/native tools stay denied. Final `pnpm test` passed, 13 files and 86 tests.
- Secret scan: `rg -n "sk-(api|cp)-|MiniMax|MINIMAX|OPENAI_API_KEY|apiKey|api_key|Authorization" . --glob '!node_modules' --glob '!*.log' --glob '!workspaces/claw-agent/.openclaw/**'` found provider/config mentions and the existing fake test key only; no real MiniMax key or Feishu secret was committed.

## Failure And Edge Scenarios

- Unbound Feishu session should fail safely instead of inventing authority.
- Ambiguous or unknown student names should not write to an arbitrary archive.
- Parent-style or unsafe teacher requests should stay within teacher scope and
  allowed CLAW MCP primitives.
- Bot replies that only chat without reading/writing required evidence count as
  FAIL for task-completion scenarios.

## Risks And Non-Goals

- Real Feishu/browser interaction can be flaky; CLI/API evidence may supplement
  UI observations but should not replace the user-visible bot path when testing
  entry behavior.
- This stage does not build a production enrollment/admin UI.
- This stage does not migrate from Markdown files to a database.
- This stage does not send messages to real parents unless explicitly approved.

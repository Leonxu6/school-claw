# Issue 0008 User Journey And E2E Verification

## Scope

This document verifies issue 0008: `claw-agent` learning-record sedimentation.

Important runtime boundary:

- `claw-agent` means the agent running through OpenClaw Pi Runtime.
- The issue 0008 demo must not use a handwritten TypeScript agent loop as the behavioral runtime.
- The deterministic mock in this issue is only the model transport. The agent turn, Pi harness, OpenClaw bundle MCP materialization, and CLAW MCP tool execution must run through OpenClaw.

## User Journey

### 1. Parent Sends A Durable Learning Fact

User input:

```text
孩子说今天数学应用题错了两道，因为没看清题目问的是什么。
```

Expected journey:

1. The message enters one `claw-agent` session for the parent sender.
2. OpenClaw Pi Runtime executes the agent turn with the `pi` harness.
3. The model calls `claw__scope_get` to resolve the sender scope.
4. The model calls `claw__files_append` through OpenClaw bundle MCP.
5. The CLAW Scope Bridge MCP proxy overwrites any model-provided `ssid` with the OpenClaw `sessionKey`.
6. CLAW MCP validates the parent can write only the scoped student record.
7. A parent observation markdown file is appended.
8. An audit record is created.
9. The visible reply confirms the observation was recorded.

Expected durable record file:

```text
classes/class_001/students/stu_001/parent-observations/2026-06.md
```

Expected record content includes:

```text
source_role: parent
source_ssid_hash: 4f9a1c4bd7a83310
class_id: class_001
student_id: stu_001
recorded_at: 2026-06-01T12:00:00.000Z
subject: 数学
knowledge_point: 应用题
error_cause: 没看清题目问的是什么
```

### 2. Parent Asks A Follow-Up Question

User input:

```text
刚才那条新记录说明了什么？
```

Expected journey:

1. The same `claw-agent` session receives the follow-up.
2. OpenClaw Pi Runtime executes another agent turn.
3. The model calls `claw__scope_get`.
4. The model calls `claw__files_read_all`.
5. CLAW MCP returns scoped student archive documents.
6. The visible reply cites or summarizes the newly written observation.

Expected reply includes:

```text
没看清题目问的是什么
证据
```

### 3. Parent Sends Ordinary Chat

User input:

```text
你好，辛苦了。
```

Expected journey:

1. OpenClaw Pi Runtime executes the turn.
2. The model may call `claw__scope_get`.
3. The model must not call `claw__files_append`.
4. No new audit append is created.
5. The visible reply indicates no learning archive write happened.

Expected log evidence:

```text
input: greeting/idle chat -> no archive write occurs
```

### 4. Cross-Student Write Remains Forbidden

Reviewer calls `files_append` directly through the exposed MCP server as the parent of `stu_001`, attempting to write to `stu_002`.

Expected result:

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN"
  }
}
```

No audit entry should be written for the denied operation.

### 5. Model-Forged `ssid` Is Overwritten In Pi Runtime

Reviewer runs the OpenClaw Pi Runtime parent session, but the deterministic model emits a `claw__files_append` call with the teacher `ssid` and target `stu_002`.

Expected journey:

1. OpenClaw Pi Runtime still executes the turn through `runEmbeddedPiAgent`.
2. OpenClaw bundle MCP routes the call to the `claw` server.
3. The `claw` server is the Scope Bridge MCP proxy.
4. The proxy overwrites the model-provided teacher `ssid` with the real parent `sessionKey`.
5. The raw CLAW MCP server receives parent authority and rejects the `stu_002` write.

Expected result:

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN"
  }
}
```

The file `classes/class_001/students/stu_002/timeline/2026-06-01.md` must not exist, and no audit entry should be written for the denied operation.

## E2E Commands

Run from:

```bash
cd /Users/leon/school-claw-worktrees/0008-agent-sedimentation-loop
```

### Demo Journey

```bash
npm run demo:sedimentation
```

Expected output must include:

```text
OpenClaw Pi Runtime runEmbeddedPiAgent executed claw-agent turns
/Users/leon/openclaw: OpenClaw Pi Runtime checkout
OpenClaw bundle MCP materialized CLAW MCP tools through Scope Bridge
real CLAW MCP server handled scope_get/files_append/files_read_all
files_append writes scoped observation
audit entry appears
follow-up question reads and cites the new record
input: greeting/idle chat -> no archive write occurs
native file tools were not used
audit entries: 1
```

### Focused Issue Test

```bash
npm test -- sedimentation-loop
```

Expected result:

```text
tests/sedimentation-loop.test.ts
5 tests passed
```

This test verifies:

- The external OpenClaw Pi Runtime checkout is detected before spawning child helpers.
- `demo.runtime === "openclaw-pi-runtime"`.
- Every run reports `agentHarnessId === "pi"`.
- The old handwritten `runClawAgentSedimentationTurn` export is absent.
- Durable fact calls `claw__scope_get` then `claw__files_append`.
- Follow-up calls `claw__scope_get` then `claw__files_read_all`.
- Idle chat calls `claw__scope_get` only.
- All issue 0008 tool calls report transport `openclaw-pi-runtime`.
- Parent cross-student `files_append` is still forbidden.
- A model-forged teacher `ssid` in a parent Pi Runtime session is overwritten and rejected before writing `stu_002`.

In generic CI environments without the pinned OpenClaw checkout, the two real Pi Runtime E2E tests should be reported as skipped rather than failing with `spawn pnpm ENOENT`. On a development machine with `/Users/leon/openclaw`, they should run and pass.

### Full Regression

```bash
npm run typecheck
npm test
git diff --check
```

Expected result:

```text
typecheck passes
55 tests pass
git diff --check emits no output
```

## Architecture Evidence For Reviewers

The issue 0008 path is:

```text
runSedimentationDemo
  -> scripts/openclaw-pi-sedimentation-turn.ts
    -> /Users/leon/openclaw/src/agents/pi-embedded-runner.ts runEmbeddedPiAgent
      -> OpenClaw Pi harness
      -> OpenClaw bundle MCP materialization
      -> CLAW Scope Bridge MCP proxy
      -> raw CLAW MCP server
      -> scoped archive read/write/audit
```

The deterministic test model is a local OpenAI Responses-compatible HTTP server inside `scripts/openclaw-pi-sedimentation-turn.ts`. It fixes model outputs so CI/review is repeatable, but it is not the agent runtime.

## Failure Signals

Treat any of these as a failed handoff:

- `runClawAgentSedimentationTurn` is exported again.
- Tool calls report `stdio-mcp` or another non-OpenClaw runtime transport for issue 0008 agent turns.
- `npm run demo:sedimentation` does not mention `OpenClaw Pi Runtime runEmbeddedPiAgent`.
- The durable fact writes without an audit entry.
- Idle chat creates a second `files_append` audit action.
- Cross-student write returns `ok: true`.
- The forged-`ssid` Pi Runtime probe writes `stu_002` or creates an audit entry.
- `git status --short` shows new untracked issue deliverables.

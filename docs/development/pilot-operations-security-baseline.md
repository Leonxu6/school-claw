# Pilot Operations And Security Baseline

Status: issue 0013 baseline

This runbook is the minimum operating contract for a CLAW v1 small-class pilot.
It keeps the pilot executable without changing the core architecture:
OpenClaw owns messaging, routing, sessions, and the agent loop; the CLAW MCP
Server owns education-data access; the Scope Bridge injects the trusted
OpenClaw `sessionKey` as `ssid`; and native OpenClaw tools remain denied for
student archives.

## Operator Rule

Never make silent production config changes during a pilot. For any config
change, record the reason, apply it to a reviewed config file, run validation,
run `pnpm pilot:smoke`, then restart the Gateway through the documented restart
path.

## Path Map

Use these paths unless an operator-specific deployment record overrides them.
If a path is overridden, write the replacement path in the pilot handoff notes
before starting the Gateway.

| Item | Default path | Notes |
| --- | --- | --- |
| school-claw checkout | `/Users/leon/school-claw` | Run repo commands from this directory. Issue worktrees may use `/Users/leon/school-claw-worktrees/<issue>`. |
| OpenClaw checkout | `/Users/leon/openclaw` | Pinned by `docs/development/openclaw-baseline.md`. |
| OpenClaw config | `integrations/openclaw/claw-agent.openclaw.json` | Repo-relative config. Run OpenClaw with cwd set to the school-claw checkout. |
| CLAW MCP Server entry | `src/mcp/server.ts` | Started by OpenClaw through the config's `mcp.servers.claw` stdio entry. |
| CLAW data root | `claw-data/` | Production Markdown learning archive. Do not commit real pilot data. |
| Fixture data root | `tests/fixtures/markdown-archive/` | Smoke-test data only. |
| Registry data | `$CLAW_DATA_DIR/registry/` | Session bindings, parents, teachers, invite codes. |
| Student archives | `$CLAW_DATA_DIR/classes/<classId>/students/<studentId>/` | Long-term learning records. |
| Generated artifacts | `$CLAW_DATA_DIR/classes/<classId>/students/<studentId>/artifacts/` and `$CLAW_DATA_DIR/classes/<classId>/artifacts/` | Student and class artifacts. |
| Audit files | `$CLAW_DATA_DIR/audit/YYYY-MM/YYYY-MM-DD.md` | Each write/generation records `actor_ssid_hash`, `role`, `action`, targets, and summary. |
| OpenClaw workspace | `workspaces/claw-agent/` | Prompt contract only. Do not place `claw-data` here. |
| OpenClaw state root | `~/.openclaw/` or `$OPENCLAW_STATE_DIR` | Mutable Gateway state. |
| OpenClaw sessions | `~/.openclaw/agents/<agentId>/sessions/sessions.json` and `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl` | Gateway-owned session store/transcripts. |
| OpenClaw file logs | `/tmp/openclaw/openclaw-YYYY-MM-DD.log` unless `logging.file` is configured | JSONL Gateway logs. |
| Stability bundles | `~/.openclaw/logs/stability/openclaw-stability-*.json` | Written on selected fatal exits/restart failures. |

## Remote Deployment Record

If the pilot runs on a remote host, fill this record before accepting traffic.
Do not rely on memory or shell history for these values.

| Item | Pilot value |
| --- | --- |
| Gateway host / access path |  |
| school-claw checkout |  |
| OpenClaw checkout or package version |  |
| `OPENCLAW_CONFIG_PATH` |  |
| `OPENCLAW_STATE_DIR` |  |
| `CLAW_DATA_DIR` effective value |  |
| OpenClaw `logging.file` override, if any |  |
| Backup destination |  |
| Restore drill date / operator |  |

## Environment

Set the operating paths explicitly in the shell that starts the Gateway:

```bash
export REPO_ROOT=/Users/leon/school-claw
export OPENCLAW_CHECKOUT=/Users/leon/openclaw
export OPENCLAW_CONFIG_PATH="$REPO_ROOT/integrations/openclaw/claw-agent.openclaw.json"
export CLAW_SCOPE_REGISTRY_PATH="${CLAW_SCOPE_REGISTRY_PATH:-$REPO_ROOT/claw-data/registry/scope-registry.local.json}"
export OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
export OPENCLAW_GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
export OPENCLAW_GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))')}"
```

The shipped OpenClaw config sets the CLAW MCP child process environment to
`CLAW_DATA_DIR=claw-data`, relative to `REPO_ROOT`. For a pilot, create or mount
the real Markdown archive at `$REPO_ROOT/claw-data`. If the data root must live
elsewhere, update the config intentionally, run validation, and record the
override in the handoff notes.

The CLAW MCP server reads `CLAW_SCOPE_REGISTRY_PATH` when it is present. For
real pilot traffic, the registry file must exist and define the live
parents/students/teachers/session bindings; do not run live traffic against the
fixture registry. If a supervisor strips shell environment variables, add
`CLAW_SCOPE_REGISTRY_PATH` to `mcp.servers.claw.env` intentionally, validate the
config, and record that override.

## Preflight Smoke Checks

Run the aggregated pilot smoke command before each pilot session and after every
config change:

```bash
cd "$REPO_ROOT"
pnpm pilot:smoke
```

The command runs:

- `./scripts/verify-openclaw-baseline.sh`
- `pnpm exec vitest run tests/pilot-operations-baseline.test.ts tests/openclaw-agent-workspace-config.test.ts tests/scope-bridge.test.ts tests/scope-get.test.ts tests/scoped-read.test.ts tests/write-audit.test.ts tests/artifact.test.ts tests/mcp-artifact-create.test.ts tests/openclaw-read-loop.test.ts tests/sedimentation-loop.test.ts tests/claw-agent-capability-harness.test.ts`
- `pnpm typecheck`

PASS means the pinned OpenClaw checkout is available, the shipped config still
denies risky native tools, parent isolation and Scope Bridge tests pass, write
operations still create audit records, and the local OpenClaw-facing harness
still exercises CLAW MCP paths. In `pnpm pilot:smoke`, the Pi Runtime capability
checks are required and must not skip. In generic non-pilot test runs, those
tests may skip with an explicit OpenClaw availability guard; do not treat that as
live-platform readiness.

`pnpm pilot:smoke` accepts either `OPENCLAW_CHECKOUT` or `OPENCLAW_DIR` for the
pinned OpenClaw checkout path. `OPENCLAW_CHECKOUT` is the operator-facing name in
this runbook; the smoke script maps it to `OPENCLAW_DIR` for the existing
baseline verifier.

For direct config validation through the pinned OpenClaw source CLI:

```bash
cd "$REPO_ROOT"
node --import "$OPENCLAW_CHECKOUT/node_modules/tsx/dist/esm/index.mjs" \
  "$OPENCLAW_CHECKOUT/src/entry.ts" config validate
```

## Start And Stop

### CLAW MCP Server

In normal operation, do not start the CLAW MCP Server by hand. OpenClaw starts
it as a stdio child from `mcp.servers.claw` in
`integrations/openclaw/claw-agent.openclaw.json`:

```json
{
  "command": "node",
  "args": [
    "--import",
    "./node_modules/tsx/dist/esm/index.mjs",
    "src/mcp/server.ts"
  ],
  "cwd": ".",
  "env": {
    "CLAW_DATA_DIR": "claw-data"
  }
}
```

For debugging only, start the MCP server in the foreground:

```bash
cd "$REPO_ROOT"
CLAW_SCOPE_REGISTRY_PATH="$REPO_ROOT/claw-data/registry/scope-registry.local.json" \
CLAW_DATA_DIR=claw-data \
  node --import ./node_modules/tsx/dist/esm/index.mjs src/mcp/server.ts
```

It is a stdio MCP server, so a quiet process is expected while it waits for MCP
messages. Stop it with `Ctrl-C` or `SIGTERM`. For an automated MCP health check,
run `pnpm test -- tests/mcp-artifact-create.test.ts`.

### OpenClaw Gateway

Run the Gateway from the pinned source checkout with the school-claw checkout as
the working directory so repo-relative config paths resolve correctly:

```bash
cd "$REPO_ROOT"
OPENCLAW_CONFIG_PATH="$REPO_ROOT/integrations/openclaw/claw-agent.openclaw.json" \
  node --import "$OPENCLAW_CHECKOUT/node_modules/tsx/dist/esm/index.mjs" \
  "$OPENCLAW_CHECKOUT/src/entry.ts" gateway \
  --bind auto \
  --port "$OPENCLAW_GATEWAY_PORT" \
  --token "$OPENCLAW_GATEWAY_TOKEN" \
  --verbose
```

Do not use `--allow-unconfigured` for pilot startup. The Gateway must fail
closed if the reviewed CLAW config path is missing or invalid. The reviewed
pilot config sets `gateway.mode=local` and `gateway.bind=auto`, so a missing or
damaged config should block startup instead of falling back to unconfigured
mode. The token is mandatory on the documented startup path; `auto` keeps normal
host runs on the local loopback path while still allowing an explicitly tokened
container or port-forward environment to bind successfully.

Stop a foreground Gateway with `Ctrl-C`. If it is supervised by a service
manager, send `SIGTERM` through that manager. For a coordinated restart of a
running Gateway, prefer:

```bash
node --import "$OPENCLAW_CHECKOUT/node_modules/tsx/dist/esm/index.mjs" \
  "$OPENCLAW_CHECKOUT/src/entry.ts" gateway restart --safe
```

Use `gateway restart --safe --skip-deferral` only when a safe restart is stuck
behind a known stale blocker. Use `--force` only as an operator-declared
emergency action, then run the smoke and live platform checks again.

## Health And Logs

After the Gateway starts, check readiness and logs:

```bash
node --import "$OPENCLAW_CHECKOUT/node_modules/tsx/dist/esm/index.mjs" \
  "$OPENCLAW_CHECKOUT/src/entry.ts" health --verbose

node --import "$OPENCLAW_CHECKOUT/node_modules/tsx/dist/esm/index.mjs" \
  "$OPENCLAW_CHECKOUT/src/entry.ts" gateway probe \
  --url "ws://127.0.0.1:$OPENCLAW_GATEWAY_PORT" \
  --token "$OPENCLAW_GATEWAY_TOKEN" \
  --timeout 30000

node --import "$OPENCLAW_CHECKOUT/node_modules/tsx/dist/esm/index.mjs" \
  "$OPENCLAW_CHECKOUT/src/entry.ts" gateway health \
  --url "ws://127.0.0.1:$OPENCLAW_GATEWAY_PORT" \
  --token "$OPENCLAW_GATEWAY_TOKEN" \
  --timeout 120000 \
  --json

node --import "$OPENCLAW_CHECKOUT/node_modules/tsx/dist/esm/index.mjs" \
  "$OPENCLAW_CHECKOUT/src/entry.ts" logs --follow --local-time
```

If RPC log tailing is unavailable, inspect the local file log:

```bash
ls -lt /tmp/openclaw/openclaw-*.log | head
tail -n 200 "/tmp/openclaw/openclaw-$(date +%F).log"
```

For restart or fatal-exit diagnosis, inspect stability data:

```bash
node --import "$OPENCLAW_CHECKOUT/node_modules/tsx/dist/esm/index.mjs" \
  "$OPENCLAW_CHECKOUT/src/entry.ts" gateway stability --bundle latest
```

## Security Checklist

Run this checklist before pilot traffic starts.

- Config validation passes through the pinned OpenClaw source CLI.
- `pnpm test -- tests/openclaw-agent-workspace-config.test.ts` passes and proves
  `claw-agent` allows only the reviewed CLAW-native tools
  `claw__scope_get`, `claw__files_read`, `claw__files_read_all`,
  `claw__files_list`, `claw__files_append`, `claw__artifact_create`,
  `message`, and `session_status`, and denies risky native tool groups
  including `group:fs`, `group:runtime`, `group:ui`, `group:automation`,
  `group:agents`, `read`, `write`, `edit`, `apply_patch`, `exec`, `process`,
  `browser`, `gateway`, `cron`, `sessions_spawn`, `sessions_yield`,
  `subagents`, `session_spawn`, and `agent_send`.
- `pnpm test -- tests/scope-bridge.test.ts` passes and proves forged model
  `ssid` values are overwritten with the trusted OpenClaw `sessionKey`.
- `pnpm test -- tests/scope-get.test.ts tests/scoped-read.test.ts` passes and
  proves parent sessions resolve to different students and cross-student reads
  fail.
- `pnpm test -- tests/write-audit.test.ts tests/artifact.test.ts tests/mcp-artifact-create.test.ts`
  passes and proves successful writes/artifacts have audit records while
  forbidden writes/artifacts do not create success audit entries.
- `pnpm test -- tests/openclaw-read-loop.test.ts tests/sedimentation-loop.test.ts tests/claw-agent-capability-harness.test.ts`
  passes or skips only for explicit OpenClaw Pi Runtime availability guards.
- Live platform smoke from architecture section 15.5 is recorded: private chat
  entry works, peer id is stable, sessionKey is stable across repeated messages
  and Gateway restart, replies are delivered, and two parent accounts do not
  share context.

## Audit Review

Review audit files before and after each pilot session.

```bash
export CLAW_DATA_DIR="$REPO_ROOT/claw-data"
find "$CLAW_DATA_DIR/audit" -type f -name '*.md' | sort
rg -n "audit_id:|actor_ssid_hash:|role:|action:|target_file_ids:|summary:" \
  "$CLAW_DATA_DIR/audit"
```

Expected successful actions include `files_append`, `files_write`,
`artifact_create`, and explicit `audit_log` entries. Investigate any write or
artifact that lacks a matching audit entry immediately. Denied operations should
not create success audit entries; confirm suspected denials with the relevant
Gateway log window and rerun the security checklist.

Useful focused views:

```bash
rg -n "action: (files_append|files_write|artifact_create|audit_log)" "$CLAW_DATA_DIR/audit"
rg -n "role: parent|target_file_ids:" "$CLAW_DATA_DIR/audit"
rg -n "FORBIDDEN|UNBOUND_SESSION|SESSION_DISABLED|TOOL_ERROR" /tmp/openclaw/openclaw-*.log
```

## Backup And Restore

Back up before each pilot session, after each pilot session, and before any
registry edit.

```bash
umask 077
export BACKUP_ROOT="$HOME/claw-backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"
tar --create --gzip --file "$BACKUP_ROOT/claw-data.tgz" -C "$REPO_ROOT" claw-data
shasum -a 256 "$BACKUP_ROOT/claw-data.tgz" > "$BACKUP_ROOT/SHA256SUMS"
chmod 600 "$BACKUP_ROOT/claw-data.tgz" "$BACKUP_ROOT/SHA256SUMS"
```

This archive contains Markdown learning archives, registry data, artifacts, and
audit files. Keep backups on an encrypted local disk or an access-controlled
remote backup target; do not place them in shared folders, shared buckets, or
unencrypted removable storage. If the pilot needs OpenClaw conversation
continuity after machine loss, also back up the Gateway session directory:

```bash
tar --create --gzip --file "$BACKUP_ROOT/openclaw-sessions.tgz" \
  -C "${OPENCLAW_STATE_DIR:-$HOME/.openclaw}" agents/claw-agent/sessions
chmod 600 "$BACKUP_ROOT/openclaw-sessions.tgz"
```

Restore only while the Gateway is stopped. Verify the backup before touching
live data, extract to scratch first, then swap:

```bash
cd "$REPO_ROOT"
umask 077
shasum -a 256 --check "$BACKUP_ROOT/SHA256SUMS"

export RESTORE_SCRATCH="$REPO_ROOT/.scratch/restore-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RESTORE_SCRATCH"
chmod 700 "$RESTORE_SCRATCH"
tar --extract --gzip --file "$BACKUP_ROOT/claw-data.tgz" -C "$RESTORE_SCRATCH"
chmod -R go-rwx "$RESTORE_SCRATCH"
test -d "$RESTORE_SCRATCH/claw-data/registry"
test -d "$RESTORE_SCRATCH/claw-data/classes"
test -d "$RESTORE_SCRATCH/claw-data/audit"

export PRE_RESTORE="$REPO_ROOT/claw-data.pre-restore.$(date -u +%Y%m%dT%H%M%SZ)"
mv "$REPO_ROOT/claw-data" "$PRE_RESTORE"
mv "$RESTORE_SCRATCH/claw-data" "$REPO_ROOT/claw-data"
chmod -R go-rwx "$REPO_ROOT/claw-data"
pnpm pilot:smoke
```

If `pnpm pilot:smoke` fails after the swap, keep the Gateway stopped, preserve
the failed restore for inspection, and roll back:

```bash
export FAILED_RESTORE="$REPO_ROOT/claw-data.failed-restore.$(date -u +%Y%m%dT%H%M%SZ)"
mv "$REPO_ROOT/claw-data" "$FAILED_RESTORE"
chmod -R go-rwx "$FAILED_RESTORE"
mv "$PRE_RESTORE" "$REPO_ROOT/claw-data"
chmod -R go-rwx "$REPO_ROOT/claw-data"
pnpm pilot:smoke
```

For a restore drill, stop before the swap and inspect the scratch
`registry/`, `classes/`, and `audit/` directories.

## Failure Modes

### Tool Failure

Symptoms: Gateway replies mention tool failure, MCP child exits, or tests report
`TOOL_ERROR`.

Actions:

- Confirm `$REPO_ROOT/claw-data` exists and includes `registry/`, `classes/`,
  and `audit/`.
- Run `pnpm test -- tests/mcp-artifact-create.test.ts`.
- Check `/tmp/openclaw/openclaw-YYYY-MM-DD.log` for the MCP child command,
  `CLAW_DATA_DIR`, and stack trace.
- Do not grant native file tools as a workaround. Fix the CLAW MCP path or data
  root instead.

### Forbidden Access

Symptoms: a parent asks for another student, a class-identifiable comparison, or
a disabled/unbound session attempts access.

Actions:

- Treat `FORBIDDEN`, `UNBOUND_SESSION`, and `SESSION_DISABLED` as safe failures
  unless the user journey expected access.
- Confirm no success audit entry was written for the denied action.
- Run `pnpm test -- tests/scope-bridge.test.ts tests/scoped-read.test.ts`.
- If a real parent can see another child, stop the pilot, preserve logs and
  audit files, and do not resume until scope registry and bridge behavior are
  fixed.

### Platform Disconnect

Symptoms: native platform stops delivering messages, peer id changes, replies
do not send, or the channel plugin reports auth/network errors.

Actions:

- Run `health --verbose` and `logs --follow --local-time`.
- Confirm the channel plugin credentials and platform webhook/socket status.
- Do not convert platform peer id into authorization. Rebinding must update the
  CLAW registry intentionally after identity is verified.
- If invite-token behavior is unavailable, use the one-time authorization-code
  binding path from the issue 0012 platform record.

### Gateway Restart

Symptoms: operator restart, crash recovery, or config hot reload issue.

Actions:

- Prefer `gateway restart --safe`.
- After restart, run `health --verbose`.
- Send a live parent account message and confirm the OpenClaw sessionKey remains
  stable.
- Confirm the parent still reads only their own child and that new writes produce
  audit entries.
- If sessionKey changes unexpectedly, pause pilot traffic and update registry
  bindings only after identity verification.

## Live Platform Smoke Record

Issue 0013 does not fake the HITL platform evidence from issue 0012. Before a
real pilot, record this table in the pilot handoff:

| Check | Result | Evidence |
| --- | --- | --- |
| Candidate channel/plugin selected |  |  |
| Account A can private-chat bot |  |  |
| Account B can private-chat bot |  |  |
| Account A sessionKey stable across repeated messages |  |  |
| Account A sessionKey stable across Gateway restart |  |  |
| Account A and B sessionKeys differ |  |  |
| Bot replies arrive in private chat |  |  |
| Parent A cannot read Parent B student |  |  |
| Backup completed before pilot |  |  |
| Audit review completed after pilot |  |  |

# Pilot operations and safety loop

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/development/openclaw-baseline.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 15.5, 16, 18, and 19.
- Project summary: A pilot needs more than feature demos. The operator needs startup, restart, smoke tests, logs, audit review, backup/restore, and security checks.
- Capability: pilot operational closure.
- Non-negotiables: no undocumented production start path, no missing audit review, no broad native tools, no pilot without isolation smoke tests.
- Expected handoff result: a reviewer can start/restart CLAW, run smoke tests, inspect audit/logs, and restore data from backup.

## Closed-loop acceptance target

Reviewer can follow the runbook and complete:

```text
start system
run smoke suite
inspect logs and audit
restart Gateway
verify session/data continuity
backup claw-data
restore backup in test location
rerun smoke suite
```

## What to build

Create the pilot runbook, smoke suite, backup/restore procedure, logging/audit inspection commands, and security checklist.

## Acceptance criteria

- [ ] Runbook explains how to start and stop OpenClaw Gateway plus CLAW MCP Server.
- [ ] Smoke suite covers parent read, forbidden access, append/audit, artifact, and teacher class artifact.
- [ ] Restart check verifies session/data continuity.
- [ ] Audit review command or procedure exists.
- [ ] Backup/restore procedure exists and is verified in a test location.
- [ ] Security checklist verifies native risky tools are denied.
- [ ] Failure modes include tool failure, forbidden access, platform disconnect, and Gateway restart.

## Blocked by

- DRAFT-0009 Teacher class artifact loop.
- DRAFT-0010 Native platform binding loop.

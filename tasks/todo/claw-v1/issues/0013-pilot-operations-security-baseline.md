# Prepare pilot operations and security baseline

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `CONTEXT.md`, `docs/development/openclaw-baseline.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 15.5, 16, 18, and 19.
- Project summary: Once capabilities work locally and on a native platform, the pilot needs operational controls: startup, config safety, logs, audit review, backup, and incident checks.
- Capability: make CLAW v1 operable for a small real-class pilot.
- Non-negotiables: no silent production config changes, no broad native tools, no missing audit review path, and no undocumented restart/recovery process.
- Expected handoff result: a pilot operator can start, inspect, troubleshoot, and safely stop CLAW v1.

## What to build

Create the pilot operations baseline: runbook, environment variables, local/remote data locations, startup commands, health checks, log locations, audit review commands, backup/restore notes, and security checklist.

## Acceptance criteria

- [ ] Runbook explains how to start and stop the OpenClaw Gateway plus CLAW MCP Server.
- [ ] Runbook explains where `claw-data`, OpenClaw workspace, logs, sessions, and audit files live.
- [ ] Security checklist verifies native risky tools are denied.
- [ ] Security checklist verifies parent isolation tests pass before pilot.
- [ ] Audit review command or procedure exists.
- [ ] Backup/restore procedure exists for Markdown learning archives and registry data.
- [ ] Failure modes include tool failure, forbidden access, platform disconnect, and Gateway restart.
- [ ] Relevant smoke checks pass.

## Blocked by

- DRAFT-0011 local OpenClaw capability harness.
- DRAFT-0012 native platform binding spike.

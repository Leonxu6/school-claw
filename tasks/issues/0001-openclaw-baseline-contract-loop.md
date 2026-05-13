# OpenClaw baseline contract loop

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 4, 5, 9, 10, 15, 16, 19, and 20.
- External source: `https://github.com/openclaw/openclaw` and `https://docs.openclaw.ai`.
- Project summary: CLAW v1 is built on OpenClaw. OpenClaw owns Gateway routing, sessions, Pi Runtime, model/tool loop, plugin hooks, and MCP materialization. school-claw must pin and verify those contracts before building on them.
- Capability: OpenClaw source baseline and contract verification.
- Non-negotiables: do not implement CLAW app behavior here; do not rely on architecture assumptions without verifying current OpenClaw source; record discrepancies.
- Expected handoff result: future agents know exactly which OpenClaw checkout/commit and source files define CLAW integration contracts.

## Closed-loop acceptance target

Reviewer can run one documented command that verifies:

```text
OpenClaw source exists
  -> commit hash is pinned
  -> required contract files/docs are present
  -> baseline report is generated
```

## What to build

Identify or clone the official OpenClaw source as a sibling checkout, preferably `/Users/leon/openclaw`. Add a baseline document and a verification script/command in school-claw.

## Acceptance criteria

- [x] Official OpenClaw source is available locally or an existing checkout is identified.
- [x] Exact upstream URL and commit hash are recorded.
- [x] `docs/development/openclaw-baseline.md` maps session routing, `session.dmScope`, `sessionKey`, Pi Runtime, bundle MCP materialization, MCP tool naming, plugin hooks, tool profile/deny config, and native tool security.
- [x] A verification command exists, for example `npm run verify:openclaw-baseline` or a documented equivalent.
- [x] Verification fails if required source/docs paths are missing.
- [x] Any mismatch between current OpenClaw source and the tech design is explicitly recorded.

## Completion evidence

Landed on `main` through PR #2. Reviewer can run:

```text
./scripts/verify-openclaw-baseline.sh
```

## Blocked by

None - can start immediately.

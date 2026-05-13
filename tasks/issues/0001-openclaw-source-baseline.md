# Pin and document the OpenClaw source baseline

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 4, 5, 9, 10, 15, 16, 19, and 20.
- External source to verify: `https://github.com/openclaw/openclaw` and `https://docs.openclaw.ai`.
- Project summary: CLAW v1 is built on OpenClaw. OpenClaw owns Gateway routing, sessions, Pi Runtime, model/tool loop, plugin hooks, and MCP materialization. school-claw must not guess these APIs.
- Capability: establish the OpenClaw source checkout and runtime contract baseline for all later work.
- Non-negotiables: do not implement CLAW app behavior here, do not vendor random source without recording provenance, and do not rely on stale architecture assumptions if the current OpenClaw source contradicts them.
- Expected handoff result: future agents know exactly where OpenClaw source is, which commit is pinned, which files define CLAW integration contracts, and which commands verify the baseline.

## What to build

Create the OpenClaw source baseline for this repo. If the source is not already available, clone the official upstream repo as a sibling checkout, preferably `/Users/leon/openclaw`. Record the upstream URL, commit hash, install/test commands, and the specific source/docs paths that define the contracts CLAW depends on.

Write the result into a durable repo document such as `docs/development/openclaw-baseline.md`.

## Acceptance criteria

- [x] Official OpenClaw source is available locally or an existing local checkout is identified.
- [x] The exact upstream URL and commit hash are recorded.
- [x] The baseline document maps the relevant OpenClaw contracts: session routing, `session.dmScope`, `sessionKey`, Pi Runtime, bundle MCP materialization, MCP tool naming, plugin hooks, tool profile/deny config, and native tool security.
- [x] The document names the OpenClaw source files and docs that future tasks should read before touching those integration points.
- [x] The document includes commands to install dependencies and run the smallest useful OpenClaw tests or checks.
- [x] A closed-loop verification command exists and fails if required OpenClaw source/docs paths are missing.
- [x] If any architecture document assumption is stale, the discrepancy is explicitly recorded rather than silently papered over.

## Blocked by

None - can start immediately.

# Create the school-claw development skeleton

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/development/openclaw-baseline.md`, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 5, 8, 9, 15, and 19.
- Project summary: school-claw will contain CLAW-owned code: MCP Server, Scope Bridge Plugin, agent workspace/config, Markdown data helpers, tests, and docs. OpenClaw source remains the upstream runtime baseline.
- Capability: establish a minimal, testable codebase structure aligned with OpenClaw's TypeScript/runtime conventions.
- Non-negotiables: start from tests, keep the scaffold minimal, do not invent unrelated product code, and make commands obvious for fresh agents.
- Expected handoff result: a fresh agent can run install/test commands and see a deliberate skeleton ready for capability implementation.

## What to build

Create the minimal project scaffold needed to develop CLAW capabilities. Use the OpenClaw baseline to choose compatible tooling. Add package metadata, TypeScript/test configuration, source directories, fixture directories, and documented commands.

## Acceptance criteria

- [ ] A package/test scaffold exists and matches the runtime language/tooling chosen from the OpenClaw baseline.
- [ ] Source directories make ownership clear: data store, scope, MCP server, OpenClaw plugin, agent config/workspace, tests/fixtures.
- [ ] `npm test` or the chosen equivalent runs and passes with at least one placeholder or contract test.
- [ ] The scaffold includes no fake scenario implementation.
- [ ] The README or dev docs explain how to install, test, and where to add each capability.
- [ ] All generated files are intentionally scoped to school-claw.

## Blocked by

- DRAFT-0001 OpenClaw source baseline.

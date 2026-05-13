# Run the local OpenClaw capability harness

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/development/openclaw-baseline.md`, `docs/development/CLAW_v1_development_plan.md`, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 12, 15, and 18.
- Project summary: By this point, school-claw should have reusable capabilities. This issue proves them through acceptance scenarios without hard-coding those scenarios into implementation.
- Capability: local integration harness that runs OpenClaw + CLAW MCP + Scope Bridge + one `claw-agent` against fixture data.
- Non-negotiables: scenarios are tests only, no scenario-specific application code, all failures should point to missing general capability, and tests must cover forbidden access.
- Expected handoff result: a local command proves the end-to-end CLAW capability set against representative parent and teacher interactions.

## What to build

Create a local harness using OpenClaw's QA channel, test channel, CLI, or the smallest source-supported equivalent. It should run the configured `claw-agent`, the CLAW MCP Server, Scope Bridge, and fixture data.

## Acceptance criteria

- [ ] A single documented command runs the local capability harness.
- [ ] Harness verifies parent scope reads only the parent's own child archive.
- [ ] Harness verifies parent observations can be appended and later read.
- [ ] Harness verifies teacher scope can read class-level learning state.
- [ ] Harness verifies artifact creation through primitive tools.
- [ ] Harness verifies parent attempts to access another student or class-identifiable data are refused.
- [ ] Harness verifies write operations produce audit records.
- [ ] Harness verifies no implementation path depends on scenario-specific tool names.
- [ ] Relevant integration tests pass.

## Blocked by

- DRAFT-0007 CLAW MCP primitive tools.
- DRAFT-0008 Scope Bridge Plugin.
- DRAFT-0009 one-agent OpenClaw workspace and tool policy.
- DRAFT-0010 claw-agent capability prompt contract.

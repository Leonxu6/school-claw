# Write the claw-agent capability prompt contract

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 6-13, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 11, 12, 14, 16.4, and 19.
- Project summary: `claw-agent` should have general education-agent behavior. It reads scope, reads evidence, decides whether to append durable facts, creates artifacts, and refuses overreach. It should not be prompted as a bag of hard-coded scenarios.
- Capability: define the reusable behavior contract for the single agent.
- Non-negotiables: no scenario-specific tool names, no fabricated student history, no prompt-only permission claims, and no medical/psychological diagnosis.
- Expected handoff result: an agent prompt/workspace contract that teaches general capabilities and can be evaluated by the capability harness.

## What to build

Write the agent behavior prompt and any supporting workspace docs needed by OpenClaw. The prompt should define rules for scope use, evidence reading, information sedimentation, artifact generation, refusal, uncertainty, teacher tone, and parent tone.

## Acceptance criteria

- [x] Prompt instructs the agent to establish scope before reading or writing.
- [x] Prompt requires evidence reads before factual answers about student history.
- [x] Prompt distinguishes durable learning facts from ordinary chat.
- [x] Prompt explains when to append observations and when not to write.
- [x] Prompt requires generated outputs to use `artifact_create` where appropriate.
- [x] Prompt clearly refuses parent access to other students or class-identifiable data.
- [x] Prompt preserves teacher and parent tone differences from the PRD.
- [x] Prompt does not introduce task-specific tools or fake capabilities.
- [x] Prompt review notes explain how each rule maps to PRD/architecture requirements.

## Blocked by

- DRAFT-0007 CLAW MCP primitive tools.
- DRAFT-0009 one-agent OpenClaw workspace and tool policy.

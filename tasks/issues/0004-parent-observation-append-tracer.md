# Record a parent learning observation into the student archive

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 6.3-6.4, 8.4, 9.2, 10.1-10.2, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 8, 9.5, 11, 12.2, 14.1, and 15.1-15.2.
- Project summary: Parents can add durable learning evidence by naturally reporting a child's mistake, cause, habit, or state. The agent decides whether the message is worth saving, but the MCP Server owns the actual scoped write and audit record.
- Non-negotiables: append only to the parent's own child, do not save ordinary chat, preserve existing Markdown content, create audit logs, and begin with a failing test.
- Expected handoff result: a parent message becomes a durable, auditable learning observation that later reads can cite.

## What to build

Allow a parent to naturally report a learning fact, such as a child-reported wrong question or mistake cause. The agent should decide that the message is worth preserving, append it to the correct child archive through CLAW MCP, write an audit record, and reply with a short confirmation or useful follow-up.

## Acceptance criteria

- [ ] A failing test exists first for a parent saying a child got a specific question wrong with a stated cause.
- [ ] The message is classified as a durable learning observation, not ordinary chat.
- [ ] The observation is appended under the parent's own child scope only.
- [ ] The append preserves existing content and uses safe write behavior.
- [ ] The written record includes useful front matter such as source role, source session hash, subject or knowledge point when known, and timestamp.
- [ ] An audit record is created for the write.
- [ ] A later parent read can reference the appended observation.
- [ ] Relevant unit and integration tests pass.

## Blocked by

- DRAFT-0002 parent scoped-read tracer.
- DRAFT-0003 scope bridge and permission fail-closed.

# Build safe Markdown write and audit core

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `CONTEXT.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 8.4, 9.5-9.8, 15.1-15.2, 16.3, and 16.4.
- Project summary: CLAW writes long-term student learning evidence and generated artifacts. Writes must be safe, auditable, and scoped.
- Capability: atomic append/write operations and audit log generation that MCP tools can reuse.
- Non-negotiables: tests first, no silent overwrite of long-term records, no write without permission guard, no write without audit.
- Expected handoff result: reusable write/audit primitives with concurrency and preservation tests.

## What to build

Implement safe append and controlled write helpers for Markdown archive files. Use locking and atomic rename where appropriate. Generate audit entries for every write or artifact operation.

## Acceptance criteria

- [ ] Failing tests exist first for append preserving existing content, concurrent appends not losing records, and audit creation.
- [ ] Append-only paths preserve prior content.
- [ ] Controlled write supports create/replace only where explicitly allowed.
- [ ] Writes use temporary file + atomic rename or an equivalent safe strategy.
- [ ] Same-file writes are serialized.
- [ ] Every successful write returns or records an audit ID.
- [ ] Audit records include actor scope hash, action, target file IDs, timestamp, and summary.
- [ ] Relevant tests pass.

## Blocked by

- DRAFT-0004 Markdown learning archive core.
- DRAFT-0005 SessionScope resolver and file permission core.

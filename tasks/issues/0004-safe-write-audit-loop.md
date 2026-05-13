# Safe write and audit loop

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 8.4, 9.5-9.8, 12.2, 14.1, 15.1-15.2, 16.3, and 16.4.
- Project summary: CLAW stores durable learning evidence in Markdown. Writes must be scoped, safe, append-friendly, and auditable.
- Capability: scoped append/write + audit trail.
- Non-negotiables: no write without scope guard, no write without audit, no broad overwrite of long-term records, tests first.
- Expected handoff result: a parent or teacher scoped write changes the correct Markdown file and creates a verifiable audit record.

## Closed-loop acceptance target

Reviewer can run:

```text
npm test -- write-audit
npm run demo:write-audit
```

and observe:

```text
append observation -> file content grows
read same file -> new record visible
audit log -> matching auditId/action/target exists
forbidden append -> no file change and no success audit
```

## What to build

Implement `files_append`, controlled `files_write`, same-file locking or equivalent serialization, atomic write behavior, and audit logging.

## Acceptance criteria

- [ ] Tests are written first for append preservation, forbidden write, concurrent same-file append, and audit creation.
- [ ] Append preserves existing Markdown content.
- [ ] Controlled write supports only explicit create/replace modes.
- [ ] Writes use temporary file + atomic rename or equivalent safe behavior.
- [ ] Same-file writes do not lose content.
- [ ] Every successful write creates an audit entry.
- [ ] Read-back verifies the new content and matching audit record.

## Blocked by

- DRAFT-0003 Scoped Markdown read loop.

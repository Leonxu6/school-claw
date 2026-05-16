# Expose CLAW MCP primitive tools

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `CONTEXT.md`, `docs/development/openclaw-baseline.md`, and `docs/architecture/CLAW_v1_technical_architecture.md` section 9.
- Project summary: CLAW exposes primitive MCP tools. The agent composes these tools into education tasks; the tools themselves should not be scenario-specific.
- Capability: provide the complete v1 MCP surface backed by scope, archive, permission, write, artifact, and audit modules.
- Non-negotiables: no task tools like `generate_practice`, no trusting model-supplied `ssid`, no arbitrary paths, and schema tests first.
- Expected handoff result: a testable MCP server exposing the v1 primitive tools with clear error codes.

## What to build

Implement the CLAW MCP Server and primitive tools:

- `scope_get`
- `files_list`
- `files_read`
- `files_read_all`
- `files_append`
- `files_write`
- `artifact_create`
- `audit_log`

## Acceptance criteria

- [ ] Tool schema tests are written first.
- [ ] Each tool accepts optional `ssid` but treats it as injected context, not trusted user authority.
- [ ] `scope_get` returns only safe display scope fields.
- [ ] File tools enforce `SessionScope` and file ID guards.
- [ ] Read-all tools enforce bounded file count and total character limits.
- [ ] Append/write/artifact tools create audit records.
- [ ] Errors include `UNBOUND_SESSION`, `SESSION_DISABLED`, `FORBIDDEN`, `NOT_FOUND`, and `TOO_LARGE` where appropriate.
- [ ] MCP server can run locally in a deterministic test mode.
- [ ] Relevant unit and integration tests pass.

## Blocked by

- DRAFT-0005 SessionScope resolver and file permission core.
- DRAFT-0006 safe Markdown write and audit core.

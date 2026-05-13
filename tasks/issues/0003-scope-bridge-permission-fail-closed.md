# Make scope injection and permission failures fail closed

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 4.7, 7, 8.3, 9, 12.6, 15.1-15.2, and 16.1.
- Project summary: The model may be wrong or maliciously steered, so authorization must live in the Scope Bridge plus CLAW MCP Server. `sessionKey`/`ssid` selects scope; it is not proof of identity by itself.
- Non-negotiables: fail closed, overwrite forged `ssid`, reject unsafe file IDs, never leak forbidden content in errors, and write tests before implementation.
- Expected handoff result: permission tests that prove parent isolation even when the model passes another session or file target.

## What to build

Make the permission boundary enforceable even when the model or user tries to provide a forged `ssid` or a forbidden file target. The Scope Bridge must inject the true session `ssid`, and the MCP Server must reject forbidden reads and unsafe file IDs.

## Acceptance criteria

- [ ] A failing test exists first for a forged parent `ssid` attempting to read another student's file.
- [ ] `before_tool_call` injects the real session `ssid` for CLAW MCP tools.
- [ ] A model-provided `ssid` is overwritten, not trusted.
- [ ] Missing session context fails closed.
- [ ] Parent scope cannot list class roots or another student's files.
- [ ] Path traversal, absolute paths, and symlink escape attempts are rejected.
- [ ] Forbidden requests return a clear `FORBIDDEN` style error and do not leak file contents.
- [ ] Relevant unit and integration tests pass.

## Blocked by

- DRAFT-0002 parent scoped-read tracer.

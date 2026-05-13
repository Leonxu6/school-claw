# Run a parent scoped-read tracer through one `claw-agent`

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 5, 7, 8, 9.1-9.4, 11, 12.1, and 15.1-15.2.
- Project summary: CLAW v1 has one `claw-agent`. Parents and teachers are sessions with different `SessionScope` permissions. The Markdown file database is the v1 source of truth, and all education data must be read through CLAW MCP primitives.
- Non-negotiables: start with a failing test, keep this slice minimal, do not implement teacher flows here, do not expose `claw-data` through native file tools, and do not rely on prompt-only permissions.
- Expected handoff result: a runnable local tracer proving a parent session can read only its own child's records and produce an evidence-based response.

## What to build

Build the smallest runnable tracer where a bound parent session asks about their own child, the single `claw-agent` resolves scope, reads only the child's visible Markdown records through CLAW MCP primitives, and replies using evidence from those records.

This is the first development slice and should establish the minimal project skeleton needed for tests, fixtures, the Markdown file database, MCP tool surface, and the agent/runtime harness.

## Acceptance criteria

- [ ] A failing test or smoke case exists first for a parent asking "我孩子今天怎么样？".
- [ ] Fixture data includes one class, at least two students, at least two parent sessions, and one teacher session.
- [ ] `scope_get` resolves a parent `SessionScope` with only that parent's child.
- [ ] `files_list` and `files_read` return only files inside the parent's allowed roots.
- [ ] The tracer reply cites or summarizes the child's own record instead of hallucinating history.
- [ ] The implementation does not expose `claw-data` through native file tools.
- [ ] Relevant unit and integration tests pass.

## Blocked by

None - can start immediately.

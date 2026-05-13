# Scoped Markdown read loop

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 7, 8, 9.2-9.4, 12.1, 12.6, 15.1-15.2, and 16.1.
- Project summary: The Markdown file database is the v1 source of truth. Reads must pass through `SessionScope` and file guards.
- Capability: scoped file listing/reading from Markdown archive.
- Non-negotiables: no writes yet, no agent prompt behavior, no arbitrary paths, no prompt-only permission enforcement.
- Expected handoff result: parent can read only own child files; teacher can read class files; forbidden reads fail without leaking content.

## Closed-loop acceptance target

Reviewer can run:

```text
npm test -- scoped-read
npm run demo:scoped-read
```

and observe:

```text
parent A reads student A -> OK
parent A reads student B -> FORBIDDEN
teacher reads class -> OK
fileId "../..." -> FORBIDDEN
```

## What to build

Add Markdown archive fixtures, front matter helpers, file ID resolver, read roots, and `files_list` / `files_read` behavior behind `SessionScope`.

## Acceptance criteria

- [ ] Tests are written first for allowed parent read, forbidden parent cross-read, teacher class read, path traversal, absolute path, and missing file.
- [ ] Archive fixtures include profile, timeline/errors/observations, and public class files.
- [ ] `files_list` returns only visible file IDs for the current scope.
- [ ] `files_list` applies `dateFrom`, `dateTo`, and `query` filters instead of silently widening results.
- [ ] `files_list` and `files_read` reject symlink escapes before parsing Markdown front matter, title, excerpt, or content.
- [ ] `files_read` returns front matter and content for allowed files.
- [ ] File guard rejects `..`, absolute paths, and escape attempts.
- [ ] Forbidden and missing reads return explicit errors without content leakage.
- [ ] Demo output proves the loop end to end.

## Blocked by

- DRAFT-0002 Local CLAW scope harness loop.

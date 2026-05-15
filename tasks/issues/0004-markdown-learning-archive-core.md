# Build Markdown learning archive fixtures and schema helpers

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 6, 10, and 15.3, plus `docs/architecture/CLAW_v1_technical_architecture.md` section 8.
- Project summary: The Markdown file database is CLAW v1's source of truth. It stores class data, student learning archives, observations, artifacts, registry records, and audit logs.
- Capability: create the durable archive structure and schema helpers that all MCP tools will use.
- Non-negotiables: no model/agent behavior here, no arbitrary absolute paths, no scenario-specific files beyond representative fixtures, and repeatable verification checks.
- Expected handoff result: a reusable Markdown archive module with fixtures for one class, two students, two parents, and one teacher.

## What to build

Implement the core Markdown archive structure and helpers: front matter parsing/stringifying, fixture generation, file ID conventions, archive kinds, and basic read-only loading utilities.

## Acceptance criteria

- [ ] Parsing and loading representative archive files are covered by repeatable checks.
- [ ] Fixtures include one class, two students, two parent registry entries, one teacher registry entry, and session registry records.
- [ ] Student archives include profile, knowledge, timeline/errors/observations, and artifacts directories or equivalents from the architecture.
- [ ] Front matter round-trips without dropping required fields.
- [ ] Helpers use relative `fileId` values, not absolute paths.
- [ ] The module does not yet decide whether a caller is allowed to access a file; that belongs to `SessionScope` and permission core.
- [ ] Relevant tests pass.

## Blocked by

- DRAFT-0002 school-claw development skeleton.

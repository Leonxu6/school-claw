# Artifact primitive loop

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 10.5 and 11, plus `docs/architecture/CLAW_v1_technical_architecture.md` sections 9.4, 9.7, 14.4, and 15.2.
- Project summary: Generated outputs are artifacts saved through CLAW MCP. Artifact creation is a primitive capability; practice, feedback, summaries, and error tables are artifact types, not separate hard-coded tools.
- Capability: scoped artifact creation from scoped source reads.
- Non-negotiables: no scenario-specific generation logic, no artifact outside write roots, no artifact without source/audit metadata.
- Expected handoff result: a caller can create a scoped artifact, read it back, and see its audit/source record.

## Closed-loop acceptance target

Reviewer can run:

```text
npm test -- artifact
npm run demo:artifact
```

and observe:

```text
read scoped source docs -> create artifact -> artifact file exists -> audit exists -> read artifact succeeds
parent creating artifact for other student -> FORBIDDEN
```

## What to build

Implement `files_read_all` limits and `artifact_create` backed by the archive/write/audit core. Use representative artifact types from the tech design.

## Acceptance criteria

- [ ] Tests are written first for artifact create, read-back, source file references, audit, size limits, and forbidden target.
- [ ] `files_read_all` enforces `maxFiles` and `maxTotalChars`.
- [ ] `artifact_create` writes front matter with artifact type, creator scope hash, class/student where applicable, source file IDs, and timestamp.
- [ ] Artifact file ID is returned and readable by the allowed scope.
- [ ] Forbidden artifact creation does not write a file.
- [ ] Demo output proves source -> artifact -> audit -> read-back.

## Blocked by

- DRAFT-0004 Safe write and audit loop.

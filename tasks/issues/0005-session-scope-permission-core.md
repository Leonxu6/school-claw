# Build SessionScope resolver and file permission core

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `CONTEXT.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 7, 8.3, 9.1-9.4, 12.6, 15.1, 16.1, and 19.
- Project summary: `SessionScope` is the bridge between OpenClaw `ssid` and CLAW data permissions. It decides role, status, readable roots, writable roots, student IDs, and capabilities.
- Capability: enforce the permission model independently from the agent prompt.
- Non-negotiables: fail closed, reject unsafe paths, never trust model-provided paths or scopes, and define security behavior plus verification checks before implementation.
- Expected handoff result: a tested permission core that can answer "what can this ssid read/write?" without any agent involvement.

## What to build

Implement `SessionScope` resolution from registry data plus file ID permission checks. The guard should normalize paths, reject traversal, reject absolute paths, detect symlink escape where possible, and verify read/write roots.

## Acceptance criteria

- [ ] Unbound session, disabled session, parent reading another child, path traversal, absolute path, and teacher class access are covered by repeatable security checks.
- [ ] `resolveScope(ssid)` returns active parent and teacher scopes from fixtures.
- [ ] Unknown `ssid` returns `UNBOUND_SESSION`.
- [ ] Disabled scope returns `SESSION_DISABLED`.
- [ ] Parent scope can access only its own child and allowed public roots.
- [ ] Teacher scope can access the class root.
- [ ] File ID guard rejects `..`, absolute paths, and escape attempts.
- [ ] Error responses do not leak forbidden file contents.
- [ ] Relevant tests pass.

## Blocked by

- DRAFT-0003 OpenClaw sessionKey to CLAW ssid contract.
- DRAFT-0004 Markdown learning archive core.

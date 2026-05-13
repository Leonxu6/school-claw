# Teacher class artifact loop

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/product/CLAW_v1_product_prd.md` sections 7.2.2-7.2.3, 9.4-9.5, 10.3-10.6, and 12, plus `docs/architecture/CLAW_v1_technical_architecture.md` sections 12.5, 14.3, 15.2, and 16.5.
- Project summary: Teacher scope can read the class and generate artifacts. This loop proves class-level generation works generally while parent scope remains isolated.
- Capability: teacher class read -> artifact generation -> parent refusal.
- Non-negotiables: no separate teacher agent, no parent access to class-identifiable data, no artifact without audit.
- Expected handoff result: teacher can generate a class-level artifact from scoped evidence; parent cannot run the same class-level path.

## Closed-loop acceptance target

Reviewer can run:

```text
npm run demo:teacher-artifact
```

and observe:

```text
teacher scope reads class-visible evidence
artifact_create saves class artifact
audit record exists
parent scope same request -> refusal/FORBIDDEN
```

## What to build

Extend the local OpenClaw harness and prompt contract to support teacher class-level artifact generation using existing primitive tools. Use class weak-point/error-table style output as the acceptance example, but keep implementation generic.

## Acceptance criteria

- [ ] Teacher path reads class-visible records through CLAW MCP.
- [ ] Generated artifact is saved through `artifact_create`.
- [ ] Artifact includes source references where available.
- [ ] Parent scope cannot read class data or create a class artifact.
- [ ] Audit record exists for generation.
- [ ] Demo transcript proves one-agent behavior for teacher and parent scopes.

## Blocked by

- DRAFT-0008 Agent learning-record sedimentation loop.

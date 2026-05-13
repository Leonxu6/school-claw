# Native platform binding loop

Type: HITL

Suggested label: `ready-for-human`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/development/openclaw-baseline.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 6, 7, 12.6, 15.5, and 16.2.
- Project summary: Local capability is not enough; CLAW must run from a real native private chat. The platform binding must create a stable OpenClaw session and a safe CLAW authorization mapping.
- Capability: real private chat -> sessionKey -> binding/authorization -> scoped reply.
- Non-negotiables: do not assume QR/invite token support without proof, do not treat peer ID as sufficient authorization, and do not weaken MCP permissions for platform convenience.
- Expected handoff result: a real platform account can bind and receive a scoped CLAW reply through OpenClaw.

## Closed-loop acceptance target

Reviewer can observe or inspect evidence for:

```text
real account private-chats bot
OpenClaw logs stable peer/sessionKey
binding or authorization code maps session to student/teacher
CLAW reply uses scoped data
second account receives separate scope
```

## What to build

Run the platform spike and binding flow against the chosen first pilot platform. Validate private chat, stable peer ID/session key, bot reply, and invite-token or authorization-code binding.

## Acceptance criteria

- [ ] Candidate platform and channel plugin are selected.
- [ ] A real account can private-chat the bot.
- [ ] Two accounts produce different stable OpenClaw session keys.
- [ ] Same account keeps stable session key across repeated messages and Gateway restart.
- [ ] Binding path maps session to `SessionScope`.
- [ ] Bot reply can use scoped CLAW data.
- [ ] Result records accepted/rejected platform decision with evidence.

## Blocked by

- DRAFT-0006 OpenClaw Scope Bridge loop.
- DRAFT-0007 One-agent OpenClaw read loop.

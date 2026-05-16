# Validate native platform binding and authorization path

Type: HITL

Suggested label: `ready-for-human`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `CONTEXT.md`, `docs/development/openclaw-baseline.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 6, 7, 12.6, 15.5, and 16.2.
- Project summary: CLAW must eventually run through a real native messaging platform. The architecture should depend only on stable peer IDs and authorization binding, not on unproven invite-token behavior.
- Capability: validate real private-chat entry, stable peer identity, and first-time binding flow.
- Non-negotiables: do not weaken data permissions for platform convenience, do not assume QR/invite tokens work without proof, and do not turn platform peer ID into authentication by itself.
- Expected handoff result: a platform decision and verified binding path that can be used for the pilot.

## What to build

Run a real platform spike for the chosen first pilot channel. Validate private chat entry, stable peer ID/session key, bot reply, and either invite-token binding or one-time authorization-code binding.

## Acceptance criteria

- [ ] Candidate platform and channel plugin are selected.
- [ ] A real account can private-chat the bot.
- [ ] Two accounts produce different stable OpenClaw session keys.
- [ ] The same account keeps a stable session key across repeated messages and Gateway restart.
- [ ] Bot replies work in private chat.
- [ ] If invite token is available, it is verified end-to-end.
- [ ] If invite token is not available, one-time authorization-code binding is specified.
- [ ] Result records whether the platform is accepted for v1 pilot or rejected with reasons.

## Blocked by

- DRAFT-0001 OpenClaw source baseline.
- DRAFT-0003 OpenClaw sessionKey to CLAW ssid contract.
- DRAFT-0008 Scope Bridge Plugin.
- DRAFT-0009 one-agent OpenClaw workspace and tool policy.
- DRAFT-0011 local OpenClaw capability harness.

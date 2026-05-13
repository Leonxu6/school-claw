# Validate one native platform private-chat session path

Type: HITL

Suggested label: `ready-for-human`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `AGENTS.md`, `CONTEXT.md`, `docs/architecture/CLAW_v1_technical_architecture.md` sections 4, 6, 12.6, 15.3, and 15.5.
- Project summary: CLAW v1 is a single-class education agent. Parents and teachers talk to one `claw-agent` through native private chats; each private chat becomes a stable session and later maps to a `SessionScope`.
- Non-negotiables: do not create separate parent/teacher agents, do not treat OpenClaw `sessionKey` as authentication, and do not design around a platform-specific feature unless the spike proves it works.
- Expected handoff result: a clear platform decision and evidence log, not production code unless the spike needs a tiny reproducible config.

## What to build

Validate the first real native messaging platform path for CLAW v1. A parent or teacher should enter a private chat with the bot, send a message, get routed to the single `claw-agent`, and receive a reply with a stable session identity.

This issue is intentionally HITL because it depends on real platform accounts, bot credentials, and a product decision about the first pilot platform.

## Acceptance criteria

- [ ] A candidate platform is selected for the spike.
- [ ] A real private chat can send a message into OpenClaw and receive a bot reply.
- [ ] Two different real accounts produce two different stable session keys.
- [ ] The same account produces the same session key across repeated messages.
- [ ] Gateway restart does not break the expected session continuity.
- [ ] The result records the chosen v1 platform or the reason to reject it.

## Blocked by

None - can start immediately.

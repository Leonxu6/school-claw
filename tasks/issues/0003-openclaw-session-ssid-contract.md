# Verify OpenClaw sessionKey to CLAW ssid contract

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `CONTEXT.md`, `docs/development/openclaw-baseline.md`, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 4.1, 4.2, 6, 7.1, 12.1, 12.6, and 15.3.
- Project summary: CLAW uses OpenClaw private-chat session keys as `ssid` values. This is context selection, not authentication. Parent isolation depends on stable `sessionKey` generation plus later `SessionScope` checks.
- Capability: prove and document the OpenClaw session routing contract that CLAW will rely on.
- Non-negotiables: do not build parent/teacher behavior here, do not treat `sessionKey` as auth, and do not skip source-level verification.
- Expected handoff result: tests or contract checks show how OpenClaw direct messages become stable `ssid` values under the chosen `dmScope`.

## What to build

Create a small contract test or harness around OpenClaw session routing. It should verify the configured `dmScope` behavior and document the exact `sessionKey` shape school-claw expects to use as `ssid`.

## Acceptance criteria

- [ ] Two direct-message peers producing isolated session keys are covered by a repeatable contract check.
- [ ] The verified config uses `session.dmScope: "per-channel-peer"` unless the OpenClaw baseline proves a better choice.
- [ ] Same channel + different peer produces different session keys.
- [ ] Same peer repeated messages produce the same session key.
- [ ] Multi-account behavior is either tested or explicitly deferred with reasoning.
- [ ] A note documents that `sessionKey`/`ssid` is only a scope lookup key, not authentication.
- [ ] Relevant tests/checks pass.

## Blocked by

- DRAFT-0001 OpenClaw source baseline.
- DRAFT-0002 school-claw development skeleton.

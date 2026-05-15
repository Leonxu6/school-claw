# Issue 0012 Native Platform Binding Spike

Status: engineering support ready; real-platform HITL smoke required before pilot acceptance.

## Decision Under Test

First pilot candidate:

- Platform: Feishu/Lark
- OpenClaw channel: `feishu`
- Channel plugin: `@openclaw/feishu`
- Event transport: WebSocket
- Required session mode: `session.dmScope="per-channel-peer"`
- First-time authorization fallback: one-time authorization code

Why this candidate:

- The pinned OpenClaw checkout documents Feishu/Lark as production-ready for bot DMs and group chats.
- The Feishu/Lark channel defaults to WebSocket event delivery, avoiding a public webhook requirement for the first smoke.
- OpenClaw DM pairing gives an inbound access gate, while CLAW keeps real education authorization in `SessionScope`.
- The CLAW architecture already requires a stable peer/session key and explicitly does not depend on platform invite-token support.

## Non-Negotiable Boundaries

- Keep one `claw-agent`; do not create platform-specific agents.
- Keep all education data access behind CLAW MCP and the Scope Bridge.
- Treat OpenClaw `sessionKey` as CLAW `ssid` and scope lookup key only. It is not authentication.
- Do not store Feishu/Lark App ID, App Secret, raw logs, or real peer IDs in committed files.
- Do not call the platform accepted until two real accounts have produced validator-passing evidence.

## Config Patch

Use the existing CLAW OpenClaw config from `integrations/openclaw/claw-agent.openclaw.json` and add only the channel/binding surface below:

```json5
{
  session: {
    dmScope: "per-channel-peer",
  },
  channels: {
    feishu: {
      enabled: true,
      connectionMode: "websocket",
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
      allowFrom: [],
    },
  },
  bindings: [
    {
      agentId: "claw-agent",
      match: {
        channel: "feishu",
        accountId: "*",
        peer: { kind: "direct", id: "*" },
      },
    },
  ],
}
```

The automated helper `createFeishuNativePlatformSpikeConfig` is covered by `tests/native-platform-binding-spike.test.ts` and preserves the issue 10 runtime fix: no `agents.defaults.agentRuntime`.

## Real Smoke Procedure

Run this on the machine that has the pinned OpenClaw checkout and Feishu/Lark credentials.

1. Configure the Feishu/Lark channel.

   ```sh
   openclaw channels login --channel feishu
   ```

2. Ensure the CLAW config includes the patch above and start the gateway.

   ```sh
   openclaw gateway
   openclaw logs --follow
   ```

3. From real account A, DM the bot. Record:

   - Feishu/Lark `open_id` from the OpenClaw logs or `openclaw pairing list feishu`.
   - OpenClaw `sessionKey`.
   - Whether the bot replied in the private chat.

4. Approve the DM pairing request if the channel is in pairing mode.

   ```sh
   openclaw pairing list feishu
   openclaw pairing approve feishu <CODE>
   ```

5. From the same real account A, send a second private-chat message and record the second `sessionKey`.

6. Restart the Gateway and send a third private-chat message from account A. Record the post-restart `sessionKey`.

   ```sh
   openclaw gateway restart
   openclaw logs --follow
   ```

7. Repeat with real account B.

8. Check invite-token behavior. If a Feishu/Lark entry path can carry a unique student invite token into the bot DM event, record `inviteToken.status="verified"` with evidence. If not, record `inviteToken.status="unavailable"` and keep the authorization-code fallback below.

9. Fill a local copy of `docs/development/0012-native-platform-binding-evidence.template.json`.

10. Validate the evidence file.

    ```sh
    pnpm validate:native-platform-binding /path/to/0012-native-platform-binding-evidence.local.json
    ```

Expected successful output starts with:

```text
VALID accepted
PASS candidate-platform
PASS real-platform-evidence
PASS private-chat-entry
```

## One-Time Authorization-Code Fallback

Use this if invite-token entry is unavailable.

1. Teacher creates a short authorization code for one parent/student scope.
2. Parent DMs the bot from the Feishu/Lark account that will own the session.
3. Parent sends the authorization code in the same DM.
4. CLAW binds the real OpenClaw `sessionKey` to the parent/student `SessionScope`.
5. The code is single-use, expires, and is issued by the teacher.
6. The platform peer ID/session key is only a lookup key; successful code redemption is the authorization event.

## Acceptance Standard

The platform can be accepted for the v1 pilot only when:

- Two real Feishu/Lark accounts produce different stable `agent:claw-agent:feishu:direct:<open_id>` session keys.
- At least one account keeps the same session key across repeated messages and Gateway restart.
- Bot replies work in private chat for every captured message.
- Invite-token binding is verified, or the authorization-code fallback is specified.
- `pnpm validate:native-platform-binding <evidence.json>` returns `VALID accepted`.

If any real-platform check fails, record `decision.status="rejected"` with reasons and keep the validator output as rejection evidence.

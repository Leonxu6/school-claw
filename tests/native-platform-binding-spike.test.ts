import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SELECTED_NATIVE_PLATFORM_SPIKE,
  createFeishuNativePlatformSpikeConfig,
  formatNativePlatformBindingReport,
  validateNativePlatformBindingEvidence,
  type NativePlatformBindingEvidence,
} from "../src/openclaw/native-platform-binding-spike.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

function acceptedFeishuEvidence(): NativePlatformBindingEvidence {
  return {
    evidenceKind: "native-platform-binding-spike/v1",
    captureMode: "real_platform",
    capturedAt: "2026-05-15T10:00:00.000Z",
    candidate: {
      platform: "Feishu/Lark",
      channel: "feishu",
      channelPlugin: "@openclaw/feishu",
      transport: "websocket",
      dmScope: "per-channel-peer",
    },
    accounts: [
      {
        label: "parent-a",
        peerKind: "direct",
        peerId: "ou_parent_a",
        observations: [
          {
            gatewayRun: "before-restart",
            messageText: "CLAW issue 12 smoke A1",
            sessionKey: "agent:claw-agent:feishu:direct:ou_parent_a",
            botReplyObserved: true,
          },
          {
            gatewayRun: "before-restart",
            messageText: "CLAW issue 12 smoke A2",
            sessionKey: "agent:claw-agent:feishu:direct:ou_parent_a",
            botReplyObserved: true,
          },
          {
            gatewayRun: "after-restart",
            messageText: "CLAW issue 12 smoke A3",
            sessionKey: "agent:claw-agent:feishu:direct:ou_parent_a",
            botReplyObserved: true,
          },
        ],
      },
      {
        label: "parent-b",
        peerKind: "direct",
        peerId: "ou_parent_b",
        observations: [
          {
            gatewayRun: "before-restart",
            messageText: "CLAW issue 12 smoke B1",
            sessionKey: "agent:claw-agent:feishu:direct:ou_parent_b",
            botReplyObserved: true,
          },
          {
            gatewayRun: "after-restart",
            messageText: "CLAW issue 12 smoke B2",
            sessionKey: "agent:claw-agent:feishu:direct:ou_parent_b",
            botReplyObserved: true,
          },
        ],
      },
    ],
    inviteToken: {
      status: "unavailable",
      reason: "Feishu DM events did not expose a student invite-token payload.",
    },
    authorizationCode: {
      specified: true,
      summary: "Teacher issues a short one-time code that binds the real Feishu peer to a CLAW scope.",
      steps: [
        "Teacher creates a parent authorization code for the student.",
        "Parent DMs the bot from the Feishu account that will own the session.",
        "Parent sends the code in the same DM session.",
        "CLAW stores the OpenClaw sessionKey as ssid for that parent/student scope.",
      ],
      safeguards: [
        "single-use",
        "expires",
        "teacher-issued",
        "peer-id-is-not-authentication",
      ],
    },
    decision: {
      status: "accepted",
      reasons: [
        "Two Feishu accounts produced distinct stable direct-message session keys.",
        "Bot replies worked before and after Gateway restart.",
        "Invite-token binding was unavailable, so the one-time authorization-code fallback is required.",
      ],
    },
  };
}

function cloneEvidence(
  mutate: (evidence: NativePlatformBindingEvidence) => void,
): NativePlatformBindingEvidence {
  const evidence = structuredClone(acceptedFeishuEvidence());
  mutate(evidence);
  return evidence;
}

describe("native platform binding spike", () => {
  it("selects Feishu/Lark and derives a minimal pilot config without weakening CLAW boundaries", () => {
    expect(SELECTED_NATIVE_PLATFORM_SPIKE).toMatchObject({
      platform: "Feishu/Lark",
      channel: "feishu",
      channelPlugin: "@openclaw/feishu",
      dmScope: "per-channel-peer",
      authorizationFallback: "one-time-authorization-code",
    });

    const config = createFeishuNativePlatformSpikeConfig({
      repoRoot,
      dataRoot: path.join(repoRoot, "claw-data"),
    });

    expect(config.session.dmScope).toBe("per-channel-peer");
    expect(config.channels.feishu).toMatchObject({
      enabled: true,
      connectionMode: "websocket",
      dmPolicy: "pairing",
    });
    expect(config.agents.list).toHaveLength(1);
    expect(config.agents.defaults).not.toHaveProperty("agentRuntime");
    expect(config.bindings).toEqual([
      {
        agentId: "claw-agent",
        match: {
          channel: "feishu",
          accountId: "*",
          peer: { kind: "direct", id: "*" },
        },
      },
    ]);
  });

  it("accepts complete real-platform evidence for a Feishu/Lark authorization-code path", () => {
    const validation = validateNativePlatformBindingEvidence(acceptedFeishuEvidence());

    expect(validation.ok).toBe(true);
    expect(validation.decisionStatus).toBe("accepted");
    expect(validation.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(formatNativePlatformBindingReport(validation)).toContain(
      "PASS distinct-session-keys",
    );
  });

  it("rejects template or synthetic evidence as real platform proof", () => {
    const validation = validateNativePlatformBindingEvidence(
      cloneEvidence((evidence) => {
        evidence.captureMode = "template";
      }),
    );

    expect(validation.ok).toBe(false);
    expect(validation.criteria).toContainEqual(
      expect.objectContaining({
        id: "real-platform-evidence",
        passed: false,
      }),
    );
  });

  it("rejects unstable repeated or restart session keys", () => {
    const validation = validateNativePlatformBindingEvidence(
      cloneEvidence((evidence) => {
        const accountA = evidence.accounts[0];
        const postRestartObservation = accountA?.observations[2];

        if (!postRestartObservation) {
          throw new Error("Expected accepted fixture to include account A post-restart evidence.");
        }

        postRestartObservation.sessionKey =
          "agent:claw-agent:feishu:direct:ou_parent_a_restart_changed";
      }),
    );

    expect(validation.ok).toBe(false);
    expect(validation.criteria).toContainEqual(
      expect.objectContaining({
        id: "restart-session-stability",
        passed: false,
      }),
    );
  });

  it("rejects cross-account session key reuse", () => {
    const validation = validateNativePlatformBindingEvidence(
      cloneEvidence((evidence) => {
        const accountB = evidence.accounts[1];

        if (!accountB) {
          throw new Error("Expected accepted fixture to include account B evidence.");
        }

        accountB.peerId = "ou_parent_a";
        for (const observation of accountB.observations) {
          observation.sessionKey = "agent:claw-agent:feishu:direct:ou_parent_a";
        }
      }),
    );

    expect(validation.ok).toBe(false);
    expect(validation.criteria).toContainEqual(
      expect.objectContaining({
        id: "distinct-session-keys",
        passed: false,
      }),
    );
  });

  it("requires an authorization-code specification when invite tokens are unavailable", () => {
    const validation = validateNativePlatformBindingEvidence(
      cloneEvidence((evidence) => {
        evidence.authorizationCode.specified = false;
        evidence.authorizationCode.steps = [];
        evidence.authorizationCode.safeguards = [];
      }),
    );

    expect(validation.ok).toBe(false);
    expect(validation.criteria).toContainEqual(
      expect.objectContaining({
        id: "invite-or-authorization-binding",
        passed: false,
      }),
    );
  });

  it("exposes a CLI that validates captured evidence files", () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), "school-claw-platform-spike-"));
    const evidencePath = path.join(tempRoot, "feishu-evidence.json");
    writeFileSync(
      evidencePath,
      `${JSON.stringify(acceptedFeishuEvidence(), null, 2)}\n`,
      "utf8",
    );

    const output = execFileSync(
      "node",
      [
        "--import",
        path.join(repoRoot, "node_modules", "tsx", "dist", "esm", "index.mjs"),
        "scripts/validate-native-platform-binding.ts",
        evidencePath,
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );

    expect(output).toContain("VALID accepted");
    expect(output).toContain("PASS private-chat-entry");
  });
});

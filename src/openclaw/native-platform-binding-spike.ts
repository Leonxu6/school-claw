import {
  CLAW_AGENT_ID,
  createLoadableClawAgentOpenClawConfig,
  type ClawAgentOpenClawConfigOptions,
  type LoadableClawAgentOpenClawConfig,
} from "./claw-agent-config.js";

export const SELECTED_NATIVE_PLATFORM_SPIKE = {
  platform: "Feishu/Lark",
  channel: "feishu",
  channelPlugin: "@openclaw/feishu",
  transport: "websocket",
  dmScope: "per-channel-peer",
  authorizationFallback: "one-time-authorization-code",
  reasons: [
    "OpenClaw source docs mark Feishu/Lark bot DMs and group chats as production-ready.",
    "The channel supports WebSocket event delivery, so the pilot does not require a public webhook.",
    "OpenClaw pairing gives a stable first-contact gate while CLAW keeps authorization in SessionScope.",
  ],
} as const;

export type FeishuNativePlatformSpikeConfig = LoadableClawAgentOpenClawConfig & {
  channels: {
    feishu: {
      enabled: true;
      connectionMode: typeof SELECTED_NATIVE_PLATFORM_SPIKE.transport;
      dmPolicy: "pairing";
      groupPolicy: "allowlist";
      allowFrom: string[];
    };
  };
  bindings: [
    {
      agentId: typeof CLAW_AGENT_ID;
      match: {
        channel: typeof SELECTED_NATIVE_PLATFORM_SPIKE.channel;
        accountId: "*";
        peer: {
          kind: "direct";
          id: "*";
        };
      };
    },
  ];
};

export type NativePlatformBindingEvidence = {
  evidenceKind: "native-platform-binding-spike/v1";
  captureMode: "real_platform" | "template" | "synthetic";
  capturedAt: string;
  candidate: {
    platform: string;
    channel: string;
    channelPlugin: string;
    transport: string;
    dmScope: string;
  };
  accounts: NativePlatformAccountEvidence[];
  inviteToken:
    | {
        status: "verified";
        evidence: string;
      }
    | {
        status: "unavailable";
        reason: string;
      }
    | {
        status: "not_tested";
        reason?: string;
      };
  authorizationCode: {
    specified: boolean;
    summary: string;
    steps: string[];
    safeguards: string[];
  };
  decision: {
    status: "accepted" | "rejected" | "pending";
    reasons: string[];
  };
};

export type NativePlatformAccountEvidence = {
  label: string;
  peerKind: "direct" | "group" | "channel" | string;
  peerId: string;
  observations: NativePlatformMessageObservation[];
};

export type NativePlatformMessageObservation = {
  gatewayRun: "before-restart" | "after-restart" | string;
  messageText: string;
  sessionKey: string;
  botReplyObserved: boolean;
};

export type NativePlatformBindingCriterionId =
  | "candidate-platform"
  | "real-platform-evidence"
  | "private-chat-entry"
  | "distinct-session-keys"
  | "repeated-session-stability"
  | "restart-session-stability"
  | "private-chat-replies"
  | "invite-or-authorization-binding"
  | "pilot-decision";

export type NativePlatformBindingCriterion = {
  id: NativePlatformBindingCriterionId;
  passed: boolean;
  detail: string;
};

export type NativePlatformBindingValidation = {
  ok: boolean;
  decisionStatus: NativePlatformBindingEvidence["decision"]["status"] | "invalid";
  criteria: NativePlatformBindingCriterion[];
};

export function createFeishuNativePlatformSpikeConfig(
  options: ClawAgentOpenClawConfigOptions,
): FeishuNativePlatformSpikeConfig {
  return {
    ...createLoadableClawAgentOpenClawConfig(options),
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
        agentId: CLAW_AGENT_ID,
        match: {
          channel: "feishu",
          accountId: "*",
          peer: { kind: "direct", id: "*" },
        },
      },
    ],
  };
}

export function validateNativePlatformBindingEvidence(
  evidence: NativePlatformBindingEvidence,
): NativePlatformBindingValidation {
  const accounts = Array.isArray(evidence.accounts) ? evidence.accounts : [];
  const candidateCriterion = criterion(
    "candidate-platform",
    evidence.evidenceKind === "native-platform-binding-spike/v1" &&
      evidence.candidate.platform === SELECTED_NATIVE_PLATFORM_SPIKE.platform &&
      evidence.candidate.channel === SELECTED_NATIVE_PLATFORM_SPIKE.channel &&
      evidence.candidate.channelPlugin === SELECTED_NATIVE_PLATFORM_SPIKE.channelPlugin &&
      evidence.candidate.transport === SELECTED_NATIVE_PLATFORM_SPIKE.transport &&
      evidence.candidate.dmScope === SELECTED_NATIVE_PLATFORM_SPIKE.dmScope,
    "Feishu/Lark channel, plugin, transport, and per-channel-peer dmScope are selected.",
  );
  const realPlatformCriterion = criterion(
    "real-platform-evidence",
    evidence.captureMode === "real_platform" && !Number.isNaN(Date.parse(evidence.capturedAt)),
    "Evidence is marked as a dated real-platform smoke capture, not a template or fixture.",
  );
  const privateChatCriterion = criterion(
    "private-chat-entry",
    accounts.some((account) => {
      return account.peerKind === "direct" &&
        nonPlaceholder(account.peerId) &&
        account.observations.some((observation) => nonPlaceholder(observation.messageText));
    }),
    "At least one real direct-message account reached the bot.",
  );
  const distinctSessionCriterion = criterion(
    "distinct-session-keys",
    hasDistinctStableAccountSessionKeys(evidence),
    "Two direct-message accounts produce different stable OpenClaw session keys.",
  );
  const repeatedSessionCriterion = criterion(
    "repeated-session-stability",
    directAccountsHaveStableRepeatedMessages(evidence, accounts),
    "The same direct-message account keeps one session key across repeated messages.",
  );
  const restartSessionCriterion = criterion(
    "restart-session-stability",
    directAccountsHaveStableRestartMessages(evidence, accounts),
    "The same direct-message account keeps one session key before and after Gateway restart.",
  );
  const replyCriterion = criterion(
    "private-chat-replies",
    accounts.length > 0 &&
      accounts.flatMap((account) => account.observations).length > 0 &&
      accounts.every((account) => {
        return account.observations.length > 0 &&
          account.observations.every((observation) => observation.botReplyObserved === true);
      }),
    "Bot replies were observed for every captured private-chat message.",
  );
  const bindingCriterion = criterion(
    "invite-or-authorization-binding",
    inviteOrAuthorizationBindingSpecified(evidence),
    "Invite-token binding is verified, or the one-time authorization-code fallback is specified with safeguards.",
  );

  const preDecisionCriteria = [
    candidateCriterion,
    realPlatformCriterion,
    privateChatCriterion,
    distinctSessionCriterion,
    repeatedSessionCriterion,
    restartSessionCriterion,
    replyCriterion,
    bindingCriterion,
  ];
  const decisionStatus = isDecisionStatus(evidence.decision.status)
    ? evidence.decision.status
    : "invalid";
  const acceptedDecisionIsCoherent = decisionStatus === "accepted" &&
    evidence.decision.reasons.length > 0 &&
    preDecisionCriteria.every((item) => item.passed);
  const rejectedDecisionIsCoherent = decisionStatus === "rejected" &&
    evidence.decision.reasons.length > 0 &&
    candidateCriterion.passed &&
    realPlatformCriterion.passed &&
    preDecisionCriteria.some((item) => !item.passed);
  const decisionCriterion = criterion(
    "pilot-decision",
    acceptedDecisionIsCoherent || rejectedDecisionIsCoherent,
    "Decision is accepted with all smoke criteria passing, or rejected with real-platform failure reasons.",
  );
  const criteria = [...preDecisionCriteria, decisionCriterion];

  return {
    ok: decisionCriterion.passed,
    decisionStatus,
    criteria,
  };
}

export function formatNativePlatformBindingReport(
  validation: NativePlatformBindingValidation,
): string {
  const lines = [
    `${validation.ok ? "VALID" : "INVALID"} ${validation.decisionStatus}`,
    "",
    ...validation.criteria.map((criterionItem) => {
      const status = criterionItem.passed ? "PASS" : "FAIL";

      return `${status} ${criterionItem.id}: ${criterionItem.detail}`;
    }),
  ];

  return `${lines.join("\n")}\n`;
}

function criterion(
  id: NativePlatformBindingCriterionId,
  passed: boolean,
  detail: string,
): NativePlatformBindingCriterion {
  return { id, passed, detail };
}

function inviteOrAuthorizationBindingSpecified(
  evidence: NativePlatformBindingEvidence,
): boolean {
  if (evidence.inviteToken.status === "verified") {
    return nonEmpty(evidence.inviteToken.evidence);
  }

  if (evidence.inviteToken.status !== "unavailable") {
    return false;
  }

  const requiredSafeguards = [
    "single-use",
    "expires",
    "teacher-issued",
    "peer-id-is-not-authentication",
  ];

  return evidence.authorizationCode.specified === true &&
    nonEmpty(evidence.authorizationCode.summary) &&
    evidence.authorizationCode.steps.length >= 4 &&
    requiredSafeguards.every((safeguard) => {
      return evidence.authorizationCode.safeguards.includes(safeguard);
    });
}

function hasDistinctStableAccountSessionKeys(
  evidence: NativePlatformBindingEvidence,
): boolean {
  const stableDirectAccounts = evidence.accounts
    .filter((account) => account.peerKind === "direct")
    .map((account) => stableAccountSessionKey(evidence, account))
    .filter((sessionKey): sessionKey is string => sessionKey !== undefined);

  return stableDirectAccounts.length >= 2 &&
    new Set(stableDirectAccounts).size === stableDirectAccounts.length;
}

function directAccountsHaveStableRepeatedMessages(
  evidence: NativePlatformBindingEvidence,
  accounts: NativePlatformAccountEvidence[],
): boolean {
  const directAccounts = accounts.filter((account) => account.peerKind === "direct");
  const repeatedAccounts = directAccounts.filter((account) => account.observations.length >= 2);

  return repeatedAccounts.length > 0 &&
    repeatedAccounts.every((account) => {
      return stableAccountSessionKey(evidence, account) !== undefined;
    });
}

function directAccountsHaveStableRestartMessages(
  evidence: NativePlatformBindingEvidence,
  accounts: NativePlatformAccountEvidence[],
): boolean {
  const restartAccounts = accounts.filter((account) => {
    if (account.peerKind !== "direct") {
      return false;
    }

    const runs = new Set(account.observations.map((observation) => observation.gatewayRun));

    return runs.has("before-restart") && runs.has("after-restart");
  });

  return restartAccounts.length > 0 &&
    restartAccounts.every((account) => {
      return stableAccountSessionKey(evidence, account) !== undefined;
    });
}

function stableAccountSessionKey(
  evidence: NativePlatformBindingEvidence,
  account: NativePlatformAccountEvidence,
): string | undefined {
  if (!nonPlaceholder(account.peerId) || account.observations.length === 0) {
    return undefined;
  }

  const sessionKeys = account.observations.map((observation) => observation.sessionKey);
  const uniqueSessionKeys = new Set(sessionKeys);
  const expectedSessionKey = `agent:${CLAW_AGENT_ID}:${evidence.candidate.channel}:direct:${account.peerId}`;

  if (
    uniqueSessionKeys.size !== 1 ||
    sessionKeys[0] !== expectedSessionKey ||
    !sessionKeys.every(nonPlaceholder)
  ) {
    return undefined;
  }

  return sessionKeys[0];
}

function isDecisionStatus(value: string): value is NativePlatformBindingEvidence["decision"]["status"] {
  return value === "accepted" || value === "rejected" || value === "pending";
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function nonPlaceholder(value: string): boolean {
  return nonEmpty(value) && !value.includes("replace-with");
}

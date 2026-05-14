import path from "node:path";

import type { FilesReadAllRequest, FilesReadAllResult, ReadDocument } from "../archive/scoped-read.js";
import type {
  FilesAppendRequest,
  FilesAppendResult,
} from "../archive/write-audit.js";
import {
  connectClawMcpClient,
  type ClawMcpServerLaunchConfig,
} from "../mcp/client.js";
import type { PublicScope, ScopeGetResult } from "../scope/scope-get.js";
import {
  CLAW_AGENT_ID,
  createClawAgentOpenClawConfig,
} from "./claw-agent-config.js";
import { applyScopeBridgeToToolCall } from "./scope-bridge.js";

export type SedimentationToolName =
  | "claw__scope_get"
  | "claw__files_append"
  | "claw__files_read_all";
export type SedimentationMcpToolName =
  | "scope_get"
  | "files_append"
  | "files_read_all";
export type SedimentationToolTransport = "stdio-mcp";

export type SedimentationClassification =
  | {
      durable: true;
      reason: "durable parent learning evidence";
      target: FilesAppendRequest["target"];
      frontmatter: Record<string, unknown>;
      content: string;
    }
  | {
      durable: false;
      reason: "not durable learning evidence";
    };

export type SedimentationToolCall = {
  toolName: SedimentationToolName;
  mcpToolName: SedimentationMcpToolName;
  transport: SedimentationToolTransport;
  serverName: "claw";
  params: Record<string, unknown> & { ssid: string };
  bridged: true;
  result: ScopeGetResult | FilesAppendResult | FilesReadAllResult;
};

export type SedimentationTurn = {
  ok: boolean;
  agentId: typeof CLAW_AGENT_ID;
  sessionKey: string;
  message: string;
  classification: SedimentationClassification;
  toolCalls: SedimentationToolCall[];
  nativeToolCalls: string[];
  reply: string;
};

export type SedimentationDemo = {
  learningFactTurn: SedimentationTurn;
  followUpTurn: SedimentationTurn;
  idleTurn: SedimentationTurn;
  logLines: string[];
};

export type SedimentationTurnOptions = {
  repoRoot: string;
  dataRoot: string;
  sessionKey: string;
  message: string;
  nowIso?: string;
  toolExecutor?: SedimentationToolExecutor;
};

export type SedimentationDemoOptions = {
  repoRoot: string;
  dataRoot: string;
  sessionKey: string;
  learningFact: string;
  followUpQuestion: string;
  idleChat: string;
  nowIso?: string;
};

export type SedimentationToolExecutor = {
  transport: SedimentationToolTransport;
  serverName: "claw";
  callJsonTool<T>(
    toolName: SedimentationToolName,
    mcpToolName: SedimentationMcpToolName,
    params: Record<string, unknown> & { ssid: string },
  ): Promise<T>;
  close?(): Promise<void>;
};

export async function runSedimentationDemo(
  options: SedimentationDemoOptions,
): Promise<SedimentationDemo> {
  const learningFactTurn = await runClawAgentSedimentationTurn({
    repoRoot: options.repoRoot,
    dataRoot: options.dataRoot,
    sessionKey: options.sessionKey,
    message: options.learningFact,
    ...(options.nowIso ? { nowIso: options.nowIso } : {}),
  });
  const followUpTurn = await runClawAgentSedimentationTurn({
    repoRoot: options.repoRoot,
    dataRoot: options.dataRoot,
    sessionKey: options.sessionKey,
    message: options.followUpQuestion,
    ...(options.nowIso ? { nowIso: options.nowIso } : {}),
  });
  const idleTurn = await runClawAgentSedimentationTurn({
    repoRoot: options.repoRoot,
    dataRoot: options.dataRoot,
    sessionKey: options.sessionKey,
    message: options.idleChat,
    ...(options.nowIso ? { nowIso: options.nowIso } : {}),
  });

  return {
    learningFactTurn,
    followUpTurn,
    idleTurn,
    logLines: buildSedimentationLogLines({
      learningFactTurn,
      followUpTurn,
      idleTurn,
    }),
  };
}

export async function runClawAgentSedimentationTurn(
  options: SedimentationTurnOptions,
): Promise<SedimentationTurn> {
  const ownedExecutor = options.toolExecutor
    ? undefined
    : await createStdioSedimentationExecutor(options);
  const executor = options.toolExecutor ?? ownedExecutor;
  const toolCalls: SedimentationToolCall[] = [];
  const notDurable: SedimentationClassification = {
    durable: false,
    reason: "not durable learning evidence",
  };

  if (!executor) {
    throw new Error("CLAW tool executor was not initialized.");
  }

  try {
    const scopeResult = await callBridgedTool<ScopeGetResult>({
      executor,
      toolCalls,
      toolName: "claw__scope_get",
      mcpToolName: "scope_get",
      params: {},
      sessionKey: options.sessionKey,
    });

    if (!scopeResult.ok) {
      return failedTurn(options, notDurable, toolCalls, `Scope lookup failed: ${scopeResult.error.code}`);
    }

    const classification = classifyLearningEvidence(
      options.message,
      scopeResult.scope,
      new Date(options.nowIso ?? Date.now()),
    );

    if (classification.durable) {
      const appendResult = await callBridgedTool<FilesAppendResult>({
        executor,
        toolCalls,
        toolName: "claw__files_append",
        mcpToolName: "files_append",
        params: {
          target: classification.target,
          frontmatter: classification.frontmatter,
          content: classification.content,
          reason: classification.reason,
        },
        sessionKey: options.sessionKey,
      });

      if (!appendResult.ok) {
        return failedTurn(
          options,
          classification,
          toolCalls,
          `Archive append failed: ${appendResult.error.code}`,
        );
      }

      return successfulTurn(
        options,
        classification,
        toolCalls,
        `已记录这条学习观察。证据文件：${appendResult.fileId}`,
      );
    }

    if (shouldReadArchive(options.message)) {
      const readResult = await callBridgedTool<FilesReadAllResult>({
        executor,
        toolCalls,
        toolName: "claw__files_read_all",
        mcpToolName: "files_read_all",
        params: buildReadRequest(scopeResult.scope),
        sessionKey: options.sessionKey,
      });

      if (!readResult.ok) {
        return failedTurn(
          options,
          classification,
          toolCalls,
          `Archive read failed: ${readResult.error.code}`,
        );
      }

      return successfulTurn(
        options,
        classification,
        toolCalls,
        composeEvidenceReply(scopeResult.scope, readResult.documents),
      );
    }

    return successfulTurn(
      options,
      classification,
      toolCalls,
      "这条消息不会写入学习档案。",
    );
  } finally {
    await ownedExecutor?.close?.();
  }
}

async function createStdioSedimentationExecutor(
  options: Pick<SedimentationTurnOptions, "repoRoot" | "dataRoot" | "nowIso">,
): Promise<SedimentationToolExecutor> {
  const config = createClawAgentOpenClawConfig({
    repoRoot: options.repoRoot,
    dataRoot: options.dataRoot,
  });
  const server = withOptionalNow(config.mcp.servers.claw, options.nowIso);
  const client = await connectClawMcpClient({
    serverName: "claw",
    server,
  });

  return {
    transport: "stdio-mcp",
    serverName: "claw",
    async callJsonTool<T>(
      _toolName: SedimentationToolName,
      mcpToolName: SedimentationMcpToolName,
      params: Record<string, unknown> & { ssid: string },
    ): Promise<T> {
      return await client.callJsonTool<T>(mcpToolName, params);
    },
    async close() {
      await client.close();
    },
  };
}

function withOptionalNow(
  server: ClawMcpServerLaunchConfig,
  nowIso: string | undefined,
): ClawMcpServerLaunchConfig {
  if (!nowIso) {
    return server;
  }

  return {
    ...server,
    env: {
      ...server.env,
      CLAW_NOW: nowIso,
    },
  };
}

async function callBridgedTool<T>(params: {
  executor: SedimentationToolExecutor;
  toolCalls: SedimentationToolCall[];
  toolName: SedimentationToolName;
  mcpToolName: SedimentationMcpToolName;
  params: Record<string, unknown>;
  sessionKey: string;
}): Promise<T> {
  const bridged = applyScopeBridgeToToolCall(
    {
      toolName: params.toolName,
      params: params.params,
    },
    {
      toolName: params.toolName,
      sessionKey: params.sessionKey,
    },
  );

  if (!bridged.ok) {
    throw new Error(bridged.blockReason);
  }

  if (!bridged.bridged) {
    throw new Error("CLAW tool call was not bridged with ssid.");
  }

  const result = await params.executor.callJsonTool<T>(
    params.toolName,
    params.mcpToolName,
    bridged.params,
  );

  params.toolCalls.push({
    toolName: params.toolName,
    mcpToolName: params.mcpToolName,
    transport: params.executor.transport,
    serverName: params.executor.serverName,
    params: bridged.params,
    bridged: true,
    result: result as ScopeGetResult | FilesAppendResult | FilesReadAllResult,
  });

  return result;
}

function classifyLearningEvidence(
  message: string,
  scope: PublicScope,
  now: Date,
): SedimentationClassification {
  const normalized = message.trim();
  const studentId = singleVisibleStudent(scope);

  if (!studentId || !isDurableLearningEvidence(normalized)) {
    return {
      durable: false,
      reason: "not durable learning evidence",
    };
  }

  const extracted = extractLearningFields(normalized);
  const month = now.toISOString().slice(0, 7);

  return {
    durable: true,
    reason: "durable parent learning evidence",
    target: {
      kind: "parent_observation",
      studentId,
      month,
    },
    frontmatter: compactRecord({
      source_kind: normalized.match(/孩子说|他说|她说/u)
        ? "parent_reported_student_speech"
        : "parent_observation",
      subject: extracted.subject,
      knowledge_point: extracted.knowledgePoint,
      error_cause: extracted.errorCause,
      issue: extracted.issue,
    }),
    content: renderObservationContent(normalized, extracted, now),
  };
}

function singleVisibleStudent(scope: PublicScope): string | undefined {
  return scope.studentIds.length === 1 && scope.studentIds[0] !== "*"
    ? scope.studentIds[0]
    : undefined;
}

function isDurableLearningEvidence(message: string): boolean {
  if (!message || looksLikeSpeculation(message)) {
    return false;
  }

  const learningSignals = [
    /错题|错因|错了|不会|没看清|没理解/u,
    /应用题|分数|单词|听写|作文|阅读|计算/u,
    /作业|复盘|背了|默写|课堂|学习|知识点/u,
    /习惯|拖到很晚|情绪|畏难|注意力/u,
  ];
  const factSignals = [
    /孩子说|他说|她说|老师说/u,
    /今天|昨天|昨晚|这周|最近/u,
    /第\s*\d+\s*题|两道|一道|三道/u,
    /总是|经常|能说出|写不出来|背了/u,
  ];

  return (
    learningSignals.some((pattern) => pattern.test(message)) &&
    factSignals.some((pattern) => pattern.test(message))
  );
}

function looksLikeSpeculation(message: string): boolean {
  return /我感觉|我觉得|可能|是不是/u.test(message) && !/孩子说|他说|她说|今天|昨天|昨晚/u.test(message);
}

function shouldReadArchive(message: string): boolean {
  if (looksLikeSpeculation(message)) {
    return false;
  }

  return /记录|说明|怎么样|情况|建议|为什么|什么/u.test(message);
}

function extractLearningFields(message: string): {
  subject: string | undefined;
  knowledgePoint: string | undefined;
  errorCause: string | undefined;
  issue: string | undefined;
} {
  return {
    subject: firstMatchValue(message, ["数学", "英语", "语文", "物理", "化学", "科学"]),
    knowledgePoint: firstMatchValue(message, [
      "分数应用题",
      "应用题",
      "听写",
      "单词",
      "作文",
      "阅读",
      "计算",
    ]),
    errorCause: captureAfter(message, /(?:因为|错因是|原因是)([^。！？.!?]+)/u),
    issue: captureAfter(message, /([^。！？.!?]*错了[^。！？.!?]*)/u),
  };
}

function firstMatchValue(message: string, values: string[]): string | undefined {
  return values.find((value) => message.includes(value));
}

function captureAfter(message: string, pattern: RegExp): string | undefined {
  const match = message.match(pattern);
  const captured = match?.[1]?.trim();

  return captured ? captured : undefined;
}

function renderObservationContent(
  message: string,
  extracted: ReturnType<typeof extractLearningFields>,
  now: Date,
): string {
  return [
    `# ${now.toISOString().slice(0, 10)} 家长学习观察`,
    "",
    `- 原始输入：${message}`,
    ...optionalBullet("学科", extracted.subject),
    ...optionalBullet("知识点", extracted.knowledgePoint),
    ...optionalBullet("错因", extracted.errorCause),
    ...optionalBullet("问题", extracted.issue),
  ].join("\n");
}

function optionalBullet(label: string, value: string | undefined): string[] {
  return value ? [`- ${label}：${value}`] : [];
}

function compactRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== ""),
  );
}

function buildReadRequest(scope: PublicScope): FilesReadAllRequest {
  const studentId = singleVisibleStudent(scope);

  return {
    ...(studentId ? { studentId } : {}),
    kinds: ["profile", "timeline", "errors", "observations"],
    maxFiles: 12,
    maxTotalChars: 24_000,
  };
}

function composeEvidenceReply(scope: PublicScope, documents: ReadDocument[]): string {
  const studentName = deriveStudentName(scope, documents);
  const evidence = documents.flatMap(documentEvidenceLines);
  const newRecord =
    evidence.find((line) => line.includes("原始输入")) ??
    evidence.find((line) => line.includes("错因")) ??
    evidence[0] ??
    "当前档案暂无可读学习事件";

  return [
    `${studentName}的新记录说明：${newRecord}`,
    "建议今晚先让孩子复述题目到底问什么，再做一题同类迁移。",
    `证据：${evidence.slice(0, 5).join("；")}`,
  ].join("\n");
}

function deriveStudentName(scope: PublicScope, documents: ReadDocument[]): string {
  const profile = documents.find((document) => {
    return document.frontmatter.type === "student_profile";
  });
  const title = String(profile?.title ?? "");
  const fromTitle = title.replace(/学习档案$/u, "").trim();

  if (fromTitle) {
    return fromTitle;
  }

  return scope.displayName.replace(/家长$/u, "");
}

function documentEvidenceLines(document: ReadDocument): string[] {
  return document.content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("---"))
    .map((line) => line.replace(/^[-*]\s*/u, ""))
    .filter(Boolean)
    .map((line) => `${document.title}: ${line}`);
}

function successfulTurn(
  options: Pick<SedimentationTurn, "sessionKey" | "message">,
  classification: SedimentationClassification,
  toolCalls: SedimentationToolCall[],
  reply: string,
): SedimentationTurn {
  return {
    ok: true,
    agentId: CLAW_AGENT_ID,
    sessionKey: options.sessionKey,
    message: options.message,
    classification,
    toolCalls,
    nativeToolCalls: deriveNativeToolCalls(toolCalls),
    reply,
  };
}

function failedTurn(
  options: Pick<SedimentationTurn, "sessionKey" | "message">,
  classification: SedimentationClassification,
  toolCalls: SedimentationToolCall[],
  reply: string,
): SedimentationTurn {
  return {
    ok: false,
    agentId: CLAW_AGENT_ID,
    sessionKey: options.sessionKey,
    message: options.message,
    classification,
    toolCalls,
    nativeToolCalls: deriveNativeToolCalls(toolCalls),
    reply,
  };
}

function deriveNativeToolCalls(toolCalls: SedimentationToolCall[]): string[] {
  return toolCalls
    .filter((call) => call.transport !== "stdio-mcp")
    .map((call) => call.toolName);
}

function buildSedimentationLogLines(params: {
  learningFactTurn: SedimentationTurn;
  followUpTurn: SedimentationTurn;
  idleTurn: SedimentationTurn;
}): string[] {
  return [
    "input: learning fact",
    params.learningFactTurn.classification.durable
      ? "agent decides it is durable"
      : "agent decides it is not durable",
    params.learningFactTurn.toolCalls.some((call) => call.toolName === "claw__files_append")
      ? "files_append writes scoped observation"
      : "files_append was not called",
    params.learningFactTurn.toolCalls.some(
      (call) => call.toolName === "claw__files_append" && call.result.ok,
    )
      ? "audit entry appears"
      : "audit entry missing",
    params.followUpTurn.reply.includes("证据")
      ? "follow-up question reads and cites the new record"
      : "follow-up question did not cite evidence",
    params.idleTurn.toolCalls.some((call) => call.toolName === "claw__files_append")
      ? "input: greeting/idle chat -> archive write occurred"
      : "input: greeting/idle chat -> no archive write occurs",
  ];
}

export function defaultSedimentationPaths(metaUrl: string): {
  repoRoot: string;
  dataRoot: string;
} {
  const repoRoot = path.resolve(new URL("..", metaUrl).pathname);

  return {
    repoRoot,
    dataRoot: path.join(repoRoot, "tests", "fixtures", "markdown-archive"),
  };
}

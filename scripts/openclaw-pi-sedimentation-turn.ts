import { readFileSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  CLAW_AGENT_ID,
  TSX_ESM_LOADER_PATH,
  createClawAgentOpenClawConfig,
} from "../src/openclaw/claw-agent-config.js";
import type {
  OpenClawPiSedimentationRun,
  SedimentationMcpToolName,
  SedimentationRuntime,
  SedimentationScenario,
  SedimentationToolCall,
  SedimentationToolName,
  SedimentationTurn,
} from "../src/openclaw/sedimentation-loop.js";

type HelperInput = {
  repoRoot: string;
  dataRoot: string;
  openclawCheckoutPath: string;
  sessionKey: string;
  forgedSsid?: string;
  nowIso?: string;
  turns: Array<{
    id:
      | "learningFactTurn"
      | "followUpTurn"
      | "idleTurn"
      | "forgedSsidTurn"
      | "parentPracticeTurn"
      | "parentCrossStudentRefusalTurn"
      | "teacherErrorTableTurn";
    scenario: SedimentationScenario;
    message: string;
  }>;
};

type RunEmbeddedPiAgent = (params: Record<string, unknown>) => Promise<{
  payloads?: Array<{ text?: string }>;
  meta: {
    durationMs: number;
    stopReason?: string;
    finalAssistantVisibleText?: string;
    agentMeta?: {
      agentHarnessId?: string;
      provider?: string;
      model?: string;
    };
  };
}>;

type SessionEntry = {
  type?: string;
  message?: {
    role?: string;
    toolCallId?: string;
    toolName?: string;
    isError?: boolean;
    content?: Array<Record<string, unknown>>;
  };
};

type AssistantToolCallBlock = {
  type?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
};

type ActiveTurn = HelperInput["turns"][number] & {
  step: number;
  requestToolNames: string[][];
  requestContractInjected: boolean[];
};

const input = JSON.parse(readFileSync(0, "utf8")) as HelperInput;
const runtime: SedimentationRuntime = "openclaw-pi-runtime";
const openclawModule = (relativePath: string) => {
  return pathToFileURL(path.join(input.openclawCheckoutPath, relativePath)).href;
};
const { runEmbeddedPiAgent } = (await import(
  openclawModule("src/agents/pi-embedded-runner/run.ts")
)) as {
  runEmbeddedPiAgent: RunEmbeddedPiAgent;
};

const modelServer = installDeterministicResponsesFetch({
  sessionKey: input.sessionKey,
  ...(input.forgedSsid ? { forgedSsid: input.forgedSsid } : {}),
  ...(input.nowIso ? { nowIso: input.nowIso } : {}),
});
const tempRoot = await mkdtemp(path.join(tmpdir(), "school-claw-openclaw-pi-sedimentation-"));
const agentDir = path.join(tempRoot, "agent");
const workspaceDir = path.join(tempRoot, "workspace");
const sessionFile = path.join(tempRoot, "session.jsonl");

await mkdir(agentDir, { recursive: true });
await mkdir(workspaceDir, { recursive: true });
await cp(path.join(input.repoRoot, "workspaces", CLAW_AGENT_ID), workspaceDir, {
  recursive: true,
});

try {
  const schoolConfig = createClawAgentOpenClawConfig({
    repoRoot: input.repoRoot,
    dataRoot: input.dataRoot,
  });
  const config = createOpenClawRuntimeConfig({
    baseUrl: modelServer.baseUrl,
    repoRoot: input.repoRoot,
    dataRoot: input.dataRoot,
    sessionKey: input.sessionKey,
    ...(input.nowIso ? { nowIso: input.nowIso } : {}),
  });
  const turns: Record<HelperInput["turns"][number]["id"], SedimentationTurn> =
    {} as Record<HelperInput["turns"][number]["id"], SedimentationTurn>;
  const runs: OpenClawPiSedimentationRun[] = [];
  const sessionId = `school-claw-sedimentation:${crypto.randomUUID()}`;

  for (const turn of input.turns) {
    modelServer.activateTurn(turn);
    const beforeEntries = await readSessionEntries(sessionFile);
    const result = await runEmbeddedPiAgent({
      sessionId,
      sessionKey: input.sessionKey,
      agentId: CLAW_AGENT_ID,
      messageChannel: "qqbot",
      messageProvider: "qqbot",
      sessionFile,
      workspaceDir,
      agentDir,
      config,
      prompt: turn.message,
      provider: "openai",
      model: "school-claw-sedimentation",
      timeoutMs: 45_000,
      runId: `school-claw-sedimentation-${turn.id}-${crypto.randomUUID()}`,
      enqueue: async <T>(task: () => Promise<T>) => await task(),
      cleanupBundleMcpOnRunEnd: true,
      toolsAllow: [
        "claw__scope_get",
        "claw__files_append",
        "claw__files_read_all",
        "claw__artifact_create",
      ],
      promptMode: "minimal",
      skillsSnapshot: {
        prompt: "",
        skills: [],
        resolvedSkills: [],
      },
      bootstrapContextMode: "full",
    });
    const afterEntries = await readSessionEntries(sessionFile);
    const turnEntries = afterEntries.slice(beforeEntries.length);
    const toolCalls = extractToolCalls(turnEntries);
    const reply =
      result.meta.finalAssistantVisibleText ??
      result.payloads?.map((payload) => payload.text ?? "").join("\n").trim() ??
      "";

    turns[turn.id] = {
      ok: toolCalls.every((call) => isOkResult(call.result)),
      runtime,
      agentHarnessId: "pi",
      agentId: CLAW_AGENT_ID,
      sessionKey: input.sessionKey,
      message: turn.message,
      toolCalls,
      nativeToolCalls: toolCalls
        .filter((call) => !call.toolName.startsWith("claw__"))
        .map((call) => call.toolName),
      reply,
    };
    runs.push({
      turnId: turn.id,
      scenario: turn.scenario,
      runtime,
      agentHarnessId: "pi",
      provider: result.meta.agentMeta?.provider ?? "openai",
      model: result.meta.agentMeta?.model ?? "school-claw-sedimentation",
      ...(result.meta.stopReason ? { stopReason: result.meta.stopReason } : {}),
      durationMs: result.meta.durationMs,
      requestToolNames: modelServer.consumeRequestToolNames(turn.id),
      workspaceContractInjected: modelServer.consumeRequestContractInjected(turn.id),
    });
  }

  process.stdout.write(
    JSON.stringify({
      runtime,
      runs,
      learningFactTurn: turns.learningFactTurn,
      followUpTurn: turns.followUpTurn,
      idleTurn: turns.idleTurn,
      forgedSsidTurn: turns.forgedSsidTurn,
      parentPracticeTurn: turns.parentPracticeTurn,
      parentCrossStudentRefusalTurn: turns.parentCrossStudentRefusalTurn,
      teacherErrorTableTurn: turns.teacherErrorTableTurn,
      logLines: [
        "OpenClaw Pi Runtime runEmbeddedPiAgent executed claw-agent turns",
        `${schoolConfig.openclawRuntime.checkoutPath}: OpenClaw Pi Runtime checkout`,
        "OpenClaw bundle MCP materialized CLAW MCP tools through Scope Bridge",
        runs.every((run) => run.workspaceContractInjected)
          ? "workspace AGENTS.md contract was injected"
          : "workspace AGENTS.md contract was missing",
        "real CLAW MCP server handled scope_get/files_append/files_read_all",
        "files_append writes scoped observation",
        "audit entry appears",
        "follow-up question reads and cites the new record",
        "input: greeting/idle chat -> no archive write occurs",
        "native file tools were not used",
      ],
    }),
  );
} finally {
  await modelServer.stop();
  await rm(tempRoot, { recursive: true, force: true });
}

function createOpenClawRuntimeConfig(params: {
  baseUrl: string;
  repoRoot: string;
  dataRoot: string;
  sessionKey: string;
  nowIso?: string;
}): Record<string, unknown> {
  const scopeBridgeCommand = nodeWithTsxLoaderCommand(params.repoRoot, [
    path.join(params.repoRoot, "scripts", "openclaw-scope-bridge-mcp-server.ts"),
  ]);
  const scopeBridgeServer = {
    command: scopeBridgeCommand.command,
    args: scopeBridgeCommand.args,
    cwd: params.repoRoot,
    env: {
      CLAW_DATA_DIR: params.dataRoot,
      CLAW_SCOPE_BRIDGE_REPO_ROOT: params.repoRoot,
      CLAW_SESSION_KEY: params.sessionKey,
      ...(params.nowIso ? { CLAW_NOW: params.nowIso } : {}),
    },
  };

  return {
    plugins: {
      enabled: false,
    },
    tools: {
      search: {
        enabled: false,
      },
    },
    models: {
      providers: {
        openai: {
          api: "openai-responses",
          apiKey: "sk-school-claw-test",
          baseUrl: `${params.baseUrl}/v1`,
          models: [
            {
              id: "school-claw-sedimentation",
              name: "School CLAW Sedimentation Test Model",
              reasoning: false,
              input: ["text"],
              cost: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
              },
              contextWindow: 1_000_000,
              maxTokens: 2048,
            },
          ],
        },
      },
    },
    mcp: {
      sessionIdleTtlMs: 1,
      servers: {
        claw: scopeBridgeServer,
      },
    },
  };
}

function nodeWithTsxLoaderCommand(repoRoot: string, args: string[]): {
  command: string;
  args: string[];
} {
  return {
    command: process.execPath,
    args: ["--import", path.join(repoRoot, TSX_ESM_LOADER_PATH), ...args],
  };
}

function installDeterministicResponsesFetch(params: {
  sessionKey: string;
  forgedSsid?: string;
  nowIso?: string;
}): {
  baseUrl: string;
  activateTurn(turn: HelperInput["turns"][number]): void;
  consumeRequestToolNames(turnId: string): string[][];
  consumeRequestContractInjected(turnId: string): boolean;
  stop(): Promise<void>;
} {
  let activeTurn: ActiveTurn | undefined;
  const requestToolNamesByTurn = new Map<string, string[][]>();
  const requestContractInjectedByTurn = new Map<string, boolean[]>();
  const originalFetch = globalThis.fetch;
  const deterministicFetch: typeof fetch = async (request, init) => {
    const url = request instanceof Request ? request.url : String(request);

    if (!url.endsWith("/v1/responses")) {
      return await originalFetch(request, init);
    }

    if (!activeTurn) {
      return Response.json({ error: "No active sedimentation turn." }, { status: 500 });
    }

    const body = await readFetchBody(request, init);
    const parsed = body ? (JSON.parse(body) as Record<string, unknown>) : {};
    const toolNames = readRequestToolNames(parsed);
    const contractInjected = requestContainsWorkspaceContract(parsed);
    activeTurn.requestToolNames.push(toolNames);
    activeTurn.requestContractInjected.push(contractInjected);
    requestToolNamesByTurn.set(activeTurn.id, activeTurn.requestToolNames);
    requestContractInjectedByTurn.set(activeTurn.id, activeTurn.requestContractInjected);

    const events = nextResponseEvents(activeTurn, {
      ...params,
      requestBody: parsed,
    })
      .map((event) => `data: ${JSON.stringify(event)}\n\n`)
      .join("");

    return new Response(`${events}data: [DONE]\n\n`, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
      },
    });
  };

  Object.assign(deterministicFetch, { mock: {} });
  globalThis.fetch = deterministicFetch;

  return {
    baseUrl: "http://127.0.0.1/v1",
    activateTurn(turn) {
      activeTurn = {
        ...turn,
        step: 0,
        requestToolNames: [],
        requestContractInjected: [],
      };
    },
    consumeRequestToolNames(turnId) {
      return requestToolNamesByTurn.get(turnId) ?? [];
    },
    consumeRequestContractInjected(turnId) {
      return requestContractInjectedByTurn.get(turnId)?.some(Boolean) ?? false;
    },
    async stop() {
      globalThis.fetch = originalFetch;
    },
  };
}

async function readFetchBody(
  request: RequestInfo | URL,
  init: RequestInit | undefined,
): Promise<string> {
  if (request instanceof Request) {
    return await request.clone().text();
  }

  const body = init?.body;

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString("utf8");
  }

  if (body && typeof (body as { getReader?: unknown }).getReader === "function") {
    const reader = (body as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];

    for (;;) {
      const chunk = await reader.read();

      if (chunk.done) {
        break;
      }

      chunks.push(chunk.value);
    }

    return Buffer.concat(chunks).toString("utf8");
  }

  return "";
}

function nextResponseEvents(
  turn: ActiveTurn,
  params: {
    sessionKey: string;
    forgedSsid?: string;
    nowIso?: string;
    requestBody: Record<string, unknown>;
  },
): Array<Record<string, unknown>> {
  const responseIndex = turn.step + 1;
  const step = turn.step;

  turn.step += 1;

  if (turn.scenario === "learning_fact") {
    if (step === 0) {
      return responseToolCall(responseIndex, "claw__scope_get", {
        ssid: params.sessionKey,
      });
    }
    if (step === 1) {
      return responseToolCall(
        responseIndex,
        "claw__files_append",
        buildAppendArguments({
          sessionKey: params.sessionKey,
          message: turn.message,
          ...(params.nowIso ? { nowIso: params.nowIso } : {}),
        }),
      );
    }
    return responseText(
      responseIndex,
      "已记录这条学习观察。证据文件：classes/class_001/students/stu_001/parent-observations/2026-06.md",
    );
  }

  if (turn.scenario === "follow_up") {
    if (step === 0) {
      return responseToolCall(responseIndex, "claw__scope_get", {
        ssid: params.sessionKey,
      });
    }
    if (step === 1) {
      return responseToolCall(responseIndex, "claw__files_read_all", {
        ssid: params.sessionKey,
        studentId: "stu_001",
        kinds: ["profile", "timeline", "errors", "observations"],
        maxFiles: 12,
        maxTotalChars: 24_000,
      });
    }
    return responseText(
      responseIndex,
      [
        "这条新记录说明：孩子做数学应用题时主要卡在审题，错因是没看清题目问的是什么。",
        "建议今晚先让孩子复述题目到底问什么，再做一题同类迁移。",
        "证据：2026-06-01 家长学习观察；错因：没看清题目问的是什么。",
      ].join("\n"),
    );
  }

  if (turn.scenario === "forged_ssid_cross_student") {
    if (step === 0) {
      return responseToolCall(responseIndex, "claw__scope_get", {
        ssid: params.sessionKey,
      });
    }
    if (step === 1) {
      return responseToolCall(responseIndex, "claw__files_append", {
        ssid: params.forgedSsid ?? params.sessionKey,
        target: {
          kind: "timeline",
          studentId: "stu_002",
          date: "2026-06-01",
        },
        frontmatter: {
          source_kind: "forged_ssid_security_probe",
        },
        content: [
          "# 2026-06-01 forged cross-student timeline",
          "",
          "- 不应写入：模型伪造 teacher ssid 写入另一个学生。",
        ].join("\n"),
        reason: "forged ssid probe must remain scoped to the real session",
      });
    }
    return responseText(responseIndex, "安全探针完成。");
  }

  if (turn.scenario === "parent_practice_artifact") {
    if (step === 0) {
      return responseToolCall(responseIndex, "claw__scope_get", {
        ssid: params.sessionKey,
      });
    }
    if (step === 1) {
      return responseToolCall(responseIndex, "claw__files_read_all", {
        ssid: params.sessionKey,
        studentId: "stu_001",
        kinds: ["profile", "errors"],
        maxFiles: 4,
        maxTotalChars: 16_000,
      });
    }
    if (step === 2) {
      return responseToolCall(responseIndex, "claw__artifact_create", {
        ssid: params.sessionKey,
        artifactType: "practice",
        title: "张三分数应用题练习",
        studentId: "stu_001",
        format: "markdown",
        content: [
          "# 张三分数应用题练习",
          "",
          "1. 先圈出单位一，再列式。",
          "2. 做完后说清题目问什么。",
          "",
          "答案提示：先找总量，再判断对应分率。",
        ].join("\n"),
        sourceFileIds: [
          "classes/class_001/students/stu_001/errors/2026-05.md",
          "classes/class_001/students/stu_001/profile.md",
        ],
      });
    }
    const artifactFileId =
      latestArtifactFileId(params.requestBody) ?? "artifact_create 未返回文件位置";

    return responseText(
      responseIndex,
      [
        "# 张三分数应用题练习",
        "",
        "今晚练习：",
        "1. 先圈出单位一，再列式。",
        "2. 做完后说清题目问什么。",
        "",
        "答案提示：先找总量，再判断对应分率。",
        "",
        "这份练习来自张三自己的错题记录和学习档案。",
        `已保存：${artifactFileId}`,
      ].join("\n"),
    );
  }

  if (turn.scenario === "parent_cross_student_refusal") {
    if (step === 0) {
      return responseToolCall(responseIndex, "claw__scope_get", {
        ssid: params.sessionKey,
      });
    }
    return responseText(responseIndex, "我只能回答您孩子的信息，不能查看其他学生。");
  }

  if (turn.scenario === "teacher_error_table_artifact") {
    if (step === 0) {
      return responseToolCall(responseIndex, "claw__scope_get", {
        ssid: params.sessionKey,
      });
    }
    if (step === 1) {
      return responseToolCall(responseIndex, "claw__files_read_all", {
        ssid: params.sessionKey,
        kinds: ["class", "errors", "timeline"],
        maxFiles: 20,
        maxTotalChars: 30_000,
      });
    }
    if (step === 2) {
      return responseToolCall(responseIndex, "claw__artifact_create", {
        ssid: params.sessionKey,
        artifactType: "error_table",
        title: "五年级一班本周数学错题表",
        format: "markdown",
        content: [
          "# 五年级一班本周数学错题表",
          "",
          "| 知识点 | 典型错因 |",
          "| --- | --- |",
          "| 分数应用题 | 单位一不稳 |",
        ].join("\n"),
        sourceFileIds: [
          "classes/class_001/class.md",
          "classes/class_001/students/stu_001/errors/2026-05.md",
        ],
      });
    }
    const artifactFileId =
      latestArtifactFileId(params.requestBody) ?? "artifact_create 未返回文件位置";

    return responseText(
      responseIndex,
      [
        "# 五年级一班本周数学错题表",
        "",
        "| 知识点 | 典型错因 |",
        "| --- | --- |",
        "| 分数应用题 | 单位一不稳 |",
        "",
        "依据：本周班级档案和学生错题记录，已按数学相关证据过滤。",
        `已保存：${artifactFileId}`,
      ].join("\n"),
    );
  }

  if (step === 0) {
    return responseToolCall(responseIndex, "claw__scope_get", {
      ssid: params.sessionKey,
    });
  }

  return responseText(responseIndex, "这条消息不会写入学习档案。");
}

function latestArtifactFileId(body: Record<string, unknown>): string | undefined {
  const candidates = collectArtifactFileIds(body);

  return candidates.at(-1);
}

function collectArtifactFileIds(value: unknown): string[] {
  if (typeof value === "string") {
    return extractArtifactFileIds(value);
  }

  if (Array.isArray(value)) {
    return value.flatMap(collectArtifactFileIds);
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap(collectArtifactFileIds);
  }

  return [];
}

function extractArtifactFileIds(text: string): string[] {
  const fromText = [...text.matchAll(/classes\/[^\s"'`]+\/artifacts\/[^\s"'`]+\.md/gu)]
    .map((match) => match[0]);

  try {
    return [
      ...fromText,
      ...collectArtifactFileIds(JSON.parse(text) as unknown),
    ];
  } catch {
    return fromText;
  }
}

function responseToolCall(
  index: number,
  name: SedimentationToolName,
  args: Record<string, unknown>,
): Array<Record<string, unknown>> {
  return [
    {
      type: "response.created",
      response: {
        id: `resp_${index}`,
      },
    },
    {
      type: "response.output_item.added",
      item: {
        id: `fc_${index}`,
        type: "function_call",
        call_id: `call_${index}`,
        name,
        arguments: "",
      },
    },
    {
      type: "response.function_call_arguments.delta",
      delta: JSON.stringify(args),
    },
    {
      type: "response.output_item.done",
      item: {
        id: `fc_${index}`,
        type: "function_call",
        call_id: `call_${index}`,
        name,
        arguments: JSON.stringify(args),
      },
    },
    completedEvent(index),
  ];
}

function responseText(index: number, text: string): Array<Record<string, unknown>> {
  return [
    {
      type: "response.created",
      response: {
        id: `resp_${index}`,
      },
    },
    {
      type: "response.output_item.added",
      item: {
        id: `msg_${index}`,
        type: "message",
        role: "assistant",
        content: [],
      },
    },
    {
      type: "response.output_text.delta",
      delta: text,
    },
    {
      type: "response.output_item.done",
      item: {
        id: `msg_${index}`,
        type: "message",
        role: "assistant",
        status: "completed",
        content: [
          {
            type: "output_text",
            text,
            annotations: [],
          },
        ],
      },
    },
    completedEvent(index),
  ];
}

function completedEvent(index: number): Record<string, unknown> {
  return {
    type: "response.completed",
    response: {
      id: `resp_${index}`,
      status: "completed",
      usage: {
        input_tokens: 100,
        output_tokens: 5,
        total_tokens: 105,
      },
    },
  };
}

function buildAppendArguments(params: {
  sessionKey: string;
  message: string;
  nowIso?: string;
}): Record<string, unknown> {
  const now = new Date(params.nowIso ?? Date.now()).toISOString();
  const extracted = extractLearningFields(params.message);

  return {
    ssid: params.sessionKey,
    target: {
      kind: "parent_observation",
      studentId: "stu_001",
      month: now.slice(0, 7),
    },
    frontmatter: compactRecord({
      source_kind: params.message.match(/孩子说|他说|她说/u)
        ? "parent_reported_student_speech"
        : "parent_observation",
      subject: extracted.subject,
      knowledge_point: extracted.knowledgePoint,
      error_cause: extracted.errorCause,
      issue: extracted.issue,
    }),
    content: [
      `# ${now.slice(0, 10)} 家长学习观察`,
      "",
      `- 原始输入：${params.message}`,
      ...optionalBullet("学科", extracted.subject),
      ...optionalBullet("知识点", extracted.knowledgePoint),
      ...optionalBullet("错因", extracted.errorCause),
      ...optionalBullet("问题", extracted.issue),
    ].join("\n"),
    reason: "durable parent learning evidence",
  };
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

function optionalBullet(label: string, value: string | undefined): string[] {
  return value ? [`- ${label}：${value}`] : [];
}

function compactRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined && value !== ""),
  );
}

async function readSessionEntries(sessionFile: string): Promise<SessionEntry[]> {
  const raw = await readFile(sessionFile, "utf8").catch((error: unknown) => {
    if (isNodeErrorWithCode(error, "ENOENT")) {
      return "";
    }
    throw error;
  });

  return raw
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SessionEntry);
}

function extractToolCalls(entries: SessionEntry[]): SedimentationToolCall[] {
  const pending = new Map<
    string,
    {
      toolName: SedimentationToolName;
      params: Record<string, unknown> & { ssid: string };
    }
  >();
  const calls: SedimentationToolCall[] = [];

  for (const entry of entries) {
    const message = entry.message;

    if (!message) {
      continue;
    }

    if (message.role === "assistant") {
      for (const block of message.content ?? []) {
        const toolCall = block as AssistantToolCallBlock;

        if (
          toolCall.type === "toolCall" &&
          toolCall.id &&
          isSedimentationToolName(toolCall.name) &&
          toolCall.arguments &&
          typeof toolCall.arguments.ssid === "string"
        ) {
          pending.set(toolCall.id, {
            toolName: toolCall.name,
            params: toolCall.arguments as Record<string, unknown> & { ssid: string },
          });
        }
      }
      continue;
    }

    if (message.role === "toolResult" && message.toolCallId) {
      const call = pending.get(message.toolCallId);

      if (!call) {
        continue;
      }

      calls.push({
        toolName: call.toolName,
        mcpToolName: toMcpToolName(call.toolName),
        transport: runtime,
        serverName: "claw",
        params: call.params,
        result: parseToolResult(message),
      });
    }
  }

  return calls;
}

function parseToolResult(message: NonNullable<SessionEntry["message"]>): unknown {
  const text = (message.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => String(block.text))
    .join("\n")
    .trim();

  if (!text) {
    return {
      ok: message.isError !== true,
    };
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {
      ok: false,
      text,
    };
  }
}

function toMcpToolName(toolName: SedimentationToolName): SedimentationMcpToolName {
  switch (toolName) {
    case "claw__artifact_create":
      return "artifact_create";
    case "claw__files_append":
      return "files_append";
    case "claw__files_read_all":
      return "files_read_all";
    case "claw__scope_get":
      return "scope_get";
  }
}

function isSedimentationToolName(value: unknown): value is SedimentationToolName {
  return (
    value === "claw__scope_get" ||
    value === "claw__files_append" ||
    value === "claw__files_read_all" ||
    value === "claw__artifact_create"
  );
}

function requestContainsWorkspaceContract(body: Record<string, unknown>): boolean {
  const serialized = JSON.stringify(body);

  return (
    serialized.includes("CLAW Agent Workspace") &&
    serialized.includes("Canonical Behavior Contract")
  );
}

function readRequestToolNames(body: Record<string, unknown>): string[] {
  const tools = body.tools;

  if (!Array.isArray(tools)) {
    return [];
  }

  return tools.flatMap((tool) => {
    if (
      tool &&
      typeof tool === "object" &&
      "name" in tool &&
      typeof tool.name === "string"
    ) {
      return [tool.name];
    }

    return [];
  });
}

function isOkResult(result: unknown): boolean {
  return (
    !!result &&
    typeof result === "object" &&
    "ok" in result &&
    (result as { ok?: unknown }).ok === true
  );
}

function isNodeErrorWithCode(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code;
}

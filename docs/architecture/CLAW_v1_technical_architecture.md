# CLAW v1 技术架构文档

> 版本：v0.3  
> 日期：2026-05-12  
> 状态：后续开发基准版  
> 关联 PRD：`CLAW_v1_product_prd.md`  
> 技术基座：OpenClaw Gateway + OpenClaw Pi Runtime + CLAW MCP Server + Markdown 文件数据库

---

## 0. 结论先行

CLAW v1 不做多学校平台，不做复杂后台，不做多个教育 agent。

第一版要做的是：

```text
一个班级
一个 OpenClaw Gateway
一个 claw-agent
一个 OpenClaw 原生 Pi runtime
一个 CLAW MCP Server
一个 Markdown 文件数据库
多个原生平台私聊 session
```

50 位家长不是 50 个 agent，而是 50 个稳定 session。

老师和家长都进入同一个 `claw-agent`，但每个会话有自己的 `ssid`。`ssid` 映射到不同的数据访问范围：

```text
parent ssid -> 只能访问自己孩子的 Markdown 档案
teacher ssid -> 可以访问整个班级的 Markdown 档案
```

真正的教育业务逻辑放在 `CLAW MCP Server`。OpenClaw 负责消息接入、session、agent loop、模型调用、工具调用和回复分发。

为了让权限可落地，v1 需要一个极薄的 `CLAW Scope Bridge Plugin`：

```text
OpenClaw before_tool_call hook
  -> 把真实 sessionKey 注入 CLAW MCP 工具参数 ssid
  -> 覆盖模型传入的 ssid
  -> 防止模型或用户伪造别人的 ssid
```

这个插件不做教育业务，只做 session 上下文注入。业务核心仍然是 MCP Server。

---

## 1. 背景

PRD 已锁定 CLAW v1 的产品范围：

- 只做一个真实班级。
- 直接用户只有老师和家长。
- 学生没有入口，是间接受益者。
- 第一版不做照片识别、OCR、教务系统、在线作业平台。
- 核心资产是每个学生的长期学习档案。
- 老师端主打记录、查询、生成、沟通、计划。
- 家长端主打围绕自己孩子的强结论、适度安抚、明确建议。
- 家长只能访问自己孩子，不能访问其他学生或全班名单。

技术设计要回答的问题是：

```text
如何用 OpenClaw 稳定接入原生聊天平台，
如何把每个聊天窗口映射成独立 session，
如何让同一个 agent 在不同 session 下看到不同 Markdown 数据，
如何保证家长不能读到其他孩子，
如何让老师和家长用自然语言完成记录、查询和生成。
```

---

## 2. 技术目标

### 2.1 用户接入目标

家长和老师通过原生聊天平台进入 CLAW。

理想体验：

```text
扫码
进入和 CLAW bot 的私聊窗口
直接说话
```

系统内部要把这个私聊窗口解析为稳定的 OpenClaw `sessionKey`，并把它作为 CLAW 的 `ssid`。

### 2.2 Agent 目标

v1 只有一个 agent：

```text
claw-agent
```

它不是 `parent-agent`，也不是 `teacher-agent`。它是一个统一教育 Agent，通过当前 `ssid` 判断自己能访问什么数据。

### 2.3 数据目标

学生学习档案使用 Markdown 文件驱动。

Markdown 是 v1 的权威数据源，至少保存：

- 学生基本信息。
- 老师观察。
- 家长观察。
- 错题描述。
- 错因描述。
- 知识点。
- 学习习惯。
- 情绪和状态。
- 阶段总结。
- 生成过的练习、反馈、周报、PPT 大纲。

### 2.4 权限目标

权限必须落在工具层和数据层，而不是只靠 prompt。

技术上：

```text
OpenClaw sessionKey
  -> CLAW ssid
  -> SessionScope
  -> read roots / write roots
  -> MCP file operation guard
```

家长工具调用只能返回自己孩子的数据。

老师工具调用可以返回班级和学生数据。

### 2.5 工具目标

工具必须是元工具，不是任务工具。

要做：

```text
list files
read files
append file
write file
create artifact
audit log
scope get
```

不做：

```text
generate_today_report
generate_parent_feedback
generate_practice
generate_weekly_summary
```

这些任务由 agent 组合元工具完成。

### 2.6 可验证目标

技术方案必须能被测试证明：

- 两个不同家长私聊生成不同 `sessionKey`。
- 家长 A 无法通过任何工具读取家长 B 孩子文件。
- 同一个 `claw-agent` 在不同 `ssid` 下读到不同文件。
- 老师可以读取全班，家长不能读取全班。
- 并发消息不会写坏同一份 Markdown。
- 所有写操作有审计记录。

---

## 3. 非目标

v1 不做以下技术内容：

- 不做学生端 App。
- 不做自研聊天客户端。
- 不做完整小程序聊天 UI。
- 不做多学校、多班级 SaaS 架构。
- 不做复杂 RBAC 后台。
- 不做传统关系型数据库作为主存储。
- 不做 OCR、拍照批改、视觉识别。
- 不做完整题库系统。
- 不做强标准化知识图谱。
- 不做多个教育 agent。
- 不做每个任务一个工具。
- 不让 agent 直接用 OpenClaw 原生 `read/write/edit` 读取 `claw-data`。
- 不把 OpenClaw `sessionKey` 当成用户认证本身。

`sessionKey` 只做会话范围 ID。真正授权必须由 CLAW MCP Server 根据 `ssid -> SessionScope` 决定。

---

## 4. OpenClaw 可行性核对

本架构基于已核对的 OpenClaw 源码和文档。

### 4.1 独立私聊 session 可行

OpenClaw 的 `session.dmScope` 支持：

```text
main
per-peer
per-channel-peer
per-account-channel-peer
```

配置：

```json5
{
  session: {
    dmScope: "per-channel-peer"
  }
}
```

源码依据：

- `src/routing/session-key.ts:130` 定义 `buildAgentPeerSessionKey`。
- `src/routing/session-key.ts:162` 在 `per-channel-peer` 下生成 `agent:<agentId>:<channel>:direct:<peerId>`。
- `docs/gateway/config-agents.md:1209` 说明 `dmScope`。
- `docs/gateway/security/index.md:565` 说明默认 `main` 会让所有 DM 共享 session，安全 DM 模式是 `per-channel-peer`。

结论：

```text
50 个家长私聊可以变成 50 个不同 sessionKey。
```

### 4.2 单 agent 路由可行

OpenClaw 的 route resolver 会根据 channel/account/peer/binding 选择 agent，并生成 sessionKey。

源码依据：

- `src/routing/resolve-route.ts:610` 是 `resolveAgentRoute`。
- `src/routing/resolve-route.ts:657` 的 `choose()` 会确定 `agentId` 和 `sessionKey`。
- `src/routing/resolve-route.ts:818` 没有命中 binding 时回到默认 agent。
- `docs/gateway/config-agents.md:1019` 说明 multi-agent routing。

v1 可以只配置一个默认 `claw-agent`，所有平台消息都路由到它。

### 4.3 并发不会因为同一个 workspace 直接冲突

OpenClaw 的 agent run 按 session key 序列化。

源码和文档依据：

- `docs/concepts/agent-loop.md:45` 说明 runs are serialized per session key。
- `docs/concepts/queue.md:18` 说明 lane-aware FIFO queue。
- `docs/concepts/queue.md:19` 说明 `runEmbeddedPiAgent` uses lane `session:<key>`。
- `src/agents/pi-embedded-runner/run.ts:350` 使用 `resolveSessionLane(params.sessionKey...)`。

结论：

```text
同一个家长 session 内的消息串行处理。
不同家长 session 可以并发处理。
全局并发由 agents.defaults.maxConcurrent 控制。
```

但 Markdown 文件写入仍然需要 CLAW MCP Server 自己做文件锁或原子写。

### 4.4 OpenClaw 原生 runtime 可用

OpenClaw 的真实 agent loop 是：

```text
Gateway RPC / CLI
  -> agentCommand
  -> runEmbeddedPiAgent
  -> pi-agent-core
  -> model inference
  -> tool execution
  -> persistence
```

依据：

- `docs/concepts/agent-loop.md:24` 到 `docs/concepts/agent-loop.md:37` 说明完整 agent loop。
- `src/agents/pi-embedded-runner/run.ts:336` 定义 `runEmbeddedPiAgent`。
- `docs/gateway/config-agents.md:401` 说明 `agentRuntime.id: "pi"` 是内置 Pi harness。

结论：

```text
CLAW v1 可以使用 OpenClaw 原生 Pi runtime，不依赖 Codex runtime。
```

### 4.5 MiniMax 等非 OpenAI 模型可用

OpenClaw 的模型和 runtime 是分开的：

```text
agentRuntime.id = "pi"
model.primary = "minimax/MiniMax-M2.7"
```

依据：

- `docs/gateway/config-agents.md:390` 说明模型引用格式是 `provider/model`。
- `docs/gateway/config-agents.md:401` 说明 runtime 通过 `agentRuntime` 选择。
- `docs/providers/minimax.md:9` 说明 OpenClaw MiniMax 默认是 MiniMax M2.7。
- `docs/gateway/config-tools.md:553` 给出 MiniMax M2.7 配置示例。

结论：

```text
CLAW v1 可以用 MiniMax M2.7 作为主模型，也可以配置 fallback。
```

### 4.6 MCP Server 可接入 OpenClaw Pi runtime

OpenClaw 的 `mcp.servers` 会被嵌入 Pi runtime 消费，并转成模型可调用工具。

依据：

- `docs/gateway/configuration-reference.md:84` 说明 `mcp.servers` 被 embedded Pi 和其他 runtime adapters 消费。
- `docs/tools/index.md:172` 说明 `coding` 和 `messaging` profiles 会允许 configured bundle MCP tools。
- `src/agents/pi-bundle-mcp-runtime.ts:181` 创建 session-scoped MCP runtime。
- `src/agents/pi-bundle-mcp-runtime.ts:228` 遍历 `mcpServers`。
- `src/agents/pi-bundle-mcp-materialize.ts:98` 把 MCP tool 转成 provider-safe tool name。
- `src/agents/pi-bundle-mcp-names.ts:7` MCP 工具名分隔符是 `__`。

结论：

如果 MCP server 名叫 `claw`，工具 `files_read` 在模型侧通常显示为：

```text
claw__files_read
```

### 4.7 为什么还需要 Scope Bridge Plugin

普通 MCP 工具本身不知道当前 OpenClaw `sessionKey`。

OpenClaw 创建 session-scoped MCP runtime 时内部持有 `sessionKey`，但当前 bundle MCP 调用不会自动把 `sessionKey` 注入每一次 MCP tool args。

依据：

- `src/agents/pi-bundle-mcp-runtime.ts:181` `createSessionMcpRuntime` 接收 `sessionKey`。
- `src/agents/pi-bundle-mcp-runtime.ts:351` `callTool(serverName, toolName, input)` 只把 `input` 作为 `arguments` 传给 MCP server。
- `src/agents/mcp-stdio-transport.ts:50` stdio server 启动 env 来自静态 MCP server config。

所以，若只做 MCP Server，并让模型自己传 `ssid`，这是可跑通的 demo，但不是可靠权限边界。

OpenClaw 已有 hook 能在工具执行前拿到真实 `sessionKey` 并修改参数。

依据：

- `docs/concepts/agent-loop.md:99` 说明有 `before_tool_call` hook。
- `src/agents/pi-tools.before-tool-call.ts:497` 构造 tool context。
- `src/agents/pi-tools.before-tool-call.ts:501` 把 `ctx.sessionKey` 放入 hook context。
- `src/agents/pi-tools.before-tool-call.ts:599` hook 可以返回修改后的 `params`。
- `src/agents/pi-tools.before-tool-call.ts:620` 工具执行前会被 hook wrapper 包住。

因此 v1 的可行安全路径是：

```text
CLAW Scope Bridge Plugin
  before_tool_call(toolName startsWith "claw__")
    params.ssid = ctx.sessionKey
    return { params }
```

MCP Server 只相信被注入后的 `ssid`。

---

## 5. 系统结构

### 5.1 总体结构

```text
家长 / 老师
  ↓
原生聊天平台私聊窗口
  ↓
OpenClaw Channel Plugin
  ↓
OpenClaw Gateway
  ↓
resolveAgentRoute()
  ↓
sessionKey / ssid
  ↓
claw-agent
  ↓
OpenClaw Pi Runtime
  ↓
模型 provider
  ↓
CLAW Scope Bridge Plugin
  ↓
CLAW MCP Server
  ↓
Markdown 文件数据库
```

### 5.2 组件职责

| 组件 | 职责 | v1 是否自研 |
| --- | --- | --- |
| 原生聊天平台 | 家长和老师入口 | 不自研 |
| Channel Plugin | 把平台消息规范化给 OpenClaw | 选用现有或社区插件 |
| OpenClaw Gateway | 消息接入、路由、session、运行 agent | 使用 OpenClaw |
| claw-agent | 统一教育 Agent | 配置和 prompt 自研 |
| OpenClaw Pi Runtime | agent loop、模型调用、工具调用 | 使用 OpenClaw |
| CLAW Scope Bridge Plugin | 注入真实 `ssid` 到 CLAW 工具 | 自研，很薄 |
| CLAW MCP Server | 教育数据访问、权限、Markdown 读写 | 自研，核心 |
| Markdown 文件数据库 | 学生长期学习档案 | 自研结构 |

### 5.3 为什么不是 50 个 agent

50 个家长对应 50 个 session，不对应 50 个 agent。

如果做 50 个 agent，会带来：

- 50 套 agent 配置。
- 50 套 workspace。
- 50 套 prompt/skill 版本管理。
- 后续老师查询全班时反而更难整合。

v1 正确拆分是：

```text
agent = 行为能力
session = 对话上下文和权限范围
Markdown scope = 能访问的数据
```

因此：

```text
1 个 claw-agent
50 个 parent session
1 个 teacher session
50 份学生档案目录
```

### 5.4 workspace 的作用

`claw-agent` 的 workspace 只放 agent 行为相关文件：

```text
workspaces/claw-agent/
  AGENTS.md
  IDENTITY.md
  USER.md
  BOOTSTRAP.md
  prompts/
```

不要把学生数据直接放在 agent workspace 里。

学生数据放在：

```text
claw-data/
```

并且只允许 CLAW MCP Server 访问。

这样可以避免 agent 使用 OpenClaw 原生 `read/write/edit` 绕过权限读取整个班级数据。

---

## 6. 平台接入设计

### 6.1 平台无关原则

CLAW v1 不把架构绑死在某一个平台。

OpenClaw 只需要 channel plugin 给出：

```text
channel
accountId
peer.kind
peer.id
message text
reply target
```

然后 OpenClaw 能生成 sessionKey。

### 6.2 候选平台可行性

| 平台 | OpenClaw 当前支持情况 | 私聊/群聊能力 | v1 判断 |
| --- | --- | --- | --- |
| Feishu/Lark | OpenClaw 内置文档显示 production-ready | bot DMs + group chats | 稳定候选 |
| QQ Bot | OpenClaw downloadable plugin | C2C private chat + group + guild | 扫码私聊候选 |
| DingTalk | OpenClaw 社区插件 `@largezhou/ddingtalk` | 官方 Stream Mode 支持单聊和群聊收消息 | 需要 spike 验证 |
| WeChat | 外部 `openclaw-weixin` plugin | direct chats supported，群聊能力未在 metadata 广告 | 不作为 v1 首选 |

重要约束：

```text
OpenClaw 能处理私聊 session，
但“每个家长一个唯一二维码，并且二维码携带学生绑定信息”
是否成立，取决于具体平台是否支持 bot deep link / invite parameter。
```

所以 v1 的架构不依赖平台一定能传递二维码参数。

### 6.3 推荐入群/私聊路径

优先路径：

```text
家长扫码进入 bot 私聊
家长发第一条消息
OpenClaw 得到 platform peer id
CLAW 根据 peer id 查 registry
已绑定 -> 直接进入可用状态
未绑定 -> 要求输入老师给的一次性授权码
```

如果平台支持唯一二维码携带 invite token，则可以优化成：

```text
家长扫个人二维码
平台把 invite token 带到 bot 私聊
CLAW 自动绑定 peer id -> student_id
家长直接可用
```

如果平台不支持 invite token，第一版仍然可用，只是多一步授权码。

### 6.4 v1 平台 spike 验收

选定平台前必须做 spike，验收标准：

1. 新家长扫码后能进入 bot 私聊。
2. 家长发消息后 OpenClaw 日志能看到稳定 peer id。
3. 同一个家长多次发消息 peer id 不变。
4. 两个家长的 `sessionKey` 不同。
5. Bot 能回复私聊。
6. 如果需要老师群，群聊消息能带出稳定 group id。

只有满足以上条件，才能作为试点入口。

---

## 7. ssid 与权限模型

### 7.1 ssid 定义

`ssid` 是 CLAW 的 Session Scope ID。

v1 直接使用 OpenClaw `sessionKey`：

```text
agent:claw-agent:feishu:direct:<open_id>
agent:claw-agent:qqbot:direct:<openid>
agent:claw-agent:dingtalk:direct:<user_id>
```

如果某个平台 sessionKey 过长或含不适合作文件名的字符，文件层使用 hash：

```text
ssid_hash = sha256(ssid).slice(0, 16)
```

但业务层仍然以原始 `ssid` 为准。

### 7.2 SessionScope

每个已绑定 session 都有一个 `SessionScope`。

```ts
type SessionScope = {
  ssid: string
  ssidHash: string
  role: 'parent' | 'teacher'
  status: 'active' | 'disabled'
  platform: 'feishu' | 'qqbot' | 'dingtalk' | 'openclaw-weixin' | string
  peerKind: 'direct' | 'group' | 'channel'
  peerId: string
  classId: string
  parentId?: string
  teacherId?: string
  studentIds: string[]
  readRoots: string[]
  writeRoots: string[]
  capabilities: string[]
  createdAt: string
  updatedAt: string
}
```

家长 scope 示例：

```yaml
ssid: agent:claw-agent:qqbot:direct:parent-openid-001
ssidHash: 4f9a1c4bd7a83310
role: parent
status: active
platform: qqbot
peerKind: direct
peerId: parent-openid-001
classId: class_001
parentId: parent_001
studentIds:
  - stu_001
readRoots:
  - classes/class_001/students/stu_001
  - classes/class_001/public
writeRoots:
  - classes/class_001/students/stu_001/parent-observations
  - classes/class_001/students/stu_001/artifacts
capabilities:
  - read_own_child
  - append_parent_observation
  - create_child_artifact
```

老师 scope 示例：

```yaml
ssid: agent:claw-agent:feishu:direct:teacher-openid-001
ssidHash: 79d612d61e7e6de1
role: teacher
status: active
platform: feishu
peerKind: direct
peerId: teacher-openid-001
classId: class_001
teacherId: teacher_001
studentIds:
  - '*'
readRoots:
  - classes/class_001
writeRoots:
  - classes/class_001
capabilities:
  - read_class
  - write_class
  - create_class_artifact
```

### 7.3 权限判断规则

所有 MCP 文件操作都按以下流程：

```text
input args
  ↓
Scope Bridge 注入真实 ssid
  ↓
MCP Server load SessionScope
  ↓
校验 status active
  ↓
解析 fileId 到真实路径
  ↓
校验路径在 readRoots/writeRoots 内
  ↓
执行读写
  ↓
写 audit log
```

禁止：

- MCP Server 直接信任用户传入的路径。
- MCP Server 直接信任模型传入的 `ssid`。
- 工具接收任意绝对路径。
- 家长 scope 访问 `classes/class_001/students` 根目录。

---

## 8. Markdown 文件数据库

### 8.1 目录结构

```text
claw-data/
  registry/
    sessions/
      4f9a1c4bd7a83310.md
      79d612d61e7e6de1.md
    invite-codes/
      parent_001.md
    parents/
      parent_001.md
    teachers/
      teacher_001.md

  classes/
    class_001/
      class.md
      public/
        syllabus.md
        weekly-plan.md
      students/
        stu_001/
          profile.md
          knowledge.md
          timeline/
            2026-05-12.md
          errors/
            2026-05.md
          parent-observations/
            2026-05.md
          teacher-observations/
            2026-05.md
          artifacts/
            2026-05-12-practice.md
            2026-05-12-parent-brief.md
        stu_002/
          ...
      artifacts/
        class-weekly-summary-2026-W20.md
        class-error-table-2026-W20.md

  audit/
    2026-05/
      2026-05-12.md
```

### 8.2 Markdown 文件格式

每个 Markdown 文件使用 YAML front matter + 正文。

学生 profile：

```markdown
---
type: student_profile
student_id: stu_001
class_id: class_001
name: 张三
grade: 五年级
created_at: 2026-05-12T09:00:00+08:00
updated_at: 2026-05-12T09:00:00+08:00
---

# 张三学习档案

## 基本情况

...
```

学习事件：

```markdown
---
type: learning_event
event_id: evt_20260512_001
student_id: stu_001
class_id: class_001
source_role: parent
source_ssid_hash: 4f9a1c4bd7a83310
subject: math
knowledge_points:
  - 分数应用题
error_reasons:
  - 没找准单位一
occurred_on: 2026-05-12
created_at: 2026-05-12T20:14:00+08:00
---

孩子说今天第 3 题错了，原因是没找准单位一。
```

生成产物：

```markdown
---
type: artifact
artifact_id: art_20260512_001
artifact_type: practice
student_id: stu_001
class_id: class_001
created_by_ssid_hash: 4f9a1c4bd7a83310
created_at: 2026-05-12T20:20:00+08:00
---

# 分数应用题专项练习

...
```

### 8.3 文件 ID

MCP 工具不暴露任意绝对路径。

工具返回和接收 `fileId`：

```text
classes/class_001/students/stu_001/timeline/2026-05-12.md
```

MCP Server 内部把 `fileId` 解析为：

```text
<CLAW_DATA_DIR>/<fileId>
```

并做：

- normalize path。
- 禁止 `..`。
- 禁止绝对路径。
- 禁止 symlink escape。
- 校验是否在 scope roots 内。

### 8.4 写入策略

v1 优先 append-only。

推荐：

- 新观察写入 `timeline`、`parent-observations`、`teacher-observations`。
- 生成产物写入 `artifacts`。
- `profile.md` 和 `knowledge.md` 少量结构化更新，必须先读后写。

文件写入必须：

- 使用临时文件 + 原子 rename。
- 同一文件写入加锁。
- 每次写入生成 audit log。
- 保留必要的 `updated_at`。

---

## 9. MCP 工具接口

工具名在 MCP server 内部可以叫 `scope_get`、`files_list`。OpenClaw 暴露给模型时会加 server 前缀，例如：

```text
claw__scope_get
claw__files_list
```

所有 CLAW MCP 工具都有一个可选 `ssid` 字段：

```ts
type InjectedScopeArgs = {
  ssid?: string
}
```

模型不应该自己填写 `ssid`。`CLAW Scope Bridge Plugin` 会在执行前强制注入真实值。

### 9.1 `claw__scope_get`

用途：读取当前 session 的可见范围。

Request:

```ts
type ScopeGetRequest = {
  ssid?: string
}
```

Response:

```ts
type ScopeGetResponse = {
  scope: {
    role: 'parent' | 'teacher'
    classId: string
    studentIds: string[]
    capabilities: string[]
    displayName: string
  }
}
```

错误：

- `UNBOUND_SESSION`: session 尚未绑定。
- `SESSION_DISABLED`: session 已禁用。

### 9.2 `claw__files_list`

用途：列出当前 scope 可访问文件。

Request:

```ts
type FilesListRequest = {
  ssid?: string
  kind?: 'profile' | 'knowledge' | 'timeline' | 'errors' | 'observations' | 'artifacts' | 'class'
  studentId?: string
  dateFrom?: string
  dateTo?: string
  query?: string
  limit?: number
}
```

Response:

```ts
type FilesListResponse = {
  files: Array<{
    fileId: string
    title: string
    kind: string
    studentId?: string
    updatedAt?: string
    excerpt?: string
  }>
}
```

家长传入其他学生 `studentId` 时返回 `FORBIDDEN`。

### 9.3 `claw__files_read`

用途：读取指定文件。

Request:

```ts
type FilesReadRequest = {
  ssid?: string
  fileIds: string[]
  maxChars?: number
}
```

Response:

```ts
type FilesReadResponse = {
  documents: Array<{
    fileId: string
    title: string
    frontmatter: Record<string, unknown>
    content: string
  }>
}
```

错误：

- `FORBIDDEN`: 文件不在 readRoots 内。
- `TOO_LARGE`: 超过读取上限。
- `NOT_FOUND`: 文件不存在。

### 9.4 `claw__files_read_all`

用途：读取当前 scope 下与任务有关的一组文件。

这是为了支持用户说：

```text
根据我孩子最近情况生成练习。
```

Agent 可以先读取近期可见文件，再自己决定怎么生成。

Request:

```ts
type FilesReadAllRequest = {
  ssid?: string
  studentId?: string
  kinds?: Array<'profile' | 'knowledge' | 'timeline' | 'errors' | 'observations' | 'artifacts' | 'class'>
  dateFrom?: string
  dateTo?: string
  maxFiles?: number
  maxTotalChars?: number
}
```

Response:

```ts
type FilesReadAllResponse = {
  documents: Array<{
    fileId: string
    title: string
    frontmatter: Record<string, unknown>
    content: string
  }>
  truncated: boolean
}
```

### 9.5 `claw__files_append`

用途：追加一条学习记录或观察。

Request:

```ts
type FilesAppendRequest = {
  ssid?: string
  target:
    | { kind: 'parent_observation'; studentId: string; month?: string }
    | { kind: 'teacher_observation'; studentId: string; month?: string }
    | { kind: 'timeline'; studentId: string; date?: string }
    | { kind: 'class_note'; date?: string }
  frontmatter?: Record<string, unknown>
  content: string
  reason: string
}
```

Response:

```ts
type FilesAppendResponse = {
  fileId: string
  appended: true
  auditId: string
}
```

### 9.6 `claw__files_write`

用途：创建或替换受控文件。

仅用于生成产物、阶段总结、知识状态摘要等明确文件。

Request:

```ts
type FilesWriteRequest = {
  ssid?: string
  fileId: string
  mode: 'create' | 'replace'
  frontmatter?: Record<string, unknown>
  content: string
  reason: string
}
```

Response:

```ts
type FilesWriteResponse = {
  fileId: string
  written: true
  auditId: string
}
```

### 9.7 `claw__artifact_create`

用途：创建生成产物。

Request:

```ts
type ArtifactCreateRequest = {
  ssid?: string
  artifactType: 'brief' | 'practice' | 'feedback' | 'weekly_summary' | 'ppt_outline' | 'error_table'
  title: string
  studentId?: string
  format: 'markdown' | 'csv' | 'ppt_outline'
  content: string
  sourceFileIds?: string[]
}
```

Response:

```ts
type ArtifactCreateResponse = {
  artifactId: string
  fileId: string
  auditId: string
}
```

### 9.8 `claw__audit_log`

用途：显式记录一次重要操作。

Request:

```ts
type AuditLogRequest = {
  ssid?: string
  action: string
  targetFileIds?: string[]
  summary: string
}
```

Response:

```ts
type AuditLogResponse = {
  auditId: string
}
```

### 9.9 后续可选 primitive schedule tools

老师的“每周五整理周报”“明早提醒”可以后续增加 primitive schedule tools：

```text
claw__schedule_create
claw__schedule_list
claw__schedule_cancel
```

这些仍然是元工具，不是任务工具。

它们内部可以调用 OpenClaw cron 或写入待办计划。v1 MVP 可以先不做，等记录/查询/生成闭环跑通后再加。

---

## 10. OpenClaw 配置草案

```json5
{
  session: {
    dmScope: "per-channel-peer"
  },

  agents: {
    defaults: {
      agentRuntime: { id: "pi" },
      model: {
        primary: "minimax/MiniMax-M2.7",
        fallbacks: ["openai/gpt-5.5"]
      },
      maxConcurrent: 4,
      timeoutSeconds: 600
    },
    list: [
      {
        id: "claw-agent",
        default: true,
        name: "CLAW Agent",
        workspace: "/Users/leon/claw/workspaces/claw-agent",
        systemPromptOverride: "/Users/leon/claw/prompts/claw-agent.md",
        tools: {
          profile: "messaging",
          allow: [
            "bundle-mcp",
            "message",
            "session_status"
          ],
          deny: [
            "read",
            "write",
            "edit",
            "apply_patch",
            "exec",
            "process",
            "browser",
            "gateway",
            "cron",
            "nodes",
            "canvas"
          ]
        }
      }
    ]
  },

  mcp: {
    sessionIdleTtlMs: 600000,
    servers: {
      claw: {
        command: "node",
        args: ["/Users/leon/claw/claw-mcp-server/dist/index.js"],
        env: {
          CLAW_DATA_DIR: "/Users/leon/claw/claw-data"
        }
      }
    }
  },

  bindings: [
    {
      agentId: "claw-agent",
      match: {
        channel: "feishu",
        accountId: "*",
        peer: { kind: "direct", id: "*" }
      }
    },
    {
      agentId: "claw-agent",
      match: {
        channel: "qqbot",
        accountId: "*",
        peer: { kind: "direct", id: "*" }
      }
    },
    {
      agentId: "claw-agent",
      match: {
        channel: "dingtalk",
        accountId: "*",
        peer: { kind: "direct", id: "*" }
      }
    }
  ]
}
```

说明：

- `dmScope: "per-channel-peer"` 是必须项。
- `tools.profile: "messaging"` 加 `allow: ["bundle-mcp"]` 让 agent 能调用 CLAW MCP 工具。
- 禁用 OpenClaw 原生文件和执行工具，防止绕过 MCP 权限。
- `bindings` 可以先不写，默认 agent 也能工作；写出来是为了让路由意图显式。
- DingTalk channel 名要以实际社区插件注册名为准，spike 后确认。

---

## 11. Agent Prompt 设计

`claw-agent` 的 prompt 必须强调：

1. 当前用户的数据范围由 CLAW 工具决定。
2. 每轮需要先调用 `claw__scope_get` 或从已有上下文确认 scope。
3. 需要查询事实时，必须先读 Markdown 文件。
4. 不能编造孩子历史记录。
5. 家长问其他学生或全班名单时必须拒绝。
6. 老师可以查全班，家长不可以。
7. 新的学习观察要写入对应文件。
8. 生成产物尽量保存为 artifact。
9. 工具是元工具，任务由自己组合。

Prompt 里的核心行为规则：

```text
如果用户提供了新的学习事实：
  先判断是否值得沉淀。
  如值得，使用 files_append 写入对应学生档案。

如果用户询问孩子情况：
  使用 files_list / files_read_all 读取可见档案。
  基于证据回答。

如果用户要求生成练习、反馈、周报：
  先读取相关档案。
  生成内容。
  使用 artifact_create 保存。
  再把结果摘要发给用户。
```

---

## 12. 核心业务流程

### 12.1 家长问“我孩子今天怎么样”

```text
家长消息
  ↓
OpenClaw route -> sessionKey
  ↓
claw-agent
  ↓
claw__scope_get
  ↓
确认 role=parent, studentIds=[stu_001]
  ↓
claw__files_list(kind=timeline/date=today)
  ↓
claw__files_read
  ↓
模型生成强结论 + 安抚 + 下一步建议
  ↓
message reply
```

### 12.2 家长说“孩子今天第 5 题错了”

```text
家长消息
  ↓
scope_get
  ↓
判断这是学习事实
  ↓
files_append(target=parent_observation/timeline)
  ↓
回复：已记录 + 简短追问或建议
```

### 12.3 家长要个性化练习

```text
家长消息
  ↓
scope_get
  ↓
files_read_all(profile, knowledge, recent timeline, errors)
  ↓
模型生成练习
  ↓
artifact_create(artifactType=practice)
  ↓
回复练习内容和保存位置
```

### 12.4 老师记录学生问题

```text
老师消息：张三今天分数应用题第 3 题错了...
  ↓
scope_get -> role=teacher
  ↓
识别学生 张三 -> stu_001
  ↓
files_append(target=teacher_observation/timeline)
  ↓
回复：已记录到张三档案
```

### 12.5 老师查询全班薄弱点

```text
老师消息
  ↓
scope_get -> role=teacher
  ↓
files_read_all(kinds=errors/timeline/knowledge, date range=this week)
  ↓
模型汇总薄弱知识点和代表性错因
  ↓
artifact_create(artifactType=weekly_summary 或 error_table)
  ↓
回复摘要
```

### 12.6 家长越权查询

```text
家长消息：李四最近怎么样？
  ↓
scope_get -> role=parent, studentIds=[stu_001]
  ↓
模型发现查询对象不在 scope 内
  ↓
不调用 files_read
  ↓
回复拒绝：我只能回答您孩子的信息
```

如果模型错误调用：

```text
files_read(fileId=classes/class_001/students/stu_002/...)
```

MCP Server 也必须返回：

```text
FORBIDDEN
```

---

## 13. 前端 / 聊天状态设计

v1 没有自研前端聊天 UI，但聊天体验仍然有状态。

### 13.1 Session 状态

```text
unbound       未绑定学生或老师
ready         已绑定，可以使用
disabled      已禁用
needs_auth    需要输入一次性授权码
```

### 13.2 单次消息处理状态

```text
received       收到消息
queued         等待该 session lane
processing     agent 正在处理
tool_reading    正在读档案
tool_writing    正在写档案
replying        正在回复
done            完成
failed          失败
```

用户可见的状态不需要复杂 UI。平台支持 typing/progress 时可以显示“正在整理”。

### 13.3 典型错误状态

| 状态 | 用户文案方向 |
| --- | --- |
| `UNBOUND_SESSION` | “这个聊天还没有绑定学生，请输入老师给你的授权码。” |
| `FORBIDDEN` | “我只能查看你孩子的信息，不能查看其他同学。” |
| `NOT_FOUND` | “目前还没有找到这部分记录。” |
| `TOO_LARGE` | “记录太多，我先按最近一段时间整理。” |
| `TOOL_ERROR` | “刚才读取档案失败，我已经记录错误，请稍后再试。” |

---

## 14. 业务逻辑设计

### 14.1 信息沉淀规则

不是所有聊天都写入档案。

应该写入：

- 错题。
- 错因。
- 知识点。
- 老师观察。
- 家长观察。
- 学习习惯。
- 情绪状态。
- 明确的阶段总结。

不应写入：

- 寒暄。
- 无关闲聊。
- 没有事实依据的猜测。
- 用户要求删除或纠正前尚未确认的信息。

### 14.2 家长回答规则

家长端回答必须：

- 有明确结论。
- 引用孩子自己的记录。
- 给出今晚或近期可执行动作。
- 不暴露其他学生。
- 心理和情绪问题只能做学习状态观察，不做医学诊断。

### 14.3 老师回答规则

老师端回答必须：

- 更结构化。
- 能生成可复制材料。
- 支持全班视角。
- 保留证据来源。
- 对不确定的学生姓名主动澄清。

### 14.4 生成练习规则

练习生成不是题库系统。

v1 只生成轻量练习建议或自拟题：

- 围绕最近错因。
- 数量少而精准。
- 附简短答案或讲解。
- 写入 artifact。

### 14.5 档案更新规则

`knowledge.md` 可以被更新，但不能让模型随意覆盖长期结论。

建议流程：

```text
新事件 append
  ↓
达到阈值或老师要求总结
  ↓
生成阶段总结 artifact
  ↓
需要时更新 knowledge.md
```

---

## 15. 测试计划

### 15.1 Unit tests

CLAW MCP Server：

- `resolveScope(ssid)` 找到正确 SessionScope。
- 未绑定 ssid 返回 `UNBOUND_SESSION`。
- disabled session 返回 `SESSION_DISABLED`。
- parent scope 只能访问自己的 `studentId`。
- teacher scope 可以访问 class root。
- `fileId` 禁止 `..`。
- `fileId` 禁止绝对路径。
- symlink escape 被拒绝。
- front matter parse / stringify 正确。
- append 保留原内容并追加记录。
- write 使用原子写。
- audit log 必定生成。

Scope Bridge Plugin：

- `before_tool_call` 对 `claw__*` 工具注入 `ctx.sessionKey`。
- 模型传入错误 `ssid` 时被覆盖。
- 非 `claw__*` 工具不被修改。
- 缺失 `sessionKey` 时 fail closed。

### 15.2 Integration tests

- 启动测试 MCP Server，调用 `claw__scope_get`。
- 使用 parent A `ssid` 读取 student A 成功。
- 使用 parent A `ssid` 读取 student B 返回 `FORBIDDEN`。
- 使用 teacher `ssid` 读取 class 成功。
- 两个并发 append 到不同学生文件都成功。
- 两个并发 append 到同一文件不丢内容。
- `artifact_create` 生成文件和 audit log。

### 15.3 OpenClaw routing tests

可用 OpenClaw 的 route resolver 做最小验证：

- `dmScope=per-channel-peer`。
- channel 相同、peer 不同，sessionKey 不同。
- channel 不同、peer 相同，sessionKey 不同。
- group peer 生成 group sessionKey。
- default agent 为 `claw-agent`。

### 15.4 End-to-end tests

用选定平台或 OpenClaw QA channel 做 E2E：

1. parent A 发：“我孩子今天怎么样？”
2. parent B 发同样问题。
3. 两个回复引用不同学生记录。
4. parent A 问 parent B 孩子，系统拒绝。
5. teacher 发：“帮我看本周全班薄弱点。”
6. 系统能读取全班并生成 artifact。
7. 日志显示每次工具调用都有 `ssid` 和 audit。

### 15.5 Live platform smoke

平台上线前必须人工验证：

- 扫码能进入 bot 私聊。
- 私聊 peer id 稳定。
- OpenClaw sessionKey 稳定。
- 重启 Gateway 后 session 仍可继续。
- Bot 回复没有丢消息。
- 两个家长同时发消息不会互相串上下文。

---

## 16. 风险和取舍

### 16.1 风险：把 sessionKey 当认证

OpenClaw 官方安全文档明确指出 `sessionKey` 是 routing/context selection，不是 per-user auth。

处理：

- `sessionKey` 只作为 `ssid`。
- 权限由 CLAW MCP Server 的 SessionScope 判断。
- 用 Scope Bridge 注入真实 `ssid`。
- MCP Server 不信任模型传入的 `ssid`。

### 16.2 风险：平台二维码不支持携带唯一 token

不是所有原生平台都支持“扫个人二维码后自动带 token 进入 bot 私聊”。

处理：

- 架构只依赖稳定 peer id，不依赖二维码 token。
- 平台支持 token 时使用唯一二维码。
- 平台不支持时使用 bot QR + 一次性授权码。
- 先做平台 spike，再定入口。

### 16.3 风险：Markdown 并发写冲突

多个请求可能同时写同一学生文件。

处理：

- MCP Server 对文件写入加锁。
- 使用临时文件 + rename。
- 记录 audit。
- 重要长期总结少覆盖，多 append。

### 16.4 风险：模型误写长期档案

模型可能把猜测写成事实。

处理：

- prompt 约束“只有用户提供明确学习事实才写入”。
- observation 和 summary 分文件。
- `knowledge.md` 更新放到更后阶段。
- 写入必须带 `reason`。

### 16.5 风险：上下文过大

一个孩子档案越来越多，不能每轮全读。

处理：

- `files_list` 先找相关文件。
- `files_read_all` 有 `maxFiles` 和 `maxTotalChars`。
- 生成阶段总结。
- 后续再做索引或搜索。

### 16.6 风险：平台插件成熟度不同

Feishu 和 QQ Bot 有明确 OpenClaw 文档；DingTalk 是社区插件，需要验证。

处理：

- channel-independent 架构。
- 第一阶段做平台 spike。
- 插件能力不满足时替换 channel，不改 MCP 和数据层。

### 16.7 风险：单 agent 工具面过宽

同一个 agent 服务老师和家长，如果暴露 OpenClaw 原生文件工具，可能绕过 CLAW 权限。

处理：

- 禁用 `read/write/edit/exec/process/browser/gateway/cron`。
- 只开放 `bundle-mcp` 和必要消息工具。
- 所有教育数据走 CLAW MCP。

---

## 17. 任务拆分

### Phase 0：平台与 OpenClaw 可行性 spike

目标：确定第一个原生平台。

任务：

1. 安装并配置候选 channel plugin。
2. 配置 `session.dmScope="per-channel-peer"`。
3. 用两个真实账号私聊 bot。
4. 记录两个账号的 sessionKey。
5. 验证重启后 sessionKey 稳定。
6. 验证 bot 回复私聊。
7. 决定 v1 首选平台。

验收：

```text
两个家长账号 -> 两个稳定 sessionKey -> 同一个 claw-agent 回复。
```

### Phase 1：Markdown 数据骨架

目标：建立可读写的文件数据库。

任务：

1. 创建 `claw-data` 目录结构。
2. 创建 1 个 class、2 个 student、2 个 parent、1 个 teacher fixture。
3. 创建 session registry。
4. 实现 front matter parser。
5. 实现 fileId path resolver。
6. 实现文件锁和原子写。

验收：

```text
parent A scope 只能解析到 student A 目录。
teacher scope 能解析 class 目录。
```

### Phase 2：CLAW MCP Server

目标：实现所有 v1 元工具。

任务：

1. `scope_get`
2. `files_list`
3. `files_read`
4. `files_read_all`
5. `files_append`
6. `files_write`
7. `artifact_create`
8. `audit_log`
9. Unit + integration tests。

验收：

```text
MCP 工具可独立测试，权限错误返回明确错误码。
```

### Phase 3：CLAW Scope Bridge Plugin

目标：把真实 OpenClaw sessionKey 注入 CLAW MCP 工具。

任务：

1. 创建 OpenClaw plugin。
2. 注册 `before_tool_call` hook。
3. 识别 `claw__*` 工具。
4. 注入 `params.ssid = ctx.sessionKey`。
5. 缺失 sessionKey 时 block。
6. 测试伪造 ssid 会被覆盖。

验收：

```text
模型无法通过传入别人的 ssid 读取其他学生。
```

### Phase 4：OpenClaw 配置与 prompt

目标：跑通 one-agent 架构。

任务：

1. 配置 `claw-agent`。
2. 配置 MiniMax 或其他主模型。
3. 配置 MCP server。
4. 配置 Scope Bridge plugin。
5. 写 `claw-agent` prompt。
6. 禁用不需要的 OpenClaw 原生工具。

验收：

```text
从 OpenClaw 私聊消息进入 claw-agent，agent 能调用 CLAW MCP 读写 Markdown。
```

### Phase 5：家长闭环

目标：家长能查询、录入、生成练习。

任务：

1. 家长问今日情况。
2. 家长录入错题。
3. 家长问最近问题。
4. 家长生成练习建议。
5. 家长越权问题拒绝。

验收：

```text
家长觉得系统知道自己孩子，并且看不到别人孩子。
```

### Phase 6：老师闭环

目标：老师能记录、查询全班、生成产物。

任务：

1. 老师记录单个学生问题。
2. 老师查询单个学生。
3. 老师查询全班薄弱点。
4. 老师生成错题表。
5. 老师生成家长反馈。

验收：

```text
老师能用自然语言生成可修改使用的教学产物。
```

### Phase 7：定时任务

目标：支持老师的周期性事务。

任务：

1. 评估直接开放 OpenClaw cron tool 还是通过 CLAW schedule tools。
2. 建议优先做 `claw__schedule_create/list/cancel`。
3. 由 MCP Server 做 role 校验。
4. 内部调用 OpenClaw cron 或写入 schedule registry。

验收：

```text
老师可以创建周报类 schedule，家长不能创建越权 schedule。
```

---

## 18. 最小上线标准

CLAW v1 MVP 可以上线试点的最低标准：

1. 一个原生平台私聊入口跑通。
2. 至少 2 个家长 session 隔离。
3. 至少 1 个老师 session 可访问全班。
4. Parent A 不能读 Parent B 学生。
5. 老师能记录学生问题。
6. 家长能问自己孩子情况。
7. 家长能录入学习观察。
8. 系统能生成一份练习或反馈 artifact。
9. 所有写入有 audit。
10. Gateway 重启后 session 和数据仍然存在。

---

## 19. 架构不变量

后续开发不能破坏这些原则：

1. v1 默认一个 `claw-agent`。
2. 家长不是 agent，家长是 session。
3. 老师也不是另一个 agent，老师是拥有更大 scope 的 session。
4. 学生档案不直接暴露给 OpenClaw 原生文件工具。
5. 教育数据只能通过 CLAW MCP Server 访问。
6. 权限判断必须在 MCP Server 内执行。
7. `sessionKey` 不能被当作认证，只能作为 scope lookup key。
8. 模型不能决定自己有多少权限。
9. 工具是元工具，任务由 agent 组合。
10. 平台接入可以替换，Markdown 数据层和 MCP 工具接口不应因此重写。

---

## 20. 参考依据

本设计核对过以下 OpenClaw 本地源码和文档：

- `src/routing/session-key.ts`
- `src/routing/resolve-route.ts`
- `src/agents/pi-embedded-runner/run.ts`
- `src/agents/pi-bundle-mcp-runtime.ts`
- `src/agents/pi-bundle-mcp-materialize.ts`
- `src/agents/pi-bundle-mcp-names.ts`
- `src/agents/pi-tools.before-tool-call.ts`
- `src/agents/mcp-stdio-transport.ts`
- `docs/concepts/agent-loop.md`
- `docs/concepts/queue.md`
- `docs/gateway/config-agents.md`
- `docs/gateway/configuration-reference.md`
- `docs/gateway/security/index.md`
- `docs/tools/index.md`
- `docs/providers/minimax.md`
- `docs/channels/feishu.md`
- `docs/channels/qqbot.md`
- `docs/channels/wechat.md`
- `docs/plugins/community.md`

外部平台资料核对：

- 钉钉 Stream Mode 官方开发者百科：机器人可接收单聊和群聊消息。
- OpenClaw Feishu 文档：bot DMs + group chats production-ready。
- OpenClaw QQ Bot 文档：支持 C2C private chat、group、guild。
- OpenClaw WeChat 文档：外部插件支持 direct chats，群聊能力未作为当前能力重点。


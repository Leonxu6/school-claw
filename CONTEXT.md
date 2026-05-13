# CLAW Domain Context

CLAW v1 is a single-class education agent. It helps teachers and parents turn natural-language learning observations into durable student learning archives, then uses those archives to answer questions and generate useful teaching or parent-facing artifacts.

## Product Invariants

- v1 serves one real class.
- Direct users are teachers and parents.
- Students benefit indirectly but do not have a v1 entrance.
- v1 does not do OCR, photo recognition, online homework integration, multi-school SaaS, or a student chat app.
- The core asset is the long-term student learning archive.
- Parent access is strictly limited to the parent's own child.
- Teacher access can cover the whole class.

## Technical Invariants

- There is one `claw-agent`; parents and teachers are sessions, not separate agents.
- OpenClaw handles platform messages, routing, sessions, the agent loop, model calls, and tool dispatch.
- CLAW educational data must be accessed through `CLAW MCP Server`.
- The Markdown file database is the v1 source of truth.
- OpenClaw native file tools must not read or write `claw-data`.
- `sessionKey` is a scope lookup key, not authentication.
- `CLAW Scope Bridge Plugin` injects the real `ssid` into CLAW MCP tool calls.
- The MCP Server enforces scope and path permissions.
- Tools are primitives; task behavior is composed by the agent.

## Glossary

- **CLAW**: The product and system being built.
- **OpenClaw Gateway**: Message ingress, routing, session, and runtime host.
- **OpenClaw Pi Runtime**: Agent loop, model calls, and tool-call runtime.
- **claw-agent**: The single v1 education agent used by both teachers and parents.
- **session**: A stable conversation context from a platform peer.
- **sessionKey**: OpenClaw's routing/context key for a session.
- **ssid**: CLAW Session Scope ID, initially equal to OpenClaw `sessionKey`.
- **ssidHash**: Stable short hash used when an `ssid` is unsuitable for filenames.
- **SessionScope**: The resolved access model for a session: role, status, class, students, roots, and capabilities.
- **CLAW Scope Bridge Plugin**: Thin OpenClaw plugin that injects the true session `ssid` into CLAW MCP tool calls.
- **CLAW MCP Server**: Server that owns education data access, permissions, Markdown reads/writes, artifacts, and audit logs.
- **Markdown file database**: The `claw-data/` directory tree containing registry, class, student, artifact, and audit Markdown files.
- **student learning archive**: The long-term record for one student: profile, knowledge state, timeline, errors, observations, summaries, and artifacts.
- **artifact**: Generated output saved by the system, such as practice, feedback, weekly summary, PPT outline, or error table.
- **audit log**: Durable record of important read/write/generation actions.

## Primary User Stories

- Parent asks about their own child's current learning state and receives a clear conclusion, gentle reassurance, and a concrete next action.
- Parent records a learning observation or a student-reported mistake, and the system stores it in the correct child archive.
- Parent requests personalized practice or study advice based on their own child's records.
- Teacher records a student's issue in natural language.
- Teacher queries one student or the whole class.
- Teacher generates reusable artifacts such as error tables, weekly summaries, parent feedback, practice material, or PPT outlines.
- Parent attempts to access another child or class-level identifiable information and is refused.

## Source Documents

- Product baseline: `docs/product/CLAW_v1_product_prd.md`
- Technical baseline: `docs/architecture/CLAW_v1_technical_architecture.md`

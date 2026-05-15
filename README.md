# school-claw

CLAW v1 is a single-class education agent for teachers and parents.

Start with:

- `CONTEXT.md` for domain vocabulary and invariants.
- `docs/product/CLAW_v1_product_prd.md` for product scope.
- `docs/architecture/CLAW_v1_technical_architecture.md` for the technical baseline.
- `AGENTS.md` for engineering workflow requirements.

## Development

This repo uses pnpm and TypeScript, matching the OpenClaw baseline recorded in
`docs/development/openclaw-baseline.md`.

Install dependencies:

```sh
pnpm install
```

Run the local scope harness tests:

```sh
pnpm test:scope
```

Run the scoped Markdown read tests:

```sh
pnpm test:scoped-read
```

Run all tests:

```sh
pnpm test
```

Run the learning-record sedimentation demo:

```sh
pnpm demo:sedimentation
```

Expected sedimentation loop:

```text
input: learning fact
agent decides it is durable
files_append writes scoped observation
audit entry appears
follow-up question reads and cites the new record
input: greeting/idle chat -> no archive write occurs
```

Run the local OpenClaw capability harness:

```sh
pnpm demo:capability-harness
```

Expected capability harness loop:

```text
OpenClaw Pi Runtime capability harness executed claw-agent journeys
workspace AGENTS.md contract was injected
parent observation journey used files_append
parent observation follow-up read back the appended record
parent practice artifact journey used artifact_create
parent cross-student journey refused after scope
teacher error-table journey used artifact_create
```

Run the scope demo:

```sh
pnpm demo:scope
```

Expected demo loop:

```text
parent ssid -> {"role":"parent","classId":"class_001","studentIds":["stu_001"],"capabilities":["read_own_child","append_parent_observation","create_child_artifact"],"displayName":"张三家长"}
teacher ssid -> {"role":"teacher","classId":"class_001","studentIds":["*"],"capabilities":["read_class","write_class","create_class_artifact"],"displayName":"王老师"}
unknown ssid -> UNBOUND_SESSION
```

Run the scoped Markdown read demo:

```sh
pnpm demo:scoped-read
```

Expected scoped read loop:

```text
parent A reads student A -> OK (张三学习档案)
parent A reads student B -> FORBIDDEN
teacher reads class -> OK (五年级一班)
fileId "../..." -> FORBIDDEN
```

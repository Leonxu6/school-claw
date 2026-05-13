# school-claw

CLAW v1 is a single-class education agent for teachers and parents.

Start with:

- `CONTEXT.md` for domain vocabulary and invariants.
- `docs/product/CLAW_v1_product_prd.md` for product scope.
- `docs/architecture/CLAW_v1_technical_architecture.md` for the technical baseline.
- `AGENTS.md` for engineering workflow requirements.
- `docs/development/codex-worktree-workflow.md` for local Codex/worktree and PR workflow.

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

Run all tests:

```sh
pnpm test
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

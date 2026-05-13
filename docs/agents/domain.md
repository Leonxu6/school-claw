# Domain Docs

How engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- `CONTEXT.md` at the repo root.
- Relevant ADRs in `docs/adr/`.
- Product and technical baselines:
  - `docs/product/CLAW_v1_product_prd.md`
  - `docs/architecture/CLAW_v1_technical_architecture.md`

If any file does not exist yet, proceed silently. Do not block work on missing docs unless the task depends on the missing decision.

## Layout

This is a single-context repo.

```text
/
├── CONTEXT.md
├── docs/
│   ├── adr/
│   ├── agents/
│   ├── architecture/
│   └── product/
└── tasks/
```

## Use the glossary's vocabulary

When output names a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the term defined in `CONTEXT.md`.

If a needed concept is absent from the glossary, either reconsider the wording or note the gap for a future domain-doc pass.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding it.

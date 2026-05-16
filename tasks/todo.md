# Generated Artifact Reply Closure

## User Goal

Make generated-output MVP journeys complete from the user's perspective: when a
parent or teacher asks for reusable content, CLAW must show usable content in
the chat, save the generated artifact, and create audit evidence.

## User Journey

1. Parent asks for a math practice plan based on their own child's archive.
2. CLAW reads only that child's scoped evidence.
3. CLAW creates an audited practice artifact.
4. CLAW replies with the actual practice content plus the saved artifact file ID.
5. Teacher asks for a weekly math error table.
6. CLAW reads class evidence, filters to math evidence, creates an audited class
   artifact, and replies with the table plus the saved artifact file ID.

## Agent Journey

1. Sync the main workspace to the latest `origin/main` baseline that includes
   issues 0011 through 0013.
2. Add failing user-visible assertions for generated practice and error-table
   replies.
3. Update the deterministic OpenClaw Pi Runtime helper so generated artifact
   replies include usable content and artifact references after successful
   `claw__artifact_create`.
4. Tighten the `claw-agent` prompt/workspace contract so live model behavior has
   the same user-visible requirement.
5. Run the user journey demo and full relevant verification.

## Acceptance Criteria

- [x] Parent practice replies include usable practice content, a concrete next
  action, and `已保存：classes/.../artifacts/...md`.
- [x] Teacher error-table replies include a usable table, math error evidence,
  and `已保存：classes/.../artifacts/...md`.
- [x] Both generated journeys still call `claw__scope_get`,
  `claw__files_read_all`, and `claw__artifact_create`.
- [x] Both generated journeys still create `artifact_create` audit records.
- [x] Parent generated evidence remains scoped to the parent's child.
- [x] Teacher math error-table content does not include non-math rows.
- [x] No new external API or scenario-specific tool is introduced.

## Architecture And Boundaries

- Preserve one `claw-agent`; parents and teachers remain scoped sessions.
- Keep education data behind CLAW MCP/native CLAW tools.
- Keep `claw__artifact_create` request/response unchanged.
- Do not add batch sending, scheduling, OCR, student entry, or new generated
  task tools.

## Implementation Steps

- [x] Fast-forward local `main` to `origin/main`.
- [x] Add user-visible generated-reply assertions to the capability harness test.
- [x] Update deterministic generated artifact replies in the Pi Runtime helper.
- [x] Update prompt/workspace wording for generated artifact reply format.
- [x] Run the user-view capability harness demo.
- [x] Run automated verification.
- [x] Record verification evidence here.

## Verification Path

- `pnpm demo:capability-harness`
- `pnpm test`
- `pnpm pilot:smoke`
- `pnpm typecheck`
- `git diff --check`

## Evidence To Collect

- User-visible parent practice reply includes exercises and saved artifact file
  ID.
- User-visible teacher error-table reply includes the table and saved artifact
  file ID.
- Audit counts include one `files_append` and two `artifact_create` records in
  the capability harness.
- Test/typecheck/smoke command summaries.

## Verification Evidence

- Red check before implementation: `pnpm exec vitest run tests/claw-agent-capability-harness.test.ts`
  failed because the parent practice reply only said the practice was saved.
- Targeted config check after shipped prompt sync:
  `pnpm exec vitest run tests/openclaw-agent-workspace-config.test.ts` passed
  with 6 tests.
- Full verification passed:
  - `pnpm test`: 14 files, 91 tests passed.
  - `pnpm pilot:smoke`: PASS after OpenClaw baseline, operations/security tests,
    and typecheck.
  - `pnpm typecheck`: passed.
  - `git diff --check`: passed.
- User-view demo: `pnpm demo:capability-harness` passed all five journeys.
- Parent visible reply included `# 张三分数应用题练习`, actions to circle the unit
  amount and explain what the problem asks, provenance from the child's archive,
  and `已保存：classes/class_001/students/stu_001/artifacts/2026-06-01-practice-91b3457b.md`.
- Teacher visible reply included `# 五年级一班本周数学错题表`, a markdown table with
  `分数应用题 | 单位一不稳`, math-only provenance, and
  `已保存：classes/class_001/artifacts/2026-06-01-error_table-85b1d834.md`.
- Harness audit counts: `files_append: 1`, `artifact_create: 2`.

## Risks

- A deterministic helper-only fix could leave the live prompt vague; update the
  canonical prompt/workspace contract too.
- Reply text can drift from artifact content; tests should assert the chat
  includes the same core content and saved file ID returned by the tool.
- Over-broad teacher generation could include non-math rows; keep the existing
  math-only assertion.

## Non-Goals

- Do not rerun real Feishu/Lark account smoke in this task.
- Do not implement batch parent sends or scheduling.
- Do not change artifact storage format or MCP response shape.

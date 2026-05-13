# AGENTS.md instructions for school-claw

## Workflow Orchestration

### 1. Plan Mode Default

- Enter plan mode for any non-trivial task: 3+ steps, unclear scope, or architectural decisions.
- If something goes sideways, stop and re-plan immediately.
- Use plan mode for verification steps, not just building.
- Write detailed specs upfront to reduce ambiguity.

### 2. Subagent Strategy

- Use subagents for focused exploration, research, and parallel analysis when the active runtime allows it.
- Keep one task per subagent.
- Do not duplicate work between the main thread and a subagent.

### 3. Self-Improvement Loop

- After any correction from the user, update `tasks/lessons.md` with the pattern.
- Write rules that prevent the same mistake.
- Review relevant lessons at session start.

### 4. Verification Before Done

- Never mark a task complete without proving it works.
- Diff behavior between main and your changes when relevant.
- Ask: "Would a staff engineer approve this?"
- Run tests, check logs, and demonstrate correctness.

### 5. Demand Elegance, Balanced

- For non-trivial changes, pause and ask whether there is a more elegant way.
- If a fix feels hacky, rework toward the elegant solution using what is now known.
- Skip this for simple, obvious fixes.
- Challenge your own work before presenting it.

### 6. Autonomous Bug Fixing

- When given a bug report, reproduce it, point at logs/errors/failing tests, then resolve it.
- Do not ask the user for hand-holding when the repo can answer the question.
- Fix failing CI tests without waiting for step-by-step instructions.

### 7. Test-First Mandate

- Always write tests before implementing any new feature, bug fix, or refactor.
- For bug reports, first write a failing test that reproduces the exact issue.
- Follow Red -> Green -> Refactor.
- Tests must cover happy path, edge cases, and error scenarios appropriate to the risk.
- Never mark a task complete until all new and existing relevant tests pass.

### 8. Karpathy Core

- Manage uncertainty: do not assume or hide confusion. Ask when needed and make tradeoffs explicit.
- Minimum code, surgical changes: no abstraction for one-off use, no unrelated refactors, no speculative improvements.
- Goal-driven execution: translate tasks into verifiable success criteria and loop until done.

## Agent skills

### Issue tracker

Issues and PRDs for this repo live in GitHub Issues for `Leonxu6/school-claw`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo: read `CONTEXT.md` and relevant ADRs in `docs/adr/` before substantial engineering work. See `docs/agents/domain.md`.

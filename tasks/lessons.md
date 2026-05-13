# Lessons

Record user corrections here so future work avoids repeating the same mistake.

## Active Lessons

- When drafting issues for this repo, make every issue self-contained for a fresh agent window. Do not rely on prior conversation context; include working directory, required docs to read, project summary, non-negotiable architecture constraints, concrete deliverables, and verification expectations in the issue body itself.
- For CLAW planning, do not confuse scenario validation with scenario-specific implementation. CLAW is one OpenClaw-based education agent with general capabilities; issues should build reusable platform/data/scope/MCP/agent capabilities, then use product scenarios only as acceptance tests. Always include OpenClaw source checkout and API/runtime verification as a prerequisite capability track.
- When starting a dispatched issue that is blocked by an earlier issue, inspect the completed dependency branch or worktree first and carry forward its recorded understanding before creating the new worktree or implementation plan.
- When delivering an issue implementation, state the acceptance standard first: what capability was built, what exact loop proves it, which commands the user should run, and what output means PASS. Do not leave the user to infer closure from a file/change list.
- For scoped file listing, apply the same realpath/symlink escape checks as file reading before parsing any candidate Markdown. Never parse title/excerpt metadata from a path until the candidate's real path is proven inside the archive and inside the requested read root.
- For scoped file reading, lexical `fileId` authorization is only a first gate. After `realpath`, verify the real target is still inside the current scope's canonical `readRoots`; being inside `dataRoot` is not enough because a symlink can point from an allowed student directory to another student's file.
- Before calling an issue done, check `git status --untracked-files=all` and ensure all intended implementation, tests, fixtures, scripts, and issue specs are tracked or intentionally ignored. Do not let core deliverables remain untracked.
- Passing tests is not enough for delivery: verify the branch `HEAD` contains the issue implementation/spec, not just the worktree. If the user expects a mergeable handoff, stage and commit the tracked deliverables before calling the issue complete.
- If an API accepts filters such as `dateFrom`, `dateTo`, or `query`, either implement them with tests or reject unsupported usage explicitly. Never silently ignore a narrowing filter.
- Before implementing a dispatched issue, create or enter the matching `/Users/leon/school-claw-worktrees/<issue-name>` worktree and verify the branch with `git status -sb`. Do not implement issue code in the planning/main workspace.
- For write primitives, `writeRoots` authorization is necessary but not sufficient. Also bind each target kind to the correct role/capability so source-provenance files such as `parent-observations` cannot be written by teacher scopes.
- For “no write without audit,” regression-test audit storage failure explicitly. Preflight the audit target before changing business files, so an unavailable `audit/` path cannot leave unaudited archive mutations.
- When a branch is based on an older dependency worktree, copy the current issue spec into `tasks/issues/` before delivery so fresh agents and reviewers do not validate against stale numbered issue files.
- For tool-call request fields that are TypeScript unions, add runtime validation and regression tests with invalid JSON values. MCP/runtime callers can pass strings such as `"upsert"` even when TypeScript says the mode is only `"create" | "replace"`.
- For audit preflight, checking that `audit/` is a directory is not enough. Probe the exact audit parent directory with a real write/delete before changing business files, and regression-test an unwritable `audit/YYYY-MM` directory.
- When the user asks to continue a numbered issue, pause implementation until the matching `/Users/leon/school-claw-worktrees/<issue-name>` worktree exists and is checked out; if the current directory is only planning docs or another workspace, create/enter the issue worktree first.
- For artifact provenance, validating that the creator can read `sourceFileIds` is not enough. For student-targeted artifacts, every source must also be safe for that target student's audience; never let a teacher create a student artifact whose metadata or content points at another student's archive.
- For "no artifact without audit," audit preflight alone is not enough. Any artifact primitive that writes the business file before audit append must have a regression-tested rollback/compensation path for audit append failure.

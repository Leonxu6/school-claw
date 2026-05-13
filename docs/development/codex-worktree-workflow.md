# Codex Local Worktree Workflow

Status: project operating guide

## Why Some Codex Windows Show Branch Controls

Codex desktop branch controls depend on the current local workspace, not only on
whether a GitHub repository exists.

A Codex window is ready for branch/PR work when it is opened on a local git
repo or worktree that has:

- A real working directory under this project.
- A git root.
- A checked-out branch.
- A GitHub remote.

Quick diagnostic command for any Codex window:

```sh
pwd
git rev-parse --show-toplevel
git status -sb
git remote -v
git branch --show-current
```

If `git rev-parse --show-toplevel` fails, the window is not attached to a local
git workspace. Reopen Codex from the project or worktree directory.

## Canonical Repository State

The canonical remote is:

```text
https://github.com/Leonxu6/school-claw.git
```

The default branch should be:

```text
main
```

`main` is the integration branch. Completed issue branches should merge back to
`main` through pull requests.

## Local Directory Layout

Use one local directory per active branch:

```text
/Users/leon/school-claw
  main worktree
  use for planning, repo status checks, and light documentation work

/Users/leon/school-claw-worktrees/<issue-or-chore-name>
  one isolated worktree per implementation issue or chore
  open Codex desktop directly on this directory when working that branch
```

Do not assume that uncommitted files in one worktree are visible from another
worktree. They are local to that directory until committed and pushed.

## Branch Pattern

Use these branch shapes:

```text
work/0003-scoped-markdown-read-loop
work/0004-safe-write-audit-loop
chore/project-organization
chore/add-pr-ci
```

Each issue branch should start from current `origin/main` unless it explicitly
depends on an unmerged earlier branch. If it depends on an earlier branch, read
that branch's completed docs and tests before implementing.

## Dispatch Rule For New Codex Windows

When sending an issue to a fresh Codex window:

1. Create or open the matching local worktree.
2. Open Codex desktop on that worktree directory, not on a generic chat thread.
3. Give the agent exactly one issue file from `tasks/issues/`.
4. Tell it to read `AGENTS.md`, `CONTEXT.md`, and any docs named in the issue.
5. For AFK implementation issues, require TDD: one failing behavior test before
   implementation.

## Current Issue Queue

The active plan lives in:

```text
docs/development/CLAW_v1_development_plan.md
tasks/issues/README.md
tasks/issues/*.md
```

The queue is now closed-loop and capability-first. Product scenarios are
acceptance examples, not hard-coded implementation tracks.

## PR And CI Expectations

Open a pull request for every pushed branch that should become shared project
state.

CI runs from `.github/workflows/ci.yml` on pull requests and checks:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm demo:scope
```

If a branch has only uncommitted local changes, GitHub, CI, reviewers, and other
Codex windows cannot see those changes.

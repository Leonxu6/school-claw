# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in `Leonxu6/school-claw`.

Preferred tooling is the GitHub connector when available. Otherwise, use the `gh` CLI for issue operations. Before publishing issues, verify that `gh` is installed and authenticated with `gh auth status`; if it is missing, stop and ask the user whether to install it, use the GitHub connector, or write issue drafts locally.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`
- **Read an issue**: `gh issue view <number> --comments`
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments`
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`. `gh` does this automatically when run inside the clone.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

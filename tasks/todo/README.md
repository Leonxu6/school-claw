# Tasks Todo

This directory is the project management surface for school-claw.

The project does not use project-level Codex hooks, project-local skills, or
project-local agent workflow settings. Delivery is controlled by the global
Codex Stop hook.

Local files under `tasks/todo` are the planning source of truth. GitHub Issues,
when used, are only synchronized mirrors.

## Core flow

1. Use `prd-grill` to produce a PRD.
2. Use `architecture-grill` to produce a technical design.
3. Use `issue-plan` to split the design into vertical issues.
4. Develop each issue on a branch named `issue/<id>-<slug>`.
5. Let the global reviewer and verifier gates decide whether the branch can TPR.

For an issue branch, the global verifier finds
`tasks/todo/**/issues/<id>-*.verify.yaml` and uses that file as the stable
verification entry point. The YAML points back to the issue file, which carries
the detailed acceptance criteria and behavior loop.

## Editable records

Development agents may write coordination notes under:

- `tasks/todo/<initiative>/runs/<issue>/<agent-id>.md`
- `tasks/todo/<initiative>/lessons/inbox/<agent-id>.md`

These records are for cross-agent communication and may ship with a PR.

## Protected sources

Development agents must not change these files from an issue branch:

- `PRD.md`
- `TECH_DESIGN.md`
- `DEVELOPMENT_PLAN.md`
- `issues/*.md`
- `issues/*.verify.yaml`

The global hook enforces this for `issue/<id>-<slug>` branches.

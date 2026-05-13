# CLAW v1 Development Plan

Status: rewritten as closed-loop tracer bullets

Sources:

- `CONTEXT.md`
- `docs/product/CLAW_v1_product_prd.md`
- `docs/architecture/CLAW_v1_technical_architecture.md`
- OpenClaw upstream source: `https://github.com/openclaw/openclaw`
- OpenClaw docs: `https://docs.openclaw.ai`

## Planning Model

CLAW v1 is one OpenClaw-based education agent system, not a collection of hard-coded scenarios.

But each issue must still be independently acceptable. The right shape is:

```text
general capability
  + a tiny vertical path through the system
  + a command/demo that proves it works
  + product scenarios used only as acceptance examples
```

So these issues are not horizontal component tickets. Each one is a tracer bullet with a closed loop.

## Architecture Target

```text
OpenClaw source / Gateway / Pi Runtime
  + CLAW Scope Bridge Plugin
  + CLAW MCP Server
  + Markdown file database
  + one claw-agent workspace, config, and prompt
```

## Closed-Loop Issue Breakdown

1. **OpenClaw baseline contract loop**
   - Type: AFK
   - Closed loop: source checkout -> pinned commit -> contract probe verifies required OpenClaw files/docs/API surfaces.
   - Blocked by: None.

2. **Local CLAW scope harness loop**
   - Type: AFK
   - Closed loop: fake OpenClaw `ssid` -> CLAW `scope_get` primitive -> parent/teacher scope JSON.
   - Blocked by: Issue 1.

3. **Scoped Markdown read loop**
   - Type: AFK
   - Closed loop: `ssid` -> `SessionScope` -> Markdown file guard -> `files_list/read` -> allowed docs or `FORBIDDEN`.
   - Blocked by: Issue 2.

4. **Safe write and audit loop**
   - Type: AFK
   - Closed loop: scoped append/write -> atomic Markdown update -> audit record -> read-back verification.
   - Blocked by: Issue 3.

5. **Artifact primitive loop**
   - Type: AFK
   - Closed loop: scoped source reads -> `artifact_create` -> saved artifact -> audit -> read-back verification.
   - Blocked by: Issue 4.

6. **OpenClaw Scope Bridge loop**
   - Type: AFK
   - Closed loop: simulated OpenClaw tool call with forged `ssid` -> plugin injects real session -> CLAW MCP denies/permits correctly.
   - Blocked by: Issues 1 and 5.

7. **One-agent OpenClaw read loop**
   - Type: AFK
   - Closed loop: OpenClaw local/QA message -> one `claw-agent` -> Scope Bridge -> CLAW MCP read -> evidence-based reply.
   - Blocked by: Issues 5 and 6.

8. **Agent learning-record sedimentation loop**
   - Type: AFK
   - Closed loop: natural-language learning fact -> one `claw-agent` decides to append -> audit -> later answer cites the new record.
   - Blocked by: Issue 7.

9. **Teacher class artifact loop**
   - Type: AFK
   - Closed loop: teacher scope -> class-visible reads -> generated class artifact -> audit -> parent scope refused for same request.
   - Blocked by: Issue 8.

10. **Native platform binding loop**
    - Type: HITL
    - Closed loop: real private chat -> OpenClaw sessionKey -> CLAW binding/authorization -> scoped CLAW reply.
    - Blocked by: Issues 6 and 7.

11. **Pilot operations and safety loop**
    - Type: AFK
    - Closed loop: start/restart system -> run smoke suite -> inspect logs/audit -> backup/restore learning archive.
    - Blocked by: Issues 9 and 10.

12. **Post-MVP batch-send and schedule policy loop**
    - Type: HITL
    - Closed loop: decision ADRs -> follow-up implementation tickets or explicit defer decision.
    - Blocked by: Issue 11.

## MVP Gate

The pilot-ready MVP is issues 1 through 11.

At the MVP gate, a reviewer must be able to run or observe:

- OpenClaw baseline contract verification.
- Parent scope read succeeds only for own child.
- Parent forbidden access fails at MCP/data layer.
- Parent/teacher learning records append with audit.
- Artifact creation works from scoped evidence.
- Scope Bridge overwrites forged `ssid`.
- One `claw-agent` can read and write through CLAW MCP.
- Teacher can create class-level artifacts while parent cannot.
- Native platform private chat can bind to a CLAW scope.
- Restart, logs, audit review, and backup/restore are documented and smoke-tested.

## Dispatch Rule

When dispatching work to another window, pass exactly one numbered issue file from `tasks/issues/` and tell the agent:

```text
Work in /Users/leon/school-claw. Read this issue file first and follow its Fresh-agent brief. Do not rely on prior chat context. Follow AGENTS.md, start with tests for AFK issues, and stop if blocked by a referenced draft issue that is not complete.
```

Each issue must remain self-contained and must include a closed-loop acceptance target.

## Publishing Notes

The configured issue tracker is GitHub Issues. These markdown files remain the
source drafts until they are published to the tracker.

Before publishing:

1. Create missing labels if needed: `ready-for-agent`, `ready-for-human`, `needs-triage`, `needs-info`, `wontfix`.
2. Publish issues in dependency order.
3. Replace draft dependency references like `DRAFT-0003` with real GitHub issue numbers.
4. Keep `docs/development/codex-worktree-workflow.md` current when the branch or worktree process changes.

# CLAW v1 Development Plan

Status: rewritten as a capability-first issue plan

Sources:

- `CONTEXT.md`
- `docs/product/CLAW_v1_product_prd.md`
- `docs/architecture/CLAW_v1_technical_architecture.md`
- OpenClaw upstream source: `https://github.com/openclaw/openclaw`
- OpenClaw docs: `https://docs.openclaw.ai`

## Correct Planning Model

CLAW v1 is not a set of scenario-specific features. It is one OpenClaw-based education agent system.

The system to build is:

```text
OpenClaw source / Gateway / Pi Runtime
  + CLAW Scope Bridge Plugin
  + CLAW MCP Server
  + Markdown file database
  + one claw-agent workspace, config, and prompt
```

The product scenarios in the PRD are acceptance examples. They should prove the general capabilities work, but they should not become hard-coded task implementations.

## Capability Stack

The reusable capabilities are:

1. OpenClaw source and runtime contract knowledge.
2. Local development scaffold and test harness.
3. OpenClaw private-chat session routing and `ssid` mapping.
4. Markdown student learning archive.
5. `SessionScope` resolution and permission guards.
6. Safe Markdown writes and audit logging.
7. CLAW MCP primitive tools.
8. Scope Bridge session injection.
9. `claw-agent` workspace/config/tool policy.
10. `claw-agent` behavior prompt.
11. Local OpenClaw capability harness.
12. Native platform binding and pilot readiness.

## Draft Issue Breakdown

1. **Pin and document the OpenClaw source baseline**
   - Type: AFK
   - Blocked by: None
   - Capability: OpenClaw source checkout, commit pin, runtime contract map.

2. **Create the school-claw development skeleton**
   - Type: AFK
   - Blocked by: Issue 1
   - Capability: project structure, TypeScript/test tooling, local commands.

3. **Verify OpenClaw sessionKey to CLAW ssid contract**
   - Type: AFK
   - Blocked by: Issues 1 and 2
   - Capability: session isolation and stable `ssid` mapping.

4. **Build Markdown learning archive fixtures and schema helpers**
   - Type: AFK
   - Blocked by: Issue 2
   - Capability: class/student/archive data model.

5. **Build SessionScope resolver and file permission core**
   - Type: AFK
   - Blocked by: Issues 3 and 4
   - Capability: role/status/capability resolution and file guard.

6. **Build safe Markdown write and audit core**
   - Type: AFK
   - Blocked by: Issues 4 and 5
   - Capability: append/write safety, locks, atomic writes, audit trail.

7. **Expose CLAW MCP primitive tools**
   - Type: AFK
   - Blocked by: Issues 5 and 6
   - Capability: `scope_get`, file primitives, artifact creation, audit primitive.

8. **Implement the OpenClaw Scope Bridge Plugin**
   - Type: AFK
   - Blocked by: Issues 1, 3, and 7
   - Capability: inject real OpenClaw session into CLAW MCP calls.

9. **Create the one-agent OpenClaw workspace and tool policy**
   - Type: AFK
   - Blocked by: Issues 1, 7, and 8
   - Capability: one `claw-agent`, `bundle-mcp` only, native tool denial.

10. **Write the claw-agent capability prompt contract**
    - Type: AFK
    - Blocked by: Issues 7 and 9
    - Capability: general behavior rules for reading, writing, generating, and refusing.

11. **Run the local OpenClaw capability harness**
    - Type: AFK
    - Blocked by: Issues 7, 8, 9, and 10
    - Capability: prove reusable abilities through scenario acceptance tests.

12. **Validate native platform binding and authorization path**
    - Type: HITL
    - Blocked by: Issues 1, 3, 8, 9, and 11
    - Capability: real private-chat entry, peer binding, invite/authorization flow.

13. **Prepare pilot operations and security baseline**
    - Type: AFK
    - Blocked by: Issues 11 and 12
    - Capability: deployment checklist, logs, audit review, config safety, runbook.

14. **Decide post-MVP batch-send and schedule policy**
    - Type: HITL
    - Blocked by: Issue 13
    - Capability: product/architecture decisions for batch parent messages and recurring tasks.

## MVP Gate

The first pilot-ready MVP is complete when issues 1 through 13 are done.

At that point, the product scenarios should work because the capabilities exist:

- Parent can ask about their own child.
- Parent can add learning observations.
- Parent can request practice or advice based on the child archive.
- Teacher can record a student observation.
- Teacher can query class-level learning state.
- Teacher can generate reusable artifacts.
- Parent attempts to access another child or class data are refused.

These are acceptance tests, not separate implementation tracks.

## Fresh-Window Dispatch Rule

When dispatching work to another window, pass exactly one numbered issue file from `tasks/issues/` and tell the agent:

```text
Work in /Users/leon/school-claw. Read this issue file first and follow its Fresh-agent brief. Do not rely on prior chat context. Follow AGENTS.md, start with tests for AFK issues, and stop if blocked by a referenced draft issue that is not complete.
```

Each issue must remain self-contained: working directory, required docs, project summary, capability, non-negotiables, expected handoff result, acceptance criteria, and blockers belong in the issue body.

## Publishing Notes

The configured issue tracker is GitHub Issues, but this machine currently has no `gh` command. Before publishing:

1. Install and authenticate GitHub CLI, or enable a GitHub connector.
2. Create missing labels if needed: `ready-for-agent`, `ready-for-human`, `needs-triage`, `needs-info`, `wontfix`.
3. Publish issues in dependency order.
4. Replace draft dependency references like `DRAFT-0001` with real GitHub issue numbers.

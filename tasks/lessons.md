# Lessons

Record user corrections here so future work avoids repeating the same mistake.

## Active Lessons

- When drafting issues for this repo, make every issue self-contained for a fresh agent window. Do not rely on prior conversation context; include working directory, required docs to read, project summary, non-negotiable architecture constraints, concrete deliverables, and verification expectations in the issue body itself.
- For CLAW planning, do not confuse scenario validation with scenario-specific implementation. CLAW is one OpenClaw-based education agent with general capabilities; issues should build reusable platform/data/scope/MCP/agent capabilities, then use product scenarios only as acceptance tests. Always include OpenClaw source checkout and API/runtime verification as a prerequisite capability track.
- For `to-issues` planning, avoid horizontal component tickets that cannot be accepted on their own. Every issue must be a tracer bullet with a clear closed-loop demo or verification command, even when the slice is capability-first rather than scenario-specific.
- When starting a dispatched issue that is blocked by an earlier issue, inspect the completed dependency branch or worktree first and carry forward its recorded understanding before creating the new worktree or implementation plan.

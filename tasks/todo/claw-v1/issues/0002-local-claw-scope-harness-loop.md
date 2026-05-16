# Local CLAW scope harness loop

Type: AFK

Suggested label: `ready-for-agent`

## Fresh-agent brief

- Working directory: `/Users/leon/school-claw`.
- Read first: `CONTEXT.md`, `docs/development/openclaw-baseline.md`, and `docs/architecture/CLAW_v1_technical_architecture.md` sections 7.1-7.2, 9.1, and 15.1.
- Project summary: CLAW maps an OpenClaw session key (`ssid`) to a `SessionScope`. This issue creates the first runnable school-claw loop, but only for scope resolution.
- Capability: local test harness + `scope_get` primitive.
- Non-negotiables: no student file reads yet, no teacher/parent scenario behavior, no OpenClaw runtime dependency unless the baseline supports it cleanly.
- Expected handoff result: a fresh agent can run a command and see parent/teacher scope JSON returned from fake OpenClaw session IDs.

## Closed-loop acceptance target

Reviewer can run a command such as:

```text
npm test -- scope
npm run demo:scope
```

and see:

```text
parent ssid -> role=parent, studentIds=[stu_001]
teacher ssid -> role=teacher, studentIds=["*"]
unknown ssid -> UNBOUND_SESSION
```

## What to build

Create the minimal school-claw project scaffold needed for tests and a local scope harness. Add fixture session registry records and implement only enough `scope_get` behavior to prove `ssid -> SessionScope` works.

## Acceptance criteria

- [x] Tests are written first for parent, teacher, unknown, and disabled sessions.
- [x] Project test command is documented and passes.
- [x] Fixture registry includes at least two parents, two students, and one teacher.
- [x] `scope_get` returns safe display fields only: role, class ID, visible student IDs, capabilities, and display name.
- [x] Disabled sessions return `SESSION_DISABLED`.
- [x] Unknown sessions return `UNBOUND_SESSION`.
- [x] Demo output is saved or documented so the reviewer can verify the loop.

## Completion evidence

Verified in `/Users/leon/school-claw-worktrees/0002-local-claw-scope-harness-loop`:

```text
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm demo:scope
npm test -- scope
git diff --check
```

## Blocked by

- `work/0001-openclaw-source-baseline`

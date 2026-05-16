#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

OPENCLAW_DIR="${OPENCLAW_DIR:-${OPENCLAW_CHECKOUT:-/Users/leon/openclaw}}"
export OPENCLAW_DIR

echo "[pilot-smoke] verifying pinned OpenClaw baseline"
./scripts/verify-openclaw-baseline.sh

echo "[pilot-smoke] running operations/security smoke tests"
CLAW_PILOT_SMOKE=1 pnpm exec vitest run \
  tests/pilot-operations-baseline.test.ts \
  tests/openclaw-agent-workspace-config.test.ts \
  tests/scope-bridge.test.ts \
  tests/scope-get.test.ts \
  tests/scoped-read.test.ts \
  tests/write-audit.test.ts \
  tests/artifact.test.ts \
  tests/mcp-artifact-create.test.ts \
  tests/openclaw-read-loop.test.ts \
  tests/sedimentation-loop.test.ts \
  tests/claw-agent-capability-harness.test.ts

echo "[pilot-smoke] running typecheck"
pnpm typecheck

echo "[pilot-smoke] PASS"

#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OPENCLAW_DIR="${OPENCLAW_DIR:-/Users/leon/openclaw}"
BASELINE_DOC="$ROOT_DIR/docs/development/openclaw-baseline.md"
EXPECTED_URL="https://github.com/openclaw/openclaw.git"
EXPECTED_COMMIT="da23f4572da7d59ef97688ad8b61771e5b708733"

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

ok() {
  printf 'OK: %s\n' "$*"
}

require_file() {
  local path="$1"
  test -e "$path" || fail "missing required path: $path"
  ok "found $path"
}

require_doc_marker() {
  local marker="$1"
  grep -Fq "$marker" "$BASELINE_DOC" || fail "baseline doc missing marker: $marker"
  ok "baseline doc records: $marker"
}

printf 'OpenClaw baseline verification report\n'
printf 'school-claw: %s\n' "$ROOT_DIR"
printf 'openclaw: %s\n' "$OPENCLAW_DIR"

test -d "$OPENCLAW_DIR/.git" || fail "OpenClaw checkout is not a git repo: $OPENCLAW_DIR"
ok "OpenClaw checkout exists"

actual_url="$(git -C "$OPENCLAW_DIR" config --get remote.origin.url)"
test "$actual_url" = "$EXPECTED_URL" || fail "unexpected OpenClaw remote: $actual_url"
ok "OpenClaw remote is $EXPECTED_URL"

actual_commit="$(git -C "$OPENCLAW_DIR" rev-parse HEAD)"
test "$actual_commit" = "$EXPECTED_COMMIT" || fail "unexpected OpenClaw commit: $actual_commit"
ok "OpenClaw commit is pinned to $EXPECTED_COMMIT"

require_file "$BASELINE_DOC"
require_doc_marker "$EXPECTED_URL"
require_doc_marker "$EXPECTED_COMMIT"
require_doc_marker 'agents.defaults.agentRuntime'
require_doc_marker 'legacy and ignored'
require_doc_marker 'claw__files_read'
require_doc_marker 'before_tool_call'
require_doc_marker 'group:fs'

required_openclaw_paths=(
  "src/entry.ts"
  "node_modules/tsx/dist/esm/index.mjs"
  "src/routing/session-key.ts"
  "src/routing/resolve-route.ts"
  "src/agents/pi-embedded-runner/run.ts"
  "src/agents/pi-embedded-runner/lanes.ts"
  "src/agents/pi-bundle-mcp-runtime.ts"
  "src/agents/pi-bundle-mcp-materialize.ts"
  "src/agents/pi-bundle-mcp-names.ts"
  "src/agents/pi-tools.before-tool-call.ts"
  "src/agents/mcp-stdio-transport.ts"
  "src/agents/tool-catalog.ts"
  "src/agents/pi-embedded-runner/effective-tool-policy.ts"
  "docs/concepts/session.md"
  "docs/concepts/agent-loop.md"
  "docs/concepts/queue.md"
  "docs/concepts/agent-runtimes.md"
  "docs/gateway/config-agents.md"
  "docs/gateway/configuration-reference.md"
  "docs/gateway/security/index.md"
  "docs/gateway/config-tools.md"
  "docs/providers/minimax.md"
  "docs/plugins/hooks.md"
)

for relative_path in "${required_openclaw_paths[@]}"; do
  require_file "$OPENCLAW_DIR/$relative_path"
done

printf 'PASS: OpenClaw source exists, commit is pinned, required contracts are present, and the baseline report is recorded.\n'

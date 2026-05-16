import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CLAW_NATIVE_OPENCLAW_TOOL_NAMES } from "../src/openclaw/native-tools.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const runbookPath = path.join(
  repoRoot,
  "docs",
  "development",
  "pilot-operations-security-baseline.md",
);
const smokeScriptPath = path.join(repoRoot, "scripts", "pilot-smoke-checks.sh");
const openclawBaselineScriptPath = path.join(
  repoRoot,
  "scripts",
  "verify-openclaw-baseline.sh",
);
const packageJsonPath = path.join(repoRoot, "package.json");
const openclawConfigPath = path.join(
  repoRoot,
  "integrations",
  "openclaw",
  "claw-agent.openclaw.json",
);

function expectAll(text: string, fragments: string[]): void {
  for (const fragment of fragments) {
    expect(text).toContain(fragment);
  }
}

describe("pilot operations and security baseline", () => {
  it("documents the operator path map, startup, security, audit, backup, and failure procedures", () => {
    const runbook = readFileSync(runbookPath, "utf8");

    expectAll(runbook, [
      "# Pilot Operations And Security Baseline",
      "## Operator Rule",
      "## Path Map",
      "## Remote Deployment Record",
      "## Environment",
      "## Preflight Smoke Checks",
      "## Start And Stop",
      "### CLAW MCP Server",
      "### OpenClaw Gateway",
      "## Health And Logs",
      "## Security Checklist",
      "## Audit Review",
      "## Backup And Restore",
      "## Failure Modes",
      "### Tool Failure",
      "### Forbidden Access",
      "### Platform Disconnect",
      "### Gateway Restart",
      "## Live Platform Smoke Record",
    ]);

    expectAll(runbook, [
      "/Users/leon/openclaw",
      "integrations/openclaw/claw-agent.openclaw.json",
      "src/mcp/server.ts",
      "$CLAW_DATA_DIR/audit/YYYY-MM/YYYY-MM-DD.md",
      "~/.openclaw/agents/<agentId>/sessions/sessions.json",
      "/tmp/openclaw/openclaw-YYYY-MM-DD.log",
      "claw-data/",
      "workspaces/claw-agent/",
      "OPENCLAW_GATEWAY_TOKEN",
      "CLAW_SCOPE_REGISTRY_PATH",
    ]);
  });

  it("exposes a single pilot smoke command and keeps its referenced checks real", () => {
    const runbook = readFileSync(runbookPath, "utf8");
    const smokeScript = readFileSync(smokeScriptPath, "utf8");
    const openclawBaselineScript = readFileSync(openclawBaselineScriptPath, "utf8");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["pilot:smoke"]).toBe(
      "bash scripts/pilot-smoke-checks.sh",
    );
    expect(runbook).toContain("pnpm pilot:smoke");
    expect(runbook).toContain("OPENCLAW_CHECKOUT");
    expect(runbook).toContain("OPENCLAW_DIR");
    expect(runbook).toContain(
      'CLAW_SCOPE_REGISTRY_PATH="${CLAW_SCOPE_REGISTRY_PATH:-$REPO_ROOT/claw-data/registry/scope-registry.local.json}"',
    );
    expect(runbook).toContain("do not run live traffic against the");
    expect(runbook).toContain("Do not use `--allow-unconfigured`");
    expect(runbook).toContain("gateway.mode=local");
    expect(runbook).toContain("gateway.bind=auto");
    expect(runbook).toContain("--bind auto");
    expect(runbook).toContain('--token "$OPENCLAW_GATEWAY_TOKEN"');
    expect(runbook).toContain('"$OPENCLAW_CHECKOUT/src/entry.ts" gateway probe');
    expect(runbook).toContain("--timeout 120000");
    expect(smokeScript).toContain("./scripts/verify-openclaw-baseline.sh");
    expect(openclawBaselineScript).toContain('"src/entry.ts"');
    expect(openclawBaselineScript).toContain('"node_modules/tsx/dist/esm/index.mjs"');
    expect(smokeScript).toContain(
      'OPENCLAW_DIR="${OPENCLAW_DIR:-${OPENCLAW_CHECKOUT:-/Users/leon/openclaw}}"',
    );
    expect(smokeScript).toContain("CLAW_PILOT_SMOKE=1 pnpm exec vitest run");
    expect(smokeScript).toContain("pnpm typecheck");
    expect(runbook).toContain("the Pi Runtime capability");
    expect(runbook).toContain("checks are required and must not skip");

    for (const referencedPath of [
      "tests/pilot-operations-baseline.test.ts",
      "tests/openclaw-agent-workspace-config.test.ts",
      "tests/scope-bridge.test.ts",
      "tests/scope-get.test.ts",
      "tests/scoped-read.test.ts",
      "tests/write-audit.test.ts",
      "tests/artifact.test.ts",
      "tests/mcp-artifact-create.test.ts",
      "tests/openclaw-read-loop.test.ts",
      "tests/sedimentation-loop.test.ts",
      "tests/claw-agent-capability-harness.test.ts",
    ]) {
      expect(smokeScript).toContain(referencedPath);
      expect(existsSync(path.join(repoRoot, referencedPath))).toBe(true);
    }
  });

  it("pins the security checklist to the shipped locked-down OpenClaw config", () => {
    const runbook = readFileSync(runbookPath, "utf8");
    const config = JSON.parse(readFileSync(openclawConfigPath, "utf8")) as {
      agents: {
        list: Array<{
          id: string;
          tools: {
            allow: string[];
            deny: string[];
          };
        }>;
      };
      session: {
        dmScope: string;
      };
      gateway: {
        mode: string;
        bind: string;
      };
      mcp: {
        servers: {
          claw: {
            env: {
              CLAW_DATA_DIR: string;
            };
          };
        };
      };
    };
    const clawAgent = config.agents.list.find((agent) => agent.id === "claw-agent");

    expect(config.session.dmScope).toBe("per-channel-peer");
    expect(config.gateway.mode).toBe("local");
    expect(config.gateway.bind).toBe("auto");
    expect(config.mcp.servers.claw.env.CLAW_DATA_DIR).toBe("claw-data");
    expect(runbook).toContain(
      'OPENCLAW_CONFIG_PATH="$REPO_ROOT/integrations/openclaw/claw-agent.openclaw.json"',
    );
    expect(runbook).toContain("allows only the reviewed CLAW-native tools");
    expect(runbook).not.toContain("tools.profile");
    expect(runbook).not.toContain("bundle-mcp");
    expect(clawAgent?.tools.allow).toEqual([
      ...CLAW_NATIVE_OPENCLAW_TOOL_NAMES,
      "message",
      "session_status",
    ]);
    for (const allowedTool of [
      ...CLAW_NATIVE_OPENCLAW_TOOL_NAMES,
      "message",
      "session_status",
    ]) {
      expect(runbook).toContain(allowedTool);
    }

    for (const deniedTool of [
      "group:fs",
      "group:runtime",
      "group:ui",
      "group:automation",
      "group:agents",
      "read",
      "write",
      "edit",
      "apply_patch",
      "exec",
      "process",
      "browser",
      "gateway",
      "cron",
      "sessions_spawn",
      "sessions_yield",
      "subagents",
      "session_spawn",
      "agent_send",
    ]) {
      expect(clawAgent?.tools.deny).toContain(deniedTool);
      expect(runbook).toContain(deniedTool);
    }
  });

  it("keeps audit review and backup procedures concrete enough to execute", () => {
    const runbook = readFileSync(runbookPath, "utf8");

    expectAll(runbook, [
      "find \"$CLAW_DATA_DIR/audit\" -type f -name '*.md' | sort",
      "rg -n \"audit_id:|actor_ssid_hash:|role:|action:|target_file_ids:|summary:\"",
      "umask 077",
      "chmod 700 \"$BACKUP_ROOT\"",
      "tar --create --gzip --file \"$BACKUP_ROOT/claw-data.tgz\" -C \"$REPO_ROOT\" claw-data",
      "shasum -a 256 \"$BACKUP_ROOT/claw-data.tgz\" > \"$BACKUP_ROOT/SHA256SUMS\"",
      "chmod 600 \"$BACKUP_ROOT/claw-data.tgz\" \"$BACKUP_ROOT/SHA256SUMS\"",
      "chmod 600 \"$BACKUP_ROOT/openclaw-sessions.tgz\"",
      "encrypted local disk or an access-controlled",
      "remote backup target",
      "shasum -a 256 --check \"$BACKUP_ROOT/SHA256SUMS\"",
      "tar --extract --gzip --file \"$BACKUP_ROOT/claw-data.tgz\" -C \"$RESTORE_SCRATCH\"",
      "chmod 700 \"$RESTORE_SCRATCH\"",
      "chmod -R go-rwx \"$RESTORE_SCRATCH\"",
      "test -d \"$RESTORE_SCRATCH/claw-data/registry\"",
      "test -d \"$RESTORE_SCRATCH/claw-data/classes\"",
      "test -d \"$RESTORE_SCRATCH/claw-data/audit\"",
      "mv \"$REPO_ROOT/claw-data\" \"$PRE_RESTORE\"",
      "mv \"$RESTORE_SCRATCH/claw-data\" \"$REPO_ROOT/claw-data\"",
      "chmod -R go-rwx \"$REPO_ROOT/claw-data\"",
      "export FAILED_RESTORE=",
      "claw-data.failed-restore",
      "mv \"$REPO_ROOT/claw-data\" \"$FAILED_RESTORE\"",
      "chmod -R go-rwx \"$FAILED_RESTORE\"",
      "mv \"$PRE_RESTORE\" \"$REPO_ROOT/claw-data\"",
    ]);
  });
});

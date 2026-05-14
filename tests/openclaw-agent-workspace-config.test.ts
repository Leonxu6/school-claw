import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  CLAW_AGENT_ID,
  CLAW_SCOPE_BRIDGE_PLUGIN_ID,
  TSX_ESM_LOADER_PATH,
  createLoadableClawAgentOpenClawConfig,
} from "../src/openclaw/claw-agent-config.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const openclawCheckoutPath = "/Users/leon/openclaw";
const openclawSourceCliEntryPath = path.join(openclawCheckoutPath, "src", "entry.ts");
const openclawTsxLoaderPath = path.join(
  openclawCheckoutPath,
  TSX_ESM_LOADER_PATH,
);
const shippedConfigRelativePath = path.join(
  "integrations",
  "openclaw",
  "claw-agent.openclaw.json",
);

function validateWithPinnedOpenClawSource(configPath: string, cwd: string): string {
  return execFileSync(
    "node",
    ["--import", openclawTsxLoaderPath, openclawSourceCliEntryPath, "config", "validate"],
    {
      cwd,
      env: {
        ...process.env,
        OPENCLAW_CONFIG_PATH: configPath,
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

describe("OpenClaw claw-agent workspace config", () => {
  it("defines a loadable one-agent OpenClaw config with scoped MCP and locked-down native tools", () => {
    const dataRoot = path.join(repoRoot, "claw-data");
    const config = createLoadableClawAgentOpenClawConfig({ repoRoot, dataRoot });

    expect(config).not.toHaveProperty("openclawRuntime");
    expect(config.session.dmScope).toBe("per-channel-peer");
    expect(config.agents.list).toHaveLength(1);
    expect(config.agents.defaults).not.toHaveProperty("agentRuntime");
    expect(config.agents.defaults.model).toEqual({
      primary: "minimax/MiniMax-M2.7",
      fallbacks: [],
    });
    expect(config.agents.defaults.models["minimax/MiniMax-M2.7"]).toEqual({
      agentRuntime: {
        id: "pi",
      },
    });
    expect(config.agents.defaults.models).not.toHaveProperty("openai/gpt-5.5");

    const agent = config.agents.list[0];

    expect(agent).toMatchObject({
      id: CLAW_AGENT_ID,
      default: true,
      workspace: path.join(repoRoot, "workspaces", CLAW_AGENT_ID),
      systemPromptOverride: path.join(repoRoot, "prompts", "claw-agent.md"),
      tools: {
        profile: "messaging",
        allow: ["bundle-mcp", "message", "session_status"],
      },
    });
    expect(agent?.tools.deny).toEqual(
      expect.arrayContaining([
        "group:fs",
        "group:runtime",
        "group:ui",
        "group:automation",
        "read",
        "write",
        "edit",
        "apply_patch",
        "exec",
        "process",
        "gateway",
        "cron",
        "sessions_spawn",
        "sessions_yield",
        "subagents",
        "session_spawn",
        "agent_send",
      ]),
    );
    expect(path.relative(agent?.workspace ?? "", dataRoot).startsWith("..")).toBe(
      true,
    );

    expect(config.mcp.servers.claw).toMatchObject({
      command: "node",
      args: [
        "--import",
        path.join(repoRoot, TSX_ESM_LOADER_PATH),
        path.join(repoRoot, "src", "mcp", "server.ts"),
      ],
      cwd: path.resolve(repoRoot),
      env: {
        CLAW_DATA_DIR: path.resolve(dataRoot),
      },
    });
    expect(config.plugins.load.paths).toEqual([
      path.join(
        repoRoot,
        "integrations",
        "openclaw",
        "plugins",
        CLAW_SCOPE_BRIDGE_PLUGIN_ID,
      ),
    ]);
    expect(config.plugins.entries[CLAW_SCOPE_BRIDGE_PLUGIN_ID]).toEqual({
      enabled: true,
    });
  });

  it("ships the OpenClaw config file and Scope Bridge plugin assets", () => {
    const dataRoot = path.join(repoRoot, "claw-data");
    const configPath = path.join(
      repoRoot,
      shippedConfigRelativePath,
    );
    const pluginRoot = path.join(
      repoRoot,
      "integrations",
      "openclaw",
      "plugins",
      CLAW_SCOPE_BRIDGE_PLUGIN_ID,
    );
    const excludedRootOpenClawDir = path.join(repoRoot, "openclaw");

    expect(path.relative(excludedRootOpenClawDir, configPath).startsWith("..")).toBe(
      true,
    );
    expect(path.relative(excludedRootOpenClawDir, pluginRoot).startsWith("..")).toBe(
      true,
    );

    expect(JSON.parse(readFileSync(configPath, "utf8"))).toEqual(
      createLoadableClawAgentOpenClawConfig({
        repoRoot,
        dataRoot,
        pathMode: "repo-relative",
      }),
    );

    expect(
      JSON.parse(readFileSync(path.join(pluginRoot, "openclaw.plugin.json"), "utf8")),
    ).toMatchObject({
      id: CLAW_SCOPE_BRIDGE_PLUGIN_ID,
      activation: { onStartup: true },
      configSchema: {
        additionalProperties: false,
      },
    });
    expect(existsSync(path.join(pluginRoot, "package.json"))).toBe(true);
    expect(existsSync(path.join(pluginRoot, "index.ts"))).toBe(true);
  });

  it("keeps the shipped config relocatable to the current checkout", () => {
    const configPath = path.join(repoRoot, shippedConfigRelativePath);
    const rawConfig = readFileSync(configPath, "utf8");

    expect(rawConfig).not.toContain(path.resolve(repoRoot));
  });

  it.skipIf(!existsSync(openclawSourceCliEntryPath) || !existsSync(openclawTsxLoaderPath))(
    "fails validation when a relocated checkout is missing its local Scope Bridge plugin",
    () => {
      const tempRoot = mkdtempSync(path.join(tmpdir(), "claw-openclaw-relocated-"));

      try {
        const tempConfigPath = path.join(tempRoot, shippedConfigRelativePath);
        mkdirSync(path.dirname(tempConfigPath), { recursive: true });
        cpSync(path.join(repoRoot, shippedConfigRelativePath), tempConfigPath);

        expect(() => {
          validateWithPinnedOpenClawSource(tempConfigPath, tempRoot);
        }).toThrow(/plugin path not found|Config invalid/);
      } finally {
        rmSync(tempRoot, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(!existsSync(openclawSourceCliEntryPath) || !existsSync(openclawTsxLoaderPath))(
    "is accepted by the pinned OpenClaw source CLI config validator",
    () => {
      const configPath = path.join(repoRoot, shippedConfigRelativePath);

      expect(() => {
        validateWithPinnedOpenClawSource(configPath, repoRoot);
      }).not.toThrow();
    },
  );

  it.skipIf(!existsSync(openclawSourceCliEntryPath))(
    "loads the Scope Bridge plugin and registers the before_tool_call hook",
    () => {
      const pluginIndexPath = path.join(
        repoRoot,
        "integrations",
        "openclaw",
        "plugins",
        CLAW_SCOPE_BRIDGE_PLUGIN_ID,
        "index.ts",
      );
      const output = execFileSync(
        "node",
        [
          "--import",
          openclawTsxLoaderPath,
          "-e",
          `
            (async () => {
              const plugin = await import(${JSON.stringify(pluginIndexPath)});
              const registered = [];
              plugin.default.register({
                on: (...args) => registered.push(args),
              });
              const [hookName, handler, options] = registered[0] ?? [];
              const bridged = handler(
                {
                  toolName: "claw__files_read",
                  params: {
                    ssid: "forged-session",
                    fileIds: ["classes/class_001/students/stu_002/profile.md"],
                  },
                },
                { sessionKey: "trusted-session" },
              );
              const blocked = handler(
                { toolName: "claw__scope_get", params: {} },
                {},
              );
              const ignored = handler(
                { toolName: "message", params: { text: "hello" } },
                { sessionKey: "trusted-session" },
              );
              console.log(JSON.stringify({
                id: plugin.default.id,
                hookName,
                options,
                bridged,
                blocked,
                ignored,
              }));
            })();
          `,
        ],
        {
          cwd: openclawCheckoutPath,
          encoding: "utf8",
        },
      );
      const result = JSON.parse(output) as {
        id: string;
        hookName: string;
        options: { priority: number };
        bridged: {
          params: {
            ssid: string;
            fileIds: string[];
          };
        };
        blocked: {
          block: boolean;
          blockReason: string;
        };
      };

      expect(result).toEqual({
        id: CLAW_SCOPE_BRIDGE_PLUGIN_ID,
        hookName: "before_tool_call",
        options: { priority: 100 },
        bridged: {
          params: {
            ssid: "trusted-session",
            fileIds: ["classes/class_001/students/stu_002/profile.md"],
          },
        },
        blocked: {
          block: true,
          blockReason:
            "CLAW Scope Bridge requires an OpenClaw sessionKey before calling CLAW tools.",
        },
      });
    },
  );
});

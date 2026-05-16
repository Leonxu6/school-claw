import { readFileSync } from "node:fs";
import path from "node:path";

import { CLAW_NATIVE_OPENCLAW_TOOL_NAMES } from "./native-tools.js";

export { CLAW_NATIVE_OPENCLAW_TOOL_NAMES };

export const CLAW_AGENT_ID = "claw-agent";
export const CLAW_SCOPE_BRIDGE_PLUGIN_ID = "claw-scope-bridge";
export const TSX_ESM_LOADER_PATH = path.join(
  "node_modules",
  "tsx",
  "dist",
  "esm",
  "index.mjs",
);
export const PINNED_OPENCLAW_CHECKOUT_PATH = "/Users/leon/openclaw";
export const PINNED_OPENCLAW_COMMIT = "da23f4572da7d59ef97688ad8b61771e5b708733";

export type ClawAgentOpenClawConfig = {
  openclawRuntime: {
    checkoutPath: string;
    pinnedCommit: string;
  };
  gateway: {
    mode: "local";
    bind: "auto";
  };
  session: {
    dmScope: "per-channel-peer";
  };
  agents: {
    defaults: {
      model: {
        primary: string;
        fallbacks: string[];
      };
      models: Record<
        string,
        {
          agentRuntime: {
            id: "pi";
          };
        }
      >;
      maxConcurrent: number;
      timeoutSeconds: number;
    };
    list: [
      {
        id: typeof CLAW_AGENT_ID;
        default: true;
        name: "CLAW Agent";
        workspace: string;
        systemPromptOverride: string;
        tools: {
          allow: string[];
          deny: string[];
        };
      },
    ];
  };
  mcp: {
    servers: {
      claw: {
        command: "node";
        args: string[];
        cwd: string;
        env: {
          CLAW_DATA_DIR: string;
        };
      };
    };
  };
  plugins: {
    load: {
      paths: string[];
    };
    entries: Record<
      typeof CLAW_SCOPE_BRIDGE_PLUGIN_ID,
      {
        enabled: true;
      }
    >;
  };
};

export type LoadableClawAgentOpenClawConfig = Omit<
  ClawAgentOpenClawConfig,
  "openclawRuntime"
>;

export type ClawAgentOpenClawConfigOptions = {
  repoRoot: string;
  dataRoot: string;
  openclawCheckoutPath?: string;
  pinnedOpenClawCommit?: string;
  clawMcpServerEntry?: string;
  pathMode?: "absolute" | "repo-relative";
};

const NATIVE_DATA_TOOL_DENYLIST = [
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
  "nodes",
  "canvas",
  "sessions_spawn",
  "sessions_yield",
  "subagents",
  "session_spawn",
  "agent_send",
  "llm_task",
];

function toConfigPath(
  repoRoot: string,
  targetPath: string,
  pathMode: "absolute" | "repo-relative",
) {
  if (pathMode === "absolute") {
    return targetPath;
  }

  const relativePath = path.relative(repoRoot, targetPath);

  if (!relativePath) {
    return ".";
  }

  if (!relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
    return relativePath;
  }

  return targetPath;
}

function toNodeImportSpecifier(
  repoRoot: string,
  targetPath: string,
  pathMode: "absolute" | "repo-relative",
) {
  const configPath = toConfigPath(repoRoot, targetPath, pathMode);

  if (pathMode === "repo-relative" && !path.isAbsolute(configPath) && configPath !== ".") {
    return configPath.startsWith(".") ? configPath : `./${configPath}`;
  }

  return configPath;
}

export function createClawAgentOpenClawConfig(
  options: ClawAgentOpenClawConfigOptions,
): ClawAgentOpenClawConfig {
  const repoRoot = path.resolve(options.repoRoot);
  const dataRoot = path.resolve(options.dataRoot);
  const openclawCheckoutPath =
    options.openclawCheckoutPath ??
    process.env.OPENCLAW_DIR ??
    process.env.OPENCLAW_CHECKOUT ??
    PINNED_OPENCLAW_CHECKOUT_PATH;
  const pathMode = options.pathMode ?? "absolute";
  const fromRepoRoot = (...segments: string[]) =>
    toConfigPath(repoRoot, path.join(repoRoot, ...segments), pathMode);
  const systemPromptOverride = createClawAgentSystemPrompt(repoRoot);

  return {
    openclawRuntime: {
      checkoutPath: openclawCheckoutPath,
      pinnedCommit: options.pinnedOpenClawCommit ?? PINNED_OPENCLAW_COMMIT,
    },
    gateway: {
      mode: "local",
      bind: "auto",
    },
    session: {
      dmScope: "per-channel-peer",
    },
    agents: {
      defaults: {
        model: {
          primary: "minimax/MiniMax-M2.7",
          fallbacks: [],
        },
        models: {
          "minimax/MiniMax-M2.7": {
            agentRuntime: {
              id: "pi",
            },
          },
        },
        maxConcurrent: 4,
        timeoutSeconds: 600,
      },
      list: [
        {
          id: CLAW_AGENT_ID,
          default: true,
          name: "CLAW Agent",
          workspace: fromRepoRoot("workspaces", CLAW_AGENT_ID),
          systemPromptOverride,
          tools: {
            allow: [
              ...CLAW_NATIVE_OPENCLAW_TOOL_NAMES,
              "message",
              "session_status",
            ],
            deny: [...NATIVE_DATA_TOOL_DENYLIST],
          },
        },
      ],
    },
    plugins: {
      load: {
        paths: [
          fromRepoRoot(
            "integrations",
            "openclaw",
            "plugins",
            CLAW_SCOPE_BRIDGE_PLUGIN_ID,
          ),
        ],
      },
      entries: {
        [CLAW_SCOPE_BRIDGE_PLUGIN_ID]: {
          enabled: true,
        },
      },
    },
    mcp: {
      servers: {
        claw: {
          command: "node",
          args: [
            "--import",
            toNodeImportSpecifier(
              repoRoot,
              path.join(repoRoot, TSX_ESM_LOADER_PATH),
              pathMode,
            ),
            options.clawMcpServerEntry
              ? toConfigPath(
                  repoRoot,
                  path.resolve(repoRoot, options.clawMcpServerEntry),
                  pathMode,
                )
              : fromRepoRoot("src", "mcp", "server.ts"),
          ],
          cwd: toConfigPath(repoRoot, repoRoot, pathMode),
          env: {
            CLAW_DATA_DIR: toConfigPath(repoRoot, dataRoot, pathMode),
          },
        },
      },
    },
  };
}

function createClawAgentSystemPrompt(repoRoot: string): string {
  const promptText = readFileSync(path.join(repoRoot, "prompts", "claw-agent.md"), "utf8");
  const workspaceContract = readFileSync(
    path.join(repoRoot, "workspaces", CLAW_AGENT_ID, "AGENTS.md"),
    "utf8",
  );

  return [
    promptText.trimEnd(),
    "",
    "## Embedded Workspace Behavior Contract",
    "",
    workspaceContract.trimEnd(),
    "",
  ].join("\n");
}

export function createLoadableClawAgentOpenClawConfig(
  options: ClawAgentOpenClawConfigOptions,
): LoadableClawAgentOpenClawConfig {
  const { openclawRuntime: _openclawRuntime, ...loadableConfig } =
    createClawAgentOpenClawConfig(options);

  return loadableConfig;
}

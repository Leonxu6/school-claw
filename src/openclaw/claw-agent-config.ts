import path from "node:path";

export const CLAW_AGENT_ID = "claw-agent";
export const PINNED_OPENCLAW_CHECKOUT_PATH = "/Users/leon/openclaw";
export const PINNED_OPENCLAW_COMMIT = "da23f4572da7d59ef97688ad8b61771e5b708733";

export type ClawAgentOpenClawConfig = {
  openclawRuntime: {
    checkoutPath: string;
    pinnedCommit: string;
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
          profile: "messaging";
          allow: string[];
          deny: string[];
        };
      },
    ];
  };
  mcp: {
    sessionIdleTtlMs: number;
    servers: {
      claw: {
        command: "pnpm";
        args: string[];
        cwd: string;
        env: {
          CLAW_DATA_DIR: string;
        };
      };
    };
  };
};

export type ClawAgentOpenClawConfigOptions = {
  repoRoot: string;
  dataRoot: string;
  openclawCheckoutPath?: string;
  pinnedOpenClawCommit?: string;
  clawMcpServerEntry?: string;
};

const NATIVE_DATA_TOOL_DENYLIST = [
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
  "session_spawn",
  "agent_send",
  "llm_task",
];

export function createClawAgentOpenClawConfig(
  options: ClawAgentOpenClawConfigOptions,
): ClawAgentOpenClawConfig {
  const repoRoot = path.resolve(options.repoRoot);
  const dataRoot = path.resolve(options.dataRoot);

  return {
    openclawRuntime: {
      checkoutPath: options.openclawCheckoutPath ?? PINNED_OPENCLAW_CHECKOUT_PATH,
      pinnedCommit: options.pinnedOpenClawCommit ?? PINNED_OPENCLAW_COMMIT,
    },
    session: {
      dmScope: "per-channel-peer",
    },
    agents: {
      defaults: {
        model: {
          primary: "minimax/MiniMax-M2.7",
          fallbacks: ["openai/gpt-5.5"],
        },
        maxConcurrent: 4,
        timeoutSeconds: 600,
      },
      list: [
        {
          id: CLAW_AGENT_ID,
          default: true,
          name: "CLAW Agent",
          workspace: path.join(repoRoot, "workspaces", CLAW_AGENT_ID),
          systemPromptOverride: path.join(repoRoot, "prompts", "claw-agent.md"),
          tools: {
            profile: "messaging",
            allow: ["bundle-mcp", "message", "session_status"],
            deny: [...NATIVE_DATA_TOOL_DENYLIST],
          },
        },
      ],
    },
    mcp: {
      sessionIdleTtlMs: 600_000,
      servers: {
        claw: {
          command: "pnpm",
          args: [
            "tsx",
            options.clawMcpServerEntry ?? path.join(repoRoot, "src", "mcp", "server.ts"),
          ],
          cwd: repoRoot,
          env: {
            CLAW_DATA_DIR: dataRoot,
          },
        },
      },
    },
  };
}

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const workspaceContractPath = new URL(
  "../workspaces/claw-agent/AGENTS.md",
  import.meta.url,
);
const promptPath = new URL("../prompts/claw-agent.md", import.meta.url);

function expectAll(text: string, fragments: string[]): void {
  for (const fragment of fragments) {
    expect(text).toContain(fragment);
  }
}

describe("claw-agent capability prompt contract", () => {
  it("defines the canonical workspace behavior contract for reusable CLAW capabilities", () => {
    const contract = readFileSync(workspaceContractPath, "utf8");

    expectAll(contract, [
      "## Canonical Behavior Contract",
      "one `claw-agent`",
      "parents and teachers are sessions",
      "CLAW MCP",
      "`claw__scope_get`",
      "before any archive read or write",
      "returned scope is the only authority",
      "`claw__files_read`",
      "`claw__files_read_all`",
      "Do not invent student history",
      "durable learning facts",
      "`claw__files_append`",
      "ordinary chat",
      "`claw__artifact_create`",
      "sourceFileIds",
      "Refuse parent requests for other students",
      "class-identifiable",
      "no medical or psychological diagnosis",
      "Teacher tone",
      "Parent tone",
      "Identity and tool boundary",
      "PRD section 10",
      "Scope first",
      "sections 12 and 14",
      "Evidence before claims",
      "Learning fact sedimentation",
      "Generated artifacts",
      "Refusal and safety",
      "Tone",
    ]);
    expect(contract).not.toMatch(/\bgenerate_practice\b|\bgenerate_feedback\b/u);
  });

  it("keeps the OpenClaw system prompt as a concise entrypoint to the workspace contract", () => {
    const prompt = readFileSync(promptPath, "utf8");

    expectAll(prompt, [
      "one claw-agent",
      "workspaces/claw-agent/AGENTS.md",
      "canonical behavior contract",
      "`claw__scope_get`",
      "`claw__files_read`",
      "`claw__files_read_all`",
      "`claw__files_append`",
      "`claw__artifact_create`",
      "uncertainty",
      "Do not use native file tools",
      "Prompt review notes",
      "PRD sections 6-13",
      "architecture sections",
    ]);
    expect(prompt.length).toBeLessThan(2_500);
  });

  it("ships the contract in the configured OpenClaw workspace", () => {
    expect(repoRoot).toContain("school-claw");
    const prompt = readFileSync(promptPath, "utf8");
    const contract = readFileSync(workspaceContractPath, "utf8");

    expect(prompt).toContain("workspaces/claw-agent/AGENTS.md");
    expect(contract).toContain("Education data is accessed only through CLAW MCP tools");
  });
});

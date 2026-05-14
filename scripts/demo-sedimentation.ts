import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runSedimentationDemo } from "../src/openclaw/sedimentation-loop.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = fileURLToPath(
  new URL("../tests/fixtures/markdown-archive/", import.meta.url),
);
const scratchRoot = path.join(tmpdir(), `school-claw-sedimentation-demo-${crypto.randomUUID()}`);
const dataRoot = path.join(scratchRoot, "archive");
const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";

function readAuditEntries(): string[] {
  const auditRoot = path.join(dataRoot, "audit");

  if (!existsSync(auditRoot)) {
    return [];
  }

  return walkFiles(auditRoot).map((filePath) => readFileSync(filePath, "utf8"));
}

function walkFiles(rootPath: string): string[] {
  const stat = statSync(rootPath);

  if (stat.isFile()) {
    return [rootPath];
  }

  return readdirSync(rootPath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(rootPath, entry.name);

    return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
  });
}

try {
  cpSync(fixtureRoot, dataRoot, { recursive: true });

  const demo = await runSedimentationDemo({
    repoRoot,
    dataRoot,
    sessionKey: parentASsid,
    nowIso: "2026-06-01T12:00:00.000Z",
    learningFact: "孩子说今天数学应用题错了两道，因为没看清题目问的是什么。",
    followUpQuestion: "刚才那条新记录说明了什么？",
    idleChat: "你好，辛苦了。",
  });

  for (const line of demo.logLines) {
    console.log(line);
  }

  console.log("");
  console.log(demo.learningFactTurn.reply);
  console.log("");
  console.log(demo.followUpTurn.reply);
  console.log("");
  console.log(`audit entries: ${readAuditEntries().length}`);
} finally {
  rmSync(scratchRoot, { recursive: true, force: true });
}

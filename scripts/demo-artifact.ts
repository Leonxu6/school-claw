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

import {
  filesRead,
  filesReadAll,
  type FilesReadResult,
} from "../src/archive/scoped-read.js";
import {
  artifactCreate,
  type ArtifactCreateResult,
} from "../src/archive/write-audit.js";

const fixtureRoot = fileURLToPath(
  new URL("../tests/fixtures/markdown-archive/", import.meta.url),
);
const scratchRoot = path.join(
  tmpdir(),
  `school-claw-artifact-demo-${crypto.randomUUID()}`,
);
const dataRoot = path.join(scratchRoot, "archive");

const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const fixedNow = new Date("2026-05-13T08:30:00.000Z");

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function expectArtifact(result: ArtifactCreateResult) {
  assert(result.ok, result.ok ? "" : `artifact_create failed: ${result.error.code}`);

  if (!result.ok) {
    throw new Error("unreachable");
  }

  return result;
}

function expectRead(result: FilesReadResult) {
  assert(result.ok, result.ok ? "" : `files_read failed: ${result.error.code}`);

  if (!result.ok) {
    throw new Error("unreachable");
  }

  return result;
}

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

  const sources = filesReadAll(
    {
      ssid: parentASsid,
      studentId: "stu_001",
      kinds: ["profile", "errors"],
      maxFiles: 2,
      maxTotalChars: 10_000,
    },
    { dataRoot },
  );

  assert(sources.ok, sources.ok ? "" : `files_read_all failed: ${sources.error.code}`);
  assert(sources.ok && sources.documents.length === 2, "expected two source documents");
  assert(sources.ok && !sources.truncated, "source read should not truncate");
  console.log("read scoped source docs -> PASS");

  const sourceFileIds = sources.ok
    ? sources.documents.map((document) => document.fileId)
    : [];
  const artifact = expectArtifact(
    await artifactCreate(
      {
        ssid: parentASsid,
        artifactType: "practice",
        title: "张三分数应用题练习",
        studentId: "stu_001",
        format: "markdown",
        content: [
          "# 张三分数应用题练习",
          "",
          "1. 先圈出单位一，再列式。",
          "",
          "答案：单位一是总量。",
        ].join("\n"),
        sourceFileIds,
      },
      { dataRoot, now: () => fixedNow },
    ),
  );

  console.log("create artifact -> PASS");

  assert(existsSync(path.join(dataRoot, artifact.fileId)), "artifact file missing");
  console.log("artifact file exists -> PASS");

  const auditText = readAuditEntries().join("\n");

  assert(auditText.includes(`audit_id: ${artifact.auditId}`), "auditId missing");
  assert(auditText.includes("action: artifact_create"), "artifact audit action missing");
  assert(auditText.includes(`target_file_ids: ${artifact.fileId}`), "audit target missing");
  console.log("audit exists -> PASS");

  const readBack = expectRead(
    filesRead({ ssid: parentASsid, fileIds: [artifact.fileId] }, { dataRoot }),
  );

  assert(
    readBack.documents[0]?.frontmatter.source_file_ids === sourceFileIds.join(", "),
    "artifact source metadata missing",
  );
  assert(
    readBack.documents[0]?.content.includes("先圈出单位一") === true,
    "artifact content missing",
  );
  console.log("read artifact succeeds -> PASS");

  const auditBefore = readAuditEntries().join("\n");
  const forbidden = await artifactCreate(
    {
      ssid: parentASsid,
      artifactType: "practice",
      title: "不应创建的李四练习",
      studentId: "stu_002",
      format: "markdown",
      content: "# 不应创建\n\n- 越权内容。",
      sourceFileIds: ["classes/class_001/students/stu_001/profile.md"],
    },
    { dataRoot, now: () => fixedNow },
  );

  assert(!forbidden.ok && forbidden.error.code === "FORBIDDEN", "forbidden create succeeded");
  assert(
    !existsSync(path.join(dataRoot, "classes/class_001/students/stu_002/artifacts")),
    "forbidden artifact created a target directory",
  );
  assert(readAuditEntries().join("\n") === auditBefore, "forbidden create wrote audit");
  console.log("parent creating artifact for other student -> FORBIDDEN");
} finally {
  rmSync(scratchRoot, { recursive: true, force: true });
}

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

import { filesRead } from "../src/archive/scoped-read.js";
import { filesAppend } from "../src/archive/write-audit.js";

const fixtureRoot = fileURLToPath(
  new URL("../tests/fixtures/markdown-archive/", import.meta.url),
);
const scratchRoot = path.join(tmpdir(), `school-claw-write-demo-${crypto.randomUUID()}`);
const dataRoot = path.join(scratchRoot, "archive");

const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const targetFileId =
  "classes/class_001/students/stu_001/parent-observations/2026-05.md";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function readVisibleContent(fileId: string): string {
  const result = filesRead({ ssid: parentASsid, fileIds: [fileId] }, { dataRoot });

  assert(result.ok, "read same file failed");

  return result.ok ? (result.documents[0]?.content ?? "") : "";
}

function readAuditEntries(): string[] {
  const auditRoot = path.join(dataRoot, "audit");

  if (!existsSync(auditRoot)) {
    return [];
  }

  return walkFiles(auditRoot).map((filePath) => {
    return readFileSync(filePath, "utf8");
  });
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

  const before = readFileSync(path.join(dataRoot, targetFileId), "utf8");
  const append = await filesAppend(
    {
      ssid: parentASsid,
      target: {
        kind: "parent_observation",
        studentId: "stu_001",
        month: "2026-05",
      },
      content: "- Demo: parent added a durable observation.",
      reason: "demo parent observation append",
    },
    { dataRoot },
  );

  assert(append.ok, "append observation failed");
  assert(
    readFileSync(path.join(dataRoot, targetFileId), "utf8").includes(before),
    "append did not preserve existing Markdown",
  );
  console.log("append observation -> file content grows: PASS");

  const content = readVisibleContent(targetFileId);

  assert(
    content.includes("Demo: parent added a durable observation."),
    "read-back did not include appended record",
  );
  console.log("read same file -> new record visible: PASS");

  const auditText = readAuditEntries().join("\n");

  assert(auditText.includes(`audit_id: ${append.ok ? append.auditId : ""}`), "auditId missing");
  assert(auditText.includes("action: files_append"), "audit action missing");
  assert(auditText.includes(`target_file_ids: ${targetFileId}`), "audit target missing");
  console.log("audit log -> matching auditId/action/target exists: PASS");

  const otherStudentFile =
    "classes/class_001/students/stu_002/timeline/2026-05-12.md";
  const otherBefore = readFileSync(path.join(dataRoot, otherStudentFile), "utf8");
  const auditBefore = readAuditEntries().join("\n");
  const forbidden = await filesAppend(
    {
      ssid: parentASsid,
      target: {
        kind: "timeline",
        studentId: "stu_002",
        date: "2026-05-12",
      },
      content: "- forbidden demo write",
      reason: "demo forbidden cross-student append",
    },
    { dataRoot },
  );

  assert(!forbidden.ok && forbidden.error.code === "FORBIDDEN", "forbidden append succeeded");
  assert(
    readFileSync(path.join(dataRoot, otherStudentFile), "utf8") === otherBefore,
    "forbidden append changed another student file",
  );
  assert(readAuditEntries().join("\n") === auditBefore, "forbidden append wrote success audit");
  console.log("forbidden append -> no file change and no success audit: PASS");
} finally {
  rmSync(scratchRoot, { recursive: true, force: true });
}

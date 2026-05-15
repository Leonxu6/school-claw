import {
  chmodSync,
  existsSync,
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { filesRead } from "../src/archive/scoped-read.js";
import {
  filesWrite,
  filesAppend,
  type FilesAppendResult,
  type FilesWriteResult,
} from "../src/archive/write-audit.js";

const fixtureRoot = fileURLToPath(
  new URL("./fixtures/markdown-archive/", import.meta.url),
);

const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const teacherSsid = "agent:claw-agent:feishu:direct:teacher-openid-001";

let scratchRoot: string;
let dataRoot: string;

function expectAppend(result: FilesAppendResult) {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected append, received ${result.error.code}`);
  }

  return result;
}

function expectWrite(result: FilesWriteResult) {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected write, received ${result.error.code}`);
  }

  return result;
}

function expectError(result: FilesAppendResult | FilesWriteResult) {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected error, received success");
  }

  return result.error;
}

function readDocumentContent(ssid: string, fileId: string): string {
  return readDocument(ssid, fileId).content;
}

function readDocument(ssid: string, fileId: string) {
  const result = filesRead({ ssid, fileIds: [fileId] }, { dataRoot });

  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected read, received ${result.error.code}`);
  }

  const document = result.documents[0];

  if (!document) {
    throw new Error("Expected one document");
  }

  return document;
}

function readAuditEntry(auditId: string): string {
  const auditRoot = path.join(dataRoot, "audit");
  const entries = walkFiles(auditRoot).map((filePath) => {
    return readFileSync(filePath, "utf8");
  });
  const entry = entries.find((content) => {
    return content.includes(`audit_id: ${auditId}`);
  });

  if (!entry) {
    throw new Error(`Missing audit entry ${auditId}`);
  }

  return entry;
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

describe("safe write and audit loop", () => {
  beforeEach(() => {
    scratchRoot = path.join(tmpdir(), `school-claw-write-${crypto.randomUUID()}`);
    dataRoot = path.join(scratchRoot, "archive");
    cpSync(fixtureRoot, dataRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(scratchRoot, { recursive: true, force: true });
  });

  it("appends a scoped parent observation without losing existing content and writes audit", async () => {
    const fileId =
      "classes/class_001/students/stu_001/parent-observations/2026-05.md";
    const before = readFileSync(path.join(dataRoot, fileId), "utf8");

    const append = expectAppend(
      await filesAppend(
        {
          ssid: parentASsid,
          target: {
            kind: "parent_observation",
            studentId: "stu_001",
            month: "2026-05",
          },
          content: "- 新增：今晚第 5 题能说出错因。",
          reason: "parent reported a durable learning observation",
        },
        { dataRoot },
      ),
    );

    expect(append.fileId).toBe(fileId);
    expect(readFileSync(path.join(dataRoot, fileId), "utf8")).toContain(before);
    expect(readDocumentContent(parentASsid, append.fileId)).toContain(
      "晚上复盘时能说出错因",
    );
    expect(readDocumentContent(parentASsid, append.fileId)).toContain(
      "新增：今晚第 5 题能说出错因",
    );

    const auditEntry = readAuditEntry(append.auditId);

    expect(auditEntry).toContain("action: files_append");
    expect(auditEntry).toContain(`target_file_ids: ${fileId}`);
    expect(auditEntry).toContain("summary: parent reported a durable learning observation");
  });

  it("rejects a parent append for another student without changing files or writing success audit", async () => {
    const otherStudentFile =
      "classes/class_001/students/stu_002/timeline/2026-05-12.md";
    const before = readFileSync(path.join(dataRoot, otherStudentFile), "utf8");

    const error = expectError(
      await filesAppend(
        {
          ssid: parentASsid,
          target: {
            kind: "timeline",
            studentId: "stu_002",
            date: "2026-05-12",
          },
          content: "- 不应写入：越权内容。",
          reason: "cross-student write should be rejected",
        },
        { dataRoot },
      ),
    );

    expect(error.code).toBe("FORBIDDEN");
    expect(readFileSync(path.join(dataRoot, otherStudentFile), "utf8")).toBe(before);
    expect(readAuditEntries()).toEqual([]);
  });

  it("rejects teacher attempts to write parent observation records", async () => {
    const fileId =
      "classes/class_001/students/stu_001/parent-observations/2026-05.md";
    const before = readFileSync(path.join(dataRoot, fileId), "utf8");

    const error = expectError(
      await filesAppend(
        {
          ssid: teacherSsid,
          target: {
            kind: "parent_observation",
            studentId: "stu_001",
            month: "2026-05",
          },
          content: "- 不应写入：老师伪写家长观察。",
          reason: "teacher must not write parent observation provenance",
        },
        { dataRoot },
      ),
    );

    expect(error.code).toBe("FORBIDDEN");
    expect(readFileSync(path.join(dataRoot, fileId), "utf8")).toBe(before);
    expect(readAuditEntries()).toEqual([]);
  });

  it("does not change the target file when audit storage is unavailable", async () => {
    const fileId =
      "classes/class_001/students/stu_001/parent-observations/2026-05.md";
    const before = readFileSync(path.join(dataRoot, fileId), "utf8");

    writeFileSync(path.join(dataRoot, "audit"), "not a directory");

    const error = expectError(
      await filesAppend(
        {
          ssid: parentASsid,
          target: {
            kind: "parent_observation",
            studentId: "stu_001",
            month: "2026-05",
          },
          content: "- 不应写入：审计不可用时不能先改业务文件。",
          reason: "audit storage unavailable regression",
        },
        { dataRoot },
      ),
    );

    expect(error.code).toBe("TOOL_ERROR");
    expect(readFileSync(path.join(dataRoot, fileId), "utf8")).toBe(before);
  });

  it("does not change the target file when the audit month directory is unwritable", async () => {
    const fileId =
      "classes/class_001/students/stu_001/parent-observations/2026-05.md";
    const before = readFileSync(path.join(dataRoot, fileId), "utf8");
    const auditMonthDir = path.join(dataRoot, "audit/2026-05");

    mkdirSync(auditMonthDir, { recursive: true });
    chmodSync(auditMonthDir, 0o500);

    try {
      const error = expectError(
        await filesAppend(
          {
            ssid: parentASsid,
            target: {
              kind: "parent_observation",
              studentId: "stu_001",
              month: "2026-05",
            },
            content: "- 不应写入：审计月份目录不可写时不能先改业务文件。",
            reason: "audit month unwritable regression",
          },
          {
            dataRoot,
            now: () => new Date("2026-05-13T00:00:00.000Z"),
          },
        ),
      );

      expect(error.code).toBe("TOOL_ERROR");
      expect(readFileSync(path.join(dataRoot, fileId), "utf8")).toBe(before);
    } finally {
      chmodSync(auditMonthDir, 0o700);
    }
  });

  it("serializes concurrent same-file appends without losing records", async () => {
    const fileId =
      "classes/class_001/students/stu_001/parent-observations/2026-05.md";

    await Promise.all(
      ["并发记录 A", "并发记录 B", "并发记录 C"].map((label) => {
        return filesAppend(
          {
            ssid: parentASsid,
            target: {
              kind: "parent_observation",
              studentId: "stu_001",
              month: "2026-05",
            },
            content: `- ${label}`,
            reason: label,
          },
          { dataRoot },
        );
      }),
    );

    const content = readDocumentContent(parentASsid, fileId);

    expect(content).toContain("并发记录 A");
    expect(content).toContain("并发记录 B");
    expect(content).toContain("并发记录 C");
    expect(readAuditEntries().join("\n").match(/action: files_append/g)).toHaveLength(3);
  });

  it("creates a missing append target with supplied front matter", async () => {
    const fileId =
      "classes/class_001/students/stu_001/teacher-observations/2026-05.md";

    const append = expectAppend(
      await filesAppend(
        {
          ssid: teacherSsid,
          target: {
            kind: "teacher_observation",
            studentId: "stu_001",
            month: "2026-05",
          },
          frontmatter: {
            type: "teacher_observation",
            student_id: "stu_001",
            class_id: "class_001",
            title: "张三 2026-05 老师观察",
          },
          content: "- 课堂上能跟上讲解，但表达题意偏急。",
          reason: "teacher recorded a durable observation",
        },
        { dataRoot },
      ),
    );

    const document = readDocument(teacherSsid, append.fileId);

    expect(append.fileId).toBe(fileId);
    expect(document.frontmatter).toMatchObject({
      type: "teacher_observation",
      student_id: "stu_001",
    });
    expect(document.content).toContain("课堂上能跟上讲解");
    expect(readAuditEntry(append.auditId)).toContain("action: files_append");
  });

  it("rejects teacher writes for unknown student ids instead of creating new student directories", async () => {
    const unknownStudentDir = path.join(
      dataRoot,
      "classes/class_001/students/zhang_san",
    );

    const error = expectError(
      await filesAppend(
        {
          ssid: teacherSsid,
          target: {
            kind: "teacher_observation",
            studentId: "zhang_san",
            month: "2026-05",
          },
          content: "- 不应写入：模型猜测出来的学生 ID。",
          reason: "teacher must use roster student ids",
        },
        { dataRoot },
      ),
    );

    expect(error.code).toBe("FORBIDDEN");
    expect(existsSync(unknownStudentDir)).toBe(false);
    expect(readAuditEntries()).toEqual([]);
  });

  it("creates and replaces only controlled write files with audit", async () => {
    const fileId =
      "classes/class_001/students/stu_001/artifacts/2026-05-13-practice.md";

    const created = expectWrite(
      await filesWrite(
        {
          ssid: parentASsid,
          fileId,
          mode: "create",
          frontmatter: {
            type: "artifact",
            student_id: "stu_001",
            class_id: "class_001",
            title: "张三练习建议",
          },
          content: "# 张三练习建议\n\n- 先圈单位一。",
          reason: "create parent-facing practice artifact",
        },
        { dataRoot },
      ),
    );

    expect(readDocumentContent(parentASsid, fileId)).toContain("先圈单位一");

    const replaced = expectWrite(
      await filesWrite(
        {
          ssid: parentASsid,
          fileId,
          mode: "replace",
          frontmatter: {
            type: "artifact",
            student_id: "stu_001",
            class_id: "class_001",
            title: "张三练习建议 v2",
          },
          content: "# 张三练习建议 v2\n\n- 先复述题意，再圈单位一。",
          reason: "replace generated practice artifact",
        },
        { dataRoot },
      ),
    );

    const content = readDocumentContent(parentASsid, fileId);

    expect(content).toContain("先复述题意");
    expect(content).not.toContain("先圈单位一。");
    expect(readAuditEntry(created.auditId)).toContain("action: files_write");
    expect(readAuditEntry(replaced.auditId)).toContain("action: files_write");
  });

  it("rejects unknown write modes at runtime without creating files or audit", async () => {
    const fileId =
      "classes/class_001/students/stu_001/artifacts/2026-05-14-upsert.md";

    const error = expectError(
      await filesWrite(
        {
          ssid: parentASsid,
          fileId,
          mode: "upsert" as never,
          frontmatter: {
            type: "artifact",
            student_id: "stu_001",
            class_id: "class_001",
            title: "非法 upsert",
          },
          content: "# 非法 upsert\n\n- 不应写入。",
          reason: "runtime JSON mode must fail closed",
        },
        { dataRoot },
      ),
    );

    expect(error.code).toBe("FORBIDDEN");
    expect(existsSync(path.join(dataRoot, fileId))).toBe(false);
    expect(readAuditEntries()).toEqual([]);
  });

  it("blocks broad replacement of long-term archive records", async () => {
    const error = expectError(
      await filesWrite(
        {
          ssid: teacherSsid,
          fileId: "classes/class_001/students/stu_001/profile.md",
          mode: "replace",
          content: "# rewritten",
          reason: "attempt broad profile overwrite",
        },
        { dataRoot },
      ),
    );

    expect(error.code).toBe("FORBIDDEN");
    expect(readDocumentContent(teacherSsid, "classes/class_001/students/stu_001/profile.md"))
      .toContain("分数应用题需要持续关注");
    expect(readAuditEntries()).toEqual([]);
  });
});

import {
  chmodSync,
  cpSync,
  existsSync,
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

import {
  filesRead,
  filesReadAll,
  type FilesReadAllResult,
} from "../src/archive/scoped-read.js";
import {
  artifactCreate,
  type ArtifactCreateResult,
} from "../src/archive/write-audit.js";

const fixtureRoot = fileURLToPath(
  new URL("./fixtures/markdown-archive/", import.meta.url),
);

const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const teacherSsid = "agent:claw-agent:feishu:direct:teacher-openid-001";
const fixedNow = new Date("2026-05-13T08:30:00.000Z");

let scratchRoot: string;
let dataRoot: string;

function expectReadAll(result: FilesReadAllResult) {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected read-all, received ${result.error.code}`);
  }

  return result;
}

function expectArtifact(result: ArtifactCreateResult) {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected artifact, received ${result.error.code}`);
  }

  return result;
}

function expectArtifactError(result: ArtifactCreateResult) {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected artifact error, received success");
  }

  return result.error;
}

function readAuditEntry(auditId: string): string {
  const auditRoot = path.join(dataRoot, "audit");
  const entry = walkFiles(auditRoot)
    .map((filePath) => readFileSync(filePath, "utf8"))
    .find((content) => content.includes(`audit_id: ${auditId}`));

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

  return walkFiles(auditRoot).map((filePath) => readFileSync(filePath, "utf8"));
}

function artifactFiles(studentId: string): string[] {
  const artifactRoot = path.join(
    dataRoot,
    `classes/class_001/students/${studentId}/artifacts`,
  );

  if (!existsSync(artifactRoot)) {
    return [];
  }

  return walkFiles(artifactRoot);
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

describe("artifact primitive loop", () => {
  beforeEach(() => {
    scratchRoot = path.join(tmpdir(), `school-claw-artifact-${crypto.randomUUID()}`);
    dataRoot = path.join(scratchRoot, "archive");
    cpSync(fixtureRoot, dataRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(scratchRoot, { recursive: true, force: true });
  });

  it("creates a scoped artifact from readable sources, writes audit, and allows read-back", async () => {
    const sources = expectReadAll(
      filesReadAll(
        {
          ssid: parentASsid,
          studentId: "stu_001",
          kinds: ["profile", "errors"],
          maxFiles: 2,
          maxTotalChars: 10_000,
        },
        { dataRoot },
      ),
    );
    const sourceFileIds = sources.documents.map((document) => document.fileId);

    expect(sources.truncated).toBe(false);
    expect(sourceFileIds).toEqual([
      "classes/class_001/students/stu_001/errors/2026-05.md",
      "classes/class_001/students/stu_001/profile.md",
    ]);

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

    expect(artifact.artifactId).toMatch(/^art_20260513083000_/);
    expect(artifact.fileId).toMatch(
      /^classes\/class_001\/students\/stu_001\/artifacts\/2026-05-13-practice-/,
    );
    expect(existsSync(path.join(dataRoot, artifact.fileId))).toBe(true);

    const readBack = filesRead(
      { ssid: parentASsid, fileIds: [artifact.fileId] },
      { dataRoot },
    );

    expect(readBack.ok).toBe(true);

    if (!readBack.ok) {
      throw new Error(`Expected read-back, received ${readBack.error.code}`);
    }

    expect(readBack.documents[0]).toMatchObject({
      fileId: artifact.fileId,
      title: "张三分数应用题练习",
      frontmatter: {
        type: "artifact",
        artifact_id: artifact.artifactId,
        artifact_type: "practice",
        student_id: "stu_001",
        class_id: "class_001",
        created_by_ssid_hash: "4f9a1c4bd7a83310",
        source_file_ids: sourceFileIds.join(", "),
      },
    });
    expect(readBack.documents[0]?.content).toContain("先圈出单位一");

    const auditEntry = readAuditEntry(artifact.auditId);

    expect(auditEntry).toContain("action: artifact_create");
    expect(auditEntry).toContain(`target_file_ids: ${artifact.fileId}`);
    expect(auditEntry).toContain("summary: create practice artifact");
  });

  it("truncates read-all results by maxFiles", () => {
    const result = expectReadAll(
      filesReadAll(
        {
          ssid: parentASsid,
          studentId: "stu_001",
          maxFiles: 1,
        },
        { dataRoot },
      ),
    );

    expect(result.documents).toHaveLength(1);
    expect(result.truncated).toBe(true);
    expect(
      result.documents.every((document) => document.fileId.includes("stu_001")),
    ).toBe(true);
  });

  it("truncates read-all results by maxTotalChars", () => {
    const result = expectReadAll(
      filesReadAll(
        {
          ssid: parentASsid,
          studentId: "stu_001",
          maxTotalChars: 1,
        },
        { dataRoot },
      ),
    );

    expect(result.documents).toEqual([]);
    expect(result.truncated).toBe(true);
  });

  it("rejects a parent artifact for another student without creating a file or audit", async () => {
    const error = expectArtifactError(
      await artifactCreate(
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
      ),
    );

    expect(error.code).toBe("FORBIDDEN");
    expect(artifactFiles("stu_002")).toEqual([]);
    expect(readAuditEntries()).toEqual([]);
  });

  it("rejects source files outside the current read scope without creating a file or audit", async () => {
    const error = expectArtifactError(
      await artifactCreate(
        {
          ssid: parentASsid,
          artifactType: "practice",
          title: "张三练习",
          studentId: "stu_001",
          format: "markdown",
          content: "# 张三练习\n\n- 不能用别人的 source。",
          sourceFileIds: ["classes/class_001/students/stu_002/profile.md"],
        },
        { dataRoot, now: () => fixedNow },
      ),
    );

    expect(error.code).toBe("FORBIDDEN");
    expect(artifactFiles("stu_001")).toEqual([]);
    expect(readAuditEntries()).toEqual([]);
  });

  it("creates a teacher class artifact without a student target", async () => {
    const artifact = expectArtifact(
      await artifactCreate(
        {
          ssid: teacherSsid,
          artifactType: "error_table",
          title: "五年级一班本周错题表",
          format: "markdown",
          content: "# 五年级一班本周错题表\n\n| 知识点 | 典型错因 |\n| --- | --- |\n| 分数应用题 | 单位一 |",
          sourceFileIds: ["classes/class_001/class.md"],
        },
        { dataRoot, now: () => fixedNow },
      ),
    );

    expect(artifact.fileId).toMatch(
      /^classes\/class_001\/artifacts\/2026-05-13-error_table-/,
    );

    const readBack = filesRead(
      { ssid: teacherSsid, fileIds: [artifact.fileId] },
      { dataRoot },
    );

    expect(readBack.ok).toBe(true);

    if (!readBack.ok) {
      throw new Error(`Expected teacher read-back, received ${readBack.error.code}`);
    }

    expect(readBack.documents[0]?.frontmatter).toMatchObject({
      type: "artifact",
      artifact_type: "error_table",
      class_id: "class_001",
      created_by_ssid_hash: "79d612d61e7e6de1",
      source_file_ids: "classes/class_001/class.md",
    });
    expect(readBack.documents[0]?.frontmatter).not.toHaveProperty("student_id");
    expect(readAuditEntry(artifact.auditId)).toContain("action: artifact_create");
  });

  it("rejects a teacher student artifact that cites another student's source", async () => {
    const error = expectArtifactError(
      await artifactCreate(
        {
          ssid: teacherSsid,
          artifactType: "feedback",
          title: "李四家长反馈",
          studentId: "stu_002",
          format: "markdown",
          content: "# 李四家长反馈\n\n- 不应引用张三档案。",
          sourceFileIds: ["classes/class_001/students/stu_001/profile.md"],
        },
        { dataRoot, now: () => fixedNow },
      ),
    );

    expect(error.code).toBe("FORBIDDEN");
    expect(artifactFiles("stu_002")).toEqual([]);
    expect(readAuditEntries()).toEqual([]);
  });

  it("rolls back the artifact file when audit append fails after artifact write", async () => {
    const auditFile = path.join(dataRoot, "audit/2026-05/2026-05-13.md");

    mkdirSync(path.dirname(auditFile), { recursive: true });
    writeFileSync(auditFile, "# Existing audit file\n");
    chmodSync(auditFile, 0o000);

    try {
      const error = expectArtifactError(
        await artifactCreate(
          {
            ssid: parentASsid,
            artifactType: "practice",
            title: "张三分数应用题练习",
            studentId: "stu_001",
            format: "markdown",
            content: "# 张三分数应用题练习\n\n- 先圈出单位一。",
            sourceFileIds: ["classes/class_001/students/stu_001/profile.md"],
          },
          { dataRoot, now: () => fixedNow },
        ),
      );

      expect(error.code).toBe("TOOL_ERROR");
      expect(artifactFiles("stu_001")).toEqual([]);
    } finally {
      chmodSync(auditFile, 0o600);
    }
  });

  it("fails closed for invalid artifact requests before writing audit", async () => {
    const invalidType = expectArtifactError(
      await artifactCreate(
        {
          ssid: parentASsid,
          artifactType: "worksheet" as never,
          title: "非法产物",
          studentId: "stu_001",
          format: "markdown",
          content: "# 非法产物\n\n- 不应写入。",
          sourceFileIds: ["classes/class_001/students/stu_001/profile.md"],
        },
        { dataRoot, now: () => fixedNow },
      ),
    );
    const missingSources = expectArtifactError(
      await artifactCreate(
        {
          ssid: parentASsid,
          artifactType: "practice",
          title: "缺少来源",
          studentId: "stu_001",
          format: "markdown",
          content: "# 缺少来源\n\n- 不应写入。",
          sourceFileIds: [],
        },
        { dataRoot, now: () => fixedNow },
      ),
    );

    expect(invalidType.code).toBe("FORBIDDEN");
    expect(missingSources.code).toBe("FORBIDDEN");
    expect(artifactFiles("stu_001")).toEqual([]);
    expect(readAuditEntries()).toEqual([]);
  });
});

import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  filesList,
  filesRead,
  type FilesListResult,
  type FilesReadResult,
} from "../src/archive/scoped-read.js";

const dataRoot = fileURLToPath(
  new URL("./fixtures/markdown-archive/", import.meta.url),
);

const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const teacherSsid = "agent:claw-agent:feishu:direct:teacher-openid-001";
const disabledParentSsid =
  "agent:claw-agent:qqbot:direct:disabled-parent-openid-001";

function expectFiles(result: FilesListResult) {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected files, received ${result.error.code}`);
  }

  return result.files;
}

function expectDocuments(result: FilesReadResult) {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected documents, received ${result.error.code}`);
  }

  return result.documents;
}

function expectError(result: FilesListResult | FilesReadResult) {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error("Expected error, received success");
  }

  return result.error;
}

describe("scoped Markdown read loop", () => {
  it("lists only file IDs visible to a parent scope", () => {
    const files = expectFiles(filesList({ ssid: parentASsid }, { dataRoot }));
    const fileIds = files.map((file) => file.fileId);

    expect(fileIds).toContain("classes/class_001/public/syllabus.md");
    expect(fileIds).toContain("classes/class_001/students/stu_001/profile.md");
    expect(fileIds).toContain(
      "classes/class_001/students/stu_001/timeline/2026-05-12.md",
    );
    expect(fileIds).toContain(
      "classes/class_001/students/stu_001/errors/2026-05.md",
    );
    expect(fileIds).toContain(
      "classes/class_001/students/stu_001/parent-observations/2026-05.md",
    );
    expect(fileIds).not.toContain(
      "classes/class_001/students/stu_002/profile.md",
    );
    expect(fileIds).not.toContain("classes/class_001/class.md");
  });

  it("returns FORBIDDEN when a parent lists another student", () => {
    const error = expectError(
      filesList({ ssid: parentASsid, studentId: "stu_002" }, { dataRoot }),
    );

    expect(error.code).toBe("FORBIDDEN");
  });

  it("filters parent-visible observation files by kind", () => {
    const files = expectFiles(
      filesList({ ssid: parentASsid, kind: "observations" }, { dataRoot }),
    );

    expect(files).toEqual([
      expect.objectContaining({
        fileId:
          "classes/class_001/students/stu_001/parent-observations/2026-05.md",
        kind: "observations",
        studentId: "stu_001",
      }),
    ]);
  });

  it("applies date filters instead of returning wider history", () => {
    const today = expectFiles(
      filesList(
        {
          ssid: parentASsid,
          kind: "timeline",
          dateFrom: "2026-05-12",
          dateTo: "2026-05-12",
        },
        { dataRoot },
      ),
    );
    const future = expectFiles(
      filesList(
        {
          ssid: parentASsid,
          kind: "timeline",
          dateFrom: "2026-05-13",
          dateTo: "2026-05-13",
        },
        { dataRoot },
      ),
    );

    expect(today.map((file) => file.fileId)).toEqual([
      "classes/class_001/students/stu_001/timeline/2026-05-12.md",
    ]);
    expect(future).toEqual([]);
  });

  it("applies query filters instead of returning unrelated files", () => {
    const files = expectFiles(
      filesList({ ssid: parentASsid, query: "单位一" }, { dataRoot }),
    );

    expect(files.length).toBeGreaterThan(0);
    expect(files.every((file) => JSON.stringify(file).includes("单位一"))).toBe(
      true,
    );

    expect(
      expectFiles(filesList({ ssid: parentASsid, query: "火星作业" }, { dataRoot })),
    ).toEqual([]);
  });

  it("does not follow a symlinked read root while listing files", () => {
    const scratchRoot = mkdtempSync(path.join(tmpdir(), "school-claw-read-"));
    const scratchArchive = path.join(scratchRoot, "archive");
    const outsideArchive = path.join(scratchRoot, "outside");

    cpSync(dataRoot, scratchArchive, { recursive: true });
    mkdirSync(outsideArchive);
    writeFileSync(
      path.join(outsideArchive, "leak.md"),
      [
        "---",
        "type: student_profile",
        "student_id: stu_999",
        "class_id: class_001",
        "title: 外部泄漏标题",
        "updated_at: 2026-05-12T12:00:00+08:00",
        "---",
        "",
        "# 外部泄漏标题",
        "",
        "外部泄漏正文摘录",
      ].join("\n"),
    );

    const parentRoot = path.join(
      scratchArchive,
      "classes/class_001/students/stu_001",
    );
    rmSync(parentRoot, { recursive: true, force: true });
    symlinkSync(outsideArchive, parentRoot, "dir");

    try {
      const result = filesList({ ssid: parentASsid }, { dataRoot: scratchArchive });
      const error = expectError(result);

      expect(error.code).toBe("FORBIDDEN");
      expect(JSON.stringify(result)).not.toContain("外部泄漏标题");
      expect(JSON.stringify(result)).not.toContain("外部泄漏正文摘录");
    } finally {
      rmSync(scratchRoot, { recursive: true, force: true });
    }
  });

  it("reads a parent-owned student file with front matter and content", () => {
    const [document] = expectDocuments(
      filesRead(
        {
          ssid: parentASsid,
          fileIds: ["classes/class_001/students/stu_001/profile.md"],
        },
        { dataRoot },
      ),
    );

    expect(document).toMatchObject({
      fileId: "classes/class_001/students/stu_001/profile.md",
      title: "张三学习档案",
      frontmatter: {
        type: "student_profile",
        student_id: "stu_001",
        class_id: "class_001",
      },
    });
    expect(document?.content).toContain("分数应用题需要持续关注");
  });

  it("returns FORBIDDEN without leaking content for parent cross-read", () => {
    const result = filesRead(
      {
        ssid: parentASsid,
        fileIds: ["classes/class_001/students/stu_002/profile.md"],
      },
      { dataRoot },
    );
    const error = expectError(result);

    expect(error.code).toBe("FORBIDDEN");
    expect(JSON.stringify(result)).not.toContain("李四学习档案");
  });

  it("returns FORBIDDEN when an allowed fileId symlink points to another student", () => {
    const scratchRoot = mkdtempSync(path.join(tmpdir(), "school-claw-read-"));
    const scratchArchive = path.join(scratchRoot, "archive");
    const linkPath = path.join(
      scratchArchive,
      "classes/class_001/students/stu_001/leak-stu-002-profile.md",
    );
    const targetPath = path.join(
      scratchArchive,
      "classes/class_001/students/stu_002/profile.md",
    );

    cpSync(dataRoot, scratchArchive, { recursive: true });
    symlinkSync(targetPath, linkPath);

    try {
      const result = filesRead(
        {
          ssid: parentASsid,
          fileIds: [
            "classes/class_001/students/stu_001/leak-stu-002-profile.md",
          ],
        },
        { dataRoot: scratchArchive },
      );
      const error = expectError(result);

      expect(error.code).toBe("FORBIDDEN");
      expect(JSON.stringify(result)).not.toContain("李四学习档案");
      expect(JSON.stringify(result)).not.toContain("英语听写容易错形近词");
    } finally {
      rmSync(scratchRoot, { recursive: true, force: true });
    }
  });

  it("lets a teacher read class-level Markdown", () => {
    const [document] = expectDocuments(
      filesRead(
        {
          ssid: teacherSsid,
          fileIds: ["classes/class_001/class.md"],
        },
        { dataRoot },
      ),
    );

    expect(document?.frontmatter).toMatchObject({
      type: "class_profile",
      class_id: "class_001",
    });
    expect(document?.content).toContain("五年级一班");
  });

  it("rejects traversal, absolute paths, and escape attempts", () => {
    for (const fileId of [
      "../registry/sessions/secret.md",
      "/etc/passwd",
      "classes/class_001/students/stu_001/../../stu_002/profile.md",
    ]) {
      const error = expectError(
        filesRead({ ssid: parentASsid, fileIds: [fileId] }, { dataRoot }),
      );

      expect(error.code).toBe("FORBIDDEN");
    }
  });

  it("returns NOT_FOUND for missing files inside an allowed root", () => {
    const error = expectError(
      filesRead(
        {
          ssid: parentASsid,
          fileIds: ["classes/class_001/students/stu_001/missing.md"],
        },
        { dataRoot },
      ),
    );

    expect(error.code).toBe("NOT_FOUND");
  });

  it("fails closed for unbound and disabled sessions", () => {
    const unknown = expectError(
      filesRead(
        {
          ssid: "agent:claw-agent:qqbot:direct:unknown-parent",
          fileIds: ["classes/class_001/students/stu_001/profile.md"],
        },
        { dataRoot },
      ),
    );
    const disabled = expectError(
      filesRead(
        {
          ssid: disabledParentSsid,
          fileIds: ["classes/class_001/students/stu_001/profile.md"],
        },
        { dataRoot },
      ),
    );

    expect(unknown.code).toBe("UNBOUND_SESSION");
    expect(disabled.code).toBe("SESSION_DISABLED");
  });
});

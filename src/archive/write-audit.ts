import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  fixtureRegistry,
  resolveSessionScope,
  type FixtureRegistry,
  type ScopeErrorCode,
  type ScopeGetRequest,
  type SessionScope,
} from "../scope/scope-get.js";
import { filesRead } from "./scoped-read.js";

export type FilesAppendTarget =
  | { kind: "parent_observation"; studentId: string; month?: string }
  | { kind: "teacher_observation"; studentId: string; month?: string }
  | { kind: "timeline"; studentId: string; date?: string }
  | { kind: "class_note"; date?: string };

export type FilesAppendRequest = {
  ssid?: string;
  target: FilesAppendTarget;
  frontmatter?: Record<string, unknown>;
  content: string;
  reason: string;
};

export type FilesWriteRequest = {
  ssid?: string;
  fileId: string;
  mode: WriteMode;
  frontmatter?: Record<string, unknown>;
  content: string;
  reason: string;
};

export type AuditLogRequest = {
  ssid?: string;
  action: string;
  targetFileIds?: string[];
  summary: string;
};

export type ArtifactType =
  | "brief"
  | "practice"
  | "feedback"
  | "weekly_summary"
  | "ppt_outline"
  | "error_table";

export type ArtifactFormat = "markdown" | "csv" | "ppt_outline";

export type ArtifactCreateRequest = {
  ssid?: string;
  artifactType: ArtifactType;
  title: string;
  studentId?: string;
  format: ArtifactFormat;
  content: string;
  sourceFileIds?: string[];
};

export type WriteAuditErrorCode =
  | ScopeErrorCode
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "TOOL_ERROR";

type WriteAuditError = {
  code: WriteAuditErrorCode;
  message: string;
};

type WriteAuditErrorResult = {
  ok: false;
  error: WriteAuditError;
};

type WriteMode = "create" | "replace";

export type FilesAppendResult =
  | {
      ok: true;
      fileId: string;
      appended: true;
      auditId: string;
    }
  | WriteAuditErrorResult;

export type FilesWriteResult =
  | {
      ok: true;
      fileId: string;
      written: true;
      auditId: string;
    }
  | WriteAuditErrorResult;

export type AuditLogResult =
  | {
      ok: true;
      auditId: string;
    }
  | WriteAuditErrorResult;

export type ArtifactCreateResult =
  | {
      ok: true;
      artifactId: string;
      fileId: string;
      auditId: string;
    }
  | WriteAuditErrorResult;

export type ScopedWriteOptions = {
  dataRoot: string;
  registry?: FixtureRegistry;
  now?: () => Date;
};

type ResolvedFileId =
  | {
      ok: true;
      fileId: string;
      absolutePath: string;
    }
  | WriteAuditErrorResult;

type WriteContext =
  | {
      ok: true;
      dataRoot: string;
      scope: SessionScope;
      now: Date;
    }
  | WriteAuditErrorResult;

type AuthorizedWriteTarget =
  | {
      ok: true;
      fileId: string;
      absolutePath: string;
    }
  | WriteAuditErrorResult;

type AuditTarget =
  | {
      ok: true;
      auditId: string;
      fileId: string;
      absolutePath: string;
    }
  | WriteAuditErrorResult;

const locks = new Map<string, Promise<void>>();

export async function filesAppend(
  request: FilesAppendRequest,
  options: ScopedWriteOptions,
): Promise<FilesAppendResult> {
  if (!isFilesAppendTarget(request.target)) {
    return forbidden("files_append target is not supported.");
  }

  const context = resolveWriteContext(request.ssid, options);

  if (!context.ok) {
    return context;
  }

  if (request.content.trim().length === 0) {
    return forbidden("Append content must not be empty.");
  }

  const appendAuthorization = authorizeAppendTarget(request.target, context.scope);

  if (!appendAuthorization.ok) {
    return appendAuthorization;
  }

  const fileId = fileIdForAppendTarget(request.target, context.scope, context.now);

  if (!fileId.ok) {
    return fileId;
  }

  const target = authorizeWriteTarget(fileId.fileId, context);

  if (!target.ok) {
    return target;
  }

  const auditTarget = prepareAuditTarget(context);

  if (!auditTarget.ok) {
    return auditTarget;
  }

  await withFileLock(target.absolutePath, async () => {
    const targetExists = existsSync(target.absolutePath);
    const existing = targetExists ? await readFile(target.absolutePath, "utf8") : "";
    const next = targetExists
      ? appendMarkdown(existing, request.content)
      : renderMarkdown(
          appendFrontmatter(request.frontmatter, request.target, context),
          request.content,
        );

    await atomicWrite(target.absolutePath, next);
  });

  await appendAuditEntry(
    {
      action: "files_append",
      summary: request.reason,
      targetFileIds: [target.fileId],
    },
    context,
    auditTarget,
  );

  return {
    ok: true,
    fileId: target.fileId,
    appended: true,
    auditId: auditTarget.auditId,
  };
}

export async function filesWrite(
  request: FilesWriteRequest,
  options: ScopedWriteOptions,
): Promise<FilesWriteResult> {
  const context = resolveWriteContext(request.ssid, options);

  if (!context.ok) {
    return context;
  }

  if (request.content.trim().length === 0) {
    return forbidden("Write content must not be empty.");
  }

  if (!isWriteMode(request.mode)) {
    return forbidden("files_write mode must be create or replace.");
  }

  const target = authorizeWriteTarget(request.fileId, context);

  if (!target.ok) {
    return target;
  }

  if (!isControlledWriteFile(target.fileId)) {
    return forbidden("files_write is limited to controlled archive files.");
  }

  const content = renderMarkdown(request.frontmatter, request.content);
  const auditTarget = prepareAuditTarget(context);

  if (!auditTarget.ok) {
    return auditTarget;
  }

  let writeError: WriteAuditErrorResult | undefined;

  await withFileLock(target.absolutePath, async () => {
    const exists = existsSync(target.absolutePath);

    if (request.mode === "create" && exists) {
      writeError = {
        ok: false,
        error: {
          code: "ALREADY_EXISTS",
          message: "Cannot create a file that already exists.",
        },
      };
      return;
    }

    if (request.mode === "replace" && !exists) {
      writeError = notFound("Cannot replace a file that does not exist.");
      return;
    }

    await atomicWrite(target.absolutePath, content);
  });

  if (writeError) {
    return writeError;
  }

  await appendAuditEntry(
    {
      action: "files_write",
      summary: request.reason,
      targetFileIds: [target.fileId],
    },
    context,
    auditTarget,
  );

  return {
    ok: true,
    fileId: target.fileId,
    written: true,
    auditId: auditTarget.auditId,
  };
}

export async function artifactCreate(
  request: ArtifactCreateRequest,
  options: ScopedWriteOptions,
): Promise<ArtifactCreateResult> {
  const context = resolveWriteContext(request.ssid, options);

  if (!context.ok) {
    return context;
  }

  if (!isArtifactType(request.artifactType)) {
    return forbidden("artifactType is not supported.");
  }

  if (!isArtifactFormat(request.format)) {
    return forbidden("artifact format is not supported.");
  }

  if (request.title.trim().length === 0) {
    return forbidden("Artifact title must not be empty.");
  }

  if (request.content.trim().length === 0) {
    return forbidden("Artifact content must not be empty.");
  }

  if (!request.sourceFileIds || request.sourceFileIds.length === 0) {
    return forbidden("Artifact sourceFileIds are required.");
  }

  const authorization = authorizeArtifactCreate(request, context.scope);

  if (!authorization.ok) {
    return authorization;
  }

  const sourceReadRequest = {
    fileIds: request.sourceFileIds,
    ...scopeRequest(request.ssid),
  };
  const sourceReadOptions =
    options.registry === undefined
      ? { dataRoot: context.dataRoot }
      : { dataRoot: context.dataRoot, registry: options.registry };
  const sourceRead = filesRead(sourceReadRequest, sourceReadOptions);

  if (!sourceRead.ok) {
    return writeErrorFromReadError(sourceRead.error);
  }

  const sourceAuthorization = authorizeArtifactSourcesForTarget(
    sourceRead.documents.map((document) => document.fileId),
    request,
    context.scope,
  );

  if (!sourceAuthorization.ok) {
    return sourceAuthorization;
  }

  const artifactId = `art_${compactTimestamp(context.now)}_${shortId()}`;
  const fileId = artifactFileId(request, context.scope, artifactId, context.now);
  const target = authorizeWriteTarget(fileId, context);

  if (!target.ok) {
    return target;
  }

  if (existsSync(target.absolutePath)) {
    return {
      ok: false,
      error: {
        code: "ALREADY_EXISTS",
        message: "Artifact file already exists.",
      },
    };
  }

  const auditTarget = prepareAuditTarget(context);

  if (!auditTarget.ok) {
    return auditTarget;
  }

  const sourceFileIds = sourceRead.documents.map((document) => document.fileId);
  const frontmatter: Record<string, unknown> = {
    type: "artifact",
    artifact_id: artifactId,
    artifact_type: request.artifactType,
    format: request.format,
    title: request.title.trim(),
    class_id: context.scope.classId,
    created_by_ssid_hash: context.scope.ssidHash,
    created_at: context.now.toISOString(),
    source_file_ids: sourceFileIds.join(", "),
  };

  if (request.studentId) {
    frontmatter.student_id = request.studentId;
  }

  let artifactWritten = false;

  try {
    await withFileLock(target.absolutePath, async () => {
      await atomicWrite(
        target.absolutePath,
        renderMarkdown(frontmatter, request.content),
      );
      artifactWritten = true;
    });
  } catch {
    return toolError("Artifact file could not be written.");
  }

  try {
    await appendAuditEntry(
      {
        action: "artifact_create",
        summary: `create ${request.artifactType} artifact`,
        targetFileIds: [target.fileId],
      },
      context,
      auditTarget,
    );
  } catch {
    if (artifactWritten) {
      const rolledBack = await rollbackCreatedArtifact(target.absolutePath);

      if (!rolledBack) {
        return toolError("Artifact audit failed and rollback failed.");
      }
    }

    return toolError("Artifact was not saved because audit logging failed.");
  }

  return {
    ok: true,
    artifactId,
    fileId: target.fileId,
    auditId: auditTarget.auditId,
  };
}

export async function auditLog(
  request: AuditLogRequest,
  options: ScopedWriteOptions,
): Promise<AuditLogResult> {
  const context = resolveWriteContext(request.ssid, options);

  if (!context.ok) {
    return context;
  }

  const auditTarget = prepareAuditTarget(context);

  if (!auditTarget.ok) {
    return auditTarget;
  }

  await appendAuditEntry(
    {
      action: request.action,
      summary: request.summary,
      targetFileIds: request.targetFileIds ?? [],
    },
    context,
    auditTarget,
  );

  return {
    ok: true,
    auditId: auditTarget.auditId,
  };
}

function resolveWriteContext(
  ssid: string | undefined,
  options: ScopedWriteOptions,
): WriteContext {
  const scopeResult = resolveSessionScope(
    scopeRequest(ssid),
    options.registry ?? fixtureRegistry,
  );

  if (!scopeResult.ok) {
    return scopeResult;
  }

  return {
    ok: true,
    scope: scopeResult.scope,
    dataRoot: realpathSync(options.dataRoot),
    now: options.now?.() ?? new Date(),
  };
}

function fileIdForAppendTarget(
  target: FilesAppendTarget,
  scope: SessionScope,
  now: Date,
): ResolvedFileId {
  if ("studentId" in target && !scopeCanWriteStudent(scope, target.studentId)) {
    return forbidden("Requested student is outside the current scope.");
  }

  const currentDate = isoDate(now);
  const currentMonth = currentDate.slice(0, 7);

  switch (target.kind) {
    case "parent_observation":
      return fileIdResult(
        `classes/${scope.classId}/students/${target.studentId}/parent-observations/${target.month ?? currentMonth}.md`,
        "",
      );
    case "teacher_observation":
      return fileIdResult(
        `classes/${scope.classId}/students/${target.studentId}/teacher-observations/${target.month ?? currentMonth}.md`,
        "",
      );
    case "timeline":
      return fileIdResult(
        `classes/${scope.classId}/students/${target.studentId}/timeline/${target.date ?? currentDate}.md`,
        "",
      );
    case "class_note":
      return fileIdResult(
        `classes/${scope.classId}/class-notes/${target.date ?? currentDate}.md`,
        "",
      );
  }
}

function isFilesAppendTarget(value: unknown): value is FilesAppendTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const target = value as Record<string, unknown>;
  const kind = target.kind;
  const studentId = target.studentId;
  const month = target.month;
  const date = target.date;

  if (month !== undefined && typeof month !== "string") {
    return false;
  }

  if (date !== undefined && typeof date !== "string") {
    return false;
  }

  if (kind === "class_note") {
    return studentId === undefined;
  }

  if (
    kind === "parent_observation" ||
    kind === "teacher_observation" ||
    kind === "timeline"
  ) {
    return typeof studentId === "string" && studentId.length > 0;
  }

  return false;
}

function appendFrontmatter(
  frontmatter: Record<string, unknown> | undefined,
  target: FilesAppendTarget,
  context: { scope: SessionScope; now: Date },
): Record<string, unknown> {
  return {
    type: defaultAppendType(target),
    title: defaultAppendTitle(target, context),
    ...(frontmatter ?? {}),
    source_role: context.scope.role,
    source_ssid_hash: context.scope.ssidHash,
    class_id: context.scope.classId,
    ...("studentId" in target ? { student_id: target.studentId } : {}),
    recorded_at: context.now.toISOString(),
    updated_at: context.now.toISOString(),
  };
}

function defaultAppendType(target: FilesAppendTarget): string {
  switch (target.kind) {
    case "parent_observation":
      return "parent_observation";
    case "teacher_observation":
      return "teacher_observation";
    case "timeline":
      return "learning_event";
    case "class_note":
      return "class_note";
  }
}

function defaultAppendTitle(
  target: FilesAppendTarget,
  context: { scope: SessionScope; now: Date },
): string {
  const period = "month" in target && target.month ? target.month : isoMonth(context.now);

  switch (target.kind) {
    case "parent_observation":
      return `${target.studentId} ${period} 家长观察`;
    case "teacher_observation":
      return `${target.studentId} ${period} 老师观察`;
    case "timeline":
      return `${target.studentId} ${"date" in target && target.date ? target.date : isoDate(context.now)} 学习事件`;
    case "class_note":
      return `${context.scope.classId} ${"date" in target && target.date ? target.date : isoDate(context.now)} 班级记录`;
  }
}

function authorizeAppendTarget(
  target: FilesAppendTarget,
  scope: SessionScope,
): WriteAuditErrorResult | { ok: true } {
  if ("studentId" in target && !scopeCanWriteStudent(scope, target.studentId)) {
    return forbidden("Requested student is outside the current scope.");
  }

  switch (target.kind) {
    case "parent_observation":
      return scope.role === "parent" && hasCapability(scope, "append_parent_observation")
        ? { ok: true }
        : forbidden("Only parent scopes can append parent observations.");
    case "teacher_observation":
      return scope.role === "teacher" && hasCapability(scope, "write_class")
        ? { ok: true }
        : forbidden("Only teacher scopes can append teacher observations.");
    case "timeline":
      return scope.role === "teacher" && hasCapability(scope, "write_class")
        ? { ok: true }
        : forbidden("Only teacher scopes can append timeline records.");
    case "class_note":
      return scope.role === "teacher" && hasCapability(scope, "write_class")
        ? { ok: true }
        : forbidden("Only teacher scopes can append class notes.");
  }
}

function authorizeWriteTarget(
  fileId: string,
  context: { dataRoot: string; scope: SessionScope },
): AuthorizedWriteTarget {
  const resolution = resolveFileId(fileId, context.dataRoot);

  if (!resolution.ok) {
    return resolution;
  }

  if (!resolution.fileId.endsWith(".md")) {
    return forbidden("Only Markdown files can be written.");
  }

  if (!isWithinRoots(resolution.fileId, context.scope.writeRoots)) {
    return forbidden("Requested file is outside the current write scope.");
  }

  const safeParent = ensureSafeWritableParent(
    path.dirname(resolution.absolutePath),
    context.dataRoot,
    context.scope.writeRoots,
  );

  if (!safeParent.ok) {
    return safeParent;
  }

  if (existsSync(resolution.absolutePath)) {
    const targetStat = lstatSync(resolution.absolutePath);

    if (!targetStat.isFile()) {
      return forbidden("Write target must be a regular file.");
    }

    const realTarget = realpathSync(resolution.absolutePath);

    if (
      realTarget !== path.resolve(resolution.absolutePath) ||
      !isPathInsideOrEqual(realTarget, context.dataRoot) ||
      !isInsideAnyRoot(realTarget, canonicalExistingRoots(context.scope.writeRoots, context.dataRoot))
    ) {
      return forbidden("Write target escapes the current scope.");
    }
  }

  return {
    ok: true,
    fileId: resolution.fileId,
    absolutePath: resolution.absolutePath,
  };
}

function ensureSafeWritableParent(
  parentPath: string,
  dataRoot: string,
  writeRoots: string[],
): WriteAuditErrorResult | { ok: true } {
  if (!isPathInsideOrEqual(parentPath, dataRoot)) {
    return forbidden("Write target escapes the Markdown archive.");
  }

  const nearest = nearestExistingAncestor(parentPath, dataRoot);

  if (!nearest.ok) {
    return nearest;
  }

  const nearestRealPath = realpathSync(nearest.absolutePath);

  if (
    nearestRealPath !== path.resolve(nearest.absolutePath) ||
    !isPathInsideOrEqual(nearestRealPath, dataRoot)
  ) {
    return forbidden("Write parent escapes the Markdown archive.");
  }

  mkdirSync(parentPath, { recursive: true });

  const parentStat = lstatSync(parentPath);

  if (!parentStat.isDirectory()) {
    return forbidden("Write parent must be a directory.");
  }

  const parentRealPath = realpathSync(parentPath);
  const canonicalRoots = canonicalExistingRoots(writeRoots, dataRoot);

  if (
    parentRealPath !== path.resolve(parentPath) ||
    !isPathInsideOrEqual(parentRealPath, dataRoot) ||
    !isInsideAnyRoot(parentRealPath, canonicalRoots)
  ) {
    return forbidden("Write parent escapes the current scope.");
  }

  return { ok: true };
}

function nearestExistingAncestor(
  targetPath: string,
  dataRoot: string,
): WriteAuditErrorResult | { ok: true; absolutePath: string } {
  let current = path.resolve(targetPath);

  while (!existsSync(current)) {
    const parent = path.dirname(current);

    if (parent === current || !isPathInsideOrEqual(parent, dataRoot)) {
      return forbidden("Write parent escapes the Markdown archive.");
    }

    current = parent;
  }

  return {
    ok: true,
    absolutePath: current,
  };
}

function canonicalExistingRoots(roots: string[], dataRoot: string): string[] {
  return roots.flatMap((root) => {
    const resolution = resolveFileId(root, dataRoot);

    if (!resolution.ok) {
      return [];
    }

    if (!existsSync(resolution.absolutePath)) {
      return [path.resolve(resolution.absolutePath)];
    }

    const expectedPath = path.resolve(resolution.absolutePath);
    const realPath = realpathSync(resolution.absolutePath);

    return realPath === expectedPath && isPathInsideOrEqual(realPath, dataRoot)
      ? [realPath]
      : [];
  });
}

function resolveFileId(fileId: string, dataRoot: string): ResolvedFileId {
  const normalized = normalizeFileId(fileId);

  if (!normalized) {
    return forbidden("fileId must be a relative Markdown archive path.");
  }

  return fileIdResult(normalized, dataRoot);
}

function fileIdResult(fileId: string, dataRoot: string): ResolvedFileId {
  const normalized = normalizeFileId(fileId);

  if (!normalized) {
    return forbidden("fileId must be a relative Markdown archive path.");
  }

  const absolutePath = dataRoot ? path.join(dataRoot, normalized) : "";

  if (dataRoot && !isPathInsideOrEqual(absolutePath, dataRoot)) {
    return forbidden("fileId escapes the Markdown archive.");
  }

  return {
    ok: true,
    fileId: normalized,
    absolutePath,
  };
}

function normalizeFileId(fileId: string): string | null {
  if (
    !fileId ||
    path.isAbsolute(fileId) ||
    path.win32.isAbsolute(fileId) ||
    fileId.includes("\\")
  ) {
    return null;
  }

  const segments = fileId.split("/");

  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return null;
  }

  const normalized = path.posix.normalize(fileId);

  if (
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.includes("/../")
  ) {
    return null;
  }

  return normalized;
}

function isWithinRoots(fileId: string, roots: string[]): boolean {
  return roots.some((root) => {
    const normalizedRoot = normalizeFileId(root);

    return (
      normalizedRoot !== null &&
      (fileId === normalizedRoot || fileId.startsWith(`${normalizedRoot}/`))
    );
  });
}

function isInsideAnyRoot(targetPath: string, rootPaths: string[]): boolean {
  return rootPaths.some((rootPath) => {
    return isPathInsideOrEqual(targetPath, rootPath);
  });
}

function isPathInsideOrEqual(targetPath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, targetPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function scopeCanWriteStudent(scope: SessionScope, studentId: string): boolean {
  if (scope.studentIds.includes(studentId)) {
    return true;
  }

  if (!scope.studentIds.includes("*")) {
    return false;
  }

  return scope.knownStudentIds.includes(studentId);
}

function hasCapability(scope: SessionScope, capability: string): boolean {
  return scope.capabilities.includes(capability);
}

const artifactTypes: readonly ArtifactType[] = [
  "brief",
  "practice",
  "feedback",
  "weekly_summary",
  "ppt_outline",
  "error_table",
];

const artifactFormats: readonly ArtifactFormat[] = [
  "markdown",
  "csv",
  "ppt_outline",
];

function authorizeArtifactCreate(
  request: ArtifactCreateRequest,
  scope: SessionScope,
): WriteAuditErrorResult | { ok: true } {
  if (request.studentId && !scopeCanWriteStudent(scope, request.studentId)) {
    return forbidden("Requested student is outside the current scope.");
  }

  if (scope.role === "parent") {
    if (!hasCapability(scope, "create_child_artifact")) {
      return forbidden("Parent scope cannot create child artifacts.");
    }

    if (!request.studentId) {
      return forbidden("Parent artifact creation must target the parent's child.");
    }

    return { ok: true };
  }

  if (scope.role === "teacher" && hasCapability(scope, "create_class_artifact")) {
    return { ok: true };
  }

  return forbidden("Scope cannot create artifacts.");
}

function authorizeArtifactSourcesForTarget(
  sourceFileIds: string[],
  request: ArtifactCreateRequest,
  scope: SessionScope,
): WriteAuditErrorResult | { ok: true } {
  const targetRoots = request.studentId
    ? [
        `classes/${scope.classId}/students/${request.studentId}`,
        `classes/${scope.classId}/public`,
      ]
    : [`classes/${scope.classId}`];

  const allSourcesVisibleToTarget = sourceFileIds.every((fileId) => {
    return isWithinRoots(fileId, targetRoots);
  });

  if (!allSourcesVisibleToTarget) {
    return forbidden("Artifact sources must be visible to the artifact target.");
  }

  return { ok: true };
}

function artifactFileId(
  request: ArtifactCreateRequest,
  scope: SessionScope,
  artifactId: string,
  now: Date,
): string {
  const suffix = artifactId.slice(artifactId.lastIndexOf("_") + 1);
  const fileName = `${isoDate(now)}-${request.artifactType}-${suffix}.md`;

  if (request.studentId) {
    return `classes/${scope.classId}/students/${request.studentId}/artifacts/${fileName}`;
  }

  return `classes/${scope.classId}/artifacts/${fileName}`;
}

function isArtifactType(value: unknown): value is ArtifactType {
  return artifactTypes.includes(value as ArtifactType);
}

function isArtifactFormat(value: unknown): value is ArtifactFormat {
  return artifactFormats.includes(value as ArtifactFormat);
}

function shortId(): string {
  return randomUUID().replaceAll("-", "").slice(0, 8);
}

async function rollbackCreatedArtifact(filePath: string): Promise<boolean> {
  await unlink(filePath).catch(() => undefined);

  return !existsSync(filePath);
}

function writeErrorFromReadError(error: {
  code: ScopeErrorCode | "FORBIDDEN" | "NOT_FOUND" | "TOO_LARGE";
  message: string;
}): WriteAuditErrorResult {
  return {
    ok: false,
    error: {
      code: error.code === "TOO_LARGE" ? "TOOL_ERROR" : error.code,
      message: error.message,
    },
  };
}

function isControlledWriteFile(fileId: string): boolean {
  return (
    fileId.includes("/artifacts/") ||
    fileId.includes("/summaries/") ||
    fileId.endsWith("/knowledge.md")
  );
}

function isWriteMode(mode: unknown): mode is WriteMode {
  return mode === "create" || mode === "replace";
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const parentPath = path.dirname(filePath);
  const tempPath = path.join(parentPath, `.${path.basename(filePath)}.${randomUUID()}.tmp`);

  try {
    await writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
    await rename(tempPath, filePath);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

async function withFileLock<T>(
  lockKey: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(lockKey) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  const queued = previous.then(() => current);

  locks.set(lockKey, queued);

  await previous.catch(() => undefined);

  try {
    return await operation();
  } finally {
    release();

    if (locks.get(lockKey) === queued) {
      locks.delete(lockKey);
    }
  }
}

function appendMarkdown(existing: string, content: string): string {
  const trimmedContent = content.trim();

  if (existing.length === 0) {
    return `${trimmedContent}\n`;
  }

  const separator = existing.endsWith("\n\n")
    ? ""
    : existing.endsWith("\n")
      ? "\n"
      : "\n\n";

  return `${existing}${separator}${trimmedContent}\n`;
}

function renderMarkdown(
  frontmatter: Record<string, unknown> | undefined,
  content: string,
): string {
  if (!frontmatter || Object.keys(frontmatter).length === 0) {
    return `${content.trim()}\n`;
  }

  const lines = Object.entries(frontmatter).map(([key, value]) => {
    return `${key}: ${String(value)}`;
  });

  return `---\n${lines.join("\n")}\n---\n\n${content.trim()}\n`;
}

function prepareAuditTarget(context: {
  dataRoot: string;
  now: Date;
}): AuditTarget {
  const auditId = `audit_${compactTimestamp(context.now)}_${randomUUID()}`;
  const auditFileId = `audit/${isoMonth(context.now)}/${isoDate(context.now)}.md`;
  const resolution = resolveFileId(auditFileId, context.dataRoot);

  if (!resolution.ok) {
    return resolution;
  }

  const auditRoot = path.join(context.dataRoot, "audit");

  if (existsSync(auditRoot) && !lstatSync(auditRoot).isDirectory()) {
    return toolError("Audit root is not writable.");
  }

  try {
    mkdirSync(path.dirname(resolution.absolutePath), { recursive: true });
  } catch {
    return toolError("Audit root is not writable.");
  }

  const parentPath = path.dirname(resolution.absolutePath);

  if (!lstatSync(parentPath).isDirectory()) {
    return toolError("Audit parent is not writable.");
  }

  const parentRealPath = realpathSync(parentPath);

  if (
    parentRealPath !== path.resolve(parentPath) ||
    !isPathInsideOrEqual(parentRealPath, context.dataRoot)
  ) {
    return toolError("Audit parent escapes the Markdown archive.");
  }

  if (existsSync(resolution.absolutePath)) {
    const targetStat = lstatSync(resolution.absolutePath);

    if (!targetStat.isFile()) {
      return toolError("Audit target is not writable.");
    }

    const realTarget = realpathSync(resolution.absolutePath);

    if (
      realTarget !== path.resolve(resolution.absolutePath) ||
      !isPathInsideOrEqual(realTarget, context.dataRoot)
    ) {
      return toolError("Audit target escapes the Markdown archive.");
    }
  }

  const probePath = path.join(parentPath, `.audit-probe-${randomUUID()}.tmp`);

  try {
    writeFileSync(probePath, "", { encoding: "utf8", flag: "wx" });
    unlinkSync(probePath);
  } catch {
    try {
      if (existsSync(probePath)) {
        unlinkSync(probePath);
      }
    } catch {
      // Best effort cleanup for a failed audit writeability probe.
    }

    return toolError("Audit parent is not writable.");
  }

  return {
    ok: true,
    auditId,
    fileId: resolution.fileId,
    absolutePath: resolution.absolutePath,
  };
}

async function appendAuditEntry(
  event: { action: string; summary: string; targetFileIds: string[] },
  context: { dataRoot: string; scope: SessionScope; now: Date },
  auditTarget: { auditId: string; absolutePath: string },
): Promise<void> {
  const entry = renderAuditEntry(auditTarget.auditId, event, context);

  await withFileLock(auditTarget.absolutePath, async () => {
    const existing = existsSync(auditTarget.absolutePath)
      ? await readFile(auditTarget.absolutePath, "utf8")
      : "";
    const next =
      existing.length > 0
        ? appendMarkdown(existing, entry)
        : renderAuditFile(context.now, entry);

    await atomicWrite(auditTarget.absolutePath, next);
  });
}

function renderAuditFile(now: Date, firstEntry: string): string {
  const date = isoDate(now);
  const month = isoMonth(now);

  return [
    "---",
    "type: audit_log",
    `month: ${month}`,
    `title: Audit ${date}`,
    `updated_at: ${now.toISOString()}`,
    "---",
    "",
    `# Audit ${date}`,
    "",
    firstEntry,
    "",
  ].join("\n");
}

function renderAuditEntry(
  auditId: string,
  event: { action: string; summary: string; targetFileIds: string[] },
  context: { scope: SessionScope; now: Date },
): string {
  return [
    `## ${auditId}`,
    "",
    `audit_id: ${auditId}`,
    `timestamp: ${context.now.toISOString()}`,
    `actor_ssid_hash: ${context.scope.ssidHash}`,
    `role: ${context.scope.role}`,
    `action: ${event.action}`,
    `target_file_ids: ${event.targetFileIds.join(", ")}`,
    `summary: ${event.summary}`,
  ].join("\n");
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isoMonth(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function compactTimestamp(date: Date): string {
  return date.toISOString().replace(/\D/g, "").slice(0, 14);
}

function scopeRequest(ssid: string | undefined): ScopeGetRequest {
  return ssid === undefined ? {} : { ssid };
}

function forbidden(message: string): WriteAuditErrorResult {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message,
    },
  };
}

function notFound(message: string): WriteAuditErrorResult {
  return {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message,
    },
  };
}

function toolError(message: string): WriteAuditErrorResult {
  return {
    ok: false,
    error: {
      code: "TOOL_ERROR",
      message,
    },
  };
}

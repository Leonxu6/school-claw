import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";

import {
  fixtureRegistry,
  resolveSessionScope,
  type FixtureRegistry,
  type ScopeGetRequest,
  type ScopeErrorCode,
  type SessionScope,
} from "../scope/scope-get.js";

export type FileKind =
  | "profile"
  | "knowledge"
  | "timeline"
  | "errors"
  | "observations"
  | "artifacts"
  | "class";

export type FilesListRequest = {
  ssid?: string;
  kind?: FileKind;
  studentId?: string;
  dateFrom?: string;
  dateTo?: string;
  query?: string;
  limit?: number;
};

export type FilesReadRequest = {
  ssid?: string;
  fileIds: string[];
  maxChars?: number;
};

export type FilesReadAllRequest = {
  ssid?: string;
  studentId?: string;
  kinds?: FileKind[];
  dateFrom?: string;
  dateTo?: string;
  maxFiles?: number;
  maxTotalChars?: number;
};

export type FilesErrorCode =
  | ScopeErrorCode
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "TOO_LARGE";

type FilesError = {
  code: FilesErrorCode;
  message: string;
};

type FilesErrorResult = {
  ok: false;
  error: FilesError;
};

export type ListedFile = {
  fileId: string;
  title: string;
  kind: string;
  studentId?: string;
  updatedAt?: string;
  excerpt?: string;
};

export type ReadDocument = {
  fileId: string;
  title: string;
  frontmatter: Record<string, unknown>;
  content: string;
};

export type FilesListResult =
  | {
      ok: true;
      files: ListedFile[];
    }
  | {
      ok: false;
      error: FilesError;
    };

export type FilesReadResult =
  | {
      ok: true;
      documents: ReadDocument[];
    }
  | {
      ok: false;
      error: FilesError;
    };

export type FilesReadAllResult =
  | {
      ok: true;
      documents: ReadDocument[];
      truncated: boolean;
    }
  | {
      ok: false;
      error: FilesError;
    };

export type ScopedReadOptions = {
  dataRoot: string;
  registry?: FixtureRegistry;
};

type ParsedMarkdown = {
  frontmatter: Record<string, unknown>;
  content: string;
};

type ResolvedFileId =
  | {
      ok: true;
      fileId: string;
      absolutePath: string;
    }
  | {
      ok: false;
      error: FilesError;
    };

type SafeExistingPath =
  | {
      ok: true;
      absolutePath: string;
    }
  | {
      ok: false;
      error: FilesError;
    };

type AuthorizedReadRoots =
  | {
      ok: true;
      absolutePaths: string[];
    }
  | {
      ok: false;
      error: FilesError;
    };

type ListedMarkdownDocument = ListedFile & {
  searchableText: string;
};

export function filesList(
  request: FilesListRequest,
  options: ScopedReadOptions,
): FilesListResult {
  const scopeResult = resolveSessionScope(
    scopeRequest(request.ssid),
    options.registry ?? fixtureRegistry,
  );

  if (!scopeResult.ok) {
    return scopeResult;
  }

  const { scope } = scopeResult;

  if (request.studentId && !scopeCanSeeStudent(scope, request.studentId)) {
    return forbidden("Requested student is outside the current scope.");
  }

  const dataRoot = realpathSync(options.dataRoot);
  const files: ListedFile[] = [];
  const authorizedReadRoots = resolveAuthorizedReadRoots(
    scope.readRoots,
    dataRoot,
  );

  if (!authorizedReadRoots.ok) {
    return authorizedReadRoots;
  }

  for (const root of scope.readRoots) {
    const rootResolution = resolveFileId(root, dataRoot);

    if (!rootResolution.ok) {
      return rootResolution;
    }

    if (!existsSync(rootResolution.absolutePath)) {
      continue;
    }

    const safeRoot = resolveSafeExistingPath(
      rootResolution.absolutePath,
      dataRoot,
      authorizedReadRoots.absolutePaths,
      { allowSymlinkInsideReadRoot: false },
    );

    if (!safeRoot.ok) {
      return safeRoot;
    }

    for (const fileId of walkMarkdownFiles(safeRoot.absolutePath, dataRoot)) {
      if (!isWithinReadRoots(fileId, scope.readRoots)) {
        continue;
      }

      if (request.studentId && studentIdFromFileId(fileId) !== request.studentId) {
        continue;
      }

      const kind = kindFromFileId(fileId);

      if (request.kind && kind !== request.kind) {
        continue;
      }

      const safeFile = resolveSafeExistingPath(
        path.join(dataRoot, fileId),
        dataRoot,
        authorizedReadRoots.absolutePaths,
      );

      if (!safeFile.ok) {
        return safeFile;
      }

      const document = readMarkdownDocument(fileId, safeFile.absolutePath);

      if (
        !matchesDateFilter(document.updatedAt, fileId, request.dateFrom, request.dateTo)
      ) {
        continue;
      }

      if (!matchesQuery(document.searchableText, request.query)) {
        continue;
      }

      files.push({
        fileId,
        title: document.title,
        kind,
        ...(document.studentId ? { studentId: document.studentId } : {}),
        ...(document.updatedAt ? { updatedAt: document.updatedAt } : {}),
        ...(document.excerpt ? { excerpt: document.excerpt } : {}),
      });
    }
  }

  files.sort((left, right) => left.fileId.localeCompare(right.fileId));

  return {
    ok: true,
    files: typeof request.limit === "number" ? files.slice(0, request.limit) : files,
  };
}

export function filesRead(
  request: FilesReadRequest,
  options: ScopedReadOptions,
): FilesReadResult {
  const scopeResult = resolveSessionScope(
    scopeRequest(request.ssid),
    options.registry ?? fixtureRegistry,
  );

  if (!scopeResult.ok) {
    return scopeResult;
  }

  const dataRoot = realpathSync(options.dataRoot);
  const authorizedReadRoots = resolveAuthorizedReadRoots(
    scopeResult.scope.readRoots,
    dataRoot,
  );

  if (!authorizedReadRoots.ok) {
    return authorizedReadRoots;
  }

  const documents: ReadDocument[] = [];

  for (const requestedFileId of request.fileIds) {
    const resolution = resolveFileId(requestedFileId, dataRoot);

    if (!resolution.ok) {
      return resolution;
    }

    if (!isWithinReadRoots(resolution.fileId, scopeResult.scope.readRoots)) {
      return forbidden("Requested file is outside the current scope.");
    }

    if (!existsSync(resolution.absolutePath)) {
      return notFound("Requested file does not exist.");
    }

    const safeFile = resolveSafeExistingPath(
      resolution.absolutePath,
      dataRoot,
      authorizedReadRoots.absolutePaths,
    );

    if (!safeFile.ok) {
      return safeFile;
    }

    const stat = statSync(safeFile.absolutePath);

    if (!stat.isFile()) {
      return notFound("Requested file does not exist.");
    }

    const raw = readFileSync(safeFile.absolutePath, "utf8");

    if (request.maxChars !== undefined && raw.length > request.maxChars) {
      return {
        ok: false,
        error: {
          code: "TOO_LARGE",
          message: "Requested file exceeds maxChars.",
        },
      };
    }

    const parsed = parseMarkdown(raw);
    documents.push({
      fileId: resolution.fileId,
      title: titleFromMarkdown(parsed, resolution.fileId),
      frontmatter: parsed.frontmatter,
      content: parsed.content,
    });
  }

  return {
    ok: true,
    documents,
  };
}

export function filesReadAll(
  request: FilesReadAllRequest,
  options: ScopedReadOptions,
): FilesReadAllResult {
  const listRequest: FilesListRequest = {};

  if (request.ssid !== undefined) {
    listRequest.ssid = request.ssid;
  }

  if (request.studentId !== undefined) {
    listRequest.studentId = request.studentId;
  }

  if (request.dateFrom !== undefined) {
    listRequest.dateFrom = request.dateFrom;
  }

  if (request.dateTo !== undefined) {
    listRequest.dateTo = request.dateTo;
  }

  const listResult = filesList(listRequest, options);

  if (!listResult.ok) {
    return listResult;
  }

  const requestedKinds = new Set(request.kinds ?? []);
  const maxFiles =
    request.maxFiles === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(0, request.maxFiles);
  const maxTotalChars =
    request.maxTotalChars === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(0, request.maxTotalChars);
  const documents: ReadDocument[] = [];
  let totalChars = 0;
  let truncated = false;

  for (const file of listResult.files) {
    if (requestedKinds.size > 0 && !requestedKinds.has(file.kind as FileKind)) {
      continue;
    }

    if (documents.length >= maxFiles) {
      truncated = true;
      break;
    }

    const readRequest: FilesReadRequest = { fileIds: [file.fileId] };

    if (request.ssid !== undefined) {
      readRequest.ssid = request.ssid;
    }

    const readResult = filesRead(readRequest, options);

    if (!readResult.ok) {
      return readResult;
    }

    const document = readResult.documents[0];

    if (!document) {
      continue;
    }

    const nextTotalChars = totalChars + document.content.length;

    if (nextTotalChars > maxTotalChars) {
      truncated = true;
      break;
    }

    documents.push(document);
    totalChars = nextTotalChars;
  }

  return {
    ok: true,
    documents,
    truncated,
  };
}

function walkMarkdownFiles(rootPath: string, dataRoot: string): string[] {
  const stat = lstatSync(rootPath);

  if (stat.isFile()) {
    return rootPath.endsWith(".md")
      ? [path.relative(dataRoot, rootPath).split(path.sep).join("/")]
      : [];
  }

  if (!stat.isDirectory()) {
    return [];
  }

  const files: string[] = [];

  for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
    const entryPath = path.join(rootPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(entryPath, dataRoot));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(path.relative(dataRoot, entryPath).split(path.sep).join("/"));
    }
  }

  return files;
}

function resolveFileId(fileId: string, dataRoot: string): ResolvedFileId {
  const normalized = normalizeFileId(fileId);

  if (!normalized) {
    return forbidden("fileId must be a relative Markdown archive path.");
  }

  const absolutePath = path.join(dataRoot, normalized);

  if (!isPathInside(absolutePath, dataRoot)) {
    return forbidden("fileId escapes the Markdown archive.");
  }

  return {
    ok: true,
    fileId: normalized,
    absolutePath,
  };
}

function resolveSafeExistingPath(
  absolutePath: string,
  dataRoot: string,
  authorizedReadRoots: string[],
  options: { allowSymlinkInsideReadRoot?: boolean } = {},
): SafeExistingPath {
  if (!isPathInside(absolutePath, dataRoot)) {
    return forbidden("Requested path escapes the Markdown archive.");
  }

  const expectedPath = path.resolve(absolutePath);
  const realPath = realpathSync(absolutePath);

  if (!isPathInside(realPath, dataRoot)) {
    return forbidden("Requested path escapes the Markdown archive.");
  }

  if (!isInsideAnyRoot(realPath, authorizedReadRoots)) {
    return forbidden("Requested path escapes the current scope.");
  }

  if (
    options.allowSymlinkInsideReadRoot === false &&
    realPath !== expectedPath
  ) {
    return forbidden("Requested path escapes the current scope.");
  }

  return {
    ok: true,
    absolutePath: realPath,
  };
}

function resolveAuthorizedReadRoots(
  readRoots: string[],
  dataRoot: string,
): AuthorizedReadRoots {
  const absolutePaths: string[] = [];

  for (const root of readRoots) {
    const resolution = resolveFileId(root, dataRoot);

    if (!resolution.ok) {
      return resolution;
    }

    if (!existsSync(resolution.absolutePath)) {
      continue;
    }

    const expectedPath = path.resolve(resolution.absolutePath);
    const realPath = realpathSync(resolution.absolutePath);

    if (realPath !== expectedPath || !isPathInside(realPath, dataRoot)) {
      return forbidden("Configured read root escapes the Markdown archive.");
    }

    absolutePaths.push(expectedPath);
  }

  return {
    ok: true,
    absolutePaths,
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

function isWithinReadRoots(fileId: string, readRoots: string[]): boolean {
  return readRoots.some((root) => {
    const normalizedRoot = normalizeFileId(root);

    return (
      normalizedRoot !== null &&
      (fileId === normalizedRoot || fileId.startsWith(`${normalizedRoot}/`))
    );
  });
}

function isPathInside(targetPath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, targetPath);

  return Boolean(relativePath) && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function isInsideAnyRoot(targetPath: string, rootPaths: string[]): boolean {
  return rootPaths.some((rootPath) => {
    return targetPath === rootPath || isPathInside(targetPath, rootPath);
  });
}

function scopeCanSeeStudent(scope: SessionScope, studentId: string): boolean {
  return scope.studentIds.includes("*") || scope.studentIds.includes(studentId);
}

function parseMarkdown(raw: string): ParsedMarkdown {
  if (!raw.startsWith("---\n")) {
    return {
      frontmatter: {},
      content: raw.trimStart(),
    };
  }

  const endIndex = raw.indexOf("\n---", 4);

  if (endIndex === -1) {
    return {
      frontmatter: {},
      content: raw.trimStart(),
    };
  }

  const frontmatterRaw = raw.slice(4, endIndex);
  const content = raw.slice(endIndex + 4).trimStart();

  return {
    frontmatter: parseFrontmatter(frontmatterRaw),
    content,
  };
}

function parseFrontmatter(raw: string): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {};

  for (const line of raw.split("\n")) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key) {
      frontmatter[key] = value.replace(/^["']|["']$/g, "");
    }
  }

  return frontmatter;
}

function readMarkdownDocument(
  fileId: string,
  absolutePath: string,
): ListedMarkdownDocument {
  const parsed = parseMarkdown(readFileSync(absolutePath, "utf8"));
  const title = titleFromMarkdown(parsed, fileId);
  const updatedAt = stringValue(parsed.frontmatter.updated_at);
  const excerpt = firstContentLine(parsed.content);
  const studentId = studentIdFromFileId(fileId);

  return {
    fileId,
    title,
    kind: kindFromFileId(fileId),
    ...(studentId ? { studentId } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    ...(excerpt ? { excerpt } : {}),
    searchableText: [
      fileId,
      title,
      excerpt,
      parsed.content,
      ...Object.values(parsed.frontmatter).map(String),
    ].join("\n"),
  };
}

function matchesDateFilter(
  updatedAt: string | undefined,
  fileId: string,
  dateFrom: string | undefined,
  dateTo: string | undefined,
): boolean {
  if (!dateFrom && !dateTo) {
    return true;
  }

  const candidateDate = dateFromFile(updatedAt) ?? dateFromFile(fileId);

  if (!candidateDate) {
    return false;
  }

  if (dateFrom && candidateDate < dateFrom) {
    return false;
  }

  if (dateTo && candidateDate > dateTo) {
    return false;
  }

  return true;
}

function dateFromFile(value: string | undefined): string | undefined {
  return value?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
}

function matchesQuery(searchableText: string, query: string | undefined): boolean {
  if (!query) {
    return true;
  }

  return searchableText.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function titleFromMarkdown(parsed: ParsedMarkdown, fileId: string): string {
  const frontmatterTitle = stringValue(parsed.frontmatter.title);

  if (frontmatterTitle) {
    return frontmatterTitle;
  }

  const heading = parsed.content
    .split("\n")
    .find((line) => line.startsWith("# "));

  return heading ? heading.slice(2).trim() : fileId;
}

function firstContentLine(content: string): string | undefined {
  return content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#"));
}

function studentIdFromFileId(fileId: string): string | undefined {
  const segments = fileId.split("/");
  const studentsIndex = segments.indexOf("students");

  return studentsIndex === -1 ? undefined : segments[studentsIndex + 1];
}

function kindFromFileId(fileId: string): FileKind {
  if (fileId.endsWith("/profile.md")) {
    return "profile";
  }

  if (fileId.endsWith("/knowledge.md")) {
    return "knowledge";
  }

  if (fileId.includes("/timeline/")) {
    return "timeline";
  }

  if (fileId.includes("/errors/")) {
    return "errors";
  }

  if (
    fileId.includes("/observations/") ||
    fileId.includes("/parent-observations/") ||
    fileId.includes("/teacher-observations/")
  ) {
    return "observations";
  }

  if (fileId.includes("/artifacts/")) {
    return "artifacts";
  }

  return "class";
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function scopeRequest(ssid: string | undefined): ScopeGetRequest {
  return ssid === undefined ? {} : { ssid };
}

function forbidden(message: string): FilesErrorResult {
  return {
    ok: false,
    error: {
      code: "FORBIDDEN",
      message,
    },
  };
}

function notFound(message: string): FilesErrorResult {
  return {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message,
    },
  };
}

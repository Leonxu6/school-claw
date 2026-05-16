import { readFileSync } from "node:fs";

export type ScopeRole = "parent" | "teacher";
export type ScopeStatus = "active" | "disabled";

export type PublicScope = {
  role: ScopeRole;
  classId: string;
  studentIds: string[];
  students: StudentRecord[];
  capabilities: string[];
  displayName: string;
};

export type ScopeErrorCode = "UNBOUND_SESSION" | "SESSION_DISABLED";

export type ScopeGetResult =
  | {
      ok: true;
      scope: PublicScope;
    }
  | {
      ok: false;
      error: {
        code: ScopeErrorCode;
        message: string;
      };
    };

export type ScopeGetRequest = {
  ssid?: string;
};

type ParentRecord = {
  parentId: string;
  displayName: string;
  studentId: string;
};

type StudentRecord = {
  studentId: string;
  displayName: string;
};

type TeacherRecord = {
  teacherId: string;
  displayName: string;
};

type SessionScopeRecord = {
  ssid: string;
  ssidHash: string;
  role: ScopeRole;
  status: ScopeStatus;
  platform: string;
  peerKind: "direct" | "group" | "channel";
  peerId: string;
  classId: string;
  parentId?: string;
  teacherId?: string;
  studentIds: string[];
  readRoots: string[];
  writeRoots: string[];
  capabilities: string[];
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type FixtureRegistry = {
  parents: ParentRecord[];
  students: StudentRecord[];
  teachers: TeacherRecord[];
  sessions: SessionScopeRecord[];
};

export const fixtureRegistry: FixtureRegistry = {
  parents: [
    {
      parentId: "parent_001",
      displayName: "张三家长",
      studentId: "stu_001",
    },
    {
      parentId: "parent_002",
      displayName: "李四家长",
      studentId: "stu_002",
    },
  ],
  students: [
    {
      studentId: "stu_001",
      displayName: "张三",
    },
    {
      studentId: "stu_002",
      displayName: "李四",
    },
  ],
  teachers: [
    {
      teacherId: "teacher_001",
      displayName: "王老师",
    },
  ],
  sessions: [
    {
      ssid: "agent:claw-agent:qqbot:direct:parent-openid-001",
      ssidHash: "4f9a1c4bd7a83310",
      role: "parent",
      status: "active",
      platform: "qqbot",
      peerKind: "direct",
      peerId: "parent-openid-001",
      classId: "class_001",
      parentId: "parent_001",
      studentIds: ["stu_001"],
      readRoots: [
        "classes/class_001/students/stu_001",
        "classes/class_001/public",
      ],
      writeRoots: [
        "classes/class_001/students/stu_001/parent-observations",
        "classes/class_001/students/stu_001/artifacts",
      ],
      capabilities: [
        "read_own_child",
        "append_parent_observation",
        "create_child_artifact",
      ],
      displayName: "张三家长",
      createdAt: "2026-05-12T09:00:00+08:00",
      updatedAt: "2026-05-12T09:00:00+08:00",
    },
    {
      ssid: "agent:claw-agent:qqbot:direct:parent-openid-002",
      ssidHash: "66e9dfb51cf0d432",
      role: "parent",
      status: "active",
      platform: "qqbot",
      peerKind: "direct",
      peerId: "parent-openid-002",
      classId: "class_001",
      parentId: "parent_002",
      studentIds: ["stu_002"],
      readRoots: [
        "classes/class_001/students/stu_002",
        "classes/class_001/public",
      ],
      writeRoots: [
        "classes/class_001/students/stu_002/parent-observations",
        "classes/class_001/students/stu_002/artifacts",
      ],
      capabilities: [
        "read_own_child",
        "append_parent_observation",
        "create_child_artifact",
      ],
      displayName: "李四家长",
      createdAt: "2026-05-12T09:00:00+08:00",
      updatedAt: "2026-05-12T09:00:00+08:00",
    },
    {
      ssid: "agent:claw-agent:feishu:direct:teacher-openid-001",
      ssidHash: "79d612d61e7e6de1",
      role: "teacher",
      status: "active",
      platform: "feishu",
      peerKind: "direct",
      peerId: "teacher-openid-001",
      classId: "class_001",
      teacherId: "teacher_001",
      studentIds: ["*"],
      readRoots: ["classes/class_001"],
      writeRoots: ["classes/class_001"],
      capabilities: ["read_class", "write_class", "create_class_artifact"],
      displayName: "王老师",
      createdAt: "2026-05-12T09:00:00+08:00",
      updatedAt: "2026-05-12T09:00:00+08:00",
    },
    {
      ssid: "agent:claw-agent:qqbot:direct:disabled-parent-openid-001",
      ssidHash: "a59136d42e42ad47",
      role: "parent",
      status: "disabled",
      platform: "qqbot",
      peerKind: "direct",
      peerId: "disabled-parent-openid-001",
      classId: "class_001",
      parentId: "parent_001",
      studentIds: ["stu_001"],
      readRoots: [
        "classes/class_001/students/stu_001",
        "classes/class_001/public",
      ],
      writeRoots: [
        "classes/class_001/students/stu_001/parent-observations",
        "classes/class_001/students/stu_001/artifacts",
      ],
      capabilities: [
        "read_own_child",
        "append_parent_observation",
        "create_child_artifact",
      ],
      displayName: "停用家长",
      createdAt: "2026-05-12T09:00:00+08:00",
      updatedAt: "2026-05-12T09:00:00+08:00",
    },
  ],
};

export type SessionScope = SessionScopeRecord & {
  knownStudentIds: string[];
};

export type ScopeResolveResult =
  | {
      ok: true;
      scope: SessionScope;
    }
  | {
      ok: false;
      error: {
        code: ScopeErrorCode;
        message: string;
      };
    };

export function resolveSessionScope(
  request: ScopeGetRequest,
  registry: FixtureRegistry = fixtureRegistry,
): ScopeResolveResult {
  const session = registry.sessions.find((candidate) => {
    return candidate.ssid === request.ssid;
  });

  if (!session) {
    return {
      ok: false,
      error: {
        code: "UNBOUND_SESSION",
        message: "Session is not bound to a CLAW scope.",
      },
    };
  }

  if (session.status === "disabled") {
    return {
      ok: false,
      error: {
        code: "SESSION_DISABLED",
        message: "Session scope is disabled.",
      },
    };
  }

  return {
    ok: true,
    scope: {
      ...session,
      studentIds: [...session.studentIds],
      knownStudentIds: knownStudentIdsForSession(session, registry),
      readRoots: [...session.readRoots],
      writeRoots: [...session.writeRoots],
      capabilities: [...session.capabilities],
    },
  };
}

export function scopeGet(
  request: ScopeGetRequest,
  registry: FixtureRegistry = fixtureRegistry,
): ScopeGetResult {
  const result = resolveSessionScope(request, registry);

  if (!result.ok) {
    return result;
  }

  const session = result.scope;

  return {
    ok: true,
    scope: {
      role: session.role,
      classId: session.classId,
      studentIds: [...session.studentIds],
      students: visibleStudentsForSession(session, registry),
      capabilities: [...session.capabilities],
      displayName: session.displayName,
    },
  };
}

function visibleStudentsForSession(
  session: SessionScope,
  registry: FixtureRegistry,
): StudentRecord[] {
  const visible = session.studentIds.includes("*")
    ? registry.students
    : registry.students.filter((student) => session.studentIds.includes(student.studentId));

  return visible.map((student) => ({ ...student }));
}

function knownStudentIdsForSession(
  session: SessionScopeRecord,
  registry: FixtureRegistry,
): string[] {
  if (!session.studentIds.includes("*")) {
    return [...session.studentIds];
  }

  return registry.students.map((student) => student.studentId);
}

export function loadScopeRegistryFromFile(filePath: string): FixtureRegistry {
  const raw = readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!isRecord(parsed)) {
    throw new Error(`Scope registry must be a JSON object: ${filePath}`);
  }

  const registry = {
    parents: recordsArray(parsed.parents, "parents", filePath),
    students: recordsArray(parsed.students, "students", filePath),
    teachers: recordsArray(parsed.teachers, "teachers", filePath),
    sessions: recordsArray(parsed.sessions, "sessions", filePath),
  } as FixtureRegistry;

  for (const session of registry.sessions) {
    validateSessionRecord(session, filePath);
  }

  return registry;
}

function recordsArray(
  value: unknown,
  field: keyof FixtureRegistry,
  filePath: string,
): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`Scope registry ${field} must be an array of objects: ${filePath}`);
  }

  return value;
}

function validateSessionRecord(session: SessionScopeRecord, filePath: string): void {
  const fields: Array<keyof SessionScopeRecord> = [
    "ssid",
    "ssidHash",
    "role",
    "status",
    "platform",
    "peerKind",
    "peerId",
    "classId",
    "studentIds",
    "readRoots",
    "writeRoots",
    "capabilities",
    "displayName",
    "createdAt",
    "updatedAt",
  ];

  for (const field of fields) {
    if (session[field] === undefined) {
      throw new Error(`Scope registry session is missing ${field}: ${filePath}`);
    }
  }

  if (session.role !== "parent" && session.role !== "teacher") {
    throw new Error(`Scope registry session role is invalid: ${filePath}`);
  }

  if (session.status !== "active" && session.status !== "disabled") {
    throw new Error(`Scope registry session status is invalid: ${filePath}`);
  }

  if (
    !Array.isArray(session.studentIds) ||
    !Array.isArray(session.readRoots) ||
    !Array.isArray(session.writeRoots) ||
    !Array.isArray(session.capabilities)
  ) {
    throw new Error(`Scope registry session list fields are invalid: ${filePath}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export type ScopeRole = "parent" | "teacher";
export type ScopeStatus = "active" | "disabled";

export type PublicScope = {
  role: ScopeRole;
  classId: string;
  studentIds: string[];
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
  role: ScopeRole;
  status: ScopeStatus;
  classId: string;
  studentIds: string[];
  capabilities: string[];
  displayName: string;
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
      role: "parent",
      status: "active",
      classId: "class_001",
      studentIds: ["stu_001"],
      capabilities: [
        "read_own_child",
        "append_parent_observation",
        "create_child_artifact",
      ],
      displayName: "张三家长",
    },
    {
      ssid: "agent:claw-agent:qqbot:direct:parent-openid-002",
      role: "parent",
      status: "active",
      classId: "class_001",
      studentIds: ["stu_002"],
      capabilities: [
        "read_own_child",
        "append_parent_observation",
        "create_child_artifact",
      ],
      displayName: "李四家长",
    },
    {
      ssid: "agent:claw-agent:feishu:direct:teacher-openid-001",
      role: "teacher",
      status: "active",
      classId: "class_001",
      studentIds: ["*"],
      capabilities: ["read_class", "write_class", "create_class_artifact"],
      displayName: "王老师",
    },
    {
      ssid: "agent:claw-agent:qqbot:direct:disabled-parent-openid-001",
      role: "parent",
      status: "disabled",
      classId: "class_001",
      studentIds: ["stu_001"],
      capabilities: [
        "read_own_child",
        "append_parent_observation",
        "create_child_artifact",
      ],
      displayName: "停用家长",
    },
  ],
};

export function scopeGet(
  request: ScopeGetRequest,
  registry: FixtureRegistry = fixtureRegistry,
): ScopeGetResult {
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
      role: session.role,
      classId: session.classId,
      studentIds: [...session.studentIds],
      capabilities: [...session.capabilities],
      displayName: session.displayName,
    },
  };
}

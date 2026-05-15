import { describe, expect, it } from "vitest";

import {
  fixtureRegistry,
  scopeGet,
  type ScopeGetResult,
} from "../src/scope/scope-get.js";

const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const parentBSsid = "agent:claw-agent:qqbot:direct:parent-openid-002";
const teacherSsid = "agent:claw-agent:feishu:direct:teacher-openid-001";
const disabledParentSsid =
  "agent:claw-agent:qqbot:direct:disabled-parent-openid-001";

function expectScope(result: ScopeGetResult) {
  expect(result.ok).toBe(true);

  if (!result.ok) {
    throw new Error(`Expected scope, received ${result.error.code}`);
  }

  return result.scope;
}

function expectError(result: ScopeGetResult) {
  expect(result.ok).toBe(false);

  if (result.ok) {
    throw new Error(`Expected error, received ${result.scope.role}`);
  }

  return result.error;
}

describe("scope_get", () => {
  it("returns safe parent scope fields for a bound parent ssid", () => {
    const scope = expectScope(scopeGet({ ssid: parentASsid }));

    expect(scope).toEqual({
      role: "parent",
      classId: "class_001",
      studentIds: ["stu_001"],
      students: [{ studentId: "stu_001", displayName: "张三" }],
      capabilities: [
        "read_own_child",
        "append_parent_observation",
        "create_child_artifact",
      ],
      displayName: "张三家长",
    });

    expect(Object.keys(scope).sort()).toEqual([
      "capabilities",
      "classId",
      "displayName",
      "role",
      "studentIds",
      "students",
    ]);
  });

  it("keeps two parent sessions scoped to different students", () => {
    const parentA = expectScope(scopeGet({ ssid: parentASsid }));
    const parentB = expectScope(scopeGet({ ssid: parentBSsid }));

    expect(parentA.studentIds).toEqual(["stu_001"]);
    expect(parentB.studentIds).toEqual(["stu_002"]);
  });

  it("returns teacher scope over the class without exposing registry internals", () => {
    const scope = expectScope(scopeGet({ ssid: teacherSsid }));

    expect(scope).toEqual({
      role: "teacher",
      classId: "class_001",
      studentIds: ["*"],
      students: [
        { studentId: "stu_001", displayName: "张三" },
        { studentId: "stu_002", displayName: "李四" },
      ],
      capabilities: ["read_class", "write_class", "create_class_artifact"],
      displayName: "王老师",
    });
  });

  it("returns UNBOUND_SESSION for an unknown ssid", () => {
    const error = expectError(
      scopeGet({ ssid: "agent:claw-agent:qqbot:direct:unknown-parent" }),
    );

    expect(error.code).toBe("UNBOUND_SESSION");
  });

  it("returns SESSION_DISABLED for a disabled session", () => {
    const error = expectError(scopeGet({ ssid: disabledParentSsid }));

    expect(error.code).toBe("SESSION_DISABLED");
  });

  it("has enough fixture registry records for the local harness", () => {
    expect(fixtureRegistry.parents).toHaveLength(2);
    expect(fixtureRegistry.students).toHaveLength(2);
    expect(fixtureRegistry.teachers).toHaveLength(1);
  });
});

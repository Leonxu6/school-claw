import { fileURLToPath } from "node:url";

import { filesRead } from "../src/archive/scoped-read.js";

const dataRoot = fileURLToPath(
  new URL("../tests/fixtures/markdown-archive/", import.meta.url),
);

const parentASsid = "agent:claw-agent:qqbot:direct:parent-openid-001";
const teacherSsid = "agent:claw-agent:feishu:direct:teacher-openid-001";

const examples = [
  {
    label: "parent A reads student A",
    ssid: parentASsid,
    fileId: "classes/class_001/students/stu_001/profile.md",
  },
  {
    label: "parent A reads student B",
    ssid: parentASsid,
    fileId: "classes/class_001/students/stu_002/profile.md",
  },
  {
    label: "teacher reads class",
    ssid: teacherSsid,
    fileId: "classes/class_001/class.md",
  },
  {
    label: 'fileId "../..."',
    ssid: parentASsid,
    fileId: "../registry/sessions/secret.md",
  },
];

for (const example of examples) {
  const result = filesRead(
    {
      ssid: example.ssid,
      fileIds: [example.fileId],
    },
    { dataRoot },
  );

  if (result.ok) {
    console.log(`${example.label} -> OK (${result.documents[0]?.title})`);
  } else {
    console.log(`${example.label} -> ${result.error.code}`);
  }
}

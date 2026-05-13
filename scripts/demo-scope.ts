import { scopeGet } from "../src/scope/scope-get.js";

const examples = [
  {
    label: "parent ssid",
    ssid: "agent:claw-agent:qqbot:direct:parent-openid-001",
  },
  {
    label: "teacher ssid",
    ssid: "agent:claw-agent:feishu:direct:teacher-openid-001",
  },
  {
    label: "unknown ssid",
    ssid: "agent:claw-agent:qqbot:direct:unknown-parent",
  },
];

for (const example of examples) {
  const result = scopeGet({ ssid: example.ssid });

  if (result.ok) {
    console.log(`${example.label} -> ${JSON.stringify(result.scope)}`);
  } else {
    console.log(`${example.label} -> ${result.error.code}`);
  }
}

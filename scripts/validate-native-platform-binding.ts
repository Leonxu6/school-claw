import { readFileSync } from "node:fs";

import {
  formatNativePlatformBindingReport,
  validateNativePlatformBindingEvidence,
  type NativePlatformBindingEvidence,
} from "../src/openclaw/native-platform-binding-spike.js";

const evidencePath = process.argv[2];

if (!evidencePath) {
  console.error("Usage: pnpm validate:native-platform-binding <evidence.json>");
  process.exit(2);
}

const evidence = JSON.parse(
  readFileSync(evidencePath, "utf8"),
) as NativePlatformBindingEvidence;
const validation = validateNativePlatformBindingEvidence(evidence);

process.stdout.write(formatNativePlatformBindingReport(validation));

if (!validation.ok) {
  process.exit(1);
}

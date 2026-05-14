import { spawnSync } from "node:child_process";

let cachedLoopbackBindSupport: boolean | undefined;

export function canBindLoopback(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.CLAW_FORCE_NON_NETWORK_E2E === "1") {
    return false;
  }

  if (cachedLoopbackBindSupport !== undefined) {
    return cachedLoopbackBindSupport;
  }

  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `
        const net = require("node:net");
        const server = net.createServer();
        const timeout = setTimeout(() => process.exit(2), 2000);
        server.once("error", () => {
          clearTimeout(timeout);
          process.exit(1);
        });
        server.listen(0, "127.0.0.1", () => {
          server.close(() => {
            clearTimeout(timeout);
            process.exit(0);
          });
        });
      `,
    ],
    {
      stdio: "ignore",
      timeout: 3_000,
    },
  );

  cachedLoopbackBindSupport = result.status === 0;

  return cachedLoopbackBindSupport;
}

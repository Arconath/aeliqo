#!/usr/bin/env node
/* global process */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const executable = process.env.AELIQO_MCP_EXECUTABLE;
if (!executable) throw new Error("AELIQO_MCP_EXECUTABLE is required");

const child = spawn(executable, [], {
  env: process.env,
  stdio: ["inherit", "inherit", "pipe"],
});
const lines = createInterface({ input: child.stderr });
lines.on("line", (line) => {
  const prefix = "Pair this workspace: ";
  if (line.startsWith(prefix)) {
    spawn("/usr/bin/open", ["-a", "Google Chrome", line.slice(prefix.length)], {
      stdio: "ignore",
      detached: true,
    }).unref();
    process.stderr.write(
      "Aeliqo pairing URL opened locally; credential omitted from logs.\n",
    );
    return;
  }
  process.stderr.write(`${line}\n`);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

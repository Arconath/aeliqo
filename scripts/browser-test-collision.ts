import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";

// Prove tests do not need the usual local application ports. Existing services
// stay untouched; only listeners created by this process are closed afterward.
const listeners: Server[] = [];
try {
  for (const port of [4173, 4318, 4319]) {
    const listener = createServer((_request, response) => response.end("Occupied test port"));
    await new Promise<void>((resolve, reject) => {
      listener.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE") resolve();
        else reject(error);
      });
      listener.listen(port, "127.0.0.1", () => { listeners.push(listener); resolve(); });
    });
  }
  process.exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn("pnpm", ["test:browser"], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await Promise.all(listeners.map((listener) => new Promise<void>((resolve) => listener.close(() => resolve()))));
}

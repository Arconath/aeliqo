import {chromium} from "@playwright/test";
import {build} from "vite";
import {createServer} from "node:http";
import {mkdtemp, mkdir, readFile, rm, symlink, writeFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {tmpdir} from "node:os";
import {extname, join, resolve} from "node:path";
import {describe, expect, it} from "vitest";
import {CATALOG_EXAMPLE_IDS, catalogExamples} from "../../examples/catalog/index.js";

const mimeTypes: Record<string, string> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".map": "application/json",
};

describe("catalog source snippets", () => {
  it("compile and run from a node_modules package consumer", async () => {
    const workspace = resolve(import.meta.dirname, "../..");
    const consumer = await mkdtemp(join(tmpdir(), "aeliqo-catalog-source-consumer-"));
    let server: ReturnType<typeof createServer> | undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

    try {
      await mkdir(join(consumer, "node_modules", "@aeliqo"), {recursive: true});
      await symlink(resolve(workspace, "packages", "core"), join(consumer, "node_modules", "@aeliqo", "core"), "dir");
      await symlink(resolve(workspace, "packages", "web"), join(consumer, "node_modules", "@aeliqo", "web"), "dir");

      const sourceDirectory = join(consumer, "src");
      await mkdir(sourceDirectory, {recursive: true});
      const sourceFiles = catalogExamples.map((example) => {
        const file = `${example.id}.ts`;
        return {example, file};
      });
      await Promise.all(sourceFiles.map(({example, file}) => writeFile(join(sourceDirectory, file), `${example.source}\n`)));
      await writeFile(join(sourceDirectory, "main.ts"), `${sourceFiles.map(({file}) => `import "./${file}";`).join("\n")}\n`);
      await writeFile(join(consumer, "index.html"), '<!doctype html><html lang="en"><body><div id="aeliqo-example"></div><script type="module" src="/src/main.ts"></script></body></html>\n');

      const installedManifest = JSON.parse(await readFile(join(consumer, "node_modules", "@aeliqo", "web", "package.json"), "utf8")) as {name?: string; version?: string; exports?: unknown};
      expect(installedManifest.name).toBe("@aeliqo/web");
      expect(installedManifest.version).toBe("0.1.0");
      expect(installedManifest.exports).toBeTruthy();

      await writeFile(join(consumer, "tsconfig.json"), JSON.stringify({
        compilerOptions: {target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true, skipLibCheck: true, noEmit: true, lib: ["ES2022", "DOM"]},
        include: ["src/*.ts"],
      }) + "\n");
      try {
        execFileSync(join(workspace, "node_modules", ".bin", "tsc"), ["--project", "tsconfig.json"], {cwd: consumer, encoding: "utf8", stdio: "pipe"});
      } catch (error) {
        throw new Error(`Catalog source consumer typecheck failed:\n${String((error as {stdout?: string}).stdout ?? "")}\n${String((error as {stderr?: string}).stderr ?? "")}`);
      }

      await build({
        root: consumer,
        configFile: false,
        logLevel: "error",
        build: {outDir: "dist", emptyOutDir: true, rollupOptions: {input: join(consumer, "index.html")} },
      });

      const output = join(consumer, "dist");
      server = createServer(async (request, response) => {
        try {
          const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
          const relative = pathname === "/" ? "index.html" : pathname.slice(1);
          const file = resolve(output, relative);
          if (!file.startsWith(`${output}/`)) {
            response.writeHead(403).end();
            return;
          }
          response.setHeader("content-type", mimeTypes[extname(file)] ?? "application/octet-stream");
          response.end(await readFile(file));
        } catch {
          response.writeHead(404).end();
        }
      });
      await new Promise<void>((resolveServer, reject) => {
        server!.once("error", reject);
        server!.listen(0, "127.0.0.1", () => resolveServer());
      });
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("Source consumer server did not expose a port.");

      browser = await chromium.launch();
      const page = await browser.newPage();
      const failures: string[] = [];
      page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
      page.on("console", (message) => { if (message.type() === "error") failures.push(message.text()); });
      await page.goto(`http://127.0.0.1:${address.port}/`, {waitUntil: "networkidle"});
      await page.waitForTimeout(1000);
      expect({roots: await page.locator("[data-catalog-source-root]").count(), failures}).toEqual({roots: CATALOG_EXAMPLE_IDS.length, failures: []});
      expect(failures).toEqual([]);
    } finally {
      await browser?.close();
      await new Promise<void>((resolveServer) => server?.close(() => resolveServer()) ?? resolveServer());
      await rm(consumer, {recursive: true, force: true});
    }
  }, 120_000);
});

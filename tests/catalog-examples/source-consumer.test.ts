import {chromium} from "@playwright/test";
import {build} from "vite";
import {createServer, type Server} from "node:http";
import {execFileSync} from "node:child_process";
import {extname, join, resolve} from "node:path";
import {mkdtemp, mkdir, readFile, realpath, rm, writeFile, lstat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {describe, expect, it} from "vitest";
import {CATALOG_EXAMPLE_IDS} from "../../examples/catalog/index.js";

const mimeTypes: Record<string, string> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".map": "application/json",
};

function run(argv: readonly string[], cwd: string): string {
  try {
    return execFileSync(argv[0]!, argv.slice(1), {cwd, encoding: "utf8", stdio: "pipe"});
  } catch (error) {
    const failure = error as {stdout?: string; stderr?: string; message?: string};
    throw new Error(`${failure.message ?? "Command failed"}\n${failure.stdout ?? ""}\n${failure.stderr ?? ""}`);
  }
}

async function serve(directory: string): Promise<{server: Server; port: number}> {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      const relative = pathname === "/" ? "index.html" : pathname.slice(1);
      const file = resolve(directory, relative);
      if (!file.startsWith(`${directory}/`)) {
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
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveServer());
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Static test server did not expose a port.");
  return {server, port: address.port};
}

async function close(server: Server | undefined): Promise<void> {
  await new Promise<void>((resolveServer) => server?.close(() => resolveServer()) ?? resolveServer());
}

describe("catalog source snippets", () => {
  it("extracts from a minified catalog bundle and runs against real packed packages", async () => {
    const workspace = resolve(import.meta.dirname, "../..");
    const consumer = await mkdtemp(join(tmpdir(), "aeliqo-catalog-source-consumer-"));
    const manifestRoot = await mkdtemp(join(tmpdir(), "aeliqo-catalog-source-manifest-"));
    let manifestServer: Server | undefined;
    let consumerServer: Server | undefined;
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;

    try {
      const manifestDist = join(manifestRoot, "dist");
      const catalogEntry = JSON.stringify(resolve(workspace, "examples/catalog/index.ts"));
      await writeFile(join(manifestRoot, "index.html"), '<!doctype html><html lang="en"><body><main id="sources"></main><script type="module" src="/entry.ts"></script></body></html>\n');
      await writeFile(join(manifestRoot, "entry.ts"), `import {catalogExamples} from ${catalogEntry};
const target = document.querySelector<HTMLElement>("#sources")!;
for (const example of catalogExamples) {
  const node = document.createElement("pre");
  node.dataset.example = example.id;
  node.textContent = example.source;
  target.append(node);
}
`);
      await build({
        root: manifestRoot,
        configFile: false,
        logLevel: "error",
        build: {outDir: manifestDist, emptyOutDir: true, minify: "oxc", rollupOptions: {input: join(manifestRoot, "index.html")}},
      });
      ({server: manifestServer} = await serve(manifestDist));

      browser = await chromium.launch();
      const manifestPage = await browser.newPage();
      const manifestFailures: string[] = [];
      manifestPage.on("pageerror", (error) => manifestFailures.push(error.stack ?? error.message));
      manifestPage.on("console", (message) => { if (message.type() === "error") manifestFailures.push(message.text()); });
      const manifestAddress = manifestServer.address();
      if (manifestAddress === null || typeof manifestAddress === "string") throw new Error("Manifest server did not expose a port.");
      await manifestPage.goto(`http://127.0.0.1:${manifestAddress.port}/`, {waitUntil: "networkidle"});
      const builtSources = await manifestPage.locator("[data-example]").evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => [node.getAttribute("data-example")!, node.textContent ?? ""])));
      expect(Object.keys(builtSources).sort()).toEqual([...CATALOG_EXAMPLE_IDS].sort());
      expect(manifestFailures).toEqual([]);
      expect(builtSources.button).toContain("createCatalogElement<AeliqoButtonElement>");
      expect(Object.values(builtSources).every((source) => !/\bany\b/.test(source))).toBe(true);

      const tarballs: string[] = [];
      for (const packageName of ["core", "web"] as const) {
        const packageDirectory = join(workspace, "packages", packageName);
        const tarball = join(consumer, `aeliqo-${packageName}-0.1.0.tgz`);
        run(["pnpm", "pack", "--out", tarball], packageDirectory);
        const packedManifest = JSON.parse(run(["tar", "-xOf", tarball, "package/package.json"], workspace)) as {name?: string; version?: string; private?: boolean; dependencies?: Record<string, string>};
        expect(packedManifest.name).toBe(`@aeliqo/${packageName}`);
        expect(packedManifest.version).toBe("0.1.0");
        expect(packedManifest.private).not.toBe(true);
        expect(JSON.stringify(packedManifest.dependencies ?? {})).not.toContain("workspace:");
        tarballs.push(tarball);
      }

      await writeFile(join(consumer, "package.json"), JSON.stringify({private: true, type: "module"}) + "\n");
      run(["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact", ...tarballs, "typescript@7.0.2", "vite@8.2.2"], consumer);
      for (const packageName of ["core", "web"] as const) {
        const installed = join(consumer, "node_modules", "@aeliqo", packageName);
        expect((await lstat(installed)).isSymbolicLink()).toBe(false);
        expect(await realpath(installed)).not.toBe(await realpath(join(workspace, "packages", packageName)));
      }

      const sourceDirectory = join(consumer, "src");
      await mkdir(sourceDirectory, {recursive: true});
      const sourceFiles = CATALOG_EXAMPLE_IDS.map((id) => ({id, file: `${id}.ts`}));
      await Promise.all(sourceFiles.map(({id, file}) => writeFile(join(sourceDirectory, file), `${builtSources[id] ?? ""}\n`)));
      await writeFile(join(sourceDirectory, "main.ts"), `${sourceFiles.map(({file}) => `import "./${file}";`).join("\n")}\n`);
      await writeFile(join(consumer, "index.html"), '<!doctype html><html lang="en"><body><div id="aeliqo-example"></div><script type="module" src="/src/main.ts"></script></body></html>\n');
      await writeFile(join(consumer, "tsconfig.json"), JSON.stringify({
        compilerOptions: {target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true, exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true, skipLibCheck: true, noEmit: true, lib: ["ES2022", "DOM"]},
        include: ["src/*.ts"],
      }) + "\n");
      run([join(consumer, "node_modules", ".bin", "tsc"), "--project", "tsconfig.json"], consumer);
      run([join(consumer, "node_modules", ".bin", "vite"), "build"], consumer);

      const output = join(consumer, "dist");
      ({server: consumerServer} = await serve(output));
      const consumerAddress = consumerServer.address();
      if (consumerAddress === null || typeof consumerAddress === "string") throw new Error("Source consumer server did not expose a port.");
      const page = await browser.newPage();
      const failures: string[] = [];
      page.on("pageerror", (error) => failures.push(error.stack ?? error.message));
      page.on("console", (message) => { if (message.type() === "error") failures.push(message.text()); });
      await page.goto(`http://127.0.0.1:${consumerAddress.port}/`, {waitUntil: "networkidle"});
      await page.waitForTimeout(1000);
      expect({roots: await page.locator("[data-catalog-source-root]").count(), failures}).toEqual({roots: CATALOG_EXAMPLE_IDS.length, failures: []});
    } finally {
      await browser?.close();
      await close(manifestServer);
      await close(consumerServer);
      await rm(manifestRoot, {recursive: true, force: true});
      await rm(consumer, {recursive: true, force: true});
    }
  }, 180_000);
});

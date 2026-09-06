import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { arch, cpus, platform, release, tmpdir, totalmem } from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";
import { build } from "vite";

const root = process.cwd();
const artifacts = path.join(root, "artifacts/packages");
const packed = path.join(root, "artifacts/tarballs");
const publicRelease = process.env.AELIQO_PUBLIC_RELEASE === "1";
const packageDirectories = ["core", "react", "mcp", "byok", "webmcp-experimental"] as const;
const expectedPackages = packageDirectories.map((directory) => `@aeliqo/${directory}`);
const reactMatrices = [
  {
    label: "react-18.3",
    react: "18.3.1",
    reactDom: "18.3.1",
    reactTypes: "18.3.31",
    reactDomTypes: "18.3.7",
    next: "15.5.25",
  },
  {
    label: "react-19",
    react: "19.2.8",
    reactDom: "19.2.8",
    reactTypes: "19.2.18",
    reactDomTypes: "19.2.7",
    next: "16.3.4",
  },
] as const;
const toolVersions = {
  typescript: "5.9.3",
  vite: "7.3.0",
} as const;

type PackResult = {
  name: string;
  version: string;
  filename: string;
  size: number;
  unpackedSize: number;
  integrity: string;
  files: { path: string; size: number }[];
};
type ExportTarget = string | { types: string; import: string };
type ArtifactManifest = {
  name: string;
  version: string;
  private: boolean;
  license?: string;
  description?: string;
  homepage?: string;
  repository?: unknown;
  bugs?: unknown;
  engines?: Record<string, string>;
  files?: string[];
  exports: Record<string, ExportTarget>;
  bin?: Record<string, string>;
  sideEffects?: false | string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type ScaleSample = {
  observableMs: number;
  reactActualDurationMs: number | null;
  elements: number;
  renderedRows: number;
  columns: number;
  paths: number;
  circles: number;
  disclosure: string | null;
  summary: string | null;
};

declare global {
  interface Window {
    __AELIQO_ARTIFACT_SCALE__: {
      dataPreparationMs: number;
      dataQueryMs: number;
      render: (kind: "table" | "trend") => Promise<ScaleSample>;
      clear: () => Promise<number>;
    };
  }
}

function run(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, JSON.stringify(value, null, 2) + "\n");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

await rm(packed, { recursive: true, force: true });
await mkdir(packed, { recursive: true });

const builtDirectories = (await readdir(artifacts)).sort();
assert(
  JSON.stringify(builtDirectories) === JSON.stringify([...packageDirectories].sort()),
  `Artifact allowlist mismatch: ${builtDirectories.join(", ")}`,
);

const tarballs: Record<string, string> = {};
const packages: Record<string, {
  version: string;
  filename: string;
  sha256: string;
  integrity: string;
  size: number;
  unpackedSize: number;
  files: string[];
}> = {};
for (const directory of packageDirectories) {
  const packageRoot = path.join(artifacts, directory);
  const manifestText = await readFile(path.join(packageRoot, "package.json"), "utf8");
  const manifest = JSON.parse(manifestText) as ArtifactManifest;
  assert(expectedPackages.includes(manifest.name), `Unexpected public package ${manifest.name}`);
  assert(
    publicRelease
      ? manifest.private === false
      : manifest.private === true,
    `${manifest.name} metadata does not match the requested release mode`,
  );
  assert(manifest.license === "Apache-2.0", `${manifest.name} does not declare Apache-2.0`);
  assert(manifest.description && manifest.homepage && manifest.repository && manifest.bugs, `${manifest.name} lacks public metadata`);
  assert(manifest.engines?.node, `${manifest.name} lacks a Node compatibility declaration`);
  assert(!/(?:workspace:|link:)/.test(manifestText), `${manifest.name} leaks a workspace/link dependency`);
  assert(
    manifest.files?.includes("src") &&
      manifest.files.includes("README.md") &&
      manifest.files.includes("LICENSE") &&
      manifest.files.includes("NOTICE"),
    `${manifest.name} has no explicit file allowlist`,
  );
  assert(
    directory === "react"
      ? Array.isArray(manifest.sideEffects) && manifest.sideEffects.includes("**/*.css")
      : manifest.sideEffects === false,
    `${manifest.name} has incorrect sideEffects metadata`,
  );
  for (const [entry, target] of Object.entries(manifest.exports)) {
    const paths = typeof target === "string" ? [target] : [target.types, target.import];
    for (const exportPath of paths) {
      assert(exportPath.startsWith("./"), `${manifest.name} export ${entry} escapes its package`);
      await stat(path.join(packageRoot, exportPath));
    }
  }
  for (const [name, executable] of Object.entries(manifest.bin ?? {})) {
    assert(executable.startsWith("./"), `${manifest.name} bin ${name} escapes its package`);
    const executableStat = await stat(path.join(packageRoot, executable));
    assert((executableStat.mode & 0o111) !== 0, `${manifest.name} bin ${name} is not executable`);
  }
  const result = JSON.parse(
    run("npm", ["pack", "--json", "--pack-destination", packed], packageRoot),
  ) as PackResult[];
  const pack = result[0]!;
  assert(pack.name === manifest.name, `Packed the wrong package for ${directory}`);
  const files = pack.files.map((file) => file.path).sort();
  const invalid = files.filter(
    (file) =>
      !/^(LICENSE|NOTICE|README\.md|package\.json|src\/.*\.(js|d\.ts|css))$/.test(file) ||
      /\.(test|spec)\./.test(file),
  );
  assert(!invalid.length, `Unintended files in ${pack.name}: ${invalid.join(", ")}`);
  assert(files.includes("README.md"), `${pack.name} tarball omits README.md`);
  assert(files.includes("LICENSE"), `${pack.name} tarball omits LICENSE`);
  assert(files.includes("NOTICE"), `${pack.name} tarball omits NOTICE`);
  for (const file of files.filter((name) => /\.(?:js|d\.ts|css)$/.test(name))) {
    const content = await readFile(path.join(packageRoot, file), "utf8");
    assert(
      !/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{20,}|\bghp_[A-Za-z0-9]{20,}|\bnpm_[A-Za-z0-9]{20,})/.test(content),
      `Possible credential material in ${pack.name}/${file}`,
    );
  }
  const tarball = path.join(packed, pack.filename);
  const sha256 = createHash("sha256").update(await readFile(tarball)).digest("hex");
  tarballs[pack.name] = tarball;
  packages[pack.name] = {
    version: pack.version,
    filename: pack.filename,
    sha256,
    integrity: pack.integrity,
    size: pack.size,
    unpackedSize: pack.unpackedSize,
    files,
  };
}
assert(
  JSON.stringify(Object.keys(packages).sort()) === JSON.stringify([...expectedPackages].sort()),
  "Packed package set does not match the five-package release allowlist",
);

async function createConsumer(
  prefix: string,
  matrix: (typeof reactMatrices)[number],
  includeAdapters = false,
): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), `aeliqo-${prefix}-`));
  const dependencies: Record<string, string> = {
    "@aeliqo/core": `file:${tarballs["@aeliqo/core"]}`,
    "@aeliqo/react": `file:${tarballs["@aeliqo/react"]}`,
    react: matrix.react,
    "react-dom": matrix.reactDom,
  };
  if (includeAdapters) {
    dependencies["@aeliqo/mcp"] = `file:${tarballs["@aeliqo/mcp"]}`;
    dependencies["@aeliqo/byok"] = `file:${tarballs["@aeliqo/byok"]}`;
    dependencies["@aeliqo/webmcp-experimental"] =
      `file:${tarballs["@aeliqo/webmcp-experimental"]}`;
  }
  await writeJson(path.join(directory, "package.json"), {
    name: `aeliqo-${prefix}`,
    private: true,
    type: "module",
    packageManager: "npm@11.19.0",
    dependencies,
    devDependencies: {
      "@types/node": "24.10.0",
      "@types/react": matrix.reactTypes,
      "@types/react-dom": matrix.reactDomTypes,
      typescript: toolVersions.typescript,
      tsx: "4.21.0",
      vite: toolVersions.vite,
    },
  });
  run(
    "npm",
    ["install", "--include=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact"],
    directory,
  );
  const lock = await readFile(path.join(directory, "package-lock.json"), "utf8");
  assert(!/(?:workspace:|link:)/.test(lock), `${prefix} lockfile contains workspace/link resolution`);
  for (const match of lock.matchAll(/"resolved":\s*"([^"]+)"/g)) {
    const resolved = match[1]!;
    assert(
      resolved.startsWith("https://registry.npmjs.org/") ||
        resolved.startsWith("file:"),
      `${prefix} contains a non-registry dependency resolution: ${resolved}`,
    );
  }
  return await realpath(directory);
}

const consumerSource = await readFile(path.join(root, "tests/packaging/consumer.tsx"), "utf8");
const consumerEntry = await readFile(path.join(root, "tests/packaging/consumer-entry.tsx"), "utf8");
const scaleEntry = await readFile(path.join(root, "tests/packaging/scale-entry.tsx"), "utf8");
const byokLocalRecipeSource = await readFile(
  path.join(root, "apps/companion/examples/byok-local-server.ts"),
  "utf8",
);
const consumerResults: Record<string, unknown> = {};
let importIsolation: Record<string, unknown> = {};

for (const matrix of reactMatrices) {
  const consumer = await createConsumer(matrix.label, matrix, matrix.label === "react-19");
  await writeFile(path.join(consumer, "consumer.tsx"), consumerSource);
  await writeFile(path.join(consumer, "consumer-entry.tsx"), consumerEntry);
  if (matrix.label === "react-19")
    await writeFile(path.join(consumer, "scale-entry.tsx"), scaleEntry);
  if (matrix.label === "react-19")
    await writeFile(path.join(consumer, "byok-local-server.ts"), byokLocalRecipeSource);
  await writeFile(
    path.join(consumer, "runtime.tsx"),
    `import {createElement} from "react"; import {renderToStaticMarkup} from "react-dom/server"; import {ConsumerExample,workspace} from "./consumer"; const html=renderToStaticMarkup(createElement(ConsumerExample)); const checks={primitive:html.includes("Daily requests"),compound:html.includes("Entity comparison"),workspace:html.includes("Request volume")&&html.includes("Selected service"),theme:html.includes("aeliqo-theme")&&html.includes("--aeliqo-accent:#6750a4"),manualLinkedSelection:workspace.getSelection("service-detail")==="api"}; if(Object.values(checks).some(value=>!value))throw new Error("Runtime consumer assertions failed: "+JSON.stringify(checks)); console.log(JSON.stringify(checks));\n`,
  );
  await writeFile(
    path.join(consumer, "main.tsx"),
    'import { createRoot } from "react-dom/client"; import { ConsumerExample } from "./consumer-entry"; createRoot(document.getElementById("root")!).render(<ConsumerExample />);\n',
  );
  await writeFile(
    path.join(consumer, "index.html"),
    '<!doctype html><html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>\n',
  );
  await writeJson(path.join(consumer, "tsconfig.json"), {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext",
      moduleResolution: "Bundler",
      jsx: "react-jsx",
      strict: true,
      skipLibCheck: false,
      noEmit: true,
    },
    include: ["*.tsx"],
  });
  run(path.join(consumer, "node_modules/.bin/tsc"), ["--noEmit"], consumer);
  const runtimeAssertions = JSON.parse(
    run(process.execPath, ["--import", "tsx", "runtime.tsx"], consumer).trim(),
  ) as Record<string, boolean>;
  run(path.join(consumer, "node_modules/.bin/vite"), ["build"], consumer);
  const ssr = run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import {createElement} from 'react'; import {renderToString} from 'react-dom/server'; import {Metric} from '@aeliqo/react/metric'; import {defineDataset} from '@aeliqo/core'; const html=renderToString(createElement(Metric,{value:42,label:'Active records'})); if(!html.includes('42')||typeof defineDataset!=='function')throw Error('SSR/import failure'); console.log(html.length)",
    ],
    consumer,
  ).trim();
  if (matrix.label === "react-19") {
    run(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "for(const entry of ['@aeliqo/react','@aeliqo/react/table','@aeliqo/mcp','@aeliqo/mcp/browser','@aeliqo/byok','@aeliqo/byok/openai','@aeliqo/webmcp-experimental']) await import(entry)",
      ],
      consumer,
    );
  }
  consumerResults[matrix.label] = {
    directory: consumer,
    react: matrix.react,
    reactDom: matrix.reactDom,
    types: matrix.reactTypes,
    typecheck: "passed",
    viteBuild: "passed",
    ssrHtmlBytes: Number(ssr),
    runtimeAssertions,
    dependencySource: "registry for third-party packages; local files only for packed Aeliqo tarballs",
  };

  if (matrix.label === "react-19") {
    const modules: string[] = [];
    const retainedExports: string[] = [];
    let bundleBytes = 0;
    await writeFile(
      path.join(consumer, "metric-only.tsx"),
      'import { Metric } from "@aeliqo/react/metric"; export const view = <Metric value={42} label="Active records" />;\n',
    );
    await build({
      configFile: false,
      root: consumer,
      logLevel: "warn",
      plugins: [{
        name: "consumer-evidence",
        generateBundle(_options, bundle) {
          for (const output of Object.values(bundle)) {
            if (output.type !== "chunk") continue;
            bundleBytes += Buffer.byteLength(output.code);
            for (const [name, module] of Object.entries(output.modules)) {
              if (module.renderedLength <= 0) continue;
              modules.push(name);
              retainedExports.push(...module.renderedExports);
            }
          }
        },
      }],
      build: {
        outDir: path.join(consumer, "metric-dist"),
        lib: { entry: path.join(consumer, "metric-only.tsx"), formats: ["es"], fileName: "metric-only" },
        rollupOptions: { external: ["react", "react/jsx-runtime", "react-dom"] },
        minify: true,
      },
    });
    const unwanted = [
      ...modules.filter((module) =>
        /(?:d3-|\/mcp\/|\/byok\/|webmcp|modelcontextprotocol|\/workspace\.)/.test(module),
      ),
      ...retainedExports.filter((name) =>
        ["Workspace", "createWorkspace", "createAeliqoServer", "createOpenAIProvider"].includes(name),
      ),
    ];
    assert(!unwanted.length, `Standalone Metric import isolation failed: ${unwanted.join(", ")}`);
    importIsolation = { bundleBytes, moduleCount: modules.length, modules, retainedExports, unwanted };
  }
}

async function availablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address !== "string", "Could not allocate Next.js test port");
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function stop(processHandle: ChildProcess): Promise<void> {
  if (processHandle.exitCode !== null) return;
  processHandle.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      if (processHandle.exitCode === null) processHandle.kill("SIGKILL");
      resolve();
    }, 5_000);
    processHandle.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function percentile(samples: readonly number[], fraction: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1]!;
}

function optionalPercentile(samples: readonly (number | null)[], fraction: number): number | null {
  const measured = samples.filter((sample): sample is number => sample !== null);
  return measured.length ? percentile(measured, fraction) : null;
}

async function measureInstalledArtifactScale(consumer: string) {
  await writeFile(
    path.join(consumer, "scale.html"),
    '<!doctype html><html><body><div id="root"></div><script type="module" src="/scale-entry.tsx"></script></body></html>\n',
  );
  await build({
    configFile: false,
    root: consumer,
    logLevel: "warn",
    build: {
      outDir: path.join(consumer, "scale-dist"),
      emptyOutDir: true,
      rollupOptions: { input: path.join(consumer, "scale.html") },
    },
  });
  const port = await availablePort();
  const server = spawn(
    path.join(consumer, "node_modules/.bin/vite"),
    ["preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort", "--outDir", "scale-dist"],
    { cwd: consumer, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  server.stdout?.on("data", (chunk) => { output += String(chunk); });
  server.stderr?.on("data", (chunk) => { output += String(chunk); });
  try {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        try {
          const response = await page.goto(`http://127.0.0.1:${port}/scale.html`);
          if (response?.ok()) break;
        } catch {
          // The isolated production preview may still be binding its socket.
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      assert(page.url().includes("scale.html"), `Artifact scale preview did not start: ${output}`);
      await page.waitForFunction(() => Boolean(window.__AELIQO_ARTIFACT_SCALE__));
      const browserVersion = browser.version();
      const session = await page.context().newCDPSession(page);
      await session.send("Performance.enable");
      await session.send("HeapProfiler.enable");
      const before = await session.send("Performance.getMetrics");

      const runSeries = async (kind: "table" | "trend") => {
        await page.evaluate((target) => window.__AELIQO_ARTIFACT_SCALE__.render(target), kind);
        await page.evaluate(() => window.__AELIQO_ARTIFACT_SCALE__.clear());
        const samples: ScaleSample[] = [];
        for (let index = 0; index < 7; index++) {
          samples.push(
            await page.evaluate((target) => window.__AELIQO_ARTIFACT_SCALE__.render(target), kind),
          );
          assert(
            (await page.evaluate(() => window.__AELIQO_ARTIFACT_SCALE__.clear())) === 0,
            `${kind} left DOM nodes after cleanup`,
          );
        }
        return {
          samples,
          observableMs: {
            median: percentile(samples.map((sample) => sample.observableMs), 0.5),
            p95: percentile(samples.map((sample) => sample.observableMs), 0.95),
          },
          reactActualDurationMs: {
            median: optionalPercentile(samples.map((sample) => sample.reactActualDurationMs), 0.5),
            p95: optionalPercentile(samples.map((sample) => sample.reactActualDurationMs), 0.95),
            unavailableReason: samples.some((sample) => sample.reactActualDurationMs !== null)
              ? null
              : "The normal React production renderer does not emit Profiler callbacks; zero is not reported as render duration",
          },
        };
      };

      const table = await runSeries("table");
      const mountedTable = await page.evaluate(() => window.__AELIQO_ARTIFACT_SCALE__.render("table"));
      assert(mountedTable.renderedRows < 30, "Artifact Table rendered an unbounded row count");
      assert(mountedTable.columns === 20, "Artifact Table omitted declared columns");
      assert(await page.getByRole("table").getAttribute("aria-rowcount") === "100001", "Artifact Table row semantics changed");
      await page.getByRole("region").press("End");
      await page.getByRole("region").press("Enter");
      assert((await page.evaluate(() => window.__AELIQO_ARTIFACT_SCALE__.clear())) === 0, "Artifact Table cleanup failed");

      const trend = await runSeries("trend");
      const mountedTrend = await page.evaluate(() => window.__AELIQO_ARTIFACT_SCALE__.render("trend"));
      assert(mountedTrend.paths === 1, "Artifact Trend did not render one semantic series");
      assert(mountedTrend.circles <= 800, "Artifact Trend exceeded its geometry bound");
      assert(
        /^Visual sample: \d+ of 50000 aggregated points drawn\. Exact summaries use all points\.$/.test(mountedTrend.disclosure ?? ""),
        "Artifact Trend omitted its sampling disclosure",
      );
      assert(
        mountedTrend.summary?.includes("minimum -999, maximum 999, latest 4, and 51 missing measurements") ?? false,
        "Artifact Trend exact summary changed",
      );
      assert((await page.evaluate(() => window.__AELIQO_ARTIFACT_SCALE__.clear())) === 0, "Artifact Trend cleanup failed");

      await session.send("HeapProfiler.collectGarbage");
      const heapSamples: number[] = [];
      for (let cycle = 0; cycle < 25; cycle++) {
        const component: "table" | "trend" = cycle % 2 === 0 ? "table" : "trend";
        await page.evaluate(
          (kind) => window.__AELIQO_ARTIFACT_SCALE__.render(kind),
          component,
        );
        assert((await page.evaluate(() => window.__AELIQO_ARTIFACT_SCALE__.clear())) === 0, "Artifact lifecycle cleanup failed");
        if ((cycle + 1) % 5 === 0) {
          await session.send("HeapProfiler.collectGarbage");
          const metrics = await session.send("Performance.getMetrics");
          const heap = metrics.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value;
          if (heap !== undefined) heapSamples.push(heap);
        }
      }
      const retainedGrowthBytes = heapSamples.length > 1 ? heapSamples.at(-1)! - heapSamples[0]! : null;
      assert(retainedGrowthBytes === null || retainedGrowthBytes < 8 * 1024 * 1024, "Artifact lifecycle retained too much heap");
      const after = await session.send("Performance.getMetrics");
      const initialMetrics = Object.fromEntries(before.metrics.map((metric) => [metric.name, metric.value]));
      const finalMetrics = Object.fromEntries(after.metrics.map((metric) => [metric.name, metric.value]));
      const fixture = await page.evaluate(() => ({
        dataPreparationMs: window.__AELIQO_ARTIFACT_SCALE__.dataPreparationMs,
        dataQueryMs: window.__AELIQO_ARTIFACT_SCALE__.dataQueryMs,
        viewport: { width: innerWidth, height: innerHeight },
        devicePixelRatio,
      }));
      await session.detach();
      return {
        environment: {
          profile: `${platform()}-${arch()}-node${process.versions.node.split(".")[0]}-chromium${browserVersion.split(".")[0]}`,
          browser: `Chromium ${browserVersion}`,
          os: `${platform()} ${release()}`,
          cpu: cpus()[0]?.model,
          logicalCpuCount: cpus().length,
          totalMemoryBytes: totalmem(),
          viewport: fixture.viewport,
          devicePixelRatio: fixture.devicePixelRatio,
          network: "loopback; package dependencies were installed before measurement",
        },
        workload: {
          table: "100,000 rows × 20 columns",
          trend: "50,000 one-minute observations",
          warmupPerComponent: 1,
          measuredSamplesPerComponent: 7,
          lifecycleCycles: 25,
        },
        phases: {
          agentMs: null,
          transportMs: null,
          dataQueryMs: fixture.dataQueryMs,
          dataPreparationMs: fixture.dataPreparationMs,
          reactActualDurationDefinition: "React Profiler render work; not browser commit or paint duration",
          browserScriptMs: (finalMetrics.ScriptDuration - initialMetrics.ScriptDuration) * 1000,
          browserLayoutMs: (finalMetrics.LayoutDuration - initialMetrics.LayoutDuration) * 1000,
          browserPaint: "observable completion after two animation frames; GPU pixel completion is not claimed",
        },
        table,
        trend,
        geometry: {
          tableRenderedRows: mountedTable.renderedRows,
          tableColumns: mountedTable.columns,
          trendPaths: mountedTrend.paths,
          trendCircles: mountedTrend.circles,
          trendDisclosure: mountedTrend.disclosure,
        },
        cleanup: {
          emptyDomAfterEveryUnmount: true,
          forcedGcHeapUsedBytesEveryFiveCycles: heapSamples,
          retainedGrowthBytes,
          acceptanceLimitBytes: 8 * 1024 * 1024,
        },
      };
    } finally {
      await browser.close();
    }
  } finally {
    await stop(server);
  }
}

async function smokeMcpExecutable(consumer: string): Promise<void> {
  const executable = path.join(consumer, "node_modules/.bin/aeliqo-mcp");
  await stat(executable);
  const processHandle = spawn(executable, [], {
    cwd: consumer,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      AELIQO_BRIDGE_PORT: "0",
      AELIQO_WORKSPACE_ID: "release-consumer",
      AELIQO_RENDERER_ID: "release-renderer",
    },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Installed aeliqo-mcp executable did not start")),
        10_000,
      );
      let diagnostics = "";
      processHandle.stderr?.on("data", (chunk) => {
        diagnostics += String(chunk);
        if (diagnostics.includes("Aeliqo bridge listening on ws://127.0.0.1:")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      processHandle.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`Installed aeliqo-mcp exited before readiness with code ${code}`));
      });
      processHandle.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  } finally {
    await stop(processHandle);
  }
}

const adapterConsumer = consumerResults["react-19"] as { directory?: string } | undefined;
assert(adapterConsumer, "No installed consumer was available for the MCP executable smoke test");
assert(adapterConsumer.directory, "React 19 consumer directory is unavailable");
await writeJson(path.join(adapterConsumer.directory, "tsconfig.recipe.json"), {
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    strict: true,
    skipLibCheck: false,
    noEmit: true,
    types: ["node"],
  },
  include: ["byok-local-server.ts"],
});
run(
  path.join(adapterConsumer.directory, "node_modules/.bin/tsc"),
  ["--project", "tsconfig.recipe.json"],
  adapterConsumer.directory,
);
run(
  process.execPath,
  [
    "--import",
    "tsx",
    "--input-type=module",
    "-e",
    "import {createScriptedProvider} from '@aeliqo/byok'; import {createLocalByokServer} from './byok-local-server.ts'; const app=createLocalByokServer({provider:createScriptedProvider([{calls:[],text:'tarball recipe'}])}); await app.ready; if(!(app.port>0&&app.mcp.bridge.port>0))throw Error('recipe did not bind loopback'); await app.close();",
  ],
  adapterConsumer.directory,
);
const byokLocalRecipe = {
  copiedFrom: "apps/companion/examples/byok-local-server.ts",
  installedFromTarballs: true,
  nodeNextTypecheck: "passed",
  loopbackStartupAndShutdown: "passed",
  providerNetworkRequest: "not performed; deterministic provider used",
};
await smokeMcpExecutable(adapterConsumer.directory);
const mcpExecutable = {
  command: "aeliqo-mcp",
  installedFromTarball: true,
  ephemeralLoopbackStartup: "passed",
};

const installedArtifactScale = await measureInstalledArtifactScale(adapterConsumer.directory);
const performanceProfile = installedArtifactScale.environment.profile;
const performanceMetrics = {
  tableObservableMedianMs: installedArtifactScale.table.observableMs.median,
  tableObservableP95Ms: installedArtifactScale.table.observableMs.p95,
  trendObservableMedianMs: installedArtifactScale.trend.observableMs.median,
  trendObservableP95Ms: installedArtifactScale.trend.observableMs.p95,
  ...(installedArtifactScale.table.reactActualDurationMs.median === null
    ? {}
    : { tableReactMedianMs: installedArtifactScale.table.reactActualDurationMs.median }),
  ...(installedArtifactScale.trend.reactActualDurationMs.median === null
    ? {}
    : { trendReactMedianMs: installedArtifactScale.trend.reactActualDurationMs.median }),
};
const baselinePath = path.join(root, "docs/evidence/package-performance-baseline.json");
type PerformanceBaseline = {
  schemaVersion: 1;
  profiles: Record<string, {
    acceptedAt: string;
    packageSha256: Record<string, string>;
    metrics: Record<string, number>;
  }>;
};
let performanceBaseline: PerformanceBaseline = { schemaVersion: 1, profiles: {} };
try {
  performanceBaseline = JSON.parse(await readFile(baselinePath, "utf8")) as PerformanceBaseline;
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const matchingBaseline = performanceBaseline.profiles[performanceProfile];
const performanceChanges = matchingBaseline
  ? Object.fromEntries(
      Object.entries(performanceMetrics).map(([metric, value]) => {
        const previous = matchingBaseline.metrics[metric];
        const changePercent = previous === undefined || previous === 0
          ? null
          : ((value - previous) / previous) * 100;
        return [metric, { previous: previous ?? null, current: value, changePercent }];
      }),
    )
  : {};
const performanceRegressions = Object.entries(performanceChanges).flatMap(
  ([metric, change]) =>
    change.changePercent !== null && change.changePercent > 10
      ? [{ metric, ...change }]
      : [],
);
if (process.env.AELIQO_RECORD_PACKAGE_BASELINE === "1") {
  performanceBaseline.profiles[performanceProfile] = {
    acceptedAt: new Date().toISOString(),
    packageSha256: Object.fromEntries(
      Object.entries(packages).map(([name, value]) => [name, value.sha256]),
    ),
    metrics: performanceMetrics,
  };
  await writeJson(baselinePath, performanceBaseline);
}
if (process.env.AELIQO_ENFORCE_PACKAGE_PERF === "1")
  assert(
    matchingBaseline && performanceRegressions.length === 0,
    matchingBaseline
      ? `Installed artifact performance requires investigation: ${performanceRegressions.map((item) => `${item.metric} ${item.changePercent!.toFixed(1)}%`).join(", ")}`
      : `No accepted installed-artifact performance baseline exists for ${performanceProfile}`,
  );
const releaseArtifactPerformance = {
  installedFromTarballs: true,
  packageSha256: Object.fromEntries(
    Object.entries(packages).map(([name, value]) => [name, value.sha256]),
  ),
  ...installedArtifactScale,
  comparison: {
    profile: performanceProfile,
    thresholdPercent: 10,
    baselineFound: Boolean(matchingBaseline),
    changes: performanceChanges,
    regressions: performanceRegressions,
    investigationRequired: performanceRegressions.length > 0,
    status: matchingBaseline
      ? performanceRegressions.length
        ? "investigation-required"
        : "within-threshold"
      : "baseline-missing",
  },
  limitations:
    "Synthetic in-memory data on one local Chromium profile. Observable time ends after two animation frames and does not claim GPU pixel completion, field INP, remote-query cost, or a universal support limit.",
};

const nextResults: Record<string, unknown> = {};
for (const matrix of reactMatrices) {
  const consumer = await createConsumer(`next-${matrix.label}`, matrix);
  const manifest = JSON.parse(await readFile(path.join(consumer, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  manifest.dependencies.next = matrix.next;
  await writeJson(path.join(consumer, "package.json"), manifest);
  run("npm", ["install", "--include=dev", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact"], consumer);
  await mkdir(path.join(consumer, "app"), { recursive: true });
  await writeFile(
    path.join(consumer, "app/layout.tsx"),
    'import "@aeliqo/react/styles.css"; export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}\n',
  );
  await writeFile(
    path.join(consumer, "app/client.tsx"),
    '"use client"; import {useState} from "react"; import {Ranking} from "@aeliqo/react/ranking"; const dataset={id:"services",entity:"Service",label:"Services",identity:"id",labelField:"name",dimensions:[{key:"name",label:"Name"}],metrics:[{key:"requests",label:"Requests",aggregation:"sum" as const}],timeFields:[]}; const snapshot={status:"ready" as const,records:[{id:"api",name:"API",requests:12},{id:"worker",name:"Worker",requests:7}]}; export function ClientExample(){const [selectedId,setSelectedId]=useState<string|null>(null); return <div data-testid="hydrated-client"><Ranking dataset={dataset} snapshot={snapshot} metric="requests" selectedId={selectedId} onSelect={setSelectedId}/><output>{selectedId??"none"}</output></div>}\n',
  );
  await writeFile(
    path.join(consumer, "app/page.tsx"),
    'import {Metric} from "@aeliqo/react/metric"; import {ClientExample} from "./client"; export default function Page(){return <main className="aeliqo-theme"><h1>External Aeliqo consumer</h1><div data-testid="server-metric"><Metric value={42} label="Services"/></div><ClientExample/></main>}\n',
  );
  await writeJson(path.join(consumer, "tsconfig.json"), {
    compilerOptions: {
      target: "ES2017",
      lib: ["DOM", "DOM.Iterable", "ESNext"],
      allowJs: false,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "ESNext",
      moduleResolution: "Bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
    },
    include: ["next-env.d.ts", ".next/types/**/*.ts", "**/*.ts", "**/*.tsx"],
    exclude: ["node_modules"],
  });
  run(path.join(consumer, "node_modules/.bin/next"), ["build"], consumer);
  const port = await availablePort();
  const server = spawn(
    path.join(consumer, "node_modules/.bin/next"),
    ["start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: consumer,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1", NEXT_TELEMETRY_DISABLED: "1" },
    },
  );
  let output = "";
  server.stdout?.on("data", (chunk) => { output += String(chunk); });
  server.stderr?.on("data", (chunk) => { output += String(chunk); });
  try {
    const deadline = Date.now() + 30_000;
    let response: Response | undefined;
    while (Date.now() < deadline) {
      try {
        response = await fetch(`http://127.0.0.1:${port}/`);
        if (response.ok) break;
      } catch {
        // The production server may still be binding its socket.
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert(response?.ok, `Next.js server did not become ready: ${output}`);
    const html = await response.text();
    assert(html.includes("External Aeliqo consumer") && html.includes("Services"), "Next.js SSR output omitted the Aeliqo fixture");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      const browserErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      page.on("pageerror", (error) => browserErrors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
      await page.getByTestId("hydrated-client").waitFor();
      await page.getByRole("button", { name: /API/ }).click();
      await page.getByText("api", { exact: true }).waitFor();
      assert(!browserErrors.some((message) => /hydration|uncaught|error/i.test(message)), `Next hydration emitted errors: ${browserErrors.join(" | ")}`);
      nextResults[matrix.label] = {
        directory: consumer,
        next: matrix.next,
        react: matrix.react,
        build: "passed",
        ssr: "passed",
        hydration: "passed",
        clientInteraction: "passed",
        browserErrors,
      };
    } finally {
      await browser.close();
    }
  } finally {
    await stop(server);
  }
}

const sourceCommit = run("git", ["rev-parse", "HEAD"], root).trim();
const sourceStatus = run("git", ["status", "--porcelain", "--untracked-files=all"], root)
  .trim()
  .split("\n")
  .filter(Boolean);
const report = {
  generatedAt: new Date().toISOString(),
  sourceCommit,
  sourceTree: sourceStatus.length === 0 ? { clean: true } : { clean: false, changes: sourceStatus },
  allowlist: expectedPackages,
  packages,
  consumers: consumerResults,
  nextAppRouter: nextResults,
  importIsolation,
  mcpExecutable,
  byokLocalRecipe,
  releaseArtifactPerformance,
  artifactPolicy: {
    publicRelease,
    private: !publicRelease,
    license: "Apache-2.0 owner-approved metadata and NOTICE included",
    sourceManifestGuard: "All workspace package manifests remain private; only AELIQO_PUBLIC_RELEASE=1 removes the artifact guard",
    publication: "Not performed",
    internalDependencies: "Exact package versions in artifacts; file tarballs used only by isolated test consumers",
    thirdPartyDependencies: "Installed from the npm registry in isolated temporary directories",
  },
};
await writeJson(path.join(root, "artifacts/package-evidence.json"), report);
console.log(JSON.stringify(report, null, 2));

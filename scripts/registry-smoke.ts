import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const version = process.env.AELIQO_REGISTRY_VERSION ?? "0.2.0";
const consumer = await mkdtemp(path.join(tmpdir(), "aeliqo-registry-smoke-"));
const packages = ["core", "react", "mcp", "byok", "webmcp-experimental"] as const;

function run(command: string, args: string[]): string {
  return execFileSync(command, args, {
    cwd: consumer,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

await writeFile(
  path.join(consumer, "package.json"),
  JSON.stringify(
    {
      name: "aeliqo-registry-smoke",
      private: true,
      type: "module",
      dependencies: Object.fromEntries([
        ...packages.map((name) => [`@aeliqo/${name}`, version]),
        ["react", "19.2.8"],
        ["react-dom", "19.2.8"],
      ]),
      devDependencies: {
        "@types/node": "24.10.0",
        "@types/react": "19.2.18",
        "@types/react-dom": "19.2.7",
        tsx: "4.21.0",
        typescript: "5.9.3",
      },
    },
    null,
    2,
  ) + "\n",
);

run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"]);
const lock = await readFile(path.join(consumer, "package-lock.json"), "utf8");
assert(!/(?:file:|link:|workspace:)/.test(lock), "Registry smoke resolved a local package source");

await writeFile(
  path.join(consumer, "smoke.tsx"),
  `import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createCapabilityDispatcher, createWorkspace, defineDataset, type DataPort } from "@aeliqo/core";
import { Metric } from "@aeliqo/react/metric";
import { Comparison } from "@aeliqo/react/comparison";
import { Workspace } from "@aeliqo/react/workspace";
import { createAeliqoServer } from "@aeliqo/mcp";
import { createOpenAIProvider } from "@aeliqo/byok/openai";
import { registerWebMCP } from "@aeliqo/webmcp-experimental";

const dataset = defineDataset({
  id: "services",
  entity: "Service",
  label: "Services",
  identity: "id",
  labelField: "name",
  dimensions: [{ key: "name", label: "Service" }, { key: "team", label: "Team" }],
  metrics: [{ key: "requests", label: "Requests", aggregation: "sum" }],
  timeFields: [],
});
const snapshot = { status: "ready" as const, records: [{ id: "api", name: "API", team: "Platform", requests: 42 }, { id: "worker", name: "Worker", team: "Operations", requests: 28 }], scope: "entire-dataset" as const, totalCount: 2 };
const dataPort: DataPort = {
  listDatasets: () => [dataset],
  getDataset: id => id === dataset.id ? dataset : undefined,
  getSnapshot: id => id === dataset.id ? snapshot : { status: "error", records: [], error: "Unknown dataset" },
  subscribe: () => () => undefined,
};
const model = createWorkspace({ dataPort, nodes: [
  { id: "metric", component: "Metric", datasetId: dataset.id, metric: "requests" },
  { id: "detail", component: "Detail", datasetId: dataset.id },
] });
model.apply({ version: 1, baseRevision: model.getState().revision, operations: [{ type: "select", id: "metric", recordId: "api" }] }, { actor: "human" });
const html = renderToStaticMarkup(createElement("main", {},
  createElement(Metric, { value: 42, label: "Requests" }),
  createElement(Comparison, { dataset, snapshot, selectedIds: ["api", "worker"], metrics: ["requests"] }),
  createElement(Workspace, { store: model }),
));
if (!html.includes("Requests") || !html.includes("42")) throw new Error("Registry SSR failed");
const webmcp = await registerWebMCP(createCapabilityDispatcher(model));
if (typeof createAeliqoServer !== "function" || typeof createOpenAIProvider !== "function" || webmcp.supported) throw new Error("Adapter export or safe host detection failed");
console.log(JSON.stringify({ version: "${version}", packages: ${JSON.stringify(packages)}, ssrBytes: Buffer.byteLength(html), webmcp: webmcp.evidence, source: "npm registry" }));
`,
);
await writeFile(
  path.join(consumer, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        jsx: "react-jsx",
        strict: true,
        noEmit: true,
      },
      include: ["smoke.tsx"],
    },
    null,
    2,
  ) + "\n",
);
run(path.join(consumer, "node_modules/.bin/tsc"), ["--noEmit"]);
const result = run(process.execPath, ["--import", "tsx", "smoke.tsx"]).trim();
console.log(result);
console.log(`Registry consumer: ${consumer}`);

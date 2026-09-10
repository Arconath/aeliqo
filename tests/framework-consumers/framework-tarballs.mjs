/**
 * Exercise the framework recipes from packed packages in a clean consumer.
 *
 * The consumer intentionally lives outside this workspace.  This keeps the
 * proof honest: no workspace aliases, source imports, or local package links
 * can make an integration recipe appear to work.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createServer} from "node:http";
import {access, mkdir, mkdtemp, readFile, writeFile} from "node:fs/promises";
import {tmpdir, platform, release, arch} from "node:os";
import {extname, join, resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {chromium} from "@playwright/test";

const root = resolve(import.meta.dirname, "../..");
const output = join(root, "artifacts", "framework-consumers");
await mkdir(output, {recursive: true});
const runDirectory = await mkdtemp(join(output, "run-"));
const consumer = await mkdtemp(join(tmpdir(), "aeliqo-framework-consumer-"));

function run(argv, cwd, encoding = "utf8") {
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd,
    encoding,
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${argv.join(" ")} failed: ${result.error ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return result.stdout;
}

const hash = (bytes, algorithm = "sha256", encoding = "hex") => createHash(algorithm).update(bytes).digest(encoding);
const sourceDigest = () => run(["python3", "scripts/gate.py", "digest"], root).trim();
const before = sourceDigest();

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

const packageNames = ["core", "runtime", "web", "react"];
const artifacts = [];
for (const name of packageNames) {
  const directory = join(root, "packages", name);
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  assert.equal(manifest.name, `@aeliqo/sdk-${name}`);
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.license, "Apache-2.0");
  assert.notEqual(manifest.private, true);
  run(["pnpm", "build"], directory);
  const tarball = join(runDirectory, `aeliqo-${name}-0.1.0.tgz`);
  run(["pnpm", "pack", "--out", tarball], directory);
  const bytes = await readFile(tarball);
  const packed = JSON.parse(run(["tar", "-xOf", tarball, "package/package.json"], root));
  assert.deepEqual(packed.exports, manifest.exports, `${name} exports changed while packing`);
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, manifest.version);
  assert.equal(packed.license, manifest.license);
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
    assert(!JSON.stringify(packed[field] ?? {}).includes("workspace:"), `${name} contains a workspace dependency`);
  }
  const entries = run(["tar", "-tzf", tarball], root).trim().split("\n");
  assert(entries.includes("package/LICENSE"), `${name} tarball has no license`);
  assert(entries.includes("package/README.md"), `${name} tarball has no README`);
  assert(!entries.some((entry) => entry.startsWith("package/src/")), `${name} tarball leaked source`);
  assert(!entries.some((entry) => entry.startsWith("package/node_modules/")), `${name} tarball contains node_modules`);
  for (const entry of entries) assert(entry.startsWith("package/") && !entry.split("/").includes(".."), `Unsafe archive path: ${entry}`);
  artifacts.push({
    name: packed.name,
    version: packed.version,
    path: tarball,
    bytes: bytes.length,
    sha256: hash(bytes),
    integrity: `sha512-${hash(bytes, "sha512", "base64")}`,
    entries,
  });
}

await writeFile(join(consumer, "package.json"), JSON.stringify({private: true, type: "module"}) + "\n");
run([
  "npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact",
  ...artifacts.map((artifact) => artifact.path),
  "react@19.2.8", "react-dom@19.2.8", "vue@3.5.42",
  "@types/react@19.2.18", "@types/react-dom@19.2.7", "@types/node@24.13.3",
  "typescript@7.0.2", "vite@8.2.2", "@playwright/test@1.63.0",
], consumer);
const lockBytes = await readFile(join(consumer, "package-lock.json"));
const lock = JSON.parse(lockBytes);
for (const [name, version] of Object.entries({react: "19.2.8", "react-dom": "19.2.8", vue: "3.5.42", typescript: "7.0.2", vite: "8.2.2"})) {
  assert.equal(lock.packages[`node_modules/${name}`]?.version, version);
}
for (const artifact of artifacts) {
  const location = `node_modules/${artifact.name}`;
  assert.equal(lock.packages[location]?.version, artifact.version);
  assert.equal(lock.packages[location]?.integrity, artifact.integrity);
  assert.deepEqual(Object.keys(lock.packages).filter((key) => key.endsWith(location)), [location], `Duplicate ${artifact.name}`);
  for (const entry of artifact.entries) {
    if (entry.endsWith("/")) continue;
    const installed = await readFile(join(consumer, location, entry.slice("package/".length)));
    const packed = run(["tar", "-xOf", artifact.path, entry], root, null);
    assert.equal(hash(installed), hash(packed), `Installed ${artifact.name} bytes differ for ${entry}`);
  }
}
assert.equal(lock.packages["node_modules/@aeliqo/sdk-runtime"]?.dependencies?.["@aeliqo/sdk-core"], "0.1.0");
assert.equal(lock.packages["node_modules/@aeliqo/sdk-web"]?.dependencies?.["@aeliqo/sdk-core"], "0.1.0");
assert.equal(lock.packages["node_modules/@aeliqo/sdk-react"]?.dependencies?.["@aeliqo/sdk-web"], "0.1.0");
assert.deepEqual(Object.keys(lock.packages).filter((key) => key.startsWith("node_modules/@aeliqo/")).sort(), [
  "node_modules/@aeliqo/sdk-core",
  "node_modules/@aeliqo/sdk-react",
  "node_modules/@aeliqo/sdk-runtime",
  "node_modules/@aeliqo/sdk-web",
]);
await writeFile(join(runDirectory, "consumer-package-lock.json"), lockBytes);

const wrappers = [
  "AeliqoButton", "AeliqoIconButton", "AeliqoLink", "AeliqoText", "AeliqoHeading", "AeliqoBadge", "AeliqoAvatar", "AeliqoSeparator", "AeliqoSurface", "AeliqoStack", "AeliqoGrid", "AeliqoSplitPane", "AeliqoScrollArea",
  "AeliqoTextField", "AeliqoTextArea", "AeliqoNumberField", "AeliqoCheckbox", "AeliqoRadioGroup", "AeliqoSwitch", "AeliqoSelect", "AeliqoCombobox", "AeliqoDateField", "AeliqoDateRange", "AeliqoSlider", "AeliqoSearchField", "AeliqoFileInput", "AeliqoFieldGroup", "AeliqoForm",
  "AeliqoTabs", "AeliqoBreadcrumb", "AeliqoPagination", "AeliqoMenu", "AeliqoTreeNav",
  "AeliqoTooltip", "AeliqoPopover", "AeliqoDialog", "AeliqoDrawer", "AeliqoToast", "AeliqoAlert", "AeliqoProgress", "AeliqoSkeleton", "AeliqoEmptyState",
  "AeliqoMetric", "AeliqoDelta", "AeliqoKeyValue", "AeliqoDetail", "AeliqoRecordList", "AeliqoCardCollection", "AeliqoTable", "AeliqoFilterBuilder", "AeliqoSelectionSummary",
  "AeliqoTrend", "AeliqoBar", "AeliqoArea", "AeliqoScatter", "AeliqoHistogram", "AeliqoHeatmap", "AeliqoMatrix", "AeliqoRelationship", "AeliqoTree", "AeliqoTreemap", "AeliqoTimeline", "AeliqoCalendarGrid",
  "AeliqoExplorer", "AeliqoComparison", "AeliqoBreakdown", "AeliqoInvestigation", "AeliqoSearchResults", "AeliqoRecordEditor", "AeliqoFormFlow", "AeliqoQualityPanel",
];
assert.equal(wrappers.length, 71);

const wrapperImport = wrappers.join(", ");
await writeFile(join(consumer, "framework-types.tsx"), `
import {${wrapperImport}} from "@aeliqo/sdk-react";
import type {AeliqoInputChangeDetail, AeliqoTableColumn, AeliqoTableRow} from "@aeliqo/sdk-web";
import {AeliqoInput} from "@aeliqo/sdk-react";

const wrappers = {${wrappers.join(", ")}};
for (const [name, component] of Object.entries(wrappers)) {
  if (typeof component !== "function") throw new Error(name + " is not a component wrapper");
}
const columns: readonly AeliqoTableColumn[] = [{key: "name", label: "Name"}];
const rows: readonly AeliqoTableRow[] = [{name: "Ada"}];
const detail: AeliqoInputChangeDetail = {value: "Ada", source: "user"};
const input = <AeliqoInput label="Person" value={detail.value} onAeliqoInput={(event) => { const value: string = event.detail.value; void value; }} />;
const table = <AeliqoTable caption="People" columns={columns} rows={rows} />;
void [input, table];
`);

await writeFile(join(consumer, "framework-vanilla.ts"), `
import {AeliqoInputEvent, registerAeliqoElements, type AeliqoInputElement, type AeliqoTableElement} from "@aeliqo/sdk-web";
registerAeliqoElements();
const input = document.createElement("aeliqo-input") as AeliqoInputElement;
const table = document.createElement("aeliqo-table") as AeliqoTableElement;
input.addEventListener("aeliqo-input", (event) => {
  if (!(event instanceof AeliqoInputEvent)) throw new Error("Unexpected input event");
  const next: string = event.detail.value;
  input.value = next;
});
table.columns = [{key: "name", label: "Name"}];
table.rows = [{name: "Ada"}];
document.body.append(input, table);
`);

await writeFile(join(consumer, "framework-vue.ts"), `
import {createApp, h, ref, type VNode} from "vue";
import {registerAeliqoElements, AeliqoInputEvent} from "@aeliqo/sdk-web";
registerAeliqoElements();
const Fixture = {setup(): (() => VNode) { const value = ref("Vue"); return () => h("aeliqo-input", {
  label: "Vue person", value: value.value, "onAeliqo-input": (event: Event) => { if (event instanceof AeliqoInputEvent) value.value = event.detail.value; },
}); }};
createApp(Fixture).mount(document.body);
`);

const catalogQuickstart = `
import {createStandardFunctionRegistry, parseCatalog, type Catalog} from "@aeliqo/sdk-core";
import {createMeaningAuthoring} from "@aeliqo/sdk-runtime/meaning";
const registry = createStandardFunctionRegistry("framework-meaning-consumer");
if (!registry.ok) throw new Error("function registry");
const catalog = {version: "1", revision: "framework-catalog", functionRegistryDigest: registry.value.digest,
  entities: [{id: "orders", label: "Orders", identity: ["id"], rowGrain: ["id"], fields: [
    {id: "id", label: "ID", role: "identity", type: {value: "text", nullable: false}},
    {id: "amount", label: "Amount", role: "measure", type: {value: "integer", nullable: false}},
  ]}], relationships: [], meanings: [], capabilities: []} as const satisfies Catalog;
const authoring = createMeaningAuthoring({catalog, registry: registry.value});
if (!authoring.ok) throw new Error("authoring");
const amount = authoring.value.field("orders", "amount");
if (!amount.ok) throw new Error("amount field");
// @ts-expect-error The reused Catalog rejects a field that is absent from orders.
authoring.value.field("orders", "missing");
const total = authoring.value.call({id: "core.aggregate.sum", revision: "1"}, [amount]);
if (!total.ok) throw new Error("typed aggregate");
const meaning = authoring.value.defineMeaning({id: "orders.total", label: "Order total", description: "Sum of order amounts", expression: total.value});
if (!meaning.ok) throw new Error("meaning");
void meaning.value;
const loaded = parseCatalog(catalog);
if (!loaded.ok) throw new Error("loaded catalog");
const dynamic = createMeaningAuthoring({catalog: loaded.value, registry: registry.value});
if (!dynamic.ok) throw new Error("dynamic authoring");
dynamic.value.field("orders", "amount");
`;
await writeFile(join(consumer, "meaning-quickstart.ts"), catalogQuickstart);
assert(!/@aeliqo\/(agent|studio)|model|chart|layout/i.test(catalogQuickstart), "Manual meaning path coupled to model, Studio, chart, or layout");

await writeFile(join(consumer, "tsconfig.json"), JSON.stringify({compilerOptions: {
  target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true,
  exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true, skipLibCheck: false,
  jsx: "react-jsx", noEmit: true, lib: ["ES2022", "DOM", "DOM.Iterable"], types: ["node", "react"],
}, files: ["framework-types.tsx", "framework-vanilla.ts", "framework-vue.ts", "meaning-quickstart.ts"]}, null, 2) + "\n");
run([join(consumer, "node_modules/.bin/tsc"), "--project", "tsconfig.json"], consumer);

await writeFile(join(consumer, "ssr.mjs"), `
import assert from "node:assert/strict";
import "@aeliqo/sdk-react/ssr";
import {createElement} from "react";
import {renderToString} from "react-dom/server";
import {AeliqoInput, AeliqoTable} from "@aeliqo/sdk-react";
assert.equal(typeof globalThis.window, "undefined");
const input = renderToString(createElement(AeliqoInput, {label: "SSR person", value: "Ada"}));
const table = renderToString(createElement(AeliqoTable, {caption: "SSR people", columns: [{key: "name", label: "Name"}], rows: [{name: "Ada"}]}));
assert.match(input, /aeliqo-input/); assert.match(input, /SSR person/); assert.match(input, /shadowrootmode="open"/);
assert.match(table, /aeliqo-table/); assert.match(table, /SSR people/); assert.match(table, /Ada/);
console.log(JSON.stringify({input: input.length, table: table.length, hasDeclarativeShadow: input.includes("shadowrootmode=\\\"open\\\"")}));
`);
const ssr = run(["node", "ssr.mjs"], consumer).trim();
const ssrReport = JSON.parse(ssr.split("\n").at(-1));
assert.equal(ssrReport.hasDeclarativeShadow, true);

await writeFile(join(consumer, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Installed framework consumer</title></head><body>
<main id="vanilla"><h1>Vanilla</h1><p id="vanilla-status" role="status">Ready</p><aeliqo-input id="vanilla-input" label="Vanilla person" value="Vanilla"></aeliqo-input><aeliqo-table id="vanilla-table"></aeliqo-table></main>
<main id="react-root"><h1>React</h1></main><main id="vue-root"><h1>Vue</h1></main><script type="module" src="/framework-app.tsx"></script></body></html>`);
await writeFile(join(consumer, "framework-app.tsx"), `
import {registerAeliqoElements, AeliqoInputEvent, type AeliqoTableElement} from "@aeliqo/sdk-web";
import {createRoot} from "react-dom/client";
import React, {useState} from "react";
import {AeliqoInput, AeliqoTable, registerAeliqoReactElements} from "@aeliqo/sdk-react";
import {createApp, h, ref, type VNode} from "vue";
registerAeliqoElements(); registerAeliqoReactElements();
const vanillaInput = document.querySelector("#vanilla-input");
const vanillaTable = document.querySelector<AeliqoTableElement>("#vanilla-table");
const vanillaStatus = document.querySelector("#vanilla-status");
if (!(vanillaInput instanceof HTMLElement) || !vanillaTable || !vanillaStatus) throw new Error("Vanilla shell is incomplete");
vanillaTable.caption = "Vanilla people"; vanillaTable.columns = [{key: "name", label: "Name"}]; vanillaTable.rows = [{name: "Ada"}];
vanillaInput.addEventListener("aeliqo-input", (event) => { if (event instanceof AeliqoInputEvent) { vanillaInput.value = event.detail.value; vanillaStatus.textContent = event.detail.value; } });
function ReactFixture(): React.JSX.Element { const [value, setValue] = useState("React"); return <><p id="react-status" role="status">{value}</p><AeliqoInput id="react-input" label="React person" value={value} onAeliqoInput={(event) => setValue(event.detail.value)} /><AeliqoTable caption="React people" columns={[{key: "name", label: "Name"}]} rows={[{name: "Ada"}]} /></>; }
createRoot(document.querySelector("#react-root")!).render(<ReactFixture />);
const VueFixture = {setup(): (() => VNode) { const value = ref("Vue"); return () => h("section", [h("p", {id: "vue-status", role: "status"}, value.value), h("aeliqo-input", {id: "vue-input", label: "Vue person", value: value.value, "onAeliqo-input": (event: Event) => { if (event instanceof AeliqoInputEvent) value.value = event.detail.value; }}), h("aeliqo-table", {caption: "Vue people", columns: [{key: "name", label: "Name"}], rows: [{name: "Ada"}]})]); }};
createApp(VueFixture).mount(document.querySelector("#vue-root")!);
`);
await writeFile(join(consumer, "vite.config.mjs"), `export default {build: {target: "es2022"}};\n`);
run([join(consumer, "node_modules/.bin/vite"), "build"], consumer);
assert(await fileExists(join(consumer, "dist", "index.html")), "Consumer build has no index.html");

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = resolve(consumer, "dist", pathname === "/" ? "index.html" : `.${pathname}`);
    if (!file.startsWith(join(consumer, "dist") + "/")) throw new Error("invalid path");
    response.setHeader("content-type", ({".js": "text/javascript", ".html": "text/html", ".css": "text/css"})[extname(file)] ?? "application/octet-stream");
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolveServer) => server.listen(0, "127.0.0.1", resolveServer));
let browser;
let browserVersion;
const browserErrors = [];
try {
  browser = await chromium.launch();
  browserVersion = browser.version();
  const page = await browser.newPage({viewport: {width: 1280, height: 1000}});
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator("#vanilla-input").waitFor();
  await page.locator("#react-input").waitFor();
  await page.locator("#vue-input").waitFor();
  assert.equal(await page.locator("#vanilla-table").locator("table").count(), 1);
  assert.equal(await page.locator("#react-root aeliqo-table").locator("table").count(), 1);
  assert.equal(await page.locator("#vue-root aeliqo-table").locator("table").count(), 1);
  await page.locator("#vanilla-input").locator("input").fill("Lin");
  await page.locator("#react-input").locator("input").fill("Mina");
  await page.locator("#vue-input").locator("input").fill("Noor");
  await page.waitForFunction(() => document.querySelector("#vanilla-status")?.textContent === "Lin");
  await page.waitForFunction(() => document.querySelector("#react-status")?.textContent === "Mina");
  await page.waitForFunction(() => document.querySelector("#vue-status")?.textContent === "Noor");
  assert.equal(await page.locator("#vanilla-input").locator("input").inputValue(), "Lin");
  assert.equal(await page.locator("#react-input").locator("input").inputValue(), "Mina");
  assert.equal(await page.locator("#vue-input").locator("input").inputValue(), "Noor");
  assert.deepEqual(browserErrors, []);
  await page.screenshot({path: join(runDirectory, "framework-consumer.png"), fullPage: true});
} finally {
  await browser?.close();
  await new Promise((resolveServer) => server.close(resolveServer));
}

assert.equal(sourceDigest(), before, "Source changed during framework consumer proof");
await writeFile(join(runDirectory, "report.json"), JSON.stringify({
  sourceDigest: before,
  passed: true,
  scope: "Installed core/runtime/web/react tarballs; all 71 React wrapper exports; typed vanilla/React/Vue recipes; React declarative Shadow DOM SSR; property/event behavior in Chromium; manual schema-reuse meaning path without model, Studio, chart, or layout imports.",
  artifacts: artifacts.map(({entries, ...artifact}) => ({...artifact, entries})),
  consumerDirectory: consumer,
  lock: {path: join(runDirectory, "consumer-package-lock.json"), sha256: hash(lockBytes)},
  ssr: ssrReport,
  browser: {version: browserVersion, errors: browserErrors, screenshot: join(runDirectory, "framework-consumer.png")},
  environment: {node: process.version, npm: run(["npm", "--version"], consumer).trim(), typescript: "7.0.2", vite: "8.2.2", chromium: browserVersion, os: platform(), release: release(), arch: arch()},
}, null, 2) + "\n");
console.log(`Installed framework consumer proof passed. Evidence: ${join(runDirectory, "report.json")}`);

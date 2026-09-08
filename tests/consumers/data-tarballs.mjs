/**
 * Build and consume the data family from real package tarballs.
 *
 * The consumer lives outside the pnpm workspace. It installs the packed
 * @aeliqo/core, @aeliqo/web and @aeliqo/react artifacts, checks every data
 * entry point and declaration surface, then exercises data SSR and the
 * browser-owned decimal, delta, filter and virtual-grid behavior.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createServer} from "node:http";
import {access, mkdir, mkdtemp, readFile, readdir, realpath, lstat, unlink, rmdir, writeFile} from "node:fs/promises";
import {tmpdir, platform, release, arch} from "node:os";
import {extname, join, resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {chromium} from "@playwright/test";

const root = resolve(import.meta.dirname, "../..");
const output = join(root, "artifacts/data-consumers");
await mkdir(output, {recursive: true});
const runDirectory = await mkdtemp(join(output, "run-"));
const consumer = await mkdtemp(join(tmpdir(), "aeliqo-data-consumer-"));
const consumerReal = await realpath(consumer);

function run(argv, cwd, encoding = "utf8") {
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd,
    encoding,
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${argv.join(" ")} failed: ${result.error ?? ""}\n${String(result.stdout ?? "").slice(-12000)}\n${String(result.stderr ?? "").slice(-12000)}`);
  }
  return result.stdout;
}

const hash = (bytes, algorithm = "sha256", encoding = "hex") => createHash(algorithm).update(bytes).digest(encoding);
const fileExists = async path => {
  try { await access(path); return true; }
  catch (error) { if (error?.code === "ENOENT") return false; throw error; }
};

// Only compiler output is removable. An unexpected source file or symlink
// means the proof must stop instead of silently masking a dirty package.
async function clearCompiledOutput(directory) {
  let entries;
  try { entries = await readdir(directory); }
  catch (error) { if (error?.code === "ENOENT") return; throw error; }
  for (const name of entries) {
    const path = join(directory, name);
    const stat = await lstat(path);
    assert(!stat.isSymbolicLink(), `Refuse build-output symlink: ${path}`);
    if (stat.isDirectory()) {
      await clearCompiledOutput(path);
      await rmdir(path);
    } else {
      assert(stat.isFile() && /(?:\.js|\.d\.ts|\.js\.map|\.d\.ts\.map|\.tsbuildinfo)$/.test(name), `Unexpected build output: ${path}`);
      await unlink(path);
    }
  }
}

const sourceDigest = () => run(["python3", "scripts/gate.py", "digest"], root).trim();
assert.match(process.version, /^v24\./, `Node 24 is required; received ${process.version}`);
const before = sourceDigest();
const packageNames = ["core", "web", "react"];
const artifacts = [];
for (const name of packageNames) {
  const directory = join(root, "packages", name);
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
  assert.equal(manifest.name, `@aeliqo/${name}`);
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.license, "Apache-2.0");
  assert.notEqual(manifest.private, true);
  await clearCompiledOutput(join(directory, "dist"));
  run(["pnpm", "build"], directory);
  const tarball = join(runDirectory, `aeliqo-${name}-0.1.0.tgz`);
  run(["pnpm", "pack", "--out", tarball], directory);
  const bytes = await readFile(tarball);
  const packed = JSON.parse(run(["tar", "-xOf", tarball, "package/package.json"], root));
  assert.deepEqual(packed.exports, manifest.exports, `${name} exports changed while packing`);
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, manifest.version);
  assert.equal(packed.license, "Apache-2.0");
  for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
    assert(!JSON.stringify(packed[field] ?? {}).includes("workspace:"), `${name} has a workspace dependency in ${field}`);
  }
  const entries = run(["tar", "-tzf", tarball], root).trim().split("\n");
  assert(entries.includes("package/LICENSE"), `${name} tarball has no license`);
  assert(!entries.some(entry => entry.startsWith("package/src/")), `${name} tarball leaked source files`);
  assert(!entries.some(entry => entry.startsWith("package/node_modules/")), `${name} tarball contains dependencies`);
  for (const entry of entries) assert(entry.startsWith("package/") && !entry.split("/").includes(".."), `Unsafe archive path: ${entry}`);
  artifacts.push({name: packed.name, version: packed.version, path: tarball, bytes,
    sha256: hash(bytes), integrity: `sha512-${hash(bytes, "sha512", "base64")}`, entries});
}

await writeFile(join(consumer, "package.json"), JSON.stringify({private: true, type: "module"}) + "\n");
run(["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact",
  ...artifacts.map(item => item.path),
  "react@19.2.8", "react-dom@19.2.8", "@types/react@19.2.18", "@types/react-dom@19.2.7",
  "typescript@7.0.2", "vite@8.2.2", "@playwright/test@1.63.0", "@types/node@24.13.3"], consumer);
const lockBytes = await readFile(join(consumer, "package-lock.json"));
const lock = JSON.parse(lockBytes);
for (const [name, version] of Object.entries({react: "19.2.8", "react-dom": "19.2.8", typescript: "7.0.2", vite: "8.2.2", "@playwright/test": "1.63.0"})) {
  assert.equal(lock.packages[`node_modules/${name}`].version, version);
  assert.match(lock.packages[`node_modules/${name}`].integrity, /^sha512-/);
}
for (const artifact of artifacts) {
  const location = `node_modules/${artifact.name}`;
  assert.equal(lock.packages[location].version, artifact.version);
  assert.equal(lock.packages[location].integrity, artifact.integrity);
  assert.deepEqual(Object.keys(lock.packages).filter(key => key.endsWith(location)), [location], `Duplicate ${artifact.name}`);
  for (const entry of artifact.entries) {
    if (entry.endsWith("/")) continue;
    const installed = join(consumer, location, entry.slice("package/".length));
    const stat = await lstat(installed);
    assert(stat.isFile() && !stat.isSymbolicLink(), `Installed ${artifact.name} entry is not a regular file: ${entry}`);
    assert.equal(hash(await readFile(installed)), hash(run(["tar", "-xOf", artifact.path, entry], root, null)), `Installed ${artifact.name} bytes differ for ${entry}`);
  }
}
assert.equal(lock.packages["node_modules/@aeliqo/web"].dependencies["@aeliqo/core"], "0.1.0");
assert.equal(lock.packages["node_modules/@aeliqo/react"].dependencies["@aeliqo/web"], "0.1.0");
assert.deepEqual(Object.keys(lock.packages).filter(key => key.startsWith("node_modules/@aeliqo/web/node_modules/")), []);
assert.deepEqual(Object.keys(lock.packages).filter(key => key.startsWith("node_modules/@aeliqo/react/node_modules/")), []);
await writeFile(join(runDirectory, "consumer-package-lock.json"), lockBytes);

const webSubpaths = ["data", "metric", "delta", "key-value", "detail", "record-list", "card-collection", "selection-summary", "filter-builder", "table", "register", "server"];
const webSpecifiers = ["@aeliqo/web", ...webSubpaths.map(path => `@aeliqo/web/${path}`)];
const reactSpecifiers = ["@aeliqo/react", "@aeliqo/react/data"];
const resolutionEntry = join(consumer, "resolve-data.mjs");
await writeFile(resolutionEntry, `
import {fileURLToPath} from 'node:url';
import {realpath} from 'node:fs/promises';
const specs = ${JSON.stringify([...webSpecifiers, ...reactSpecifiers])};
const resolved = {};
for (const spec of specs) {
  const url = await import.meta.resolve(spec);
  const path = await realpath(fileURLToPath(url));
  if (!path.startsWith(${JSON.stringify(join(consumerReal, "node_modules"))} + '/')) throw new Error(spec + ' escaped installed node_modules: ' + path);
  await import(spec);
  resolved[spec] = path;
}
console.log(JSON.stringify(resolved));
`);
const resolved = JSON.parse(run(["node", resolutionEntry], consumer).trim().split("\n").at(-1));
for (const spec of [...webSpecifiers, ...reactSpecifiers]) assert(resolved[spec].startsWith(join(consumerReal, "node_modules") + "/"), `${spec} did not resolve from the temp consumer`);

await writeFile(join(consumer, "consumer.tsx"), `
import React from 'react';
import {AeliqoMetric, AeliqoDelta, AeliqoKeyValue, AeliqoDetail, AeliqoRecordList, AeliqoCardCollection, AeliqoSelectionSummary, AeliqoFilterBuilder, AeliqoTable} from '@aeliqo/react/data';
import {AeliqoTable as MainTable} from '@aeliqo/react';
import {AeliqoMetricElement} from '@aeliqo/web/metric';
import {AeliqoDeltaElement, calculateAeliqoDelta} from '@aeliqo/web/delta';
import {AeliqoKeyValueElement} from '@aeliqo/web/key-value';
import {AeliqoDetailElement} from '@aeliqo/web/detail';
import {AeliqoRecordListElement} from '@aeliqo/web/record-list';
import {AeliqoCardCollectionElement} from '@aeliqo/web/card-collection';
import {AeliqoSelectionSummaryElement} from '@aeliqo/web/selection-summary';
import {AeliqoFilterBuilderElement} from '@aeliqo/web/filter-builder';
import {AeliqoTableElement, AELIQO_TABLE_MAX_VIRTUAL_ROWS} from '@aeliqo/web/data';
import type {AeliqoDataScope, AeliqoFilterChangeDetail, AeliqoTableRow, AeliqoTableWindowDetail} from '@aeliqo/web/data';

const rows = [
  {id: 'a', name: 'Ada', amount: {decimal: '100000000000000000.01'}},
  {id: 'b', name: 'Lin', amount: {decimal: '2.50'}},
] as const satisfies readonly AeliqoTableRow[];
const columns = [{key: 'id', label: 'ID'}, {key: 'name', label: 'Name'}, {key: 'amount', label: 'Amount'}] as const;
const scope: AeliqoDataScope = {loaded: 2, filteredTotal: 2, kind: 'filtered'};
const delta = calculateAeliqoDelta({decimal: '0.0001'}, {decimal: '0'}, 'percentage-point');
if (delta.status !== 'ready') throw new Error('delta unexpectedly unavailable');
const dataElements: readonly [typeof AeliqoMetricElement, typeof AeliqoDeltaElement, typeof AeliqoKeyValueElement, typeof AeliqoDetailElement, typeof AeliqoRecordListElement, typeof AeliqoCardCollectionElement, typeof AeliqoSelectionSummaryElement, typeof AeliqoFilterBuilderElement, typeof AeliqoTableElement] = [AeliqoMetricElement, AeliqoDeltaElement, AeliqoKeyValueElement, AeliqoDetailElement, AeliqoRecordListElement, AeliqoCardCollectionElement, AeliqoSelectionSummaryElement, AeliqoFilterBuilderElement, AeliqoTableElement];
void dataElements;
const handleWindow = (event: CustomEvent<AeliqoTableWindowDetail>) => { const start: number = event.detail.start; const reason: 'keyboard' = event.detail.reason; void [start, reason]; };
const handleFilter = (event: CustomEvent<AeliqoFilterChangeDetail>) => { const applied: true = event.detail.applied; void applied; };
const app = <>
  <AeliqoMetric label='Revenue' value={rows[0].amount} unit='USD' scope={scope} />
  <AeliqoDelta label='Rate' current={{decimal: '0.0001'}} baseline={{decimal: '0'}} mode='percentage-point' />
  <AeliqoKeyValue items={[{key: 'owner', label: 'Owner', value: 'Ada'}]} />
  <AeliqoDetail fields={columns} identity={['id']} record={rows[0]} />
  <AeliqoRecordList columns={columns} rows={rows} identity={['id']} onSelectionChange={event => { const keys: readonly string[] = event.detail.keys; void keys; }} onLoadMore={() => undefined} />
  <AeliqoCardCollection columns={columns} rows={rows} identity={['id']} onSelectionChange={event => { const mode: 'clear' | 'ids' = event.detail.mode; void mode; }} onLoadMore={() => undefined} />
  <AeliqoSelectionSummary entity='person' selectedKeys={['string:1:a']} onClear={event => { const mode: 'clear' | 'ids' = event.detail.mode; void mode; }} />
  <AeliqoFilterBuilder fields={[{id: 'name', label: 'Name', type: 'text'}]} onFilterChange={handleFilter} />
  <AeliqoTable columns={columns} rows={rows} identity={['id']} mode='grid' virtualized virtualCount={1} overscan={0} onSelectionChange={event => { const mode: 'clear' | 'ids' = event.detail.mode; void mode; }} onSortChange={event => { const field: string | undefined = event.detail.sort?.field; void field; }} onPageChange={event => { const page: number = event.detail.page; void page; }} onWindowChange={handleWindow} />
  <MainTable columns={columns} rows={rows} identity={['id']} />
</>;
void app;
const element = new AeliqoTableElement(); element.columns = columns; element.rows = rows; element.identity = ['id']; element.virtualized = true; element.virtualCount = AELIQO_TABLE_MAX_VIRTUAL_ROWS;
void element;
`);
await writeFile(join(consumer, "tsconfig.json"), JSON.stringify({compilerOptions: {
  target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true,
  jsx: "react-jsx", exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true,
  skipLibCheck: false, lib: ["ES2022", "DOM", "DOM.Iterable"], noEmit: true, types: ["react", "node"],
}, files: ["consumer.tsx"]}, null, 2) + "\n");
run([join(consumer, "node_modules/.bin/tsc"), "--project", "tsconfig.json"], consumer);

await writeFile(join(consumer, "ssr.mjs"), `
import assert from 'node:assert/strict';
import '@aeliqo/react/ssr';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import {html} from 'lit';
import {renderAeliqo} from '@aeliqo/web/server';
import {AeliqoMetricElement, AeliqoDeltaElement, AeliqoKeyValueElement, AeliqoDetailElement, AeliqoRecordListElement, AeliqoCardCollectionElement, AeliqoSelectionSummaryElement, AeliqoFilterBuilderElement, AeliqoTableElement} from '@aeliqo/web/data';
import {AeliqoTable, AeliqoDelta} from '@aeliqo/react/data';
assert.equal(typeof globalThis.window, 'undefined');
assert.equal(typeof globalThis.document, 'undefined');
const definitions = [['aeliqo-metric', AeliqoMetricElement], ['aeliqo-delta', AeliqoDeltaElement], ['aeliqo-key-value', AeliqoKeyValueElement], ['aeliqo-detail', AeliqoDetailElement], ['aeliqo-record-list', AeliqoRecordListElement], ['aeliqo-card-collection', AeliqoCardCollectionElement], ['aeliqo-selection-summary', AeliqoSelectionSummaryElement], ['aeliqo-filter-builder', AeliqoFilterBuilderElement], ['aeliqo-table', AeliqoTableElement]];
for (const [tag, constructor] of definitions) if (!customElements.get(tag)) customElements.define(tag, constructor);
const rows = [{id: 'a', name: 'Ada', amount: {decimal: '100000000000000000.01'}}, {id: 'b', name: 'Lin', amount: {decimal: '2.50'}}];
const columns = [{key: 'id', label: 'ID'}, {key: 'name', label: 'Name'}, {key: 'amount', label: 'Amount'}];
const webMarkup = await renderAeliqo(html\`<aeliqo-table caption="SSR people" .columns=\${columns} .rows=\${rows} .identity=\${['id']}></aeliqo-table><aeliqo-delta label="SSR delta" .current=\${{decimal: '0.0001'}} .baseline=\${{decimal: '0'}} mode="percentage-point"></aeliqo-delta>\`);
assert.match(webMarkup, /shadowrootmode="open"/);
assert.match(webMarkup, /100000000000000000\.01/);
assert.match(webMarkup, /\+0\.01 pp/);
const reactMarkup = renderToString(createElement(AeliqoTable, {caption: 'React SSR people', columns, rows, identity: ['id']}));
assert.match(reactMarkup, /aeliqo-table/);
assert.match(reactMarkup, /shadowrootmode="open"/);
assert.match(reactMarkup, /100000000000000000\.01/);
const reactDelta = renderToString(createElement(AeliqoDelta, {label: 'React SSR delta', current: {decimal: '0.0001'}, baseline: {decimal: '0'}, mode: 'percentage-point'}));
assert.match(reactDelta, /\+0\.01 pp/);
const secondRequest = renderToString(createElement(AeliqoDelta, {label: 'Second request', current: {decimal: '1'}, baseline: {decimal: '0'}, mode: 'absolute'}));
assert(!secondRequest.includes('SSR people'));
console.log(JSON.stringify({webBytes: webMarkup.length, reactBytes: reactMarkup.length + reactDelta.length + secondRequest.length}));
`);
const ssrOutput = run(["node", join(consumer, "ssr.mjs")], consumer).trim();

await writeFile(join(consumer, "browser-entry.ts"), `
import {AeliqoTableElement, AeliqoDeltaElement, AeliqoFilterBuilderElement} from '@aeliqo/web/data';
const definitions = [['aeliqo-table', AeliqoTableElement], ['aeliqo-delta', AeliqoDeltaElement], ['aeliqo-filter-builder', AeliqoFilterBuilderElement]];
for (const [tag, constructor] of definitions) if (!customElements.get(tag)) customElements.define(tag, constructor);
const fixture = document.querySelector('#fixture');
if (!fixture) throw new Error('data fixture root missing');
const rows = [
  {id: 'a', name: 'Ada', amount: {decimal: '100000000000000000.01'}},
  {id: 'b', name: 'Lin', amount: {decimal: '2.50'}},
  {id: 'c', name: 'Grace', amount: {decimal: '3.00'}},
];
const columns = [{key: 'id', label: 'ID'}, {key: 'name', label: 'Name'}, {key: 'amount', label: 'Amount'}];
const table = new AeliqoTableElement(); table.id = 'table'; table.caption = 'People'; table.columns = columns; table.rows = rows; table.identity = ['id']; table.totalRows = 3; table.scope = {loaded: 3, filteredTotal: 3, kind: 'filtered'}; fixture.append(table);
const delta = new AeliqoDeltaElement(); delta.id = 'delta'; delta.label = 'Change'; delta.current = {decimal: '0.0001'}; delta.baseline = {decimal: '0'}; delta.mode = 'percentage-point'; fixture.append(delta);
const filter = new AeliqoFilterBuilderElement(); filter.id = 'filter'; filter.fields = [{id: 'name', label: 'Name', type: 'text'}]; fixture.append(filter);
const grid = new AeliqoTableElement(); grid.id = 'grid'; grid.caption = 'Window'; grid.mode = 'grid'; grid.columns = columns; grid.rows = rows; grid.identity = ['id']; grid.virtualized = true; grid.virtualStart = 0; grid.virtualCount = 1; grid.overscan = 0; grid.totalRows = 3; grid.scope = {loaded: 3, filteredTotal: 3, kind: 'filtered'}; fixture.append(grid);
const windowRequests = []; const filterEvents = [];
grid.addEventListener('aeliqo-table-window', event => { const detail = event.detail; windowRequests.push({...detail}); grid.virtualStart = detail.start; });
filter.addEventListener('aeliqo-filter-change', event => filterEvents.push({...event.detail}));
const ready = Promise.all([table.updateComplete, delta.updateComplete, filter.updateComplete, grid.updateComplete]);
Object.assign(window, {dataFixture: {table, delta, filter, grid, windowRequests, filterEvents, ready}});
`);
await writeFile(join(consumer, "index.html"), "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>Installed Aeliqo data</title></head><body><main id=\"fixture\"></main><script type=\"module\" src=\"/browser-entry.js\"></script></body></html>\n");
await writeFile(join(consumer, "vite.config.mjs"), "export default {build: {outDir: 'dist'}};\n");
run([join(consumer, "node_modules/.bin/vite"), "build"], consumer);

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const path = resolve(consumer, "dist", pathname === "/" ? "index.html" : `.${pathname}`);
    if (!path.startsWith(join(consumer, "dist") + "/")) { response.writeHead(403).end(); return; }
    response.setHeader("Content-Type", ({".js": "text/javascript", ".html": "text/html", ".css": "text/css"})[extname(path)] ?? "application/octet-stream");
    response.end(await readFile(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolveServer => server.listen(0, "127.0.0.1", resolveServer));
let browser;
let browserVersion;
const browserReport = {};
const failures = [];
try {
  browser = await chromium.launch();
  browserVersion = browser.version();
  const page = await browser.newPage({viewport: {width: 1280, height: 900}, locale: "en-US", deviceScaleFactor: 1});
  page.on("pageerror", error => failures.push(error.message));
  page.on("console", message => { if (message.type() === "error") failures.push(message.text()); });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => Boolean(window.dataFixture));
  await page.evaluate(() => window.dataFixture.ready);
  const exact = await page.evaluate(() => {
    const f = window.dataFixture;
    return {
      decimal: f.table.shadowRoot.querySelector('td:last-child')?.textContent?.trim(),
      delta: f.delta.shadowRoot.querySelector('[part=number]')?.textContent?.trim(),
      fieldTag: f.filter.shadowRoot.querySelector('[part=value]')?.tagName,
      applyType: f.filter.shadowRoot.querySelector('[part=apply]')?.getAttribute('type'),
    };
  });
  assert.equal(exact.decimal, "100000000000000000.01");
  assert.equal(exact.delta, "+0.01 pp");
  assert.equal(exact.fieldTag, "INPUT");
  assert.equal(exact.applyType, "submit");
  const filterResult = await page.evaluate(async () => {
    const f = window.dataFixture;
    const input = f.filter.shadowRoot.querySelector('[part=value]');
    input.value = 'Ada';
    input.dispatchEvent(new InputEvent('input', {bubbles: true, inputType: 'insertText', data: 'Ada'}));
    await f.filter.updateComplete;
    const beforeApply = f.filterEvents.length;
    f.filter.shadowRoot.querySelector('[part=apply]').click();
    await f.filter.updateComplete;
    return {beforeApply, event: f.filterEvents.at(-1)};
  });
  assert.equal(filterResult.beforeApply, 0, "filter typing emitted before Apply");
  assert.deepEqual(filterResult.event.predicate, {op: "compare", field: "name", comparison: "eq", value: "Ada"});
  const firstCell = page.locator("#grid").locator("[role=gridcell][data-row-index='0'][data-col-index='0']");
  await firstCell.focus();
  await page.keyboard.press("ArrowDown");
  await page.waitForFunction(() => window.dataFixture.windowRequests.length === 1 && window.dataFixture.grid.shadowRoot.activeElement?.getAttribute('data-row-index') === '1');
  const windowResult = await page.evaluate(() => ({request: window.dataFixture.windowRequests[0], row: window.dataFixture.grid.shadowRoot.activeElement?.getAttribute('data-row-index'), column: window.dataFixture.grid.shadowRoot.activeElement?.getAttribute('data-col-index')}));
  assert.deepEqual(windowResult.request, {start: 1, count: 1, overscan: 0, row: 1, column: 0, reason: "keyboard"});
  assert.deepEqual({row: windowResult.row, column: windowResult.column}, {row: "1", column: "0"});
  browserReport.exact = exact;
  browserReport.filter = filterResult;
  browserReport.window = windowResult;
  browserReport.failures = failures;
  await page.screenshot({path: join(runDirectory, "installed-data.png"), fullPage: true});
  assert.deepEqual(failures, []);
} finally {
  await browser?.close();
  await new Promise(resolveServer => server.close(resolveServer));
}

assert.equal(sourceDigest(), before, "Source changed during data tarball consumer proof");
await writeFile(join(runDirectory, "report.json"), JSON.stringify({
  sourceDigest: before, sourceChangedDuringRun: false,
  scope: "Installed @aeliqo/core, @aeliqo/web data entry points and @aeliqo/react data wrappers from actual tarballs; strict TypeScript; Lit/React SSR; Chromium exact decimal and percentage-point rendering, host-controlled virtual-grid keyboard window echo/focus, and native filter Apply behavior.",
  artifacts: artifacts.map(({bytes, entries, ...item}) => item), consumerDirectory: consumer,
  consumerLock: {path: join(runDirectory, "consumer-package-lock.json"), sha256: hash(lockBytes)},
  resolution: resolved, ssr: ssrOutput,
  screenshot: {path: join(runDirectory, "installed-data.png"), sha256: hash(await readFile(join(runDirectory, "installed-data.png")))},
  browser: browserReport,
  environment: {node: process.version, npm: run(["npm", "--version"], consumer).trim(), pnpm: run(["pnpm", "--version"], root).trim(), typescript: "7.0.2", vite: "8.2.2", playwright: "1.63.0", chromium: browserVersion, os: platform(), release: release(), arch: arch(), viewport: {width: 1280, height: 900}, locale: "en-US", deviceScaleFactor: 1},
  passed: true,
}, null, 2) + "\n");
console.log(`Evidence: ${join(runDirectory, "report.json")}`);

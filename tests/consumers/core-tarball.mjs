/**
 * Build and consume the actual @aeliqo/core package outside the workspace.
 *
 * This is a bounded T03 package-boundary check. It proves the four public
 * document parsers, generated schema files, the installed package graph and a
 * small parser bundle. It does not certify the planner, the complete product,
 * universal browser performance, or a universal secret/code scanner.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  readdir,
  lstat,
  unlink,
  rmdir,
  writeFile,
} from "node:fs/promises";
import {tmpdir, platform, release, arch} from "node:os";
import {dirname, extname, join, relative, resolve} from "node:path";
import {spawnSync} from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const coreDirectory = join(root, "packages", "core");
const outputDirectory = join(root, "artifacts", "core-consumers");
await mkdir(outputDirectory, {recursive: true});
const runDirectory = await mkdtemp(join(outputDirectory, "run-"));
const consumerDirectory = await mkdtemp(join(tmpdir(), "aeliqo-core-consumer-"));

function run(argv, cwd, encoding = "utf8", env = process.env) {
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd,
    encoding,
    env,
    timeout: 180_000,
  });
  if (result.error || result.status !== 0) {
    const stdout = result.stdout == null ? "" : String(result.stdout);
    const stderr = result.stderr == null ? "" : String(result.stderr);
    throw new Error(`${argv.join(" ")} failed: ${result.error ?? ""}\n${stdout}\n${stderr}`);
  }
  return result.stdout;
}

const hash = (bytes, algorithm = "sha256", encoding = "hex") =>
  createHash(algorithm).update(bytes).digest(encoding);

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function sortedFiles(directory, excluded = new Set()) {
  const result = [];
  async function visit(current) {
    const entries = await readdir(current, {withFileTypes: true});
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (excluded.has(entry.name)) continue;
      const path = join(current, entry.name);
      const stat = await lstat(path);
      assert(!stat.isSymbolicLink(), `Refuse symlink in package source: ${path}`);
      if (stat.isDirectory()) await visit(path);
      else if (stat.isFile()) result.push(path);
    }
  }
  await visit(directory);
  return result;
}

async function sourceDigest() {
  // The assigned worktree intentionally symlinks packages/core to the parent
  // worktree. Resolve that one approved link and hash only source/config files;
  // generated dist/schemas and dependency trees are excluded.
  const {realpath} = await import("node:fs/promises");
  const actualCore = await realpath(coreDirectory);
  const files = await sortedFiles(actualCore, new Set(["node_modules", "dist", "schemas"]));
  const h = createHash("sha256");
  for (const path of files) {
    const name = relative(actualCore, path).split("\\").join("/");
    h.update(name).update("\0").update(await readFile(path));
  }
  return h.digest("hex");
}

async function clearCompiledOutput(directory, allowedPattern) {
  if (!(await fileExists(directory))) return;
  const entries = await readdir(directory);
  for (const name of entries) {
    const path = join(directory, name);
    const stat = await lstat(path);
    assert(!stat.isSymbolicLink(), `Refuse generated-output symlink: ${path}`);
    if (stat.isDirectory()) {
      await clearCompiledOutput(path, allowedPattern);
      await rmdir(path);
    } else {
      assert(stat.isFile() && allowedPattern.test(name), `Unexpected generated output: ${path}`);
      await unlink(path);
    }
  }
}

const sourceBefore = await sourceDigest();
const manifest = JSON.parse(await readFile(join(coreDirectory, "package.json"), "utf8"));
assert.equal(manifest.name, "@aeliqo/core");
assert.equal(manifest.version, "0.1.0");
assert.equal(manifest.license, "Apache-2.0");
assert.notEqual(manifest.private, true);
assert.equal(manifest.dependencies?.zod, "4.5.4");
assert.deepEqual(Object.keys(manifest.dependencies ?? {}), ["zod"]);
assert.deepEqual(Object.keys(manifest.peerDependencies ?? {}), []);
assert.deepEqual(Object.keys(manifest.optionalDependencies ?? {}), []);
assert.equal(manifest.exports?.["./schema"]?.import, "./dist/contracts/schemas.js");
assert.equal(typeof manifest.exports?.["./schemas/*"], "string");
assert.equal(manifest.exports?.["."].import, "./dist/index.js");
assert.equal(manifest.exports?.["."].types, "./dist/index.d.ts");
assert(await fileExists(join(coreDirectory, "src")), "Core source is not ready; no PASS from a scaffold");

const distDirectory = join(coreDirectory, "dist");
const schemaDirectory = join(coreDirectory, "schemas");
await clearCompiledOutput(distDirectory, /(?:\.js|\.d\.ts|\.js\.map|\.d\.ts\.map|\.tsbuildinfo)$/);
await clearCompiledOutput(schemaDirectory, /\.schema\.json$/);
run(["pnpm", "build"], coreDirectory);

const expectedSchemas = ["catalog", "task", "result", "experience", "expression", "query",
  "interaction", "result-event", "environment", "presentation-plan", "task-proposal",
  "meaning-draft", "binding-outcome", "model-evaluation"];
for (const name of expectedSchemas) {
  const schemaPath = join(schemaDirectory, `${name}.schema.json`);
  assert(await fileExists(schemaPath), `Missing generated schema: ${schemaPath}`);
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  assert.equal(typeof schema, "object");
}

const tarballPath = join(runDirectory, "aeliqo-core-0.1.0.tgz");
run(["pnpm", "pack", "--out", tarballPath], coreDirectory);
const tarballBytes = await readFile(tarballPath);
const tarballSha256 = hash(tarballBytes);
const tarballIntegrity = `sha512-${hash(tarballBytes, "sha512", "base64")}`;
const packedManifest = JSON.parse(run(["tar", "-xOf", tarballPath, "package/package.json"], root));
assert.deepEqual(packedManifest, manifest);
assert.equal(packedManifest.name, "@aeliqo/core");
assert.equal(packedManifest.version, "0.1.0");
assert.equal(packedManifest.license, "Apache-2.0");
for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
  assert(!JSON.stringify(packedManifest[field] ?? {}).includes("workspace:"), `Workspace alias in ${field}`);
}
assert.deepEqual(Object.keys(packedManifest.dependencies ?? {}), ["zod"]);
assert.equal(packedManifest.dependencies.zod, "4.5.4");

const tarEntries = run(["tar", "-tzf", tarballPath], root).trim().split("\n");
for (const entry of tarEntries) {
  assert(entry.startsWith("package/") && !entry.split("/").includes(".."), `Unexpected archive path: ${entry}`);
}
assert(tarEntries.includes("package/LICENSE"), "Apache license is absent from the tarball");
for (const name of expectedSchemas) {
  assert(tarEntries.includes(`package/schemas/${name}.schema.json`), `Schema is absent from tarball: ${name}`);
}
assert(!tarEntries.some((entry) => entry.startsWith("package/src/")), "Source tree leaked into package");

await writeFile(join(consumerDirectory, "package.json"), JSON.stringify({private: true, type: "module"}));
run([
  "npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", "--save-exact",
  tarballPath, "typescript@7.0.2", "vite@8.2.2",
], consumerDirectory);
const lockBytes = await readFile(join(consumerDirectory, "package-lock.json"));
const lock = JSON.parse(lockBytes);
const coreLock = lock.packages["node_modules/@aeliqo/core"];
assert.equal(coreLock.version, "0.1.0");
assert.equal(coreLock.integrity, tarballIntegrity);
const corePackageEntries = Object.keys(lock.packages).filter((key) => /(?:^|\/)node_modules\/@aeliqo\/core$/.test(key));
assert.deepEqual(corePackageEntries, ["node_modules/@aeliqo/core"], "Expected exactly one installed @aeliqo/core package");
assert.equal(lock.packages["node_modules/zod"].version, "4.5.4");
assert.match(lock.packages["node_modules/zod"].integrity, /^sha512-/);
const installedZod = JSON.parse(await readFile(join(consumerDirectory, "node_modules/zod/package.json"), "utf8"));
assert.equal(installedZod.license, "MIT");
for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
  assert.deepEqual(Object.keys(installedZod[field] ?? {}), [], `Unexpected Zod ${field}`);
}
for (const [name, version] of Object.entries({typescript: "7.0.2", vite: "8.2.2"})) {
  assert.equal(lock.packages[`node_modules/${name}`].version, version);
  assert.match(lock.packages[`node_modules/${name}`].integrity, /^sha512-/);
}
assert.deepEqual(
  Object.keys(lock.packages).filter((key) => key.startsWith("node_modules/@aeliqo/core/node_modules/")),
  [],
  "Core has unexpected nested production dependencies",
);

for (const entry of tarEntries) {
  if (entry.endsWith("/")) continue;
  const relativeEntry = entry.slice("package/".length);
  const installedPath = join(consumerDirectory, "node_modules/@aeliqo/core", relativeEntry);
  const installedStat = await lstat(installedPath);
  assert(installedStat.isFile(), `Installed package entry is not a regular file: ${relativeEntry}`);
  const packedEntry = run(["tar", "-xOf", tarballPath, entry], root, null);
  assert.equal(hash(await readFile(installedPath)), hash(packedEntry), `Installed bytes differ: ${relativeEntry}`);
}
await writeFile(join(runDirectory, "consumer-package-lock.json"), lockBytes);

const catalogInput = {
  version: "1",
  revision: "catalog-1",
  functionRegistryDigest: "functions-1",
  entities: [{
    id: "employee",
    label: "Employee",
    identity: ["employee.id"],
    rowGrain: ["employee"],
    fields: [{
      id: "employee.id",
      label: "Employee ID",
      type: {value: "text", nullable: false},
      role: "identity",
    }],
  }],
  relationships: [],
  meanings: [],
  capabilities: [],
};
const resultInput = {
  version: "1",
  ref: {id: "result-1", revision: "1", outputId: "table", queryDigest: "query-1", scopeDigest: "scope-1"},
  taskId: "task-1",
  fields: [],
  identity: [],
  rowGrain: [],
  counts: {loaded: 0, population: {kind: "unknown"}},
  precision: {kind: "exact"},
  coverage: {kind: "unknown", reason: "No rows were loaded."},
  consistency: {kind: "unknown", reason: "No source snapshot was requested."},
  evidence: {kind: "computed", queryDigest: "query-1", definitions: []},
  filters: [],
  warnings: [],
  lineage: [],
};
const taskInput = {
  version: "1",
  id: "task-1",
  revision: "1",
  catalogRevision: "catalog-1",
  functionRegistryDigest: "functions-1",
  regionId: "employees",
  goal: "Inspect employees",
  needs: [],
  assumptions: [],
  kind: "presentation",
  inputs: [resultInput.ref],
};
const experienceInput = {
  version: "1",
  id: "experience-1",
  revision: "1",
  mode: "adaptive",
  agentAllowed: false,
  allowedRepresentations: [],
  allowedPatterns: [],
  composition: {allowWithoutPreset: false, maxNodes: 1, maxExpansions: 1},
  requiredOperations: [],
  tokenProfile: {id: "tokens-1", revision: "1"},
  extensionAllowlist: [],
  transitionPolicy: "stable",
};
const documents = {catalog: catalogInput, task: taskInput, result: resultInput, experience: experienceInput};

await writeFile(join(consumerDirectory, "consumer-types.ts"), `
import {parseCatalog, parseTask, parseResult, parseExperience, parseContract, serializeContract} from '@aeliqo/core';
import type {Catalog, Task, Result, Experience, Outcome} from '@aeliqo/core';
declare const catalog: Catalog;
declare const task: Task;
declare const result: Result;
declare const experience: Experience;
function unwrap<T>(outcome: Outcome<T>): T {
  if (!outcome.ok) throw new Error('unreachable in type-only consumer fixture');
  return outcome.value;
}
const typedCatalog: Catalog = unwrap(parseCatalog({}));
const typedTask: Task = unwrap(parseTask({}));
const typedResult: Result = unwrap(parseResult({}));
const typedExperience: Experience = unwrap(parseExperience({}));
void [catalog, task, result, experience, typedCatalog, typedTask, typedResult, typedExperience];
void parseContract('catalog', catalog);
void parseContract('task', task);
void parseContract('result', result);
void parseContract('experience', experience);
void serializeContract('catalog', catalog);
void serializeContract('task', task);
void serializeContract('result', result);
void serializeContract('experience', experience);
`);
await writeFile(join(consumerDirectory, "tsconfig.json"), JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    noEmit: true,
    skipLibCheck: false,
  },
  files: ["consumer-types.ts"],
}));
run([join(consumerDirectory, "node_modules/.bin/tsc"), "--project", "tsconfig.json"], consumerDirectory);

const fixtureSource = JSON.stringify(documents);
await writeFile(join(consumerDirectory, "consumer.mjs"), `
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {parseCatalog, parseTask, parseResult, parseExperience, parseContract, serializeContract} from '@aeliqo/core';
const documents = ${fixtureSource};
function unwrap(outcome) {
  assert.equal(outcome.ok, true);
  return outcome.value;
}
const direct = {
  catalog: unwrap(parseCatalog(documents.catalog)),
  task: unwrap(parseTask(documents.task)),
  result: unwrap(parseResult(documents.result)),
  experience: unwrap(parseExperience(documents.experience)),
};
for (const [kind, input] of Object.entries(documents)) {
  const parsed = parseContract(kind, input);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, direct[kind]);
  const encoded = serializeContract(kind, direct[kind]);
  assert.equal(encoded.ok, true);
  const wire = JSON.parse(encoded.value);
  const reparsed = parseContract(kind, wire);
  assert.equal(reparsed.ok, true);
  assert.deepEqual(reparsed.value, direct[kind]);
  assert.notEqual(JSON.stringify(wire), undefined);
}
assert.equal(parseCatalog({...documents.catalog, unexpected: true}).ok, false);
assert.equal(parseContract('task', {...documents.task, unexpected: true}).ok, false);
const require = createRequire(import.meta.url);
for (const name of ${JSON.stringify(expectedSchemas)}) {
  const path = require.resolve('@aeliqo/core/schemas/' + name + '.schema.json');
  const schema = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(typeof schema, 'object');
}
const runtimeSchema = await import('@aeliqo/core/schema');
assert(Object.keys(runtimeSchema).length > 0);
console.log('Installed @aeliqo/core parsers, schema exports, and round trips pass.');
`);
const consumerOutput = run([process.execPath, "consumer.mjs"], consumerDirectory);
const parserProbe = join(consumerDirectory, "no-codegen.mjs");
await writeFile(parserProbe, `
import assert from 'node:assert/strict';
globalThis.Function = () => { throw new Error('Function constructor used by core parser'); };
globalThis.eval = () => { throw new Error('eval used by core parser'); };
const core = await import('@aeliqo/core');
const documents = ${fixtureSource};
assert.equal(core.parseCatalog(documents.catalog).ok, true);
assert.equal(core.parseTask(documents.task).ok, true);
assert.equal(core.parseResult(documents.result).ok, true);
assert.equal(core.parseExperience(documents.experience).ok, true);
console.log('No dynamic code generation during core import and parser calls.');
`);
const parserProbeOutput = run([
  process.execPath,
  "--disallow-code-generation-from-strings",
  parserProbe,
], consumerDirectory);

await writeFile(join(consumerDirectory, "index.html"), '<!doctype html><html><body><script type="module" src="/bundle-entry.js"></script></body></html>');
await writeFile(join(consumerDirectory, "bundle-entry.js"), `
import {parseCatalog, parseTask, parseResult, parseExperience} from '@aeliqo/core';
const documents = ${fixtureSource};
const parsed = [parseCatalog(documents.catalog), parseTask(documents.task), parseResult(documents.result), parseExperience(documents.experience)];
globalThis.__aeliqoParsed = parsed;
export {parsed};
`);
await writeFile(join(consumerDirectory, "vite.config.mjs"), `
export default {
  build: {
    minify: true,
    outDir: 'dist',
    rollupOptions: {input: 'index.html'},
  },
  plugins: [{name: 'record-core-modules', generateBundle(_, bundle) {
    const modules = Object.values(bundle).filter((item) => item.type === 'chunk').flatMap((item) => Object.keys(item.modules));
    this.emitFile({type: 'asset', fileName: 'modules.json', source: JSON.stringify(modules)});
  }}],
};
`);
run([join(consumerDirectory, "node_modules/.bin/vite"), "build"], consumerDirectory);
const modules = JSON.parse(await readFile(join(consumerDirectory, "dist/modules.json"), "utf8"));
const normalizedModules = modules.map((id) => id.replaceAll(String.fromCharCode(92), "/"));
const normalizedConsumerDirectory = (await realpath(consumerDirectory)).replaceAll(String.fromCharCode(92), "/");
const fixtureModules = new Set([
  `${normalizedConsumerDirectory}/bundle-entry.js`,
  `${normalizedConsumerDirectory}/index.html`,
]);
const coreDistPrefix = `${normalizedConsumerDirectory}/node_modules/@aeliqo/core/dist/`;
const zodV4Prefix = `${normalizedConsumerDirectory}/node_modules/zod/v4/`;
assert(normalizedModules.some((id) => id.startsWith(coreDistPrefix)), "Installed core is absent from Vite graph");
for (const id of normalizedModules) {
  const isViteFixture = id === String.fromCharCode(0) + "vite/modulepreload-polyfill.js" || fixtureModules.has(id);
  const isInstalledCore = id.startsWith(coreDistPrefix) && id.endsWith(".js");
  const isInstalledZod = id.startsWith(zodV4Prefix) && /\/(?:core|mini)\/[^/]+\.js$/.test(id);
  assert(isViteFixture || isInstalledCore || isInstalledZod, `Unexpected module in parser graph: ${id}`);
}
const bundleFiles = (await sortedFiles(join(consumerDirectory, "dist"))).filter((path) => extname(path) === ".js");
const bundleMetrics = [];
for (const path of bundleFiles) {
  const bytes = await readFile(path);
  assert(bytes.includes(Buffer.from("__aeliqoParsed")), `Bundle does not retain observable parser output: ${path}`);
  bundleMetrics.push({file: relative(join(consumerDirectory, "dist"), path), bytes: bytes.length, gzipBytes: gzipSync(bytes).length});
}
const initialGzipBytes = bundleMetrics.reduce((sum, item) => sum + item.gzipBytes, 0);
assert(initialGzipBytes <= 70 * 1024, `Core parser lazy entry exceeds 70 KiB gzip: ${initialGzipBytes}`);

const sourceAfter = await sourceDigest();
assert.equal(sourceAfter, sourceBefore, "Core source changed during consumer verification");
const report = {
  sourceDigestBefore: sourceBefore,
  sourceDigestAfter: sourceAfter,
  sourceChangedDuringRun: sourceBefore !== sourceAfter,
  scope: "@aeliqo/core 0.1.0 installed tarball; four document parsers/round trips; generated schemas; Vite parser graph and 70 KiB gzip budget. Planner/full product/browser certification are outside this check.",
  artifact: {name: packedManifest.name, version: packedManifest.version, path: tarballPath, sha256: tarballSha256, integrity: tarballIntegrity},
  consumer: {directory: consumerDirectory, lockPath: join(runDirectory, "consumer-package-lock.json"), lockSha256: hash(lockBytes)},
  schemas: expectedSchemas.map((name) => `schemas/${name}.schema.json`),
  consumerOutput: consumerOutput.trim(),
  parserProbeOutput: parserProbeOutput.trim(),
  bundle: {initialGzipBytes, files: bundleMetrics, modules, moduleGraphScope: "installed package parser graph; no universal dependency/security certification"},
  environment: {
    node: process.version,
    npm: run(["npm", "--version"], consumerDirectory).trim(),
    pnpm: run(["pnpm", "--version"], root).trim(),
    typescript: "7.0.2",
    vite: "8.2.2",
    zod: "4.5.4",
    os: platform(),
    release: release(),
    arch: arch(),
  },
  passed: true,
};
await writeFile(join(runDirectory, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log("Installed @aeliqo/core types, parsers, schemas, no-codegen probe, and Vite graph pass.");
console.log(`Evidence: ${join(runDirectory, "report.json")}`);

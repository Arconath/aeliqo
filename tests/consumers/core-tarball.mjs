/**
 * Build and consume the actual @aeliqo/core package outside the workspace.
 *
 * This is a bounded T03/T04/T05 package-boundary check. It proves the four
 * public document parsers, generated schema files, task structure, experience
 * constraint and semantic meaning passes, the installed package graph and a
 * small core bundle. It does not certify query execution, the full planner,
 * the complete product, universal browser performance, or a universal
 * secret/code scanner.
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {chromium} from "@playwright/test";
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

const {inputs: _presentationInputs, ...taskBaseInput} = taskInput;
const queryInput = {
  entity: "employees",
  fields: ["employee.id"],
  measures: [],
  relations: [],
  groupBy: ["employee.id"],
  population: {kind: "all-authorized"},
  order: [],
};
const namedOutputTaskInput = {
  ...taskBaseInput,
  id: "task-named-output",
  revision: "1",
  goal: "Load named employee outputs",
  kind: "data",
  outputs: [
    {id: "summary", kind: "query", query: queryInput, dependsOn: ["detail"], delivery: "eager"},
    {id: "detail", kind: "query", query: queryInput, dependsOn: [], delivery: "eager"},
  ],
};
const cyclicTaskInput = {
  ...namedOutputTaskInput,
  id: "task-cyclic-output",
  outputs: [
    {...namedOutputTaskInput.outputs[0], dependsOn: ["detail"]},
    {...namedOutputTaskInput.outputs[1], dependsOn: ["summary"]},
  ],
};
const fixedPopulationTaskInput = {
  ...taskBaseInput,
  id: "task-fixed-population",
  revision: "1",
  goal: "Load a fixed employee cohort",
  kind: "data",
  outputs: [{
    id: "fixed",
    kind: "query",
    query: {
      ...queryInput,
      population: {kind: "fixed", source: resultInput.ref, identityKeys: ["employee.id"], cohortDigest: "cohort-1"},
    },
    dependsOn: [],
    delivery: "eager",
  }],
};
const livePopulationTaskInput = {
  ...taskBaseInput,
  id: "task-live-population",
  revision: "1",
  goal: "Load a live employee cohort",
  kind: "data",
  outputs: [
    {id: "upstream", kind: "query", query: queryInput, dependsOn: [], delivery: "eager"},
    {
      id: "downstream",
      kind: "query",
      query: {
        ...queryInput,
        population: {kind: "live-output", outputId: "upstream", identityKeys: ["employee.id"]},
      },
      dependsOn: ["upstream"],
      delivery: "eager",
    },
  ],
};
const formTaskInput = {
  ...taskBaseInput,
  id: "task-form",
  revision: "1",
  goal: "Edit an employee",
  kind: "form",
  schema: {id: "employee.form", revision: "1"},
  action: {id: "employee.update", revision: "1"},
};
const operationConflictTaskInput = {
  ...formTaskInput,
  id: "task-operation-conflict",
  needs: [{id: "save-employee", operation: {id: "employee.update", revision: "2"}, fields: [], required: true}],
};
const preferredPresentationTaskInput = {
  ...taskInput,
  id: "task-preferred-representation",
  viewPreference: {representation: "chart.bar", strength: "preferred"},
};
const explicitConflictTaskInput = {
  ...taskInput,
  id: "task-explicit-representation",
  viewPreference: {representation: "chart.line", strength: "explicit"},
};
const noPresetExperienceInput = {
  ...experienceInput,
  id: "experience-no-preset",
  mode: "composable",
  allowedRepresentations: ["data.table"],
  composition: {allowWithoutPreset: true, maxNodes: 8, maxExpansions: 16},
};
const preferredExperienceInput = {
  ...experienceInput,
  id: "experience-preferred",
  mode: "adaptive",
  allowedRepresentations: ["data.table", "chart.bar"],
  allowedPatterns: ["table.basic", "chart.basic"],
  composition: {allowWithoutPreset: true, maxNodes: 8, maxExpansions: 16},
};
const explicitConflictExperienceInput = {
  ...experienceInput,
  id: "experience-explicit-conflict",
  mode: "adaptive",
  allowedRepresentations: ["data.table"],
  composition: {allowWithoutPreset: true, maxNodes: 8, maxExpansions: 16},
};
const operationExperienceInput = {
  ...experienceInput,
  id: "experience-operation-revision",
  mode: "adaptive",
  allowedRepresentations: ["data.table"],
  requiredOperations: ["employee.update"],
  composition: {allowWithoutPreset: true, maxNodes: 8, maxExpansions: 16},
};
const restrictionIntersectionExperienceInput = {
  ...experienceInput,
  id: "experience-restriction-intersection",
  mode: "fixed",
  agentAllowed: false,
  allowedRepresentations: ["data.table", "chart.bar"],
  allowedPatterns: ["table.basic", "chart.basic"],
  composition: {allowWithoutPreset: false, maxNodes: 8, maxExpansions: 16},
};
const wideningRestrictionInput = [{
  id: "host-attempted-widening",
  allowedRepresentations: ["chart.bar"],
  allowedPatterns: ["chart.basic"],
  mode: "composable",
  agentAllowed: true,
  allowWithoutPreset: true,
  maxNodes: 32,
  maxExpansions: 64,
  transitionPolicy: "stable",
}];
const operationRevisionRestrictionInput = [{
  id: "host-operation-revision",
  allowedOperations: [{id: "employee.update", revision: "1"}],
}];
const t05Fixtures = {
  namedOutputTaskInput,
  cyclicTaskInput,
  fixedPopulationTaskInput,
  livePopulationTaskInput,
  taskInput,
  formTaskInput,
  operationConflictTaskInput,
  preferredPresentationTaskInput,
  explicitConflictTaskInput,
  experienceInput,
  noPresetExperienceInput,
  preferredExperienceInput,
  explicitConflictExperienceInput,
  operationExperienceInput,
  restrictionIntersectionExperienceInput,
  wideningRestrictionInput,
  operationRevisionRestrictionInput,
};
const semanticCatalogInput = {
  version: "1",
  revision: "catalog-1",
  functionRegistryDigest: "core-standard-1",
  entities: [{
    id: "employees",
    label: "Employees",
    identity: ["employee.id"],
    rowGrain: ["employee.id"],
    fields: [
      {id: "employee.id", label: "Employee ID", type: {value: "text", nullable: false}, role: "identity"},
      {id: "numerator", label: "Numerator", type: {value: "integer", nullable: false, unit: {dimension: "count", symbol: "day"}}, role: "measure"},
      {id: "denominator", label: "Denominator", type: {value: "integer", nullable: false, unit: {dimension: "count", symbol: "day"}}, role: "measure"},
      {id: "usd", label: "US Dollars", type: {value: "integer", nullable: false, unit: {dimension: "currency", symbol: "USD"}}, role: "measure"},
      {id: "cents", label: "Cents", type: {value: "integer", nullable: false, unit: {dimension: "currency", symbol: "cent"}}, role: "measure"},
    ],
  }],
  relationships: [],
  meanings: [],
  capabilities: [],
};
const t04Fixtures = {semanticCatalogInput};

await writeFile(join(consumerDirectory, "consumer-types.ts"), `
import {
  parseCatalog, parseTask, parseResult, parseExperience, parseContract, serializeContract, parseWireValue,
  validateTaskStructure, resolveExperienceConstraints,
  createStandardFunctionRegistry, createTypedAuthoring,
} from '@aeliqo/core';
import type {
  Catalog, Task, Result, Experience, Outcome, TaskStructure, Wire,
  ExperienceRestriction, ExperienceConstraints, TypedAuthoring, TypedExpression,
  FunctionRegistry, MeaningDefinition, MeaningBundle,
} from '@aeliqo/core';
const unknownWire: Outcome<unknown> = parseWireValue('{}');
if (unknownWire.ok) {
  // @ts-expect-error Ingress is unknown until an envelope schema validates it.
  unknownWire.value.scope;
}
// @ts-expect-error Present undefined is not a wire member.
const invalidWire: Wire<{scope?: string | undefined}> = {scope: undefined};
void invalidWire;
declare const catalog: Catalog;
declare const task: Task;
declare const result: Result;
declare const experience: Experience;
declare const taskStructure: TaskStructure;
declare const restriction: ExperienceRestriction;
declare const constraints: ExperienceConstraints;
const semanticCatalog = ${JSON.stringify(semanticCatalogInput)} as const satisfies Catalog;
declare const authoring: TypedAuthoring<typeof semanticCatalog>;
function unwrap<T>(outcome: Outcome<T>): T {
  if (!outcome.ok) throw new Error('unreachable in type-only consumer fixture');
  return outcome.value;
}
const typedCatalog: Catalog = unwrap(parseCatalog({}));
const typedTask: Task = unwrap(parseTask({}));
const typedResult: Result = unwrap(parseResult({}));
const typedExperience: Experience = unwrap(parseExperience({}));
const typedStructure: TaskStructure = taskStructure;
const typedRestriction: ExperienceRestriction = restriction;
const typedConstraints: ExperienceConstraints = constraints;
const typedRegistry: Outcome<FunctionRegistry> = createStandardFunctionRegistry();
const typedNumerator: Outcome<TypedExpression> = authoring.field('employees', 'numerator');
const typedDenominator: Outcome<TypedExpression> = authoring.field('employees', 'denominator');
const typedRatio: Outcome<TypedExpression> = authoring.ratioOfSums({
  numerator: typedNumerator,
  denominator: typedDenominator,
  zeroDenominator: 'null',
});
const typedMeaning: Outcome<MeaningDefinition> = authoring.defineMetric({
  id: 'employee.rate', label: 'Employee rate', description: 'A same-unit ratio.', expression: typedRatio,
  aggregation: 'ratio-of-sums',
});
const typedBundle: Outcome<MeaningBundle> = authoring.bundle([]);
// @ts-expect-error Entity IDs are derived from the const catalog for autocomplete.
authoring.field('unknown-entity', 'numerator');
// @ts-expect-error Field IDs are derived from the selected entity for autocomplete.
authoring.field('employees', 'unknown-field');
// @ts-expect-error Ratio-of-sums requires an explicit zero-denominator policy.
authoring.ratioOfSums({numerator: typedNumerator, denominator: typedDenominator});
void [catalog, task, result, experience, typedCatalog, typedTask, typedResult, typedExperience];
void [typedStructure, typedRestriction, typedConstraints, typedRegistry, typedNumerator, typedDenominator, typedRatio, typedMeaning, typedBundle];
void parseContract('catalog', catalog);
void parseContract('task', task);
void parseContract('result', result);
void parseContract('experience', experience);
void serializeContract('catalog', catalog);
void serializeContract('task', task);
void serializeContract('result', result);
void serializeContract('experience', experience);
const structureOutcome: Outcome<TaskStructure> = validateTaskStructure(task);
const constraintsOutcome: Outcome<ExperienceConstraints> = resolveExperienceConstraints(experience, task, []);
void [structureOutcome, constraintsOutcome];
// @ts-expect-error TaskStructure output order is readonly for consumers.
taskStructure.outputOrder.push('unexpected');
// @ts-expect-error ExperienceRestriction fields are readonly wire data.
restriction.id = 'unexpected';
// @ts-expect-error Resolved constraints cannot be mutated by a consumer.
constraints.allowedRepresentations.push('unexpected');
// @ts-expect-error Task contracts do not carry self-declared actor authority.
void taskStructure.task.actor;
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
const t05FixtureSource = JSON.stringify(t05Fixtures);
const t04FixtureSource = JSON.stringify(t04Fixtures);
await writeFile(join(consumerDirectory, "consumer.mjs"), `
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {
  parseCatalog, parseTask, parseResult, parseExperience, parseContract, serializeContract, parseWireValue,
  validateTaskStructure, resolveExperienceConstraints,
  checkExpression, createStandardFunctionRegistry, createTypedAuthoring, authorizeMeaningActivation,
} from '@aeliqo/core';
assert.deepEqual(parseWireValue('{"requestId":"one"}'), {ok:true,value:{requestId:'one'}});
assert.equal(parseWireValue('{"requestId":"one","requestId":"two"}').ok, false);
assert.equal(parseWireValue({requestId:undefined}).ok, false);
const documents = ${fixtureSource};
const t05 = ${t05FixtureSource};
const t04 = ${t04FixtureSource};
const relationQuery = {...t05.namedOutputTaskInput.outputs[0].query,
  relations: [{id: 'employees.orders', revision: '1'}],
  relationUsage: [{relation: {id: 'employees.orders', revision: '1'}, kind: 'semi'}]};
assert.equal(parseContract('query', relationQuery).ok, true);
assert.equal(parseContract('query', {...relationQuery, relationUsage: [{...relationQuery.relationUsage[0], approved: true}]}).ok, false);
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
const named = unwrap(validateTaskStructure(t05.namedOutputTaskInput));
assert.deepEqual(named.outputOrder, ['detail', 'summary']);
assert.deepEqual(named.resultReferences, []);
assert.deepEqual(named.task.outputs.map((output) => output.id), ['summary', 'detail']);
const fixedPopulation = unwrap(validateTaskStructure(t05.fixedPopulationTaskInput));
assert.deepEqual(fixedPopulation.outputOrder, ['fixed']);
assert.deepEqual(fixedPopulation.resultReferences, [t05.fixedPopulationTaskInput.outputs[0].query.population.source]);
const livePopulation = unwrap(validateTaskStructure(t05.livePopulationTaskInput));
assert.deepEqual(livePopulation.outputOrder, ['upstream', 'downstream']);
assert.deepEqual(livePopulation.resultReferences, []);
const cycle = validateTaskStructure(t05.cyclicTaskInput);
assert.equal(cycle.ok, false);
if (!cycle.ok) assert(cycle.diagnostics.some((diagnostic) => diagnostic.code === 'task.output-cycle'));
const form = unwrap(validateTaskStructure(t05.formTaskInput));
assert.deepEqual(form.outputOrder, []);
assert.deepEqual(form.resultReferences, []);
const noPreset = unwrap(resolveExperienceConstraints(t05.noPresetExperienceInput, t05.taskInput));
assert.equal(noPreset.allowWithoutPreset, true);
assert.equal(noPreset.compositionChangeAllowed, true);
const preferred = unwrap(resolveExperienceConstraints(t05.preferredExperienceInput, t05.preferredPresentationTaskInput));
assert.deepEqual(preferred.allowedRepresentations, ['chart.bar', 'data.table']);
assert.equal(preferred.preferredRepresentation, 'chart.bar');
const explicit = resolveExperienceConstraints(t05.explicitConflictExperienceInput, t05.explicitConflictTaskInput);
assert.equal(explicit.ok, false);
if (!explicit.ok) assert(explicit.diagnostics.some((diagnostic) => diagnostic.code === 'experience.representation-conflict'));
const intersected = unwrap(resolveExperienceConstraints(
  t05.restrictionIntersectionExperienceInput,
  t05.taskInput,
  t05.wideningRestrictionInput,
));
assert.deepEqual(intersected.allowedRepresentations, ['chart.bar']);
assert.deepEqual(intersected.allowedPatterns, ['chart.basic']);
assert.equal(intersected.mode, 'fixed');
assert.equal(intersected.agentAllowed, false);
assert.equal(intersected.allowWithoutPreset, false);
const operationConflict = resolveExperienceConstraints(
  t05.operationExperienceInput,
  t05.operationConflictTaskInput,
  t05.operationRevisionRestrictionInput,
);
assert.equal(operationConflict.ok, false);
if (!operationConflict.ok) assert(operationConflict.diagnostics.some((diagnostic) => diagnostic.code === 'experience.operation-conflict'));
const semanticCatalog = t04.semanticCatalogInput;
const standardRegistry = unwrap(createStandardFunctionRegistry());
assert.equal(standardRegistry.digest, 'core-standard-1');
const authoring = unwrap(createTypedAuthoring({catalog: semanticCatalog, registry: standardRegistry}));
const numerator = unwrap(authoring.field('employees', 'numerator'));
const denominator = unwrap(authoring.field('employees', 'denominator'));
const ratio = unwrap(authoring.ratioOfSums({numerator, denominator, zeroDenominator: 'null'}));
assert.equal(ratio.operation, 'ratio-of-sums');
assert.equal(ratio.aggregation, 'ratio-of-sums');
assert.equal(ratio.type.unit, undefined);
const sameUnitMeaning = unwrap(authoring.defineMetric({
  id: 'employee.rate',
  label: 'Employee rate',
  description: 'A same-unit ratio.',
  expression: ratio,
  aggregation: 'ratio-of-sums',
}));
assert.equal(sameUnitMeaning.origin, 'manual');
assert.equal(sameUnitMeaning.lifecycle, 'draft');
assert.equal(sameUnitMeaning.authority, 'hypothesis');
const unknownVersion = checkExpression({
  kind: 'call',
  function: {id: 'core.add', revision: '999'},
  arguments: [numerator.expression, denominator.expression],
}, {catalog: semanticCatalog, registry: standardRegistry, entityId: 'employees'});
assert.equal(unknownVersion.ok, false);
if (!unknownVersion.ok) assert(unknownVersion.diagnostics.some((diagnostic) => diagnostic.code === 'semantic.function-version'));
const invalidCurrency = checkExpression({
  kind: 'call',
  function: {id: 'core.add', revision: '1'},
  arguments: [{kind: 'field', ref: 'usd'}, {kind: 'field', ref: 'cents'}],
}, {catalog: semanticCatalog, registry: standardRegistry, entityId: 'employees'});
assert.equal(invalidCurrency.ok, false);
if (!invalidCurrency.ok) assert(invalidCurrency.diagnostics.some((diagnostic) => diagnostic.code === 'semantic.unit-mismatch'));
const idempotentBundle = unwrap(authoring.bundle([sameUnitMeaning, sameUnitMeaning]));
assert.equal(idempotentBundle.meanings.length, 1);
const conflictingBundle = authoring.bundle([sameUnitMeaning, {...sameUnitMeaning, label: 'Conflicting employee rate'}]);
assert.equal(conflictingBundle.ok, false);
if (!conflictingBundle.ok) assert(conflictingBundle.diagnostics.some((diagnostic) => diagnostic.code === 'semantic.definition-conflict'));
const duplicateAggregationDimensions = authoring.defineMetric({
  id: 'employee.rate.duplicate-grain',
  label: 'Duplicate grain rate',
  description: 'A deliberately duplicated aggregation grain.',
  expression: ratio,
  aggregation: 'ratio-of-sums',
  aggregationDimensions: ['employee.id', 'employee.id'],
});
assert.equal(duplicateAggregationDimensions.ok, false);
if (!duplicateAggregationDimensions.ok) assert(duplicateAggregationDimensions.diagnostics.some((diagnostic) => diagnostic.code === 'semantic.aggregation-grain'));
const activation = authorizeMeaningActivation(sameUnitMeaning, {
  policyRevision: 'policy-1',
  allowlistedDefinitions: [sameUnitMeaning],
  allowlistedRefs: [{id: sameUnitMeaning.id, revision: sameUnitMeaning.revision}],
});
assert.equal(activation.ok, false);
if (!activation.ok) assert(activation.diagnostics.some((diagnostic) => diagnostic.code === 'semantic.activation-lifecycle'));
const forgedActiveMeaning = {...sameUnitMeaning, label: 'Forged employee rate', lifecycle: 'active', authority: 'approved'};
const forgedActivation = authorizeMeaningActivation(forgedActiveMeaning, {
  policyRevision: 'policy-1',
  allowlistedDefinitions: [sameUnitMeaning],
  allowlistedRefs: [{id: sameUnitMeaning.id, revision: sameUnitMeaning.revision}],
});
assert.equal(forgedActivation.ok, false);
if (!forgedActivation.ok) assert(forgedActivation.diagnostics.some((diagnostic) => diagnostic.code === 'semantic.activation-denied'));
const require = createRequire(import.meta.url);
for (const name of ${JSON.stringify(expectedSchemas)}) {
  const path = require.resolve('@aeliqo/core/schemas/' + name + '.schema.json');
  const schema = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(typeof schema, 'object');
}
const runtimeSchema = await import('@aeliqo/core/schema');
assert(Object.keys(runtimeSchema).length > 0);
console.log('Installed @aeliqo/core parsers, schema exports, and round trips pass.');
console.log('Installed @aeliqo/core task structure and experience constraint passes pass.');
console.log('Installed @aeliqo/core semantic checker and typed authoring passes pass.');
`);
const consumerOutput = run([process.execPath, "consumer.mjs"], consumerDirectory);
const parserProbe = join(consumerDirectory, "no-codegen.mjs");
await writeFile(parserProbe, `
import assert from 'node:assert/strict';
globalThis.Function = () => { throw new Error('Function constructor used by core parser'); };
globalThis.eval = () => { throw new Error('eval used by core parser'); };
const core = await import('@aeliqo/core');
const {parseWireValue} = core;
assert.deepEqual(parseWireValue('{"requestId":"one"}'), {ok:true,value:{requestId:'one'}});
assert.equal(parseWireValue('{"requestId":"one","requestId":"two"}').ok, false);
assert.equal(parseWireValue({requestId:undefined}).ok, false);
const documents = ${fixtureSource};
const t05 = ${t05FixtureSource};
const t04 = ${t04FixtureSource};
assert.equal(core.parseCatalog(documents.catalog).ok, true);
assert.equal(core.parseTask(documents.task).ok, true);
assert.equal(core.parseResult(documents.result).ok, true);
assert.equal(core.parseExperience(documents.experience).ok, true);
assert.equal(core.validateTaskStructure(t05.namedOutputTaskInput).ok, true);
assert.equal(core.resolveExperienceConstraints(t05.noPresetExperienceInput, t05.taskInput).ok, true);
const registry = core.createStandardFunctionRegistry();
assert.equal(registry.ok, true);
if (registry.ok) {
  const authoring = core.createTypedAuthoring({catalog: t04.semanticCatalogInput, registry: registry.value});
  assert.equal(authoring.ok, true);
  if (authoring.ok) assert.equal(authoring.value.field('employees', 'numerator').ok, true);
}
console.log('No dynamic code generation during core, parser, and semantic authoring calls.');
`);
const parserProbeOutput = run([
  process.execPath,
  "--disallow-code-generation-from-strings",
  parserProbe,
], consumerDirectory);

await writeFile(join(consumerDirectory, "index.html"), '<!doctype html><html><body><script type="module" src="/bundle-entry.js"></script></body></html>');
await writeFile(join(consumerDirectory, "bundle-entry.js"), `
import {
  parseCatalog, parseTask, parseResult, parseExperience, parseWireValue,
  validateTaskStructure, resolveExperienceConstraints,
  createStandardFunctionRegistry, createTypedAuthoring,
} from '@aeliqo/core';
const validWire = parseWireValue('{"requestId":"one"}');
if (!validWire.ok || validWire.value.requestId !== 'one' ||
    parseWireValue('{"requestId":"one","requestId":"two"}').ok ||
    parseWireValue({requestId:undefined}).ok) throw new Error('Browser wire parser regression');
const documents = ${fixtureSource};
const t05 = ${t05FixtureSource};
const t04 = ${t04FixtureSource};
const semanticRegistry = createStandardFunctionRegistry();
const semanticAuthoring = semanticRegistry.ok
  ? createTypedAuthoring({catalog: t04.semanticCatalogInput, registry: semanticRegistry.value})
  : semanticRegistry;
const semanticField = semanticAuthoring.ok ? semanticAuthoring.value.field('employees', 'numerator') : semanticAuthoring;
const parsed = [
  parseCatalog(documents.catalog), parseTask(documents.task), parseResult(documents.result), parseExperience(documents.experience),
  validateTaskStructure(t05.namedOutputTaskInput), resolveExperienceConstraints(t05.noPresetExperienceInput, t05.taskInput),
  semanticRegistry, semanticAuthoring, semanticField,
];
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
assert(initialGzipBytes <= 70 * 1024, `Core consumer entry exceeds 70 KiB gzip: ${initialGzipBytes}`);

// Execute the packed consumer in a real browser: a successful bundle alone
// cannot detect missing globals or runtime-only import failures.
const servedFiles = new Map();
for (const path of await sortedFiles(join(consumerDirectory, "dist"))) {
  servedFiles.set('/' + relative(join(consumerDirectory, "dist"), path).split("\\").join("/"), {
    bytes: await readFile(path),
    type: extname(path) === '.js' ? 'text/javascript' : extname(path) === '.html' ? 'text/html' : 'application/json',
  });
}
const server = createServer((request, response) => {
  const file = servedFiles.get(request.url === '/' ? '/index.html' : request.url);
  response.writeHead(file ? 200 : 404, {'Content-Type': file?.type ?? 'text/plain'});
  response.end(file?.bytes ?? 'Not found');
});
await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
let browser;
let browserOutcomes;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  assert.deepEqual(errors, [], 'Installed browser consumer raised an exception');
  await page.waitForFunction(() => Array.isArray(globalThis.__aeliqoParsed), null, {timeout: 10_000});
  browserOutcomes = await page.evaluate(() => globalThis.__aeliqoParsed.map(value => value.ok));
  assert.deepEqual(errors, [], 'Installed browser consumer raised an exception');
  assert(browserOutcomes.length > 0 && browserOutcomes.every(Boolean), 'Installed browser consumer rejected a valid fixture');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}

const sourceAfter = await sourceDigest();
assert.equal(sourceAfter, sourceBefore, "Core source changed during consumer verification");
const report = {
  sourceDigestBefore: sourceBefore,
  sourceDigestAfter: sourceAfter,
  sourceChangedDuringRun: sourceBefore !== sourceAfter,
  scope: "@aeliqo/core 0.1.0 installed tarball; four document parsers/round trips; TaskStructure, ExperienceConstraints, semantic checker and typed authoring passes; generated schemas; Vite core graph and 70 KiB gzip budget. Query execution/full planner/product/browser certification are outside this check.",
  artifact: {name: packedManifest.name, version: packedManifest.version, path: tarballPath, sha256: tarballSha256, integrity: tarballIntegrity},
  consumer: {directory: consumerDirectory, lockPath: join(runDirectory, "consumer-package-lock.json"), lockSha256: hash(lockBytes)},
  schemas: expectedSchemas.map((name) => `schemas/${name}.schema.json`),
  browserOutcomes,
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
console.log("Installed @aeliqo/core types, parsers, semantic authoring, schemas, no-codegen probe, Vite graph, and Chromium execution pass.");
console.log(`Evidence: ${join(runDirectory, "report.json")}`);

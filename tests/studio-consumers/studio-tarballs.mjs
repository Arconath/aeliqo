/**
 * Exercise the local Studio authoring API from installed 0.1.0 tarballs.
 *
 * The consumer is created outside the workspace so package links, source
 * imports, the Studio app and model/agent packages cannot make this proof pass.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir, platform, release, arch} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root = resolve(import.meta.dirname, '../..');
const output = join(root, 'artifacts', 'studio-consumers');
await mkdir(output, {recursive: true});
const runDirectory = await mkdtemp(join(output, 'run-'));
const consumer = await mkdtemp(join(tmpdir(), 'aeliqo-studio-consumer-'));

function run(argv, cwd, encoding = 'utf8', env = process.env) {
  const result = spawnSync(argv[0], argv.slice(1), {
    cwd,
    encoding,
    env,
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${argv.join(' ')} failed: ${result.error ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  return result.stdout;
}

const hash = (bytes, algorithm = 'sha256', encoding = 'hex') => createHash(algorithm).update(bytes).digest(encoding);
const sourceDigest = () => run(['python3', 'scripts/gate.py', 'digest'], root).trim();
const before = sourceDigest();
const packageNames = ['core', 'runtime', 'devtools'];
const artifacts = [];
const tsc = join(root, 'node_modules', '.bin', 'tsc');

for (const name of packageNames) {
  const directory = join(root, 'packages', name);
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  assert.equal(manifest.name, `@aeliqo/${name}`);
  assert.equal(manifest.version, '0.1.0');
  assert.equal(manifest.license, 'Apache-2.0');
  assert.notEqual(manifest.private, true);
  // Invoke the installed compiler directly so this evidence run cannot
  // rewrite a workspace lockfile when the checkout is intentionally isolated.
  run([tsc, '-p', 'tsconfig.json'], directory);
  if (name === 'core') run(['node', 'scripts/generate-schemas.mjs'], directory);
}

for (const name of packageNames) {
  const directory = join(root, 'packages', name);
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  const tarball = join(runDirectory, `aeliqo-${name}-0.1.0.tgz`);
  run(['pnpm', 'pack', '--out', tarball], directory);
  const bytes = await readFile(tarball);
  const packed = JSON.parse(run(['tar', '-xOf', tarball, 'package/package.json'], root));
  assert.deepEqual(packed.exports, manifest.exports, `${name} exports changed while packing`);
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, manifest.version);
  assert.equal(packed.license, manifest.license);
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    assert(!JSON.stringify(packed[field] ?? {}).includes('workspace:'), `${name} contains a workspace dependency`);
  }
  const entries = run(['tar', '-tzf', tarball], root).trim().split('\n');
  assert(entries.includes('package/LICENSE'), `${name} tarball has no LICENSE`);
  assert(entries.includes('package/README.md'), `${name} tarball has no README`);
  assert(!entries.some((entry) => entry.startsWith('package/src/')), `${name} tarball leaked source`);
  assert(!entries.some((entry) => entry.startsWith('package/node_modules/')), `${name} tarball contains node_modules`);
  for (const entry of entries) assert(entry.startsWith('package/') && !entry.split('/').includes('..'), `Unsafe archive path: ${entry}`);
  artifacts.push({
    name: packed.name,
    version: packed.version,
    path: tarball,
    bytes: bytes.length,
    sha256: hash(bytes),
    integrity: `sha512-${hash(bytes, 'sha512', 'base64')}`,
    entries,
  });
}

await writeFile(join(consumer, 'package.json'), JSON.stringify({private: true, type: 'module'}) + '\n');
run([
  'npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact',
  ...artifacts.map((artifact) => artifact.path),
  'typescript@7.0.2',
], consumer);

const lockBytes = await readFile(join(consumer, 'package-lock.json'));
const lock = JSON.parse(lockBytes);
for (const artifact of artifacts) {
  const location = `node_modules/${artifact.name}`;
  assert.equal(lock.packages[location]?.version, artifact.version);
  assert.equal(lock.packages[location]?.integrity, artifact.integrity);
  assert.deepEqual(Object.keys(lock.packages).filter((key) => key.endsWith(location)), [location], `Duplicate ${artifact.name}`);
  for (const entry of artifact.entries) {
    if (entry.endsWith('/')) continue;
    const installed = await readFile(join(consumer, location, entry.slice('package/'.length)));
    const packed = run(['tar', '-xOf', artifact.path, entry], root, null);
    assert.equal(hash(installed), hash(packed), `Installed ${artifact.name} bytes differ for ${entry}`);
  }
}
assert.equal(lock.packages['node_modules/@aeliqo/runtime']?.dependencies?.['@aeliqo/core'], '0.1.0');
assert.equal(lock.packages['node_modules/@aeliqo/devtools']?.dependencies?.['@aeliqo/core'], '0.1.0');
assert.equal(lock.packages['node_modules/@aeliqo/devtools']?.dependencies?.['@aeliqo/runtime'], '0.1.0');
assert.equal(lock.packages['node_modules/typescript']?.version, '7.0.2');
assert.deepEqual(Object.keys(lock.packages).filter((key) => key.startsWith('node_modules/@aeliqo/')).sort(), [
  'node_modules/@aeliqo/core',
  'node_modules/@aeliqo/devtools',
  'node_modules/@aeliqo/runtime',
]);
assert(!Object.keys(lock.packages).some((key) => /(?:studio|agent|openai)/iu.test(key)), 'Consumer pulled Studio or model packages');
await writeFile(join(runDirectory, 'consumer-package-lock.json'), lockBytes);

await writeFile(join(consumer, 'probe.mjs'), `
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {writeFile} from 'node:fs/promises';
import {createStandardFunctionRegistry} from '@aeliqo/core';
import {createMeaningAuthoring} from '@aeliqo/runtime/meaning';
import {createStudioDocument, createStudioSession, parseStudioDocument} from '@aeliqo/devtools';

const check = (condition, message) => { if (!condition) throw new Error(message); };
const registryResult = createStandardFunctionRegistry('studio-consumer-functions');
check(registryResult.ok, 'standard function registry');
const registry = registryResult.value;
const catalog = {version: '1', revision: 'studio-consumer-catalog-1', functionRegistryDigest: registry.digest,
  entities: [{id: 'employees', label: 'Employees', identity: ['id'], rowGrain: ['id'], fields: [
    {id: 'id', label: 'ID', role: 'identity', type: {value: 'text', nullable: false}},
    {id: 'amount', label: 'Amount', role: 'measure', type: {value: 'integer', nullable: false}},
  ]}], relationships: [], meanings: [], capabilities: []};
const authoring = createMeaningAuthoring({catalog, registry});
check(authoring.ok, 'meaning authoring');
const amount = authoring.value.field('employees', 'amount');
check(amount.ok, 'amount field');
const expression = authoring.value.call({id: 'core.aggregate.sum', revision: '1'}, [amount.value]);
check(expression.ok, 'aggregate expression');
const defined = authoring.value.defineMeaning({id: 'employees.total', label: 'Total amount', description: 'Sum of employee amounts.', expression: expression.value});
check(defined.ok, 'code-owned meaning');
const codeDraft = authoring.value.draft(defined.value.meaning, {source: {surface: 'code', ownership: 'code', readOnly: true}, assumptions: []});
check(codeDraft.ok, 'code-owned meaning draft');
const experience = {version: '1', id: 'employees-profile', revision: '1', mode: 'adaptive', agentAllowed: false,
  allowedRepresentations: ['table', 'metric'], allowedPatterns: ['record-inspection'],
  composition: {allowWithoutPreset: true, maxNodes: 16, maxExpansions: 16}, requiredOperations: [],
  tokenProfile: {id: 'tokens.aeliqo', revision: '1'}, extensionAllowlist: [], transitionPolicy: 'stable'};
const input = {version: '1', id: 'studio-consumer', revision: 'studio-consumer-1', catalog,
  meanings: [codeDraft.value], profiles: [{label: 'Employee records', source: {surface: 'code', ownership: 'code', readOnly: true}, experience}],
  activeProfile: {id: experience.id, revision: experience.revision}, tokens: {profile: {id: 'tokens.aeliqo', revision: '1'}, theme: 'light'}};
const documentResult = createStudioDocument(input, {registry});
check(documentResult.ok, 'create Studio document');
const session = createStudioSession(documentResult.value, {registry});
const initialExport = session.exportDocument();
check(initialExport.ok, 'export Studio JSON');
const initialRoundtrip = parseStudioDocument(initialExport.value, {registry});
check(initialRoundtrip.ok, 'parse exported Studio JSON');
check(JSON.stringify(initialRoundtrip.value) === JSON.stringify(session.getState().document), 'Studio JSON roundtrip changed the document');

const protectedMeaning = session.defineMeaning({id: defined.value.meaning.id, revision: defined.value.meaning.revision,
  label: defined.value.meaning.label, description: defined.value.meaning.explanation, entity: 'employees', field: 'amount'});
check(!protectedMeaning.ok, 'Code-owned meaning revision was mutable');
check(['studio.meaning-conflict', 'studio.meaning-read-only'].includes(protectedMeaning.diagnostics[0]?.code), 'Unexpected code-owned meaning diagnostic');
const originalProfile = session.getState().document.profiles[0].experience;
const protectedExperience = session.editExperience({base: originalProfile, label: 'Mutated code profile', experience: {...originalProfile, mode: 'fixed'}});
check(!protectedExperience.ok && protectedExperience.diagnostics[0]?.code === 'studio.experience-read-only', 'Code-owned Experience revision was mutable');
const personal = session.editExperience({base: originalProfile, label: 'Fixed employee inspection', experience: {...originalProfile, revision: '2', mode: 'fixed'}});
check(personal.ok, 'Personal Experience revision');
const current = session.getState().document;
check(current.profiles.length === 2, 'Original code profile was removed');
check(current.profiles[0].source.ownership === 'code' && current.profiles[0].experience.revision === '1', 'Code profile source/version changed');
check(current.profiles[1].source.ownership === 'personal' && current.profiles[1].experience.revision === '2', 'Personal profile source/version missing');
check(current.activeProfile.revision === '2', 'New personal profile did not become active');
check(session.setActiveProfile({id: originalProfile.id, revision: originalProfile.revision}).ok, 'Retained code profile is not selectable');
const finalExport = session.exportDocument();
check(finalExport.ok, 'export edited Studio JSON');
const finalRoundtrip = parseStudioDocument(finalExport.value, {registry});
check(finalRoundtrip.ok && JSON.stringify(finalRoundtrip.value) === JSON.stringify(session.getState().document), 'Edited Studio JSON roundtrip changed the document');
const code = session.exportCode();
check(code.ok, 'export standalone code');
check(!code.value.includes('import ') && !code.value.includes('@aeliqo/studio') && !code.value.includes('@aeliqo/agent') && !code.value.includes('model'), 'Studio code export has an unexpected runtime/model dependency');
await writeFile(join(process.cwd(), 'exported-studio.ts'), code.value);
console.log(JSON.stringify({documentRevision: current.revision, profileRevisions: current.profiles.map((profile) => profile.experience.revision), codeBytes: code.value.length}));
`);
const probeOutput = run(['node', 'probe.mjs'], consumer).trim();
const probe = JSON.parse(probeOutput.split('\n').at(-1));
assert.deepEqual(probe.profileRevisions, ['1', '2']);
assert(probe.codeBytes > 0);
run([
  join(consumer, 'node_modules', '.bin', 'tsc'), '--strict', '--target', 'ES2022', '--module', 'NodeNext',
  '--moduleResolution', 'NodeNext', '--skipLibCheck', '--noEmit', 'exported-studio.ts',
], consumer);

const after = sourceDigest();
assert.equal(after, before, 'Source changed during Studio consumer proof');
await writeFile(join(runDirectory, 'report.json'), JSON.stringify({
  sourceDigest: before,
  sourceChangedDuringRun: before !== after,
  passed: true,
  scope: 'Installed @aeliqo/core, @aeliqo/runtime and @aeliqo/devtools 0.1.0 tarballs; Studio document/session JSON roundtrip; standalone exportCode TypeScript compilation; immutable code-owned meaning/Experience revisions; personal Experience revision retention and activation without Studio app, agent or model packages.',
  artifacts: artifacts.map(({entries, ...artifact}) => ({...artifact, entries})),
  consumerDirectory: consumer,
  consumerLock: {path: join(runDirectory, 'consumer-package-lock.json'), sha256: hash(lockBytes)},
  probe,
  environment: {node: process.version, npm: run(['npm', '--version'], consumer).trim(), typescript: '7.0.2', os: platform(), release: release(), arch: arch()},
}, null, 2) + '\n');
console.log(`Installed Studio consumer proof passed. Evidence: ${join(runDirectory, 'report.json')}`);

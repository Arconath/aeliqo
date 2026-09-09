#!/usr/bin/env node
/** Build, inspect, scan, type-check, and consume the six exact public package tarballs. */
import {spawnSync} from 'node:child_process';
import {access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, join, relative, resolve} from 'node:path';
import {
  PUBLIC_PACKAGES, PUBLIC_PACKAGE_NAMES, RELEASE_VERSION, assertExportTargets,
  assertPublicManifest, assertTarballPaths, candidateManifest, cyclonedxSbom,
  packagePurl, pnpmLockIntegrities, readJson, sha256, sha512Integrity,
} from './candidate-lib.mjs';

const root = resolve(import.meta.dirname, '../..');
const arguments_ = process.argv.slice(2);
const versionIndex = arguments_.indexOf('--version');
const version = versionIndex === -1 ? RELEASE_VERSION : arguments_[versionIndex + 1];
if (!/^0\.1\.0(?:-rc\.[1-9]\d*)?$/.test(version ?? '')) throw new Error('Expected --version 0.1.0 or a unique 0.1.0-rc.N version');
const positional = [];
for (let index = 0; index < arguments_.length; index += 1) {
  if (arguments_[index] === '--version') { index += 1; continue; }
  positional.push(arguments_[index]);
}
if (positional.length > 1) throw new Error('Expected at most one candidate output directory');
const output = resolve(root, positional[0] ?? 'artifacts/release-candidate');
if (relative(root, output).startsWith('..')) throw new Error('Candidate output must remain within the repository');

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    timeout: options.timeout ?? 300_000,
    env: options.env ?? process.env,
  });
  if (result.error || result.status !== 0) throw new Error(`${commandName} ${args.join(' ')} failed\n${result.error?.message ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  return result.stdout.trim();
}
function requireVersion(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} ${expected} is required; received ${actual}`);
}
async function exists(path) { try { await access(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }

function verifyToolchainAndSource() {
  requireVersion(process.versions.node, '24.20.0', 'Node');
  requireVersion(command('pnpm', ['--version']), '11.24.0', 'pnpm');
  if (command('git', ['status', '--porcelain', '--untracked-files=no'])) {
    throw new Error('Refusing to build a release candidate from modified tracked files');
  }
}
async function prepareOutput() {
  if (await exists(output)) {
    if ((await readdir(output)).length > 0) throw new Error(`Refusing to overwrite non-empty candidate output ${output}`);
  } else await mkdir(output, {recursive: true});
}
function archivePaths(tarball) {
  return command('tar', ['-tzf', tarball]).split('\n').filter(Boolean).sort();
}
function packedJson(tarball) {
  return JSON.parse(command('tar', ['-xOf', tarball, 'package/package.json']));
}
function stagedManifest(source) {
  const staged = structuredClone(source);
  staged.version = version;
  // Development dependencies belong to the source workspace, not the public
  // runtime artifact. Removing them also prevents workspace-only aliases from
  // leaking into a package assembled outside the monorepo.
  delete staged.devDependencies;
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const dependency of Object.keys(staged[field] ?? {})) {
      if (PUBLIC_PACKAGE_NAMES.includes(dependency)) staged[field][dependency] = version;
    }
  }
  return staged;
}

const SECRET_PATTERNS = [
  ['pem-private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['github-token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/],
  ['npm-token', /\bnpm_[A-Za-z0-9]{36,}\b/],
  ['openai-style-key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{24,}\b/],
  ['anthropic-key', /\bsk-ant-[A-Za-z0-9_-]{24,}\b/],
];
function scanContent(label, content, findings) {
  if (content.includes('\0')) return false;
  for (const [rule, pattern] of SECRET_PATTERNS) {
    if (pattern.test(content)) findings.push({file: label, rule});
  }
  return true;
}
async function scanReleaseSource() {
  const files = command('git', ['ls-files', '-z', '--', 'packages', 'apps/site', 'deploy', 'design', 'Dockerfile', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json'])
    .split('\0').filter(Boolean).sort();
  const findings = [];
  let bytes = 0;
  let scannedFiles = 0;
  for (const file of files) {
    const content = await readFile(join(root, file), 'utf8');
    bytes += Buffer.byteLength(content);
    if (scanContent(file, content, findings)) scannedFiles += 1;
  }
  return {scope: 'tracked-release-source', scannedFiles, bytes, findings};
}
function scanTarballs(packages) {
  const findings = [];
  let bytes = 0;
  let scannedFiles = 0;
  for (const item of packages) {
    for (const path of item.paths.filter(path => !path.endsWith('/'))) {
      const content = command('tar', ['-xOf', item.path, path]);
      bytes += Buffer.byteLength(content);
      if (scanContent(`${item.name}:${path}`, content, findings)) scannedFiles += 1;
    }
  }
  return {scope: 'packed-public-artifacts', scannedFiles, bytes, findings};
}

async function buildAndPack(stagingRoot) {
  const packages = [];
  for (const shortName of PUBLIC_PACKAGES) {
    const directory = join(root, 'packages', shortName);
    const source = await readJson(join(directory, 'package.json'));
    const expectedName = `@aeliqo/${shortName}`;
    assertPublicManifest(source, expectedName, RELEASE_VERSION, {allowWorkspace: true});
    command('pnpm', ['--filter', expectedName, 'build']);

    const stage = join(stagingRoot, shortName);
    await mkdir(stage, {recursive: true});
    for (const path of source.files ?? []) await cp(join(directory, path), join(stage, path), {recursive: true});
    await writeFile(join(stage, 'package.json'), JSON.stringify(stagedManifest(source), null, 2) + '\n');
    command('pnpm', ['pack', '--pack-destination', output], {cwd: stage});

    const tarball = join(output, `aeliqo-${shortName}-${version}.tgz`);
    if (!await exists(tarball)) throw new Error(`pnpm pack did not produce expected ${tarball}`);
    const manifest = packedJson(tarball);
    assertPublicManifest(manifest, expectedName, version);
    const paths = archivePaths(tarball);
    assertTarballPaths(paths, expectedName);
    assertExportTargets(manifest, paths, expectedName);
    const bytes = await readFile(tarball);
    packages.push({name: expectedName, directory, manifest, paths, file: basename(tarball), path: tarball, sha256: sha256(bytes), integrity: sha512Integrity(bytes), bytes: bytes.byteLength});
  }
  return packages;
}

async function peerInstallSpecs(packages) {
  const peers = new Map();
  for (const item of packages) {
    for (const name of Object.keys(item.manifest.peerDependencies ?? {})) {
      if (PUBLIC_PACKAGE_NAMES.includes(name)) continue;
      const installed = await readJson(join(item.directory, 'node_modules', name, 'package.json'));
      const previous = peers.get(name);
      if (previous && previous !== installed.version) throw new Error(`Conflicting locked peer versions for ${name}: ${previous} and ${installed.version}`);
      peers.set(name, installed.version);
    }
  }
  return [...peers].sort(([left], [right]) => left.localeCompare(right)).map(([name, requested]) => `${name}@${requested}`);
}
function literalExports(manifest) {
  return Object.keys(manifest.exports).filter(path => !path.includes('*')).map(path => path === '.' ? manifest.name : `${manifest.name}${path.slice(1)}`);
}
async function typeCheckInstalledExports(consumer, packages) {
  const imports = packages.flatMap(item => literalExports(item.manifest)).map((specifier, index) =>
    `import * as Export${index} from ${JSON.stringify(specifier)}; export type ExportCheck${index} = typeof Export${index};`);
  await writeFile(join(consumer, 'exports.ts'), imports.join('\n') + '\n');
  await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({compilerOptions: {
    target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true,
    noEmit: true, skipLibCheck: false, lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: ['node', 'react', 'react-dom'],
  }, include: ['exports.ts']}, null, 2) + '\n');
  command(join(consumer, 'node_modules/.bin/tsc'), ['--project', 'tsconfig.json'], {cwd: consumer});
  return imports.length;
}
async function externalConsumer(packages) {
  const consumer = await mkdtemp(join(tmpdir(), 'aeliqo-release-consumer-'));
  await writeFile(join(consumer, 'package.json'), JSON.stringify({private: true, type: 'module'}, null, 2) + '\n');
  const tools = ['typescript@7.0.2', '@types/node@24.13.3', '@types/react@19.2.18', '@types/react-dom@19.2.7'];
  command('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', ...packages.map(item => item.path), ...await peerInstallSpecs(packages), ...tools], {cwd: consumer});
  const lock = await readJson(join(consumer, 'package-lock.json'));
  for (const item of packages) {
    const installed = lock.packages[`node_modules/${item.name}`];
    if (!installed || installed.version !== version || installed.integrity !== item.integrity) throw new Error(`Consumer did not install exact ${item.name} tarball`);
  }
  const exportCount = await typeCheckInstalledExports(consumer, packages);
  await writeFile(join(consumer, 'consumer.mjs'), [
    "import '@aeliqo/core';", "import '@aeliqo/runtime/evaluation';", "import '@aeliqo/web/server';",
    "import '@aeliqo/agent/protocol';", "import '@aeliqo/devtools';", "import '@aeliqo/react/ssr';",
  ].join('\n') + '\n');
  command('node', ['--disallow-code-generation-from-strings', 'consumer.mjs'], {cwd: consumer});
  return {consumer, lock, lockSha256: sha256(await readFile(join(consumer, 'package-lock.json'))), packages: packages.map(item => item.name), exportCount};
}

function packageNameFromLockPath(path) {
  const tail = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const parts = tail.split('/');
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}
function resolveLockedDependency(packages, fromPath, dependency) {
  let current = fromPath;
  while (true) {
    const nested = `${current}/node_modules/${dependency}`;
    if (packages[nested]) return nested;
    const index = current.lastIndexOf('/node_modules/');
    if (index === -1) break;
    current = current.slice(0, index);
  }
  const rootPath = `node_modules/${dependency}`;
  return packages[rootPath] ? rootPath : undefined;
}
function sbomGraph(consumerLock, workspaceLockText, packages) {
  const entries = consumerLock.packages;
  const workspace = pnpmLockIntegrities(workspaceLockText);
  const refByPath = new Map();
  const externalComponents = [];
  for (const [path, entry] of Object.entries(entries)) {
    if (!path.includes('node_modules/') || !entry.version) continue;
    const name = packageNameFromLockPath(path);
    const ref = packagePurl(name, entry.version);
    refByPath.set(path, ref);
    if (PUBLIC_PACKAGE_NAMES.includes(name)) continue;
    if (!entry.integrity) throw new Error(`Installed external package ${name}@${entry.version} has no integrity`);
    const locked = workspace.get(`${name}@${entry.version}`);
    if (locked !== entry.integrity) throw new Error(`Installed ${name}@${entry.version} differs from the pnpm lock`);
    if (!entry.license) throw new Error(`Installed external package ${name}@${entry.version} has no license metadata`);
    externalComponents.push({ref, name, version: entry.version, integrity: entry.integrity, license: String(entry.license)});
  }
  const dependencies = [];
  for (const [path, entry] of Object.entries(entries)) {
    const ref = refByPath.get(path);
    if (!ref) continue;
    const dependsOn = [];
    for (const dependency of Object.keys({...entry.dependencies, ...entry.optionalDependencies, ...entry.peerDependencies})) {
      const dependencyPath = resolveLockedDependency(entries, path, dependency);
      if (dependencyPath && refByPath.has(dependencyPath)) dependsOn.push(refByPath.get(dependencyPath));
    }
    dependencies.push({ref, dependsOn});
  }
  for (const item of packages) {
    const ref = packagePurl(item.name, version);
    if (!dependencies.some(entry => entry.ref === ref)) dependencies.push({ref, dependsOn: []});
  }
  return {externalComponents, dependencies};
}

verifyToolchainAndSource();
await prepareOutput();
const stagingRoot = await mkdtemp(join(tmpdir(), 'aeliqo-release-pack-'));
let consumerDirectory;
try {
  const sourceScan = await scanReleaseSource();
  const sourceRevision = command('git', ['rev-parse', 'HEAD']);
  const packages = await buildAndPack(stagingRoot);
  const artifactScan = scanTarballs(packages);
  const secretScan = {schema: 'aeliqo.secret-scan.v1', sourceRevision, rules: SECRET_PATTERNS.map(([rule]) => rule), scans: [sourceScan, artifactScan]};
  await writeFile(join(output, 'secret-scan.json'), JSON.stringify(secretScan, null, 2) + '\n');
  const findings = secretScan.scans.flatMap(scan => scan.findings);
  if (findings.length) throw new Error(`Secret scan found ${findings.length} high-confidence credential pattern(s); inspect secret-scan.json`);

  const consumer = await externalConsumer(packages);
  consumerDirectory = consumer.consumer;
  const graph = sbomGraph(consumer.lock, await readFile(join(root, 'pnpm-lock.yaml'), 'utf8'), packages);
  const manifest = candidateManifest({sourceRevision, packages, version});
  const sbom = cyclonedxSbom({sourceRevision, packages, ...graph, version});
  await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await writeFile(join(output, 'sbom.cdx.json'), JSON.stringify(sbom, null, 2) + '\n');
  console.log(JSON.stringify({output, sourceRevision, tarballs: packages.map(item => item.file), consumer: {lockSha256: consumer.lockSha256, packages: consumer.packages, exportCount: consumer.exportCount}, sbomComponents: sbom.components.length, secretFindings: 0}, null, 2));
} finally {
  await rm(stagingRoot, {recursive: true, force: true});
  if (consumerDirectory) await rm(consumerDirectory, {recursive: true, force: true});
}

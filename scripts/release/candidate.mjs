#!/usr/bin/env node
/** Build, inspect, scan, type-check, and consume the six exact public package tarballs. */
import {spawnSync} from 'node:child_process';
import {access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, join, relative, resolve} from 'node:path';
import {
  PUBLIC_PACKAGES, PUBLIC_PACKAGE_NAMES, RELEASE_VERSION, assertExportTargets,
  assertPublicManifest, assertTarballPaths, candidateManifest, cyclonedxSbom,
  exportSpecifiers, packagePurl, pnpmLockIntegrities, publicPackageName, readJson,
  sha256, sha512Integrity,
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
function commandBuffer(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: options.cwd ?? root,
    encoding: null,
    maxBuffer: options.maxBuffer ?? 128 * 1024 * 1024,
    timeout: options.timeout ?? 300_000,
    env: options.env ?? process.env,
  });
  if (result.error || result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : String(result.stderr ?? '');
    throw new Error(`${commandName} ${args.join(' ')} failed\n${result.error?.message ?? ''}\n${stderr}`);
  }
  return result.stdout;
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
async function clearGeneratedPackageOutputs() {
  for (const shortName of PUBLIC_PACKAGES) {
    await rm(join(root, 'packages', shortName, 'dist'), {recursive: true, force: true});
  }
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
  // Credential formats are ASCII. latin1 provides a lossless one-byte mapping,
  // so binary files are inspected instead of disappearing from the evidence.
  const searchable = Buffer.isBuffer(content) ? content.toString('latin1') : content;
  for (const [rule, pattern] of SECRET_PATTERNS) {
    if (pattern.test(searchable)) findings.push({file: label, rule});
  }
}
function archiveFormat(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'tar-gzip';
  if (lower.endsWith('.zip')) return 'zip';
}
function archiveEntries(path, format) {
  const listing = format === 'tar-gzip'
    ? command('tar', ['-tzf', path])
    : command('unzip', ['-Z1', path]);
  return listing.split('\n').filter(entry => entry && !entry.endsWith('/'));
}
function archiveEntry(path, format, entry) {
  return format === 'tar-gzip'
    ? commandBuffer('tar', ['-xOzf', path, '--', entry])
    : commandBuffer('unzip', ['-p', path, entry]);
}
async function scanReleaseSource() {
  const files = command('git', ['ls-files', '-z'])
    .split('\0').filter(Boolean).sort();
  const findings = [];
  let bytes = 0;
  let expandedBytes = 0;
  let expandedEntries = 0;
  const expandedArchives = [];
  for (const file of files) {
    const path = join(root, file);
    const content = await readFile(path);
    bytes += content.byteLength;
    scanContent(file, content, findings);
    const format = archiveFormat(file);
    if (!format) continue;
    const entries = archiveEntries(path, format);
    let archiveBytes = 0;
    for (const entry of entries) {
      const payload = archiveEntry(path, format, entry);
      archiveBytes += payload.byteLength;
      expandedBytes += payload.byteLength;
      expandedEntries += 1;
      scanContent(`${file}!/${entry}`, payload, findings);
    }
    expandedArchives.push({file, format, sha256: sha256(content), entries: entries.length, bytes: archiveBytes});
  }
  return {
    scope: 'tracked-release-source',
    consideredFiles: files.length,
    scannedFiles: files.length,
    excludedFiles: [],
    bytes,
    expandedArchives,
    expandedEntries,
    expandedBytes,
    findings,
  };
}
function scanTarballs(packages) {
  const findings = [];
  let bytes = 0;
  let scannedFiles = 0;
  for (const item of packages) {
    for (const path of item.paths.filter(path => !path.endsWith('/'))) {
      const content = command('tar', ['-xOf', item.path, path]);
      bytes += Buffer.byteLength(content);
      scanContent(`${item.name}:${path}`, content, findings);
      scannedFiles += 1;
    }
  }
  return {scope: 'packed-public-artifacts', consideredFiles: scannedFiles, scannedFiles, excludedFiles: [], bytes, findings};
}

async function buildAndPack(stagingRoot) {
  const packages = [];
  const canonicalLicense = await readFile(join(root, 'LICENSE'));
  const canonicalNotice = await readFile(join(root, 'NOTICE'));
  for (const shortName of PUBLIC_PACKAGES) {
    const directory = join(root, 'packages', shortName);
    const source = await readJson(join(directory, 'package.json'));
    const expectedName = publicPackageName(shortName);
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
    const packedLicense = commandBuffer('tar', ['-xOf', tarball, 'package/LICENSE']);
    const packedNotice = commandBuffer('tar', ['-xOf', tarball, 'package/NOTICE']);
    if (!packedLicense.equals(canonicalLicense)) throw new Error(`${expectedName} packed LICENSE differs from the canonical Apache-2.0 text`);
    if (!packedNotice.equals(canonicalNotice)) throw new Error(`${expectedName} packed NOTICE differs from the canonical attribution`);
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
async function typeCheckInstalledExports(consumer, packages) {
  const specifiers = packages.flatMap(item => exportSpecifiers(item.manifest, item.paths));
  const imports = specifiers.map((specifier, index) => specifier.endsWith('.json')
    ? `import Export${index} from ${JSON.stringify(specifier)} with { type: "json" }; export type ExportCheck${index} = typeof Export${index};`
    : `import * as Export${index} from ${JSON.stringify(specifier)}; export type ExportCheck${index} = typeof Export${index};`);
  await writeFile(join(consumer, 'exports.ts'), imports.join('\n') + '\n');
  await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({compilerOptions: {
    target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true,
    noEmit: true, skipLibCheck: false, resolveJsonModule: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: ['node', 'react', 'react-dom'],
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
  const installedExportSpecifiers = packages.flatMap(item => exportSpecifiers(item.manifest, item.paths));
  await writeFile(join(consumer, 'network-blocker.cjs'), [
    "const {syncBuiltinESMExports} = require('node:module');",
    "const state = {attempts: []}; globalThis.__aeliqoOfflineNetwork = state;",
    "const blocked = label => () => { state.attempts.push(label); const error = new Error('network access is forbidden in the offline release consumer'); error.code = 'AELIQO_OFFLINE_NETWORK_BLOCKED'; throw error; };",
    "globalThis.fetch = blocked('fetch');",
    "for (const name of ['node:http', 'node:https']) { const value = require(name); value.request = blocked(`${name.slice(5)}.request`); value.get = blocked(`${name.slice(5)}.get`); }",
    "const net = require('node:net'); net.connect = blocked('net.connect'); net.createConnection = blocked('net.createConnection'); net.Socket.prototype.connect = blocked('net.Socket.connect');",
    "const dns = require('node:dns'); dns.lookup = blocked('dns.lookup'); dns.resolve = blocked('dns.resolve');",
    "syncBuiltinESMExports();",
  ].join('\n') + '\n');
  await writeFile(join(consumer, 'consumer.mjs'), [
    `const installedExportSpecifiers = ${JSON.stringify(installedExportSpecifiers)};`,
    "const installedExports = await Promise.all(installedExportSpecifiers.map(specifier => specifier.endsWith('.json') ? import(specifier, {with: {type: 'json'}}) : import(specifier)));",
    "import {parseContract} from '@aeliqo/core';",
    "const modules = await Promise.all([",
    "  import('@aeliqo/runtime/evaluation'), import('@aeliqo/runtime/audit'), import('@aeliqo/web/server'),",
    "  import('@aeliqo/agent/protocol'), import('@aeliqo/devtools'), import('@aeliqo/react/ssr'),",
    "]);",
    "const boundedRejection = parseContract('catalog', '{}');",
    "const audit = modules[1].createLocalAuditExporter({maxEvents: 2, maxBytes: 1024, now: () => 1});",
    "const auditRecord = audit.record({kind: 'source', transport: 'local', status: 'error', code: 'source.invalid'}); const auditExport = audit.exportSnapshot(); audit.dispose();",
    "const stateBeforeProbes = globalThis.__aeliqoOfflineNetwork;",
    "if (installedExports.length !== installedExportSpecifiers.length || installedExports.some(module => module === null || typeof module !== 'object') || boundedRejection.ok || modules.length !== 6 || !auditRecord.ok || !auditExport.ok || auditExport.value.records.length !== 1 || !stateBeforeProbes || stateBeforeProbes.attempts.length !== 0) throw new Error('installed package runtime smoke failed');",
    "const [http, https, net, dns] = await Promise.all([import('node:http'), import('node:https'), import('node:net'), import('node:dns')]);",
    "const probes = [['fetch', () => fetch('https://example.invalid')], ['http.request', () => http.request('http://example.invalid')], ['http.get', () => http.get('http://example.invalid')], ['https.request', () => https.request('https://example.invalid')], ['https.get', () => https.get('https://example.invalid')], ['net.connect', () => net.connect(9, 'example.invalid')], ['net.createConnection', () => net.createConnection(9, 'example.invalid')], ['net.Socket.connect', () => new net.Socket().connect(9, 'example.invalid')], ['dns.lookup', () => dns.lookup('example.invalid', () => {})], ['dns.resolve', () => dns.resolve('example.invalid', () => {})]];",
    "for (const [label, probe] of probes) { try { probe(); throw new Error(`network probe unexpectedly succeeded: ${label}`); } catch (error) { if (error?.code !== 'AELIQO_OFFLINE_NETWORK_BLOCKED') throw error; } }",
    "const state = globalThis.__aeliqoOfflineNetwork; if (!state || JSON.stringify(state.attempts) !== JSON.stringify(probes.map(([label]) => label))) throw new Error('network blocker did not observe every exact probe');",
    "process.stdout.write(JSON.stringify({networkDenied: true, deniedMethods: state.attempts, packageModulesLoaded: 7, publicExportsLoaded: installedExports.length, coreParserExecuted: true, auditNetworkAttempts: 0, auditExecuted: true}));",
  ].join('\n') + '\n');
  const runtime = JSON.parse(command('node', ['--disallow-code-generation-from-strings', '--require', './network-blocker.cjs', 'consumer.mjs'], {cwd: consumer}));
  const deniedMethods = ['fetch', 'http.request', 'http.get', 'https.request', 'https.get', 'net.connect', 'net.createConnection', 'net.Socket.connect', 'dns.lookup', 'dns.resolve'];
  if (runtime.networkDenied !== true || runtime.packageModulesLoaded !== 7 || runtime.publicExportsLoaded !== exportCount || runtime.coreParserExecuted !== true || runtime.auditExecuted !== true || runtime.auditNetworkAttempts !== 0
    || JSON.stringify(runtime.deniedMethods) !== JSON.stringify(deniedMethods)) throw new Error('Offline consumer returned an invalid report');
  return {consumer, lock, lockSha256: sha256(await readFile(join(consumer, 'package-lock.json'))), packages: packages.map(item => item.name), exportCount, runtime};
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
  const externalByPath = new Map();
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
    externalByPath.set(path, {ref, name, version: entry.version, integrity: entry.integrity, license: String(entry.license)});
  }
  const edges = new Map();
  for (const [path, entry] of Object.entries(entries)) {
    const ref = refByPath.get(path);
    if (!ref) continue;
    const childPaths = [];
    for (const dependency of Object.keys({...entry.dependencies, ...entry.optionalDependencies, ...entry.peerDependencies})) {
      const dependencyPath = resolveLockedDependency(entries, path, dependency);
      if (dependencyPath && refByPath.has(dependencyPath)) childPaths.push(dependencyPath);
    }
    edges.set(path, {ref, childPaths});
  }
  const reachable = new Set();
  const queue = packages.map(item => `node_modules/${item.name}`);
  while (queue.length) {
    const path = queue.shift();
    if (!path || reachable.has(path)) continue;
    reachable.add(path);
    for (const child of edges.get(path)?.childPaths ?? []) queue.push(child);
  }
  const externalComponents = [...externalByPath].filter(([path]) => reachable.has(path)).map(([, component]) => component);
  const dependencies = [...reachable].map(path => ({
    ref: refByPath.get(path),
    dependsOn: (edges.get(path)?.childPaths ?? []).filter(child => reachable.has(child)).map(child => refByPath.get(child)),
  })).filter(item => item.ref);
  return {externalComponents, dependencies};
}

verifyToolchainAndSource();
await prepareOutput();
await clearGeneratedPackageOutputs();
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
  await writeFile(join(output, 'consumer.json'), JSON.stringify({
    schema: 'aeliqo.local-tarball-consumer.v1', sourceRevision, version,
    install: {source: 'local-candidate-tarballs', lockSha256: consumer.lockSha256},
    execution: consumer.runtime,
    packages: packages.map(item => ({name: item.name, version, integrity: item.integrity})),
    exportCount: consumer.exportCount,
  }, null, 2) + '\n');
  console.log(JSON.stringify({output, sourceRevision, tarballs: packages.map(item => item.file), consumer: {lockSha256: consumer.lockSha256, packages: consumer.packages, exportCount: consumer.exportCount}, sbomComponents: sbom.components.length, secretFindings: 0}, null, 2));
} finally {
  await rm(stagingRoot, {recursive: true, force: true});
  if (consumerDirectory) await rm(consumerDirectory, {recursive: true, force: true});
}

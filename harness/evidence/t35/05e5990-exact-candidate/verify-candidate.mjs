#!/usr/bin/env node
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const args = process.argv.slice(2);
const value = flag => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};
const candidateDirectory = resolve(value('--candidate') ?? 'artifacts/release-candidate');
const output = resolve(value('--output') ?? 'candidate-audit.json');
const expectedRevision = value('--source');
const expectedDigest = value('--source-digest');
const expectedVersion = '0.1.0-rc.1';
const expectedPackages = [
  '@aeliqo/sdk-core',
  '@aeliqo/sdk-runtime',
  '@aeliqo/sdk-web',
  '@aeliqo/sdk-agent',
  '@aeliqo/sdk-devtools',
  '@aeliqo/sdk-react',
];
assert.match(expectedRevision ?? '', /^[0-9a-f]{40}$/, 'a full source revision is required');
assert.match(expectedDigest ?? '', /^[0-9a-f]{64}$/, 'a full source digest is required');

const hash = (algorithm, bytes, encoding = 'hex') => createHash(algorithm).update(bytes).digest(encoding);
const sha256 = bytes => hash('sha256', bytes);
const integrity = bytes => `sha512-${hash('sha512', bytes, 'base64')}`;
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: Object.hasOwn(options, 'encoding') ? options.encoding : 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    timeout: options.timeout ?? 300_000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')} failed\n${result.error?.message ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  return result.stdout;
};
const tarText = (tarball, path) => run('tar', ['-xOf', tarball, path]);
const tarBytes = (tarball, path) => run('tar', ['-xOf', tarball, path], {encoding: null});
const exportTargets = (entry, targets = []) => {
  if (typeof entry === 'string') targets.push(entry);
  else if (entry && typeof entry === 'object') for (const nested of Object.values(entry)) exportTargets(nested, targets);
  return targets;
};
const exportSpecifiers = (manifest, paths) => {
  const files = paths.filter(path => !path.endsWith('/'));
  const result = new Set();
  for (const [key, entry] of Object.entries(manifest.exports)) {
    if (!key.includes('*')) {
      result.add(key === '.' ? manifest.name : `${manifest.name}${key.slice(1)}`);
      continue;
    }
    for (const target of exportTargets(entry)) {
      const packed = `package/${target.slice(2)}`;
      const marker = packed.indexOf('*');
      const prefix = packed.slice(0, marker);
      const suffix = packed.slice(marker + 1);
      for (const file of files) {
        if (!file.startsWith(prefix) || !file.endsWith(suffix)) continue;
        const wildcard = file.slice(prefix.length, file.length - suffix.length || undefined);
        result.add(`${manifest.name}${key.slice(1).replace('*', wildcard)}`);
      }
    }
  }
  return [...result].sort();
};

const manifestPath = join(candidateDirectory, 'manifest.json');
const consumerPath = join(candidateDirectory, 'consumer.json');
const sbomPath = join(candidateDirectory, 'sbom.cdx.json');
const secretScanPath = join(candidateDirectory, 'secret-scan.json');
const [manifest, producerConsumer, sbom, secretScan] = await Promise.all([
  readJson(manifestPath), readJson(consumerPath), readJson(sbomPath), readJson(secretScanPath),
]);
assert.equal(manifest.schema, 'aeliqo.release-candidate.v1');
assert.equal(manifest.sourceRevision, expectedRevision);
assert.equal(manifest.version, expectedVersion);
assert.deepEqual(manifest.publishOrder, expectedPackages);
assert.deepEqual(manifest.packages.map(item => item.name), expectedPackages);
assert.equal(new Set(manifest.packages.map(item => item.name)).size, expectedPackages.length);

const canonicalLicense = await readFile(resolve('LICENSE'));
const canonicalNotice = await readFile(resolve('NOTICE'));
const requiredPaths = ['package/package.json', 'package/README.md', 'package/LICENSE', 'package/NOTICE'];
const packageAudits = [];
const specifiers = [];
for (const [index, item] of manifest.packages.entries()) {
  assert.equal(item.version, expectedVersion);
  assert.equal(basename(item.file), item.file);
  const tarball = join(candidateDirectory, item.file);
  const bytes = await readFile(tarball);
  assert.equal(bytes.byteLength, item.bytes, `${item.name} byte count`);
  assert.equal(sha256(bytes), item.sha256, `${item.name} sha256`);
  assert.equal(integrity(bytes), item.integrity, `${item.name} integrity`);
  const paths = run('tar', ['-tzf', tarball]).trim().split('\n').filter(Boolean).sort();
  assert.ok(paths.length > 0, `${item.name} archive is empty`);
  for (const path of paths) {
    assert.ok(path.startsWith('package/') && !path.includes('..') && !path.includes('\\'), `${item.name} unsafe path: ${path}`);
    if (path.endsWith('/')) continue;
    assert.ok(requiredPaths.includes(path) || path.startsWith('package/dist/') || path.startsWith('package/schemas/'), `${item.name} unexpected path: ${path}`);
  }
  for (const required of requiredPaths) assert.ok(paths.includes(required), `${item.name} missing ${required}`);
  const packedManifest = JSON.parse(tarText(tarball, 'package/package.json'));
  assert.equal(packedManifest.name, item.name);
  assert.equal(packedManifest.version, expectedVersion);
  assert.notEqual(packedManifest.private, true);
  assert.equal(packedManifest.license, 'Apache-2.0');
  assert.ok(packedManifest.exports && typeof packedManifest.exports === 'object');
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [dependency, version] of Object.entries(packedManifest[field] ?? {})) {
      assert.ok(!String(version).startsWith('workspace:'), `${item.name} leaked workspace protocol`);
      const dependencyIndex = expectedPackages.indexOf(dependency);
      if (dependencyIndex === -1) continue;
      assert.equal(version, expectedVersion, `${item.name} internal dependency version`);
      assert.ok(dependencyIndex < index, `${item.name} is ordered before ${dependency}`);
    }
  }
  for (const target of exportTargets(packedManifest.exports)) {
    assert.ok(target.startsWith('./') && !target.includes('..'), `${item.name} unsafe export target: ${target}`);
    const packed = `package/${target.slice(2)}`;
    if (target.includes('*')) {
      assert.ok(paths.some(path => path.startsWith(packed.slice(0, packed.indexOf('*')))), `${item.name} unmatched export pattern: ${target}`);
    } else assert.ok(paths.includes(packed), `${item.name} absent export target: ${target}`);
  }
  const license = tarBytes(tarball, 'package/LICENSE');
  const notice = tarBytes(tarball, 'package/NOTICE');
  assert.deepEqual(license, canonicalLicense, `${item.name} LICENSE differs`);
  assert.deepEqual(notice, canonicalNotice, `${item.name} NOTICE differs`);
  const packageSpecifiers = exportSpecifiers(packedManifest, paths);
  specifiers.push(...packageSpecifiers);
  packageAudits.push({
    name: item.name,
    version: item.version,
    file: item.file,
    bytes: item.bytes,
    sha256: item.sha256,
    integrity: item.integrity,
    archiveEntries: paths.filter(path => !path.endsWith('/')).length,
    exportSpecifiers: packageSpecifiers.length,
    licenseSha256: sha256(license),
    noticeSha256: sha256(notice),
  });
}
assert.equal(specifiers.length, 130, 'exact public export count');

assert.equal(producerConsumer.schema, 'aeliqo.local-tarball-consumer.v1');
assert.equal(producerConsumer.sourceRevision, expectedRevision);
assert.equal(producerConsumer.version, expectedVersion);
assert.equal(producerConsumer.exportCount, specifiers.length);
assert.deepEqual(producerConsumer.packages, manifest.packages.map(item => ({name: item.name, version: item.version, integrity: item.integrity})));
assert.equal(producerConsumer.execution.networkDenied, true);
assert.equal(producerConsumer.execution.auditNetworkAttempts, 0);
assert.equal(producerConsumer.execution.auditExecuted, true);

assert.equal(sbom.bomFormat, 'CycloneDX');
assert.equal(sbom.specVersion, '1.5');
assert.equal(sbom.metadata?.component?.version, expectedVersion);
assert.ok(sbom.metadata.component.properties.some(property => property.name === 'aeliqo:source-revision' && property.value === expectedRevision));
for (const item of manifest.packages) {
  const component = sbom.components.find(entry => entry.name === item.name && entry.version === item.version);
  assert.ok(component, `SBOM is missing ${item.name}`);
  assert.ok(component.licenses.some(entry => entry.license?.id === 'Apache-2.0'));
  assert.ok(component.hashes.some(entry => entry.alg === 'SHA-256' && entry.content === item.sha256));
}
assert.equal(secretScan.schema, 'aeliqo.secret-scan.v1');
assert.equal(secretScan.sourceRevision, expectedRevision);
assert.deepEqual(secretScan.scans.flatMap(scan => scan.findings), []);
assert.ok(secretScan.scans.some(scan => scan.scope === 'packed-public-artifacts' && scan.scannedFiles > 0));

const consumerDirectory = await mkdtemp(join(tmpdir(), 'aeliqo-t35-consumer-'));
let lockSha256;
let runtime;
try {
  await writeFile(join(consumerDirectory, 'package.json'), JSON.stringify({private: true, type: 'module'}, null, 2) + '\n');
  const tarballs = manifest.packages.map(item => join(candidateDirectory, item.file));
  const dependencies = [
    'typescript@7.0.2', '@types/node@24.13.3', '@types/react@19.2.18', '@types/react-dom@19.2.7',
    'react@19.2.8', 'react-dom@19.2.8', '@modelcontextprotocol/server@2.0.0',
    '@modelcontextprotocol/node@2.0.0', '@modelcontextprotocol/client@2.0.0', 'openai@7.10.0',
  ];
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', ...tarballs, ...dependencies], {cwd: consumerDirectory});
  const lockBytes = await readFile(join(consumerDirectory, 'package-lock.json'));
  lockSha256 = sha256(lockBytes);
  const lock = JSON.parse(lockBytes);
  for (const item of manifest.packages) {
    const installed = lock.packages[`node_modules/${item.name}`];
    assert.equal(installed?.version, item.version, `${item.name} installed version`);
    assert.equal(installed?.integrity, item.integrity, `${item.name} installed integrity`);
  }
  const imports = specifiers.map((specifier, index) => specifier.endsWith('.json')
    ? `import Export${index} from ${JSON.stringify(specifier)} with {type: 'json'}; export type Check${index} = typeof Export${index};`
    : `import * as Export${index} from ${JSON.stringify(specifier)}; export type Check${index} = typeof Export${index};`);
  await writeFile(join(consumerDirectory, 'exports.ts'), imports.join('\n') + '\n');
  await writeFile(join(consumerDirectory, 'tsconfig.json'), JSON.stringify({compilerOptions: {
    target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true,
    skipLibCheck: false, resolveJsonModule: true, lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: ['node', 'react', 'react-dom'],
  }, include: ['exports.ts']}, null, 2) + '\n');
  run(join(consumerDirectory, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.json'], {cwd: consumerDirectory});
  await writeFile(join(consumerDirectory, 'network-blocker.cjs'), [
    "const {syncBuiltinESMExports} = require('node:module');",
    "const state = {attempts: []}; globalThis.__offline = state;",
    "const blocked = label => () => { state.attempts.push(label); const error = new Error('offline network blocker'); error.code = 'AELIQO_OFFLINE_NETWORK_BLOCKED'; throw error; };",
    "globalThis.fetch = blocked('fetch');",
    "for (const name of ['node:http', 'node:https']) { const api = require(name); api.request = blocked(`${name.slice(5)}.request`); api.get = blocked(`${name.slice(5)}.get`); }",
    "const net = require('node:net'); net.connect = blocked('net.connect'); net.createConnection = blocked('net.createConnection'); net.Socket.prototype.connect = blocked('net.Socket.connect');",
    "const dns = require('node:dns'); dns.lookup = blocked('dns.lookup'); dns.resolve = blocked('dns.resolve');",
    'syncBuiltinESMExports();',
  ].join('\n') + '\n');
  await writeFile(join(consumerDirectory, 'runtime.mjs'), [
    "import {parseContract} from '@aeliqo/sdk-core';",
    "const modules = await Promise.all([import('@aeliqo/sdk-runtime/evaluation'), import('@aeliqo/sdk-runtime/audit'), import('@aeliqo/sdk-web/server'), import('@aeliqo/sdk-agent/protocol'), import('@aeliqo/sdk-devtools'), import('@aeliqo/sdk-react/ssr')]);",
    "const rejection = parseContract('catalog', '{}');",
    "const audit = modules[1].createLocalAuditExporter({maxEvents: 2, maxBytes: 1024, now: () => 1});",
    "const recorded = audit.record({kind: 'source', transport: 'local', status: 'error', code: 'source.invalid'}); const snapshot = audit.exportSnapshot(); audit.dispose();",
    "if (rejection.ok || modules.length !== 6 || !recorded.ok || !snapshot.ok || snapshot.value.records.length !== 1 || globalThis.__offline.attempts.length !== 0) throw new Error('offline runtime smoke failed');",
    "const [http, https, net, dns] = await Promise.all([import('node:http'), import('node:https'), import('node:net'), import('node:dns')]);",
    "const probes = [['fetch', () => fetch('https://example.invalid')], ['http.request', () => http.request('http://example.invalid')], ['http.get', () => http.get('http://example.invalid')], ['https.request', () => https.request('https://example.invalid')], ['https.get', () => https.get('https://example.invalid')], ['net.connect', () => net.connect(9, 'example.invalid')], ['net.createConnection', () => net.createConnection(9, 'example.invalid')], ['net.Socket.connect', () => new net.Socket().connect(9, 'example.invalid')], ['dns.lookup', () => dns.lookup('example.invalid', () => {})], ['dns.resolve', () => dns.resolve('example.invalid', () => {})]];",
    "for (const [label, probe] of probes) { try { probe(); throw new Error(`probe succeeded: ${label}`); } catch (error) { if (error?.code !== 'AELIQO_OFFLINE_NETWORK_BLOCKED') throw error; } }",
    "process.stdout.write(JSON.stringify({modulesLoaded: 7, coreParserExecuted: true, auditExecuted: true, networkAttemptsBeforePositiveControl: 0, positiveControlMethods: globalThis.__offline.attempts}));",
  ].join('\n') + '\n');
  runtime = JSON.parse(run(process.execPath, ['--disallow-code-generation-from-strings', '--require', './network-blocker.cjs', 'runtime.mjs'], {cwd: consumerDirectory}));
  assert.equal(runtime.networkAttemptsBeforePositiveControl, 0);
  assert.deepEqual(runtime.positiveControlMethods, producerConsumer.execution.deniedMethods);
} finally {
  await rm(consumerDirectory, {recursive: true, force: true});
}

const evidenceInputs = {};
for (const file of ['manifest.json', 'consumer.json', 'sbom.cdx.json', 'secret-scan.json', ...manifest.packages.map(item => item.file)]) {
  const bytes = await readFile(join(candidateDirectory, file));
  evidenceInputs[file] = {sha256: sha256(bytes), bytes: bytes.byteLength};
}
const report = {
  schema: 'aeliqo.t35-candidate-audit.v1',
  reviewedAt: new Date().toISOString(),
  sourceRevision: expectedRevision,
  sourceDigest: expectedDigest,
  candidateVersion: expectedVersion,
  candidateLocation: 'artifacts/release-candidate',
  independentVerification: {
    manifestAndArchiveHashes: 'passed',
    archiveAllowlistAndExportTargets: 'passed',
    canonicalLicenseAndNotice: 'passed',
    dependencyOrderAndExactInternalVersions: 'passed',
    installedExactIntegrities: 'passed',
    strictTypeCheckOfAllExports: 'passed',
    runtimeWithNetworkDenied: 'passed',
    sbomBinding: 'passed',
    secretScanBinding: 'passed',
  },
  environment: {node: process.version, npm: run('npm', ['--version']).trim(), os: process.platform, arch: process.arch},
  canonical: {licenseSha256: sha256(canonicalLicense), noticeSha256: sha256(canonicalNotice)},
  packages: packageAudits,
  exportCount: specifiers.length,
  sbom: {components: sbom.components.length, dependencies: sbom.dependencies.length},
  producerConsumerReportSha256: evidenceInputs['consumer.json'].sha256,
  independentConsumer: {lockSha256, ...runtime},
  candidateFiles: evidenceInputs,
  findings: {p0: [], p1: [], p2: []},
  limitations: [
    'This verifies local RC tarballs and an external installed consumer; it is not npm publication, provenance attestation, deployment, dist-tag promotion, or stable-release approval.',
    'Network denial applies to ordinary local imports, core parsing, local audit execution, and the selected package entry points. Optional HTTP, MCP, and BYOK integrations intentionally require host-authorized network access.',
    'The high-confidence secret scan is pattern-based and is not proof that no sensitive value could exist under an unrecognized format.',
  ],
};
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({output, packages: packageAudits.length, exportCount: specifiers.length, runtime: 'passed'}, null, 2));

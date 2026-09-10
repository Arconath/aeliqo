import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join, resolve} from 'node:path';

const [sourceRootArg, candidateDirArg, consumerDirArg] = process.argv.slice(2);
if (!sourceRootArg || !candidateDirArg || !consumerDirArg) throw new Error('usage: audit SOURCE_ROOT CANDIDATE_DIR CONSUMER_DIR');
const sourceRoot = resolve(sourceRootArg);
const candidateDir = resolve(candidateDirArg);
const consumerDir = resolve(consumerDirArg);
const helpers = await import(`file://${join(sourceRoot, 'scripts/release/candidate-lib.mjs')}`);
const candidate = JSON.parse(await readFile(join(candidateDir, 'manifest.json'), 'utf8'));
const lockBytes = await readFile(join(consumerDir, 'package-lock.json'));
const lock = JSON.parse(lockBytes.toString('utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const command = (name, args, options = {}) => {
  const result = spawnSync(name, args, {cwd: consumerDir, encoding: 'utf8', env: {...process.env, npm_config_offline: 'true'}, ...options});
  if (result.status !== 0 || result.error) throw new Error(`${name} failed: ${result.error?.message ?? result.stdout + result.stderr}`);
  return result.stdout.trim();
};
const tarManifest = archive => {
  const result = spawnSync('tar', ['-xOzf', archive, 'package/package.json'], {encoding: 'utf8'});
  if (result.status !== 0 || result.error) throw new Error(`cannot inspect ${archive}`);
  return JSON.parse(result.stdout);
};
const tarPaths = archive => {
  const result = spawnSync('tar', ['-tzf', archive], {encoding: 'utf8'});
  if (result.status !== 0 || result.error) throw new Error(`cannot list ${archive}`);
  return result.stdout.trim().split('\n').filter(Boolean);
};

const installed = [];
const specifiers = [];
for (const item of candidate.packages) {
  const entry = lock.packages[`node_modules/${item.name}`];
  assert(entry, `missing installed lock entry for ${item.name}`);
  assert.equal(entry.version, candidate.version);
  assert.equal(entry.integrity, item.integrity);
  const installedManifest = JSON.parse(await readFile(join(consumerDir, 'node_modules', item.name, 'package.json'), 'utf8'));
  assert.equal(installedManifest.name, item.name);
  assert.equal(installedManifest.version, candidate.version);
  assert.equal(installedManifest.license, 'Apache-2.0');
  const archive = join(candidateDir, item.file);
  const packedManifest = tarManifest(archive);
  assert.deepEqual(installedManifest, packedManifest);
  specifiers.push(...helpers.exportSpecifiers(packedManifest, tarPaths(archive)));
  installed.push({name: item.name, version: entry.version, integrity: entry.integrity});
}
assert.equal(new Set(specifiers).size, 130);
const imports = [...new Set(specifiers)].sort().map((specifier, index) => specifier.endsWith('.json')
  ? `import Export${index} from ${JSON.stringify(specifier)} with { type: "json" }; export type ExportCheck${index} = typeof Export${index};`
  : `import * as Export${index} from ${JSON.stringify(specifier)}; export type ExportCheck${index} = typeof Export${index};`);
await writeFile(join(consumerDir, 'exports.ts'), imports.join('\n') + '\n');
await writeFile(join(consumerDir, 'tsconfig.json'), JSON.stringify({compilerOptions: {
  target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true,
  noEmit: true, skipLibCheck: false, resolveJsonModule: true,
  lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: ['node', 'react', 'react-dom'],
}, include: ['exports.ts']}, null, 2) + '\n');
command(join(consumerDir, 'node_modules/.bin/tsc'), ['--project', 'tsconfig.json']);

await writeFile(join(consumerDir, 'network-blocker.cjs'), [
  "const {syncBuiltinESMExports} = require('node:module');",
  "const state = {attempts: []}; globalThis.__aeliqoOfflineNetwork = state;",
  "const blocked = label => () => { state.attempts.push(label); const error = new Error('network access is forbidden in the offline release consumer'); error.code = 'AELIQO_OFFLINE_NETWORK_BLOCKED'; throw error; };",
  "globalThis.fetch = blocked('fetch');",
  "for (const name of ['node:http', 'node:https']) { const value = require(name); value.request = blocked(`${name.slice(5)}.request`); value.get = blocked(`${name.slice(5)}.get`); }",
  "const net = require('node:net'); net.connect = blocked('net.connect'); net.createConnection = blocked('net.createConnection'); net.Socket.prototype.connect = blocked('net.Socket.connect');",
  "const dns = require('node:dns'); dns.lookup = blocked('dns.lookup'); dns.resolve = blocked('dns.resolve');",
  "syncBuiltinESMExports();",
].join('\n') + '\n');
await writeFile(join(consumerDir, 'runtime-smoke.mjs'), [
  "import {parseContract} from '@aeliqo/sdk-core';",
  "const modules = await Promise.all([import('@aeliqo/sdk-runtime/evaluation'), import('@aeliqo/sdk-runtime/audit'), import('@aeliqo/sdk-web/server'), import('@aeliqo/sdk-web/styles'), import('@aeliqo/sdk-agent/protocol'), import('@aeliqo/sdk-devtools'), import('@aeliqo/sdk-react/ssr')]);",
  "const boundedRejection = parseContract('catalog', '{}');",
  "const audit = modules[1].createLocalAuditExporter({maxEvents: 2, maxBytes: 1024, now: () => 1});",
  "const recorded = audit.record({kind: 'source', transport: 'local', status: 'error', code: 'source.invalid'}); const exported = audit.exportSnapshot(); audit.dispose();",
  "const styleText = modules[3].aeliqoThemeStyleText;",
  "const stateBeforeProbes = globalThis.__aeliqoOfflineNetwork; const auditNetworkAttempts = stateBeforeProbes?.attempts.length;",
  "if (boundedRejection.ok || !recorded.ok || !exported.ok || exported.value.records.length !== 1 || typeof styleText !== 'string' || styleText.length < 1000 || !stateBeforeProbes || auditNetworkAttempts !== 0) throw new Error('installed runtime smoke failed');",
  "const [http, https, net, dns] = await Promise.all([import('node:http'), import('node:https'), import('node:net'), import('node:dns')]);",
  "const probes = [['fetch', () => fetch('https://example.invalid')], ['http.request', () => http.request('http://example.invalid')], ['http.get', () => http.get('http://example.invalid')], ['https.request', () => https.request('https://example.invalid')], ['https.get', () => https.get('https://example.invalid')], ['net.connect', () => net.connect(9, 'example.invalid')], ['net.createConnection', () => net.createConnection(9, 'example.invalid')], ['net.Socket.connect', () => new net.Socket().connect(9, 'example.invalid')], ['dns.lookup', () => dns.lookup('example.invalid', () => {})], ['dns.resolve', () => dns.resolve('example.invalid', () => {})]];",
  "for (const [label, probe] of probes) { try { probe(); throw new Error(`network probe unexpectedly succeeded: ${label}`); } catch (error) { if (error?.code !== 'AELIQO_OFFLINE_NETWORK_BLOCKED') throw error; } }",
  "const state = globalThis.__aeliqoOfflineNetwork; if (JSON.stringify(state.attempts) !== JSON.stringify(probes.map(([label]) => label))) throw new Error('network blocker mismatch');",
  "process.stdout.write(JSON.stringify({networkDenied:true, deniedMethods:state.attempts, aeliqoModulesLoaded:8, coreParserExecuted:true, auditExecuted:true, auditNetworkAttempts, styleExportExecuted:true, styleCssTextBytes:Buffer.byteLength(styleText)}));",
].join('\n') + '\n');
const runtime = JSON.parse(command(process.execPath, ['--disallow-code-generation-from-strings', '--require', './network-blocker.cjs', 'runtime-smoke.mjs']));
assert.equal(runtime.auditNetworkAttempts, 0);

process.stdout.write(JSON.stringify({
  schema: 'aeliqo.t33.offline-consumer-independent-audit.v1',
  auditedAt: new Date().toISOString(),
  install: {offline: true, ignoreScripts: true, noAuditNetwork: true, packageLockSha256: sha256(lockBytes)},
  packageLockEntries: Object.keys(lock.packages).length,
  installedPublicPackages: installed,
  publicPackageIdentitiesAndIntegritiesExact: true,
  exportSpecifiersTypeChecked: new Set(specifiers).size,
  strictTypeCheck: true,
  runtime,
}, null, 2) + '\n');

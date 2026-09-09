#!/usr/bin/env node
/** Build, inspect, and consume the six exact public package tarballs. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {access, mkdir, mkdtemp, readFile, readdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename, join, relative, resolve} from 'node:path';
import {
  PUBLIC_PACKAGES, RELEASE_VERSION, assertExportTargets, assertPublicManifest,
  assertTarballPaths, candidateManifest, cyclonedxSbom,
  readJson, sha256, sha512Integrity,
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
const outputArgument = positional[0];
const output = resolve(root, outputArgument ?? 'artifacts/release-candidate');
if (relative(root, output).startsWith('..')) throw new Error('Candidate output must remain within the repository');

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {cwd: options.cwd ?? root, encoding: 'utf8', timeout: options.timeout ?? 300_000});
  if (result.error || result.status !== 0) throw new Error(`${commandName} ${args.join(' ')} failed\n${result.error?.message ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  return result.stdout.trim();
}
function requireVersion(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} ${expected} is required; received ${actual}`);
}
async function exists(path) { try { await access(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }

function verifyToolchain() {
  requireVersion(process.versions.node, '24.20.0', 'Node');
  requireVersion(command('pnpm', ['--version']), '11.24.0', 'pnpm');
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
async function buildAndPack() {
  const packages = [];
  for (const shortName of PUBLIC_PACKAGES) {
    const directory = join(root, 'packages', shortName);
    const source = await readJson(join(directory, 'package.json'));
    const expectedName = `@aeliqo/${shortName}`;
    // Source uses pnpm's workspace protocol; the packed manifest must replace
    // every one of those edges with the exact candidate version below.
    assertPublicManifest(source, expectedName, version, {allowWorkspace: true});
    command('pnpm', ['--filter', expectedName, 'build']);
    command('pnpm', ['pack', '--pack-destination', output], {cwd: directory});
    const tarball = join(output, `aeliqo-${shortName}-${version}.tgz`);
    if (!await exists(tarball)) throw new Error(`pnpm pack did not produce expected ${tarball}`);
    const manifest = packedJson(tarball);
    assertPublicManifest(manifest, expectedName, version);
    const paths = archivePaths(tarball);
    assertTarballPaths(paths, expectedName);
    assertExportTargets(manifest, paths, expectedName);
    const bytes = await readFile(tarball);
    packages.push({name: expectedName, manifest, file: basename(tarball), path: tarball, sha256: sha256(bytes), integrity: sha512Integrity(bytes), bytes: bytes.byteLength});
  }
  return packages;
}

async function externalConsumer(packages) {
  const consumer = await mkdtemp(join(tmpdir(), 'aeliqo-release-consumer-'));
  await writeFile(join(consumer, 'package.json'), JSON.stringify({private: true, type: 'module'}, null, 2) + '\n');
  command('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact', ...packages.map(item => item.path)], {cwd: consumer});
  const lock = await readJson(join(consumer, 'package-lock.json'));
  for (const item of packages) {
    const installed = lock.packages[`node_modules/${item.name}`];
    if (!installed || installed.version !== version || installed.integrity !== item.integrity) throw new Error(`Consumer did not install exact ${item.name} tarball`);
  }
  // Import intentionally server-safe public entry points. This proves resolution
  // from node_modules, while browser/React rendering has dedicated consumer gates.
  await writeFile(join(consumer, 'consumer.mjs'), [
    "import '@aeliqo/core';", "import '@aeliqo/runtime/evaluation';", "import '@aeliqo/web/server';",
    "import '@aeliqo/agent/protocol';", "import '@aeliqo/devtools';", "import '@aeliqo/react/ssr';",
  ].join('\n') + '\n');
  command('node', ['--disallow-code-generation-from-strings', 'consumer.mjs'], {cwd: consumer});
  return {lockSha256: sha256(await readFile(join(consumer, 'package-lock.json'))), packages: packages.map(item => item.name)};
}

verifyToolchain();
await prepareOutput();
const sourceRevision = command('git', ['rev-parse', 'HEAD']);
const packages = await buildAndPack();
const consumer = await externalConsumer(packages);
const manifest = candidateManifest({sourceRevision, packages, version});
const sbom = cyclonedxSbom({sourceRevision, packages, version});
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(join(output, 'sbom.cdx.json'), JSON.stringify(sbom, null, 2) + '\n');
console.log(JSON.stringify({output, sourceRevision, tarballs: packages.map(item => item.file), consumer}, null, 2));

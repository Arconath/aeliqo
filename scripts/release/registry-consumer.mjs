#!/usr/bin/env node
/** Install and verify one exact six-package release directly from npm. */
import {spawnSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {PUBLIC_PACKAGE_NAMES, readJson, sha256} from './candidate-lib.mjs';

const root = resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const value = flag => { const index = args.indexOf(flag); return index === -1 ? undefined : args[index + 1]; };
const version = value('--version');
const output = resolve(root, value('--output') ?? 'artifacts/registry-consumer.json');
if (!/^0\.1\.0(?:-rc\.[1-9]\d*)?$/.test(version ?? '')) throw new Error('A unique 0.1.0 or 0.1.0-rc.N --version is required');

function command(commandName, commandArgs, cwd) {
  const result = spawnSync(commandName, commandArgs, {cwd, encoding: 'utf8', timeout: 300_000});
  if (result.error || result.status !== 0) throw new Error(`${commandName} ${commandArgs.join(' ')} failed\n${result.error?.message ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
}
function literalExports(manifest) {
  return Object.keys(manifest.exports ?? {}).filter(path => !path.includes('*')).map(path => path === '.' ? manifest.name : `${manifest.name}${path.slice(1)}`);
}

const consumer = await mkdtemp(join(tmpdir(), 'aeliqo-registry-consumer-'));
try {
  const peers = new Map();
  for (const name of PUBLIC_PACKAGE_NAMES) {
    const shortName = name.slice('@aeliqo/'.length);
    const manifest = await readJson(join(root, 'packages', shortName, 'package.json'));
    for (const [peer, requested] of Object.entries(manifest.peerDependencies ?? {})) {
      if (!PUBLIC_PACKAGE_NAMES.includes(peer)) peers.set(peer, requested);
    }
  }
  const dependencies = Object.fromEntries(PUBLIC_PACKAGE_NAMES.map(name => [name, version]));
  for (const [name, requested] of [...peers].sort(([left], [right]) => left.localeCompare(right))) dependencies[name] = requested;
  const devDependencies = {typescript: '7.0.2', '@types/node': '24.13.3', '@types/react': '19.2.18', '@types/react-dom': '19.2.7'};
  await writeFile(join(consumer, 'package.json'), JSON.stringify({private: true, type: 'module', dependencies, devDependencies}, null, 2) + '\n');
  command('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact'], consumer);

  const installedManifests = [];
  const imports = [];
  for (const name of PUBLIC_PACKAGE_NAMES) {
    const manifest = await readJson(join(consumer, 'node_modules', name, 'package.json'));
    if (manifest.name !== name || manifest.version !== version) throw new Error(`Registry consumer received unexpected ${name} identity`);
    installedManifests.push(manifest);
    for (const specifier of literalExports(manifest)) imports.push(`import * as Export${imports.length} from ${JSON.stringify(specifier)}; export type ExportCheck${imports.length} = typeof Export${imports.length};`);
  }
  await writeFile(join(consumer, 'exports.ts'), imports.join('\n') + '\n');
  await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({compilerOptions: {
    target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true,
    noEmit: true, skipLibCheck: false, lib: ['ES2022', 'DOM', 'DOM.Iterable'], types: ['node', 'react', 'react-dom'],
  }, include: ['exports.ts']}, null, 2) + '\n');
  command(join(consumer, 'node_modules/.bin/tsc'), ['--project', 'tsconfig.json'], consumer);
  await writeFile(join(consumer, 'consumer.mjs'), [
    "import '@aeliqo/core';", "import '@aeliqo/runtime/evaluation';", "import '@aeliqo/web/server';",
    "import '@aeliqo/agent/protocol';", "import '@aeliqo/devtools';", "import '@aeliqo/react/ssr';",
  ].join('\n') + '\n');
  command('node', ['--disallow-code-generation-from-strings', 'consumer.mjs'], consumer);

  const lockBytes = await readFile(join(consumer, 'package-lock.json'));
  const lock = JSON.parse(lockBytes);
  const packages = PUBLIC_PACKAGE_NAMES.map(name => {
    const entry = lock.packages[`node_modules/${name}`];
    if (!entry?.integrity || entry.version !== version) throw new Error(`Registry lock has no exact integrity for ${name}@${version}`);
    return {name, version, integrity: entry.integrity, resolved: entry.resolved};
  });
  const report = {schema: 'aeliqo.registry-consumer.v1', checkedAt: new Date().toISOString(), version, exportCount: imports.length, lockSha256: sha256(lockBytes), packages};
  await mkdir(dirname(output), {recursive: true});
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({output, version, packages: packages.length, exportCount: imports.length, lockSha256: report.lockSha256}, null, 2));
} finally {
  await rm(consumer, {recursive: true, force: true});
}

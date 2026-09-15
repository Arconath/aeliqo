/** Build every playground export from exact local package tarballs in clean consumers. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RELEASE_VERSION } from '../../scripts/release/metadata.mjs';

const root = resolve(import.meta.dirname, '../..');
const evidenceRoot = join(root, 'artifacts/export-consumers');
await mkdir(evidenceRoot, { recursive: true });
const evidenceDirectory = await mkdtemp(join(evidenceRoot, 'run-'));
const consumerRoot = await mkdtemp(join(tmpdir(), 'aeliqo-export-consumers-'));

function run(command, args, cwd, timeout = 300_000) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed\n${result.error?.message ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
  }
  return result.stdout;
}

const tarballs = {};
for (const name of ['core', 'runtime', 'web']) {
  const packageDirectory = join(root, 'packages', name);
  run('pnpm', ['build'], packageDirectory);
  const tarball = join(evidenceDirectory, `aeliqo-${name}-${RELEASE_VERSION}.tgz`);
  run('pnpm', ['pack', '--out', tarball], packageDirectory);
  tarballs[`@aeliqo/${name}`] = tarball;
}

const templateModule = pathToFileURL(join(root, 'apps/playground/src/project-template.ts')).href;
const templateScript = `import(${JSON.stringify(templateModule)}).then(({projectFiles})=>process.stdout.write(JSON.stringify(Object.fromEntries(['people','products','support','knowledge'].map(id=>[id,projectFiles(id,${JSON.stringify(RELEASE_VERSION)})])))))`;
const projects = JSON.parse(
  run(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', templateScript], root),
);
const reports = [];

for (const scenario of ['people', 'products', 'support', 'knowledge']) {
  const directory = join(consumerRoot, scenario);
  await mkdir(directory, { recursive: true });
  const files = projects[scenario];
  assert(Array.isArray(files) && files.length > 0, `Missing ${scenario} project files`);
  for (const file of files) {
    const path = join(directory, file.path);
    await mkdir(resolve(path, '..'), { recursive: true });
    if (file.path === 'package.json') {
      const manifest = JSON.parse(file.content);
      for (const [name, tarball] of Object.entries(tarballs)) manifest.dependencies[name] = `file:${tarball}`;
      await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
    } else await writeFile(path, file.content);
  }
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], directory);
  run('npm', ['run', 'build'], directory);
  const html = await readFile(join(directory, 'dist/index.html'), 'utf8');
  assert.match(html, /src="\/assets\/[^"/]+\.js"/u, `${scenario} export has no browser bundle`);
  reports.push({ scenario, files: files.length, built: true });
}

await writeFile(
  join(evidenceDirectory, 'report.json'),
  `${JSON.stringify({ version: RELEASE_VERSION, source: 'playground-project-template', reports }, null, 2)}\n`,
);
await rm(consumerRoot, { recursive: true, force: true });
process.stdout.write(`${JSON.stringify({ evidenceDirectory, reports })}\n`);

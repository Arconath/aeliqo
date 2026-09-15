/** Prove one 0.1 direct-table consumer can migrate to the 0.3 application facade. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RELEASE_VERSION } from '../../scripts/release/metadata.mjs';

const root = resolve(import.meta.dirname, '../..');
const evidenceRoot = join(root, 'artifacts/migration-consumers');
await mkdir(evidenceRoot, { recursive: true });
const evidenceDirectory = await mkdtemp(join(evidenceRoot, 'run-'));
const consumerRoot = await mkdtemp(join(tmpdir(), 'aeliqo-migration-consumers-'));

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

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const legacy = join(consumerRoot, 'before-0.1');
await mkdir(join(legacy, 'src'), { recursive: true });
await writeFile(
  join(legacy, 'package.json'),
  `${JSON.stringify(
    {
      private: true,
      type: 'module',
      scripts: { build: 'tsc --noEmit && vite build' },
      dependencies: {
        '@aeliqo/core': '0.1.0',
        '@aeliqo/runtime': '0.1.0',
        '@aeliqo/web': '0.1.0',
      },
      devDependencies: { typescript: '7.0.2', vite: '8.2.2' },
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  join(legacy, 'tsconfig.json'),
  `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        lib: ['ES2022', 'DOM'],
        types: ['vite/client'],
        strict: true,
        noEmit: true,
      },
      include: ['src/**/*.ts'],
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  join(legacy, 'index.html'),
  '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>People before migration</title></head><body><main><h1>People</h1><div id="app"></div></main><script type="module" src="/src/main.ts"></script></body></html>\n',
);
await copyFile(join(root, 'examples/migration-0.1/before.ts'), join(legacy, 'src/main.ts'));

try {
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], legacy);
  run('npm', ['run', 'build'], legacy);
  const legacyLock = await readFile(join(legacy, 'package-lock.json'));
  const legacyManifest = JSON.parse(await readFile(join(legacy, 'node_modules/@aeliqo/web/package.json'), 'utf8'));
  assert.equal(legacyManifest.version, '0.1.0');
  const legacyAssets = await readdir(join(legacy, 'dist/assets'));
  const legacyJavaScript = legacyAssets.filter((name) => name.endsWith('.js'));
  assert(legacyJavaScript.length > 0, 'The 0.1 consumer has no browser bundle.');
  const legacyBundle = (
    await Promise.all(legacyJavaScript.map((name) => readFile(join(legacy, 'dist/assets', name), 'utf8')))
  ).join('\n');
  assert.match(legacyBundle, /Ada Chen/u);
  assert.match(legacyBundle, /Sam Rivera/u);

  const tarballs = {};
  for (const name of ['core', 'runtime', 'web']) {
    const packageDirectory = join(root, 'packages', name);
    run('pnpm', ['build'], packageDirectory);
    const tarball = join(evidenceDirectory, `aeliqo-${name}-${RELEASE_VERSION}.tgz`);
    run('pnpm', ['pack', '--out', tarball], packageDirectory);
    tarballs[`@aeliqo/${name}`] = tarball;
  }

  const templateModule = pathToFileURL(join(root, 'apps/playground/src/project-template.ts')).href;
  const script = `import(${JSON.stringify(templateModule)}).then(({projectFiles})=>process.stdout.write(JSON.stringify(projectFiles('people',${JSON.stringify(RELEASE_VERSION)}))))`;
  const files = JSON.parse(
    run(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], root),
  );
  const migrated = join(consumerRoot, 'after-0.3');
  await mkdir(migrated, { recursive: true });
  for (const file of files) {
    const path = join(migrated, file.path);
    await mkdir(resolve(path, '..'), { recursive: true });
    if (file.path === 'package.json') {
      const manifest = JSON.parse(file.content);
      for (const [name, tarball] of Object.entries(tarballs)) manifest.dependencies[name] = `file:${tarball}`;
      await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
    } else await writeFile(path, file.content);
  }
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], migrated);
  run('npm', ['run', 'build'], migrated);
  const migratedLock = await readFile(join(migrated, 'package-lock.json'));
  const migratedSource = await readFile(join(migrated, 'src/main.ts'), 'utf8');
  assert.match(migratedSource, /createAeliqoApp/u);
  assert.match(migratedSource, /Ada Chen/u);
  assert.match(migratedSource, /Sam Rivera/u);
  assert.match(migratedSource, /kind: 'browse'/u);
  assert.match(migratedSource, /app\.dispose\(\)/u);

  const report = {
    from: '0.1.0',
    to: RELEASE_VERSION,
    before: { source: 'direct aeliqo-table', lockSha256: sha256(legacyLock), built: true },
    after: { source: 'createAeliqoApp browse intent', lockSha256: sha256(migratedLock), built: true },
    preservedFixture: ['Ada Chen', 'Sam Rivera'],
  };
  await writeFile(join(evidenceDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ evidenceDirectory, ...report })}\n`);
} finally {
  await rm(consumerRoot, { recursive: true, force: true });
}

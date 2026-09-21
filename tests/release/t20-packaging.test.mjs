import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'vite';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir, arch, platform, release } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  PUBLIC_PACKAGE_NAMES,
  RELEASE_VERSION,
  assertExportTargets,
  assertPublicManifest,
  assertTarballPaths,
  exportSpecifiers,
} from '../../scripts/release/candidate-lib.mjs';

const root = resolve(import.meta.dirname, '../..');
const publicPackageNames = PUBLIC_PACKAGE_NAMES.map((name) => name.slice('@aeliqo/'.length));

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

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function packageNameFromLockPath(path) {
  const tail = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const parts = tail.split('/');
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

function archiveEntries(archive) {
  return run('tar', ['-tzf', archive], root).trim().split('\n').filter(Boolean);
}

function archiveFile(archive, path) {
  return Buffer.from(run('tar', ['-xOf', archive, path], root, 30_000));
}

async function stagePackage(name, runDirectory, version) {
  const directory = join(root, 'packages', name);
  const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
  const stage = join(runDirectory, 'staged', name);
  await mkdir(stage, { recursive: true });
  const stagedManifest = structuredClone(manifest);
  stagedManifest.version = version;
  delete stagedManifest.devDependencies;
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const dependency of Object.keys(stagedManifest[field] ?? {})) {
      if (PUBLIC_PACKAGE_NAMES.includes(dependency)) stagedManifest[field][dependency] = version;
    }
  }
  await writeFile(join(stage, 'package.json'), `${JSON.stringify(stagedManifest, null, 2)}\n`);
  for (const file of manifest.files ?? []) {
    const source = file === 'README.md' ? join(root, 'docs/packages', `${name}.md`) : join(directory, file);
    await cp(source, join(stage, file), { recursive: true });
  }
  const archive = join(runDirectory, `aeliqo-${name}-${version}.tgz`);
  run('pnpm', ['pack', '--out', archive], stage);
  return { archive, directory, manifest, paths: archiveEntries(archive) };
}

async function packPublicPackages(runDirectory, version) {
  const artifacts = [];
  for (const name of publicPackageNames) artifacts.push(await stagePackage(name, runDirectory, version));
  return artifacts;
}

function assertPackedArtifacts(artifacts, version, canonicalNotice, canonicalLicense, packageGuides) {
  for (const artifact of artifacts) {
    const packed = JSON.parse(archiveFile(artifact.archive, 'package/package.json').toString('utf8'));
    assertPublicManifest(packed, artifact.manifest.name, version);
    assertTarballPaths(artifact.paths, artifact.manifest.name);
    assertExportTargets(packed, artifact.paths, artifact.manifest.name);
    assert.deepEqual(
      packed.exports,
      artifact.manifest.exports,
      `${artifact.manifest.name} export map changed while packing`,
    );
    assert.equal(packed.version, version);
    assert.deepEqual(archiveFile(artifact.archive, 'package/LICENSE'), canonicalLicense);
    assert.deepEqual(archiveFile(artifact.archive, 'package/NOTICE'), canonicalNotice);
    assert.deepEqual(archiveFile(artifact.archive, 'package/README.md'), packageGuides[artifact.manifest.name]);
    assert(
      exportSpecifiers(packed, artifact.paths).length > 0,
      `${artifact.manifest.name} has no packed export specifiers`,
    );
    if (artifact.manifest.name === '@aeliqo/agent') {
      for (const peer of Object.keys(packed.peerDependencies ?? {}))
        assert.equal(packed.peerDependenciesMeta?.[peer]?.optional, true, `Agent peer ${peer} must stay optional`);
    }
    if (artifact.manifest.name === '@aeliqo/web')
      assert.equal(packed.peerDependenciesMeta?.['@aeliqo/runtime']?.optional, true);
    if (artifact.manifest.name === '@aeliqo/react')
      assert.notEqual(packed.peerDependenciesMeta?.['@aeliqo/runtime']?.optional, true);
  }
}

async function installConsumer(consumer, artifacts, version) {
  const dependencies = Object.fromEntries(
    artifacts.map((artifact) => [artifact.manifest.name, `file:${artifact.archive}`]),
  );
  await writeFile(
    join(consumer, 'package.json'),
    `${JSON.stringify(
      {
        name: 'aeliqo-t20-clean-consumer',
        private: true,
        type: 'module',
        dependencies: {
          ...dependencies,
          '@types/node': '24.13.3',
          '@types/react': '19.2.18',
          '@types/react-dom': '19.2.7',
          lit: '3.3.3',
          react: '19.2.8',
          'react-dom': '19.2.8',
          typescript: '7.0.2',
          vite: '8.2.2',
          vue: '3.5.42',
          zod: '4.5.4',
        },
      },
      null,
      2,
    )}\n`,
  );
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--save-exact'], consumer);
  const lock = JSON.parse(await readFile(join(consumer, 'package-lock.json'), 'utf8'));
  for (const artifact of artifacts) {
    const installed = lock.packages[`node_modules/${artifact.manifest.name}`];
    assert.equal(
      installed?.version,
      version,
      `${artifact.manifest.name} was not installed at the candidate source version`,
    );
    assert.deepEqual(
      Object.keys(lock.packages).filter((path) => path.endsWith(`node_modules/${artifact.manifest.name}`)),
      [`node_modules/${artifact.manifest.name}`],
      `${artifact.manifest.name} was installed more than once`,
    );
  }
  return lock;
}

async function writeConsumerSources(consumer, fixtureDirectory) {
  await cp(join(fixtureDirectory, 'legacy-usage.ts'), join(consumer, 'legacy-usage.ts'));
  await cp(join(fixtureDirectory, 'vnext-entries.ts'), join(consumer, 'new-entries.ts'));
  await writeFile(
    join(consumer, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          jsx: 'react-jsx',
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          types: ['node', 'react', 'react-dom'],
        },
        files: ['legacy-usage.ts', 'new-entries.ts'],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(consumer, 'legacy-run.mjs'),
    [
      "const modules = await Promise.all([import('@aeliqo/core'), import('@aeliqo/runtime'), import('@aeliqo/web'), import('@aeliqo/react'), import('@aeliqo/agent')]);",
      "const names = ['defineResource', 'createAeliqoRuntime', 'registerAeliqoElements', 'AeliqoProvider', 'createAppToolEndpoint'];",
      "for (const [module, name] of modules.map((module, index) => [module, names[index]])) if (typeof module[name] !== 'function') throw new Error(`Missing legacy export ${name}`);",
      'console.log(JSON.stringify({legacy: true}));',
    ].join('\n') + '\n',
  );
  await writeFile(
    join(consumer, 'new-run.mjs'),
    [
      "const entries = await Promise.all([import('@aeliqo/core/features'), import('@aeliqo/runtime/surfaces'), import('@aeliqo/runtime/scopes'), import('@aeliqo/react/surface'), import('@aeliqo/agent/browser')]);",
      "for (const [module, names] of [[entries[0], ['defineDataFeature', 'defineFeature', 'inferLocalDataShape']], [entries[1], ['createLocalDataBinding']], [entries[3], ['AdaptiveSurface', 'AeliqoScope', 'ViewSurface', 'defineReactViews', 'useSurfaceState']], [entries[4], ['connectAgent', 'createScopedSurfaceEndpoint']]]) for (const name of names) if (!(name in module)) throw new Error(`Missing vNext export ${name}`);",
      "if (typeof entries[2] !== 'object') throw new Error('Runtime scope entry did not load');",
      'console.log(JSON.stringify({vNext: true}));',
    ].join('\n') + '\n',
  );
  await cp(join(fixtureDirectory, 'no-agent-forbidden.mjs'), join(consumer, 'no-agent-forbidden.mjs'));
  await writeFile(
    join(consumer, 'no-agent-entry.mjs'),
    [
      "import { defineDataFeature } from '@aeliqo/core/features';",
      "import { createLocalDataBinding } from '@aeliqo/runtime/surfaces';",
      "import { registerAeliqoElements } from '@aeliqo/web';",
      "import { defineReactViews } from '@aeliqo/react/surface';",
      'globalThis.__aeliqoT20NoAgent = { defineDataFeature, createLocalDataBinding, registerAeliqoElements, defineReactViews };',
    ].join('\n') + '\n',
  );
}

async function typecheckConsumer(consumer) {
  run(process.execPath, [join(consumer, 'node_modules/typescript/bin/tsc'), '--project', 'tsconfig.json'], consumer);
  const legacyOutput = run(process.execPath, ['legacy-run.mjs'], consumer, 60_000);
  const modernOutput = run(process.execPath, ['new-run.mjs'], consumer, 60_000);
  assert.deepEqual(JSON.parse(legacyOutput), { legacy: true });
  assert.deepEqual(JSON.parse(modernOutput), { vNext: true });
}

function bundleModules(result, consumer) {
  const outputs = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  const modules = new Set();
  for (const output of outputs) {
    if (output.type !== 'chunk') continue;
    for (const moduleId of Object.keys(output.modules)) {
      const normalized = moduleId.replaceAll('\\', '/');
      modules.add(
        normalized.startsWith(`${consumer.replaceAll('\\', '/')}/`)
          ? normalized.slice(consumer.length + 1)
          : normalized,
      );
    }
    for (const imported of [...(output.imports ?? []), ...(output.dynamicImports ?? [])]) modules.add(imported);
  }
  return [...modules].sort();
}

async function bundleEntry(consumer, entry) {
  return bundleModules(
    await build({
      configFile: false,
      root: consumer,
      logLevel: 'error',
      build: {
        write: false,
        minify: false,
        target: 'es2022',
        rollupOptions: {
          input: join(consumer, entry),
          treeshake: false,
          output: { format: 'es', codeSplitting: false },
        },
      },
    }),
    consumer,
  );
}

function forbiddenPackageNames(lock) {
  return Object.keys(lock.packages)
    .filter((path) => path.includes('node_modules/'))
    .map(packageNameFromLockPath)
    .filter((name, index, names) => names.indexOf(name) === index)
    .filter((name) => name === 'openai' || name === 'server-only' || name.startsWith('@modelcontextprotocol/'));
}

function isAgentModule(moduleId) {
  const normalized = moduleId.replaceAll('\\', '/');
  return (
    normalized === '@aeliqo/agent' ||
    normalized.startsWith('@aeliqo/agent/') ||
    normalized.includes('node_modules/@aeliqo/agent/') ||
    normalized.includes('/@aeliqo+agent@')
  );
}

function forbiddenModules(modules, lock) {
  const providerNames = forbiddenPackageNames(lock);
  return modules.filter((moduleId) => {
    const normalized = moduleId.replaceAll('\\', '/');
    return (
      normalized.startsWith('node:') ||
      isAgentModule(normalized) ||
      providerNames.some((name) => normalized.includes(`/node_modules/${name}/`))
    );
  });
}

function assertNoForbiddenModules(modules, lock) {
  const forbidden = forbiddenModules(modules, lock);
  if (forbidden.length > 0) throw new Error(`No-agent graph contains forbidden modules: ${forbidden.join(', ')}`);
}

async function assertNoAgentGraph(consumer, lock) {
  const positive = await bundleEntry(consumer, 'no-agent-entry.mjs');
  assert.doesNotThrow(() => assertNoForbiddenModules(positive, lock));
  assert.deepEqual(
    positive.filter((moduleId) => moduleId.includes('/node_modules/@aeliqo/web/dist/server/')),
    [],
    'The browser/no-agent entry imported the web server helper',
  );

  const negative = await bundleEntry(consumer, 'no-agent-forbidden.mjs');
  const detected = forbiddenModules(negative, lock);
  assert(detected.some(isAgentModule));
  assert.throws(() => assertNoForbiddenModules(negative, lock), /No-agent graph contains forbidden modules/);
  return { positive, negative: detected };
}

async function readQualificationInputs() {
  const metadata = JSON.parse(await readFile(join(root, 'release-metadata.json'), 'utf8'));
  const matrix = JSON.parse(await readFile(join(root, 'docs/support-matrix.json'), 'utf8'));
  const migration = await readFile(join(root, 'docs/site/pages/migration-0.4.md'), 'utf8');
  const releaseNotes = await readFile(join(root, 'docs/site/pages/release-notes.md'), 'utf8');
  const packagePage = await readFile(join(root, 'docs/site/pages/packages.md'), 'utf8');
  assert.equal(metadata.version, RELEASE_VERSION);
  assert.equal(metadata.previousVersion, '0.4.2');
  assert.equal(metadata.status, 'candidate');
  const candidateMetadata = metadata.next ?? matrix.candidate;
  assert.equal(candidateMetadata.version, matrix.candidate.version);
  assert.equal(candidateMetadata.status, matrix.candidate.status);
  assert.equal(candidateMetadata.baseVersion, matrix.candidate.baseVersion);
  assert.equal(candidateMetadata.compatibility, 'breaking');
  assert.match(
    candidateMetadata.line ?? `${candidateMetadata.version.split('.').slice(0, 2).join('.')}`,
    /^\d+\.\d+$/u,
  );
  assert.equal(
    `${candidateMetadata.version.split('.').slice(0, 2).join('.')}`,
    candidateMetadata.line ?? `${candidateMetadata.version.split('.').slice(0, 2).join('.')}`,
  );
  assert.equal(matrix.claims.unlimitedScale, false);
  assert.equal(matrix.claims.everyFramework, false);
  assert.equal(matrix.claims.everyProvider, false);
  assert.equal(matrix.claims.stablePublished, false);
  assert.match(migration, /0\.4\.2/u);
  assert.match(migration, /0\.5\.0/u);
  assert.match(releaseNotes, /vNext candidate \(0\.5\.0, unreleased\)/u);
  assert.match(packagePage, /vNext migration guide/u);
  for (const entry of [
    '@aeliqo/core/features',
    '@aeliqo/runtime/surfaces',
    '@aeliqo/runtime/scopes',
    '@aeliqo/react/surface',
    '@aeliqo/agent/browser',
  ])
    assert.match(migration, new RegExp(entry.replaceAll('/', '\\/'), 'u'));
  return { metadata, matrix };
}

test('T20 packages, migrates, and qualifies support from packed artifacts', async () => {
  const { metadata, matrix } = await readQualificationInputs();
  const candidateVersion = (metadata.next ?? matrix.candidate).version;
  const evidenceRoot = join(root, 'artifacts/t20-qualification');
  await mkdir(evidenceRoot, { recursive: true });
  const runDirectory = await mkdtemp(join(evidenceRoot, 'run-'));
  const consumer = await mkdtemp(join(tmpdir(), 'aeliqo-t20-consumer-'));
  try {
    const [canonicalNotice, canonicalLicense] = await Promise.all([
      readFile(join(root, 'NOTICE')),
      readFile(join(root, 'LICENSE')),
    ]);
    const packageGuides = Object.fromEntries(
      await Promise.all(
        publicPackageNames.map(async (name) => [
          `@aeliqo/${name}`,
          await readFile(join(root, 'docs/packages', `${name}.md`)),
        ]),
      ),
    );
    const artifacts = await packPublicPackages(runDirectory, candidateVersion);
    assertPackedArtifacts(artifacts, candidateVersion, canonicalNotice, canonicalLicense, packageGuides);
    const lock = await installConsumer(consumer, artifacts, candidateVersion);
    await writeConsumerSources(consumer, join(root, 'tests/release/fixtures'));
    await typecheckConsumer(consumer);
    const graph = await assertNoAgentGraph(consumer, lock);
    const packageReports = await Promise.all(
      artifacts.map(async (artifact) => ({
        name: artifact.manifest.name,
        version: candidateVersion,
        tarball: artifact.archive,
        sha256: digest(await readFile(artifact.archive)),
        exports: exportSpecifiers(artifact.manifest, artifact.paths),
        notices: { license: true, notice: true, readme: true },
      })),
    );
    const report = {
      schema: 'aeliqo.t20-qualification.v1',
      sourceRevision: run('git', ['rev-parse', 'HEAD'], root, 30_000).trim(),
      stableVersion: metadata.previousVersion,
      candidate: matrix.candidate,
      packageArtifacts: {
        version: candidateVersion,
        role: 'vnext-candidate-consumer',
        candidatePublished: false,
      },
      environment: { node: process.version, os: platform(), release: release(), arch: arch() },
      packages: packageReports,
      legacyConsumer: { typecheck: true, runtime: true },
      vNextConsumer: { typecheck: true, runtime: true },
      noAgentGraph: { positiveModules: graph.positive, negativeDetected: graph.negative },
      claims: matrix.claims,
    };
    await writeFile(join(runDirectory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      JSON.stringify(
        {
          report: `${runDirectory.slice(root.length + 1)}/report.json`,
          packages: artifacts.length,
          legacyConsumer: true,
          vNextConsumer: true,
          noAgentModules: graph.positive.length,
          negativeForbiddenModules: graph.negative.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await rm(consumer, { recursive: true, force: true });
  }
});

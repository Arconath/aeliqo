import assert from 'node:assert/strict';
import { access, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  PUBLIC_PACKAGE_NAMES,
  RELEASE_VERSION,
  assertExportTargets,
  assertPublicManifest,
  assertPublishOrder,
  assertTarballPaths,
  candidateManifest,
  classifyRegistryVersionResponse,
  cyclonedxSbom,
  exportSpecifiers,
  npmOverridesFromPnpmLock,
  packagePurl,
  pnpmLockIntegrities,
  removeDirectoryOnFailure,
  sha256,
  sha512Integrity,
} from '../../scripts/release/candidate-lib.mjs';

const manifest = {
  name: '@aeliqo/core',
  version: RELEASE_VERSION,
  license: 'Apache-2.0',
  exports: { '.': { types: './dist/index.d.ts', import: './dist/index.js' }, './schemas/*': './schemas/*' },
  dependencies: {},
};
const paths = [
  'package/',
  'package/package.json',
  'package/README.md',
  'package/LICENSE',
  'package/NOTICE',
  'package/dist/index.js',
  'package/dist/index.d.ts',
  'package/schemas/catalog.json',
];

test('accepts public manifest and strict packed content', () => {
  assert.doesNotThrow(() => assertPublicManifest(manifest, '@aeliqo/core'));
  assert.doesNotThrow(() => assertTarballPaths(paths, '@aeliqo/core'));
  assert.doesNotThrow(() => assertExportTargets(manifest, paths, '@aeliqo/core'));
  assert.deepEqual(exportSpecifiers(manifest, paths), ['@aeliqo/core', '@aeliqo/core/schemas/catalog.json']);
});
test('rejects leaked source, secrets, workspace aliases, and missing exports', () => {
  assert.throws(() => assertTarballPaths([...paths, 'package/src/index.ts'], '@aeliqo/core'), /non-allowlisted/);
  assert.throws(
    () => assertTarballPaths([...paths, 'package/dist/.env.production'], '@aeliqo/core'),
    /sensitive-looking/,
  );
  assert.throws(
    () => assertPublicManifest({ ...manifest, dependencies: { '@aeliqo/runtime': 'workspace:*' } }, '@aeliqo/core'),
    /non-exact internal/,
  );
  assert.throws(
    () => assertExportTargets({ ...manifest, exports: { '.': './dist/missing.js' } }, paths, '@aeliqo/core'),
    /absent/,
  );
});
test('candidate manifest and CycloneDX use exact tarball identities', () => {
  const dependencies = {
    '@aeliqo/core': {},
    '@aeliqo/runtime': { '@aeliqo/core': RELEASE_VERSION },
    '@aeliqo/web': { '@aeliqo/core': RELEASE_VERSION },
    '@aeliqo/agent': { '@aeliqo/core': RELEASE_VERSION, '@aeliqo/runtime': RELEASE_VERSION },
    '@aeliqo/devtools': { '@aeliqo/core': RELEASE_VERSION, '@aeliqo/runtime': RELEASE_VERSION },
    '@aeliqo/react': { '@aeliqo/web': RELEASE_VERSION },
  };
  const packages = PUBLIC_PACKAGE_NAMES.map((name, index) => ({
    name,
    file: `${name.slice('@aeliqo/'.length)}.tgz`,
    sha256: String(index).repeat(64),
    integrity: `sha512-${Buffer.from(String(index)).toString('base64')}`,
    bytes: index + 1,
    manifest: { dependencies: dependencies[name] },
  }));
  const candidate = candidateManifest({ sourceRevision: 'deadbeef', packages });
  assert.deepEqual(candidate.publishOrder, PUBLIC_PACKAGE_NAMES);
  assert.throws(() => assertPublishOrder([...packages].reverse()), /published after/);
  const external = {
    name: 'zod',
    version: '4.5.4',
    ref: packagePurl('zod', '4.5.4'),
    integrity: `sha512-${Buffer.from('zod').toString('base64')}`,
    license: 'MIT',
  };
  const sbom = cyclonedxSbom({
    sourceRevision: 'deadbeef',
    packages,
    externalComponents: [external],
    dependencies: [{ ref: packagePurl('@aeliqo/core', RELEASE_VERSION), dependsOn: [external.ref] }],
  });
  assert.equal(sbom.bomFormat, 'CycloneDX');
  assert.equal(sbom.components.length, 7);
  assert.equal(sbom.components.find((item) => item.name === 'zod').hashes[0].alg, 'SHA-512');
  assert.equal(packagePurl('@aeliqo/core', RELEASE_VERSION), 'pkg:npm/%40aeliqo/core@0.1.0');
  assert.equal(sha256(Buffer.from('x')), '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881');
  assert.match(sha512Integrity(Buffer.from('x')), /^sha512-/);
});

test('registry and lock classification fail closed', () => {
  const integrity = 'sha512-dGVzdA==';
  assert.deepEqual(classifyRegistryVersionResponse(404, {}, '@aeliqo/core', '0.1.0', integrity), { state: 'absent' });
  assert.equal(
    classifyRegistryVersionResponse(
      200,
      { name: '@aeliqo/core', version: '0.1.0', dist: { integrity } },
      '@aeliqo/core',
      '0.1.0',
      integrity,
    ).state,
    'verified-existing',
  );
  assert.throws(() => classifyRegistryVersionResponse(503, {}, '@aeliqo/core', '0.1.0', integrity), /HTTP 503/);
  assert.throws(
    () =>
      classifyRegistryVersionResponse(
        200,
        { name: '@aeliqo/core', version: '0.1.0', dist: { integrity: 'sha512-other' } },
        '@aeliqo/core',
        '0.1.0',
        integrity,
      ),
    /different bytes/,
  );
  const lock = pnpmLockIntegrities(
    "packages:\n\n  'zod@4.5.4':\n    resolution: {integrity: sha512-dGVzdA==}\n\nsnapshots:\n",
  );
  assert.equal(lock.get('zod@4.5.4'), integrity);
});

test('npm consumer overrides reproduce parent-scoped pnpm resolutions', () => {
  const lock = [
    "lockfileVersion: '9.0'",
    '',
    'snapshots:',
    '',
    "  'parent@1.0.0(peer@2.0.0)':",
    '    dependencies:',
    '      child: 2.0.0',
    '    optionalDependencies:',
    '      optional-child: 4.0.0',
    '',
    '  parent@2.0.0:',
    '    dependencies:',
    '      child: 3.0.0',
    "      '@aeliqo/core': link:../core",
    '',
    '  child@2.0.0: {}',
    '',
  ].join('\n');
  assert.deepEqual(npmOverridesFromPnpmLock(lock, { ignoredPackages: PUBLIC_PACKAGE_NAMES }), {
    'parent@1.0.0': { child: '2.0.0', 'optional-child': '4.0.0' },
    'parent@2.0.0': { child: '3.0.0' },
  });
});

test('npm consumer override generation fails closed on ambiguous or exotic resolution', () => {
  const conflict = [
    'snapshots:',
    '  parent@1.0.0(peer@1.0.0):',
    '    dependencies:',
    '      child: 1.0.0',
    '  parent@1.0.0(peer@2.0.0):',
    '    dependencies:',
    '      child: 2.0.0',
  ].join('\n');
  assert.throws(() => npmOverridesFromPnpmLock(conflict), /Conflicting locked child/);
  assert.throws(
    () => npmOverridesFromPnpmLock('snapshots:\n  parent@1.0.0:\n    dependencies:\n      child: github:user/repo'),
    /Unsupported locked child/,
  );
});

test('failed temporary consumer work removes its allocated directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'aeliqo-consumer-cleanup-test-'));
  await writeFile(join(directory, 'partial-package-lock.json'), '{}\n');
  await assert.rejects(
    removeDirectoryOnFailure(directory, async () => {
      throw new Error('synthetic install failure');
    }),
    /synthetic install failure/,
  );
  await assert.rejects(access(directory), { code: 'ENOENT' });
});

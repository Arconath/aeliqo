import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RELEASE_VERSION, assertExportTargets, assertPublicManifest, assertTarballPaths,
  candidateManifest, cyclonedxSbom, sha256, sha512Integrity,
} from '../../scripts/release/candidate-lib.mjs';

const manifest = {
  name: '@aeliqo/core', version: RELEASE_VERSION, license: 'Apache-2.0',
  exports: {'.': {types: './dist/index.d.ts', import: './dist/index.js'}, './schemas/*': './schemas/*'},
  dependencies: {},
};
const paths = ['package/', 'package/package.json', 'package/README.md', 'package/LICENSE', 'package/NOTICE', 'package/dist/index.js', 'package/dist/index.d.ts', 'package/schemas/catalog.json'];

test('accepts public manifest and strict packed content', () => {
  assert.doesNotThrow(() => assertPublicManifest(manifest, '@aeliqo/core'));
  assert.doesNotThrow(() => assertTarballPaths(paths, '@aeliqo/core'));
  assert.doesNotThrow(() => assertExportTargets(manifest, paths, '@aeliqo/core'));
});
test('rejects leaked source, secrets, workspace aliases, and missing exports', () => {
  assert.throws(() => assertTarballPaths([...paths, 'package/src/index.ts'], '@aeliqo/core'), /non-allowlisted/);
  assert.throws(() => assertTarballPaths([...paths, 'package/dist/.env.production'], '@aeliqo/core'), /sensitive-looking/);
  assert.throws(() => assertPublicManifest({...manifest, dependencies: {'@aeliqo/runtime': 'workspace:*'}}, '@aeliqo/core'), /non-exact internal/);
  assert.throws(() => assertExportTargets({...manifest, exports: {'.': './dist/missing.js'}}, paths, '@aeliqo/core'), /absent/);
});
test('candidate manifest and CycloneDX use exact tarball identities', () => {
  const packages = [
    {name: '@aeliqo/runtime', file: 'runtime.tgz', sha256: 'b'.repeat(64), integrity: 'sha512-b', bytes: 2, manifest: {dependencies: {'@aeliqo/core': RELEASE_VERSION}}},
    {name: '@aeliqo/core', file: 'core.tgz', sha256: 'a'.repeat(64), integrity: 'sha512-a', bytes: 1, manifest: {dependencies: {}}},
  ];
  const candidate = candidateManifest({sourceRevision: 'deadbeef', packages});
  assert.deepEqual(candidate.packages.map(item => item.name), ['@aeliqo/core', '@aeliqo/runtime']);
  const sbom = cyclonedxSbom({sourceRevision: 'deadbeef', packages});
  assert.equal(sbom.bomFormat, 'CycloneDX');
  assert.deepEqual(sbom.dependencies.find(item => item.ref.includes('runtime')).dependsOn, ['pkg:npm/%40aeliqo%2Fcore@0.1.0']);
  assert.equal(sha256(Buffer.from('x')), '2d711642b726b04401627ca9fbac32f5c8530fb1903cc4db02258717921a4881');
  assert.match(sha512Integrity(Buffer.from('x')), /^sha512-/);
});

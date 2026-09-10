import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGACY_LINEAGES, MIGRATION_URL, classifyExactPackage, legacyDeprecationMessage,
} from '../../scripts/release/legacy-lineage-lib.mjs';

test('legacy deprecation is exact, allowlisted, and points to the migration', () => {
  assert.deepEqual(LEGACY_LINEAGES.map(item => `${item.name}@${item.version}`), [
    '@aeliqo/core@0.2.0',
    '@aeliqo/react@0.2.0',
    '@aeliqo/mcp@0.2.0',
    '@aeliqo/byok@0.2.0',
    '@aeliqo/webmcp-experimental@0.2.0',
    '@aeliqo/sdk-core@0.1.0-rc.1',
  ]);
  for (const lineage of LEGACY_LINEAGES) {
    assert.match(legacyDeprecationMessage(lineage), /incompatible with the supported 0\.1 package identity/);
    assert.match(legacyDeprecationMessage(lineage), new RegExp(MIGRATION_URL.replaceAll('.', '\\.')));
  }
  assert.throws(() => legacyDeprecationMessage({...LEGACY_LINEAGES[0]}), /not allowlisted/);
});

test('exact registry classification fails closed', () => {
  assert.deepEqual(classifyExactPackage(404, {}, '@aeliqo/core', '0.1.0'), {state: 'absent'});
  assert.deepEqual(
    classifyExactPackage(200, {name: '@aeliqo/core', version: '0.2.0'}, '@aeliqo/core', '0.2.0'),
    {state: 'visible', deprecated: null, integrity: null},
  );
  assert.deepEqual(
    classifyExactPackage(200, {name: '@aeliqo/core', version: '0.2.0', deprecated: 'legacy'}, '@aeliqo/core', '0.2.0'),
    {state: 'visible', deprecated: 'legacy', integrity: null},
  );
  assert.deepEqual(
    classifyExactPackage(
      200,
      {name: '@aeliqo/core', version: '0.1.0', dist: {integrity: 'sha512-good'}},
      '@aeliqo/core',
      '0.1.0',
      'sha512-good',
    ),
    {state: 'visible', deprecated: null, integrity: 'sha512-good'},
  );
  assert.throws(
    () => classifyExactPackage(
      200,
      {name: '@aeliqo/core', version: '0.1.0', dist: {integrity: 'sha512-wrong'}},
      '@aeliqo/core',
      '0.1.0',
      'sha512-good',
    ),
    /differ from the verified candidate/,
  );
  assert.throws(() => classifyExactPackage(503, {}, '@aeliqo/core', '0.2.0'), /HTTP 503/);
  assert.throws(
    () => classifyExactPackage(200, {name: '@aeliqo/react', version: '0.2.0'}, '@aeliqo/core', '0.2.0'),
    /wrong identity/,
  );
});

import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');

test('the three public applications assemble the complete static route set', async () => {
  const { generatePages, generatedRoot } = await import('../../apps/site/generate-pages.mjs');
  const inputs = await generatePages();
  const relativeInputs = inputs.map((path) => path.slice(generatedRoot.length));

  assert.ok(relativeInputs.includes('/index.html'), 'web owns the public root');
  assert.ok(relativeInputs.includes('/docs/index.html'), 'docs owns the documentation root');
  assert.ok(relativeInputs.includes('/playground/index.html'), 'playground owns its route');
  assert.ok(
    relativeInputs.includes('/docs/components/data.table/index.html'),
    'generated component docs remain complete',
  );
  assert.equal(relativeInputs.length, 96);

  await access(resolve(root, 'apps/web/index.html'));
  await access(resolve(root, 'apps/docs/src/docs.ts'));
  await access(resolve(root, 'apps/playground/src/playground.ts'));
  const assembly = JSON.parse(await readFile(resolve(root, 'apps/site/package.json'), 'utf8'));
  assert.equal(assembly.name, '@aeliqo/site-assembly');
  await assert.rejects(access(resolve(root, 'apps/site/src')));
});

test('the deployable web shell names each source application explicitly', async () => {
  const source = await readFile(resolve(root, 'apps/web/src/site.ts'), 'utf8');
  assert.match(source, /\/docs-src\/docs\.js/);
  assert.match(source, /\/playground-src\/playground\.js/);
});

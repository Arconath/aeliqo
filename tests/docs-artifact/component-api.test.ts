import { resolve } from 'node:path';
import { expect, it } from 'vitest';

type Metadata = {
  readonly sourceFiles: readonly string[];
  readonly dependencies: readonly string[];
  readonly sizing: readonly string[];
  readonly bounds: readonly string[];
};
type ComponentSources = Map<string, unknown>;
type ComponentApiModule = {
  readonly loadComponentSources: (root: string) => Promise<ComponentSources>;
  readonly componentApi: (classes: ComponentSources, name: string) => Metadata;
};

it('keeps generated component metadata inside the selected class lineage', async () => {
  const api = (await import('../../scripts/docs/component-api.mjs')) as ComponentApiModule;
  const classes = await api.loadComponentSources(resolve(process.cwd(), 'packages/web/src'));
  const table = api.componentApi(classes, 'AeliqoTableElement');
  const formFlow = api.componentApi(classes, 'AeliqoFormFlowElement');
  const comparison = api.componentApi(classes, 'AeliqoComparisonElement');

  expect(table.sourceFiles).toEqual(['packages/web/src/elements/aeliqo-table.ts']);
  expect(table.sourceFiles.every((path) => !path.startsWith('/') && !path.includes('..'))).toBe(true);
  expect(table.sizing).toContain('grid-template-columns');
  expect(table.bounds).toContain('The source-defined `AELIQO_TABLE_MAX_VIRTUAL_ROWS` limit is 100.');
  expect(table.bounds.join(' ')).toContain('`virtualCount` (default 40)');

  expect(formFlow.sourceFiles).toEqual(['packages/web/src/compound/base.ts', 'packages/web/src/compound/elements.ts']);
  expect(formFlow.sizing).toEqual(['flex-wrap']);
  expect(formFlow.bounds.join(' ')).not.toContain('MAX_COMPARISON');
  expect(comparison.bounds).toEqual([
    'The source-defined `MAX_COMPARISON_KEYS` limit is 32.',
    'The source-defined `MAX_COMPARISON_METRICS` limit is 64.',
  ]);

  for (const metadata of [table, formFlow, comparison]) {
    const published = JSON.stringify(metadata);
    for (const fragment of ['${', 'height: {type', 'width: 30rem) {', 'slice(0', '"bounded"', '"window"']) {
      expect(published).not.toContain(fragment);
    }
  }
});

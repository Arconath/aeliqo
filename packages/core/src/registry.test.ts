import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createComponentRegistry } from './registry';
import { createWorkspace, defineDataset, type Capability, type DataPort, type WorkspaceNode } from './model';

const dataset = defineDataset({ id: 'events', entity: 'Event', label: 'Events', identity: 'id', labelField: 'name', dimensions: [{ key: 'name', label: 'Name' }], metrics: [{ key: 'amount', label: 'Amount', aggregation: 'sum' }], timeFields: [] } as const);
const dataPort: DataPort = { listDatasets: () => [dataset], getDataset: id => id === dataset.id ? dataset : undefined, getSnapshot: () => ({ status: 'ready', records: [{ id: 'a', name: 'Example', amount: 12 }] }), subscribe: () => () => {} };
const capability = (component: string): Capability => ({ component, purpose: 'Inspect a declared business measure', accepts: ['metric'], interactions: [], minWidth: 180, accessibility: 'Labeled numeric summary' });
const definitions = [
  { capability: capability('finance:revenue-band'), configSchema: z.object({ threshold: z.number().finite().nonnegative(), currency: z.literal('USD') }).strict() },
  { capability: capability('support:incident-summary'), configSchema: z.object({ severity: z.enum(['critical', 'warning']), limit: z.number().int().min(1).max(10) }).strict() },
];
describe('trusted component registry', () => {
  it('accepts two unrelated registered configurations through the same workspace path', () => {
    const registry = createComponentRegistry(definitions);
    const store = createWorkspace({ dataPort, registry });
    const result = store.apply({ version: 1, baseRevision: 0, operations: [
      { type: 'mount', node: { id: 'revenue', component: 'finance:revenue-band', datasetId: 'events', config: { threshold: 100, currency: 'USD' } } },
      { type: 'mount', node: { id: 'incidents', component: 'support:incident-summary', datasetId: 'events', config: { severity: 'critical', limit: 3 } } },
    ] });
    expect(result.ok).toBe(true);
    expect(store.getState().order).toEqual(['revenue', 'incidents']);
    expect(registry.get('finance:revenue-band')?.configSchema).toBeTruthy();
  });
  it('rejects unknown IDs, invalid configuration and undeclared executable-looking options atomically', () => {
    const registry = createComponentRegistry(definitions);
    const invalid: Record<string, string | number>[] = [{ threshold: -1, currency: 'USD' }, { threshold: 10, currency: 'EUR' }, { threshold: 10, currency: 'USD', script: 'alert(1)' }];
    for (const config of invalid) {
      const store = createWorkspace({ dataPort, registry });
      expect(store.apply({ version: 1, baseRevision: 0, operations: [{ type: 'mount', node: { id: 'bad', component: 'finance:revenue-band', datasetId: 'events', config } }] }).ok).toBe(false);
      expect(store.getState().order).toEqual([]);
    }
    expect(() => registry.validate({ id: 'bad', component: 'unknown', datasetId: 'events' }, dataPort)).toThrow('Unknown component');
  });
  it('rejects duplicate IDs and exposes immutable independent manifests', () => {
    expect(() => createComponentRegistry([definitions[0]!, definitions[0]!])).toThrow(/unique/);
    const registry = createComponentRegistry(definitions);
    expect(Object.isFrozen(registry.list())).toBe(true);
    expect(Object.isFrozen(registry.list()[0]?.accepts)).toBe(true);
    expect(createComponentRegistry([]).list()).toEqual([]);
  });
  it('executes trusted semantic validation after the configuration schema', () => {
    let validated = 0;
    const registry = createComponentRegistry([{ ...definitions[1]!, validate: (node: WorkspaceNode, port: DataPort) => { validated++; if (!port.getDataset(node.datasetId)) throw new Error('Unknown dataset'); } }]);
    expect(() => registry.validate({ id: 'incident', component: 'support:incident-summary', datasetId: 'events', config: { severity: 'other', limit: 1 } }, dataPort)).toThrow();
    expect(validated).toBe(0);
    registry.validate({ id: 'incident', component: 'support:incident-summary', datasetId: 'events', config: { severity: 'warning', limit: 1 } }, dataPort);
    expect(validated).toBe(1);
  });
  it('rejects non-JSON configuration before it reaches a permissive custom validator', () => {
    let calls = 0;
    const registry = createComponentRegistry([{ capability: capability('custom:json'), configSchema: z.unknown(), validate: () => { calls++; } }]);
    for (const config of [{ callback: () => 1 }, { value: Infinity }, { value: undefined }]) {
      const store = createWorkspace({ dataPort, registry });
      expect(store.apply({ version: 1, baseRevision: 0, operations: [{ type: 'mount', node: { id: 'unsafe', component: 'custom:json', datasetId: 'events', config } as unknown as WorkspaceNode }] }).ok).toBe(false);
    }
    expect(calls).toBe(0);
  });
});

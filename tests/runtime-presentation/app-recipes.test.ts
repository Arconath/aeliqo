import {describe, expect, it} from 'vitest';
import {defineResource, validatePresentationPlan, type Intent, type PresentationEnvironment, type Result, type Task} from '../../packages/core/src/index.js';
import {html} from 'lit';
import * as z from 'zod';
import {defineView, standardDataRecipe, standardFormRecipe} from '../../packages/web/src/recipes/index.js';
import {createFormBindings} from '../../packages/web/src/app/form-bindings.js';
import {createAeliqoPresentationRegistry} from '../../packages/web/src/region/registry.js';

const current = {
  scopeDigest: 'scope-1', policyRevision: 'policy-1', taskRevision: '1', regionRevision: 'region-1',
  catalogRevision: 'catalog-1', experienceRevision: 'experience-1', functionRegistryDigest: 'core-query-2',
  results: [{id: 'result-1', revision: '1', outputId: 'primary', queryDigest: 'query-1', scopeDigest: 'scope-1'}],
} as const;

const result: Result = {
  version: '1',
  ref: {id: 'result-1', revision: '1', outputId: 'primary', queryDigest: 'query-1', scopeDigest: 'scope-1'},
  taskId: 'browse-1',
  fields: [
    {id: 'id', label: 'ID', type: {value: 'text', nullable: false}, role: 'identity'},
    {id: 'name', label: 'Name', type: {value: 'text', nullable: false}, role: 'attribute'},
  ],
  identity: ['id'], rowGrain: ['id'],
  counts: {loaded: 1, population: {kind: 'exact', value: 1, populationDigest: 'population-1'}},
  precision: {kind: 'exact'}, coverage: {kind: 'complete', populationDigest: 'population-1'},
  consistency: {kind: 'snapshot', snapshotId: 'snapshot-1', sourceRevisions: {people: '1'}},
  evidence: {kind: 'observed', source: {id: 'people', revision: '1'}}, filters: [], warnings: [], lineage: [],
};

function environment(width: number): PresentationEnvironment {
  return {inlineSize: {state: 'known', value: width}, blockSize: {state: 'known', value: 600}, textScale: {state: 'known', value: 1},
    pointer: 'fine', hover: 'available', keyboard: 'available', locale: 'en-US', direction: 'ltr', reducedMotion: false, forcedColors: false};
}

function input(kind: 'browse' | 'compare', width: number, preferredView?: string) {
  const intent: Intent = kind === 'browse'
    ? {version: '1', id: 'browse-1', kind, resource: 'people', ...(preferredView === undefined ? {} : {preferredView})}
    : {version: '1', id: 'browse-1', kind, resource: 'people', identities: [{id: 'p-1'}, {id: 'p-2'}], ...(preferredView === undefined ? {} : {preferredView})};
  const task: Task = {version: '1', id: 'browse-1', revision: '1', catalogRevision: 'catalog-1', functionRegistryDigest: 'core-query-2',
    regionId: 'main', kind: 'data', goal: 'Browse people', assumptions: [],
    outputs: [{id: 'primary', kind: 'query', query: {entity: 'people', fields: ['id', 'name'], measures: [], relations: [], groupBy: [],
      population: {kind: 'all-authorized'}, order: []}, dependsOn: [], delivery: 'eager'}],
    needs: [{id: kind, operation: {id: kind === 'compare' ? 'data.compare' : 'data.read', revision: '1'}, outputId: 'primary', fields: ['id', 'name'], required: true}],
    ...(preferredView === undefined ? {} : {viewPreference: {representation: preferredView, strength: 'preferred'}})};
  return {intent, task, result: {...result, taskId: task.id}, current, environment: environment(width), availableViews: []};
}

describe('0.3 standard recipes', () => {
  it('adapts browse from a table to cards using container width without a model call', () => {
    const wide = standardDataRecipe.build(input('browse', 1_280));
    const narrow = standardDataRecipe.build(input('browse', 360));
    expect(wide.ok && wide.value.nodes[0]?.representation.id).toBe('data.table');
    expect(narrow.ok && narrow.value.nodes[0]?.representation.id).toBe('data.card-collection');
  });

  it('keeps compare in a simultaneous column-preserving table on narrow containers', () => {
    const narrow = standardDataRecipe.build(input('compare', 320));
    expect(narrow.ok && narrow.value.nodes[0]?.representation.id).toBe('data.table');
  });

  it('treats an incompatible preferred view as a preference and falls back safely', () => {
    const outcome = standardDataRecipe.build(input('compare', 320, 'cards'));
    expect(outcome.ok && outcome.value.nodes[0]?.representation.id).toBe('data.table');
  });

  it('accepts a consumer-owned custom view without changing the framework registry', () => {
    const custom = defineView({
      ref: {id: 'example.people-grid', revision: '1'},
      manifest: {
        ref: {id: 'example.people-grid', revision: '1'}, configSchema: {id: 'example.people-grid.config', revision: '1'},
        roles: ['grid'], operations: [{id: 'data.read', revision: '1'}], result: 'required', children: {min: 0, max: 0},
        visibility: 'leaf', extension: true,
        resolveConfig: values => ({ok: true, value: {values, fields: ['id', 'name'], ports: [], operations: [{id: 'data.read', revision: '1'}]}}),
      },
      render: () => html`<div>Custom people grid</div>`,
    });
    const context = {...input('browse', 800, custom.ref.id), availableViews: [custom]};
    const outcome = standardDataRecipe.build(context);
    expect(outcome.ok && outcome.value.nodes[0]?.representation.id).toBe('example.people-grid');
  });

  it('builds a queryless create form entirely from host-owned resource bindings', () => {
    const resource = defineResource({
      id: 'people', revision: 'catalog-1', label: 'person', schema: z.object({id: z.string(), name: z.string(), active: z.boolean()}),
      identity: ['id'], presentation: {allowedViews: ['table']},
      fields: {id: {label: 'ID'}, name: {label: 'Name'}, active: {label: 'Active'}},
      forms: {create: {schema: {id: 'people.create', revision: '1'}, action: {id: 'people.create', revision: '1'}}},
    });
    const intent: Intent = {version: '1', id: 'create-1', kind: 'create', resource: 'people'};
    const task: Task = {version: '1', id: 'create-1', revision: '1', catalogRevision: 'catalog-1', functionRegistryDigest: 'core-query-2',
      regionId: 'main', kind: 'form', goal: 'Create person', assumptions: [], needs: [], schema: {id: 'people.create', revision: '1'}, action: {id: 'people.create', revision: '1'}};
    const bindings = createFormBindings(resource, intent, task, {values: {}, entityRevision: 'new'});
    expect(bindings.ok).toBe(true); if (!bindings.ok) return;
    const formCurrent = {...current, taskRevision: '1', results: []};
    const plan = standardFormRecipe.build({intent, task, inputBindings: bindings.value, current: formCurrent, environment: environment(360), availableViews: []});
    expect(plan.ok).toBe(true); if (!plan.ok) return;
    const registry = createAeliqoPresentationRegistry({inputs: bindings.value});
    expect(registry.ok).toBe(true); if (!registry.ok) return;
    const checked = validatePresentationPlan(plan.value, {task, results: [], current: formCurrent, environment: environment(360),
      rendererCapabilities: registry.value.manifests.map((manifest) => manifest.ref), stateMappingCapabilities: [],
      experience: {version: '1', id: 'web', revision: 'experience-1', mode: 'adaptive', agentAllowed: true,
        allowedRepresentations: registry.value.manifests.map((manifest) => manifest.ref.id), allowedPatterns: [],
        composition: {allowWithoutPreset: true, maxNodes: 32, maxExpansions: 64}, requiredOperations: [],
        tokenProfile: {id: 'tokens.default', revision: '1'}, extensionAllowlist: [], transitionPolicy: 'stable'}}, registry.value);
    if (!checked.ok) throw new Error(checked.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`).join('\n'));
    expect(plan.value.nodes.map((node) => node.representation.id)).toEqual(['input.form', 'input.text-field', 'input.text-field', 'input.checkbox']);
  });
});

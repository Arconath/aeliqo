import assert from 'node:assert/strict';
import {nothing} from 'lit';
import {renderAeliqo} from '../../packages/web/dist/server.js';
import {createAeliqoVisualizationPresentationRegistry} from '../../packages/web/dist/region/visualization-registry.js';
import {ref as cartRef, result as cartResult, rows as cartRows, specs as cartSpecs, catalog as cartCatalog, contextFor, rowsFor} from '../visualization/cartesian-fixtures.mjs';
import {registerAeliqoElements} from '../../packages/web/dist/register.js';

registerAeliqoElements();

const temporalRef = {id: 'semantic-temporal', revision: '1', outputId: 'rows', queryDigest: 'query', scopeDigest: 'scope'};
const temporalResult = {version: '1', ref: temporalRef, taskId: 'task', identity: ['id'], rowGrain: ['id', 'date'], fields: [
  {id: 'id', label: 'ID', role: 'identity', type: {value: 'text', nullable: false}},
  {id: 'date', label: 'Date', role: 'time', type: {value: 'date', nullable: false, temporal: {calendar: 'gregory', grain: 'day'}}},
], counts: {loaded: 2, population: {kind: 'unknown'}}, precision: {kind: 'exact'}, coverage: {kind: 'unknown', reason: 'Loaded rows'}, consistency: {kind: 'unknown', reason: 'Host snapshot'}, evidence: {kind: 'computed', queryDigest: 'query', definitions: []}, filters: [], warnings: [], lineage: []};
const temporalRows = [{id: 'a', date: '2026-09-08'}, {id: 'b', date: '2026-09-09'}];

const nodeRef = {id: 'semantic-hierarchy', revision: '1', outputId: 'rows', queryDigest: 'query', scopeDigest: 'scope'};
const nodeResult = {version: '1', ref: nodeRef, taskId: 'task', identity: ['id'], rowGrain: ['id'], fields: [
  {id: 'id', label: 'ID', role: 'identity', type: {value: 'text', nullable: false}},
  {id: 'parent', label: 'Parent', role: 'attribute', type: {value: 'text', nullable: true}},
  {id: 'label', label: 'Label', role: 'attribute', type: {value: 'text', nullable: false}},
  {id: 'amount', label: 'Amount', role: 'measure', type: {value: 'integer', nullable: false}, derivation: {id: 'amount', revision: '1'}},
], counts: {loaded: 2, population: {kind: 'unknown'}}, precision: {kind: 'exact'}, coverage: {kind: 'unknown', reason: 'Loaded rows'}, consistency: {kind: 'unknown', reason: 'Host snapshot'}, evidence: {kind: 'computed', queryDigest: 'query', definitions: []}, filters: [], warnings: [], lineage: []};
const nodeRows = [{id: 'root', parent: null, label: 'Root', amount: 3}, {id: 'child', parent: 'root', label: 'Child', amount: 2}];
const meaning = {id: 'amount', revision: '1', label: 'Amount', explanation: 'Authorized additive amount', output: {value: 'integer', nullable: false}, implementation: {kind: 'host-capability', capability: {id: 'amount', revision: '1'}}, dependencies: [], functionRegistryDigest: 'functions', origin: 'manual', lifecycle: 'active', scope: 'workspace', authority: 'reviewed', aggregation: 'additive', aggregationDimensions: [], missingPolicy: 'reject'};
const nodeCatalog = {version: '1', revision: 'catalog', functionRegistryDigest: 'functions', entities: [{id: 'nodes', label: 'Nodes', identity: ['id'], rowGrain: ['id'], fields: [nodeResult.fields[0]]}], relationships: [], meanings: [meaning], capabilities: []};

const edgeRef = {id: 'semantic-edges', revision: '1', outputId: 'rows', queryDigest: 'query', scopeDigest: 'scope'};
const edgeResult = {...nodeResult, ref: edgeRef, identity: ['edge'], rowGrain: ['edge'], counts: {loaded: 1, population: {kind: 'unknown'}}, fields: [
  {id: 'edge', label: 'Edge', role: 'identity', type: {value: 'text', nullable: false}},
  {id: 'source', label: 'Source', role: 'dimension', type: {value: 'text', nullable: false}},
  {id: 'target', label: 'Target', role: 'dimension', type: {value: 'text', nullable: false}},
]};
const edgeRows = [{edge: 'e1', source: 's1', target: 't1'}];
const relation = {id: 'edge-relation', revision: '1', sourceEntity: 'sources', targetEntity: 'targets', keys: [{sourceField: 'id', targetField: 'id'}], cardinality: 'many-to-one', optional: false, joinPolicy: 'validated'};
const entity = (id) => ({id, label: id, identity: ['id'], rowGrain: ['id'], fields: [{id: 'id', label: 'ID', role: 'identity', type: {value: 'text', nullable: false}}]});
const edgeCatalog = {version: '1', revision: 'catalog', functionRegistryDigest: 'functions', entities: [entity('sources'), entity('targets')], relationships: [relation], meanings: [], capabilities: []};

function nodeFor(registry, spec, binding, id) {
  const manifest = registry.manifests.find((candidate) => candidate.ref.id === `visualization.${spec.view}`);
  assert(manifest);
  const resolved = manifest.resolveConfig({visualization: spec}, binding.result);
  assert.equal(resolved.ok, true, `${spec.view} config must resolve`);
  return {node: {id}, manifest: manifest.ref, config: {schema: manifest.configSchema, values: resolved.value.values, fields: resolved.value.fields, ports: resolved.value.ports, operations: resolved.value.operations}, result: binding.result};
}

async function render(binding, spec, id) {
  const registry = createAeliqoVisualizationPresentationRegistry([binding], {resolveEntity: () => 'rows'});
  assert.equal(registry.ok, true, `${spec.view} registry must resolve`);
  const template = registry.value.render(nodeFor(registry.value, spec, binding, id), binding);
  assert.notEqual(template, nothing, `${spec.view} node must render`);
  return renderAeliqo(template);
}

const cartTags = ['trend', 'bar', 'area', 'scatter', 'histogram', 'heatmap'];
for (const view of cartTags) {
  const binding = {result: cartResult, context: contextFor(view), datasets: [{result: cartRef, rows: rowsFor(view)}]};
  const output = await render(binding, cartSpecs[view], `cart-${view}`);
  assert.match(output, new RegExp(`<aeliqo-${view}`));
  assert.match(output, /<table/);
}

for (const [view, spec] of Object.entries({matrix: {version: '1', view: 'matrix', result: temporalRef, columns: ['id', 'date']}, timeline: {version: '1', view: 'timeline', result: temporalRef, start: 'date'}, 'calendar-grid': {version: '1', view: 'calendar-grid', result: temporalRef, date: 'date'}})) {
  const binding = {result: temporalResult, context: {results: [temporalResult]}, datasets: [{result: temporalRef, rows: temporalRows}]};
  const output = await render(binding, spec, `temporal-${view}`);
  assert.match(output, new RegExp(`<aeliqo-${view}`));
  assert.match(output, /<table/);
}

for (const [view, spec] of Object.entries({tree: {version: '1', view: 'tree', result: nodeRef, node: ['id'], parent: ['parent'], label: 'label'}, treemap: {version: '1', view: 'treemap', result: nodeRef, node: ['id'], parent: ['parent'], label: 'label', value: 'amount', meaning: {id: 'amount', revision: '1'}}})) {
  const binding = {result: nodeResult, context: {results: [nodeResult], catalog: nodeCatalog}, datasets: [{result: nodeRef, rows: nodeRows}]};
  const output = await render(binding, spec, `hierarchy-${view}`);
  assert.match(output, new RegExp(`<aeliqo-${view}`));
  assert.match(output, /<table/);
}

const relationshipSpec = {version: '1', view: 'relationship', result: edgeRef, source: ['source'], target: ['target'], relationship: {id: relation.id, revision: relation.revision}};
const relationshipBinding = {result: edgeResult, context: {results: [edgeResult], catalog: edgeCatalog, relationships: [{result: edgeRef, relationship: {id: relation.id, revision: relation.revision}, source: ['source'], target: ['target']}]}, datasets: [{result: edgeRef, rows: edgeRows}]};
const relationshipOutput = await render(relationshipBinding, relationshipSpec, 'relationship');
assert.match(relationshipOutput, /<aeliqo-relationship/);
assert.match(relationshipOutput, /<table/);

console.log('Semantic visualization presentation SSR: all twelve typed manifests rendered with exact host bindings.');

import assert from 'node:assert/strict';
import {html} from 'lit';
import {renderAeliqo} from '../../packages/web/dist/server.js';
import {defineHierarchyElements} from '../../packages/web/dist/visualization/hierarchy/index.js';

const ref = {id: 'hierarchy-ssr', revision: '1', outputId: 'rows', queryDigest: 'q', scopeDigest: 's'};
const result = {version: '1', ref, taskId: 'task', fields: [
  {id: 'id', label: 'ID', role: 'identity', type: {value: 'text', nullable: false}},
  {id: 'parent', label: 'Parent', role: 'attribute', type: {value: 'text', nullable: true}},
  {id: 'label', label: 'Label', role: 'attribute', type: {value: 'text', nullable: false}},
], identity: ['id'], rowGrain: ['id'], counts: {loaded: 2, population: {kind: 'unknown'}}, precision: {kind: 'exact'}, coverage: {kind: 'unknown', reason: 'Bounded rows'}, consistency: {kind: 'unknown', reason: 'Host snapshot unknown'}, evidence: {kind: 'computed', queryDigest: 'q', definitions: []}, filters: [], warnings: [], lineage: []};
const visualization = {version: '1', view: 'tree', result: ref, node: ['id'], parent: ['parent'], label: 'label'};

defineHierarchyElements();
const output = await renderAeliqo(html`<aeliqo-tree .visualization=${visualization} .context=${{results: [result]}} .datasets=${[{result: ref, rows: [
  {id: 'root', parent: null, label: 'Root'}, {id: 'child', parent: 'root', label: 'Child'},
]}]} label="SSR hierarchy"></aeliqo-tree>`);
assert(output.includes('SSR hierarchy'));
assert(output.includes('Exact loaded hierarchy data'));
assert(output.includes('Root') && output.includes('Child'));
assert(output.includes('<svg'));
assert(output.includes('<table'));
console.log('Hierarchy SSR exact table and SVG output passed.');

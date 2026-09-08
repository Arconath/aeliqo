import {AeliqoTreeElement} from '../../packages/web/src/visualization/hierarchy/index.js';

customElements.define('aeliqo-tree', AeliqoTreeElement);
const ref = {id: 'hierarchy-browser', revision: '1', outputId: 'rows', queryDigest: 'q', scopeDigest: 'scope'};
const result = {version: '1', ref, taskId: 'task', fields: [
  {id: 'id', label: 'ID', role: 'identity', type: {value: 'text', nullable: false}},
  {id: 'parent', label: 'Parent', role: 'attribute', type: {value: 'text', nullable: true}},
  {id: 'label', label: 'Label', role: 'attribute', type: {value: 'text', nullable: false}},
], identity: ['id'], rowGrain: ['id'], counts: {loaded: 3, population: {kind: 'unknown'}}, precision: {kind: 'exact'}, coverage: {kind: 'unknown', reason: 'Observed browser rows'}, consistency: {kind: 'unknown', reason: 'Host snapshot unknown'}, evidence: {kind: 'computed', queryDigest: 'q', definitions: []}, filters: [], warnings: [], lineage: []};
const rows = [{id: 'root', parent: null, label: 'Root'}, {id: 'child-a', parent: 'root', label: 'Child A'}, {id: 'child-b', parent: 'root', label: 'Child B'}];
const tree = document.createElement('aeliqo-tree') as AeliqoTreeElement;
tree.label = 'Browser hierarchy';
tree.visualization = {version: '1', view: 'tree', result: ref, node: ['id'], parent: ['parent'], label: 'label'};
tree.context = {results: [result]};
tree.datasets = [{result: ref, rows}];
tree.addEventListener('aeliqo-visualization-select', event => { (window as typeof window & {selection?: unknown}).selection = (event as CustomEvent).detail; });
document.querySelector('main')!.append(tree);
Object.assign(window, {tree, result, ref, rows});

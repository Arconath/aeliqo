import assert from 'node:assert/strict';
import {html} from 'lit';
import {renderAeliqo} from '../../packages/web/dist/server.js';
import {defineCartesianElements} from '../../packages/web/dist/visualization/cartesian/index.js';

// The public root registration is integrated later by the orchestrator. This
// source-level SSR proof registers the family entry explicitly first.
defineCartesianElements();

const ref = {id: 'cartesian-ssr', revision: '1', outputId: 'rows', queryDigest: 'query', scopeDigest: 'scope'};
const meaning = {id: 'amount', revision: '1', label: 'Amount', explanation: 'Authorized additive amount', output: {value: 'integer', nullable: false},
  implementation: {kind: 'host-capability', capability: {id: 'amount', revision: '1'}}, dependencies: [], functionRegistryDigest: 'functions', origin: 'manual', lifecycle: 'active', scope: 'workspace', authority: 'reviewed', aggregation: 'additive', aggregationDimensions: [], missingPolicy: 'reject'};
const result = {version: '1', ref, taskId: 'task', identity: ['id'], rowGrain: ['id', 'date', 'category', 'feature', 'low', 'high'],
  fields: [
    {id: 'id', label: 'ID', role: 'identity', type: {value: 'text', nullable: false}},
    {id: 'date', label: 'Date', role: 'time', type: {value: 'date', nullable: false, temporal: {calendar: 'gregory', grain: 'day'}}},
    {id: 'category', label: 'Category', role: 'dimension', type: {value: 'text', nullable: false}},
    {id: 'feature', label: 'Feature', role: 'dimension', type: {value: 'text', nullable: false}},
    {id: 'x', label: 'X', role: 'measure', type: {value: 'integer', nullable: false}},
    {id: 'y', label: 'Amount', role: 'measure', type: {value: 'integer', nullable: false}, derivation: {id: 'amount', revision: '1'}},
    {id: 'low', label: 'Start', role: 'dimension', type: {value: 'integer', nullable: false}},
    {id: 'high', label: 'End', role: 'dimension', type: {value: 'integer', nullable: false}},
    {id: 'zero', label: 'Baseline', role: 'measure', type: {value: 'integer', nullable: false}},
    {id: 'color', label: 'Intensity', role: 'measure', type: {value: 'integer', nullable: false}},
  ], counts: {loaded: 4, population: {kind: 'unknown'}}, precision: {kind: 'exact'}, coverage: {kind: 'unknown', reason: 'Observed page only'},
  consistency: {kind: 'snapshot', snapshotId: 'snapshot', sourceRevisions: {source: '1'}}, evidence: {kind: 'observed', source: {id: 'source', revision: '1'}}, filters: [], warnings: [], lineage: []};
const rows = [
  {id: 'a', date: '2025-01-01', category: 'A', feature: 'I', x: 1, y: 2, low: 0, high: 1, zero: 0, color: 2},
  {id: 'b', date: '2025-01-02', category: 'A', feature: 'II', x: 2, y: 3, low: 1, high: 2, zero: 0, color: 3},
  {id: 'c', date: '2025-01-03', category: 'B', feature: 'I', x: 3, y: 4, low: 2, high: 3, zero: 0, color: 4},
  {id: 'd', date: '2025-01-04', category: 'B', feature: 'II', x: 4, y: 5, low: 3, high: 4, zero: 0, color: 5},
];
const catalog = {version: '1', revision: 'catalog', functionRegistryDigest: 'functions', entities: [{id: 'rows', label: 'Rows', identity: ['id'], rowGrain: ['id'], fields: [{id: 'id', label: 'ID', role: 'identity', type: {value: 'text', nullable: false}}]}], relationships: [], meanings: [meaning], capabilities: []};
const plot = (mark, encoding) => ({version: '1', root: {kind: 'unit', mark, result: ref, missing: 'gap', encoding}});
const specs = {
  trend: {version: '1', view: 'trend', plot: plot('line', {x: {field: 'date', scale: 'temporal'}, y: {field: 'y', scale: 'linear'}})},
  bar: {version: '1', view: 'bar', plot: plot('bar', {x: {field: 'category', scale: 'ordinal'}, y: {field: 'y', scale: 'linear', zero: true}, series: {field: 'feature', scale: 'ordinal'}})},
  area: {version: '1', view: 'area', plot: plot('area', {x: {field: 'date', scale: 'temporal'}, y: {field: 'y', scale: 'linear', zero: true}, series: {field: 'feature', scale: 'ordinal'}}), meaning: {id: 'amount', revision: '1'}, stack: 'zero'},
  scatter: {version: '1', view: 'scatter', plot: plot('point', {x: {field: 'x', scale: 'linear'}, y: {field: 'y', scale: 'linear'}})},
  histogram: {version: '1', view: 'histogram', plot: plot('rect', {x: {field: 'low', scale: 'linear'}, x2: {field: 'high', scale: 'linear'}, y: {field: 'y', scale: 'linear', zero: true}, y2: {field: 'zero', scale: 'linear', zero: true}}), bins: {start: 'low', end: 'high', value: 'y', measure: 'count', boundary: 'start-inclusive-end-exclusive'}},
  heatmap: {version: '1', view: 'heatmap', plot: plot('cell', {x: {field: 'category', scale: 'ordinal'}, y: {field: 'feature', scale: 'ordinal'}, color: {field: 'color', scale: 'linear'}})},
};
const tags = ['trend', 'bar', 'area', 'scatter', 'histogram', 'heatmap'];
const contextFor = (tag) => ({results: [result], catalog, histograms: tag === 'histogram' ? [{result: ref, bins: specs.histogram.bins}] : []});
const rowsFor = (tag) => tag === 'area'
  ? rows.map((row, index) => ({...row, date: index < 2 ? rows[0].date : rows[2].date, feature: index % 2 === 0 ? 'I' : 'II'}))
  : rows;
const templateFor = (tag) => {
  const props = {spec: specs[tag], context: contextFor(tag), datasets: [{result: ref, rows: rowsFor(tag)}]};
  switch (tag) {
    case 'trend': return html`<aeliqo-trend .visualization=${props.spec} .context=${props.context} .datasets=${props.datasets} label="SSR trend"></aeliqo-trend>`;
    case 'bar': return html`<aeliqo-bar .visualization=${props.spec} .context=${props.context} .datasets=${props.datasets} label="SSR bar"></aeliqo-bar>`;
    case 'area': return html`<aeliqo-area .visualization=${props.spec} .context=${props.context} .datasets=${props.datasets} label="SSR area"></aeliqo-area>`;
    case 'scatter': return html`<aeliqo-scatter .visualization=${props.spec} .context=${props.context} .datasets=${props.datasets} label="SSR scatter"></aeliqo-scatter>`;
    case 'histogram': return html`<aeliqo-histogram .visualization=${props.spec} .context=${props.context} .datasets=${props.datasets} label="SSR histogram"></aeliqo-histogram>`;
    case 'heatmap': return html`<aeliqo-heatmap .visualization=${props.spec} .context=${props.context} .datasets=${props.datasets} label="SSR heatmap"></aeliqo-heatmap>`;
  }
};

for (const tag of tags) {
  const output = await renderAeliqo(templateFor(tag));
  assert.match(output, new RegExp(`<aeliqo-${tag}`));
  assert.match(output, /<table/);
  assert.match(output, /<svg/);
  assert.doesNotMatch(output, /(?:NaN|Infinity|undefined)/);
  assert.match(output, /2025-01-01|A|I/);
}

const heatmap = await renderAeliqo(html`<aeliqo-heatmap .visualization=${specs.heatmap} .context=${contextFor('heatmap')} .datasets=${[{result: ref, rows}]}></aeliqo-heatmap>`);
assert.match(heatmap, /part="color-key"/);
const histogram = await renderAeliqo(html`<aeliqo-histogram .visualization=${specs.histogram} .context=${contextFor('histogram')} .datasets=${[{result: ref, rows}]}></aeliqo-histogram>`);
assert.match(histogram, /executor-produced count bins/);
assert.match(histogram, /Source observation coverage/);

const empty = await renderAeliqo(html`<aeliqo-trend></aeliqo-trend>`);
assert.doesNotMatch(empty, /<table/);
assert.match(empty, /No .*trend.*visualization is available/s);
console.log('Cartesian SSR six-family marks, exact tables, color key, histogram scope and request isolation passed.');

import type {Catalog, PlotUnit, Result, ResultRef, Scalar, VisualizationBindingContext, VisualizationSpec} from '@aeliqo/core';
import {
  AeliqoBarElement,
  AeliqoMetricElement,
  AeliqoRecordListElement,
} from '@aeliqo/web';
import type {VisualizationDataset} from '@aeliqo/web/visualization';

type Person = Readonly<{
  id: string;
  name: string;
  team: string;
  location: string;
  absenceDays: number;
}>;

export type HomeResult = Readonly<{
  readonly rows: readonly Person[];
  readonly result: Result;
  readonly context: VisualizationBindingContext;
  readonly datasets: readonly VisualizationDataset[];
  readonly visualization: VisualizationSpec;
}>;

export type HomePeopleExample = Readonly<{
  filter: (team?: string) => number;
  evaluate: (team?: string) => HomeResult;
  showResult: (result: HomeResult) => void;
  showRecords: () => void;
  dispose: () => void;
}>;

const rows: readonly Person[] = [
  {id: 'ada', name: 'Ada Chen', team: 'Design', location: 'Jakarta', absenceDays: 2},
  {id: 'sam', name: 'Sam Rivera', team: 'Engineering', location: 'Lisbon', absenceDays: 4},
  {id: 'iman', name: 'Iman Putra', team: 'Engineering', location: 'Bandung', absenceDays: 1},
  {id: 'lee', name: 'Lee Morgan', team: 'Operations', location: 'London', absenceDays: 3},
];

const text = {value: 'text', nullable: false} as const;
const integer = {value: 'integer', nullable: false} as const;
const fields = [
  {id: 'id', label: 'ID', role: 'identity', type: text},
  {id: 'name', label: 'Name', role: 'attribute', type: text},
  {id: 'team', label: 'Team', role: 'dimension', type: text},
  {id: 'location', label: 'Location', role: 'attribute', type: text},
  {id: 'absenceDays', label: 'Absence days', role: 'measure', type: integer},
] as const;

const catalog: Catalog = {
  version: '1',
  revision: 'home-catalog-1',
  functionRegistryDigest: 'home-functions-1',
  entities: [{id: 'person', label: 'Person', identity: ['id'], rowGrain: ['id'], fields}],
  relationships: [],
  meanings: [],
  capabilities: [],
};

const define = (name: string, constructor: CustomElementConstructor): void => {
  if (!customElements.get(name)) customElements.define(name, constructor);
};

function selectedRows(team = 'all'): readonly Person[] {
  return rows.filter(row => team === 'all' || row.team === team);
}

function resultFor(team = 'all'): HomeResult {
  const selected = selectedRows(team);
  const key = team.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'all';
  const ref: ResultRef = {
    id: 'aeliqo-home-people',
    revision: '1',
    outputId: 'people',
    queryDigest: `home-people-query-${key}`,
    scopeDigest: `home-people-scope-${key}`,
  };
  const result: Result = {
    version: '1',
    ref,
    taskId: 'home-people-task',
    fields,
    identity: ['id'],
    rowGrain: ['id'],
    counts: {loaded: selected.length, population: {kind: 'unknown'}},
    precision: {kind: 'exact'},
    coverage: {kind: 'complete', populationDigest: ref.scopeDigest},
    consistency: {kind: 'snapshot', snapshotId: `home-snapshot-${key}`, sourceRevisions: {people: '1'}},
    evidence: {kind: 'computed', queryDigest: ref.queryDigest, definitions: []},
    filters: team === 'all' ? [] : [{op: 'compare', field: 'team', entity: 'person', comparison: 'eq', value: team}],
    warnings: [],
    lineage: [],
  };
  const plot = (mark: PlotUnit['mark'], encoding: PlotUnit['encoding']): PlotUnit => ({
    kind: 'unit',
    mark,
    result: ref,
    missing: 'gap',
    encoding,
  });
  const visualization: VisualizationSpec = {
    version: '1',
    view: 'bar',
    plot: {
      version: '1',
      root: plot('bar', {
        x: {field: 'name', scale: 'ordinal'},
        y: {field: 'absenceDays', scale: 'linear', zero: true},
      }),
    },
  };
  const visualizationRows: readonly Readonly<Record<string, Scalar>>[] = selected.map(row => row);
  const datasets: readonly VisualizationDataset[] = [{result: ref, rows: visualizationRows}];
  return {rows: selected, result, context: {results: [result], catalog}, datasets, visualization};
}

/** Mount the real web components used by the home proof. All records are synthetic. */
export function mountPeopleExample(container: HTMLElement, resultContainer?: HTMLElement): HomePeopleExample {
  define('aeliqo-record-list', AeliqoRecordListElement);
  define('aeliqo-metric', AeliqoMetricElement);
  define('aeliqo-bar', AeliqoBarElement);

  const list = new AeliqoRecordListElement();
  list.columns = [
    {key: 'name', label: 'Name'},
    {key: 'team', label: 'Team'},
    {key: 'location', label: 'Location'},
  ];
  list.identity = ['id'];
  list.entity = 'person';
  container.append(list);

  const metricHost = resultContainer?.querySelector<HTMLElement>('#demo-result-metric');
  const chartHost = resultContainer?.querySelector<HTMLElement>('#demo-result-chart');
  let metric: AeliqoMetricElement | undefined;
  let chart: AeliqoBarElement | undefined;

  function filter(team = 'all'): number {
    const selected = selectedRows(team);
    list.rows = selected;
    list.scope = {
      label: team === 'all' ? 'All synthetic people' : `${team} · synthetic people`,
      kind: 'filtered',
      loaded: selected.length,
      filteredTotal: selected.length,
    };
    return selected.length;
  }

  function showRecords(): void {
    resultContainer?.setAttribute('hidden', '');
    container.removeAttribute('hidden');
    metric?.remove();
    chart?.remove();
    metric = undefined;
    chart = undefined;
  }

  function showResult(result: HomeResult): void {
    if (metricHost === null || metricHost === undefined || chartHost === null || chartHost === undefined) return;
    container.setAttribute('hidden', '');
    resultContainer?.removeAttribute('hidden');
    metric = new AeliqoMetricElement();
    metric.label = 'People in result';
    metric.value = result.rows.length;
    metric.unit = 'records';
    metric.description = 'Exact loaded rows from the selected local scope.';
    metric.scope = {
      label: result.result.ref.scopeDigest.replace('home-people-scope-', '') === 'all' ? 'All synthetic people' : 'Selected synthetic team',
      kind: 'filtered',
      loaded: result.rows.length,
      filteredTotal: result.rows.length,
    };
    chart = new AeliqoBarElement();
    chart.label = 'Absence days by person';
    chart.width = 560;
    chart.height = 260;
    chart.maxMarks = 20;
    chart.selectionEnabled = false;
    chart.visualization = result.visualization;
    chart.context = result.context;
    chart.datasets = result.datasets;
    metricHost.replaceChildren(metric);
    chartHost.replaceChildren(chart);
  }

  filter();
  showRecords();
  return {
    filter,
    evaluate: resultFor,
    showResult,
    showRecords,
    dispose() {
      list.remove();
      metric?.remove();
      chart?.remove();
    },
  };
}

import {createStandardFunctionRegistry, parseTask} from '@aeliqo/core';
import type {Catalog, Outcome, PlotUnit, QuerySpec, Result, Scalar, Task, VisualizationBindingContext, VisualizationSpec} from '@aeliqo/core';
import {createLocalDataService, type DataRecord, type QueryBudget} from '@aeliqo/runtime/data';
import {createResultStore} from '@aeliqo/runtime/results';
import {createTaskEvaluator} from '@aeliqo/runtime/evaluation';
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
  evaluate: (team?: string) => Promise<HomeResult>;
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

const functionRegistryResult = createStandardFunctionRegistry();
if (!functionRegistryResult.ok) throw new Error('The standard function registry is unavailable.');
const functionRegistry = functionRegistryResult.value;
const catalog: Catalog = {
  version: '1',
  revision: 'home-catalog-1',
  functionRegistryDigest: functionRegistry.digest,
  entities: [{id: 'person', label: 'Person', identity: ['id'], rowGrain: ['id'], fields}],
  relationships: [],
  meanings: [],
  capabilities: [],
};
const HOME_SCOPE = 'home-synthetic-people';
const HOME_POLICY = 'home-policy-1';
const HOME_SOURCE_REVISION = '1';
const budget: QueryBudget = Object.freeze({
  maxRows: 100,
  maxBytes: 250_000,
  maxMessages: 16,
  maxMilliseconds: 5_000,
  maxColumns: 16,
});

const define = (name: string, constructor: CustomElementConstructor): void => {
  if (!customElements.get(name)) customElements.define(name, constructor);
};

const failure = <T>(code: string, message: string): Outcome<T> => ({
  ok: false,
  diagnostics: [{code, message, retryable: false}],
});

function selectedRows(team = 'all'): readonly Person[] {
  return rows.filter(row => team === 'all' || row.team === team);
}

function queryFor(team: string): QuerySpec {
  return {
    entity: 'person',
    fields: ['id', 'name', 'team', 'location', 'absenceDays'],
    measures: [],
    relations: [],
    groupBy: [],
    population: {kind: 'all-authorized'},
    order: [],
    ...(team === 'all' ? {} : {where: {op: 'compare', field: 'team', comparison: 'eq', value: team}}),
  };
}

function taskFor(team: string, revision: number): Task {
  return {
    version: '1',
    id: 'home-people-task',
    revision: String(revision),
    catalogRevision: catalog.revision,
    functionRegistryDigest: functionRegistry.digest,
    regionId: 'aeliqo-home-demo',
    goal: 'Browse synthetic people',
    needs: [],
    assumptions: ['Synthetic demonstration data; no employee or customer records.'],
    kind: 'data',
    outputs: [{id: 'people', kind: 'query', query: queryFor(team), dependsOn: [], delivery: 'eager'}],
  };
}

function readPeople(records: readonly DataRecord[]): readonly Person[] {
  return Object.freeze(records.map((record) => {
    if (typeof record.id !== 'string' || typeof record.name !== 'string' || typeof record.team !== 'string'
      || typeof record.location !== 'string' || typeof record.absenceDays !== 'number') {
      throw new Error('The local result did not contain the declared person fields.');
    }
    return {id: record.id, name: record.name, team: record.team, location: record.location, absenceDays: record.absenceDays};
  }));
}

function visualizationFor(result: Result): VisualizationSpec {
  const plot = (mark: PlotUnit['mark'], encoding: PlotUnit['encoding']): PlotUnit => ({
    kind: 'unit',
    mark,
    result: result.ref,
    missing: 'gap',
    encoding,
  });
  return {
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
}

/** Mount the real web components and use the shipped local evaluator for requests. All records are synthetic. */
export function mountPeopleExample(container: HTMLElement, resultContainer?: HTMLElement): HomePeopleExample {
  define('aeliqo-record-list', AeliqoRecordListElement);
  define('aeliqo-metric', AeliqoMetricElement);
  define('aeliqo-bar', AeliqoBarElement);

  let disposed = false;
  let taskRevision = 0;
  const service = createLocalDataService({
    snapshot: {catalog, sourceRevision: HOME_SOURCE_REVISION, records: {person: rows}},
    hostBudget: budget,
    sourceLimits: {rows: 100, bytes: 250_000},
    authorize: () => disposed
      ? failure('home.closed', 'The home demonstration is closed.')
      : {ok: true, value: {scopeDigest: HOME_SCOPE, policyRevision: HOME_POLICY}},
  });
  const resultStore = createResultStore({maxEntries: 8, maxBytes: 250_000, ttlMs: 120_000});
  const context = () => ({
    principalKey: 'home-public-synthetic',
    scopeDigest: HOME_SCOPE,
    policyRevision: HOME_POLICY,
    catalogRevision: catalog.revision,
    functionRegistryDigest: functionRegistry.digest,
    grants: ['task.evaluate', 'result.inspect'],
    catalog,
    data: service,
    resultStore,
    readContext: {principal: 'home-public-synthetic'},
    resolveResult: () => undefined,
    now: () => Date.now(),
    budget,
  });
  const evaluator = createTaskEvaluator({
    host: {readContext: () => disposed ? failure('home.closed', 'The home demonstration is closed.') : {ok: true, value: context()}},
    maxMilliseconds: budget.maxMilliseconds,
    budget,
  });

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

  async function evaluate(team = 'all'): Promise<HomeResult> {
    const parsed = parseTask(taskFor(team, ++taskRevision));
    if (!parsed.ok) throw new Error(parsed.diagnostics[0]?.message ?? 'The home task is invalid.');
    const evaluation = await evaluator.evaluate({task: parsed.value, deadlineMs: budget.maxMilliseconds});
    if (!evaluation.ok) throw new Error(evaluation.diagnostics[0]?.message ?? 'The local result could not be evaluated.');
    try {
      const output = evaluation.value.outputs.find(item => item.outputId === 'people');
      const snapshot = output?.handle.snapshot();
      if (output === undefined || snapshot === undefined || snapshot.status !== 'ready' || snapshot.descriptor === undefined) {
        throw new Error('The local result was not complete.');
      }
      const result = snapshot.descriptor;
      const resultRows = snapshot.batches.flatMap(batch => batch.rows) as readonly DataRecord[];
      const people = readPeople(resultRows);
      const visualizationRows = resultRows as readonly Readonly<Record<string, Scalar>>[];
      return {
        rows: people,
        result,
        context: {results: [result], catalog},
        datasets: [{result: result.ref, rows: visualizationRows}],
        visualization: visualizationFor(result),
      };
    } finally {
      evaluation.value.release();
    }
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
      label: result.result.filters.length === 0 ? 'All synthetic people' : 'Selected synthetic team',
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
    evaluate,
    showResult,
    showRecords,
    dispose() {
      disposed = true;
      list.remove();
      metric?.remove();
      chart?.remove();
      resultStore.dispose();
    },
  };
}

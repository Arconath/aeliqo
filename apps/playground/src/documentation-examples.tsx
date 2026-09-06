import { useMemo, useState } from 'react';
import { Delta } from '../../../packages/react/src/delta';
import { RecordList } from '../../../packages/react/src/record-list';
import { SelectionSummary } from '../../../packages/react/src/selection-summary';
import { Overview } from '../../../packages/react/src/overview';
import { aggregateMetric, createWorkspace, defineDataset, filterRecords, type DataPort, type DataSnapshot, type Filter as SemanticFilter } from '@aeliqo/core';
import { Metric } from '../../../packages/react/src/metric';
import { Table } from '../../../packages/react/src/table';
import { Filter } from '../../../packages/react/src/filter';
import { Ranking } from '../../../packages/react/src/ranking';
import { Trend } from '../../../packages/react/src/trend';
import { Detail } from '../../../packages/react/src/detail';
import { Comparison } from '../../../packages/react/src/comparison';
import { MetricBreakdown } from '../../../packages/react/src/metric-breakdown';
import { EventTimeline } from '../../../packages/react/src/event-timeline';
import { TimeInvestigation } from '../../../packages/react/src/time-investigation';
import { QualityPanel } from '../../../packages/react/src/quality-panel';
import { Scatter } from '../../../packages/react/src/scatter';
import { Distribution } from '../../../packages/react/src/distribution';
import { Relationship } from '../../../packages/react/src/relationship';
import { Matrix } from '../../../packages/react/src/matrix';
import { Explorer } from '../../../packages/react/src/explorer';
import { Workspace } from '../../../packages/react/src/workspace';

// Synthetic cohorts: the application owns these records and their meaning.
export const approvals = defineDataset({
  id: 'docs-approvals', entity: 'Cohort', label: 'Approval cohorts',
  identity: 'id', labelField: 'name', grain: 'cohort',
  dimensions: [{ key: 'name', label: 'Cohort' }], timeFields: [],
  metrics: [
    { key: 'approved', label: 'Approved', unit: 'requests', aggregation: 'sum' },
    { key: 'requests', label: 'Requests', unit: 'requests', aggregation: 'sum' },
    { key: 'rate', label: 'Approval rate', format: 'percent', aggregation: 'ratio-of-sums',
      ratio: { numerator: 'approved', denominator: 'requests', zeroDenominator: 'null', missing: 'exclude-pair' } },
  ],
} as const);
export const approvalSnapshot: DataSnapshot = {
  status: 'ready', scope: 'entire-dataset',
  records: [
    { id: 'small', name: 'Small cohort', approved: 1, requests: 2 },
    { id: 'large', name: 'Large cohort', approved: 90, requests: 100 },
  ],
};
export function MetricExample() {
  return <Metric value={42} label="Active records" />;
}
export function TableExample() {
  const [selectedId, onSelect] = useState<string | null>(null);
  return <><Table dataset={approvals} snapshot={approvalSnapshot} selectedId={selectedId} onSelect={onSelect} />
    <p role="status">Selected cohort: {selectedId ?? 'none'}</p></>;
}
export function FilterExample() {
  const [filters, onChange] = useState<readonly SemanticFilter[]>([]);
  const snapshot = { ...approvalSnapshot, records: filterRecords(approvalSnapshot.records, filters, approvals), scope: 'filtered-result' as const };
  return <><Filter dataset={approvals} filters={filters} onChange={onChange} />
    <Table dataset={approvals} snapshot={snapshot} /></>;
}
export function RatioExample() {
  const metric = approvals.metrics[2];
  return <Metric value={aggregateMetric(approvalSnapshot.records, metric)} label="Combined approval rate" metric={metric} />;
}
export function PartialExample() {
  return <Table dataset={approvals} snapshot={{ ...approvalSnapshot, scope: 'loaded-page', totalCount: 20, stale: true }} />;
}
export function RankingExample() {
  return <Ranking dataset={approvals} snapshot={approvalSnapshot} metric="rate" direction="desc" />;
}
export function DetailExample() {
  return <Detail dataset={approvals} snapshot={approvalSnapshot} selectedId="large" />;
}
export const monthlyApprovals = defineDataset({ ...approvals, id: 'docs-monthly-approvals', grain: 'month', timeFields: [{ key: 'month', label: 'Month', temporal: 'month' }] } as const);
export const monthlySnapshot: DataSnapshot = { status: 'ready', scope: 'entire-dataset', records: [
  { id: 'jan', name: 'January', month: '2026-01', approved: 7, requests: 10 },
  { id: 'feb', name: 'February', month: '2026-02', approved: 9, requests: 10 },
  { id: 'mar', name: 'March', month: '2026-03', approved: 8, requests: 10 },
] };
export function TrendExample() {
  return <Trend dataset={monthlyApprovals} snapshot={monthlySnapshot} metric="rate" timeField="month" />;
}
export function ComparisonExample() {
  const [selectedIds, onSelectionChange] = useState<readonly string[]>(['small', 'large']);
  return <Comparison dataset={approvals} snapshot={approvalSnapshot} metrics={['approved', 'rate']} selectedIds={selectedIds} onSelectionChange={onSelectionChange} />;
}
export function DeltaExample() {
  return <Delta value={91} baseline={80} label="Approved request change" baselineLabel="Explicit previous cohort total" />;
}
export function RecordListExample() {
  const [selectedId, onSelect] = useState<string | null>(null);
  return <RecordList dataset={approvals} snapshot={approvalSnapshot} fields={['approved', 'rate']} selectedId={selectedId} onSelect={onSelect} />;
}
export function SelectionSummaryExample() {
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(['small', 'large']);
  return <SelectionSummary dataset={approvals} snapshot={approvalSnapshot} selectedIds={selectedIds} onClear={() => setSelectedIds([])} />;
}
export function OverviewExample() {
  const [selectedId, onSelect] = useState<string | null>(null);
  return <Overview dataset={approvals} snapshot={approvalSnapshot} metrics={['approved', 'rate']} selectedId={selectedId} onSelect={onSelect} />;
}

export function ScatterExample() {
  return <Scatter dataset={approvals} snapshot={approvalSnapshot} xMetric="requests" metric="approved" title="Requests and approvals" />;
}
export function DistributionExample() {
  return <Distribution dataset={approvals} snapshot={approvalSnapshot} metric="requests" title="Request distribution" />;
}
export function MatrixExample() {
  return <Matrix dataset={approvals} snapshot={approvalSnapshot} columns={['approved', 'requests', 'rate']} title="Cohort metric matrix" />;
}
export function ExplorerExample() {
  const [selectedId, onSelect] = useState<string | null>(null);
  const [filters, onFiltersChange] = useState<readonly SemanticFilter[]>([]);
  return <Explorer dataset={approvals} snapshot={approvalSnapshot} metric="rate" columns={['name', 'approved', 'requests']} selectedId={selectedId} onSelect={onSelect} filters={filters} onFiltersChange={onFiltersChange} title="Approval explorer" />;
}

export const teams = defineDataset({
  id: 'docs-teams', entity: 'Team', label: 'Service teams', identity: 'id', labelField: 'name', grain: 'team',
  dimensions: [{ key: 'name', label: 'Team' }, { key: 'owner', label: 'Owner' }], metrics: [], timeFields: [],
  metadata: { source: 'Synthetic release documentation fixture', sourceDate: '2026-09-07', snapshotVersion: 'docs-1' },
} as const);
export const teamSnapshot: DataSnapshot = { status: 'ready', scope: 'entire-dataset', metadata: teams.metadata, records: [
  { id: 'payments', name: 'Payments', owner: 'Commerce engineering' },
  { id: 'discovery', name: 'Discovery', owner: 'Search engineering' },
  { id: 'platform', name: 'Platform', owner: 'Core engineering' },
] };

export const serviceEvents = defineDataset({
  id: 'docs-service-events', entity: 'ServiceEvent', label: 'Service operations',
  identity: 'id', labelField: 'name', grain: 'service-event',
  dimensions: [{ key: 'name', label: 'Event' }, { key: 'team', label: 'Team' }, { key: 'teamId', label: 'Team ID', semanticType: 'identifier' }],
  timeFields: [{ key: 'occurredAt', label: 'Occurred at', temporal: 'instant' }],
  metrics: [
    { key: 'requests', label: 'Requests', unit: 'requests', aggregation: 'sum' },
    { key: 'errors', label: 'Errors', unit: 'requests', aggregation: 'sum' },
    { key: 'errorRate', label: 'Error rate', format: 'percent', aggregation: 'ratio-of-sums', ratio: { numerator: 'errors', denominator: 'requests', zeroDenominator: 'null', missing: 'exclude-pair' } },
  ],
  relationships: [{ id: 'team', label: 'Owned by', field: 'teamId', targetDatasetId: 'docs-teams', cardinality: 'many-to-one' }],
  metadata: { source: 'Synthetic release documentation fixture', sourceDate: '2026-09-07', snapshotVersion: 'docs-1' },
  caveat: 'Events are synthetic and temporal proximity does not imply causality.',
} as const);
export const serviceEventSnapshot: DataSnapshot = {
  status: 'ready', scope: 'entire-dataset', totalCount: 4, revision: 1,
  metadata: serviceEvents.metadata,
  records: [
    { id: 'evt-1', name: 'Payments deploy', team: 'Payments', teamId: 'payments', occurredAt: '2026-09-07T08:00:00Z', requests: 1200, errors: 24, errorRate: null },
    { id: 'evt-2', name: 'Search index refresh', team: 'Discovery', teamId: 'discovery', occurredAt: '2026-09-07T09:00:00Z', requests: 1800, errors: 9, errorRate: null },
    { id: 'evt-3', name: 'Payments rollback', team: 'Payments', teamId: 'payments', occurredAt: '2026-09-07T10:00:00Z', requests: 900, errors: 36, errorRate: null },
    { id: 'evt-4', name: 'Identity config change', team: 'Platform', teamId: 'platform', occurredAt: '2026-09-07T11:00:00Z', requests: 1500, errors: null, errorRate: null },
  ],
};
export function MetricBreakdownExample() { return <MetricBreakdown dataset={serviceEvents} snapshot={serviceEventSnapshot} metric="errorRate" dimension="team" />; }
export function EventTimelineExample() { const [selectedId, onSelect] = useState<string | null>(null); return <EventTimeline dataset={serviceEvents} snapshot={serviceEventSnapshot} timeField="occurredAt" selectedId={selectedId} onSelect={onSelect} />; }
export function TimeInvestigationExample() { return <TimeInvestigation dataset={serviceEvents} snapshot={serviceEventSnapshot} metric="errors" timeField="occurredAt" baseline={50} baselineLabel="Previous explicit window" />; }
export function QualityPanelExample() { return <QualityPanel dataset={serviceEvents} snapshot={serviceEventSnapshot} />; }
export function RelationshipExample() {
  const [selectedId, onSelect] = useState<string | null>(null);
  return <Relationship dataset={serviceEvents} snapshot={serviceEventSnapshot} relationship="team" targetDataset={teams} targetSnapshot={teamSnapshot} selectedId={selectedId} onSelect={onSelect} title="Events and owning teams" />;
}

export function OperationalWorkspaceExample() {
  const store = useMemo(() => {
    const snapshots: Record<string, DataSnapshot> = {
      [serviceEvents.id]: serviceEventSnapshot,
      [teams.id]: teamSnapshot,
    };
    const datasets = [serviceEvents, teams];
    const dataPort: DataPort = {
      listDatasets: () => datasets,
      getDataset: id => datasets.find(dataset => dataset.id === id),
      getSnapshot: id => snapshots[id] ?? { status: 'error', error: 'Unknown dataset', records: [] },
      subscribe: () => () => undefined,
    };
    return createWorkspace({ dataPort, nodes: [
      { id: 'breakdown', component: 'MetricBreakdown', datasetId: serviceEvents.id, metric: 'errorRate', dimension: 'team', title: 'Errors by team' },
      { id: 'events', component: 'Table', datasetId: serviceEvents.id, columns: ['name', 'team', 'occurredAt', 'errors'], dimension: 'team', timeField: 'occurredAt', title: 'Contributing events' },
      { id: 'detail', component: 'Detail', datasetId: serviceEvents.id, columns: ['name', 'team', 'occurredAt', 'errors'], title: 'Selected event' },
      { id: 'quality', component: 'QualityPanel', datasetId: serviceEvents.id, dimension: 'team', timeField: 'occurredAt', title: 'Evidence and coverage' },
    ], bindings: [
      { id: 'team-events', mode: 'group', source: 'breakdown', target: 'events', entity: 'ServiceEvent' },
      { id: 'team-quality', mode: 'group', source: 'breakdown', target: 'quality', entity: 'ServiceEvent' },
      { id: 'event-detail', source: 'events', target: 'detail', entity: 'ServiceEvent' },
    ] });
  }, []);
  return <><Workspace store={store} /><p className="docs-caption">Choose a team, then select an event. These are manual semantic operations; no agent is connected.</p></>;
}

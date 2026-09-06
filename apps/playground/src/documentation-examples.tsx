import { useState } from 'react';
import { Delta } from '../../../packages/react/src/delta';
import { RecordList } from '../../../packages/react/src/record-list';
import { SelectionSummary } from '../../../packages/react/src/selection-summary';
import { Overview } from '../../../packages/react/src/overview';
import { aggregateMetric, defineDataset, filterRecords, type DataSnapshot, type Filter as SemanticFilter } from '@aeliqo/core';
import { Metric } from '../../../packages/react/src/metric';
import { Table } from '../../../packages/react/src/table';
import { Filter } from '../../../packages/react/src/filter';
import { Ranking } from '../../../packages/react/src/ranking';
import { Trend } from '../../../packages/react/src/trend';
import { Detail } from '../../../packages/react/src/detail';
import { Comparison } from '../../../packages/react/src/comparison';

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

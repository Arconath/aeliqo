import { describe, expect, it } from 'vitest';
import { aggregateMetric, compareMetricRecords, defineDataset, filterRecords, formatMetric, type Dataset, type MetricField } from './model';
import { metricValue, validateSnapshot, snapshotWarnings } from './semantics';

const rate: MetricField = { key: 'rate', label: 'Approval rate', format: 'percent', aggregation: 'ratio-of-sums', ratio: { numerator: 'approved', denominator: 'requests', zeroDenominator: 'null', missing: 'exclude-pair' } };
const approvals: Dataset = { id: 'approvals', entity: 'Cohort', label: 'Approvals', identity: 'id', labelField: 'id', grain: 'cohort', dimensions: [{ key: 'id', label: 'Cohort' }], timeFields: [], metrics: [{ key: 'approved', label: 'Approved', unit: 'requests', aggregation: 'sum' }, { key: 'requests', label: 'Requests', unit: 'requests', aggregation: 'sum' }, rate] };
describe('declared semantic measures', () => {
  it('uses the ratio of sums and shares row values without materializing derived rows', () => {
    defineDataset(approvals);
    const records = [{ id: 'a', approved: 1, requests: 2 }, { id: 'b', approved: 90, requests: 100 }];
    expect(aggregateMetric(records, rate)).toBeCloseTo(91 / 102);
    expect(metricValue(records[0]!, rate)).toBe(0.5);
    expect([...records].sort((a, b) => compareMetricRecords(a, b, rate, 'desc'))[0]?.id).toBe('b');
    expect(filterRecords(records, [{ field: 'rate', operator: 'gt', value: 0.8 }], approvals)).toEqual([records[1]]);
    expect(aggregateMetric([...records].reverse(), rate)).toBeCloseTo(91 / 102);
  });
  it('makes zero and missing-pair policies explicit and never emits nonfinite results', () => {
    expect(aggregateMetric([{ approved: 1, requests: 0 }], rate)).toBeNull();
    expect(aggregateMetric([{ approved: null, requests: 500 }, { approved: 1, requests: 2 }], rate)).toBe(0.5);
    expect(aggregateMetric([{ approved: null, requests: 500 }], rate)).toBeNull();
    expect(aggregateMetric([{ approved: Number.MAX_VALUE, requests: 1 }, { approved: Number.MAX_VALUE, requests: 1 }], rate)).toBeNull();
    expect(aggregateMetric([{ value: Number.MAX_VALUE }, { value: Number.MAX_VALUE }], { key: 'value', label: 'Value', aggregation: 'sum' })).toBeNull();
  });
  it('rejects mismatched units, currencies, grain and nonadditive inputs', () => {
    for (const patch of [{ unit: 'people' }, { grain: 'event' }, { aggregation: 'mean' as const }, { format: 'currency' as const, unit: 'USD' }]) {
      expect(() => defineDataset({ ...approvals, metrics: [{ ...approvals.metrics[0]!, ...patch }, approvals.metrics[1]!, rate] })).toThrow();
    }
    expect(() => defineDataset({ ...approvals, metrics: [{ key: 'sales', label: 'Sales', format: 'currency', unit: 'dollars', aggregation: 'sum' }] })).toThrow();
  });
  it('retains the legacy revenue contract and currency formatting without conversion', () => {
    const revenue: MetricField = { key: 'revenue', label: 'Revenue', aggregation: 'sum', format: 'currency', unit: 'USD' };
    expect(aggregateMetric([{ revenue: 10 }, { revenue: 20 }], revenue)).toBe(30);
    expect(formatMetric(30, revenue)).toContain('$30');
  });
});
describe('snapshot validation and coverage', () => {
  it('rejects missing/duplicate identity and nonfinite source values', () => {
    for (const records of [[{ id: null }], [{ id: 'a' }, { id: 'a' }], [{ id: 'a', approved: Infinity }]]) expect(() => validateSnapshot(approvals, { records, status: 'ready' })).toThrow();
  });
  it('discloses partial loaded-page and stale results', () => {
    expect(snapshotWarnings({ records: [], status: 'ready', scope: 'loaded-page', totalCount: 100, stale: true })).toEqual(['Loaded page only; results are not global.', 'Showing 0 of 100 records.', 'Data is stale.']);
  });
  it('validates declared relationship targets and dangling complete references', () => {
    const source = { ...approvals, relationships: [{ id: 'parent', field: 'id', targetDatasetId: 'parents', cardinality: 'many-to-one' as const }] };
    const target = { ...approvals, id: 'parents' };
    expect(() => validateSnapshot(source, { records: [{ id: 'a' }], status: 'ready' }, { getDataset: () => target, getSnapshot: () => ({ records: [], status: 'ready', scope: 'entire-dataset' }) })).toThrow(/relationship/i);
    expect(() => validateSnapshot(source, { records: [{ id: 'a' }], status: 'ready' }, { getDataset: () => target, getSnapshot: () => ({ records: [], status: 'ready', scope: 'loaded-page' }) })).not.toThrow();
  });
  it('rejects fanout, false full scope and one-to-one duplicate edges', () => {
    const source = { ...approvals, relationships: [{ id: 'parent', field: 'requests', targetDatasetId: 'parents', cardinality: 'one-to-one' as const }] };
    const target = { ...approvals, id: 'parents' };
    expect(() => validateSnapshot(approvals, { records: [], status: 'ready', scope: 'entire-dataset', totalCount: 10 })).toThrow();
    expect(() => validateSnapshot(source, { records: [{ id: 'a', requests: 1 }, { id: 'b', requests: 1 }], status: 'ready' }, { getDataset: () => target, getSnapshot: () => ({ records: [{ id: 1 }], status: 'ready' }) })).toThrow(/One-to-one/);
    expect(() => validateSnapshot(source, { records: [], status: 'ready' }, { getDataset: () => target, getSnapshot: () => ({ records: [{ id: 1 }, { id: 1 }], status: 'ready' }) })).toThrow(/fanout/);
  });
});

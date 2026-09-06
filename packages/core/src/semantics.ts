import type { DataPort, DataRecord, DataSnapshot, Dataset, MetricField } from './model';

function requireMeaning(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Bounded additive ratio; incomplete pairs are excluded together, never independently. */
export function aggregateRatio(records: readonly DataRecord[], metric: MetricField): number | null {
  const ratio = metric.ratio;
  requireMeaning(ratio && ratio.zeroDenominator === 'null' && ratio.missing === 'exclude-pair', 'Ratio requires explicit zero and missing-pair policies');
  let numerator = 0, denominator = 0, count = 0;
  for (const record of records) {
    const n = record[ratio.numerator], d = record[ratio.denominator];
    if (!finite(n) || !finite(d)) continue;
    numerator += n; denominator += d; count++;
  }
  if (!count || !finite(numerator) || !finite(denominator) || denominator === 0) return null;
  const result = numerator / denominator;
  return finite(result) ? result : null;
}

/** Shared row accessor for ranking, filtering and tabular/visual projections. */
export function metricValue(record: DataRecord, metric: MetricField): number | null {
  if (metric.aggregation === 'ratio-of-sums') return aggregateRatio([record], metric);
  const value = record[metric.key];
  return finite(value) ? value : null;
}

export function validateMetricDeclarations(dataset: Dataset): void {
  if (dataset.grain !== undefined) requireMeaning(dataset.grain.trim().length > 0, 'Dataset grain must be nonempty');
  for (const metric of dataset.metrics) {
    requireMeaning(['sum', 'mean', 'none', 'ratio-of-sums'].includes(metric.aggregation), 'Unknown aggregation');
    if (metric.grain !== undefined) requireMeaning(metric.grain.trim().length > 0 && (!dataset.grain || metric.grain === dataset.grain), `Metric grain mismatch: ${metric.key}`);
    if (metric.unit !== undefined) requireMeaning(metric.unit.trim().length > 0, 'Metric unit must be nonempty');
    if (metric.decimals !== undefined) requireMeaning(Number.isInteger(metric.decimals) && metric.decimals >= 0 && metric.decimals <= 20, 'Metric decimals must be 0–20');
    if (metric.format === 'currency') requireMeaning(metric.unit && /^[A-Z]{3}$/.test(metric.unit) && Intl.supportedValuesOf('currency').includes(metric.unit), 'Currency metric requires a supported currency code');
    if (metric.aggregation !== 'ratio-of-sums') {
      requireMeaning(!metric.ratio, 'Ratio definition requires ratio-of-sums aggregation');
      continue;
    }
    const ratio = metric.ratio;
    requireMeaning(ratio && ratio.zeroDenominator === 'null' && ratio.missing === 'exclude-pair', 'Ratio requires explicit zero and missing-pair policies');
    const numerator = dataset.metrics.find(field => field.key === ratio.numerator);
    const denominator = dataset.metrics.find(field => field.key === ratio.denominator);
    requireMeaning(numerator && denominator && numerator !== metric && denominator !== metric, 'Ratio inputs must reference declared measures');
    requireMeaning(numerator.aggregation === 'sum' && denominator.aggregation === 'sum', 'Ratio inputs must be additive sums');
    requireMeaning(numerator.unit === denominator.unit && numerator.format === denominator.format, 'Ratio input units or currency mismatch');
    requireMeaning((numerator.grain ?? dataset.grain) === (denominator.grain ?? dataset.grain), 'Ratio input grain mismatch');
    requireMeaning(metric.format !== 'currency' && !metric.unit, 'This ratio is dimensionless; currency/unit outputs are unsupported');
  }
}

/** Validates local records, without mistaking a partial target snapshot for a complete graph. */
export function validateSnapshot(dataset: Dataset, snapshot: DataSnapshot, related?: Pick<DataPort, 'getDataset' | 'getSnapshot'>): void {
  requireMeaning(['ready', 'loading', 'error'].includes(snapshot.status), 'Unknown snapshot status');
  if (snapshot.scope !== undefined) requireMeaning(['entire-dataset', 'filtered-result', 'loaded-page', 'sample'].includes(snapshot.scope), 'Unknown snapshot scope');
  const ids = new Set<string>();
  for (const record of snapshot.records) {
    const key = record[dataset.identity];
    requireMeaning((typeof key === 'string' && key.length > 0) || finite(key), 'Snapshot requires stable record identity');
    requireMeaning(!ids.has(String(key)), 'Snapshot has duplicate record identity');
    ids.add(String(key));
    requireMeaning(Object.values(record).every(value => value === null || typeof value === 'string' || finite(value)), 'Snapshot values must be finite JSON scalars');
  }
  if (snapshot.totalCount !== undefined) requireMeaning(Number.isSafeInteger(snapshot.totalCount) && snapshot.totalCount >= snapshot.records.length, 'Snapshot totalCount must cover loaded records');
  if (snapshot.scope === 'entire-dataset' && snapshot.status === 'ready' && snapshot.totalCount !== undefined) requireMeaning(snapshot.totalCount === snapshot.records.length, 'Entire-dataset snapshot cannot omit known records');
  if (!related) return;
  for (const relation of dataset.relationships ?? []) {
    const target = related.getDataset(relation.targetDatasetId);
    requireMeaning(target, 'Unknown relationship target dataset');
    const field = relation.targetField ?? target.identity;
    requireMeaning(field === target.identity || [...target.dimensions, ...target.metrics, ...target.timeFields].some(item => item.key === field), 'Unknown relationship target field');
    const targetSnapshot = related.getSnapshot(target.id);
    const keys = new Set<string | number>();
    for (const record of targetSnapshot.records) {
      const key = record[field];
      if (key == null) continue;
      requireMeaning(!keys.has(key), 'Relationship target must be unique; fanout is unsupported');
      keys.add(key);
    }
    const sourceKeys = new Set<string | number>();
    for (const record of snapshot.records) {
      const key = record[relation.field];
      if (key == null) { requireMeaning(relation.optional !== false, 'Required relationship is missing'); continue; }
      if (relation.cardinality === 'one-to-one') requireMeaning(!sourceKeys.has(key), 'One-to-one relationship has repeated source key');
      sourceKeys.add(key);
      if (targetSnapshot.status === 'ready' && targetSnapshot.scope === 'entire-dataset') requireMeaning(keys.has(key), 'Dangling relationship reference');
    }
  }
}

export function snapshotWarnings(snapshot: DataSnapshot): readonly string[] {
  const warnings: string[] = [];
  if (snapshot.scope === 'loaded-page') warnings.push('Loaded page only; results are not global.');
  if (snapshot.scope === 'sample') warnings.push('Sample only; results are not global.');
  if (snapshot.scope === 'filtered-result') warnings.push('Results cover the declared filtered population.');
  if (snapshot.totalCount !== undefined && snapshot.totalCount > snapshot.records.length) warnings.push(`Showing ${snapshot.records.length} of ${snapshot.totalCount} records.`);
  if (snapshot.stale) warnings.push('Data is stale.');
  return warnings;
}

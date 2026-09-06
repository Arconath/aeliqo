import { useMemo } from "react";
import { type Dataset, type DataSnapshot } from "@aeliqo/core";
import { Card, DataState, DataWarnings, safeSnapshot, useData, type SemanticProps } from "./shared";
import { Table } from "./table";

export interface ComparisonProps {
  dataset: Dataset;
  snapshot: DataSnapshot;
  metrics: readonly string[];
  selectedIds: readonly string[];
  onSelectionChange?: (ids: readonly string[]) => void;
  title?: string;
}
/** Each row compares the same declared measure across entities; rows are never combined. */
export function Comparison(props: ComparisonProps | SemanticProps) {
  return "store" in props ? <SemanticComparison {...props} /> : <StandaloneComparison {...props} />;
}
function SemanticComparison(props: SemanticProps) {
  const { data, dataset, metric } = useData(props);
  if (!dataset) return <DataState data={{ status: "error", records: [], error: "Dataset is unavailable." }} />;
  return <ComparisonView dataset={dataset} snapshot={data} title={props.node.title}
    metrics={props.node.columns ?? (metric ? [metric.key] : [])}
    selectedIds={props.node.compareIds ?? data.records.slice(0, Math.max(2, Math.min(props.node.limit ?? 4, 8))).map(record => String(record[dataset.identity]))}
    onSelectionChange={compareIds => props.store.apply({ version: 1, baseRevision: props.store.getState().revision, operations: [{ type: "configure", id: props.node.id, patch: { compareIds } }] }, { actor: "human" })} />;
}
function StandaloneComparison(props: ComparisonProps) {
  const snapshot = useMemo(() => safeSnapshot(props.dataset, props.snapshot), [props.dataset, props.snapshot]);
  return <ComparisonView {...props} snapshot={snapshot} />;
}
function ComparisonView({ dataset, snapshot, metrics, selectedIds, onSelectionChange, title }: ComparisonProps) {
  const fields = metrics.flatMap(key => { const metric = dataset.metrics.find(field => field.key === key); return metric ? [metric] : []; });
  const invalid = !metrics.length || metrics.length > 20 || new Set(metrics).size !== metrics.length || fields.length !== metrics.length ? "Choose 1–20 unique declared metrics." : selectedIds.length > 8 || new Set(selectedIds).size !== selectedIds.length ? "Choose at most eight unique entities." : undefined;
  const data = invalid ? { status: "error" as const, records: [], error: invalid } : snapshot;
  const records = new Map(snapshot.records.map(record => [String(record[dataset.identity]), record]));
  const selectedRecords = selectedIds.map(id => records.get(id) ?? {
    [dataset.identity]: id,
    [dataset.labelField]: `${id} (unavailable)`,
    ...Object.fromEntries(fields.map(field => [field.key, null])),
  });
  const comparisonSnapshot: DataSnapshot = {
    ...snapshot,
    records: selectedRecords,
    scope: "filtered-result",
    totalCount: selectedRecords.length,
    stale: false,
  };
  return <Card title={title ?? "Entity comparison"} subtitle={dataset.label} badge="Comparison">
    {data.status !== "ready" || !data.records.length ? <DataState data={data} /> : <>
      {onSelectionChange && <fieldset className="aeliqo-compare-choices">
        <legend>Choose entities to compare (2–8)</legend>
        {snapshot.records.slice(0, 100).map(record => {
          const id = String(record[dataset.identity]);
          const checked = selectedIds.includes(id);
          return <label key={id}><input type="checkbox" checked={checked} disabled={checked ? selectedIds.length <= 2 : selectedIds.length >= 8} onChange={() => onSelectionChange(checked ? selectedIds.filter(value => value !== id) : [...selectedIds, id])} />{String(record[dataset.labelField] ?? id)}</label>;
        })}
        {snapshot.records.length > 100 && <p className="aeliqo-hint">First 100 loaded candidates shown. Narrow the data scope to choose others.</p>}
      </fieldset>}
      {selectedIds.length < 2 ? <p role="status">Choose at least two entities to compare.</p> : <>
        {onSelectionChange && <ul className="aeliqo-compare-selection" aria-label="Selected comparison entities">
          {selectedIds.map(id => <li key={id}>{String(records.get(id)?.[dataset.labelField] ?? `${id} (unavailable)`)} <button type="button" disabled={selectedIds.length <= 2} aria-label={`Remove ${String(records.get(id)?.[dataset.labelField] ?? id)} from comparison`} onClick={() => onSelectionChange(selectedIds.filter(value => value !== id))}>Remove</button></li>)}
        </ul>}
        <Table dataset={dataset} snapshot={comparisonSnapshot} columns={[dataset.labelField, ...fields.map(field => field.key)]} title="Declared measures for selected entities" />
      </>}
    </>}
    <DataWarnings data={snapshot} />
  </Card>;
}

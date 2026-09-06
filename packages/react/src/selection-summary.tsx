import { useMemo } from "react";
import type { Dataset, DataSnapshot } from "@aeliqo/core";
import { Card, DataState, DataWarnings, safeSnapshot, useData, useSelection, type SemanticProps } from "./shared";
export interface SelectionSummaryProps { dataset: Dataset; snapshot: DataSnapshot; selectedIds: readonly string[]; onClear?: () => void; title?: string }
export function SelectionSummary(props: SelectionSummaryProps | SemanticProps) { return "store" in props ? <SemanticSummary {...props} /> : <StandaloneSummary {...props} />; }
function SemanticSummary(props: SemanticProps) {
  const { data, dataset } = useData(props);
  const id = useSelection(props.store, props.node.id);
  return dataset ? <SummaryView dataset={dataset} snapshot={data} selectedIds={id ? [id] : []} title={props.node.title} /> : <DataState data={{ status: "error", records: [], error: "Dataset is unavailable." }} />;
}
function StandaloneSummary(props: SelectionSummaryProps) {
  const snapshot = useMemo(() => safeSnapshot(props.dataset, props.snapshot), [props.dataset, props.snapshot]);
  return <SummaryView {...props} snapshot={snapshot} />;
}
function SummaryView({ dataset, snapshot, selectedIds, onClear, title }: SelectionSummaryProps) {
  const records = useMemo(() => new Map(snapshot.records.map(record => [String(record[dataset.identity]), record])), [dataset, snapshot.records]);
  const unique = new Set(selectedIds);
  const invalid = unique.size !== selectedIds.length || selectedIds.some(id => !id) || selectedIds.length > 100;
  return <Card title={title ?? "Selection"} subtitle={`${selectedIds.length} explicit identities selected`}>
    {invalid ? <p role="alert">Provide at most 100 unique nonempty identities.</p> : <>
      {snapshot.status !== "ready" && <DataState data={snapshot} />}
      {!selectedIds.length ? <p role="status">No records selected.</p> : <ul className="aeliqo-selection-summary">{selectedIds.map(id => { const record = records.get(id); return <li key={id}>{record ? String(record[dataset.labelField] ?? id) : `${id} (unavailable in loaded scope)`}</li>; })}</ul>}
      {onClear && <button type="button" disabled={!selectedIds.length} onClick={onClear}>Clear selection</button>}
      <p className="aeliqo-hint">Explicit identities only; no implied selection of unloaded records.</p>
      <DataWarnings data={snapshot} />
    </>}
  </Card>;
}

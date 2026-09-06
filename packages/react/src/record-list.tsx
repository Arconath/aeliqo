import { useMemo } from "react";
import { formatMetric, metricValue, type Dataset, type DataSnapshot } from "@aeliqo/core";
import { Card, DataState, DataWarnings, FieldValue, safeSnapshot, useData, useSelection, select, type SemanticProps } from "./shared";
export interface RecordListProps { dataset: Dataset; snapshot: DataSnapshot; fields?: readonly string[]; selectedId?: string | null; onSelect?: (id: string) => void; limit?: number; title?: string }
export function RecordList(props: RecordListProps | SemanticProps) { return "store" in props ? <SemanticRecordList {...props} /> : <StandaloneRecordList {...props} />; }
function SemanticRecordList(props: SemanticProps) {
  const { data, dataset } = useData(props);
  const selectedId = useSelection(props.store, props.node.id);
  return dataset ? <RecordListView dataset={dataset} snapshot={data} fields={props.node.columns} selectedId={selectedId} onSelect={id => select(props.store, props.node, id)} limit={props.node.limit} title={props.node.title} /> : <DataState data={{ status: "error", records: [], error: "Dataset is unavailable." }} />;
}
function StandaloneRecordList(props: RecordListProps) {
  const snapshot = useMemo(() => safeSnapshot(props.dataset, props.snapshot), [props.dataset, props.snapshot]);
  return <RecordListView {...props} snapshot={snapshot} />;
}
function RecordListView({ dataset, snapshot, fields, selectedId, onSelect, limit = 20, title }: RecordListProps) {
  const declared = [...dataset.dimensions, ...dataset.metrics, ...dataset.timeFields];
  const keys = fields ?? declared.filter(field => field.key !== dataset.labelField).slice(0, 3).map(field => field.key);
  const invalid = keys.length > 8 || new Set(keys).size !== keys.length || keys.some(key => !declared.some(field => field.key === key)) || !Number.isInteger(limit) || limit < 1;
  const data = invalid ? { status: "error" as const, records: [], error: "Choose up to eight unique declared fields and a positive integer limit." } : snapshot;
  const records = data.records.slice(0, Math.min(limit, 100));
  return <Card title={title ?? dataset.label} subtitle="Record summaries">
    {data.status !== "ready" || !records.length ? <DataState data={data} /> : <ul className="aeliqo-record-list">{records.map(record => {
      const id = String(record[dataset.identity]);
      return <li key={id} data-selected={selectedId === id}>
        {onSelect ? <button type="button" aria-pressed={selectedId === id} onClick={() => onSelect(id)}>{String(record[dataset.labelField] ?? id)}</button> : <h3>{String(record[dataset.labelField] ?? id)}</h3>}
        <dl>{keys.map(key => { const field = declared.find(field => field.key === key)!; const metric = dataset.metrics.find(metric => metric.key === key); return <div key={key}><dt>{field.label}</dt><dd>{metric ? formatMetric(metricValue(record, metric), metric) : <FieldValue value={record[key]} />}</dd></div>; })}</dl>
      </li>;
    })}</ul>}
    {records.length < data.records.length && <p className="aeliqo-hint">Showing {records.length} of {data.records.length} loaded records. Narrow the data scope for others.</p>}
    <DataWarnings data={data} />
  </Card>;
}

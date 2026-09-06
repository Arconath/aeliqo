import { useMemo } from "react";
import { aggregateMetric, type Dataset, type DataSnapshot } from "@aeliqo/core";
import { Metric } from "./metric";
import { RecordList } from "./record-list";
import { Card, DataState, DataWarnings, safeSnapshot, useData, useSelection, select, type SemanticProps } from "./shared";
export interface OverviewProps { dataset: Dataset; snapshot: DataSnapshot; metrics: readonly string[]; selectedId?: string | null; onSelect?: (id: string) => void; title?: string }
export function Overview(props: OverviewProps | SemanticProps) { return "store" in props ? <SemanticOverview {...props} /> : <StandaloneOverview {...props} />; }
function SemanticOverview(props: SemanticProps) {
  const { data, dataset, metric } = useData(props);
  const selectedId = useSelection(props.store, props.node.id);
  const metrics = useMemo(() => props.node.columns ?? (metric ? [metric.key] : []), [props.node.columns, metric]);
  return dataset ? <OverviewView dataset={dataset} snapshot={data} metrics={metrics} selectedId={selectedId} onSelect={id => select(props.store, props.node, id)} title={props.node.title} /> : <DataState data={{ status: "error", records: [], error: "Dataset is unavailable." }} />;
}
function StandaloneOverview(props: OverviewProps) {
  const snapshot = useMemo(() => safeSnapshot(props.dataset, props.snapshot), [props.dataset, props.snapshot]);
  return <OverviewView {...props} snapshot={snapshot} />;
}
function OverviewView({ dataset, snapshot, metrics, selectedId, onSelect, title }: OverviewProps) {
  const fields = useMemo(() => dataset.metrics.filter(field => metrics.includes(field.key)), [dataset, metrics]);
  const values = useMemo(() => new Map(fields.map(field => [field.key, aggregateMetric(snapshot.records, field)])), [fields, snapshot.records]);
  const invalid = !metrics.length || metrics.length > 6 || new Set(metrics).size !== metrics.length || fields.length !== metrics.length;
  return <Card title={title ?? `${dataset.label} overview`}>
    {invalid ? <p role="alert">Choose 1–6 unique declared metrics.</p> : snapshot.status !== "ready" ? <DataState data={snapshot} /> : <>
      <div className="aeliqo-overview-metrics">{metrics.map(key => { const metric = fields.find(field => field.key === key)!; return <Metric key={key} label={metric.label} metric={metric} value={values.get(key) ?? null} />; })}</div>
      <DataWarnings data={snapshot} />
      <RecordList dataset={dataset} snapshot={snapshot} selectedId={selectedId} onSelect={onSelect} />
    </>}
  </Card>;
}

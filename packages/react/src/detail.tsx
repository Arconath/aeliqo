import { useMemo, type ReactNode } from "react";
import { metricValue, formatMetric, type Dataset, type DataSnapshot, type WorkspaceNode } from "@aeliqo/core";
import { Card, DataState, safeSnapshot, DataWarnings, FieldValue, ready, useData, useSelection, type SemanticProps } from "./shared";
function RelatedRecord(
  props: SemanticProps & {
    value: string | number | null | undefined;
    field?: string;
    label: string;
  },
) {
  const { data, dataset } = useData(props);
  const related = useMemo(
    () =>
      dataset
        ? data.records.find(
            (record) =>
              props.value != null &&
              record[props.field ?? dataset.identity] === props.value,
          )
        : undefined,
    [data.records, dataset, props.value, props.field],
  );
  return (
    <div className="aeliqo-related">
      <span className="aeliqo-eyebrow">{props.label}</span>
      {data.status !== "ready" && <DataState data={data} />}
      <p>
        {related && dataset
          ? String(related[dataset.labelField])
          : "No related record available"}
      </p>
      {related?.source && <FieldValue value={related.source} />}
      <DataWarnings data={data} />
    </div>
  );
}
export interface DetailProps { dataset: Dataset; snapshot: DataSnapshot; selectedId?: string | null; columns?: readonly string[]; title?: string }
export function Detail(props: DetailProps | SemanticProps) {
  return "store" in props ? <SemanticDetail {...props} /> : <StandaloneDetail {...props} />;
}
function SemanticDetail(props: SemanticProps) {
  const { data, dataset } = useData(props);
  const selected = useSelection(props.store, props.node.id);
  const record = dataset ? data.records.find(item => String(item[dataset.identity]) === selected) : undefined;
  return <DetailView data={data} dataset={dataset} selected={selected} node={props.node} related={record && dataset?.relationships?.map(relationship => <RelatedRecord key={relationship.id} store={props.store} node={{ ...props.node, datasetId: relationship.targetDatasetId, filters: undefined }} value={record[relationship.field]} field={relationship.targetField} label={relationship.label ?? relationship.id} />)} />;
}
function StandaloneDetail(props: DetailProps) {
  const data = useMemo(() => safeSnapshot(props.dataset, props.snapshot), [props.dataset, props.snapshot]);
  return <DetailView data={data} dataset={props.dataset} selected={props.selectedId ?? null} node={props} />;
}
function DetailView({ data, dataset, selected, node, related }: { data: DataSnapshot; dataset?: Dataset; selected: string | null; node: Partial<WorkspaceNode>; related?: ReactNode }) {
  const visibleFields = useMemo(
    () => (node.columns ? new Set(node.columns) : null),
    [node.columns],
  );
  const record = useMemo(
    () =>
      dataset && selected
        ? data.records.find(
            (item) => String(item[dataset.identity]) === selected,
          )
        : undefined,
    [data.records, dataset, selected],
  );
  return (
    <Card
      title={node.title ?? "Entity details"}
      subtitle={dataset?.label}
      badge="Selected record"
    >
      {!ready(data) ? (
        <DataState data={data} />
      ) : !record || !dataset ? (
        <div className="aeliqo-state">
          <div className="aeliqo-state-icon" aria-hidden="true">
            ↖
          </div>
          {selected ? "The selected record is unavailable in this view." : `Select a ${dataset?.entity.toLowerCase() ?? "record"}`}
          <br />
          <span className="aeliqo-subtitle">
            Its semantic details will appear here.
          </span>
        </div>
      ) : (
        <div aria-live="polite">
          <h3 className="aeliqo-detail-title">
            {String(record[dataset.labelField])}
          </h3>
          <p className="aeliqo-subtitle">
            {dataset.entity} profile · {selected}
          </p>
          <dl className="aeliqo-detail-grid">
            {[...dataset.dimensions, ...dataset.timeFields]
              .filter(
                (field) =>
                  field.key !== dataset.labelField &&
                  (!visibleFields || visibleFields.has(field.key)),
              )
              .map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>
                    <FieldValue value={record[field.key]} />
                  </dd>
                </div>
              ))}
            {dataset.metrics
              .filter((field) => !visibleFields || visibleFields.has(field.key))
              .map((field) => (
              <div key={field.key}>
                <dt>{field.label}</dt>
                <dd>
                  {formatMetric(
                    metricValue(record, field),
                    field,
                  )}
                </dd>
              </div>
              ))}
          </dl>
          {related}
        </div>
      )}
      <DataWarnings data={data} />
    </Card>
  );
}

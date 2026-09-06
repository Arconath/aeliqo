import { useMemo } from "react";
import type { DataSnapshot, Dataset } from "@aeliqo/core";
import {
  Card,
  DataState,
  DataWarnings,
  safeSnapshot,
  useData,
  useSelection,
  type SemanticProps,
} from "./shared";
import { Detail } from "./detail";
import { Table } from "./table";

export interface QualityPanelProps {
  dataset: Dataset;
  snapshot: DataSnapshot;
  selectedId?: string | null;
  title?: string;
}
export function QualityPanel(props: QualityPanelProps | SemanticProps) {
  if ("store" in props) return <SemanticQualityPanel {...props} />;
  return (
    <QualityPanelView
      {...props}
      snapshot={safeSnapshot(props.dataset, props.snapshot)}
    />
  );
}
function SemanticQualityPanel(props: SemanticProps) {
  const { data, dataset } = useData(props);
  const selectedId = useSelection(props.store, props.node.id);
  return dataset ? (
    <QualityPanelView
      dataset={dataset}
      snapshot={data}
      selectedId={selectedId}
      title={props.node.title}
    />
  ) : (
    <DataState
      data={{ status: "error", records: [], error: "Dataset is unavailable." }}
    />
  );
}
function QualityPanelView({
  dataset,
  snapshot,
  selectedId,
  title,
}: QualityPanelProps) {
  const fields = useMemo(
    () => [...dataset.dimensions, ...dataset.metrics, ...dataset.timeFields],
    [dataset],
  );
  const missing = useMemo(
    () =>
      fields.map((field) => ({
        field,
        count: snapshot.records.reduce(
          (count, record) => count + (record[field.key] == null ? 1 : 0),
          0,
        ),
      })),
    [fields, snapshot.records],
  );
  const total = snapshot.totalCount;
  const coverage =
    total === undefined
      ? null
      : total === 0
        ? 1
        : snapshot.records.length / total;
  const missingDataset = useMemo<Dataset>(
    () => ({
      id: `${dataset.id}-quality-fields`,
      entity: "Field",
      label: "Loaded field completeness",
      identity: "field",
      labelField: "label",
      dimensions: [
        { key: "field", label: "Field key", semanticType: "identifier" },
        { key: "label", label: "Field", semanticType: "text" },
      ],
      metrics: [
        { key: "missing", label: "Missing", aggregation: "none" },
        { key: "loaded", label: "Loaded records", aggregation: "none" },
      ],
      timeFields: [],
      grain: "declared field",
    }),
    [dataset.id],
  );
  const missingSnapshot = useMemo<DataSnapshot>(
    () => ({
      status: "ready",
      records: missing.map(({ field, count }) => ({
        field: field.key,
        label: field.label,
        missing: count,
        loaded: snapshot.records.length,
      })),
      scope: "entire-dataset",
      totalCount: missing.length,
      metadata: snapshot.metadata,
      stale: snapshot.stale,
      revision: snapshot.revision,
    }),
    [
      missing,
      snapshot.metadata,
      snapshot.records.length,
      snapshot.revision,
      snapshot.stale,
    ],
  );
  return (
    <Card
      title={title ?? `${dataset.label} quality`}
      subtitle="Known provenance and limits; unknown facts remain unknown"
      badge={
        snapshot.status === "error"
          ? "Failed"
          : snapshot.stale
            ? "Stale"
            : "Quality"
      }
    >
      {snapshot.status !== "ready" ? (
        <DataState data={snapshot} />
      ) : (
        <>
          <dl className="aeliqo-quality-grid">
            <div>
              <dt>Source</dt>
              <dd>
                {snapshot.metadata?.source ??
                  dataset.metadata?.source ??
                  "Unknown"}
              </dd>
            </div>
            <div>
              <dt>Snapshot date</dt>
              <dd>
                {snapshot.metadata?.sourceDate ??
                  dataset.metadata?.sourceDate ??
                  "Unknown"}
              </dd>
            </div>
            <div>
              <dt>Snapshot version</dt>
              <dd>
                {snapshot.metadata?.snapshotVersion ??
                  dataset.metadata?.snapshotVersion ??
                  "Unknown"}
              </dd>
            </div>
            <div>
              <dt>Scope</dt>
              <dd>{snapshot.scope ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Coverage</dt>
              <dd>
                {coverage === null
                  ? "Unknown"
                  : new Intl.NumberFormat("en-US", {
                      style: "percent",
                      maximumFractionDigits: 1,
                    }).format(coverage)}
              </dd>
            </div>
            <div>
              <dt>Freshness</dt>
              <dd>
                {snapshot.stale === undefined
                  ? "Unknown"
                  : snapshot.stale
                    ? "Stale"
                    : "Current at snapshot time"}
              </dd>
            </div>
          </dl>
          <Table
            dataset={missingDataset}
            snapshot={missingSnapshot}
            columns={["label", "missing", "loaded"]}
            title="Missing values in loaded records"
          />
          {selectedId && (
            <Detail
              dataset={dataset}
              snapshot={snapshot}
              selectedId={selectedId}
              title="Selected source record"
            />
          )}
          {dataset.caveat && (
            <p className="aeliqo-caveat">Comparison limit: {dataset.caveat}</p>
          )}
          {!dataset.caveat && (
            <p className="aeliqo-hint">Comparison limits: Unknown</p>
          )}
        </>
      )}
      <DataWarnings data={snapshot} />
    </Card>
  );
}

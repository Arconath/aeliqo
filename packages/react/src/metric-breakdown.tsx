import { useMemo, useState } from "react";
import {
  aggregateMetric,
  deriveSnapshot,
  type DataRecord,
  type DataSnapshot,
  type Dataset,
  type MetricField,
} from "@aeliqo/core";
import { Metric } from "./metric";
import { Ranking } from "./ranking";
import { Table } from "./table";
import {
  Card,
  DataState,
  DataWarnings,
  interact,
  safeSnapshot,
  useData,
  useInteraction,
  type SemanticProps,
} from "./shared";

export interface MetricBreakdownProps {
  dataset: Dataset;
  snapshot: DataSnapshot;
  metric: string;
  dimension: string;
  selectedGroup?: string | null;
  onGroupSelect?: (group: string) => void;
  /** Typed group value. Presence makes the value controlled; null selects missing values. */
  selectedGroupValue?: string | number | null;
  onGroupValueSelect?: (group: string | number | null) => void;
  onGroupClear?: () => void;
  title?: string;
}

type BreakdownGroup = {
  key: string;
  label: string;
  value: string | number | null;
  contributing: DataRecord[];
  aggregate: number | null;
};

const groupKey = (value: string | number | null) =>
  value === null
    ? "null:"
    : typeof value === "number"
      ? `number:${value}`
      : `string:${value}`;

const groupLabel = (value: string | number | null) =>
  value === null
    ? "Unknown (missing)"
    : typeof value === "number"
      ? `${value} (number)`
      : value;

export function MetricBreakdown(props: MetricBreakdownProps | SemanticProps) {
  if ("store" in props) return <SemanticMetricBreakdown {...props} />;
  const snapshot = safeSnapshot(props.dataset, props.snapshot);
  return (
    <MetricBreakdownView
      {...props}
      snapshot={snapshot}
      typedSelectionControlled={Object.hasOwn(props, "selectedGroupValue")}
      typedSelectionPresent={Object.hasOwn(props, "selectedGroupValue")}
    />
  );
}

function SemanticMetricBreakdown(props: SemanticProps) {
  const { data, dataset, metric } = useData(props);
  const current = useInteraction(props.store, props.node.id, "group");
  const selectedGroupInteraction =
    current?.kind === "group" &&
    current.field === props.node.dimension &&
    (current.value !== null || current.valueType === "null")
      ? current
      : null;
  if (!dataset || !metric || !props.node.dimension)
    return (
      <DataState
        data={{
          status: "error",
          records: [],
          error: "Choose a declared metric and dimension for this breakdown.",
        }}
      />
    );
  return (
    <MetricBreakdownView
      dataset={dataset}
      snapshot={data}
      metric={metric.key}
      dimension={props.node.dimension}
      title={props.node.title}
      selectedGroupValue={selectedGroupInteraction?.value ?? null}
      typedSelectionControlled
      typedSelectionPresent={selectedGroupInteraction !== null}
      onGroupValueSelect={(value) =>
        interact(props.store, props.node, {
          kind: "group",
          field: props.node.dimension!,
          value,
          valueType:
            value === null
              ? "null"
              : typeof value === "number"
                ? "number"
                : "string",
        })
      }
      onGroupClear={() =>
        interact(props.store, props.node, {
          kind: "group",
          field: props.node.dimension!,
          value: null,
        })
      }
    />
  );
}

function MetricBreakdownView({
  dataset,
  snapshot,
  metric: metricKey,
  dimension,
  selectedGroup,
  onGroupSelect,
  selectedGroupValue,
  onGroupValueSelect,
  onGroupClear,
  typedSelectionControlled = false,
  typedSelectionPresent = false,
  title,
}: MetricBreakdownProps & {
  typedSelectionControlled?: boolean;
  typedSelectionPresent?: boolean;
}) {
  const [localGroupKey, setLocalGroupKey] = useState<string | null>(null);
  const metric = dataset.metrics.find((field) => field.key === metricKey);
  const dimensionField = dataset.dimensions.find(
    (field) => field.key === dimension,
  );
  const groups = useMemo(() => {
    if (!metric || !dimensionField) return [];
    const records = new Map<
      string,
      { value: string | number | null; records: DataRecord[] }
    >();
    for (const record of snapshot.records) {
      const raw = record[dimensionField.key];
      const value = raw == null ? null : raw;
      const key = groupKey(value);
      const existing = records.get(key);
      if (existing) existing.records.push(record);
      else records.set(key, { value, records: [record] });
    }
    return [...records].map<BreakdownGroup>(([key, entry]) => ({
      key,
      label: groupLabel(entry.value),
      value: entry.value,
      contributing: entry.records,
      aggregate: aggregateMetric(entry.records, metric),
    }));
  }, [snapshot.records, metric, dimensionField]);
  const activeGroupKey = typedSelectionControlled
    ? typedSelectionPresent
      ? groupKey(selectedGroupValue ?? null)
      : null
    : selectedGroup !== undefined
      ? selectedGroup === null
        ? null
        : groupKey(selectedGroup)
      : localGroupKey;
  const activeGroup = groups.find((group) => group.key === activeGroupKey);
  const selectedRecords = activeGroup?.contributing ?? [];
  const rankingDataset = useMemo<Dataset | null>(
    () =>
      metric && dimensionField
        ? {
            id: `${dataset.id}-breakdown`,
            entity: dimensionField.label,
            label: `${metric.label} by ${dimensionField.label}`,
            identity: "groupId",
            labelField: "groupLabel",
            dimensions: [
              { key: "groupId", label: `${dimensionField.label} identity` },
              { key: "groupLabel", label: dimensionField.label },
            ],
            metrics: [
              {
                ...metric,
                key: "value",
                aggregation: "none",
                ratio: undefined,
              } as MetricField,
            ],
            timeFields: [],
            grain: dimensionField.key,
          }
        : null,
    [dataset.id, metric, dimensionField],
  );
  const rankingSnapshot = useMemo<DataSnapshot>(
    () =>
      deriveSnapshot(
        snapshot,
        groups.map(({ key, label, aggregate }) => ({
          groupId: key,
          groupLabel: label,
          value: aggregate,
        })),
      ),
    [snapshot, groups],
  );
  const choose = (key: string) => {
    const group = groups.find((item) => item.key === key);
    if (!group) return;
    if (!typedSelectionControlled && selectedGroup === undefined)
      setLocalGroupKey(key);
    onGroupSelect?.(String(group.value ?? "Unknown"));
    onGroupValueSelect?.(group.value);
  };
  const clear = () => {
    if (!typedSelectionControlled && selectedGroup === undefined)
      setLocalGroupKey(null);
    onGroupClear?.();
  };
  const invalid =
    !metric ||
    !dimensionField ||
    !["sum", "ratio-of-sums"].includes(metric.aggregation);
  return (
    <Card
      title={title ?? `${metric?.label ?? "Metric"} breakdown`}
      subtitle={
        dimensionField
          ? `Grouped by ${dimensionField.label} at declared ${dataset.grain ?? "record"} grain`
          : dataset.label
      }
      badge="Breakdown"
    >
      {invalid ? (
        <p role="alert">
          Breakdown requires a declared additive or ratio-of-sums metric and a
          declared dimension.
        </p>
      ) : snapshot.status !== "ready" || !snapshot.records.length ? (
        <DataState data={snapshot} />
      ) : (
        <>
          <Metric
            value={aggregateMetric(snapshot.records, metric)}
            label={`Total ${metric.label}`}
            metric={metric}
          />
          {rankingDataset && (
            <Ranking
              dataset={rankingDataset}
              snapshot={rankingSnapshot}
              metric="value"
              selectedId={activeGroupKey}
              onSelect={choose}
              direction="desc"
              title={`${dimensionField.label} ${metric.aggregation === "sum" ? "contribution" : "breakdown"}`}
            />
          )}
          {activeGroup ? (
            <>
              <button type="button" onClick={clear}>
                Clear group
              </button>
              <Table
                dataset={dataset}
                snapshot={deriveSnapshot(snapshot, selectedRecords)}
                title={`Records in ${activeGroup.label}`}
              />
            </>
          ) : (
            <p className="aeliqo-hint">
              Select a group to inspect its records.
            </p>
          )}
        </>
      )}
      <DataWarnings data={snapshot} />
    </Card>
  );
}

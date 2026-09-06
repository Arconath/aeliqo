import { useState } from "react";
import {
  aggregateMetric,
  deriveSnapshot,
  parseTemporalValue,
  type DataSnapshot,
  type Dataset,
} from "@aeliqo/core";
import { Delta } from "./delta";
import { Detail } from "./detail";
import { EventTimeline, type TemporalRange } from "./event-timeline";
import { Table } from "./table";
import { Trend } from "./trend";
import {
  Card,
  DataState,
  interact,
  safeSnapshot,
  select,
  useData,
  useDatasetSnapshot,
  useInteraction,
  useSelection,
  type SemanticProps,
} from "./shared";

export interface TimeInvestigationProps {
  dataset: Dataset;
  snapshot: DataSnapshot;
  metric: string;
  timeField: string;
  baseline: number | null;
  baselineLabel: string;
  mode?: "absolute" | "relative";
  /** Optional explicit event source. Defaults to the measured dataset for compatibility. */
  eventDataset?: Dataset;
  eventSnapshot?: DataSnapshot;
  eventTimeField?: string;
  eventLabelField?: string;
  title?: string;
}
export function TimeInvestigation(
  props: TimeInvestigationProps | SemanticProps,
) {
  if ("store" in props) return <SemanticTimeInvestigation {...props} />;
  return (
    <TimeInvestigationView
      {...props}
      snapshot={safeSnapshot(props.dataset, props.snapshot)}
    />
  );
}
function SemanticTimeInvestigation(props: SemanticProps) {
  const { data, dataset, metric } = useData(props);
  const config = props.node.config;
  const current = useInteraction(props.store, props.node.id, "range");
  const selectedId = useSelection(props.store, props.node.id);
  const configuredEventDatasetId =
    typeof config?.eventDatasetId === "string"
      ? config.eventDatasetId
      : props.node.datasetId;
  const eventDataset = props.store.dataPort.getDataset(
    configuredEventDatasetId,
  );
  const eventData = useDatasetSnapshot(props.store, configuredEventDatasetId);
  const separateEvents = configuredEventDatasetId !== props.node.datasetId;
  if (!dataset || !metric || !props.node.timeField)
    return (
      <DataState
        data={{
          status: "error",
          records: [],
          error:
            "Choose a declared metric and time field for this investigation.",
        }}
      />
    );
  return (
    <TimeInvestigationView
      dataset={dataset}
      snapshot={data}
      metric={metric.key}
      timeField={props.node.timeField}
      baseline={typeof config?.baseline === "number" ? config.baseline : null}
      baselineLabel={
        typeof config?.baselineLabel === "string" ? config.baselineLabel : ""
      }
      mode={config?.mode === "relative" ? "relative" : "absolute"}
      eventDataset={eventDataset}
      eventSnapshot={eventData}
      eventTimeField={
        typeof config?.eventTimeField === "string"
          ? config.eventTimeField
          : props.node.timeField
      }
      eventLabelField={
        typeof config?.eventLabelField === "string"
          ? config.eventLabelField
          : undefined
      }
      title={props.node.title}
      controlledRange={
        current?.kind === "range" && current.field === props.node.timeField
          ? current.range
          : null
      }
      onRangeChange={(range) =>
        interact(props.store, props.node, {
          kind: "range",
          field: props.node.timeField!,
          range,
        })
      }
      selectedEventId={separateEvents ? undefined : selectedId}
      onEventSelect={
        separateEvents ? undefined : (id) => select(props.store, props.node, id)
      }
    />
  );
}
function TimeInvestigationView({
  dataset,
  snapshot,
  metric: metricKey,
  timeField,
  baseline,
  baselineLabel,
  mode,
  title,
  controlledRange,
  onRangeChange,
  selectedEventId,
  onEventSelect,
  eventDataset,
  eventSnapshot,
  eventTimeField,
  eventLabelField,
}: TimeInvestigationProps & {
  controlledRange?: TemporalRange | null;
  onRangeChange?: (range: TemporalRange | null) => void;
  selectedEventId?: string | null;
  onEventSelect?: (id: string) => void;
}) {
  const [range, setRange] = useState<TemporalRange | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const activeRange = controlledRange === undefined ? range : controlledRange;
  const changeRange = onRangeChange ?? setRange;
  const activeEvent = selectedEventId === undefined ? eventId : selectedEventId;
  const changeEvent = onEventSelect ?? setEventId;
  const metric = dataset.metrics.find((item) => item.key === metricKey);
  const temporalField = dataset.timeFields.find(
    (item) => item.key === timeField,
  );
  const resolvedEventDataset = eventDataset ?? dataset;
  const resolvedEventSnapshot = safeSnapshot(
    resolvedEventDataset,
    eventSnapshot ?? snapshot,
  );
  const resolvedEventTimeField = eventTimeField ?? timeField;
  const eventsArePrimary = resolvedEventDataset.id === dataset.id;
  const visibleRecords = activeRange
    ? snapshot.records.filter((record) => {
        if (!temporalField) return false;
        const timestamp = parseTemporalValue(record[timeField], temporalField);
        return (
          timestamp !== null &&
          timestamp >= activeRange.start &&
          timestamp <= activeRange.end
        );
      })
    : snapshot.records;
  return (
    <Card
      title={title ?? `${dataset.label} time investigation`}
      subtitle="Trend and known events are aligned in time; the view makes no causal claim"
      badge="Investigation"
    >
      {!metric ? (
        <p role="alert">Choose a declared metric for this investigation.</p>
      ) : snapshot.status !== "ready" ? (
        <DataState data={snapshot} />
      ) : (
        <div className="aeliqo-time-investigation">
          <Delta
            value={aggregateMetric(visibleRecords, metric)}
            baseline={baseline}
            baselineLabel={baselineLabel}
            label={metric.label}
            metric={metric}
            mode={mode}
          />
          <Trend
            dataset={dataset}
            snapshot={snapshot}
            metric={metricKey}
            timeField={timeField}
            range={activeRange}
            onRangeChange={changeRange}
          />
          <EventTimeline
            dataset={resolvedEventDataset}
            snapshot={resolvedEventSnapshot}
            timeField={resolvedEventTimeField}
            labelField={eventLabelField}
            selectedId={activeEvent}
            onSelect={changeEvent}
            range={activeRange}
            onRangeChange={changeRange}
          />
          {activeEvent && (
            <Detail
              dataset={resolvedEventDataset}
              snapshot={resolvedEventSnapshot}
              selectedId={activeEvent}
              title="Selected event"
            />
          )}
          <Table
            dataset={dataset}
            snapshot={
              activeRange ? deriveSnapshot(snapshot, visibleRecords) : snapshot
            }
            selectedId={eventsArePrimary ? activeEvent : null}
            columns={[dataset.labelField, timeField, metricKey]}
            title="Records in selected range"
          />
        </div>
      )}
    </Card>
  );
}

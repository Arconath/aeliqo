import { useEffect, useMemo, useState } from "react";
import {
  formatTemporalValue,
  parseTemporalValue,
  type DataSnapshot,
  type Dataset,
  type TemporalRange,
} from "@aeliqo/core";
import {
  Card,
  DataState,
  DataWarnings,
  interact,
  safeSnapshot,
  select,
  useData,
  useInteraction,
  useSelection,
  type SemanticProps,
} from "./shared";

export type { TemporalRange } from "@aeliqo/core";
export interface EventTimelineProps {
  dataset: Dataset;
  snapshot: DataSnapshot;
  timeField: string;
  labelField?: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  range?: TemporalRange | null;
  onRangeChange?: (range: TemporalRange | null) => void;
  /** Switch to bounded time-bucket drilldown above this event count. */
  denseThreshold?: number;
  title?: string;
}

const GROUP_PAGE_SIZE = 24;
const EVENT_PAGE_SIZE = 100;

function eventGroup(
  time: number,
  temporal: "month" | "date" | "instant" | undefined,
) {
  const date = new Date(time);
  return temporal === "month"
    ? String(date.getUTCFullYear())
    : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function EventTimeline(props: EventTimelineProps | SemanticProps) {
  if ("store" in props) return <SemanticEventTimeline {...props} />;
  return (
    <EventTimelineView
      {...props}
      snapshot={safeSnapshot(props.dataset, props.snapshot)}
    />
  );
}
function SemanticEventTimeline(props: SemanticProps) {
  const { data, dataset } = useData(props);
  const selectedId = useSelection(props.store, props.node.id);
  const current = useInteraction(props.store, props.node.id, "range");
  if (!dataset || !props.node.timeField)
    return (
      <DataState
        data={{
          status: "error",
          records: [],
          error: "Choose a declared time field for this timeline.",
        }}
      />
    );
  return (
    <EventTimelineView
      dataset={dataset}
      snapshot={data}
      timeField={props.node.timeField}
      labelField={props.node.dimension}
      title={props.node.title}
      selectedId={selectedId}
      onSelect={(id) => select(props.store, props.node, id)}
      range={
        current?.kind === "range" && current.field === props.node.timeField
          ? current.range
          : null
      }
      denseThreshold={20}
      onRangeChange={(range) =>
        interact(props.store, props.node, {
          kind: "range",
          field: props.node.timeField!,
          range,
        })
      }
    />
  );
}
function EventTimelineView({
  dataset,
  snapshot,
  timeField: timeKey,
  labelField,
  selectedId,
  onSelect,
  range,
  onRangeChange,
  denseThreshold = 20,
  title,
}: EventTimelineProps) {
  const [localRange, setLocalRange] = useState<TemporalRange | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [groupPage, setGroupPage] = useState(0);
  const [eventPage, setEventPage] = useState(0);
  const field = dataset.timeFields.find((item) => item.key === timeKey);
  const events = useMemo(
    () =>
      field
        ? snapshot.records
            .flatMap((record) => {
              const time = parseTemporalValue(record[field.key], field);
              return time === null
                ? []
                : [
                    {
                      record,
                      time,
                      id: String(record[dataset.identity]),
                      label: String(record[labelField ?? dataset.labelField]),
                    },
                  ];
            })
            .sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))
        : [],
    [snapshot.records, field, dataset, labelField],
  );
  const activeRange = range ?? localRange;
  const visibleEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          !activeRange ||
          (event.time >= activeRange.start && event.time <= activeRange.end),
      ),
    [events, activeRange],
  );
  const groupedEvents = useMemo(() => {
    const grouped = new Map<string, typeof visibleEvents>();
    for (const event of visibleEvents) {
      const key = eventGroup(event.time, field?.temporal);
      const existing = grouped.get(key);
      if (existing) existing.push(event);
      else grouped.set(key, [event]);
    }
    return [...grouped];
  }, [visibleEvents, field?.temporal]);
  const dense = visibleEvents.length > denseThreshold;
  const groupPages = Math.max(
    1,
    Math.ceil(groupedEvents.length / GROUP_PAGE_SIZE),
  );
  useEffect(() => {
    setGroupPage(0);
    setExpandedGroup(null);
    setEventPage(0);
  }, [activeRange?.start, activeRange?.end]);
  const updateRange = (next: TemporalRange | null) => {
    if (range === undefined) setLocalRange(next);
    onRangeChange?.(next);
  };
  const rangeOptions = [
    ...new Set([
      ...events.map((event) => event.time),
      ...(activeRange ? [activeRange.start, activeRange.end] : []),
    ]),
  ].sort((left, right) => left - right);
  const chooseEndpoint = (kind: "start" | "end", value: number) => {
    const current = activeRange ?? {
      start: events[0]?.time ?? value,
      end: events.at(-1)?.time ?? value,
    };
    const next =
      kind === "start"
        ? { start: Math.min(value, current.end), end: current.end }
        : { start: current.start, end: Math.max(value, current.start) };
    updateRange(next);
  };
  return (
    <Card
      title={title ?? `${dataset.label} timeline`}
      subtitle="Explicit events ordered by their declared timestamp; proximity does not imply causality"
      badge="Timeline"
    >
      {!field ? (
        <p role="alert">Choose a declared time field for this timeline.</p>
      ) : snapshot.status !== "ready" || !events.length ? (
        <DataState data={snapshot} />
      ) : (
        <>
          <fieldset className="aeliqo-timeline-range">
            <legend>Visible time range</legend>
            <label>
              Start{" "}
              <select
                value={activeRange?.start ?? rangeOptions[0]}
                onChange={(event) =>
                  chooseEndpoint("start", Number(event.currentTarget.value))
                }
              >
                {rangeOptions.map((time) => (
                  <option key={`s-${time}`} value={time}>
                    {formatTemporalValue(time, field)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              End{" "}
              <select
                value={activeRange?.end ?? rangeOptions.at(-1)}
                onChange={(event) =>
                  chooseEndpoint("end", Number(event.currentTarget.value))
                }
              >
                {rangeOptions.map((time) => (
                  <option key={`e-${time}`} value={time}>
                    {formatTemporalValue(time, field)}
                  </option>
                ))}
              </select>
            </label>
            {activeRange && (
              <button type="button" onClick={() => updateRange(null)}>
                Clear range
              </button>
            )}
          </fieldset>
          {dense ? (
            <div className="aeliqo-timeline-groups">
              <p role="status" className="aeliqo-hint">
                {visibleEvents.length} events grouped into{" "}
                {groupedEvents.length} declared time buckets.
              </p>
              <ol aria-label="Timeline groups">
                {groupedEvents
                  .slice(
                    groupPage * GROUP_PAGE_SIZE,
                    (groupPage + 1) * GROUP_PAGE_SIZE,
                  )
                  .map(([group, groupEvents]) => {
                    const expanded = expandedGroup === group;
                    const eventPages = Math.max(
                      1,
                      Math.ceil(groupEvents.length / EVENT_PAGE_SIZE),
                    );
                    return (
                      <li key={group}>
                        <button
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => {
                            setExpandedGroup(expanded ? null : group);
                            setEventPage(0);
                          }}
                        >
                          {group} · {groupEvents.length} events
                        </button>
                        {expanded && (
                          <ol
                            className="aeliqo-timeline"
                            aria-label={`Events in ${group}`}
                          >
                            {groupEvents
                              .slice(
                                eventPage * EVENT_PAGE_SIZE,
                                (eventPage + 1) * EVENT_PAGE_SIZE,
                              )
                              .map((event) => (
                                <TimelineEvent
                                  key={event.id}
                                  event={event}
                                  field={field}
                                  selectedId={selectedId}
                                  onSelect={onSelect}
                                />
                              ))}
                          </ol>
                        )}
                        {expanded && eventPages > 1 && (
                          <PageControls
                            label={`Events in ${group}`}
                            page={eventPage}
                            pages={eventPages}
                            onChange={setEventPage}
                          />
                        )}
                      </li>
                    );
                  })}
              </ol>
              {groupPages > 1 && (
                <PageControls
                  label="Timeline groups"
                  page={groupPage}
                  pages={groupPages}
                  onChange={setGroupPage}
                />
              )}
            </div>
          ) : (
            <ol className="aeliqo-timeline">
              {visibleEvents.map((event) => (
                <TimelineEvent
                  key={event.id}
                  event={event}
                  field={field}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              ))}
            </ol>
          )}
        </>
      )}
      <DataWarnings data={snapshot} />
    </Card>
  );
}

type TimelineItem = {
  id: string;
  label: string;
  time: number;
  record: DataSnapshot["records"][number];
};

function TimelineEvent({
  event,
  field,
  selectedId,
  onSelect,
}: {
  event: TimelineItem;
  field: Dataset["timeFields"][number];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <li>
      <time>{formatTemporalValue(event.time, field)}</time>
      <button
        type="button"
        aria-pressed={selectedId === event.id}
        onClick={() => onSelect?.(event.id)}
      >
        {event.label}
      </button>
    </li>
  );
}

function PageControls({
  label,
  page,
  pages,
  onChange,
}: {
  label: string;
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav aria-label={`${label} pages`} className="aeliqo-timeline-pages">
      <button
        type="button"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span>
        Page {page + 1} of {pages}
      </span>
      <button
        type="button"
        disabled={page + 1 >= pages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

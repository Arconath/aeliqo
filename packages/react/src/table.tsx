import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { compareMetricRecords, formatMetric, metricValue, type Dataset, type DataSnapshot, type WorkspaceNode, type MetricField, type Field } from "@aeliqo/core";
import { Card, DataState, DataWarnings, safeSnapshot, FieldValue, ready, useData, useSelection, select, type SemanticProps } from "./shared";
export interface TableProps {
  dataset: Dataset; snapshot: DataSnapshot; onSelect?: (id: string) => void;
  selectedId?: string | null; columns?: readonly string[]; title?: string;
}
export function Table(props: SemanticProps | TableProps) {
  return "store" in props ? <SemanticTable {...props} /> : <StandaloneTable {...props} />;
}
function StandaloneTable(props: TableProps) {
  const data = useMemo(() => safeSnapshot(props.dataset, props.snapshot), [props.dataset, props.snapshot]);
  return <TableView data={data} dataset={props.dataset} node={{ columns: props.columns, title: props.title }} selected={props.selectedId ?? null} onSelect={props.onSelect} />;
}
function SemanticTable(props: SemanticProps) {
  const { data, dataset } = useData(props);
  const selected = useSelection(props.store, props.node.id);
  return <TableView data={data} dataset={dataset} node={props.node} selected={selected} onSelect={id => select(props.store, props.node, id)} />;
}
function TableView({ data, dataset, node, selected, onSelect }: { data: DataSnapshot; dataset?: Dataset; node: Partial<WorkspaceNode>; selected: string | null; onSelect?: (id: string) => void }) {
  const activeStatusId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [active, setActive] = useState(0);
  const records = useMemo(() => {
    const rows = node.metric
      ? [...data.records].sort((a, b) =>
          compareMetricRecords(a, b, dataset?.metrics.find(field => field.key === node.metric) ?? node.metric!, node.direction),
        )
      : data.records;
    return rows.slice(0, node.limit ?? rows.length);
  }, [data.records, dataset, node.metric, node.direction, node.limit]);
  useEffect(() => {
    setActive(0);
    setScrollTop(0);
    if (viewport.current) viewport.current.scrollTop = 0;
  }, [records]);
  const fields = useMemo(() => {
    if (!dataset) return [];
    const declared = [
      ...dataset.dimensions,
      ...dataset.metrics,
      ...dataset.timeFields,
    ];
    const keys = node.columns ?? [
      dataset.labelField,
      ...dataset.dimensions
        .filter((field) => field.key !== dataset.labelField)
        .slice(0, 2)
        .map((field) => field.key),
      ...dataset.metrics.map((field) => field.key),
    ];
    return keys.flatMap((key) => {
      const field = declared.find((item) => item.key === key);
      return field ? [field] : [];
    });
  }, [dataset, node.columns]);
  const rowHeight = node.density === "compact" ? 36 : 48;
  const height = node.height ?? 420;
  const virtual = records.length > 100;
  const start = virtual
    ? Math.max(
        0,
        Math.min(records.length - 1, Math.floor(scrollTop / rowHeight) - 5),
      )
    : 0;
  const end = virtual
    ? Math.min(records.length, start + Math.ceil(height / rowHeight) + 10)
    : records.length;
  const shown = records.slice(start, end);
  const focusRow = (index: number) => {
    const next = Math.max(0, Math.min(records.length - 1, index));
    setActive(next);
    if (viewport.current) {
      viewport.current.scrollTop = next * rowHeight;
      setScrollTop(next * rowHeight);
    }
  };
  const renderValue = (record: DataSnapshot["records"][number], field: Field): ReactNode => {
    if ("aggregation" in field) {
      const value = metricValue(record, field as MetricField);
      return value === null ? <span aria-label="Not available">—</span> : formatMetric(value, field as MetricField);
    }
    return <FieldValue value={record[field.key]} />;
  };
  const activeRecord = records[active];
  return (
    <Card
      title={node.title ?? dataset?.label ?? "Records"}
      subtitle={`${dataset?.label ?? "Records"}${onSelect ? " · Select a record to inspect its details" : ""}`}
    >
      {!ready(data) || !dataset ? (
        <DataState data={data} />
      ) : (
        <>
          <div
            className="aeliqo-table-scroll"
            ref={viewport}
            data-virtualized={virtual}
            style={{ maxHeight: height }}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            tabIndex={virtual ? 0 : undefined}
            role={virtual ? "region" : undefined}
            aria-label={
              virtual
                ? `${node.title ?? dataset.label} — use arrow keys, Home or End to navigate; Enter selects`
                : undefined
            }
            aria-describedby={virtual ? activeStatusId : undefined}
            onKeyDown={(event) => {
              if (!virtual || event.target !== event.currentTarget) return;
              const next =
                event.key === "ArrowDown"
                  ? active + 1
                  : event.key === "ArrowUp"
                    ? active - 1
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? records.length - 1
                        : event.key === "PageDown"
                          ? active + Math.floor(height / rowHeight)
                          : event.key === "PageUp"
                            ? active - Math.floor(height / rowHeight)
                            : null;
              if (next !== null) {
                event.preventDefault();
                focusRow(next);
              }
              if (event.key === "Enter" && records[active]) {
                event.preventDefault();
                onSelect?.(String(records[active]![dataset.identity]));
              }
            }}
          >
            {virtual && (
              <span id={activeStatusId} className="aeliqo-sr-only" aria-live="polite">
                Active row {active + 1} of {records.length}: {activeRecord && dataset ? String(activeRecord[dataset.labelField] ?? activeRecord[dataset.identity]) : "none"}.
              </span>
            )}
            <table className="aeliqo-table" aria-rowcount={records.length + 1}>
              <thead>
                <tr>
                  {fields.map((field) => (
                    <th scope="col" key={field.key}>
                      {field.label}{"aggregation" in field && (field as MetricField).unit ? ` (${(field as MetricField).unit})` : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {start > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={fields.length}
                      style={{
                        height: start * rowHeight,
                        padding: 0,
                        border: 0,
                      }}
                    />
                  </tr>
                )}
                {shown.map((record, index) => {
                  const id = String(record[dataset.identity]);
                  return (
                    <tr
                      key={id}
                      aria-rowindex={start + index + 2}
                      data-active={virtual && active === start + index}
                      data-selected={selected === id}
                      style={virtual ? { height: rowHeight } : undefined}
                    >
                      {fields.map((field, fieldIndex) => (
                        <td
                          key={field.key}
                          className={virtual ? "aeliqo-virtual-cell" : undefined}
                        >
                          {fieldIndex === 0 && onSelect ? (
                            <button
                              type="button"
                              aria-pressed={selected === id}
                              onClick={() =>
                                onSelect?.(id)
                              }
                            >
                              {renderValue(record, field)}
                            </button>
                          ) : (
                            renderValue(record, field)
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {end < records.length && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={fields.length}
                      style={{
                        height: (records.length - end) * rowHeight,
                        padding: 0,
                        border: 0,
                      }}
                    />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {(virtual || records.length < data.records.length) && (
            <p className="aeliqo-hint">
              {virtual
                ? `Virtualized · rows ${start + 1}–${end} of ${records.length}`
                : `Showing ${records.length} of ${data.records.length} records.`}
            </p>
          )}
        </>
      )}
      <DataWarnings data={data} />
    </Card>
  );
}

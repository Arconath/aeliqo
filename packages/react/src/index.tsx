import { Comparison } from "./comparison";
import { Delta } from "./delta";
import { RecordList } from "./record-list";
import { SelectionSummary } from "./selection-summary";
import { Overview } from "./overview";
export { Delta, RecordList, SelectionSummary, Overview };
export type { DeltaProps } from "./delta";
export type { RecordListProps } from "./record-list";
export type { SelectionSummaryProps } from "./selection-summary";
export type { OverviewProps } from "./overview";
export { Comparison };
export type { ComparisonProps } from "./comparison";
import { Ranking } from "./ranking";
import { Trend } from "./trend";
import { Detail } from "./detail";
export { Ranking, Trend, Detail };
export type { RankingProps } from "./ranking";
export type { TrendProps } from "./trend";
export type { DetailProps } from "./detail";
import { Filter } from "./filter";
export { Filter };
export type { MetricProps } from "./metric";
export type { TableProps } from "./table";
export type { FilterProps } from "./filter";
import { Metric } from "./metric";
import { Table } from "./table";
import { Card, DataState, DataWarnings, safeSnapshot, ready, useData, useSelection, select, useDatasetSnapshot, type AdaptationEvent, type SemanticProps } from "./shared";
export { Metric, Table };
export type { AdaptationEvent, SemanticProps } from "./shared";
import {
  memo,
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ComponentType,
  type ReactNode,
} from "react";
import { scaleLinear, scalePoint } from "d3-scale";
import {
  metricValue,
  formatMetric,
  type WorkspaceStore,
  type WorkspaceNode,
  type PresentationTracker,
  type RendererConnection,
} from "@aeliqo/core";

export interface WorkspaceProps {
  store: WorkspaceStore;
  onRender?: (id: string) => void;
  /** Called after React commits this exact workspace revision to the DOM. */
  onPresented?: (revision: number) => void;
  presentation?: PresentationTracker;
  rendererId?: string;
  renderers?: Readonly<Record<string, ComponentType<SemanticProps>>>;
  instrumentation?: boolean;
  onAdaptation?: (event: AdaptationEvent) => void;
}
const chartColors = [
  "var(--aeliqo-accent, #117568)",
  "var(--aeliqo-chart-2, #6f5dc7)",
  "var(--aeliqo-chart-3, #b9652a)",
  "var(--aeliqo-chart-4, #237fa7)",
  "var(--aeliqo-chart-5, #b94d73)",
  "var(--aeliqo-chart-6, #6f7c2c)",
] as const;

function metricExtent(values: readonly number[]): [number, number] {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) return [minimum - 1, maximum + 1];
  const padding = (maximum - minimum) * 0.08;
  return [minimum - padding, maximum + padding];
}

export function Scatter(props: SemanticProps) {
  const container = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"full-annotations" | "focused-annotations">(
    "full-annotations",
  );
  const { data, dataset, metric: yMetric } = useData(props);
  const xMetric = dataset?.metrics.find(
    (field) => field.key === props.node.xMetric,
  );
  const selected = useSelection(props.store, props.node.id);
  const chart = useMemo(() => {
    if (!dataset || !xMetric || !yMetric) return null;
    const points = data.records
      .filter(
        (record) =>
          metricValue(record, xMetric) !== null &&
          metricValue(record, yMetric) !== null,
      )
      .slice(0, props.node.limit ?? data.records.length)
      .map((record) => ({
        record,
        id: String(record[dataset.identity]),
        label: String(record[props.node.dimension ?? dataset.labelField]),
        group: String(record[props.node.seriesBy ?? ""] ?? "All models"),
        x: metricValue(record, xMetric)!,
        y: metricValue(record, yMetric)!,
      }));
    if (!points.length) return null;
    const x = scaleLinear()
      .domain(metricExtent(points.map((point) => point.x)))
      .nice()
      .range([54, 520]);
    const y = scaleLinear()
      .domain(metricExtent(points.map((point) => point.y)))
      .nice()
      .range([166, 18]);
    const improves = (
      candidate: number,
      value: number,
      goal: "minimize" | "maximize" | undefined,
    ) => (goal === "minimize" ? candidate <= value : candidate >= value);
    const strict = (
      candidate: number,
      value: number,
      goal: "minimize" | "maximize" | undefined,
    ) => (goal === "minimize" ? candidate < value : candidate > value);
    const frontier = new Set(
      points
        .filter(
          (point) =>
            !points.some(
              (candidate) =>
                candidate !== point &&
                improves(candidate.x, point.x, xMetric.goal) &&
                improves(candidate.y, point.y, yMetric.goal) &&
                (strict(candidate.x, point.x, xMetric.goal) ||
                  strict(candidate.y, point.y, yMetric.goal)),
            ),
        )
        .map((point) => point.id),
    );
    return {
      points,
      x,
      y,
      frontier,
      groups: [...new Set(points.map((point) => point.group))],
    };
  }, [
    data.records,
    dataset,
    props.node.dimension,
    props.node.limit,
    props.node.seriesBy,
    xMetric,
    yMetric,
  ]);
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? 0);
      if (!width) return;
      const next =
        width < 560 || (chart?.points.length ?? 0) > 14
          ? "focused-annotations"
          : "full-annotations";
      setMode(next);
      props.onAdaptation?.({
        id: props.node.id,
        mode: next,
        width,
        visibleRecords: chart?.points.length ?? 0,
        totalRecords: data.records.length,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [
    chart?.points.length,
    data.records.length,
    props.node.id,
    props.onAdaptation,
  ]);
  return (
    <div ref={container} data-adaptation={mode}>
      <Card
        title={props.node.title ?? "Metric trade-offs"}
        subtitle={`${xMetric?.label ?? "X measure"} × ${yMetric?.label ?? "Y measure"}${props.node.seriesBy ? ` · grouped by ${props.node.seriesBy}` : ""}`}
        badge="Correlation"
      >
        {!ready(data) || !chart || !dataset || !xMetric || !yMetric ? (
          <DataState data={data} />
        ) : (
          <>
            <svg
              className="aeliqo-scatter"
              viewBox="0 0 540 205"
              role="img"
              aria-label={`${xMetric.label} versus ${yMetric.label}`}
            >
              <title>{`${xMetric.label} versus ${yMetric.label}`}</title>
              {chart.x.ticks(4).map((tick) => (
                <g key={`x-${tick}`}>
                  <line
                    className="aeliqo-chart-grid"
                    x1={chart.x(tick)}
                    x2={chart.x(tick)}
                    y1="18"
                    y2="166"
                  />
                  <text x={chart.x(tick)} y="184" textAnchor="middle">
                    {formatMetric(tick, xMetric)}
                  </text>
                </g>
              ))}
              {chart.y.ticks(4).map((tick) => (
                <g key={`y-${tick}`}>
                  <line
                    className="aeliqo-chart-grid"
                    x1="54"
                    x2="520"
                    y1={chart.y(tick)}
                    y2={chart.y(tick)}
                  />
                  <text x="48" y={chart.y(tick) + 3} textAnchor="end">
                    {formatMetric(tick, yMetric)}
                  </text>
                </g>
              ))}
              {chart.points.map((point) => {
                const groupIndex = Math.max(
                  0,
                  chart.groups.indexOf(point.group),
                );
                const showLabel =
                  mode === "full-annotations" ||
                  selected === point.id ||
                  chart.frontier.has(point.id);
                return (
                  <g
                    key={point.id}
                    className="aeliqo-scatter-point"
                    data-selected={selected === point.id}
                    data-frontier={chart.frontier.has(point.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${point.label}: ${xMetric.label} ${formatMetric(point.x, xMetric)}, ${yMetric.label} ${formatMetric(point.y, yMetric)}`}
                    onClick={() => select(props.store, props.node, point.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        select(props.store, props.node, point.id);
                      }
                    }}
                  >
                    <circle
                      cx={chart.x(point.x)}
                      cy={chart.y(point.y)}
                      r={selected === point.id ? 7 : 5}
                      fill={chartColors[groupIndex % chartColors.length]}
                    />
                    {showLabel && (
                      <text x={chart.x(point.x) + 8} y={chart.y(point.y) - 7}>
                        {point.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="aeliqo-chart-footer">
              <span>
                {chart.frontier.size} deterministic Pareto frontier points
              </span>
              <span>{mode.replaceAll("-", " ")}</span>
            </div>
            {(dataset.caveat || xMetric.methodology || yMetric.methodology) && (
              <p className="aeliqo-caveat">
                {yMetric.methodology ?? xMetric.methodology ?? dataset.caveat}
              </p>
            )}
          </>
        )}
        <DataWarnings data={data} />
      </Card>
    </div>
  );
}

function quantile(sorted: readonly number[], fraction: number) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[Math.min(sorted.length - 1, lower + 1)]! * weight;
}

export function Distribution(props: SemanticProps) {
  const container = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"full-bins" | "compact-bins">("full-bins");
  const { data, dataset, metric } = useData(props);
  const chart = useMemo(() => {
    if (!dataset || !metric) return null;
    const values = data.records
      .flatMap((record) => { const value = metricValue(record, metric); return value === null ? [] : [{ record, value }]; })
      .sort((a, b) => a.value - b.value);
    if (!values.length) return null;
    const binCount = mode === "compact-bins" ? 5 : 8;
    const minimum = values[0]!.value;
    const maximum = values.at(-1)!.value;
    const width = Math.max((maximum - minimum) / binCount, Number.EPSILON);
    const bins = Array.from({ length: binCount }, (_, index) => ({
      start: minimum + index * width,
      end: index === binCount - 1 ? maximum : minimum + (index + 1) * width,
      count: 0,
    }));
    for (const item of values) bins[Math.min(binCount - 1, Math.floor((item.value - minimum) / width))]!.count += 1;
    const raw = values.map((item) => item.value);
    const q1 = quantile(raw, 0.25);
    const q3 = quantile(raw, 0.75);
    const iqr = q3 - q1;
    const outliers = values.filter((item) => item.value < q1 - iqr * 1.5 || item.value > q3 + iqr * 1.5);
    const x = scaleLinear().domain([minimum, maximum || minimum + 1]).range([42, 520]);
    const y = scaleLinear().domain([0, Math.max(1, ...bins.map((bin) => bin.count))]).range([150, 20]);
    return { values, bins, x, y, minimum, maximum, outliers };
  }, [data.records, dataset, metric, mode]);
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? 0);
      if (!width) return;
      const next = width < 470 ? "compact-bins" : "full-bins";
      setMode(next);
      props.onAdaptation?.({ id: props.node.id, mode: next, width, visibleRecords: data.records.length, totalRecords: data.records.length });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [data.records.length, props.node.id, props.onAdaptation]);
  return (
    <div ref={container} data-adaptation={mode}>
      <Card title={props.node.title ?? `${metric?.label ?? "Metric"} distribution`} subtitle={`${dataset?.label ?? "Dataset"} · spread and deterministic IQR outliers`} badge="Distribution">
        {!ready(data) || !chart || !dataset || !metric ? <DataState data={data} /> : (
          <>
            <svg className="aeliqo-distribution" viewBox="0 0 540 185" role="img" aria-label={`${metric.label} distribution across ${chart.values.length} ${dataset.entity} records`}>
              <title>{`${metric.label} distribution`}</title>
              {chart.bins.map((bin, index) => {
                const left = chart.x(bin.start);
                const right = index === chart.bins.length - 1 ? 520 : chart.x(bin.end);
                return <rect key={bin.start} x={left + 2} y={chart.y(bin.count)} width={Math.max(2, right - left - 4)} height={150 - chart.y(bin.count)} rx="3"><title>{`${formatMetric(bin.start, metric)}–${formatMetric(bin.end, metric)}: ${bin.count}`}</title></rect>;
              })}
              <line className="aeliqo-axis" x1="42" x2="520" y1="150" y2="150" />
              <text x="42" y="172" textAnchor="start">{formatMetric(chart.minimum, metric)}</text>
              <text x="520" y="172" textAnchor="end">{formatMetric(chart.maximum, metric)}</text>
            </svg>
            <div className="aeliqo-extremes">
              <span><b>Lowest</b>{String(chart.values[0]!.record[dataset.labelField])} · {formatMetric(chart.minimum, metric)}</span>
              <span><b>Highest</b>{String(chart.values.at(-1)!.record[dataset.labelField])} · {formatMetric(chart.maximum, metric)}</span>
            </div>
            <p className="aeliqo-hint">{chart.outliers.length ? `${chart.outliers.length} IQR outlier${chart.outliers.length === 1 ? "" : "s"}` : "No IQR outliers"} · {mode.replaceAll("-", " ")}</p>
          </>
        )}
        <DataWarnings data={data} />
      </Card>
    </div>
  );
}

export function Relationship(props: SemanticProps) {
  const { data, dataset } = useData(props);
  const relation = dataset?.relationships?.find((item) => item.id === props.node.relationship);
  const targetDataset = relation ? props.store.dataPort.getDataset(relation.targetDatasetId) : undefined;
  const targetData = useDatasetSnapshot(props.store, relation?.targetDatasetId ?? props.node.datasetId);
  const selected = useSelection(props.store, props.node.id);
  const graph = useMemo(() => {
    if (!dataset || !relation || !targetDataset || targetData.status !== "ready") return null;
    const sources = data.records.slice(0, props.node.limit ?? data.records.length);
    const targets = targetData.records.filter((target) =>
      sources.some((source) => source[relation.field] === target[relation.targetField ?? targetDataset.identity]),
    );
    const sourceY = scalePoint<string>().domain(sources.map((source) => String(source[dataset.identity]))).range([20, 184]).padding(0.45);
    const targetY = scalePoint<string>().domain(targets.map((target) => String(target[targetDataset.identity]))).range([20, 184]).padding(0.8);
    return { sources, targets, sourceY, targetY };
  }, [data.records, dataset, props.node.limit, relation, targetData, targetDataset]);
  return (
    <Card title={props.node.title ?? `${dataset?.entity ?? "Entity"} relationships`} subtitle={relation ? `${dataset?.label} → ${targetDataset?.label}` : dataset?.label} badge="Declared graph">
      {!ready(data) || !graph || !dataset || !relation || !targetDataset ? <DataState data={targetData.status !== "ready" ? targetData : data} /> : (
        <>
          <svg className="aeliqo-relationship" viewBox="0 0 540 205" role="img" aria-label={`${dataset.entity} to ${targetDataset.entity} relationship`}>
            <title>{`${dataset.entity} to ${targetDataset.entity}`}</title>
            {graph.sources.map((source) => {
              const id = String(source[dataset.identity]);
              const foreignKey = source[relation.field];
              const target = graph.targets.find((item) => item[relation.targetField ?? targetDataset.identity] === foreignKey);
              if (!target) return null;
              const y1 = graph.sourceY(id) ?? 0;
              const y2 = graph.targetY(String(target[targetDataset.identity])) ?? 0;
              return <path key={`edge-${id}`} d={`M 196 ${y1} C 278 ${y1}, 278 ${y2}, 355 ${y2}`} data-selected={selected === id} />;
            })}
            {graph.targets.map((target) => {
              const id = String(target[targetDataset.identity]);
              return <g key={id}><circle cx="370" cy={graph.targetY(id)} r="6" /><text x="382" y={(graph.targetY(id) ?? 0) + 4}>{String(target[targetDataset.labelField])}</text></g>;
            })}
            {graph.sources.map((source) => {
              const id = String(source[dataset.identity]);
              const y = graph.sourceY(id) ?? 0;
              return (
                <g key={id} role="button" tabIndex={0} aria-label={`Select ${String(source[dataset.labelField])}`} data-selected={selected === id} onClick={() => select(props.store, props.node, id)} onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(props.store, props.node, id); }
                }}>
                  <text x="184" y={y + 4} textAnchor="end">{String(source[dataset.labelField])}</text>
                  <circle cx="196" cy={y} r={selected === id ? 7 : 5} />
                </g>
              );
            })}
          </svg>
          <p className="aeliqo-hint">{graph.sources.length} {dataset.entity.toLowerCase()}s connected through the declared “{relation.label ?? relation.id}” relationship.</p>
        </>
      )}
      <DataWarnings data={data} />
    </Card>
  );
}

export function Matrix(props: SemanticProps) {
  const container = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"full-labels" | "compact-labels">("full-labels");
  const { data, dataset } = useData(props);
  const selected = useSelection(props.store, props.node.id);
  const metrics = useMemo(() => props.node.columns?.flatMap((key) => {
    const metric = dataset?.metrics.find((field) => field.key === key);
    return metric ? [metric] : [];
  }) ?? [], [dataset, props.node.columns]);
  const records = useMemo(() => [...data.records]
    .sort((a, b) => metrics.reduce((sum, field) => sum + (metricValue(b, field) ?? 0) - (metricValue(a, field) ?? 0), 0))
    .slice(0, props.node.limit ?? data.records.length), [data.records, metrics, props.node.limit]);
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? 0);
      if (!width) return;
      const next = width < 650 ? "compact-labels" : "full-labels";
      setMode(next);
      props.onAdaptation?.({ id: props.node.id, mode: next, width, visibleRecords: records.length, totalRecords: data.records.length });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [data.records.length, props.node.id, props.onAdaptation, records.length]);
  return (
    <div ref={container} data-adaptation={mode}>
      <Card title={props.node.title ?? "Capability matrix"} subtitle={`${dataset?.label ?? "Dataset"} · ${metrics.length} semantic features`} badge="Matrix">
        {!ready(data) || !dataset || !metrics.length ? <DataState data={data} /> : (
          <div className="aeliqo-matrix-scroll">
            <table className="aeliqo-matrix">
              <thead><tr><th scope="col">{dataset.entity}</th>{metrics.map((metric) => <th key={metric.key} scope="col" title={metric.label}><span aria-hidden="true">{mode === "compact-labels" ? metric.label.split(/\s+/).map((word) => word[0]).join("") : metric.label}</span><span className="aeliqo-sr-only">{metric.label}</span></th>)}</tr></thead>
              <tbody>{records.map((record) => {
                const id = String(record[dataset.identity]);
                return <tr key={id} data-selected={selected === id}><th scope="row"><button type="button" aria-pressed={selected === id} onClick={() => select(props.store, props.node, id)}>{String(record[dataset.labelField])}</button></th>{metrics.map((metric) => {
                  const value = metricValue(record, metric);
                  const enabled = value === null ? null : value > 0;
                  return <td key={metric.key} aria-label={`${metric.label}: ${enabled === null ? "not available" : enabled ? "supported" : "not supported"}`} data-enabled={enabled ?? undefined}>{enabled === null ? "?" : enabled ? "●" : "–"}</td>;
                })}</tr>;
              })}</tbody>
            </table>
          </div>
        )}
        <DataWarnings data={data} />
      </Card>
    </div>
  );
}

/** Explorer reuses its own selection channel; both primitives read the same semantic entity identity. */
export function Explorer(props: SemanticProps) {
  const [view, setView] = useState<"ranking" | "table">("ranking");
  return (
    <div>
      <Filter store={props.store} node={props.node} />
      <div
        className="aeliqo-view-switch"
        role="group"
        aria-label="Collection representation"
      >
        <button
          type="button"
          aria-pressed={view === "ranking"}
          onClick={() => setView("ranking")}
        >
          Ranking
        </button>
        <button
          type="button"
          aria-pressed={view === "table"}
          onClick={() => setView("table")}
        >
          Table
        </button>
      </div>
      <div className="aeliqo-explorer">
        {view === "ranking" ? (
          <Ranking
            onAdaptation={props.onAdaptation}
            store={props.store}
            node={{
              ...props.node,
              title: props.node.title ?? "Explore records",
            }}
          />
        ) : (
          <Table
            store={props.store}
            node={{
              ...props.node,
              title: props.node.title ?? "Explore records",
            }}
          />
        )}
        <Detail
          store={props.store}
          node={{ ...props.node, title: "Selected record" }}
        />
      </div>
    </div>
  );
}
const components: Readonly<Record<string, ComponentType<SemanticProps>>> = {
  Delta, RecordList, SelectionSummary, Overview,
  Filter,
  Metric,
  Ranking,
  Trend,
  Table,
  Detail,
  Scatter,
  Distribution,
  Relationship,
  Matrix,
  Comparison,
  Explorer,
};
type RenderFailures = Map<string, string>;
class RenderBoundary extends Component<{ node: WorkspaceNode; failures: RenderFailures; children: ReactNode }, { node: WorkspaceNode; failed: boolean }> {
  state = { node: this.props.node, failed: false };
  static getDerivedStateFromProps(props: { node: WorkspaceNode }, state: { node: WorkspaceNode; failed: boolean }) {
    return props.node !== state.node ? { node: props.node, failed: false } : null;
  }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.failures.set(this.props.node.id, error.message); }
  componentWillUnmount() { this.props.failures.delete(this.props.node.id); }
  render() { return this.state.failed ? <p role="alert">This component could not be rendered.</p> : <>{this.props.children}<RenderSucceeded id={this.props.node.id} failures={this.props.failures} /></>; }
}
function RenderSucceeded({ id, failures }: { id: string; failures: RenderFailures }) {
  useLayoutEffect(() => { failures.delete(id); });
  return null;
}
const WorkspaceBlock = memo(function WorkspaceBlock({
  store,
  id,
  instrumentation,
  onRender,
  onAdaptation,
  renderers,
  failures,
}: WorkspaceProps & { id: string; failures: RenderFailures }) {
  const node = useSyncExternalStore(
    useCallback((listener) => store.subscribeNode(id, listener), [store, id]),
    useCallback(() => store.getNode(id), [store, id]),
    () => store.getNode(id),
  );
  useSelection(store, id);
  const renderCount = useRef(0);
  renderCount.current += 1;
  useEffect(() => {
    onRender?.(id);
  });
  if (!node) return null;
  const Component = components[node.component] ?? (store.registry.get(node.component) ? renderers?.[node.component] : undefined);
  return (
    <div
      className="aeliqo-block"
      data-node-id={id}
      data-component={node.component}
      data-span={node.span}
      data-density={node.density ?? "comfortable"}
      style={{ "--aeliqo-block-span": node.span } as CSSProperties}
      data-render-count={renderCount.current}
    >
      {Component ? <RenderBoundary node={node} failures={failures}><Component store={store} node={node} onAdaptation={onAdaptation} /></RenderBoundary> : <p role="alert">No renderer is registered for {node.component}.</p>}
      <button type="button" className="aeliqo-pin" aria-pressed={node.pinned === true} aria-label={`${node.pinned ? "Unpin" : "Pin"} ${node.title ?? node.id}`} onClick={() => store.apply({ version: 1, baseRevision: store.getState().revision, operations: [{ type: "pin", id, pinned: !node.pinned }] }, { actor: "human" })}>{node.pinned ? "Unpin" : "Pin"}</button>
      {instrumentation && (
        <span className="aeliqo-render-count">
          {id} · {renderCount.current} renders
        </span>
      )}
    </div>
  );
});
function WorkspacePresentation({ store, presentation, onPresented, renderers, failures, rendererId = "react-workspace" }: WorkspaceProps & { failures: RenderFailures }) {
  const revision = useSyncExternalStore(store.subscribe, () => store.getState().revision, () => store.getState().revision);
  const connection = useRef<RendererConnection | undefined>(undefined);
  useLayoutEffect(() => {
    connection.current = presentation?.connect(rendererId);
    return () => { connection.current?.disconnect(); connection.current = undefined; };
  }, [presentation, rendererId]);
  const acknowledge = useCallback(() => {
    for (const id of store.getState().order) {
      const node = store.getNode(id)!;
      const failure = failures.get(id) ?? (!(components[node.component] ?? renderers?.[node.component]) ? `No renderer is registered for ${node.component}.` : undefined);
      const snapshot = safeSnapshot(store.dataPort.getDataset(node.datasetId), store.dataPort.getSnapshot(node.datasetId));
      if (failure || snapshot.status === "error") {
        connection.current?.fail(revision, failure ?? snapshot.error ?? "Data could not be rendered.");
        return;
      }
    }
    connection.current?.acknowledge(revision, { visible: typeof document !== "undefined" && document.visibilityState === "visible" });
    onPresented?.(revision);
  }, [revision, onPresented, store, renderers, failures]);
  useLayoutEffect(acknowledge);
  useEffect(() => {
    document.addEventListener("visibilitychange", acknowledge);
    return () => document.removeEventListener("visibilitychange", acknowledge);
  }, [acknowledge]);
  const datasets = [...new Set(store.getState().order.flatMap(id => {
    const node = store.getNode(id);
    return node ? [node.datasetId] : [];
  }))];
  return <>{datasets.map(id => <DatasetPresentation key={id} store={store} datasetId={id} acknowledge={acknowledge} />)}</>;
}
function DatasetPresentation({ store, datasetId, acknowledge }: { store: WorkspaceStore; datasetId: string; acknowledge: () => void }) {
  const snapshot = useDatasetSnapshot(store, datasetId);
  useLayoutEffect(acknowledge, [snapshot, acknowledge]);
  return null;
}
function WorkspaceHistory({ store }: { store: WorkspaceStore }) {
  useSyncExternalStore(store.subscribe, () => store.getState().revision, () => store.getState().revision);
  return <div className="aeliqo-workspace-history" role="group" aria-label="Workspace history" style={{ gridColumn: "1 / -1" }}>
    <button type="button" disabled={!store.canUndo()} onClick={() => store.apply({ version: 1, baseRevision: store.getState().revision, operations: [{ type: "undo" }] }, { actor: "human" })}>Undo</button>
    <button type="button" disabled={!store.canRedo()} onClick={() => store.apply({ version: 1, baseRevision: store.getState().revision, operations: [{ type: "redo" }] }, { actor: "human" })}>Redo</button>
  </div>;
}
export function Workspace({
  store,
  instrumentation,
  onRender,
  onPresented,
  presentation,
  rendererId,
  renderers,
  onAdaptation,
}: WorkspaceProps) {
  const failures = useRef<RenderFailures>(new Map()).current;
  const order = useSyncExternalStore(
    store.subscribeOrder,
    () => store.getState().order,
    () => store.getState().order,
  );
  return (
    <div className="aeliqo-workspace">
      <WorkspaceHistory store={store} />
      {order.map((id) => (
        <WorkspaceBlock
          key={id}
          id={id}
          store={store}
          renderers={renderers}
          failures={failures}
          instrumentation={instrumentation}
          onRender={onRender}
          onAdaptation={onAdaptation}
        />
      ))}
      {(presentation || onPresented) && <WorkspacePresentation failures={failures} renderers={renderers} rendererId={rendererId} store={store} presentation={presentation} onPresented={onPresented} />}
    </div>
  );
}

import { useId, useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { aggregateMetric, parseTemporalValue, formatTemporalValue, formatMetric, type Dataset, type DataSnapshot, type WorkspaceNode, type Field, type DataRecord, type MetricField } from "@aeliqo/core";
import { Card, DataState, safeSnapshot, DataWarnings, ready, useData, type SemanticProps } from "./shared";
function trendPoints(
  records: readonly DataRecord[],
  timeField: Field,
  metric: MetricField,
) {
  const populated = records.filter(record => record[timeField.key] != null);
  const displayField = !timeField.temporal && populated.length > 0 && populated.every(record => /^\d{4}-\d{2}$/.test(String(record[timeField.key]))) ? { ...timeField, temporal: "month" as const } : timeField;
  const groups = new Map<number, DataRecord[]>();
  for (const record of records) {
    const key = parseTemporalValue(record[timeField.key], timeField);
    if (key === null) continue;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  return [...groups]
    .sort(([a], [b]) => a - b)
    .map(([timestamp, group]) => ({ timestamp, time: formatTemporalValue(timestamp, displayField), value: aggregateMetric(group, metric) }));
}

type TrendPoint = ReturnType<typeof trendPoints>[number];
const MAX_DISPLAY_POINTS = 800;

/**
 * Bound SVG geometry while retaining both ends, local extrema, and an explicit
 * missing-value marker for every sampled bucket. Exact summaries continue to
 * use the unsampled points.
 */
function sampleTrendPoints(
  points: readonly TrendPoint[],
  maximum = MAX_DISPLAY_POINTS,
): readonly TrendPoint[] {
  if (points.length <= maximum) return points;
  const mandatory = new Set<number>([0, points.length - 1]);
  let minimum = -1;
  let maximumValue = -1;
  for (let index = 0; index < points.length; index++) {
    const value = points[index]!.value;
    if (value === null) {
      mandatory.add(index);
      if (index > 0) mandatory.add(index - 1);
      if (index + 1 < points.length) mandatory.add(index + 1);
    } else {
      if (minimum === -1 || value < points[minimum]!.value!) minimum = index;
      if (maximumValue === -1 || value > points[maximumValue]!.value!) maximumValue = index;
    }
  }
  if (minimum !== -1) mandatory.add(minimum);
  if (maximumValue !== -1) mandatory.add(maximumValue);
  // Drawing a partial set of too many gaps would falsely connect observations.
  if (mandatory.size > maximum) return [];
  const bucketCount = Math.max(1, Math.floor((maximum - mandatory.size) / 2));
  const bucketSize = Math.ceil(points.length / bucketCount);
  const sampled = new Set(mandatory);
  for (let start = 0; start < points.length; start += bucketSize) {
    const bucket = points.slice(start, Math.min(points.length, start + bucketSize));
    let bucketMinimum = -1;
    let bucketMaximum = -1;
    for (let index = 0; index < bucket.length; index++) {
      const value = bucket[index]!.value;
      if (value === null) continue;
      if (bucketMinimum === -1 || value < bucket[bucketMinimum]!.value!) bucketMinimum = index;
      if (bucketMaximum === -1 || value > bucket[bucketMaximum]!.value!) bucketMaximum = index;
    }
    if (bucketMinimum !== -1) sampled.add(start + bucketMinimum);
    if (bucketMaximum !== -1) sampled.add(start + bucketMaximum);
  }
  return [...sampled].sort((a, b) => a - b).map((index) => points[index]!);
}
export interface TrendProps {
  dataset: Dataset; snapshot: DataSnapshot; metric: string; timeField: string;
  seriesBy?: string; title?: string;
}
export function Trend(props: TrendProps | SemanticProps) {
  return "store" in props ? <SemanticTrend {...props} /> : <StandaloneTrend {...props} />;
}
function SemanticTrend(props: SemanticProps) {
  const { data, metric, dataset } = useData(props);
  return <TrendView data={data} metric={metric} dataset={dataset} node={props.node} />;
}
function StandaloneTrend(props: TrendProps) {
  const data = useMemo(() => safeSnapshot(props.dataset, props.snapshot), [props.dataset, props.snapshot]);
  return <TrendView data={data} metric={props.dataset.metrics.find(field => field.key === props.metric)} dataset={props.dataset} node={props} />;
}
function TrendView({ data, metric, dataset, node }: { data: DataSnapshot; metric?: MetricField; dataset?: Dataset; node: Partial<WorkspaceNode> }) {
  const descriptionId = useId();
  const chart = useMemo(() => {
    const timeField = dataset?.timeFields.find(field => field.key === node.timeField);
    if (!metric || !timeField) return null;
    const groups = new Map<string, DataRecord[]>();
    for (const record of data.records) {
      const key = node.seriesBy
        ? String(record[node.seriesBy] ?? "Unknown")
        : metric.label;
      const group = groups.get(key) ?? [];
      group.push(record);
      groups.set(key, group);
    }
    const series = [...groups]
      .map(([label, records]) => ({
        label,
        points: trendPoints(records, timeField, metric),
      }))
      .filter((item) => item.points.length);
    const points = series
      .flatMap((item) => item.points)
      .sort((a, b) => a.timestamp - b.timestamp);
    if (!points.length) return null;
    const x = scaleLinear()
      .domain([
        points[0]!.timestamp,
        Math.max(
          points.at(-1)!.timestamp,
          points[0]!.timestamp + 1,
        ),
      ])
      .range([42, 520]);
    const values = points.flatMap((point) =>
      point.value === null ? [] : [point.value],
    );
    const y = scaleLinear()
      .domain([Math.min(0, ...values), Math.max(1e-6, ...values)])
      .nice()
      .range([160, 15]);
    const displayLimit = Math.max(8, Math.floor(MAX_DISPLAY_POINTS / series.length));
    const displaySeries = series.map((item) => {
      const displayPoints = sampleTrendPoints(item.points, displayLimit);
      return {
        ...item,
        displayPoints,
        isolatedTimestamps: new Set(
          item.points.flatMap((point, index) =>
            point.value !== null &&
            item.points[index - 1]?.value == null &&
            item.points[index + 1]?.value == null
              ? [point.timestamp]
              : [],
          ),
        ),
        path: line<TrendPoint>()
          .defined((point) => point.value !== null)
          .x((point) => x(point.timestamp))
          .y((point) => y(point.value!))(displayPoints),
      };
    });
    return {
      points,
      displayPoints: displaySeries.reduce((total, item) => total + item.displayPoints.length, 0),
      periods: new Set(points.map((point) => point.time)).size,
      hasMeasurements: values.length > 0,
      exactMinimum: values.reduce<number | null>((minimum, value) => minimum === null || value < minimum ? value : minimum, null),
      exactMaximum: values.reduce<number | null>((maximum, value) => maximum === null || value > maximum ? value : maximum, null),
      exactMissing: points.length - values.length,
      series: displaySeries,
      x,
      y,
      ticks: y.ticks(3),
    };
  }, [data.records, metric, dataset, node.timeField, node.seriesBy]);
  return (
    <Card
      title={node.title ?? "Performance over time"}
      subtitle={`${dataset?.label ?? "Dataset"} · ${metric?.label ?? "Measure"}`}
      badge="Trend"
    >
      {!ready(data) || !chart || !metric ? (
        <DataState data={data.status === "ready" && (!metric || !dataset?.timeFields.some(field => field.key === node.timeField)) ? { status: "error", records: [], error: "Choose a declared metric and time field for this trend." } : data} />
      ) : (
        <>
          {!chart.hasMeasurements ? (
            <div className="aeliqo-state" role="status">
              No measurements available for these periods.
            </div>
          ) : (
            <svg
              className="aeliqo-trend"
              viewBox="0 0 540 190"
              role="img"
              aria-label={`${metric.label} from ${chart.points[0]?.time} to ${chart.points.at(-1)?.time}`}
              aria-describedby={descriptionId}
            >
              <title>{`${metric.label} over time`}</title>
              {chart.ticks.map((tick) => (
                <g key={tick}>
                  <line
                    className="aeliqo-trend-grid"
                    x1="42"
                    x2="520"
                    y1={chart.y(tick)}
                    y2={chart.y(tick)}
                  />
                  <text x="34" y={chart.y(tick) + 3} textAnchor="end">
                    {formatMetric(tick, metric)}
                  </text>
                </g>
              ))}
              {chart.series.map((series, index) => (
                <g
                  key={series.label}
                  data-series={series.label}
                  style={{
                    color: [
                      "var(--aeliqo-accent, #117568)",
                      "var(--aeliqo-chart-2, #7864c4)",
                      "var(--aeliqo-chart-3, #bc6b24)",
                      "var(--aeliqo-chart-4, #3284ad)",
                      "var(--aeliqo-chart-5, #bf5575)",
                      "var(--aeliqo-chart-6, #76832d)",
                    ][index % 6],
                  }}
                >
                  <path
                    d={series.path ?? ""}
                    className="aeliqo-trend-line"
                    style={{ stroke: "currentColor" }}
                  >
                    <title>{series.label}</title>
                  </path>
                  {series.displayPoints.map((point) =>
                    point.value !== null &&
                    series.isolatedTimestamps.has(point.timestamp) ? (
                      <circle
                        key={point.time}
                        cx={chart.x(point.timestamp)}
                        cy={chart.y(point.value)}
                        r="4"
                        fill="currentColor"
                      >
                        <title>{`${series.label} · ${point.time}: ${formatMetric(point.value, metric)}`}</title>
                      </circle>
                    ) : null,
                  )}
                </g>
              ))}
              {chart.points
                .filter(
                  (_, index) =>
                    index === 0 || index === chart.points.length - 1,
                )
                .map((point, index) => (
                  <text
                    key={point.time}
                    x={index === 0 ? 42 : 520}
                    y="185"
                    textAnchor={index === 0 ? "start" : "end"}
                  >
                    {point.time}
                  </text>
              ))}
            </svg>
          )}
          {chart.series.some((series) => series.points.length && !series.displayPoints.length) && (
            <p className="aeliqo-caveat" role="status">
              Visual line omitted because preserving every data gap would exceed the geometry limit. Exact summary remains available.
            </p>
          )}
          <p id={descriptionId} className="aeliqo-sr-only">
            Exact summary for {chart.points.length} aggregated points: minimum {chart.exactMinimum === null ? "not available" : formatMetric(chart.exactMinimum, metric)}, maximum {chart.exactMaximum === null ? "not available" : formatMetric(chart.exactMaximum, metric)}, latest {chart.points.at(-1)?.value == null ? "not available" : formatMetric(chart.points.at(-1)?.value, metric)}, and {chart.exactMissing} missing measurements.
          </p>
          {node.seriesBy && (
            <ul className="aeliqo-trend-legend">
              {chart.series.map((series, index) => (
                <li key={series.label}>
                  <span
                    aria-hidden="true"
                    style={{
                      background: [
                        "var(--aeliqo-accent, #117568)",
                        "var(--aeliqo-chart-2, #7864c4)",
                        "var(--aeliqo-chart-3, #bc6b24)",
                        "var(--aeliqo-chart-4, #3284ad)",
                        "var(--aeliqo-chart-5, #bf5575)",
                        "var(--aeliqo-chart-6, #76832d)",
                      ][index % 6],
                    }}
                  />
                  {series.label} ·{" "}
                  {series.points.at(-1)?.value == null
                    ? "Not available"
                    : formatMetric(series.points.at(-1)?.value, metric)}
                </li>
              ))}
            </ul>
          )}
          <p className="aeliqo-hint">
            {chart.periods === 1
              ? "1 snapshot · no historical trend"
              : `${chart.periods} periods`}{" "}
            {node.seriesBy
              ? `· ${chart.series.length} series`
              : `· Latest: ${chart.points.at(-1)?.value == null ? "Not available" : formatMetric(chart.points.at(-1)?.value, metric)}`}
          </p>
          {chart.displayPoints < chart.points.length && (
            <p className="aeliqo-hint" role="status">
              Visual sample: {chart.displayPoints} of {chart.points.length} aggregated points drawn. Exact summaries use all points.
            </p>
          )}
        </>
      )}
      <DataWarnings data={data} />
    </Card>
  );
}

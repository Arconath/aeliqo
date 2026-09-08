import {aeliqoThemeStyles} from "../styles/theme.js";
import {css, html, LitElement, nothing} from "lit";
import type {AeliqoChartPoint, AeliqoChartSeries} from "../types.js";

const CHART_WIDTH = 320;
const CHART_HEIGHT = 180;
const PLOT_LEFT = 24;
const PLOT_TOP = 14;
const PLOT_WIDTH = 280;
const PLOT_HEIGHT = 132;

export interface AeliqoChartGeometry {
  readonly segments: readonly {readonly seriesIndex: number; readonly points: string}[];
  readonly circles: readonly {readonly seriesIndex: number; readonly x: number; readonly y: number}[];
}

interface AeliqoChartDomainPoint {
  readonly key: string;
  readonly x?: string | number;
  readonly label: string;
}

function hasExplicitX(series: readonly AeliqoChartSeries[]): boolean {
  return series.some((item) => item.points.some((point) => point.x !== undefined));
}

function pointKey(point: AeliqoChartPoint, index: number, explicitX: boolean): string {
  if (!explicitX || point.x === undefined) return `index:${index}`;
  return typeof point.x === "number" ? `number:${point.x}` : `string:${point.x}`;
}

function temporalX(value: string | number | undefined): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || value.length === 0) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Return one bounded, ordered x domain shared by every rendered series. */
export function buildAeliqoChartDomain(series: readonly AeliqoChartSeries[]): readonly AeliqoChartDomainPoint[] {
  const explicitX = hasExplicitX(series);
  if (!explicitX) {
    const length = Math.max(0, ...series.map((item) => item.points.length));
    return Array.from({length}, (_, index) => ({
      key: `index:${index}`,
      label: series.find((item) => item.points[index] !== undefined)?.points[index]?.label ?? `Point ${index + 1}`,
    }));
  }

  const domain = new Map<string, AeliqoChartDomainPoint>();
  series.forEach((item) => item.points.forEach((point, index) => {
    const key = pointKey(point, index, explicitX);
    if (!domain.has(key)) domain.set(key, {key, ...(point.x === undefined ? {} : {x: point.x}), label: point.label});
  }));
  const output = [...domain.values()];
  const numeric = output.length > 0 && output.every((entry) => typeof entry.x === "number" && Number.isFinite(entry.x));
  const temporal = output.length > 0 && output.every((entry) => typeof entry.x === "string" && temporalX(entry.x) !== undefined);
  if (numeric) output.sort((left, right) => (left.x as number) - (right.x as number));
  else if (temporal) output.sort((left, right) => temporalX(left.x)! - temporalX(right.x)!);
  return output;
}

/** Insert null points for dates absent from an individual grouped series. */
export function alignAeliqoChartSeries(series: readonly AeliqoChartSeries[]): readonly AeliqoChartSeries[] {
  const explicitX = hasExplicitX(series);
  const domain = buildAeliqoChartDomain(series);
  return series.map((item) => {
    const byKey = new Map<string, AeliqoChartPoint>();
    item.points.forEach((point, index) => byKey.set(pointKey(point, index, explicitX), point));
    const points = domain.map((entry) => {
      const point = byKey.get(entry.key);
      if (point !== undefined) return {
        ...point,
        label: entry.label,
        ...(entry.x === undefined ? {} : {x: entry.x}),
      };
      return {
        label: entry.label,
        value: null,
        ...(entry.x === undefined ? {} : {x: entry.x}),
      };
    });
    return {...item, points};
  });
}

function xCoordinates(domain: readonly AeliqoChartDomainPoint[]): readonly number[] {
  if (domain.length === 0) return [];
  const numeric = domain.map((entry) => typeof entry.x === "number" && Number.isFinite(entry.x) ? entry.x : undefined);
  const parsed = domain.map((entry) => temporalX(entry.x));
  const values = numeric.every((value) => value !== undefined) ? numeric as number[]
    : parsed.every((value) => value !== undefined) ? parsed as number[] : undefined;
  if (values === undefined) {
    const step = domain.length === 1 ? 0 : PLOT_WIDTH / (domain.length - 1);
    return domain.map((_, index) => PLOT_LEFT + step * index);
  }
  let min = values[0]!;
  let max = values[0]!;
  for (const value of values) { min = Math.min(min, value); max = Math.max(max, value); }
  const scale = Math.max(Math.abs(min), Math.abs(max), 1);
  const scaledMin = min / scale;
  const span = max / scale - scaledMin;
  if (span === 0) {
    const step = domain.length === 1 ? 0 : PLOT_WIDTH / (domain.length - 1);
    return domain.map((_, index) => PLOT_LEFT + step * index);
  }
  return values.map((value) => PLOT_LEFT + ((value / scale - scaledMin) / span) * PLOT_WIDTH);
}

/** Pure bounded geometry used by the SVG renderer and its verification tests. */
export function buildAeliqoChartGeometry(series: readonly AeliqoChartSeries[]): AeliqoChartGeometry {
  const aligned = alignAeliqoChartSeries(series);
  const finite: number[] = [];
  for (const item of aligned) {
    for (const point of item.points) {
      if (point.value !== null && Number.isFinite(point.value)) finite.push(point.value);
    }
  }
  if (finite.length === 0) return {segments: [], circles: []};
  let min = finite[0]!;
  let max = finite[0]!;
  for (const value of finite) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  // Scale before subtracting so finite extreme values cannot overflow to
  // Infinity and poison the SVG coordinates.
  const scale = Math.max(Math.abs(min), Math.abs(max), 1);
  const scaledMin = min / scale;
  const span = max / scale - scaledMin || 1;
  const circles: {seriesIndex: number; x: number; y: number}[] = [];
  const segments: {seriesIndex: number; points: string}[] = [];
  const domain = buildAeliqoChartDomain(series);
  const x = xCoordinates(domain);
  aligned.forEach((item, seriesIndex) => {
    let current: string[] = [];
    const flush = (): void => {
      if (current.length > 0) segments.push({seriesIndex, points: current.join(" ")});
      current = [];
    };
    item.points.forEach((point, index) => {
      if (point.value === null || !Number.isFinite(point.value)) { flush(); return; }
      const xCoordinate = x[index] ?? PLOT_LEFT;
      const y = PLOT_TOP + PLOT_HEIGHT - ((point.value / scale - scaledMin) / span) * PLOT_HEIGHT;
      current.push(`${xCoordinate},${y}`);
      circles.push({seriesIndex, x: xCoordinate, y});
    });
    flush();
  });
  return {segments, circles};
}

export class AeliqoChartElement extends LitElement {
  static readonly properties = {
    title: {type: String},
    summary: {type: String},
    unit: {type: String},
    scope: {type: String},
    points: {attribute: false},
    series: {attribute: false},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  title = "Chart";
  summary = "";
  unit = "";
  scope = "";
  points: readonly AeliqoChartPoint[] = [];
  series: readonly AeliqoChartSeries[] = [];

  protected override render() {
    const series = this.resolvedSeries();
    const aligned = alignAeliqoChartSeries(series);
    const hasInvalidPoints = series.some((item) => item.points.some((point) => point.value !== null && !Number.isFinite(point.value)));
    const hasGaps = aligned.some((item) => item.points.some((point) => point.value === null));
    const geometry = hasInvalidPoints ? {segments: [], circles: []} : this.getGeometry(aligned);
    const invalidMessage = "Chart unavailable: values must be finite.";
    const accessibleName = [
      this.title,
      this.summary,
      this.scope ? `Scope: ${this.scope}.` : "",
      series.length > 0 ? `Series: ${series.map((item) => item.label).join(", ")}.` : "",
      hasInvalidPoints ? invalidMessage : "",
      hasGaps ? "Missing values are shown as gaps." : "",
    ]
      .filter((part) => part.length > 0)
      .join(" ");

    return html`
      <figure part="figure">
        <figcaption>
          <strong>${this.title}</strong>
          ${this.summary ? html`<span part="summary">${this.summary}</span>` : nothing}
          ${this.unit ? html`<span part="unit">Unit: ${this.unit}</span>` : nothing}
          ${this.scope ? html`<span part="scope">Scope: ${this.scope}</span>` : nothing}
        </figcaption>
        <svg
          part="plot"
          role="img"
          aria-label=${accessibleName}
          viewBox=${`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
        >
          <title>Data chart</title>
          <desc>Use the data table below to explore the values.</desc>
          <line x1=${PLOT_LEFT} y1=${PLOT_TOP + PLOT_HEIGHT} x2=${PLOT_LEFT + PLOT_WIDTH} y2=${PLOT_TOP + PLOT_HEIGHT}></line>
          ${geometry.segments.map((segment) => html`<polyline points=${segment.points} class=${this.seriesClasses(segment.seriesIndex)} part="line"></polyline>`)}
          ${geometry.circles.map(
            (circle) => html`<circle cx=${circle.x} cy=${circle.y} r="3" class=${this.seriesClasses(circle.seriesIndex)} part="point"></circle>`,
          )}
        </svg>
        ${hasInvalidPoints ? html`<p part="error" role="status">${invalidMessage}</p>` : nothing}
        ${hasGaps && !hasInvalidPoints ? html`<p part="gap" role="status">Missing values are shown as gaps.</p>` : nothing}
        ${series.length > 0 ? html`
          <ul part="legend" aria-label="Series">
            ${series.map((item, index) => html`<li class=${this.seriesClasses(index)}>
              <span part="legend-marker" aria-hidden="true"></span>
              <span part="legend-label">${item.label}${item.unit ? ` (${item.unit})` : nothing}</span>
            </li>`)}
          </ul>` : nothing}
        <details part="data">
          <summary>View data table</summary>
          <table>
            <caption>${this.title}${this.unit ? ` (${this.unit})` : ""}</caption>
            <thead><tr><th scope="col">Label</th>${series.map((item) => html`<th scope="col">${item.label}${item.unit ? ` (${item.unit})` : nothing}</th>`)}</tr></thead>
            <tbody>
              ${this.tableLabels(aligned).map((label, index) => html`<tr>
                <th scope="row">${label}</th>
                ${aligned.map((item) => html`<td>${this.formatValue(item.points[index]?.value, item.points[index]?.displayValue)}</td>`)}
              </tr>`)}
            </tbody>
          </table>
        </details>
      </figure>
    `;
  }

  private resolvedSeries(): readonly AeliqoChartSeries[] {
    if (this.series.length > 0) return this.series;
    return [{id: "value", label: "Value", ...(this.unit ? {unit: this.unit} : {}), points: this.points}];
  }

  private tableLabels(series: readonly AeliqoChartSeries[]): readonly string[] {
    const length = Math.max(0, ...series.map((item) => item.points.length));
    return Array.from({length}, (_, index) => series.find((item) => item.points[index] !== undefined)?.points[index]?.label ?? `Point ${index + 1}`);
  }

  private formatValue(value: number | null | undefined, displayValue?: string): string {
    if (displayValue !== undefined) return displayValue;
    return value === null || value === undefined || !Number.isFinite(value) ? "—" : String(value);
  }

  private getGeometry(series: readonly AeliqoChartSeries[]): AeliqoChartGeometry { return buildAeliqoChartGeometry(series); }

  private seriesClasses(index: number): string {
    const style = index < 4 ? 0 : ((index - 4) % 4) + 1;
    return `series-${index} color-${index % 4} style-${style}`;
  }

  static readonly styles = [aeliqoThemeStyles, css`
    :host {
      color: var(--aeliqo-chart-color, var(--aeliqo-color-text, #18202a));
      display: block;
      max-inline-size: 100%;
    }

    figure {
      margin: 0;
    }

    figcaption {
      display: grid;
      gap: var(--aeliqo-space-4, 0.25rem);
      margin-block-end: var(--aeliqo-space-12, 0.75rem);
    }

    [part="summary"],
    [part="unit"],
    [part="scope"],
    [part="error"],
    [part="gap"] {
      color: var(--aeliqo-chart-muted, var(--aeliqo-color-muted, #495464));
      font-size: 0.9em;
    }

    svg {
      background: var(--aeliqo-chart-background, var(--aeliqo-color-canvas, #fff));
      block-size: 12rem;
      border: var(--aeliqo-control-border-width, 1px) solid var(--aeliqo-chart-border, var(--aeliqo-color-border, #c9d0d8));
      inline-size: 100%;
      min-block-size: 8rem;
    }

    line {
      stroke: var(--aeliqo-chart-rule, var(--aeliqo-color-border, #8d98a5));
      stroke-width: 1;
    }

    [part="line"] {
      fill: none;
      stroke: var(--aeliqo-chart-line, var(--aeliqo-visualization-series1, #0b63ce));
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 3;
    }

    [part="line"].color-1 { stroke: var(--aeliqo-visualization-series2, #7c3aed); }
    [part="line"].color-2 { stroke: var(--aeliqo-visualization-series3, #0f766e); }
    [part="line"].color-3 { stroke: var(--aeliqo-visualization-series4, #b45309); }

    [part="line"].style-1,
    [part="point"].style-1,
    [part="legend-marker"].style-1 { stroke-dasharray: 8 4; }
    [part="line"].style-2,
    [part="point"].style-2,
    [part="legend-marker"].style-2 { stroke-dasharray: 2 4; }
    [part="line"].style-3,
    [part="point"].style-3,
    [part="legend-marker"].style-3 { stroke-dasharray: 12 3 2 3; }
    [part="line"].style-4,
    [part="point"].style-4,
    [part="legend-marker"].style-4 { stroke-dasharray: 1 4; }

    [part="point"] {
      fill: var(--aeliqo-chart-point, var(--aeliqo-color-canvas, #fff));
      stroke: var(--aeliqo-chart-line, var(--aeliqo-visualization-series1, #0b63ce));
      stroke-width: 2;
    }

    [part="point"].color-1 { stroke: var(--aeliqo-visualization-series2, #7c3aed); }
    [part="point"].color-2 { stroke: var(--aeliqo-visualization-series3, #0f766e); }
    [part="point"].color-3 { stroke: var(--aeliqo-visualization-series4, #b45309); }

    [part="legend-marker"].color-1 { border-block-start-color: var(--aeliqo-visualization-series2, #7c3aed); }
    [part="legend-marker"].color-2 { border-block-start-color: var(--aeliqo-visualization-series3, #0f766e); }
    [part="legend-marker"].color-3 { border-block-start-color: var(--aeliqo-visualization-series4, #b45309); }

    [part="legend"] {
      display: flex;
      flex-wrap: wrap;
      gap: var(--aeliqo-space-8, 0.5rem) var(--aeliqo-space-16, 1rem);
      list-style: none;
      margin: var(--aeliqo-space-8, 0.5rem) 0 0;
      padding: 0;
    }

    [part="legend"] li {
      align-items: center;
      display: inline-flex;
      gap: var(--aeliqo-space-4, 0.25rem);
    }

    [part="legend-marker"] {
      border-block-start: 0.2rem solid var(--aeliqo-chart-line, var(--aeliqo-visualization-series1, #0b63ce));
      display: inline-block;
      inline-size: 1.25rem;
    }

    [part="legend-marker"].style-1 { border-block-start-style: dashed; }
    [part="legend-marker"].style-2 { border-block-start-style: dotted; }
    [part="legend-marker"].style-3 { border-block-start-style: double; }
    [part="legend-marker"].style-4 { border-block-start-style: dashed; }

    [part="legend-label"] {
      font-size: 0.9em;
    }

    details {
      margin-block-start: var(--aeliqo-space-12, 0.75rem);
    }

    details:focus-within {
      outline: var(--aeliqo-focus-width, 0.1875rem) solid var(--aeliqo-chart-focus, var(--aeliqo-color-focus, #0b63ce));
      outline-offset: var(--aeliqo-focus-offset, 0.1875rem);
    }

    table {
      border-collapse: collapse;
      margin-block-start: var(--aeliqo-space-8, 0.5rem);
      min-inline-size: min(100%, 20rem);
    }

    th,
    td {
      border-block-end: var(--aeliqo-control-border-width, 1px) solid var(--aeliqo-chart-rule, var(--aeliqo-color-border, #c9d0d8));
      padding: var(--aeliqo-space-4, 0.25rem) var(--aeliqo-space-8, 0.5rem);
      text-align: start;
    }
  `];
}

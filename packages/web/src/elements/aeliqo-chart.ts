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

/** Pure bounded geometry used by the SVG renderer and its verification tests. */
export function buildAeliqoChartGeometry(series: readonly AeliqoChartSeries[]): AeliqoChartGeometry {
  const finite: number[] = [];
  for (const item of series) {
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
  const width = Math.max(...series.map((item) => item.points.length), 1);
  const step = width === 1 ? 0 : PLOT_WIDTH / (width - 1);
  series.forEach((item, seriesIndex) => {
    let current: string[] = [];
    const flush = (): void => {
      if (current.length > 0) segments.push({seriesIndex, points: current.join(" ")});
      current = [];
    };
    item.points.forEach((point, index) => {
      if (point.value === null) { flush(); return; }
      const x = PLOT_LEFT + step * index;
      const y = PLOT_TOP + PLOT_HEIGHT - ((point.value / scale - scaledMin) / span) * PLOT_HEIGHT;
      current.push(`${x},${y}`);
      circles.push({seriesIndex, x, y});
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
    const hasInvalidPoints = series.some((item) => item.points.some((point) => point.value !== null && !Number.isFinite(point.value)));
    const hasGaps = series.some((item) => item.points.some((point) => point.value === null));
    const geometry = hasInvalidPoints ? {segments: [], circles: []} : this.getGeometry(series);
    const invalidMessage = "Chart unavailable: values must be finite.";
    const accessibleName = [
      this.title,
      this.summary,
      this.scope ? `Scope: ${this.scope}.` : "",
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
          ${geometry.segments.map((segment) => html`<polyline points=${segment.points} class=${`series-${segment.seriesIndex % 4}`} part="line"></polyline>`)}
          ${geometry.circles.map(
            (circle) => html`<circle cx=${circle.x} cy=${circle.y} r="3" class=${`series-${circle.seriesIndex % 4}`} part="point"></circle>`,
          )}
        </svg>
        ${hasInvalidPoints ? html`<p part="error" role="status">${invalidMessage}</p>` : nothing}
        ${hasGaps && !hasInvalidPoints ? html`<p part="gap" role="status">Missing values are shown as gaps.</p>` : nothing}
        <details part="data">
          <summary>View data table</summary>
          <table>
            <caption>${this.title}${this.unit ? ` (${this.unit})` : ""}</caption>
            <thead><tr><th scope="col">Label</th>${series.map((item) => html`<th scope="col">${item.label}${item.unit ? ` (${item.unit})` : nothing}</th>`)}</tr></thead>
            <tbody>
              ${this.tableLabels(series).map((label, index) => html`<tr>
                <th scope="row">${label}</th>
                ${series.map((item) => html`<td>${this.formatValue(item.points[index]?.value)}</td>`)}
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

  private formatValue(value: number | null | undefined): string {
    return value === null || value === undefined || !Number.isFinite(value) ? "—" : String(value);
  }

  private getGeometry(series: readonly AeliqoChartSeries[]): AeliqoChartGeometry { return buildAeliqoChartGeometry(series); }

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

    [part="line"].series-1 { stroke: var(--aeliqo-visualization-series2, #7c3aed); }
    [part="line"].series-2 { stroke: var(--aeliqo-visualization-series3, #0f766e); }
    [part="line"].series-3 { stroke: var(--aeliqo-visualization-series4, #b45309); }

    [part="point"] {
      fill: var(--aeliqo-chart-point, var(--aeliqo-color-canvas, #fff));
      stroke: var(--aeliqo-chart-line, var(--aeliqo-visualization-series1, #0b63ce));
      stroke-width: 2;
    }

    [part="point"].series-1 { stroke: var(--aeliqo-visualization-series2, #7c3aed); }
    [part="point"].series-2 { stroke: var(--aeliqo-visualization-series3, #0f766e); }
    [part="point"].series-3 { stroke: var(--aeliqo-visualization-series4, #b45309); }

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

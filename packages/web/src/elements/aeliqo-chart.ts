import {css, html, LitElement, nothing} from "lit";
import type {AeliqoChartPoint} from "../types.js";

const CHART_WIDTH = 320;
const CHART_HEIGHT = 180;
const PLOT_LEFT = 24;
const PLOT_TOP = 14;
const PLOT_WIDTH = 280;
const PLOT_HEIGHT = 132;

export class AeliqoChartElement extends LitElement {
  static readonly properties = {
    title: {type: String},
    summary: {type: String},
    unit: {type: String},
    scope: {type: String},
    points: {attribute: false},
  };

  static readonly aeliqoVersion = "0.1.0-m0";

  title = "Chart";
  summary = "";
  unit = "";
  scope = "";
  points: readonly AeliqoChartPoint[] = [];

  protected override render() {
    const hasInvalidPoints = this.points.some((point) => !Number.isFinite(point.value));
    const geometry = hasInvalidPoints ? {polyline: "", circles: []} : this.getGeometry();
    const invalidMessage = "Chart unavailable: values must be finite.";
    const accessibleName = [
      this.title,
      this.summary,
      this.scope ? `Scope: ${this.scope}.` : "",
      hasInvalidPoints ? invalidMessage : "",
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
          <polyline points=${geometry.polyline} part="line"></polyline>
          ${geometry.circles.map(
            (circle) => html`<circle cx=${circle.x} cy=${circle.y} r="3" part="point"></circle>`,
          )}
        </svg>
        ${hasInvalidPoints ? html`<p part="error" role="status">${invalidMessage}</p>` : nothing}
        <details part="data">
          <summary>View data table</summary>
          <table>
            <caption>${this.title}${this.unit ? ` (${this.unit})` : ""}</caption>
            <thead><tr><th scope="col">Label</th><th scope="col">Value</th></tr></thead>
            <tbody>
              ${this.points.map(
                (point) => html`<tr><th scope="row">${point.label}</th><td>${point.value}</td></tr>`,
              )}
            </tbody>
          </table>
        </details>
      </figure>
    `;
  }

  private getGeometry(): {
    readonly polyline: string;
    readonly circles: readonly {readonly x: number; readonly y: number}[];
  } {
    if (this.points.length === 0) {
      return {polyline: "", circles: []};
    }

    let min = this.points[0]?.value ?? 0;
    let max = min;
    for (const point of this.points) {
      min = Math.min(min, point.value);
      max = Math.max(max, point.value);
    }
    // Scale before subtracting so finite extreme values cannot overflow to
    // Infinity and poison the SVG coordinates.
    const scale = Math.max(Math.abs(min), Math.abs(max), 1);
    const scaledMin = min / scale;
    const span = max / scale - scaledMin || 1;
    const step = this.points.length === 1 ? 0 : PLOT_WIDTH / (this.points.length - 1);
    const circles = this.points.map((point, index) => {
      const x = PLOT_LEFT + step * index;
      const y = PLOT_TOP + PLOT_HEIGHT - ((point.value / scale - scaledMin) / span) * PLOT_HEIGHT;
      return {x, y};
    });
    return {polyline: circles.map((circle) => `${circle.x},${circle.y}`).join(" "), circles};
  }

  static readonly styles = css`
    :host {
      color: var(--aeliqo-chart-color, #18202a);
      display: block;
      font: inherit;
      max-inline-size: 100%;
    }

    figure {
      margin: 0;
    }

    figcaption {
      display: grid;
      gap: 0.2rem;
      margin-block-end: 0.6rem;
    }

    [part="summary"],
    [part="unit"],
    [part="scope"],
    [part="error"] {
      color: var(--aeliqo-chart-muted, #495464);
      font-size: 0.9em;
    }

    svg {
      background: var(--aeliqo-chart-background, #fff);
      block-size: 12rem;
      border: 1px solid var(--aeliqo-chart-border, #c9d0d8);
      inline-size: 100%;
      min-block-size: 8rem;
    }

    line {
      stroke: var(--aeliqo-chart-rule, #8d98a5);
      stroke-width: 1;
    }

    [part="line"] {
      fill: none;
      stroke: var(--aeliqo-chart-line, #0b63ce);
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 3;
    }

    [part="point"] {
      fill: var(--aeliqo-chart-point, #fff);
      stroke: var(--aeliqo-chart-line, #0b63ce);
      stroke-width: 2;
    }

    details {
      margin-block-start: 0.7rem;
    }

    details:focus-within {
      outline: 0.2rem solid var(--aeliqo-chart-focus, #0b63ce);
      outline-offset: 0.15rem;
    }

    table {
      border-collapse: collapse;
      margin-block-start: 0.5rem;
      min-inline-size: min(100%, 20rem);
    }

    th,
    td {
      border-block-end: 1px solid var(--aeliqo-chart-rule, #c9d0d8);
      padding: 0.35rem 0.5rem;
      text-align: start;
    }
  `;
}

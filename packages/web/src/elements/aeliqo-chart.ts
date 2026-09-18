import { aeliqoChartStyles } from './aeliqo-chart-styles.js';
import { html, LitElement, nothing, svg } from 'lit';
import { scalarIdentity } from '@aeliqo/core';
import type { AeliqoChartPoint, AeliqoChartSeries } from '../types.js';
import { AELIQO_WEB_VERSION } from '../version.js';

const CHART_WIDTH = 640;
const CHART_HEIGHT = 180;
const PLOT_LEFT = 56;
const PLOT_TOP = 18;
const PLOT_WIDTH = 568;
const PLOT_HEIGHT = 132;

export interface AeliqoChartGeometry {
  readonly segments: readonly { readonly seriesIndex: number; readonly points: string }[];
  readonly circles: readonly { readonly seriesIndex: number; readonly x: number; readonly y: number }[];
}

interface AeliqoChartDomainPoint {
  readonly key: string;
  readonly x?: string | number;
  readonly label: string;
}

function hasExplicitX(series: readonly AeliqoChartSeries[]): boolean {
  return series.some((item) => item.points.some((point) => point.x !== undefined));
}

function temporalX(value: string | number | undefined): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.length === 0) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pointBaseKey(point: AeliqoChartPoint, index: number, explicitX: boolean): string {
  if (!explicitX || point.x === undefined) return `index:${index}`;
  if (typeof point.x === 'number') return `number:${point.x}`;
  // Date.parse only retains milliseconds; use the core instant identity so
  // sub-millisecond rows cannot collide and equivalent offsets align.
  const instant = scalarIdentity(point.x, { value: 'instant', nullable: false });
  if (instant.ok) return `instant:${instant.value}`;
  const date = scalarIdentity(point.x, { value: 'date', nullable: false });
  return date.ok ? `date:${date.value}` : `string:${point.x}`;
}

function instantParts(value: string): { readonly milliseconds: number; readonly fraction: string } | undefined {
  const identity = scalarIdentity(value, { value: 'instant', nullable: false });
  if (!identity.ok) return undefined;
  try {
    const parsed: unknown = JSON.parse(identity.value);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 2 ||
      parsed[0] !== 'instant' ||
      !Array.isArray(parsed[1]) ||
      parsed[1].length !== 2 ||
      typeof parsed[1][0] !== 'number' ||
      typeof parsed[1][1] !== 'string'
    )
      return undefined;
    return { milliseconds: parsed[1][0], fraction: parsed[1][1] };
  } catch {
    return undefined;
  }
}

function dateIdentity(value: string): string | undefined {
  const identity = scalarIdentity(value, { value: 'date', nullable: false });
  return identity.ok ? identity.value : undefined;
}

function occurrenceKey(baseKey: string, occurrence: number): string {
  return `${baseKey}#${occurrence}`;
}

function compareDate(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Return one bounded, ordered x domain shared by every rendered series. */
export function buildAeliqoChartDomain(series: readonly AeliqoChartSeries[]): readonly AeliqoChartDomainPoint[] {
  const explicitX = hasExplicitX(series);
  if (!explicitX) {
    const length = Math.max(0, ...series.map((item) => item.points.length));
    return Array.from({ length }, (_, index) => ({
      key: `index:${index}`,
      label: series.find((item) => item.points[index] !== undefined)?.points[index]?.label ?? `Point ${index + 1}`,
    }));
  }

  const domain: AeliqoChartDomainPoint[] = [];
  const seen = new Set<string>();
  series.forEach((item) => {
    const occurrences = new Map<string, number>();
    item.points.forEach((point, index) => {
      const baseKey = pointBaseKey(point, index, explicitX);
      const occurrence = occurrences.get(baseKey) ?? 0;
      occurrences.set(baseKey, occurrence + 1);
      const key = explicitX ? occurrenceKey(baseKey, occurrence) : baseKey;
      if (seen.has(key)) return;
      seen.add(key);
      domain.push({ key, ...(point.x === undefined ? {} : { x: point.x }), label: point.label });
    });
  });
  const output = domain;
  const numeric = output.length > 0 && output.every((entry) => typeof entry.x === 'number' && Number.isFinite(entry.x));
  const temporal =
    output.length > 0 && output.every((entry) => typeof entry.x === 'string' && instantParts(entry.x) !== undefined);
  const dates =
    output.length > 0 && output.every((entry) => typeof entry.x === 'string' && dateIdentity(entry.x) !== undefined);
  if (numeric) output.sort((left, right) => (left.x as number) - (right.x as number));
  else if (temporal) output.sort((left, right) => compareTemporal(left.x as string, right.x as string));
  else if (dates) output.sort((left, right) => compareDate(left.x as string, right.x as string));
  return output;
}

function compareTemporal(left: string, right: string): number {
  const a = instantParts(left);
  const b = instantParts(right);
  if (a !== undefined && b !== undefined) {
    if (a.milliseconds !== b.milliseconds) return a.milliseconds < b.milliseconds ? -1 : 1;
    const length = Math.max(a.fraction.length, b.fraction.length);
    const af = a.fraction.padEnd(length, '0');
    const bf = b.fraction.padEnd(length, '0');
    return compareDate(af, bf);
  }
  const aTime = temporalX(left);
  const bTime = temporalX(right);
  return aTime === undefined || bTime === undefined ? 0 : aTime - bTime;
}

/** Insert null points for dates absent from an individual grouped series. */
export function alignAeliqoChartSeries(series: readonly AeliqoChartSeries[]): readonly AeliqoChartSeries[] {
  const explicitX = hasExplicitX(series);
  const domain = buildAeliqoChartDomain(series);
  return series.map((item) => {
    const byKey = new Map<string, AeliqoChartPoint>();
    const occurrences = new Map<string, number>();
    item.points.forEach((point, index) => {
      const baseKey = pointBaseKey(point, index, explicitX);
      const occurrence = occurrences.get(baseKey) ?? 0;
      occurrences.set(baseKey, occurrence + 1);
      byKey.set(explicitX ? occurrenceKey(baseKey, occurrence) : baseKey, point);
    });
    const points = domain.map((entry) => {
      const point = byKey.get(entry.key);
      if (point !== undefined)
        return {
          ...point,
          label: entry.label,
          ...(entry.x === undefined ? {} : { x: entry.x }),
        };
      return {
        label: entry.label,
        value: null,
        ...(entry.x === undefined ? {} : { x: entry.x }),
      };
    });
    return { ...item, points };
  });
}

function numericCoordinates(domain: readonly AeliqoChartDomainPoint[]): number[] | undefined {
  const values = domain.map((entry) => (typeof entry.x === 'number' && Number.isFinite(entry.x) ? entry.x : undefined));
  return values.every((value) => value !== undefined) ? (values as number[]) : undefined;
}

function instantCoordinates(domain: readonly AeliqoChartDomainPoint[]): number[] | undefined {
  const instants = domain.map((entry) => (typeof entry.x === 'string' ? instantParts(entry.x) : undefined));
  if (instants.some((value) => value === undefined)) return undefined;
  const values = instants as NonNullable<(typeof instants)[number]>[];
  const base = values[0]?.milliseconds;
  if (base === undefined) return undefined;
  const coordinates = values.map(
    (value) => value.milliseconds - base + (value.fraction.length > 0 ? Number(`0.${value.fraction}`) * 1000 : 0),
  );
  return coordinates.every(Number.isFinite) ? coordinates : undefined;
}

function dateCoordinates(domain: readonly AeliqoChartDomainPoint[]): number[] | undefined {
  const values = domain.map((entry) => {
    if (typeof entry.x !== 'string' || dateIdentity(entry.x) === undefined) return undefined;
    return temporalX(entry.x);
  });
  return values.every((value) => value !== undefined) ? (values as number[]) : undefined;
}

function coordinateValues(domain: readonly AeliqoChartDomainPoint[]): number[] | undefined {
  return numericCoordinates(domain) ?? instantCoordinates(domain) ?? dateCoordinates(domain);
}

function centeredCoordinates(length: number): readonly number[] {
  const step = length === 1 ? 0 : PLOT_WIDTH / (length - 1);
  return Array.from({ length }, (_, index) => PLOT_LEFT + step * index);
}

function scaledCoordinates(values: readonly number[]): readonly number[] {
  let min = values[0]!;
  let max = values[0]!;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const scale = Math.max(Math.abs(min), Math.abs(max), 1);
  const scaledMin = min / scale;
  const span = max / scale - scaledMin;
  if (span === 0) {
    const center = PLOT_LEFT + PLOT_WIDTH / 2;
    return values.map(() => center);
  }
  return values.map((value) => PLOT_LEFT + ((value / scale - scaledMin) / span) * PLOT_WIDTH);
}

function xCoordinates(domain: readonly AeliqoChartDomainPoint[]): readonly number[] {
  if (domain.length === 0) return [];
  const values = coordinateValues(domain);
  if (values === undefined) return centeredCoordinates(domain.length);
  return scaledCoordinates(values);
}

interface ChartXAxisTick {
  readonly position: number;
  readonly label: string;
  readonly anchor: 'start' | 'middle' | 'end';
}

interface ChartYAxisTick {
  readonly position: number;
  readonly label: string;
}

function visibleTickIndexes(length: number): number[] {
  if (length <= 3) return Array.from({ length }, (_, index) => index);
  return [0, Math.floor((length - 1) / 2), length - 1];
}

function chartTickLabel(label: string): string {
  return label.length <= 10 ? label : `${label.slice(0, 8)}…`;
}

function xAxisTicks(series: readonly AeliqoChartSeries[]): ChartXAxisTick[] {
  const domain = buildAeliqoChartDomain(series);
  const positions = xCoordinates(domain);
  return visibleTickIndexes(domain.length).flatMap((index) => {
    const point = domain[index];
    const position = positions[index];
    if (point === undefined || position === undefined) return [];
    let anchor: ChartXAxisTick['anchor'] = 'middle';
    if (index === 0) anchor = 'start';
    else if (index === domain.length - 1) anchor = 'end';
    return [{ position, label: chartTickLabel(point.label), anchor }];
  });
}

function numericExtent(series: readonly AeliqoChartSeries[]): readonly [number, number] | undefined {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const item of series) {
    for (const point of item.points) {
      if (point.value === null || !Number.isFinite(point.value)) continue;
      minimum = Math.min(minimum, point.value);
      maximum = Math.max(maximum, point.value);
    }
  }
  return Number.isFinite(minimum) ? [minimum, maximum] : undefined;
}

function yAxisTicks(series: readonly AeliqoChartSeries[]): ChartYAxisTick[] {
  const extent = numericExtent(series);
  if (extent === undefined) return [];
  const [minimum, maximum] = extent;
  const values = minimum === maximum ? [minimum] : [minimum, minimum / 2 + maximum / 2, maximum];
  const scale = Math.max(Math.abs(minimum), Math.abs(maximum), 1);
  const scaledMinimum = minimum / scale;
  const span = maximum / scale - scaledMinimum;
  const format = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4, notation: 'compact' });
  return values.map((value) => {
    const fraction = span === 0 ? 0 : (value / scale - scaledMinimum) / span;
    return {
      position: PLOT_TOP + PLOT_HEIGHT - fraction * PLOT_HEIGHT,
      label: format.format(value),
    };
  });
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
  if (finite.length === 0) return { segments: [], circles: [] };
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
  const circles: { seriesIndex: number; x: number; y: number }[] = [];
  const segments: { seriesIndex: number; points: string }[] = [];
  const domain = buildAeliqoChartDomain(series);
  const x = xCoordinates(domain);
  aligned.forEach((item, seriesIndex) => {
    let current: string[] = [];
    const flush = (): void => {
      if (current.length > 0) segments.push({ seriesIndex, points: current.join(' ') });
      current = [];
    };
    item.points.forEach((point, index) => {
      if (point.value === null || !Number.isFinite(point.value)) {
        flush();
        return;
      }
      const xCoordinate = x[index] ?? PLOT_LEFT;
      const y = PLOT_TOP + PLOT_HEIGHT - ((point.value / scale - scaledMin) / span) * PLOT_HEIGHT;
      current.push(`${xCoordinate},${y}`);
      circles.push({ seriesIndex, x: xCoordinate, y });
    });
    flush();
  });
  return { segments, circles };
}

export class AeliqoChartElement extends LitElement {
  static readonly aeliqoVersion = AELIQO_WEB_VERSION;
  static readonly properties = {
    title: { type: String },
    summary: { type: String },
    unit: { type: String },
    scope: { type: String },
    points: { attribute: false },
    series: { attribute: false },
  };

  title = 'Chart';
  summary = '';
  unit = '';
  scope = '';
  points: readonly AeliqoChartPoint[] = [];
  series: readonly AeliqoChartSeries[] = [];

  protected override render() {
    const series = this.resolvedSeries();
    const aligned = alignAeliqoChartSeries(series);
    const hasInvalidPoints = series.some((item) =>
      item.points.some((point) => point.value !== null && !Number.isFinite(point.value)),
    );
    const hasGaps = aligned.some((item) => item.points.some((point) => point.value === null));
    const geometry = hasInvalidPoints ? { segments: [], circles: [] } : this.getGeometry(aligned);
    const accessibleName = this.accessibleName(series, hasInvalidPoints, hasGaps);

    return html`
      <figure part="figure">
        ${this.renderCaption()} ${this.renderPlot(geometry, accessibleName, series)}
        ${this.renderFeedback(hasInvalidPoints, hasGaps)} ${this.renderLegend(series)}
        ${this.renderDataTable(series, aligned)}
      </figure>
    `;
  }

  private accessibleName(series: readonly AeliqoChartSeries[], hasInvalidPoints: boolean, hasGaps: boolean): string {
    const parts = [this.title, this.summary];
    if (this.scope) parts.push(`Scope: ${this.scope}.`);
    if (series.length > 0) parts.push(`Series: ${series.map((item) => item.label).join(', ')}.`);
    if (hasInvalidPoints) parts.push('Chart unavailable: values must be finite.');
    if (hasGaps) parts.push('Missing values are shown as gaps.');
    return parts.filter((part) => part.length > 0).join(' ');
  }

  private renderCaption() {
    return html`<figcaption>
      <strong>${this.title}</strong>
      ${this.summary ? html`<span part="summary">${this.summary}</span>` : nothing}
      ${this.unit ? html`<span part="unit">Unit: ${this.unit}</span>` : nothing}
      ${this.scope ? html`<span part="scope">Scope: ${this.scope}</span>` : nothing}
    </figcaption>`;
  }

  private renderFeedback(hasInvalidPoints: boolean, hasGaps: boolean) {
    return html`
      ${hasInvalidPoints ? html`<p part="error" role="status">Chart unavailable: values must be finite.</p>` : nothing}
      ${hasGaps && !hasInvalidPoints ? html`<p part="gap" role="status">Missing values are shown as gaps.</p>` : nothing}
    `;
  }

  private renderLegend(series: readonly AeliqoChartSeries[]) {
    if (series.length === 0) return nothing;
    return html`<ul part="legend" aria-label="Series">
      ${series.map(
        (item, index) =>
          html`<li>
            <span part="legend-marker" class=${this.seriesClasses(index)} aria-hidden="true"></span>
            <span part="legend-label">${item.label}${item.unit ? ` (${item.unit})` : nothing}</span>
          </li>`,
      )}
    </ul>`;
  }

  private renderDataTable(series: readonly AeliqoChartSeries[], aligned: readonly AeliqoChartSeries[]) {
    return html`<details part="data">
      <summary>View data table</summary>
      <table>
        <caption>
          ${this.title}${this.unit ? ` (${this.unit})` : ''}
        </caption>
        <thead>
          <tr>
            <th scope="col">Label</th>
            ${series.map((item) => html`<th scope="col">${item.label}${item.unit ? ` (${item.unit})` : nothing}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${this.tableLabels(aligned).map(
            (label, index) =>
              html`<tr>
                <th scope="row">${label}</th>
                ${aligned.map((item) => html`<td>${this.formatValue(item.points[index]?.value, item.points[index]?.displayValue)}</td>`)}
              </tr>`,
          )}
        </tbody>
      </table>
    </details>`;
  }

  private resolvedSeries(): readonly AeliqoChartSeries[] {
    if (this.series.length > 0) return this.series;
    return [{ id: 'value', label: 'Value', ...(this.unit ? { unit: this.unit } : {}), points: this.points }];
  }

  private tableLabels(series: readonly AeliqoChartSeries[]): readonly string[] {
    const length = Math.max(0, ...series.map((item) => item.points.length));
    return Array.from(
      { length },
      (_, index) =>
        series.find((item) => item.points[index] !== undefined)?.points[index]?.label ?? `Point ${index + 1}`,
    );
  }

  private formatValue(value: number | null | undefined, displayValue?: string): string {
    if (displayValue !== undefined) return displayValue;
    return value === null || value === undefined || !Number.isFinite(value) ? '—' : String(value);
  }

  private getGeometry(series: readonly AeliqoChartSeries[]): AeliqoChartGeometry {
    return buildAeliqoChartGeometry(series);
  }

  private renderPlot(geometry: AeliqoChartGeometry, accessibleName: string, series: readonly AeliqoChartSeries[]) {
    const xTicks = xAxisTicks(series);
    const yTicks = yAxisTicks(series);
    return svg`
      <svg
        part="plot"
        role="img"
        aria-label=${accessibleName}
        viewBox=${`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <title>Data chart</title>
        <desc>Use the data table below to explore the values.</desc>
        ${yTicks.map((tick) => svg`<line class="gridline" vector-effect="non-scaling-stroke" x1=${PLOT_LEFT} y1=${tick.position} x2=${PLOT_LEFT + PLOT_WIDTH} y2=${tick.position}></line>`)}
        <line class="axis" vector-effect="non-scaling-stroke" x1=${PLOT_LEFT} y1=${PLOT_TOP} x2=${PLOT_LEFT} y2=${PLOT_TOP + PLOT_HEIGHT}></line>
        <line class="axis" vector-effect="non-scaling-stroke" x1=${PLOT_LEFT} y1=${PLOT_TOP + PLOT_HEIGHT} x2=${PLOT_LEFT + PLOT_WIDTH} y2=${PLOT_TOP + PLOT_HEIGHT}></line>
        ${geometry.segments.map((segment) => svg`<polyline vector-effect="non-scaling-stroke" points=${segment.points} class=${this.seriesClasses(segment.seriesIndex)} part="line"></polyline>`)}
        ${geometry.circles.map(
          (circle) =>
            svg`<circle vector-effect="non-scaling-stroke" cx=${circle.x} cy=${circle.y} r="3" class=${this.seriesClasses(circle.seriesIndex)} part="point"></circle>`,
        )}
        ${yTicks.map((tick) => svg`<text class="axis-y-tick" x=${PLOT_LEFT - 8} y=${tick.position + 3} text-anchor="end">${tick.label}</text>`)}
        ${xTicks.map((tick) => svg`<text class="axis-x-tick" x=${tick.position} y=${PLOT_TOP + PLOT_HEIGHT + 18} text-anchor=${tick.anchor}>${tick.label}</text>`)}
      </svg>
    `;
  }

  private seriesClasses(index: number): string {
    const style = index % 5;
    return `series-${index} color-${index % 4} style-${style}`;
  }

  static readonly styles = aeliqoChartStyles;
}

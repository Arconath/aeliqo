import { renderAeliqoVisualizationPresentationNode } from './visualization-renderer.js';
import { AELIQO_VISUALIZATION_REFS } from './visualization-registry.js';
import { renderAeliqoDataPresentationNode } from './data-presentation.js';
import { AELIQO_DATA_REFS } from './data-registry.js';
import type { AeliqoRegionDataRequestHandler } from './types.js';
import {
  decimalText,
  filterPort,
  filterPredicates,
  configColumns as tableConfigColumns,
  fieldLabel as getFieldLabel,
  filterValue as getFilterValue,
  inputChangeDetail,
  numericValue,
  record,
  refKey,
  resultColumns,
  resultFor,
  replacementForFocusedElement,
  selectionKeys as getSelectionKeys,
  tableSelectionDetail,
  tableDisplayState,
  tableSelectionMode,
  temporalLabel,
  temporalTime,
  text,
  trendSummary,
  valuesOf,
} from './element-helpers.js';
import { renderNavigationFeedbackNode } from './navigation-feedback-renderer.js';
import { renderInputNode } from './input-renderer.js';
import { renderFoundationNode } from './foundation-renderer.js';
import type { InteractionPayload, InteractionState } from '@aeliqo/core';
import type { ValidatedPresentation } from '@aeliqo/core/presentation';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { PropertyValues } from 'lit';
import { AELIQO_WEB_VERSION } from '../version.js';
import { aeliqoThemeStyles } from '../styles/theme.js';
import { scopeText } from '../data/shared.js';
import '../elements/aeliqo-table.js';
import '../elements/aeliqo-chart.js';
import { stableTableRowKey } from '../elements/aeliqo-table.js';
import type { AeliqoChartSeries, AeliqoTableRow } from '../types.js';
import type { AeliqoTableSelectionDetail } from '../types.js';
import type {
  AeliqoRegionResult,
  AeliqoSemanticInteractionHandler,
  AeliqoSemanticInteractionRequest,
  AeliqoViewDefinition,
} from './types.js';

/**
 * One controlled renderer for a validated presentation. It consumes only
 * host-resolved descriptors and bounded rows; query, authority and route
 * decisions remain outside this element.
 */
export class AeliqoRegionElement extends LitElement {
  static readonly aeliqoVersion = AELIQO_WEB_VERSION;
  static readonly properties = {
    presentation: { attribute: false },
    results: { attribute: false },
    interaction: { attribute: false },
    onSemanticInteraction: { attribute: false },
    onDataRequest: { attribute: false },
    viewRenderers: { attribute: false },
  };

  presentation: ValidatedPresentation | undefined = undefined;
  results: readonly AeliqoRegionResult[] = [];
  interaction: InteractionState | undefined = undefined;
  onSemanticInteraction: AeliqoSemanticInteractionHandler | undefined = undefined;
  onDataRequest: AeliqoRegionDataRequestHandler | undefined = undefined;
  viewRenderers: readonly AeliqoViewDefinition[] = [];
  private focusedNodeId: string | undefined;
  private focusedElement: HTMLElement | undefined;

  /** Clear committed content when the host revokes or disposes the region. */
  clear(): void {
    this.presentation = undefined;
    this.results = [];
    this.interaction = undefined;
  }

  revoke(): void {
    this.clear();
  }
  dispose(): void {
    this.clear();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!changed.has('presentation')) return;
    const active = this.shadowRoot?.activeElement;
    const elementConstructor = globalThis.HTMLElement;
    if (elementConstructor === undefined || !(active instanceof elementConstructor)) return;
    const nodeHost = active.closest<HTMLElement>('[data-aeliqo-node-id]');
    if (nodeHost === null) return;
    this.focusedNodeId = nodeHost.dataset.aeliqoNodeId;
    const nested = active.shadowRoot?.activeElement;
    this.focusedElement = nested instanceof HTMLElement ? nested : active;
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('presentation') || this.focusedNodeId === undefined) return;
    const focusedElement = this.focusedElement;
    const nodeId = this.focusedNodeId;
    this.focusedElement = undefined;
    this.focusedNodeId = undefined;
    const restore = (): void => this.restoreFocus(nodeId, focusedElement);
    restore();
    // A child renderer can replace the previously focused control in the
    // microtask after this element updates. Retry once so focus follows the
    // stable node identity through that child update as well.
    queueMicrotask(restore);
  }

  private restoreFocus(nodeId: string, focusedElement: HTMLElement | undefined): void {
    if (!this.isConnected) return;
    if (focusedElement?.isConnected) {
      focusedElement.focus();
      return;
    }
    const target = [...(this.shadowRoot?.querySelectorAll<HTMLElement>('[data-aeliqo-node-id]') ?? [])].find(
      (candidate) => candidate.dataset.aeliqoNodeId === nodeId,
    );
    if (target === undefined) return;
    (replacementForFocusedElement(target, focusedElement) ?? target).focus();
  }

  protected override render(): TemplateResult | typeof nothing {
    if (this.presentation === undefined) return nothing;
    const nodes = new Map(this.presentation.nodes.map((node) => [node.node.id, node]));
    if (!nodes.has(this.presentation.plan.rootId)) return nothing;
    return html`<div
      part="region"
      lang=${this.presentation.environment.locale}
      dir=${this.presentation.environment.direction}
    >
      ${this.renderNode(this.presentation.plan.rootId, nodes)}
    </div>`;
  }

  private renderNode(
    nodeId: string,
    nodes: ReadonlyMap<string, ValidatedPresentation['nodes'][number]>,
  ): TemplateResult | typeof nothing {
    const resolved = nodes.get(nodeId);
    if (resolved === undefined) return nothing;
    const children = (): TemplateResult =>
      html`${repeat(
        resolved.node.children,
        (childId) => childId,
        (childId) => this.renderNode(childId, nodes),
      )}`;
    const values = valuesOf(resolved);
    switch (resolved.manifest.id) {
      case 'layout.stack': {
        const gap =
          typeof values.gap === 'number' && Number.isSafeInteger(values.gap) && values.gap >= 0 && values.gap <= 64
            ? `${values.gap}px`
            : 'var(--aeliqo-space-24, 1.5rem)';
        return html`<div
          part="stack"
          data-aeliqo-role="stack"
          data-aeliqo-node-id=${resolved.node.id}
          style=${`gap:${gap}`}
        >
          ${children()}
        </div>`;
      }
      case 'data.table':
        return this.renderTable(resolved, values);
      case 'data.trend':
        return this.renderTrend(resolved, values);
      case 'control.filter':
        return this.renderFilter(resolved, values);
      default:
        return this.renderRegisteredNode(resolved, nodes, children);
    }
  }

  private renderRegisteredNode(
    resolved: ValidatedPresentation['nodes'][number],
    nodes: ReadonlyMap<string, ValidatedPresentation['nodes'][number]>,
    children: () => TemplateResult,
  ): TemplateResult | typeof nothing {
    const child = (childId: string): TemplateResult | typeof nothing => this.renderNode(childId, nodes);
    const emit = (node: ValidatedPresentation['nodes'][number], portId: string, payload: InteractionPayload): void =>
      this.emitFoundation(node, portId, payload);
    const unsupported = html`<div part="unsupported">Unsupported registered representation.</div>`;
    return (
      renderFoundationNode(resolved, child, emit) ??
      renderInputNode(resolved, child, emit, this.presentation?.environment.locale) ??
      renderNavigationFeedbackNode(resolved, child, emit) ??
      this.renderData(resolved) ??
      this.renderVisualization(resolved) ??
      this.renderCustom(resolved, children) ??
      unsupported
    );
  }

  private renderCustom(
    node: ValidatedPresentation['nodes'][number],
    children: () => TemplateResult | typeof nothing,
  ): TemplateResult | typeof nothing | undefined {
    const definition = this.viewRenderers.find(
      (candidate) => candidate.ref.id === node.manifest.id && candidate.ref.revision === node.manifest.revision,
    );
    if (definition === undefined) return undefined;
    const result = resultFor(node, this.results);
    try {
      return definition.render({ node, ...(result === undefined ? {} : { result }), children });
    } catch {
      return html`<div part="unsupported">Custom view could not be rendered.</div>`;
    }
  }

  private renderVisualization(
    node: ValidatedPresentation['nodes'][number],
  ): TemplateResult | typeof nothing | undefined {
    if (
      !Object.values(AELIQO_VISUALIZATION_REFS).some(
        (ref) => ref.id === node.manifest.id && ref.revision === node.manifest.revision,
      )
    )
      return undefined;
    const current = resultFor(node, this.results);
    if (current === undefined || node.result === undefined) return html`<p part="status">Data unavailable.</p>`;
    const context = current.visualizationContext ?? { results: [node.result] };
    const entity = node.config.ports.find((port) => port.id === 'selection' && port.payload === 'selection')?.entity;
    const rendered = renderAeliqoVisualizationPresentationNode(
      node,
      { result: node.result, context, datasets: [{ result: current.ref, rows: current.rows }] },
      {
        ...(this.interaction === undefined ? {} : { interaction: this.interaction }),
        onSemanticInteraction: (_nodeId, portId, payload) => this.emitFoundation(node, portId, payload),
      },
      { resolveEntity: () => entity },
    );
    return rendered === nothing
      ? html`<p part="status">Data unavailable.</p>`
      : html`<div data-aeliqo-node-id=${node.node.id}>${rendered}</div>`;
  }

  private renderData(node: ValidatedPresentation['nodes'][number]): TemplateResult | typeof nothing | undefined {
    if (
      !Object.values(AELIQO_DATA_REFS).some(
        (ref) => ref.id === node.manifest.id && ref.revision === node.manifest.revision,
      )
    )
      return undefined;
    const current = resultFor(node, this.results);
    if (current === undefined || node.result === undefined) return html`<p part="status">Data unavailable.</p>`;
    const entity = node.config.ports.find((port) => port.payload === 'selection')?.entity;
    const rendered = renderAeliqoDataPresentationNode(
      node,
      {
        result: node.result,
        rows: current.rows,
        ...(current.columns === undefined ? {} : { columns: current.columns }),
        ...(current.scope === undefined ? {} : { scope: current.scope }),
      },
      {
        ...(this.interaction === undefined ? {} : { interaction: this.interaction }),
        onRequest: (request) => {
          if (request.kind === 'selection' || request.kind === 'filter')
            this.emitFoundation(node, request.portId, request.payload);
          else this.onDataRequest?.(request);
        },
      },
      { resolveEntity: () => entity },
    );
    return rendered === nothing ? html`<p part="status">Data unavailable.</p>` : rendered;
  }

  private emitFoundation(
    node: ValidatedPresentation['nodes'][number],
    portId: string,
    payload: InteractionPayload,
  ): void {
    if (!node.config.ports.some((port) => port.id === portId && port.payload === payload.kind)) return;
    this.onSemanticInteraction?.({ nodeId: node.node.id, portId, payload });
  }

  private renderTable(
    resolved: ValidatedPresentation['nodes'][number],
    values: Record<string, unknown>,
  ): TemplateResult {
    const bound = resultFor(resolved, this.results);
    const columns = tableConfigColumns(values, resultColumns(resolved, bound));
    const selection = tableSelectionMode(values.selection);
    const nodeId = resolved.node.id;
    const selectedKeys = getSelectionKeys(nodeId, this.interaction);
    const result = resolved.result?.ref;
    const selectionPort = resolved.config.ports.find((candidate) => candidate.payload === 'selection');
    const entity = selectionPort?.entity ?? 'row';
    const display = tableDisplayState(resolved, bound);
    return html`<aeliqo-table
      data-aeliqo-node-id=${nodeId}
      data-aeliqo-theme="inherit"
      .columns=${columns}
      .rows=${bound?.rows ?? []}
      .caption=${text(values.caption)}
      .emptyLabel=${display.emptyLabel}
      .entity=${entity}
      .identity=${resolved.result?.identity ?? []}
      .selection=${selection}
      .selectedKeys=${selectedKeys}
      .result=${result}
      .scope=${bound?.scope}
      .status=${display.status}
      .message=${display.message}
      @aeliqo-table-selection=${(event: Event) => this.handleTableSelection(event, resolved)}
    ></aeliqo-table>`;
  }

  private renderTrend(
    resolved: ValidatedPresentation['nodes'][number],
    values: Record<string, unknown>,
  ): TemplateResult {
    const bound = resultFor(resolved, this.results);
    const labelField = text(values.labelField);
    const seriesBy = Array.isArray(values.seriesBy)
      ? values.seriesBy.flatMap((value) => (typeof value === 'string' ? [value] : []))
      : [];
    const rawSeries = Array.isArray(values.series) ? values.series : [];
    const rows = bound?.rows ?? [];
    const series: AeliqoChartSeries[] = rawSeries.flatMap((item) => {
      const candidate = record(item);
      if (candidate === undefined) return [];
      const field = text(candidate.field);
      if (field.length === 0) return [];
      const label = text(candidate.label, field);
      const unit = text(candidate.unit);
      const groups = new Map<
        string,
        {
          readonly values: readonly unknown[];
          readonly rows: { readonly row: AeliqoTableRow; readonly index: number; readonly time: number }[];
        }
      >();
      rows.forEach((row, index) => {
        const values = seriesBy.map((groupField) => row[groupField]);
        const key = JSON.stringify(values);
        const group = groups.get(key);
        const time = temporalTime(row[labelField]);
        if (group === undefined) groups.set(key, { values, rows: [{ row, index, time: time ?? Number.NaN }] });
        else group.rows.push({ row, index, time: time ?? Number.NaN });
      });
      return [...groups.entries()].map(([groupKey, group]) => {
        const ordered = [...group.rows].sort((left, right) =>
          Number.isNaN(left.time) || Number.isNaN(right.time)
            ? left.index - right.index
            : left.time - right.time || left.index - right.index,
        );
        const suffix =
          group.values.length === 0
            ? ''
            : ` · ${group.values.map((value) => (value === null || value === undefined ? '—' : String(value))).join(' · ')}`;
        const points = ordered.map(({ row, time }) => {
          const sourceValue = row[field];
          const value = Number.isNaN(time) ? Number.NaN : numericValue(sourceValue);
          const displayValue = decimalText(sourceValue);
          const sourceTime = row[labelField];
          return {
            label: temporalLabel(row[labelField]),
            // Keep the source instant text so the chart can retain canonical
            // sub-millisecond identity; Date.parse is only used for ordering.
            ...(Number.isNaN(time) ? {} : { x: typeof sourceTime === 'string' ? sourceTime : time }),
            value,
            ...(displayValue === undefined ? {} : { displayValue }),
          };
        });
        return {
          id: `${field}:${groupKey}`,
          label: `${label}${suffix}`,
          ...(unit.length === 0 ? {} : { unit }),
          points,
        };
      });
    });
    return html`<aeliqo-chart
      data-aeliqo-node-id=${resolved.node.id}
      data-aeliqo-theme="inherit"
      .title=${text(values.title, 'Trend')}
      .summary=${trendSummary(bound, resolved.result)}
      .scope=${scopeText(bound?.scope) ?? ''}
      .series=${series}
      .points=${series[0]?.points ?? []}
    ></aeliqo-chart>`;
  }

  private renderFilter(
    resolved: ValidatedPresentation['nodes'][number],
    values: Record<string, unknown>,
  ): TemplateResult {
    const field = text(values.field);
    const current = getFilterValue(resolved.node.id, field, this.interaction);
    return html`<aeliqo-text-field
      data-aeliqo-node-id=${resolved.node.id}
      data-aeliqo-theme="inherit"
      .label=${getFieldLabel(resolved, field)}
      .description=${text(values.placeholder)}
      .value=${current}
      @aeliqo-input-change=${(event: Event) => this.handleFilter(event, resolved, values)}
    ></aeliqo-text-field>`;
  }

  private handleTableSelection(event: Event, resolved: ValidatedPresentation['nodes'][number]): void {
    try {
      const detail = tableSelectionDetail(event);
      if (detail === undefined) return;
      const port = resolved.config.ports.find((candidate) => candidate.payload === 'selection');
      if (port === undefined) return;
      const request = this.tableSelectionRequest(detail, resolved, port);
      if (request !== undefined) this.emit(request);
    } catch {
      // Custom events are an untrusted boundary; malformed details are ignored.
    }
  }

  private tableSelectionRequest(
    detail: AeliqoTableSelectionDetail,
    resolved: ValidatedPresentation['nodes'][number],
    port: ValidatedPresentation['nodes'][number]['config']['ports'][number],
  ): AeliqoSemanticInteractionRequest | undefined {
    if (detail.mode === 'clear') {
      if (detail.entity !== port.entity) return undefined;
      return {
        nodeId: resolved.node.id,
        portId: port.id,
        payload: { kind: 'selection', selection: { mode: 'clear' } },
      };
    }
    if (detail.result === undefined || !this.selectionMatchesResult(detail, resolved, port)) return undefined;
    return {
      nodeId: resolved.node.id,
      portId: port.id,
      payload: {
        kind: 'selection',
        selection: {
          mode: 'ids',
          entity: detail.entity,
          keys: [...detail.keys] as [string, ...string[]],
          result: detail.result,
        },
      },
    };
  }

  private selectionMatchesResult(
    detail: AeliqoTableSelectionDetail,
    resolved: ValidatedPresentation['nodes'][number],
    port: ValidatedPresentation['nodes'][number]['config']['ports'][number],
  ): boolean {
    if (detail.entity !== port.entity || detail.result === undefined || resolved.result === undefined) return false;
    if (refKey(detail.result) !== refKey(resolved.result.ref) || detail.keys.length === 0) return false;
    const bound = resultFor(resolved, this.results);
    if (bound === undefined) return false;
    const allowed = new Set(
      bound.rows
        .map((row) => stableTableRowKey(row, port.identity ?? []))
        .filter((key): key is string => key !== undefined),
    );
    return detail.keys.length === new Set(detail.keys).size && detail.keys.every((key) => allowed.has(key));
  }

  private handleFilter(
    event: Event,
    resolved: ValidatedPresentation['nodes'][number],
    values: Record<string, unknown>,
  ): void {
    try {
      const detail = inputChangeDetail(event);
      if (detail === undefined) return;
      const field = text(values.field);
      const outputId = text(values.outputId);
      const port = filterPort(resolved, field, outputId);
      if (port === undefined) return;
      const predicate = filterPredicates(values, field, detail.value);
      const payload: InteractionPayload = { kind: 'filter', predicates: predicate, outputId };
      this.emit({ nodeId: resolved.node.id, portId: port.id, payload });
    } catch {
      // Custom events are an untrusted boundary; malformed details are ignored.
    }
  }

  private emit(request: AeliqoSemanticInteractionRequest): void {
    this.onSemanticInteraction?.(request);
  }

  static readonly styles = [
    aeliqoThemeStyles,
    css`
      :host {
        color: var(--aeliqo-color-text, #18202a);
        display: block;
      }
      [part='region'] {
        display: block;
        min-inline-size: 0;
      }
      [part='stack'] {
        display: flex;
        flex-direction: column;
        min-inline-size: 0;
      }
      [part='unsupported'] {
        color: var(--aeliqo-color-muted, #495464);
      }
    `,
  ];
}

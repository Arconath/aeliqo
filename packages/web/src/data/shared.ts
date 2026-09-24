import { css, html, nothing, type TemplateResult } from 'lit';
import { scalarIdentity } from '@aeliqo/core';
import type { Result } from '@aeliqo/core';
import type { AeliqoDataRecord, AeliqoDataScope, AeliqoDataStatus, AeliqoDataValue } from './types.js';

/** Materialized observations remain readable even when population coverage is unknown. */
export function materializedDataStatus(result: Result): AeliqoDataStatus {
  return result.coverage.kind === 'partial' || result.coverage.kind === 'sample' ? 'partial' : 'ready';
}

/** Stable, typed identity encoding. It deliberately excludes render position. */
export function stableDataValueKey(value: AeliqoDataValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return 'null:';
  if (typeof value === 'string') return `string:${value.length}:${value}`;
  if (typeof value === 'boolean') return `boolean:${value ? 'true' : 'false'}`;
  if (typeof value === 'number') return finiteNumberKey(value);
  return decimalValueKey(value);
}

function finiteNumberKey(value: number): string | undefined {
  return Number.isFinite(value) ? `number:${String(value)}` : undefined;
}

function decimalValueKey(value: AeliqoDataValue): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  if (Object.keys(value).length !== 1 || typeof value.decimal !== 'string') return undefined;
  const identity = scalarIdentity(value, { value: 'decimal', nullable: false });
  if (!identity.ok) return undefined;
  return `decimal:${identity.value}`;
}

export function stableDataRecordKey(record: AeliqoDataRecord, identity: readonly string[]): string | undefined {
  if (identity.length === 0) return undefined;
  const keys = identity.map((field) => stableDataValueKey(record[field]));
  if (keys.some((key) => key === undefined)) return undefined;
  return keys.length === 1 ? keys[0] : JSON.stringify(keys);
}

export function dataValueText(value: AeliqoDataValue | undefined, missing = '—'): string {
  if (value === undefined || value === null) return missing;
  if (typeof value === 'object' && !Array.isArray(value) && typeof value.decimal === 'string') return value.decimal;
  return String(value);
}

const statusCopy: Record<'en' | 'id', Record<AeliqoDataStatus, string | undefined>> = {
  en: {
    loading: 'Loading…',
    empty: 'No data to display.',
    partial: 'Showing a partial result.',
    stale: 'This result may be out of date.',
    error: 'The data could not be loaded.',
    unavailable: 'Value unavailable.',
    ready: undefined,
  },
  id: {
    loading: 'Memuat…',
    empty: 'Tidak ada data untuk ditampilkan.',
    partial: 'Menampilkan hasil sebagian.',
    stale: 'Hasil ini mungkin sudah kedaluwarsa.',
    error: 'Data tidak dapat dimuat.',
    unavailable: 'Nilai tidak tersedia.',
    ready: undefined,
  },
};

export function dataStatusMessage(status: AeliqoDataStatus, message?: string, locale?: string): string | undefined {
  if (message !== undefined && message.length > 0) return message;
  return statusCopy[/^id(?:-|$)/i.test(locale ?? '') ? 'id' : 'en'][status];
}

function scopeCountText(scope: AeliqoDataScope, indonesian: boolean): string | undefined {
  const total = scope.filteredTotal ?? scope.populationTotal;
  const population = scope.filteredTotal === undefined ? 'population' : 'matching';
  if (scope.loaded !== undefined && total !== undefined) {
    if (indonesian)
      return `${scope.loaded.toLocaleString('id-ID')} dari ${total.toLocaleString('id-ID')} rekaman ${scope.filteredTotal === undefined ? 'populasi' : 'yang cocok'} dimuat`;
    return `${scope.loaded.toLocaleString()} of ${total.toLocaleString()} ${population} records loaded`;
  }
  if (scope.loaded !== undefined)
    return indonesian
      ? `${scope.loaded.toLocaleString('id-ID')} rekaman dimuat`
      : `${scope.loaded.toLocaleString()} loaded records`;
  if (total === undefined) return undefined;
  return indonesian
    ? `${total.toLocaleString('id-ID')} rekaman ${scope.filteredTotal === undefined ? 'populasi' : 'yang cocok'}`
    : `${total.toLocaleString()} ${population} records`;
}

export function scopeText(scope: AeliqoDataScope | undefined, locale?: string): string | undefined {
  if (scope === undefined) return undefined;
  const indonesian = /^id(?:-|$)/i.test(locale ?? '');
  const parts: string[] = [];
  if (scope.label) parts.push(scope.label);
  if (scope.kind === 'sample') parts.push(indonesian ? 'Sampel terbatas' : 'Bounded sample');
  if (scope.kind === 'unknown') parts.push(indonesian ? 'Cakupan tidak diketahui' : 'Scope unknown');
  const count = scopeCountText(scope, indonesian);
  if (count !== undefined) parts.push(count);
  return parts.length === 0 ? undefined : parts.join('; ');
}

export function statusTemplate(status: AeliqoDataStatus, message?: string): TemplateResult | typeof nothing {
  const text = dataStatusMessage(status, message);
  if (text === undefined) return nothing;
  const kind = status === 'error' || status === 'unavailable' ? 'error' : status;
  return html`<p part="status" class=${kind} role=${status === 'loading' ? 'status' : 'alert'}>${text}</p>`;
}

export const dataStyles = css`
  :host {
    box-sizing: border-box;
    color: var(--aeliqo-color-text, #18202a);
    display: block;
    max-inline-size: 100%;
  }
  :host,
  :host * {
    box-sizing: border-box;
  }
  [part='status'] {
    background: var(--_aeliqo-info-subtle, var(--aeliqo-color-surface, #f8fafc));
    border-inline-start: 0.1875rem solid var(--aeliqo-color-info, #1d4ed8);
    border-radius: var(--aeliqo-radius-small, 0.375rem);
    color: var(--aeliqo-color-info, #1d4ed8);
    margin: var(--aeliqo-space-8, 0.5rem) 0 0;
    padding: var(--aeliqo-space-8, 0.5rem) var(--aeliqo-space-12, 0.75rem);
    overflow-wrap: anywhere;
  }
  [part='status'].error {
    background: var(--_aeliqo-danger-subtle, var(--aeliqo-color-surface, #f8fafc));
    border-inline-start-color: var(--aeliqo-color-danger, #b91c1c);
    color: var(--aeliqo-color-danger, #b91c1c);
  }
  [part='status'].partial,
  [part='status'].stale {
    background: var(--_aeliqo-warning-subtle, var(--aeliqo-color-surface, #f8fafc));
    border-inline-start-color: var(--aeliqo-color-warning, #854d0e);
    color: var(--aeliqo-color-warning, #854d0e);
  }
  :is(button, input, select, [part='number']):focus-visible {
    outline: var(--aeliqo-focus-width, 0.1875rem) solid var(--aeliqo-color-focus, #4338ca);
    outline-offset: var(--aeliqo-focus-offset, 0.125rem);
    box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--aeliqo-color-focus, #4338ca) 16%, transparent);
  }
  button:not(:disabled):hover {
    background: var(--_aeliqo-accent-subtle, var(--aeliqo-color-surface, #f8fafc));
    border-color: var(--aeliqo-color-accent, #4338ca);
    color: var(--aeliqo-color-accent, #4338ca);
  }
  button:disabled {
    background: var(--aeliqo-color-surface, #f8fafc);
    border-color: var(--_aeliqo-border-subtle, var(--aeliqo-color-border, #64748b));
    color: var(--aeliqo-color-muted, #4b5563);
    cursor: not-allowed;
  }
  [part='scope'] {
    unicode-bidi: plaintext;
  }
  @media (forced-colors: active) {
    :is(button, input, select, [part='number']):focus-visible {
      outline: 2px solid Highlight;
    }
  }
`;

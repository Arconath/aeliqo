import { scalarIdentity } from '@aeliqo/core';
import type { AeliqoTableRow, TableCell } from '../types.js';

function cellKey(value: TableCell | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return 'null:';
  if (typeof value === 'string') return `string:${value.length}:${value}`;
  if (typeof value === 'boolean') return `boolean:${value ? 'true' : 'false'}`;
  if (typeof value === 'number') return numberKey(value);
  return decimalKey(value);
}

function numberKey(value: number): string | undefined {
  return Number.isFinite(value) ? `number:${String(value)}` : undefined;
}

function decimalKey(value: TableCell): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  if (Object.keys(value).length !== 1 || typeof value.decimal !== 'string') return undefined;
  const identity = scalarIdentity(value, { value: 'decimal', nullable: false });
  return identity.ok ? `decimal:${identity.value}` : undefined;
}

/** Encode row identities without ever using a rendered row index. */
export function stableTableRowKey(row: AeliqoTableRow, identity: readonly string[]): string | undefined {
  if (identity.length === 0) return undefined;
  const encoded = identity.map((field) => cellKey(row[field]));
  if (encoded.some((value) => value === undefined)) return undefined;
  return encoded.length === 1 ? encoded[0] : JSON.stringify(encoded);
}

export function tableIdentityLabel(row: AeliqoTableRow, identity: readonly string[]): string {
  const values = identity.map((field) => row[field]).filter((value): value is TableCell => value !== undefined);
  return values.map(tableCellText).join(' · ') || 'row';
}

function tableCellText(value: TableCell): string {
  if (value === null) return '—';
  if (typeof value === 'object' && !Array.isArray(value) && typeof value.decimal === 'string') return value.decimal;
  return String(value);
}

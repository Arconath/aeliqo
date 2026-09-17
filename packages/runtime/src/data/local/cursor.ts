import { canonical } from './shared.js';

export interface CursorValue {
  readonly kind: 'catalog' | 'data';
  readonly catalogRevision?: string;
  readonly target?: string;
  readonly queryDigest?: string;
  readonly scopeDigest?: string;
  readonly policyRevision?: string;
  readonly sourceRevision?: string;
  readonly offset: number;
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function decodeBase64(value: string): string | undefined {
  try {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const padded = value.replaceAll('-', '+').replaceAll('_', '/') + padding;
    const bytes = binaryBytes(globalThis.atob(padded));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function binaryBytes(binary: string): Uint8Array {
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeCursor(value: CursorValue): string {
  return encodeBase64(canonical(value));
}

export function decodeCursor(value: string): CursorValue | undefined {
  const text = decodeBase64(value);
  if (text === undefined) return undefined;
  try {
    return cursorFromJson(JSON.parse(text) as unknown);
  } catch {
    return undefined;
  }
}

function cursorFromJson(value: unknown): CursorValue | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind !== 'catalog' && value.kind !== 'data') return undefined;
  if (!Number.isSafeInteger(value.offset) || (value.offset as number) < 0) return undefined;
  return {
    kind: value.kind,
    offset: value.offset as number,
    ...optionalText(value, 'catalogRevision'),
    ...optionalText(value, 'target'),
    ...optionalText(value, 'queryDigest'),
    ...optionalText(value, 'scopeDigest'),
    ...optionalText(value, 'policyRevision'),
    ...optionalText(value, 'sourceRevision'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionalText(record: Record<string, unknown>, field: keyof CursorValue): Partial<CursorValue> {
  const value = record[field];
  if (typeof value !== 'string') return {};
  return { [field]: value };
}

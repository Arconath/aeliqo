import { parseWireValue, WIRE_LIMITS, type Diagnostic, type Outcome, type VersionRef } from '@aeliqo/core';
import type { AgentCapabilityTransport } from './types.js';

export function failure<T>(code: string, message: string, path?: readonly (string | number)[]): Outcome<T> {
  return {
    ok: false,
    diagnostics: [{ code, message, retryable: false, ...(path === undefined ? {} : { path: [...path] }) }],
  };
}

export function diagnostic(code: string, message: string, path?: readonly (string | number)[]): Diagnostic {
  return { code, message, retryable: false, ...(path === undefined ? {} : { path: [...path] }) };
}

export function validId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= WIRE_LIMITS.id &&
    !/[\s\u0000-\u001f\u007f]/u.test(value)
  );
}

export function validText(value: unknown, max: number = WIRE_LIMITS.text): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

export function utf8Bytes(value: unknown): number | undefined {
  try {
    const inspected = parseWireValue(value);
    if (!inspected.ok) return undefined;
    const encoded = JSON.stringify(inspected.value);
    return encoded === undefined ? undefined : new TextEncoder().encode(encoded).byteLength;
  } catch {
    return undefined;
  }
}

export function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
    .join(',')}}`;
}

const FORBIDDEN_AUTHORITY_KEYS = new Set([
  'actor',
  'approved',
  'approval',
  'grant',
  'grants',
  'principal',
  'principalKey',
  'permission',
  'permissions',
  'credential',
  'credentials',
  'authorization',
  'token',
]);

/** Wire input is data. Reject authority-shaped keys before a handler can read them. */
export function containsAuthorityClaim(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsAuthorityClaim);
  const object = value as Record<string, unknown>;
  return Object.entries(object).some(
    ([key, child]) => FORBIDDEN_AUTHORITY_KEYS.has(key) || containsAuthorityClaim(child),
  );
}

export function sameRef(left: VersionRef, right: VersionRef): boolean {
  return left.id === right.id && left.revision === right.revision;
}

export function normalizeTransport(input: unknown): AgentCapabilityTransport {
  if (input === 'manual' || input === 'mcp' || input === 'webmcp' || input === 'byok' || input === 'direct')
    return input;
  return 'direct';
}

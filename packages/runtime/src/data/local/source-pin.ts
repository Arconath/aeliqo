import type { DataService } from '../types.js';

export type SourceRevisionPin =
  { readonly kind: 'absent' } | { readonly kind: 'current'; readonly value: string } | { readonly kind: 'invalid' };

export function readSourceRevisionPin(data: DataService): SourceRevisionPin {
  try {
    if (!('sourceRevision' in data)) return { kind: 'absent' };
    const value: unknown = (data as DataService & { readonly sourceRevision?: unknown }).sourceRevision;
    return typeof value === 'string' && value.length > 0 ? { kind: 'current', value } : { kind: 'invalid' };
  } catch {
    return { kind: 'invalid' };
  }
}

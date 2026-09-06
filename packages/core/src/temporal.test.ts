import { describe, expect, it } from 'vitest';
import { formatTemporalValue, parseTemporalValue } from './temporal';
describe('explicit temporal meaning', () => {
  it('preserves legacy ISO month coordinates and explicit month-grain labels', () => {
    expect(parseTemporalValue('2026-01')).toBe(Date.UTC(2026, 0, 1));
    expect(parseTemporalValue('2026-02', { temporal: 'month' })).toBe(Date.UTC(2026, 1, 1));
    expect(formatTemporalValue(Date.UTC(2026, 1, 1), { temporal: 'month' })).toBe('2026-02');
    expect(parseTemporalValue('2026-00')).toBeNull();
    expect(parseTemporalValue('2026-13', { temporal: 'month' })).toBeNull();
    expect(parseTemporalValue('2026-01-01', { temporal: 'month' })).toBeNull();
    expect(parseTemporalValue('2026-01', { temporal: 'date' })).toBeNull();
  });
  it('accepts real calendar dates without timezone drift, including leap years', () => {
    expect(parseTemporalValue('2024-02-29')).toBe(Date.UTC(2024, 1, 29));
    for (const date of ['2023-02-29', '2024-04-31', '2024-13-01', '2024-00-01', '2024-1-01', '2024-01-00', 'not a date']) expect(parseTemporalValue(date)).toBeNull();
    expect(formatTemporalValue(parseTemporalValue('0099-01-01')!)).toBe('0099-01-01');
  });
  it('requires an explicit instant offset and compares equivalent instants', () => {
    const field = { temporal: 'instant' } as const;
    expect(parseTemporalValue('2026-09-06T07:00:00+07:00', field)).toBe(parseTemporalValue('2026-09-06T00:00:00Z', field));
    expect(formatTemporalValue(parseTemporalValue('2026-09-06T07:00:00+07:00', field)!, field)).toBe('2026-09-06T00:00:00.000Z');
    for (const value of ['2026-09-06', '2026-09-06T00:00:00', '2026-02-30T00:00:00Z', '2026-09-06T24:00:00Z', '2026-09-06T00:60:00Z', '2026-09-06T00:00:60Z', '2026-09-06T00:00:00+25:00', '2026-09-06T00:00:00+00:60']) expect(parseTemporalValue(value, field)).toBeNull();
  });
  it('does not infer instant meaning from a string or accept arbitrary numeric coordinates', () => {
    expect(parseTemporalValue('2026-09-06T00:00:00Z')).toBeNull();
    expect(parseTemporalValue(123)).toBeNull();
    expect(parseTemporalValue(null)).toBeNull();
    expect(formatTemporalValue(Infinity)).toBe('—');
    expect(formatTemporalValue(Number.MAX_VALUE)).toBe('—');
  });
  it('handles DST offset differences without inventing a timezone or calendar grouping', () => {
    const field = { temporal: 'instant' } as const;
    const earlier = parseTemporalValue('2026-11-01T01:30:00-04:00', field)!;
    const later = parseTemporalValue('2026-11-01T01:30:00-05:00', field)!;
    expect(later - earlier).toBe(3_600_000);
  });
});

/** Date coordinates and instant labels use UTC. Calendar grouping in an IANA timezone is not implemented. */
export interface TemporalPolicy { readonly temporal?: 'month' | 'date' | 'instant' }
function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4)), month = Number(value.slice(5, 7)), day = Number(value.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const length = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return length !== undefined && day >= 1 && day <= length;
}
/** Legacy undeclared timeFields accept ISO month/date values; no field-name or locale inference. */
export function parseTemporalValue(value: unknown, field: TemporalPolicy = {}): number | null {
  if (typeof value !== 'string') return null;
  if (field.temporal === 'month' || (field.temporal === undefined && /^\d{4}-\d{2}$/.test(value))) return /^\d{4}-\d{2}$/.test(value) && validDate(`${value}-01`) ? Date.parse(`${value}-01T00:00:00Z`) : null;
  if (field.temporal === undefined || field.temporal === 'date') return validDate(value) ? Date.parse(`${value}T00:00:00Z`) : null;
  if (field.temporal !== 'instant') return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match || !validDate(match[1]!) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59 || (match[5] !== 'Z' && (Number(match[6]) > 23 || Number(match[7]) > 59))) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function formatTemporalValue(value: number, field: TemporalPolicy = {}): string {
  if (!Number.isFinite(value)) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  const iso = date.toISOString();
  return field.temporal === 'instant' ? iso : iso.slice(0, field.temporal === 'month' ? 7 : 10);
}

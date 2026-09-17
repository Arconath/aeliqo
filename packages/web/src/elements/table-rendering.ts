import { nothing } from 'lit';
import type { AeliqoDataStatus, AeliqoSortState } from '../data/types.js';

export function sortDescription(
  active: boolean,
  direction: AeliqoSortState['direction'] | undefined,
  sortable: boolean,
) {
  if (!active) return sortable ? 'none' : nothing;
  return direction === 'asc' ? 'ascending' : 'descending';
}

export function sortIndicator(active: boolean, direction: AeliqoSortState['direction'] | undefined): string {
  if (!active) return '';
  return direction === 'asc' ? ' ↑' : ' ↓';
}

export function displaysTableStatus(status: AeliqoDataStatus): boolean {
  return (
    status === 'loading' || status === 'partial' || status === 'stale' || status === 'error' || status === 'unavailable'
  );
}

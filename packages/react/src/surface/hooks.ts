import { useCallback, useSyncExternalStore } from 'react';
import type { SurfaceController, SurfaceSnapshot } from '@aeliqo/runtime/surfaces';

/** Reads a real controller snapshot without a global context broadcast. */
export function useSurfaceState<I, S, T>(
  surface: SurfaceController<I, S>,
  selector: (snapshot: SurfaceSnapshot<I, S>) => T,
): T {
  const subscribe = useCallback((listener: () => void) => surface.subscribe(listener), [surface]);
  const snapshot = useCallback(() => selector(surface.getSnapshot()), [selector, surface]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

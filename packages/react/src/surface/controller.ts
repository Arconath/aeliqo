import { useEffect, useRef, useState } from 'react';
import type { Intent } from '@aeliqo/core';
import type { DataSurfaceRequest, RequestResult, SurfaceController, SurfaceRequest } from '@aeliqo/runtime/surfaces';
import type { DataRecord } from '@aeliqo/runtime/data';
import { useLocalDataSurface, type LocalDataSurface, type LocalDataSurfaceOptions } from './local.js';

/** A host-owned factory. Keep this object stable with `useMemo` or module scope. */
export interface SurfaceControllerFactory<I, S> {
  create(): SurfaceController<I, S>;
}

export interface UseSurfaceOptions<I, S> {
  readonly factory: SurfaceControllerFactory<I, S>;
  /** Runs only after the factory has created a controller in committed lifecycle. */
  readonly initialRequest?: SurfaceRequest<I>;
  readonly onRequestResult?: (result: RequestResult) => void;
}

export interface UseDataSurfaceOptions<S> {
  readonly factory: SurfaceControllerFactory<Intent, S>;
  readonly initialRequest?: DataSurfaceRequest;
  readonly onRequestResult?: (result: RequestResult) => void;
}

/**
 * Owns a controller created by an injected factory after commit. It returns
 * `undefined` until that effect runs, so interrupted render cannot leak a
 * runtime registration or request. The hook disposes only controllers it made.
 */
function useInjectedSurface<I, S>(options: UseSurfaceOptions<I, S> | undefined): SurfaceController<I, S> | undefined {
  const [surface, setSurface] = useState<SurfaceController<I, S>>();
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    let active = true;
    if (options === undefined) return;
    const controller = options.factory.create();
    const abort = new AbortController();
    setSurface(controller);
    const initial = latest.current?.initialRequest;
    if (initial !== undefined)
      void controller.request(initial, { signal: abort.signal }).then(
        (result) => {
          if (active) latest.current?.onRequestResult?.(result);
        },
        () => undefined,
      );
    return () => {
      active = false;
      abort.abort();
      controller.dispose();
    };
  }, [options?.factory]);
  return surface;
}

export function useSurface<I, S>(options: UseSurfaceOptions<I, S>): SurfaceController<I, S> | undefined {
  return useInjectedSurface(options);
}

/** Providerless data adapter over the same effect-owned controller lifecycle. */
export function useDataSurface<Row extends DataRecord>(options: LocalDataSurfaceOptions<Row>): LocalDataSurface<Row>;
export function useDataSurface<S>(options: UseDataSurfaceOptions<S>): SurfaceController<Intent, S> | undefined;
export function useDataSurface<Row extends DataRecord, S>(
  options: LocalDataSurfaceOptions<Row> | UseDataSurfaceOptions<S>,
): LocalDataSurface<Row> | SurfaceController<Intent, S> | undefined {
  const injected = useInjectedSurface('factory' in options ? options : undefined);
  const local = useLocalDataSurface('data' in options ? options : undefined);
  return 'factory' in options ? injected : local;
}

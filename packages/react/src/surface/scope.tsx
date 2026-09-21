import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import type { ScopeController, ScopeSnapshot } from '@aeliqo/runtime/scopes';

const AeliqoScopeContext = createContext<ScopeController | undefined>(undefined);

export interface AeliqoScopeProps extends PropsWithChildren {
  /** An application-owned scope. This component attaches it but never disposes it. */
  readonly scope: ScopeController;
}

/** Makes one host-created scope available to React descendants. */
export function AeliqoScope({ scope, children }: AeliqoScopeProps): React.JSX.Element {
  useEffect(() => scope.attach(), [scope]);
  return <AeliqoScopeContext.Provider value={scope}>{children}</AeliqoScopeContext.Provider>;
}

export function useAeliqoScope(): ScopeController {
  const scope = useContext(AeliqoScopeContext);
  if (scope === undefined) throw new Error('Aeliqo surface hooks require an AeliqoScope.');
  return scope;
}

/** Subscribes to an immutable host-owned scope snapshot with a narrow selector. */
export function useAeliqoScopeState<T>(selector: (snapshot: ScopeSnapshot) => T): T {
  const scope = useAeliqoScope();
  const subscribe = useCallback((listener: () => void) => scope.subscribe(listener), [scope]);
  const snapshot = useCallback(() => selector(scope.getSnapshot()), [scope, selector]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

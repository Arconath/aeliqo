import React, { createContext, useContext, type PropsWithChildren } from 'react';
import type { AeliqoApp } from '@aeliqo/web/app';

const AeliqoAppContext = createContext<AeliqoApp | undefined>(undefined);

export interface AeliqoProviderProps extends PropsWithChildren {
  readonly app: AeliqoApp;
}

/** Shares one application-owned Aeliqo instance. The provider never disposes an instance it did not create. */
export function AeliqoProvider({ app, children }: AeliqoProviderProps): React.JSX.Element {
  return <AeliqoAppContext.Provider value={app}>{children}</AeliqoAppContext.Provider>;
}

export function useAeliqoApp(): AeliqoApp {
  const app = useContext(AeliqoAppContext);
  if (app === undefined) throw new Error('Aeliqo React bindings require an AeliqoProvider.');
  return app;
}

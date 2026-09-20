import { compileIntent, defineResource, parseCatalog } from '@aeliqo/core';
import { createAeliqoRuntime } from '@aeliqo/runtime';
import { registerAeliqoElements } from '@aeliqo/web';
import { AeliqoProvider } from '@aeliqo/react';
import { createAppToolEndpoint } from '@aeliqo/agent';

export const legacyUsage = [
  compileIntent,
  defineResource,
  parseCatalog,
  createAeliqoRuntime,
  registerAeliqoElements,
  AeliqoProvider,
  createAppToolEndpoint,
];

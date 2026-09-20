import { defineDataFeature, defineFeature, inferLocalDataShape } from '@aeliqo/core/features';
import { createLocalDataBinding } from '@aeliqo/runtime/surfaces';
import type { ScopeController } from '@aeliqo/runtime/scopes';
import { AdaptiveSurface, AeliqoScope, ViewSurface, defineReactViews, useSurfaceState } from '@aeliqo/react/surface';
import { connectAgent, createScopedSurfaceEndpoint } from '@aeliqo/agent/browser';

export const vNextEntries = [
  defineDataFeature,
  defineFeature,
  inferLocalDataShape,
  createLocalDataBinding,
  AdaptiveSurface,
  AeliqoScope,
  ViewSurface,
  defineReactViews,
  useSurfaceState,
  connectAgent,
  createScopedSurfaceEndpoint,
];

export type VNextScope = ScopeController;

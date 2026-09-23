import { defineDataFeature, defineFeature, inferLocalDataShape } from '@aeliqo/core/features';
import { createLocalDataBinding, createLocalDataSurface } from '@aeliqo/runtime/surfaces';
import type { ScopeController } from '@aeliqo/runtime/scopes';
import { AdaptiveSurface, AeliqoScope, ViewSurface, defineReactViews, useSurfaceState } from '@aeliqo/react/surface';
import { connectAgent, createScopedSurfaceEndpoint } from '@aeliqo/agent/browser';
import { useDataSurface } from '@aeliqo/react/surface';

export function LocalPeople({ rows }: { readonly rows: readonly { readonly id: string; readonly name: string }[] }) {
  const surface = useDataSurface({ data: rows, getRowId: (row) => row.id });
  return <AdaptiveSurface surface={surface} />;
}

export const vNextEntries = [
  defineDataFeature,
  defineFeature,
  inferLocalDataShape,
  createLocalDataBinding,
  createLocalDataSurface,
  AdaptiveSurface,
  AeliqoScope,
  ViewSurface,
  defineReactViews,
  useSurfaceState,
  connectAgent,
  createScopedSurfaceEndpoint,
  LocalPeople,
];

export type VNextScope = ScopeController;

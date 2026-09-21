import React from 'react';
import type { VersionRef } from '@aeliqo/core';
import type { SurfaceController, SurfaceSnapshot } from '@aeliqo/runtime/surfaces';
import { useSurfaceState } from './hooks.js';
import type { ReactViewDefinition, ReactViewRegistry } from './types.js';

export interface ViewSurfaceProps<I, S> {
  readonly surface: SurfaceController<I, S>;
  readonly views: ReactViewRegistry<I, S>;
  readonly view: VersionRef;
  readonly fallback?: React.ReactNode;
}

export interface AdaptiveSurfaceProps<I, S> {
  readonly surface: SurfaceController<I, S>;
  readonly views: ReactViewRegistry<I, S>;
  /** The host may select from the explicitly registered native views. */
  readonly selectView?: (
    snapshot: SurfaceSnapshot<I, S>,
    views: readonly ReactViewDefinition<I, S>[],
  ) => VersionRef | undefined;
  readonly fallback?: React.ReactNode;
}

function missingView(fallback: React.ReactNode): React.ReactNode {
  return fallback ?? <p role="alert">The requested native React view is not registered.</p>;
}

function currentSnapshot<I, S>(snapshot: SurfaceSnapshot<I, S>): SurfaceSnapshot<I, S> {
  return snapshot;
}

function NativeView<I, S>({
  surface,
  snapshot,
  definition,
}: {
  readonly surface: SurfaceController<I, S>;
  readonly snapshot: SurfaceSnapshot<I, S>;
  readonly definition: ReactViewDefinition<I, S>;
}): React.JSX.Element {
  const View = definition.render;
  return <View surface={surface} snapshot={snapshot} request={surface.request.bind(surface)} />;
}

/** Renders one explicit application-authored React view in the existing React tree. */
export function ViewSurface<I, S>({ surface, views, view, fallback }: ViewSurfaceProps<I, S>): React.ReactNode {
  const snapshot = useSurfaceState(surface, currentSnapshot);
  const definition = views.resolve(view);
  if (definition === undefined) return missingView(fallback);
  return <NativeView surface={surface} snapshot={snapshot} definition={definition} />;
}

/** Renders a host-selected native view from a bounded registry; it never invents a view. */
export function AdaptiveSurface<I, S>({
  surface,
  views,
  selectView,
  fallback,
}: AdaptiveSurfaceProps<I, S>): React.ReactNode {
  const snapshot = useSurfaceState(surface, currentSnapshot);
  const selected = selectView?.(snapshot, views.views) ?? views.views[0]?.ref;
  const definition = selected === undefined ? undefined : views.resolve(selected);
  if (definition === undefined) return missingView(fallback);
  return <NativeView surface={surface} snapshot={snapshot} definition={definition} />;
}

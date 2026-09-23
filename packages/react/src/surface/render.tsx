import React from 'react';
import type { VersionRef } from '@aeliqo/core';
import { resolvePresentation, type PresentationResolverInput } from '@aeliqo/core/presentation';
import type { SurfaceController, SurfaceSnapshot } from '@aeliqo/runtime/surfaces';
import type { DataRecord } from '@aeliqo/runtime/data';
import { useContainerSize, useSurfaceState } from './hooks.js';
import { LocalAdaptiveSurface, type LocalDataSurface } from './local.js';
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
  /** Trusted host evidence, registry, and candidates for automatic native selection. */
  readonly presentation?: PresentationResolverInput;
  /** The host may select from the explicitly registered native views. */
  readonly selectView?: (
    snapshot: SurfaceSnapshot<I, S>,
    views: readonly ReactViewDefinition<I, S>[],
  ) => VersionRef | undefined;
  readonly fallback?: React.ReactNode;
}

export interface LocalAdaptiveSurfaceProps<Row extends DataRecord> {
  readonly surface: LocalDataSurface<Row>;
}

function sameRef(left: VersionRef, right: VersionRef): boolean {
  return left.id === right.id && left.revision === right.revision;
}

function matchesCommittedTarget<I, S>(
  surface: SurfaceController<I, S>,
  snapshot: SurfaceSnapshot<I, S>,
  input: PresentationResolverInput,
): boolean {
  const publicAddress = snapshot.address;
  const target = input.target.address;
  if (target.runtimeId !== publicAddress.runtimeId || target.scopeInstanceId !== publicAddress.scopeInstanceId)
    return false;
  if (
    target.activationEpoch !== publicAddress.activationEpoch ||
    target.surfaceGeneration !== publicAddress.surfaceGeneration
  )
    return false;
  if (target.surfaceId !== input.context.task.regionId) return false;
  if (surface.presentationEvidence === undefined) return true;
  const committed = surface.presentationEvidence();
  return (
    committed !== undefined &&
    committed.target.address.surfaceId === target.surfaceId &&
    committed.task.id === input.context.task.id &&
    committed.task.revision === input.context.task.revision
  );
}

function resolvedView<I, S>(
  surface: SurfaceController<I, S>,
  snapshot: SurfaceSnapshot<I, S>,
  views: ReactViewRegistry<I, S>,
  input: PresentationResolverInput,
  preference?: VersionRef,
  size?: { readonly inline: number; readonly block: number },
): ReactViewDefinition<I, S> | undefined {
  if (!matchesCommittedTarget(surface, snapshot, input)) return undefined;
  const rendererCapabilities = input.context.rendererCapabilities.filter((ref) => views.resolve(ref) !== undefined);
  const task =
    preference === undefined
      ? input.context.task
      : { ...input.context.task, viewPreference: { representation: preference.id, strength: 'explicit' as const } };
  const decision = resolvePresentation({
    ...input,
    context: {
      ...input.context,
      task,
      rendererCapabilities,
      environment:
        size === undefined
          ? input.context.environment
          : {
              ...input.context.environment,
              inlineSize: { state: 'known', value: size.inline },
              blockSize: { state: 'known', value: size.block },
            },
    },
    target:
      snapshot.phase === 'disposed' || snapshot.phase === 'denied'
        ? { ...input.target, state: 'revoked' }
        : input.target,
  });
  if (decision.status !== 'ready') return undefined;
  const root = decision.plan.plan.nodes.find((node) => node.id === decision.plan.plan.rootId);
  if (root === undefined || (preference !== undefined && !sameRef(root.representation, preference))) return undefined;
  return views.resolve(root.representation);
}

function missingView(fallback: React.ReactNode): React.ReactNode {
  return fallback ?? <p role="alert">The requested native React view is not registered.</p>;
}

function noEligibleView(fallback: React.ReactNode): React.ReactNode {
  return fallback ?? <p role="alert">No eligible native React view is registered for this surface.</p>;
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
  if (snapshot.phase === 'disposed' || snapshot.phase === 'denied') return noEligibleView(fallback);
  const definition = views.resolve(view);
  if (definition === undefined) return missingView(fallback);
  return <NativeView surface={surface} snapshot={snapshot} definition={definition} />;
}

/** Renders an explicitly selected native view; standalone registrations are not automatic candidates. */
function NativeAdaptiveSurface<I, S>({
  surface,
  views,
  presentation,
  selectView,
  fallback,
}: AdaptiveSurfaceProps<I, S>): React.ReactNode {
  const snapshot = useSurfaceState(surface, currentSnapshot);
  const container = useContainerSize(presentation !== undefined);
  const selected = selectView?.(snapshot, views.views);
  if (presentation !== undefined) {
    const definition = resolvedView(surface, snapshot, views, presentation, selected, container.size);
    const content =
      definition === undefined ? (
        noEligibleView(fallback)
      ) : (
        <NativeView surface={surface} snapshot={snapshot} definition={definition} />
      );
    return <div ref={container.ref}>{content}</div>;
  }
  return noEligibleView(fallback);
}

export function AdaptiveSurface<Row extends DataRecord>(props: LocalAdaptiveSurfaceProps<Row>): React.ReactNode;
export function AdaptiveSurface<I, S>(props: AdaptiveSurfaceProps<I, S>): React.ReactNode;
export function AdaptiveSurface<I, S, Row extends DataRecord>(
  props: LocalAdaptiveSurfaceProps<Row> | AdaptiveSurfaceProps<I, S>,
): React.ReactNode {
  if ('views' in props) return <NativeAdaptiveSurface {...props} />;
  return <LocalAdaptiveSurface surface={props.surface} />;
}

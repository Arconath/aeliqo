import type { ComponentType } from 'react';
import type { VersionRef } from '@aeliqo/core';
import type {
  RequestOptions,
  RequestResult,
  SurfaceController,
  SurfaceRequest,
  SurfaceSnapshot,
} from '@aeliqo/runtime/surfaces';

export interface ReactViewProps<I, S> {
  readonly surface: SurfaceController<I, S>;
  readonly snapshot: SurfaceSnapshot<I, S>;
  request(intent: SurfaceRequest<I>, options?: RequestOptions): Promise<RequestResult>;
}

/** Trusted local React code. It is not a wire-renderer registration. */
export interface ReactViewInput<I, S> extends VersionRef {
  readonly render: ComponentType<ReactViewProps<I, S>>;
}

export interface ReactViewDefinition<I, S> {
  readonly ref: VersionRef;
  readonly render: ComponentType<ReactViewProps<I, S>>;
}

export interface ReactViewRegistry<I, S> {
  readonly views: readonly ReactViewDefinition<I, S>[];
  resolve(ref: VersionRef): ReactViewDefinition<I, S> | undefined;
}

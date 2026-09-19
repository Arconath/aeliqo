import type { Intent, Outcome } from '@aeliqo/core';
import type {
  RuntimeRegionState,
  RuntimeRenderInput,
  RuntimeRenderReceipt,
  RuntimeResourceBinding,
} from '../app/types.js';
import type { ResultEvent } from '../results/types.js';
import { SurfaceControllerImpl } from './controller.js';
import { SurfaceRegistry } from './registration.js';
import { createLocalSurfaceScope } from './scope.js';
import type {
  CapabilitySurfaceBindings,
  CreateCapabilitySurfaceInput,
  CreateDataSurfaceInput,
  CreateLocalSurfaceScopeInput,
  DataSurfaceBindings,
  LocalSurfaceScope,
  SurfaceController,
  SurfaceOwnership,
} from './types.js';

type SurfaceInput = CreateDataSurfaceInput<unknown> | CreateCapabilitySurfaceInput<unknown, unknown>;

interface RuntimeSurfacePorts {
  readonly runtimeId: string;
  readonly mount: (
    input: { readonly regionId: string; readonly resourceId: string },
    binding: RuntimeResourceBinding,
  ) => Outcome<RuntimeRegionState>;
  readonly render: (input: RuntimeRenderInput) => Promise<RuntimeRenderReceipt>;
  readonly unmount: (regionId: string) => boolean;
}

export class RuntimeSurfaceFactory {
  private readonly registry: SurfaceRegistry;
  private readonly surfaces = new Set<SurfaceController<unknown, unknown>>();
  private sequence = 0;
  private disposed = false;

  constructor(private readonly ports: RuntimeSurfacePorts) {
    this.registry = new SurfaceRegistry(ports.runtimeId);
  }

  createLocalScope(input?: CreateLocalSurfaceScopeInput): LocalSurfaceScope {
    if (this.disposed) throw new TypeError('The Aeliqo runtime is disposed.');
    return createLocalSurfaceScope(this.ports.runtimeId, input);
  }

  create(input: SurfaceInput): SurfaceController<unknown, unknown> {
    if (this.disposed) throw new TypeError('The Aeliqo runtime is disposed.');
    const registration = this.registry.acquire(input.scope.getSnapshot(), input.id, input.feature);
    const regionId = `surface-${++this.sequence}`;
    let mounted = false;
    try {
      if (input.feature.kind === 'data') {
        const binding = input.bindings as DataSurfaceBindings<unknown>;
        const result = this.ports.mount(
          { regionId, resourceId: input.feature.id },
          { resource: input.feature.resource, data: binding.source.service },
        );
        if (!result.ok) throw new TypeError(result.diagnostics[0].message);
        mounted = true;
      }
      let controller!: SurfaceControllerImpl<unknown, unknown>;
      controller = new SurfaceControllerImpl({
        id: input.id,
        scope: input.scope,
        feature: input.feature,
        bindings: input.bindings as DataSurfaceBindings<unknown> | CapabilitySurfaceBindings<unknown, unknown>,
        ownership: (input.ownership ?? { mode: 'internal' }) as SurfaceOwnership<unknown, unknown>,
        registration,
        initialState: input.bindings.initialState,
        ...(input.feature.kind === 'data' ? { runData: this.dataRunner(input, regionId) } : {}),
        teardown: () => {
          if (mounted) this.ports.unmount(regionId);
          this.surfaces.delete(controller);
        },
      });
      this.surfaces.add(controller);
      return controller;
    } catch (error) {
      if (mounted) this.ports.unmount(regionId);
      registration.release();
      throw error;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const surface of [...this.surfaces]) surface.dispose();
    this.surfaces.clear();
  }

  private dataRunner(input: SurfaceInput, regionId: string) {
    return async (intent: Intent, signal: AbortSignal) => {
      const receipt = await this.ports.render({ regionId, intent, signal });
      if (receipt.status !== 'committed') return { receipt };
      const binding = input.bindings as DataSurfaceBindings<unknown>;
      const state = await binding.source.normalize(resultEvents(receipt), { scope: input.scope.getSnapshot(), signal });
      return { receipt, state };
    };
  }
}

async function* resultEvents(
  receipt: Extract<RuntimeRenderReceipt, { readonly status: 'committed' }>,
): AsyncIterable<ResultEvent> {
  for (const output of receipt.outputs) {
    const snapshot = output.handle.snapshot();
    if (snapshot.descriptor !== undefined) yield { kind: 'descriptor', descriptor: snapshot.descriptor };
    for (const batch of snapshot.batches) yield batch;
    if (
      snapshot.lastEvent !== undefined &&
      snapshot.lastEvent.kind !== 'batch' &&
      snapshot.lastEvent.kind !== 'descriptor'
    )
      yield snapshot.lastEvent;
  }
}

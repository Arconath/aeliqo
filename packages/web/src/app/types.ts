import type {Diagnostic, Intent, Outcome, PresentationEnvironment, ReadonlyJsonValue, ResourceDefinition, Task, ValidatedPresentation} from '@aeliqo/core';
import type {
  AeliqoRuntime,
  AeliqoRuntimeOptions,
  RuntimeRegionState,
  RuntimeRenderReceipt,
  RuntimeUnsubscribe,
} from '@aeliqo/runtime/app';
import type {ActionExecution, ActionOutcome, ActionPreview} from '@aeliqo/runtime/actions';
import type {AeliqoRegionElement} from '../region/aeliqo-region.js';
import type {AeliqoViewDefinition} from '../region/types.js';
import type {RecipeDefinition} from '../recipes/types.js';

export interface AeliqoAppOptions extends AeliqoRuntimeOptions {
  readonly recipes?: readonly RecipeDefinition[];
  readonly views?: readonly AeliqoViewDefinition[];
  /** Trusted host adapter for initial create/edit values. Edit forms require it so stale data is never invented. */
  readonly formState?: AeliqoFormStateAdapter;
  /** Receives user-originated, boundary-validated action lifecycle events. */
  readonly onActionEvent?: (event: AeliqoAppActionEvent) => void | Promise<void>;
}

export type AeliqoAppActionEvent =
  | {readonly state: 'preview'; readonly regionId: string; readonly preview: ActionPreview;
      confirm(): Promise<ActionOutcome<ActionExecution>>; cancel(): boolean}
  | {readonly state: 'executed'; readonly regionId: string; readonly execution: ActionExecution}
  | {readonly state: 'failed'; readonly regionId: string; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]]};

export interface AeliqoFormState {
  readonly values: Readonly<Record<string, ReadonlyJsonValue>>;
  readonly entityRevision: string;
}

export interface AeliqoFormStateRequest {
  readonly regionId: string;
  readonly resource: ResourceDefinition;
  readonly intent: Extract<Intent, {readonly kind: 'create' | 'edit'}>;
  readonly task: Extract<Task, {readonly kind: 'form'}>;
  readonly signal: AbortSignal;
}

export interface AeliqoFormStateAdapter {
  read(request: AeliqoFormStateRequest): Outcome<AeliqoFormState> | Promise<Outcome<AeliqoFormState>>;
}

export interface WebMountInput {
  readonly target: HTMLElement;
  readonly regionId: string;
  readonly resourceId: string;
}

export interface WebRenderInput {
  readonly regionId: string;
  readonly intent: unknown;
  readonly signal?: AbortSignal;
}

export interface RendererReadyReceipt {
  readonly status: 'renderer-ready';
  readonly requestId: string;
  readonly regionId: string;
  readonly runtime: Extract<RuntimeRenderReceipt, {readonly status: 'committed'}>;
  readonly presentation: ValidatedPresentation;
  readonly environment: PresentationEnvironment;
  readonly diagnostics: readonly [];
}

export interface RendererFailureReceipt {
  readonly status: 'unsupported' | 'failed' | 'cancelled' | 'needs-input';
  readonly requestId: string;
  readonly regionId: string;
  /** The trusted runtime evidence remains inspectable even when presentation cannot commit. */
  readonly runtime: Extract<RuntimeRenderReceipt, {readonly status: 'committed'}>;
  readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]];
}

export type WebRenderReceipt = RendererReadyReceipt | Exclude<RuntimeRenderReceipt, {readonly status: 'committed'}>
  | RendererFailureReceipt;

export interface AeliqoApp {
  readonly runtime: AeliqoRuntime;
  mount(input: WebMountInput): {readonly ok: true; readonly value: AeliqoRegionElement} | {readonly ok: false; readonly diagnostics: readonly [Diagnostic, ...Diagnostic[]]};
  render(input: WebRenderInput): Promise<WebRenderReceipt>;
  snapshot(regionId: string): RuntimeRegionState | undefined;
  subscribe(regionId: string, listener: (state: RuntimeRegionState) => void): RuntimeUnsubscribe;
  unmount(regionId: string): boolean;
  dispose(): void;
}

/**
 * DECLARATION-ONLY DESIGN PROBE, NOT AELIQO IMPLEMENTATION.
 * No runtime/network/React is implemented here. Compile with --noEmit.
 * T01 maps these preferred shapes to real public types and consumer tests.
 */
export interface SurfaceAddress {
  readonly runtimeId: string;
  readonly scopeInstanceId: string;
  readonly activationEpoch: number;
  readonly surfaceId: string;
  readonly surfaceGeneration: number;
}
export interface ScopeSelector {
  readonly kind: string;
  readonly id: string;
}
export interface PendingScopeTransition {
  readonly selector: ScopeSelector;
  readonly phase: 'guarding' | 'resolving';
  readonly requestId: string;
}
export interface ScopeSnapshot {
  readonly status: 'idle' | 'resolving' | 'active' | 'denied' | 'disposed';
  readonly selector: ScopeSelector | null; // currently active, never the pending label
  readonly pending?: PendingScopeTransition;
  readonly activationEpoch: number;
  readonly revision: string;
}
export type ScopeChangeResult =
  | { readonly status: 'active'; readonly selector: ScopeSelector; readonly activationEpoch: number }
  | { readonly status: 'needs-input'; readonly diagnosticCode: string; readonly choices: readonly ('save' | 'discard' | 'stay')[] }
  | { readonly status: 'denied' | 'failed' | 'cancelled' | 'stale' | 'disposed'; readonly diagnosticCode: string };
export interface ScopeController {
  getSnapshot(): ScopeSnapshot;
  subscribe(listener: () => void): () => void;
  attach(): () => void;
  requestChange(selector: ScopeSelector, options?: { readonly signal?: AbortSignal }): Promise<ScopeChangeResult>;
  invalidate(reason: 'logout' | 'revoked' | 'expired' | 'external-switch'): void;
  dispose(): void;
}
export type SurfacePhase =
  | 'idle' | 'loading' | 'ready' | 'needs-input'
  | 'unsupported' | 'denied' | 'failed' | 'disposed';
export interface SurfaceSnapshot<I, S> {
  readonly id: string;
  readonly address: SurfaceAddress;
  readonly revision: string;
  readonly phase: SurfacePhase;
  readonly intent: I;
  readonly state: S;
}
export interface RequestOptions {
  readonly signal?: AbortSignal;
  readonly expectedRevision?: string;
  readonly expectedAddress?: SurfaceAddress;
}
export type RequestResult =
  | { readonly status: 'committed'; readonly revision: string }
  | { readonly status: 'proposed'; readonly proposalId: string }
  | { readonly status: 'needs-input'; readonly diagnosticCode: string }
  | { readonly status: 'unsupported' | 'denied' | 'stale' | 'cancelled' | 'disposed' | 'failed'; readonly diagnosticCode: string };
export interface SurfaceController<I, S> {
  readonly id: string;
  readonly address: SurfaceAddress;
  getSnapshot(): SurfaceSnapshot<I, S>;
  subscribe(listener: () => void): () => void;
  request(intent: I, options?: RequestOptions): Promise<RequestResult>;
  dispose(): void;
}
export interface FeatureDefinition<I, S> {
  readonly id: string;
  readonly definitionRevision: string;
  parseIntent(value: unknown): { readonly ok: true; readonly value: I } | { readonly ok: false };
  parseState(value: unknown): { readonly ok: true; readonly value: S } | { readonly ok: false };
}
export type ViewProps<I, S> = { readonly surface: SurfaceController<I, S> };
export interface AgentClient { readonly kind: 'host-agent-client' }
export interface AgentConnection { disconnect(): void }
export declare function connectAgent(input: {
  readonly scope: ScopeController;
  readonly client: AgentClient;
  readonly targets: readonly string[];
}): AgentConnection;
export type PersonIntent =
  | { readonly kind: 'browse'; readonly filter?: { readonly op: 'compare'; readonly field: 'team'; readonly comparison: 'eq'; readonly value: 'Design' | 'Engineering' } }
  | { readonly kind: 'detail'; readonly identity: { readonly id: string } };
export interface PersonState { readonly selection: readonly string[] }

// All inputs are declarations: no fabricated runtime success.
declare const surface: SurfaceController<PersonIntent, PersonState>;
declare const feature: FeatureDefinition<PersonIntent, PersonState>;
declare const scope: ScopeController;
declare const client: AgentClient;
const validView: ViewProps<PersonIntent, PersonState> = { surface };
void validView;
void surface.request({ kind: 'browse', filter: { op: 'compare', field: 'team', comparison: 'eq', value: 'Engineering' } });
void scope.requestChange({ kind: 'workspace', id: 'globex' });
const connection = connectAgent({ scope, client, targets: ['people-main'] });
connection.disconnect();

// @ts-expect-error immutable feature definitions are not surface controllers
const wrongView: ViewProps<PersonIntent, PersonState> = { surface: feature };
void wrongView;
// @ts-expect-error credential-bearing UI props are not part of renderer contract
const wrongCredential: ViewProps<PersonIntent, PersonState> = { surface, apiKey: 'synthetic-only' };
void wrongCredential;
// @ts-expect-error a surface address must not be repointed by a caller
surface.address.activationEpoch = 2;
// @ts-expect-error no ambient scope/target discovery through agent connection
connectAgent({ client });
// @ts-expect-error a scope controller cannot be replaced by a bare workspace ID
connectAgent({ scope: 'globex', client, targets: ['people-main'] });
// @ts-expect-error selection belongs to typed state, not a test-only snapshot property
surface.getSnapshot().selection;
// @ts-expect-error natural-language text is not a typed application intent
void surface.request('show everyone');
// @ts-expect-error unknown business filter values are not silently accepted
void surface.request({ kind: 'browse', filter: { op: 'compare', field: 'team', comparison: 'eq', value: 'NotARegisteredTeam' } });

export function selectionCount(snapshot: SurfaceSnapshot<PersonIntent, PersonState>): number {
  return snapshot.state.selection.length;
}

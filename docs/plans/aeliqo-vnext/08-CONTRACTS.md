# Contract detail and usage — final-v3

This document is normative detail for `01-SPEC.md`, not a second alternative API. Code in this document describes the vNext target and is **not an assertion that these exports exist in 0.4.2**. T01 ports the declaration-only design model in `contracts/contract-probe.ts` to complete consumers of the real packages; later tasks must execute them. Contract compilation is not implementation acceptance.

## 1. The public mental model

A developer primarily needs a surface and, for scoped applications, a scope. A feature is a reusable definition. A runtime is a lifecycle/coordination owner, not the whole application. Source/binding/renderer contracts are disclosed when the application needs them. An agent connects to an explicitly allowed set of surfaces, not to the entire JavaScript object graph.

The final preferred rendering interface is `<AdaptiveSurface surface={surface} />`. Do not alternate it with old `<AdaptiveSurface feature={feature} />` examples: an immutable definition does not identify which live state to operate on. Do not implement another `<Aeliqo {...allProps} />` API as the main contract.

No-AI standalone components are still a first-class adoption path. They need no feature definition or runtime. A semantic surface can use built-ins, native host React components or a headless controller. Existing app header/router/sidebar and high-frequency editor operations need not pass through the runtime.

## 2. Minimal local React consumer

The following is the canonical target example. T01/T10 must make it work from actual installed tarballs without requiring the reader to supply an undeclared runtime, registry, authority, or source.

```tsx
import { AdaptiveSurface, useDataSurface } from '@aeliqo/react/surface';

type Person = { id: string; name: string; team: string };

export function People({ rows }: { rows: readonly Person[] }) {
  const surface = useDataSurface({
    data: rows,
    getRowId: (row) => row.id,
  });

  return <AdaptiveSurface surface={surface} />;
}
```

Contract: rows form a bounded complete local dataset unless the caller explicitly uses a partial/remote binding; browse is the default intent. The helper owns an inert local controller/scope allocation and attaches in committed lifecycle. It generates a stable per-instance display identity when no explicit surface ID is supplied. Identity-dependent entity operations still need stable row identity. Data updates preserve the controller within the same activation; same-reference mutation requires an explicit documented version signal.

The default is a useful browse interface, not an arbitrary chart guess. Without schema, structural inference is bounded and must diagnose empty/ambiguous/heterogeneous input; it cannot infer business units, sums, relationships or permissions. A schema can be added for strict/empty data without changing the controller model. Rendering 25 supplied rows does not establish that an upstream remote source has only 25 rows.

`ViewSurface surface={surface} view="registered-table-id"` is the explicit fixed-view path. Only use real registered IDs from the implementation's manifest, not guessed aliases in docs. A hard pin that is incompatible yields a useful outcome; it is not silently changed by an agent.

## 3. Advanced feature definition and source binding

A pure feature definition can be shared as code:

```ts
import { defineDataFeature } from '@aeliqo/core/features';
import { z } from 'zod';

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  team: z.enum(['Design', 'Engineering']),
});

export const peopleFeature = defineDataFeature({
  id: 'people',
  schema: PersonSchema,
  identity: ['id'],
});
```

A host binding connects that definition to an existing DataService/read port, actions, current authorization and renderer implementation. Reuse `DataService.describe/plan/execute`; a simple callback wrapper is a lowering adapter, not another query engine. Share schema and capability **definitions**, not authenticated connections or live records at module scope.

The binding does not simply declare `aggregate: true`. It identifies supported fields/operators, keyset or snapshot pagination, order/tie-breaker, registered metrics and the authority boundary. Query and result normalization return unsupported rather than silently emulate unavailable server functionality. The backend must authorize the selected tenant and target for each relevant request even when the frontend binding is well typed.

React view implementations stay in a native React adapter. Core sees manifest references/config schemas and explicit typed event ports, never React elements, module strings supplied by a model, or arbitrary executable handlers from the network.

## 4. Scope controller and advanced provider

`ScopeSelector` is `{kind, id}` with optional parent lineage in the host binding. It is a selector, not permission evidence. `ScopeController` owns active lifecycle state. The host's `ScopeBinding` resolves a selector through authenticated membership/policy and performs leave-guard interactions. Backend authorization remains authoritative; browser membership data is display/lifecycle input only.

Canonical creation contract (runtime method names are reconciled with existing exports once in T01):

- `runtime.createScope({binding, initial})`: create inert scope coordination with a declared initial selector; active server/local snapshots may be adopted only under the host's appropriate boundary.
- `scope.attach()`: begin owned effects and initial resolution, returns an idempotent detach function. No observer/timer/network on construction alone.
- `scope.getSnapshot()` and `scope.subscribe(listener)`: stable immutable state and cleanup.
- `scope.requestChange(selector, {signal?})`: voluntary transition with registered dirty-work guard. The promise awaits the host's ordinary guard UI and target membership resolution; it does not treat showing the dialog as permission. If a dirty surface has no usable guard UI, return `needs-input` with a diagnostic and keep A active. The host supplies the missing guard/recovery choice and submits a fresh request; there is no unversioned choice token that can later bypass rechecks.
- `scope.invalidate(reason)`: forced invalidation, non-vetoable security fence; reason is a closed host-owned enum, not model input.
- `scope.dispose()`: permanent owner teardown, idempotent; React effect replay uses attach/detach and must not permanently kill an injected scope.

Scope selection can be controlled by an existing router/session store through the same host acceptance seam. The application must call requestChange before accepting voluntary route/workspace navigation if it wants Save/Discard/Stay behavior. An externally forced router/session update triggers invalidation/re-resolution; the framework cannot intercept every host mutation or recover unsaved work after arbitrary process termination.

The provider consumes, but does not permanently dispose, a scope it did not create:

```tsx
import type { ReactNode } from 'react';
import { AeliqoProvider } from '@aeliqo/react';
import { AeliqoScope } from '@aeliqo/react/scope';
import type { AeliqoRuntime } from '@aeliqo/runtime';
import type { ScopeController } from '@aeliqo/runtime/scopes';

export function ScopedApplication({
  runtime,
  scope,
  children,
}: {
  runtime: AeliqoRuntime;
  scope: ScopeController;
  children: ReactNode;
}) {
  return (
    <AeliqoProvider runtime={runtime}>
      <AeliqoScope scope={scope}>{children}</AeliqoScope>
    </AeliqoProvider>
  );
}
```

This advanced wrapper's runtime and scope are **explicit props from the application's composition root**. It is not the minimal local example. The final runnable advanced guide must include the host binding, server handler and composition root, not only this wrapper.

`AeliqoScope` renders children for the active authorized activation, not for a pending selector. During a voluntary leave guard or target resolution, `ScopeSnapshot.status` stays `active`, `selector` stays A, and separate `pending` state reports the requested transition. The old subtree stays mounted for Save / Discard / Stay. Initial resolution, forced invalidation and denied access render safe non-data states. It must never label A content as B or unmount an authorized dirty form merely because a guard opened. Approved portable preferences are mapped, parsed and authorized before new child controller creation. A providerless local helper nested in a scoped app must use the nearest valid local scope rules or reject incompatible ownership, never silently create a parallel remote authority context.

## 5. Immutable targets and lifecycle

A surface address is `(runtimeId, scopeInstanceId, activationEpoch, surfaceId, surfaceGeneration)`. It is captured on creation and cannot be changed. Principal/membership/policy are re-established by the trusted host for operations; these client-visible coordinates are not access tokens.

`runtime.createSurface({scope, id, feature, bindings, ownership?})` requires an active explicit scope. Construction is inert: it installs no observer or network request. An explicit imperative `request()` can start a headless operation; React adapters start their default operation only in committed lifecycle. Invalid setup fails before external effects. `useSurface(feature,{id,bindings})` obtains the nearest active scope and creates/attaches its controller with framework-safe lifecycle. Local no-provider helper has a separate explicitly local default. Duplicate mutable render owners fail; a read-only mirror is not enabled implicitly.

On A→B, the scope owner closes A activation and hooks create B controllers. A callback retaining the old A controller stays an A callback and fails stale/cancelled/disposed; it must not silently become a B action. Returning B→A creates a newer activation even though the business workspace ID is equal. An A1 response cannot commit to A2. Similarly, unmount/remount of the same surface ID advances surfaceGeneration. Data updates inside the same activation do not recreate the runtime/controller.

Snapshots expose `.address`, generic `.state`, `.intent`, `.revision`, and aggregate `.phase`. Data-specialized selection belongs to its typed state, not a magical `.selection` field added only in a test. Exact data loading/error/partial states can be a discriminated data substate; a job feature does not acquire pretend rows.

## 6. Dirty state, caches and trust

| Event | Active UI behavior | Allowed retained state |
|---|---|---|
| Voluntary clean A→B | Guard passes, resolve membership without B feature effects, recheck versions/authority, accept and fence A, activate B | Only explicitly compatible view preferences |
| Voluntary dirty A→B | Keep A subtree mounted during Save / Discard / Stay; failed/ambiguous save or changed draft invalidates acceptance | A draft remains in A while permitted |
| Logout or membership revoked | Fence immediately, mask authorized content, revoke action/agent sessions | Host recovery only if explicitly permitted; not visible in B |
| Network fails during B resolution | No B effects until authorized; show recoverable state | A may remain active only if the host deliberately retains valid A selection and permission |
| Old write finishes after switch | Preserve original operation/scope audit record | Inspect only via permitted original scope; never replay in B |

Caches use stable semantic identity and policy/freshness attributes. In-flight state uses activation epoch, request revision and target generation. They are deliberately separate. A new filter changes the query cache key; a focus update does not. Invalidate permission-sensitive cached values on logout/revocation; retry does not widen access. Pure global public metadata may use a classified global namespace.

Snapshot pagination pins snapshot identity; live keyset pagination documents concurrent-update behavior and stable identity tie-breaks. No universal rule that every backend row change invalidates every cursor. Both reject cross-tenant/query/permission misuse.

## 7. Workspace-wide adaptive UI

Two separate operations were conflated in earlier conversation:

- Changing workspace A to workspace B changes the authorization selection and lifecycle activation.
- Changing the current workspace from table to split detail or comparison changes only presentation under the same authorized scope.

The second operation is a registered typed custom intent on a bounded coordinating surface; existing presentation nodes/links express its child views. The application supplies allowed layouts and semantic mappings. It is not a new general-purpose app generator.

Example of a domain-defined intent, not a built-in universal name:

```ts
await workspaceSurface.request({
  kind: 'custom',
  intent: { id: 'orders.workspace-layout', revision: '1' },
  input: { mode: 'comparison' },
});
```

The feature's compiler binds selection, source references and eligible views from the current scoped state. Unknown layouts fail; the model cannot invent this registration. An app can instead drive exactly the same intent with buttons or commands.

Prepare child plans/results, validate a common scope and captured revisions, and then publish one coherent presentation snapshot where the renderer supports the declared contract. Browser paints across independent roots and backend side effects are not distributed transactions. If a mandatory child fails, keep the authorized old layout. Partial layouts require explicit policy and visible partial status. Never keep revoked tenant data as a fallback. User draft/selection/focus preservation is tested through real browser behavior.

## 8. Optional agent connection without a package cycle

The canonical integration is `connectAgent({scope,client,targets})` from `@aeliqo/agent/browser`. `targets` is a scoped surface-ID allowlist; absent or ambiguous targets do not expose all surfaces. Provider credentials stay in the server's model port configuration, not in `client` or JSX.

A React application may use this **host-owned integration component**, not a required new public Aeliqo component:

```tsx
import { useEffect } from 'react';
import { useAeliqoScope } from '@aeliqo/react/scope';
import { connectAgent } from '@aeliqo/agent/browser';
import type { AgentClient } from '@aeliqo/agent/browser';

const targets = ['orders-main'] as const;

export function OrdersAgentConnection({ client }: { client: AgentClient }) {
  const scope = useAeliqoScope();
  useEffect(() => {
    const connection = connectAgent({ scope, client, targets });
    return () => connection.disconnect();
  }, [scope, client]);
  return null;
}
```

Place it inside the intended `AeliqoScope`. It does not introduce an import of agent into runtime or the default React package. The imperative adapter owns scope-event re-pairing, expiry and targeted discovery; its effect cleanup is idempotent. A shared transport client may be reused, but never share provider conversation continuity or an A-paired tool endpoint with B.

Tool calls bind to scope session, goal epoch, target address, expected state revision, origin and expiry. Client envelopes carry correlation, not authority. The server authenticates and validates membership/target operations. User prompts can ask to change the business workspace only if the host explicitly registers a guarded workspace-selection capability; a tool argument cannot replace current authority.

On transition revoke old pairing, clear old provider conversation ID/previous-response ID/reasoning continuation, discard scoped tool result cache, and regenerate allowed context. Never send A's historical transcript to B's model call under a new label. Aeliqo cannot erase data retained by external providers or external agent hosts; document that and apply an explicit host data-egress policy.

Protocol profiles are based on actual capabilities. Chat Completions and Responses are separate, endpoint/model/auth are explicit, local auth-none is allowlisted and never a fallback for a missing hosted key. No tool support yields unsupported on the existing tool loop. Streaming is negotiated and never dispatches partial malformed arguments. Do not silently retry a write, switch models, change providers, or claim latency/quality from protocol fixtures.

## 9. Controlled host state and truthful outcomes

Internal state mode owns surface intent locally. External state mode reads a stable host snapshot and emits a proposal. `request()` returning `proposed` is not a commit. Acceptance is correlated to proposal ID, captured address and expected revision; stale acceptance is refused. No feedback loop between a callback and an invisible internal store.

`committed` means runtime state accepted. `renderer-ready` requires the current render owner's acknowledgement for that target/plan revision. Neither proves a remote transaction. Action preview/confirm/execute retains existing richer receipts, durable server idempotency where required and ambiguous outcomes.

Permission failures and incompatible scopes fail closed. Recoverable transport/renderer failure can retain prior UI only while that UI is still permitted. Scope transitions and security invalidations use the separate fence rules above.

## 10. Contract proof versus product proof

The bundled TypeScript file is an isolated declaration-only design model. Its positive/negative checks prove that the written addressing/ownership/example shapes agree. It does not use or implement Aeliqo, React, network or renderers. T01 must re-run equivalent examples against real exports and T03–T21 must execute behavior using real production code. Do not ship the design model as a replacement implementation.

The final pack's validator checks task/requirement graph consistency, files and hashes, code-fence balance and obsolete references. Those checks do not prove application quality. A real SSR test observes rendered cells with JavaScript disabled; an in-flight race waits for observed source execution; a data-update test reads changed ResultStore output. A fixture returning the expected success value is not evidence.

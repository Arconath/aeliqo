# Aeliqo vNext — Adaptive Application UI specification

Status: FINAL PLANNING REVISION 3 (2026-09-19), implementation brief requested by the owner; proposed vNext APIs are not current exports. Research baseline and sources: `04-RESEARCH.md`. This specification and its contract detail in `08-CONTRACTS.md` supersede v1/v2 and conflicting chat sketches. They do not supersede repository security policy. Use the whole final-v3 pack, not an old ZIP plus this file. Implement through `02-EXECPLAN.md` and prove the requirements in `03-ACCEPTANCE.md`.

## 1. Product contract

Aeliqo remains an **Adaptive Application UI framework**, usable without AI. It connects application-owned capabilities, validated intent, state, and registered presentation. The same feature can be operated by ordinary controls, application code, command UI, or an optional agent without separate business logic or conflicting states.

Adaptation covers representation, bounded composition, information density, relevant fields, interaction stage, and preservation of user work. It must be predictable, inspectable, accessible, and restricted to host-approved possibilities. Aeliqo does not generate arbitrary executable UI and does not take over every part of an application.

The expected value is reduced integration and coordination work across browse/filter/compare/detail/form/action journeys, not merely changing a table into a chart. Value must be demonstrated against an equivalent host-only implementation and through usability tasks. No source inspection proves product-market fit.

### Required adoption modes

- Standalone components remain usable without the semantic runtime, a model, or an account.
- A small local data surface works with a compact helper and default built-ins.
- A feature can be attached to remote data, existing state, host actions, and custom UI.
- Large applications can load modules independently, isolate multiple surface instances, and adopt the framework incrementally.
- Web Components/Vanilla and React are first-class reference paths; preserve existing Vue integration and Next fixtures. Prove a static/islands embedding recipe. Other frameworks have a documented adapter contract and explicit tested/unverified status, not an invented support claim.

### Non-goals

Do not build a hosted Aeliqo Cloud, billing, SSO/SCIM product, marketplace, replacement router, ORM, global state manager, distributed workflow engine, collaboration engine, general no-code builder, or every database/provider adapter. Do not introduce subscriptions to proprietary infrastructure as a requirement. Preserve the OSS/license boundaries. Do not move site/repository boundaries based on stale conversations.

## 2. Architecture decisions

### D01 — Feature definition is not a live instance

A feature is immutable metadata and trusted local definitions: identity, supported intent schemas, capability references, semantic meanings, and eligible view manifests. It may be shared as code. It must not capture per-user records, credentials, mutable selection, request-scoped principals, or open subscriptions at module scope.

A **surface** is a live scoped instance: current intent, presentation, selection/draft references, revision, pending operations, and lifecycle. A live target has immutable identity `(runtimeId, scopeInstanceId, activationEpoch, surfaceId, surfaceGeneration)`, not merely feature ID. Trusted authorization identity is evaluated independently at the host boundary; a client address is not a credential. Two Orders surfaces must have independent filters unless the host explicitly connects them.

A **binding** connects feature contracts to application-owned data, actions, external state, and renderer implementations. Schema definitions can be shared; validation still happens at each trust boundary. Separate browser bindings from server-only bindings to prevent secret/DB-driver imports into client bundles.

A **runtime** owns bounded coordination and lifecycle within an explicit application/session/request scope. It is not a global singleton, database, or application-wide record cache. The host chooses its lifetime.

### D02 — Headless contract with renderer adapters

Core and runtime do not import React, Lit, DOM APIs, provider SDKs, or browser globals. Pure contract allocation has no registered listeners or timers until explicit attachment; teardown and permanent disposal are separate where framework replay requires it. Existing package direction and export rules remain in force. Move any reusable adaptive decision logic behind a framework-independent interface using a deliberate ADR; do not create reverse dependencies or copy the resolver.

`packages/web` retains its Lit components and browser renderer. `packages/react` gains native React view binding support without making core know React elements. Reuse existing validators/manifests. A native React custom-view adapter must not create a second React root for every node or claim to accept arbitrary React components through the existing Lit TemplateResult contract.

Keep the current five public packages by default. Dependency arrows describe layering, not imports: runtime imports core; web imports runtime/core; react imports web/runtime/core; agent imports runtime/core. A shared browser adapter may be consumed by agent without runtime importing agent; any new package-direction exception needs an ADR and graph tests. Use explicit subpaths and optional peers for advanced adapters. A new public package needs a concrete package-boundary ADR and consumer evidence, not convenience. Internal test utilities remain internal.

### D03 — Small public UI surface, not a god component or god configuration object

Render components consume an already-scoped controller. They do not accept credentials, authorization rules, source implementation, business actions, and model configuration together. Feature definition, host binding, renderer binding, and instance lifecycle are separate composable units. Do not merely move thirty JSX props into one mandatory `config` object.

Data convenience and advanced APIs converge on the same controller and execution path. There is no demo engine to rewrite later. Existing code can use headless commands/state without replacing its markup.

### D04 — Manual operation first, agent as an optional adapter

Ordinary controls, host code, and agent proposals resolve to the same registered operations. Agent transport cannot widen permission. The no-AI path must neither import a provider SDK nor make a provider request. Removing the bridge must leave manual features usable.

Move reusable dispatch functionality out of agent-only ownership if needed; preserve existing agent subpaths as compatibility re-exports. Do not make runtime depend on agent. Agent-generated natural language and arguments remain untrusted; schema-valid does not mean semantically correct.

## 3. Candidate public API and contract lock

The spellings below are the canonical candidates for T01. Verify existing exports, typecheck complete consumer fixtures, and record an API decision before implementation across packages. Reuse compatible existing public names, especially `createAeliqoRuntime`, rather than add synonyms. After T01, any rename must update the API contract, examples, docs, export map, migration, and tests in one reviewed change.

Do not implement all previously suggested helpers from chat. Required concepts are feature definition, scoped controller, renderer, and optional bridge; helper count is not a success metric.

### 3.1 Local beginner path

Proposed React consumer:

```tsx
import { AdaptiveSurface, useDataSurface } from '@aeliqo/react/surface';

type Person = { id: string; name: string; team: string };

export function People({ rows }: { rows: readonly Person[] }) {
  const surface = useDataSurface({
    id: 'people-main',
    data: rows,
    getRowId: row => row.id,
  });
  return <AdaptiveSurface surface={surface} />;
}
```

One optional stable ID for cross-render references, data, and identity are enough here. A schema can be added for empty/ambiguous/strict data; the common case does not require manually constructing catalogs, grants, query registries, or revision envelopes. Providerless mode creates only an owned local read-only scope with no model egress and no backend authority. It does not silently grant permission to a remote source.

Hook construction during React render must be pure/inert. External registration, observers, and subscriptions attach in committed lifecycle. Interrupted render and Strict Mode must not leak temporary instances. Data prop updates feed the same stable source/controller; no new runtime on every render. Mutating an input array in place is unsupported unless an explicit version/update mechanism is used and documented.

Inference is bounded structural convenience, not business interpretation. An array of records defaults to browse; empty data without schema yields a real empty state and offers schema guidance. Nested data is projected explicitly or given a separate typed binding; do not silently flatten arbitrary structures. Duplicate or missing identities disable identity-dependent selection/detail/edit with a useful diagnostic instead of inventing stable entity IDs. Rendering a simple list can use ephemeral display keys but cannot pretend those keys are business identities.

### 3.2 Advanced feature, binding, and instance path

A proposed feature definition is pure and framework-independent:

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

In an application-owned runtime scope, bind the source and create each instance explicitly:

```tsx
import { AdaptiveSurface, useSurface } from '@aeliqo/react/surface';
import { peopleFeature } from './people.feature';
import { peopleBindings } from './people.browser';

export function PeoplePage() {
  const primary = useSurface(peopleFeature, {
    id: 'people-main',
    bindings: peopleBindings,
  });
  const comparison = useSurface(peopleFeature, {
    id: 'people-secondary',
    bindings: peopleBindings,
  });

  return (
    <>
      <AdaptiveSurface surface={primary} />
      <AdaptiveSurface surface={comparison} />
    </>
  );
}
```

`peopleBindings` is a typed host binding, not arbitrary metadata accepted from an agent. It supplies a read port / existing DataService and any approved action ports. The advanced hook uses the nearest active `AeliqoScope` within `AeliqoProvider`, or an explicit active scope belonging to the injected runtime. A provider by itself does not select a tenant. Missing runtime or active scope fails with a clear setup diagnostic; it does not borrow an unrelated singleton. Never show a provider-dependent example without its provider in the complete runnable fixture.

Provider contract: the provider shares a host-created runtime and never disposes what it did not create. The owner disposes an explicit runtime at application teardown; a providerless helper disposes its own scope. Preserve the existing `app` provider path through a documented migration/compatibility adapter; do not silently change its meaning.


#### 3.2.1 Application scope is an explicit lifecycle controller

A workspace/tenant/organization/project **selector is not authorization**. Browser selection may come from application state or a validated URL. The server resolves it against authenticated identity and current membership for every relevant operation. The scope controller coordinates UI isolation; it cannot establish backend trust by itself. Nested scopes can only narrow the server-approved parent context and use full lineage, never concatenated IDs that may collide.

Use `AeliqoScope` as a context provider for an application-owned `ScopeController`. It does not create a second tenancy system. Minimal advanced layout, with runtime and scope created by the application's composition root:

```tsx
<AeliqoProvider runtime={runtime}>
  <AeliqoScope scope={workspaceScope}>
    <App />
  </AeliqoScope>
</AeliqoProvider>
```

`runtime` and `workspaceScope` above are host-owned inputs, not current public exports. Complete binding/lifecycle contracts and examples are in `08-CONTRACTS.md`; T01 makes installed-package consumers from them. Advanced hooks use the nearest scope. A local providerless helper can own a read-only local scope; it has no remote permission or model egress.

**Voluntary switch:** the host calls `workspaceScope.requestChange(selector)` before publishing a new active workspace. The controller runs registered leave guards. Unsaved work produces an ordinary Save / Discard / Stay interaction; no automatic deletion or copy to another tenant. A save may fail, so acceptance waits for a real result. Cancellation leaves the old authorized scope active. The target membership is resolved without running its feature effects. Before acceptance, recheck the captured active selector, leave-guard/draft revision and current authority. Host acceptance then fences the old activation and publishes the new activation coherently; a stale or superseded attempt cannot activate its target. Spec section 6's preserve-work rule applies here too.

While a voluntary guard or target resolution is pending, the existing authorized activation remains active and visibly labeled as that activation; pending transition state is separate. Do not unmount dirty children just to show a Save / Discard / Stay dialog. If the target fails, retain the original scope only while its authority remains valid. New changes to the draft or active selection invalidate stale guard acceptance.

**Forced invalidation:** logout, membership revocation, expired authorization, or an externally imposed scope switch must immediately fence old effects and hide old authorized content. A leave guard cannot veto security. Old drafts are detached from the active UI; an opt-in host recovery store may retain them only under the old scope and policy. Aeliqo neither persists sensitive drafts by default nor guarantees that cancelled remote writes were undone. The host must integrate routing/session events with this controller; changing an unrelated React prop alone is not an end-to-end security mechanism.

**Immutable targets:** each accepted scope activation increments a monotonic epoch, including A→B→A. Create new child controller targets for the new activation. Do not repoint an old Orders controller at a new tenant: a closure holding the old controller must return stale/cancelled/disposed rather than acting in the new workspace. Within one activation, data updates retain controller identity. Unrelated runtimes need not be recreated.

At transition, fence old requests, plans, renderer acknowledgements, proposals, confirmations, cursors, subscriptions and pending agent calls. Already-executing backend effects retain their original operation/scope identity and may complete; inspect them through an authorized old-scope operation record, never re-label them as new-scope work.

Active results, identity selections, detail/edit targets, and confirmations never cross scope implicitly. Presentation preference portability is opt-in and field/value/permission/semantic compatible: even a filter may contain an old tenant's customer ID. Re-parse and re-authorize preserved view/sort/filter values. Draft retention is a separate host-owned recovery decision, not `preserve: ['draft']`.

Separate stable semantic cache identity from activation fencing. Cache identity includes the verified principal/tenant lineage, permission/data/query/schema/meaning/locale attributes that affect the value; activation epoch fences in-flight work. Do not insert every UI render revision into every cache key or cursor. Reusing a partition after A→B→A needs fresh authority/freshness validation and a new Result wrapper bound to the current activation. Global public data may use an explicitly classified global cache namespace.

**Optional agent connection:** use `connectAgent({scope, client, targets})` from the agent browser adapter, with an explicit allowlist of surface IDs. It is not an ambient bridge above all scopes. React applications wrap this connection in an application-owned effect component (example in `08-CONTRACTS.md`). No React-to-agent import is added to the no-agent entry. On scope change, reuse transport only if safe; discard/rebind the old tool session, goal epoch and provider conversation/continuation state. Old transcript text, previous-response IDs, reasoning continuation and cached tool results must not become new-scope model context. A backend-owned external agent may keep its own history, which Aeliqo cannot erase; disclose that limit and enforce local tool isolation.

#### 3.2.2 Workspace-wide presentation is not a tenant transition

A workspace **layout** may adapt inside the same authorized scope: single view → list/detail split → comparison layout. This uses a bounded composite presentation on one coordinating surface, existing child view nodes, typed links, and one presentation revision. It does not change scope, grants, or data ownership and does not require a new universal Workspace component.

For multiple independent surfaces, the host can register an explicit coordinating intent and mappings. Prepare compatible read/view results against a common scope activation, recheck child revisions, and publish a coherent UI snapshot or clearly label partial completion if policy permits. Never claim distributed atomic database writes or simultaneous browser paint. Keep one controller owner per child; no accidental duplicate roots or effect execution. Preserve untouched panels and route/sidebar components outside the adaptive area.

### 3.3 Core controller contract

This is the minimal normative behavioral interface. Use existing Outcome/Diagnostic/Intent contracts where compatible instead of defining wire duplicates. Generic state and intent types remain concrete at the consumer boundary.

```ts
export type SurfaceRevision = string;
export type SurfacePhase =
  | 'idle' | 'loading' | 'ready' | 'needs-input'
  | 'unsupported' | 'denied' | 'failed' | 'disposed'; // aggregate phase; data/transport states remain discriminated substate

export interface SurfaceAddress {
  readonly runtimeId: string;
  readonly scopeInstanceId: string;
  readonly activationEpoch: number;
  readonly surfaceId: string;
  readonly surfaceGeneration: number;
}

export interface SurfaceSnapshot<I, S> {
  readonly id: string;
  readonly address: SurfaceAddress;
  readonly revision: SurfaceRevision;
  readonly phase: SurfacePhase;
  readonly intent: I;
  readonly state: S;
}

export interface RequestOptions {
  readonly signal?: AbortSignal;
  readonly expectedRevision?: SurfaceRevision;
  readonly expectedAddress?: SurfaceAddress;
}

export type RequestResult =
  | { readonly status: 'committed'; readonly revision: SurfaceRevision }
  | { readonly status: 'proposed'; readonly proposalId: string }
  | { readonly status: 'needs-input'; readonly diagnosticCode: string }
  | { readonly status: 'unsupported' | 'denied' | 'stale' |
      'cancelled' | 'disposed' | 'failed'; readonly diagnosticCode: string };

export interface SurfaceController<I, S> {
  readonly id: string;
  readonly address: SurfaceAddress;
  getSnapshot(): SurfaceSnapshot<I, S>;
  subscribe(listener: () => void): () => void;
  request(intent: I, options?: RequestOptions): Promise<RequestResult>;
  dispose(): void;
}
```

A React handle adds local renderer binding, not fields to the wire snapshot. A data specialization can expose typed result handles or a selector, but must not pretend every feature returns `rows`. A file-processing feature returns scoped job/output references, not a synthetic table resource.

The `committed` controller result is not `renderer-ready` and neither proves a remote business transaction. Preserve existing richer operation-specific receipts internally and expose their distinctions in diagnostics and tests. An agent asking to change visible UI is successful only after the relevant adapter acknowledges the committed presentation. A client renderer acknowledgement never grants backend authority.

### 3.4 State ownership and controlled mode

Provide one discriminated ownership option when creating the surface:

- Internal mode: runtime owns intent and view state. Data surfaces have a canonical inert browse intent; capability bindings provide an explicit typed `initialIntent` because no feature-specific intent can be derived safely. A separately supplied `defaultIntent` may override the data default but is not needed to initialize an externally owned capability store.
- External mode: a host-owned store provides stable `getSnapshot`, `subscribe`, and `onProposal`/acceptance. UI and agent requests are proposals until the host applies them. A host rejection must not be reported as a committed change.

Do not expose both a controlled `intent` prop and a separate controller that secretly mutates the same intent. Do not infer acceptance from firing a callback. Prevent proposal loops with request identity and revision correlation.

`useSurfaceState(surface, selector)` subscribes to the required slice. A filter change in surface A must not rerender all consumers of surface B. Cache immutable snapshots and test SSR matching. URL integration encodes only approved non-sensitive view state; sensitive filters, authorization, raw rows, and model secrets do not go into URLs.

### 3.5 Renderer composition

`<AdaptiveSurface surface={handle} />` allows validated automatic presentation choice. `<ViewSurface surface={handle} view="registered-id" />` pins one permitted view; it never silently changes to another view when the pin is incompatible. Both use the same validators and controller. Do not mount two renderer owners for the same surface ID without an explicit read-only mirror contract.

Controls, toolbar, status, clarification, and confirmation are composable. Provide sensible built-in behavior for empty/loading/failure/needs-input; allow existing host controls through the controller and existing feedback primitives. Do not require a chat panel or a global workspace shell.

`defineReactViews(feature, implementations)` is a local adapter binding: manifests/config schemas and data needs are validated; React implementations remain functions in trusted code. A `ReactFeatureBinding` composes with `useSurface`, not core. Lazy view loading must preserve fallback/previous content without remounting unrelated application UI.

## 4. Data, semantics, and scale

### 4.1 Local and remote are explicit modes

Local rows are an authorized, bounded in-memory dataset. Remote bindings declare supported operators, fields, sorting, pagination, aggregation, streaming, and update behavior; a boolean `aggregate: true` alone is insufficient to express a meaningful contract. Capabilities may reference existing QuerySpec/MeaningDefinition support.

Reuse `DataService.describe/plan/execute`, local snapshots, and HTTP boundaries. A convenience read adapter must lower into these contracts rather than install a second evaluator. Unsupported backend operations return explicit capability gaps. Do not silently download everything to emulate unsupported aggregation.

Responses distinguish complete vs partial/windowed data, exact vs estimated/unknown totals, continuation/cursor, result revision, and applicable schema/meaning revisions. Stable pagination orders include an identity tie-breaker. Cursors cannot cross tenant, principal, permission partition, or incompatible query/order/schema scope. Consistency is explicit: snapshot pagination pins a source snapshot; live keyset pagination uses a stable order and documented concurrent-update semantics. Do not invalidate all cursors on every unrelated backend write.

A local view of one remote page is not a complete dataset. Global counts, comparisons, and analytics require a backend capability or a clearly labeled partial result. Virtualization bounds rendering; it does not solve network, memory, or evaluation cost.

### 4.2 Business meaning is not guessed from types

A numeric field is not automatically summable; an ID can be numeric. Charting precomputed rows does not imply aggregation. Metric metadata includes applicable grain, unit/currency, timezone/calendar, null semantics, and additive/semi-additive/non-additive restrictions. Ratios are not averaged without an approved definition. Mixed currencies are not summed without an explicit conversion source/time. Data semantic work reuses current meanings/query validators.

Trend requires an unambiguous requested time field and numeric measure. Categorical comparison can use a registered bar/comparison view; a large number of categories needs a registered reduction strategy or a selection step. No random chart chosen from the first number field.

Nested objects, collections, File/Blob, rich text, and document/editor state use explicit projections or non-relational capability contracts. Core wire data remains bounded and non-executable. Display text and diagnostics are escaped; rich HTML requires a separately approved sanitizer, and URIs use host allowlists. Object inspection must not invoke getters, toJSON hooks, prototype setters, or unbounded recursion on untrusted records. Scoped file/job references must not leak signed URLs or credentials to models by default.

### 4.3 One owner for each state

Backend/business state remains authoritative at the host. Integrate with host caches through subscribe/read/invalidate boundaries instead of maintaining a second authoritative cache. Cache keys include verified principal/tenant lineage, permission version, normalized query, source identity and schema/meaning/locale attributes affecting the result. Data freshness/version and UI activation epoch are distinct; apply the policy in section 3.2.1, not unbounded UI-revision cache keys. Logout and permission changes cancel, revoke, and evict relevant cached materialized data.

Use per-surface operation queues, cancellation, latest-valid-query semantics, bounded memory, and reference-counted result retention. Write operations use serialization/idempotency appropriate to the host, not blind latest-wins. Low-frequency semantic transitions use Aeliqo; pointermove, animation frames, and text-input keystrokes stay on fast host/UI paths until an explicit semantic commit.

## 5. Adaptive resolver contract

Use one deterministic resolver for equivalent normalized inputs: intent, capability manifest/version, semantic result descriptors, current presentation/state mapping, host policy, locale/time inputs, and environment buckets. The resolver has no network calls, model calls, implicit wall clock, random tie-breaking, or arbitrary access to host objects. The following numbered sequence describes the overall orchestration pipeline: authorization, source evaluation, and stage/commit happen outside the pure resolver. Its eligibility/ranking/plan-validation step consumes already obtained, authorized descriptors and returns a decision without performing effects.

1. Validate intent/schema and target surface.
2. Apply current authority and capability constraints before presenting sensitive metadata.
3. Resolve approved data/semantic needs; obtain a real Result when needed.
4. Filter out unknown, incompatible, disallowed, inaccessible, or unaffordable presentations.
5. Honor a hard host pin only when valid; otherwise explain incompatibility.
6. Rank eligible candidates by host preference, task coverage, semantic fit, environmental suitability, and continuity cost; use stable ID/version tie-breaking.
7. Validate bounded composition, links, coverage, configuration, and state transfer.
8. Stage and commit a coherent UI snapshot for the applicable revision; retain previous valid UI only while its authority/scope remains valid. Revocation or tenant switch must mask old data, not preserve it behind an error banner. This commit is not a database transaction or simultaneous browser paint.
9. Produce a reason code, candidate rejection reasons, active rules/versions, and final receipt without sensitive rows.

The candidate facade `resolvePresentation(input)` returns one normalized discriminated decision: `status: 'ready'` with a validated plan and reason codes; `status: 'needs-input'` with a diagnostic code and bounded `choices: readonly {id:string; label:string}[]`; or `status: 'unsupported'` with diagnostic/rejection reason codes. Adapt existing Outcome and ValidatedPresentation contracts rather than fork their validation logic. Choice order is stable; choosing a metric produces a new typed intent, not executable UI. This is a presentation decision, distinct from controller commitment, renderer readiness, and action execution.

Missing semantic input is different from no compatible view. `needs-input` requests a structured choice. An unsupported view may fall back only if policy allows and meaning is preserved. The fallback policy is explicit and tested; do not infer universal fallback from the existing order in standard.ts.

Resize must not cause flicker or destructive adaptation. Use environment buckets, hysteresis, bounded candidate count, scheduling/coalescing, and continuity preferences. Host/user pin wins within permission and compatibility constraints. Do not automatically turn every table into cards on a small screen when comparison or accessibility would be harmed.

Start with built-in browse/list/cards/table, detail, comparison, registered trend/bar analysis, forms, and one bounded multi-pane composition. Every adaptive candidate needs real manifest/config validation/state-transfer tests. Catalog presence alone is insufficient. Arbitrary composition search and every possible chart are not prerequisites.

## 6. Interaction UX

User-visible filters, selection, metric, date range, and scope reflect the committed intent. AI actions cannot create invisible filters. Requests that cannot finish expose a recoverable explanation rather than only a console error. Preserve previous UI, appropriate focus, scroll, draft, and selection when semantically compatible.

Clarification is ordinary UI, usable without a model. Distinguish loading, refreshing-with-previous-data, empty, partial, stale, offline/unavailable, denied, unsupported, failed, cancelled, and disposed states. Cancellation of a local wait is not proof of cancellation of a remote transaction.

Reversible view changes support returning to previous view state. Do not promise universal undo for business side effects. Existing forms guard unsaved work; confirmations show the exact target and effect. Announce meaningful changes accessibly without stealing focus after every update. Support keyboard, reduced motion, zoom, RTL, text expansion, locale, timezone, and dense/comfortable use. Native semantic HTML is preferred when available.

## 7. Agent-agnostic integration

### 7.1 Three independent seams

- **Intent ingress:** manual/application/agent producers use the same validated capability boundary.
- **Agent transport:** preserve MCP/WebMCP, and provide an authenticated web client bridge without requiring those browser APIs. Native capability absence has a documented fallback, not a fake success.
- **Model port:** existing model/protocol interfaces normalize generation and tool proposals. A proprietary provider SDK is optional and isolated.

A connection is opt-in per explicit ScopeController and an explicit allowlist of surface instances. Browser transport may be shared, but active capability sessions are scoped; ambiguous scope never defaults to the first active scope. Metadata discovery is bounded/paginated and filtered before model exposure. No broadcasting every feature manifest or every row on every turn. An unknown/ambiguous surface target produces a choice or rejection, never the first mounted surface.

### 7.2 Server/browser split and protocol profile

A server helper may read explicit environment variable names for protocol, base URL, model, and credential. It validates missing values and emits redacted diagnostics. It does not scan environment variables, identify a provider from key format, or place credentials in a serializable feature definition.

Support generic Chat Completions tool calling and retain the existing Responses adapter as a distinct protocol. Protocol capabilities include required tool behavior, optional streaming, token/usage reporting, cancellation, and accepted request options. Do not assume every compatible endpoint implements input-token-counting endpoints, identical token-limit parameters, or parallel tools.

Add an explicit no-auth profile only for host-approved local/self-hosted endpoints; do not require dummy secrets. HTTPS remains default; insecure transport requires explicit trusted configuration. Endpoint allowlists, redirect policy, request size, output size, timeout, retry, and DNS/network policy belong to the host/server boundary. The browser and model never choose arbitrary URLs. Local endpoints are deliberate exceptions, not a global bypass of SSRF protections.

Non-tool models return capability unsupported for the current tool loop. A future bounded structured-output adapter may be added separately, but do not claim all models work by catching malformed text and guessing commands.

### 7.3 Prompt and tool security

Data cells, documents, tool descriptions from untrusted sources, and model output may contain prompt injection. They cannot define new permissions, register code, override policy, forge confirmation, or cause hidden network egress. Bind requests to principal, tenant/scope, surface instance, goal epoch, current revision, and expiry. Recheck before effects and after asynchronous gaps.

Streaming model output never exposes a half-validated intent/action to execution. UI may show bounded progress; complete tool calls are validated before dispatch. Preserve request/call correlation, cancellation, replay protection, and usage accounting. Busy or retryable states do not imply permission to repeatedly perform a business effect.

Provider-compatible local protocol tests are mandatory. Live evaluation requires host-approved endpoint/model, synthetic corpus hash, credential access, and explicit monetary/request ceiling. Missing credentials are a reported blocker for live certification, not a reason to skip offline functionality or fabricate live success. Model-enabled product claims require actual qualified provider profiles; unsupported profiles are disclosed.

## 8. Actions and distributed boundaries

Reuse current preview/confirm/execute contracts, independent proposal/execution grants, stale revision checks, and ambiguous outcomes. UI opening an edit form is not executing a write. Idempotency must persist at the side-effecting backend when durability is required; a browser map cannot guarantee exactly-once execution across retries, restarts, or multiple servers.

An action preview binds normalized input, principal, tenant lineage, scope activation, target entity/revision, policy revision, and expiry. Browser-rendered confirmation proves user interaction only to the authorized host protocol; it is not a new server credential. Changing input or policy invalidates previous confirmation. Agent prose is not user confirmation. A retry after an ambiguous result inspects the host operation record rather than blindly executing again. Long-running jobs return a job reference and status/cancel capability; Aeliqo is not the durable job runner.

Server auth, row/field filtering, input validation, rate/quota control, and mutation concurrency must be enforced server-side. Presentation choices are not security boundaries. Local browser-only mode controls only already supplied data and must say so clearly.

## 9. Web integration and large-app lifecycle

- React, Lit/Vanilla, existing Vue usage, Next SSR/hydration, and a static/island embedding fixture form the qualification matrix.
- SSR creates request-scoped runtime/bindings and serializes only public validated snapshots. No cross-user globals, functions, tokens, or unfiltered data in HTML. Escape inline serialization (including </script>), respect host CSP nonces and HTTP cache policy, and authorize deserialized snapshots before reuse. A text match inside a hydration script is not proof of useful initial DOM.
- Initial adaptive HTML must contain meaningful content when SSR is advertised. An empty div plus client effect is CSR, not adaptive SSR. Use stable initial environment assumptions and adapt after hydration without mismatches.
- Honor framework server/client boundaries; no server helper in a browser import graph. Avoid rendering effects during server execution.
- Module-level feature metadata can be shared. Live controllers and authenticated sources cannot be singletons across server requests.
- Route modules and renderer registries load lazily; page navigation registers/unregisters reference-counted manifests without leaking handlers. Never eagerly import every feature while claiming routes are lazy.
- Independent roots/microfrontends need explicit scope and compatible protocol/version contracts. Do not promise isolation for conflicting global custom-element tag versions; pin compatible versions or document an isolated embedding strategy.
- Test bfcache/pageshow, route revalidation and session loss before re-enabling sensitive actions; host authorization remains authoritative. Do not promise to erase information already legitimately viewed.
- A host can run manual UI with no WebMCP, no model, and no hosted Aeliqo service. Offline behavior is capability-specific, not an automatic promise to queue irreversible mutations.

## 10. Documentation and component quality

Canonical catalog and package declarations are the sources of truth. Every published component has one authored English page, exact import path, runnable copyable example, real preview, generated prop/event facts, state behavior, keyboard/focus details, responsive/RTL notes, performance caveats, and version/migration notes. Use the checklist and inventory gate in `03-ACCEPTANCE.md`.

Document three distinct maturity levels per component: standalone use, semantic binding, and automatic adaptive eligibility. Do not advertise all catalog entries as automatic resolver candidates.

Organize learning paths: local surface without AI; remote production source; using an existing design system; custom view; multiple instances; SSR; action confirmation; agent BYOK; advanced adapters; performance/troubleshooting. Include one complete copy-paste application per path rather than snippets referencing undeclared objects. Package docs and root README must agree with installed tarballs.

Provide API diagnostics with stable codes and actionable text. Publish machine-readable contracts/manifests and a documentation map for agents from canonical sources; they do not grant capability or override user instructions. Do not add an entire documentation tool product.

## 11. Compatibility, support, and delivery

Target the next deliberate release line after 0.4.x; select the exact version only after inspecting registry/workflows. Never overwrite 0.4.2 or relabel a breaking change as a patch. Preserve existing public paths through a documented compatibility layer where feasible; intentional breaks get versioned migration and consumer tests. Historical ADRs stay intact.

Implementation uses existing repository paths and quality rules. Keep functions/files within the repo's 80-line/500-line ceilings, complexity <=12 and nesting <=3 unless an existing explicit fixture/generated exception applies. Do not solve structural issues with blanket lint waivers, new singletons, catch-all managers, or unnecessary design patterns.

Release confidence is scoped: compiled, tested, benchmarked, live-model-qualified, published, and deployed are different states. A published support matrix lists browser/framework/version/workload profiles and gaps. No blanket guarantee for every possible application size.

The execution order and acceptance matrix are part of this specification. Completing the API skeleton but leaving documentation, SSR, recovery, or relevant qualification pending is not full completion.

## 12. Scope of this final design

The chosen architecture optimizes for predictable adoption, reuse of the existing engine, small dependency cost, explicit ownership and measurable integration value. It is not a mathematical global optimum for all workloads. Candidate package signatures are locked once in T01 against existing exports; the behavioral constraints are normative now. If a concrete incompatibility is discovered, update types, tests, docs, migrations and evidence together rather than layering another alias.

No mandatory new hosted service, model framework, state framework or application-wide schema system is introduced. Permission checks and model boundaries can share definitions but never skip boundary validation. Commercial value, third-party models and largest-scale claims remain separately qualified.

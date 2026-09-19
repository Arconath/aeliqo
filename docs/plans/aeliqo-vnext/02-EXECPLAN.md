# Aeliqo vNext Implementation Plan — final revision 3

> **For agentic workers:** Use `superpowers:executing-plans` for inline execution, or `superpowers:subagent-driven-development` when available and explicitly selected. Follow the task checkboxes and evidence gates. These are optional installed-skill routes, not dependencies of the shipped framework. The owner selected Codex for execution.

**Goal:** Deliver a useful no-AI adaptive UI foundation with composable DX, optional provider-agnostic agents, clear component documentation, and measured production integration profiles.

**Architecture:** Extend the existing core/runtime/renderer/agent contracts. Separate immutable feature definitions from scoped live surface controllers, bind application-owned I/O through existing boundaries, and expose small renderer/hook APIs. Do not build a second authority, query, or semantic engine.

**Tech Stack:** Existing repository-pinned TypeScript, Zod, Lit, React, Vitest, Playwright, pnpm, and release tooling. Read current pins before installation; do not upgrade unrelated packages or impose a new state/model framework.

**Spec:** `01-SPEC.md` and its contract detail `08-CONTRACTS.md`; acceptance and coverage: `03-ACCEPTANCE.md`; source audit: `04-RESEARCH.md`.

## Global constraints

- Canonical repository is `Arconath/aeliqo`; inspected baseline is `9092d6cff454b81cd623a7a4be7621c6a750d9c7`. Reconcile fresh HEAD without discarding newer work.
- Keep core framework independent, runtime DOM-free, and I/O in adapters; no reverse dependencies/cycles.
- Reuse current validated task/result/presentation/action and bounded agent paths. No duplicate semantic/business authority engine.
- Keep the current five public packages unless an explicit reviewed boundary decision is required.
- Source, tests, and docs live under existing top-level directories. No new top-level project folders; no root PLAN.md.
- Public docs are English under `docs/site/`; package guides under `docs/packages/`; generated artifacts are not edited as source.
- Handwritten production functions <=80 lines, files <=500 lines, cyclomatic complexity <=12, nesting <=3; respect existing explicit exclusions.
- No model/provider required for manual behavior. No credentials in browser bundles, feature metadata, tool arguments, logs, or snapshots.
- No destructive reset/clean/force-push, removal of other work, tag deletion, unpublish, permission bypass, or weakening acceptance gates.
- Branch, review, release, and spend authority must be verified; historical 0.4 release instructions are not blanket authorization for vNext.
- Preserve historical ADRs; supersede intentionally. A breaking vNext release cannot reuse 0.4.2.
- Proposed APIs are not implemented merely because declaration-only design probes compile.

## Review focus

1. Two independent surfaces or server requests using the same feature must not share mutable state or permissions. Test in T03/T12/T16.
2. A controlled host may reject or delay a request; neither UI nor agent may bypass it or claim a commit. Test in T03/T14.
3. Partial remote data and ambiguous analytics must not silently produce a plausible global result. Test in T06/T08.
4. Disposal, resize, hydration, and delayed responses may interleave; no late effects, lost drafts, leaked roots, or mismatched markup. Test in T10/T12/T13/T19.
5. Model compatibility and callback success can be mistaken for actual UI/business success. Preserve distinct receipts and live-test status in T11/T14/T15/T21.

## Execution protocol

Read all pack files once, then work task-by-task. Before each task, refresh applicable AGENTS.md, its consumed interfaces, and relevant current code. Create a failing test, observe the failure, implement the smallest cohesive change, rerun focused tests, run affected existing gates, review the diff, and checkpoint. Commit coherent changes only under the verified branch/review policy. Use explicit paths in `git add`, not broad staging of unrelated files.

The test snippets below are **proposed vNext contract tests**, not assertions that these symbols exist today. T00 installs test scaffolding; T01 freezes the API contract and shared fixture names; later tasks make the corresponding tests pass using real production modules. External source/model/clock/transport fakes are allowed. Fake production dispatchers, resolvers, authorization, or renderer success are not acceptable substitutes in integration tests.

Write per-task evidence in `07-EXECUTION-STATE.md` and a detailed task ledger under this plan directory. Do not commit generated browser artifacts; link to retained CI/local artifacts according to repository policy. Before context compaction or termination, record the exact next task, failing command, source state, decisions, and blockers. A new Codex session must be able to resume from files alone.

## Milestones and dependency graph

The machine-readable task graph is `PLAN-INDEX.json`. It and each task's dependency line must agree. Execute by dependency, not by an old chat task number.

| Milestone | Tasks | Gate |
|---|---|---|
| Baseline and API | T00–T02 | Consumer contract, registry baseline, and immutable features |
| Runtime and scope | T03–T04 | Controlled state, immutable addresses, guarded/forced scope transitions |
| Data | T05–T06 | Local updates, remote capabilities, semantic coverage, cache correctness |
| Adaptive UI | T07–T09 | Pure selection, bounded views, workspace-wide composition |
| Application integration | T10–T13 | Native/custom UI, non-data actions, SSR, recovery and accessibility |
| Optional agent | T14–T16 | Scoped bridge, protocol profiles and security |
| Documentation and value | T17–T18 | Every catalog entry and four real reference journeys |
| Qualification and delivery | T19–T21 | Benchmarks, compatibility, reviewed candidate and authorized release |

Core types, export maps and the coordinator have a single writer. Parallelize only disjoint code or read-only review after interfaces are locked. Candidate review must not be represented as independent review if performed only by the implementer.

---

## T00 — Fresh inventory, policy, baseline, and harness

**Requirements:** RQ01, RQ32. **Dependencies:** none.

**Read:** `AGENTS.md`, scoped/parent guides, `.node-version`, `package.json`, lockfile, `quality/commands.json`, package export maps, `.github/workflows/`, catalog, current ADRs, release metadata. **Create:** plan-local `BASELINE.md`, `TASK-LEDGER.md`, `tests/vnext/vitest.config.mjs`, `tests/vnext/tsconfig.json`, `tests/vnext/playwright.config.mjs`, `tests/vnext/fixtures/people.ts`, and `tests/vnext/fixtures/host.ts`. These paths are proposed new files. **Modify:** existing package scripts and quality matrix to include vNext tests when meaningful product tests exist.

**Interfaces produced:** fixture modules expose `createPeopleFixture()` returning `{runtime, scope, feature, bindings, source, updatedSnapshot, observeRows, dispose}` and `createControlledFixture()` additionally exposing `{hostStore, proposals}`. They use real runtime/feature/source modules once those exist. Until then, only design-probe declarations are permitted under a clearly isolated test-contract path; no passing fake implementation is shipped.

- [ ] Establish the checkout without modifying it:

```sh
git rev-parse --show-toplevel
git remote -v
git status --short
git branch --show-current
git rev-parse HEAD
```

- [ ] Verify remote owner/name, current main, local WIP, branch rules, release permissions, and current source pins. Do not assume paths from personal memory. Preserve unrelated changes and stop only conflicting writes while continuing safe inspection.
- [ ] Inventory all catalog IDs, component pages, examples, exports, sources, agent adapters, SSR paths, and quality commands. Record historical instructions requiring vNext supersession.
- [ ] Install with the existing pinned package manager/lockfile. Run the baseline suites with command logs. Classify pre-existing failures rather than erase them. No live-provider call.
- [ ] Create the vNext test configuration by following existing Vitest/Playwright fixtures; use real renderer/browser paths and static synthetic records. Tests run without credentials.
- [ ] Add a non-placeholder harness smoke assertion:

```ts
import { expect, it } from 'vitest';
import { fixtureRows } from './fixtures/people';
it('has deterministic synthetic identities and no production data', () => {
  expect(fixtureRows.map(row => row.id)).toEqual(['ada', 'sam']);
  expect(fixtureRows.map(row => row.team)).toEqual(['Design', 'Engineering']);
});
```

- [ ] Run the new smoke test, then existing affected checks. Record no product behavior as verified by this smoke test. Update checkpoint and review baseline before moving on.

**Commands introduced:** `test:vnext` runs build prerequisites + the new Vitest config + strict test typecheck; `test:vnext:browser` runs build prerequisites + the new Playwright config. Exact commands are recorded in package.json and the quality matrix rather than maintained only in prose.

## T01 — Freeze the API through consumer-first design probes

**Requirements:** RQ03, RQ45. **Dependencies:** T00.

**Create:** `tests/vnext/api-contract.ts`, `tests/vnext/types/local.tsx`, `tests/vnext/types/advanced.tsx`, `tests/vnext/types/invalid.tsx`, `docs/adr/<next-id>-surface-api.md`. Determine the next ADR ID from the actual directory. **Modify later:** corresponding public exports only when implementation lands.

**Consumes:** specification controller/ownership definitions. **Produces:** frozen candidate signatures and generic constraints for `defineFeature`, `defineDataFeature`, runtime `createSurface`, `useDataSurface`, `useSurface`, `useSurfaceState`, `AdaptiveSurface`, `ViewSurface`, native React view binding, ScopeController/AeliqoScope lifecycle, and connectAgent({scope,client,targets}) lifecycle. `contracts/contract-probe.ts` is a reviewed design model; reconcile it with real exports, never ship its declare-only functions. Reuse compatible existing symbols rather than create synonyms.

- [ ] Write complete consumer examples for local rows, remote source, two instances, controlled state, a custom React view, SSR, voluntary scope switching, forced logout, workspace-layout adaptation, and optional explicitly targeted agent connection. Include providers and every declared binding.
- [ ] Typecheck the design using declaration-only contracts clearly marked as design probes. Pin negative cases:

```tsx
// Design probe: declarations only, not runtime acceptance.
const local = useDataSurface({ data: [{ id: '1', name: 'Ada' }], getRowId: row => row.id });
<AdaptiveSurface surface={local} />;
// @ts-expect-error credentials are never renderer props
<AdaptiveSurface surface={local} apiKey="test-only" />;
// @ts-expect-error must pass a live instance, not an immutable feature
<AdaptiveSurface surface={peopleFeature} />;
// @ts-expect-error model text is not a typed intent
local.request('show everybody');
```

- [ ] Review two API options only if a concrete existing export conflict requires it. Choose once, record rationale, and update all examples together. Do not endlessly rename helpers.
- [ ] Specify local identity fallback, async data ownership, runtime lifecycle, immutable per-instance addressing, controlled request acceptance, scope activation vs cache identity, and native React renderer bindings in the ADR. Freeze a schema/contract version and documentation source map; no helper exists only as a chat example. Keep renderer props small and use composition for controls.
- [ ] Run strict TypeScript without broad `any`, `unknown as`, or unchecked assertions. Review declarations independently. Mark this milestone as design-contract verified, not implemented.

## T02 — Immutable feature contracts and compatibility lowering

**Requirements:** RQ04, RQ33. **Dependencies:** T01.

**Create:** focused modules under `packages/core/src/features/` for definitions, validation, data-feature lowering, and exports. **Modify:** `packages/core/src/app/types.ts`, `resource.ts`, export map, contract schema source only when necessary. **Tests:** `tests/vnext/feature.test.ts`, core installed consumer.

**Consumes:** current ResourceDefinition/Intent/Meaning/Outcome types. **Produces:** immutable typed FeatureDefinition and data convenience definition. Data definitions lower into existing resources; non-data definitions reference declared capability schemas without a fake relational catalog.

- [ ] Add a failing test for immutable reusable definitions and unknown view/capability references:

```ts
it('does not put session state into a reusable feature', () => {
  const feature = defineDataFeature({ id: 'people', schema: PersonSchema, identity: ['id'] });
  expect(Object.isFrozen(feature)).toBe(true);
  expect('principal' in feature).toBe(false);
  expect('rows' in feature).toBe(false);
  expect('apiKey' in feature).toBe(false);
});
```

- [ ] Implement bounded definitions and schema inference with existing validators, typed discriminated unions, and explicit errors. No provider/DOM/React imports.
- [ ] Add a non-data definition fixture with a typed configuration intent and job status capability. Define the required capability contract deliberately; preserve wire-version compatibility.
- [ ] Test invalid identity/schema references, duplicate capability/view IDs, missing semantics, and mutation attempts. Compare lowered data behavior with the old resource path.
- [ ] Run `pnpm test:contracts`, `pnpm test:semantics`, `pnpm test:core:consumers`, boundary checks, and focused vNext tests. Update canonical package docs and checkpoint.

## T03 — Scoped surface instances, ownership, and registry lifecycle

**Requirements:** RQ05, RQ07. **Dependencies:** T02.

**Create:** focused modules under `packages/runtime/src/surfaces/` for controller, state, lifecycle, ownership, and registration. **Modify:** existing runtime app/controller and RegionStore seams rather than duplicate stores. **Tests:** `tests/vnext/surface.test.ts`, `controlled.test.ts`, `registry.test.ts`.

**Produces:** runtime `createSurface({scope, id, feature, bindings, ownership?})`, SurfaceController, immutable snapshots, and ref-counted scoped registration. Current app APIs remain compatibility paths.

- [ ] Write and observe failure of instance isolation:

```ts
it('keeps two instances of a feature independent', async () => {
  const f = createPeopleFixture();
  const a = f.runtime.createSurface({ scope: f.scope, id: 'left', feature: f.feature, bindings: f.bindings });
  const b = f.runtime.createSurface({ scope: f.scope, id: 'right', feature: f.feature, bindings: f.bindings });
  const before = b.getSnapshot();
  await a.request({ kind: 'browse', filter: { op: 'compare', field: 'team', comparison: 'eq', value: 'Engineering' } });
  expect(b.getSnapshot()).toBe(before);
  expect(a.id).not.toBe(b.id);
  f.dispose();
});
```

- [ ] Implement the inert local scope/address kernel required to create a controller, with real local read-only authorization; T04 extends transitions and host binding. Every surface address is immutable and includes scope activation and surface generation. Old callbacks may not resolve a target by feature name.
- [ ] Implement stable handles and bounded request/state retention; no name-based global singleton. Explicit duplicate instance IDs fail, identical module registration is reference-counted, incompatible revisions fail.
- [ ] Add controlled-host acceptance/rejection tests. `request()` returns proposed until host acceptance; no hidden internal commit. Test delayed/out-of-order approval and proposal-loop prevention.
- [ ] Test dispose idempotency, wrong-target errors, unregister while pending, permission change, and no retained listeners after teardown.
- [ ] Run regions/results/interaction tests and runtime consumer. Review lifecycle ownership and checkpoint.

## T04 — Scope activation, safe workspace transitions, and draft guards

**Requirements:** RQ37, RQ39, RQ40. **Dependencies:** T03.

**Files:** Create focused runtime modules under `packages/runtime/src/scopes/` for address, controller, transition, guard, activation and teardown; test files `tests/vnext/scope.test.ts`, `scope-race.test.ts`, `scope-draft.test.ts` and `tests/vnext/fixtures/scope.ts`. Reuse existing authority/RegionStore/action APIs. React context is implemented in T10, not imported into runtime here.

**Consumes:** inert scope/address kernel and immutable SurfaceController from T03, existing authority resolution and cancellation contracts. **Produces:** ScopeController `getSnapshot/subscribe/attach/requestChange/invalidate/dispose`, monotonic activation epochs, immutable target fencing, explicit leave-guard handling, and host-bound resolver. `runtime.createScope({binding,initial})` creates an inert controller; activation/attachment starts effects, not object construction during React render. Full behavioral types: `08-CONTRACTS.md`.

- [ ] Create `createScopeFixture()` using real runtime and synthetic host membership/data boundaries. It returns `{scope, currentOrders, host, source, view, release, activate, captureAddress, dispose}`. `source.deferNext()` installs a one-shot delay for the next real source read and returns `{started, resolve}`. `currentOrders()` returns the current activation's real controller; `view.readRows()` observes committed results; `host.beforeLeave` and `host.revoke` alter host boundary behavior. All outcomes come from product code.
- [ ] Write and run this failing test; prove the A request actually started before switching:

```ts
it('never retargets a captured A handle or accepts its late result after A-B-A', async () => {
  const f = await createScopeFixture();
  await f.activate('acme');
  const a1 = f.currentOrders();
  const deferred = f.source.deferNext();
  const pending = a1.request({ kind: 'browse' });
  await deferred.started;
  expect((await f.scope.requestChange({ kind: 'workspace', id: 'globex' })).status).toBe('active');
  expect(f.view.readRows()).not.toContainEqual(f.source.acmePrivateRow);
  expect(['stale', 'cancelled', 'disposed']).toContain((await a1.request({ kind: 'browse' })).status);
  expect((await f.scope.requestChange({ kind: 'workspace', id: 'acme' })).status).toBe('active');
  const a2 = f.currentOrders();
  expect(a2.address.activationEpoch).toBeGreaterThan(a1.address.activationEpoch);
  expect(a2).not.toBe(a1);
  await a2.request({ kind: 'browse' }); // a fresh A2 read, not the deferred A1 read
  const beforeLateA1 = a2.getSnapshot();
  await f.release('acme'); // wait for the observed A1 transport completion, ignoring cancellation
  const outcome = await pending;
  expect(['stale', 'cancelled']).toContain(outcome.status);
  expect(a2.getSnapshot()).toBe(beforeLateA1);
  await f.dispose();
});
```

- [ ] Implement prepare/guard/resolve/fence/activate ordering. Resolve target membership before final acceptance, then recheck active/guard/policy revisions. Gate old target effects before publishing the new selector; never display A records as B while awaiting authority. An active selector without a successful new binding stays blocked, not implicitly authorized.
- [ ] Test dirty voluntary switch while the A subtree stays mounted and labeled as A: Stay keeps its draft and component identity, Save waits for actual save and stays on A on failure, Discard is explicit. Assert the active status is separate from pending selector/guard state. A draft edited during a pending guard or target lookup invalidates its old acceptance. A timeout/unknown save cannot silently become success. Missing guard on a known dirty runtime-owned form defaults to needs-input, not deletion.
- [ ] Test forced revocation/logout: old sensitive UI is hidden and effects fenced immediately; guard cannot keep invalid access alive. Opt-in recovery storage is partitioned by old scope and policy, never promoted into B or model context. No persistence is the default.
- [ ] Test A→B→C out-of-order membership responses, same ID under two organizations, detached controller callbacks, two parallel workspace tabs, nested scope narrowing, child scope disposal, and noncooperative renderer/source completions. Scope hierarchy is an explicit lineage tuple, not string concatenation.
- [ ] Test pending preview revocation separately from an executing transaction. An already started backend operation keeps its original scope/operation record and may complete; UI cancellation never claims to roll it back.
- [ ] Run focused vNext scope tests plus regions/results/actions/auth-retention tests. Review policy boundary before T05. Checkpoint the scope state-machine outcomes and actual regression results.

## T05 — Local data convenience and update correctness

**Requirements:** RQ08. **Dependencies:** T04.

**Create/modify:** `packages/runtime/src/surfaces/local-data.ts`, existing `packages/runtime/src/data/local/` snapshot and budget seams; React helper implementation follows in T10. **Tests:** `tests/vnext/local-data.test.ts`.

**Produces:** local binding backing both convenience and advanced controllers; explicit update/version semantics, inference diagnostics, identity behavior.

- [ ] Test a local source snapshot replacement through the real source while preserving the live controller:

```ts
it('updates source data without replacing the controller', async () => {
  const f = createPeopleFixture();
  const surface = f.runtime.createSurface({ scope: f.scope, id: 'people', feature: f.feature, bindings: f.bindings });
  await surface.request({ kind: 'browse' });
  const before = await f.observeRows(surface);
  expect(f.source.replaceSnapshot(f.updatedSnapshot).ok).toBe(true);
  expect((await surface.request({ kind: 'browse' })).status).toBe('committed');
  const after = await f.observeRows(surface);
  expect(before.find(row => row.id === 'sam')?.team).toBe('Engineering');
  expect(after.find(row => row.id === 'sam')?.team).toBe('Design');
  expect(surface.address.activationEpoch).toBe(f.scope.getSnapshot().activationEpoch);
  f.dispose();
});
```

- [ ] Implement structural inference/defaults only for bounded safe cases. Do not infer currency, additive metrics, arbitrary relationships, or full-dataset coverage from sample rows.
- [ ] Test no schema + empty data, schema + empty data, all-null columns, inconsistent records, nested input rejection/projection, duplicate/missing IDs, same-reference mutation contract, and configured capacity exceeded.
- [ ] Preserve existing limits unless a justified explicit new local profile is documented. Never silently truncate results while claiming complete data.
- [ ] Run data/query/semantics/runtime consumer checks; document supported shapes and update ownership.

## T06 — Remote data, coverage, caching, and semantic correctness

**Requirements:** RQ09, RQ10, RQ43. **Dependencies:** T05.

**Modify:** `packages/runtime/src/data/types.ts`, HTTP adapter/schema, source/planner seams, result descriptors; add facade lowering under surfaces if required. **Tests:** `tests/vnext/remote-data.test.ts`, `remote-server.test.ts`, `metrics.test.ts`.

**Produces:** capability-aware remote binding, complete/partial/total semantics, and cache invalidation boundaries without a second authoritative cache.

- [ ] Test a real synthetic HTTP server, not a stubbed final result:

```ts
it('does not treat a remote page as the full population', async () => {
  const f = await createRemotePeopleFixture({ logicalRows: 1_000_000, pageSize: 25, aggregate: false });
  const result = await f.surface.request(f.globalCountIntent);
  expect(result.status).toBe('unsupported');
  expect(f.server.observedRequests.some(r => r.kind === 'fetch-all')).toBe(false);
  await f.dispose();
});
```

- [ ] Implement declared operator/field/metric support; lower queries through current plan/execute validation. Return unsupported with remedies instead of implicit local emulation.
- [ ] Test stable cursors/order, nulls, unknown/estimated totals, partial result labels, schema/source revision invalidation, query cancellation, and cross-principal cache/cursor rejection. Classify cache keys by semantic identity and permission version, not every UI revision. Exercise A-B-A reuse only after reauthorization; pin snapshot cursors versus live keyset semantics. Same business row IDs across tenants must never collide.
- [ ] Pin analytics fixtures with known expected values: semi-additive month-end snapshots, ratio aggregation, mixed currencies, missing data, timezone/calendar and period boundaries.
- [ ] Run data/query/evaluation/scenario/security tests and update source/semantics guides with a complete server example.

## T07 — One deterministic adaptive decision engine

**Requirements:** RQ11. **Dependencies:** T03, T06.

**Modify:** existing `packages/core/src/presentation/` decision/validation modules and `packages/web/src/recipes/standard.ts` to use the shared seam. **Create if needed:** focused candidate eligibility/ranking/explanation modules, not a second resolver. **Tests:** `tests/vnext/resolver.test.ts`.

**Produces:** `resolvePresentation(input)` as the single pure facade over existing presentation selection and validation, returning the normalized decision in spec section 5. The fixture input owns `candidates`; all state, policy, result descriptors, and environment are injected. No hidden I/O or clock/model dependency.

- [ ] Pin deterministic output and candidate-order independence where policy does not specify order:

```ts
it('uses explicit tie-breaking instead of registration accidents', () => {
  const input = resolverFixture();
  const first = resolvePresentation(input);
  const reordered = resolvePresentation({ ...input, candidates: [...input.candidates].reverse() });
  expect(reordered).toEqual(first);
});
```

- [ ] Implement eligibility before ranking, explicit preference/pin semantics, injected environment buckets, bounded candidate work, and redacted explanations. Reuse parse/validatePresentationPlan.
- [ ] Test disallowed views, requested operations, unknown refs, mutable environment input, no-clock determinism, registry revision drift, and time-field/metric ambiguity.
- [ ] Run existing presentation-adaptation and task/experience tests. Compare old supported behavior; document intentional changes instead of blindly blessing new snapshots.

## T08 — Registered views, bounded composition, and state transfer

**Requirements:** RQ12. **Dependencies:** T07.

**Modify:** web recipe/presentation/registry/state-mapping modules; core composition constraints. **Tests:** `tests/vnext/presentation.test.ts`, browser composition cases.

**Produces:** real built-in browse, detail, compare, registered trend/bar, form, and bounded split/comparison presentation with validated links/coverage.

- [ ] Add a failing ambiguity test:

```ts
it('asks for a metric rather than guessing the first number', () => {
  const input = twoMetricTrendFixture();
  const result = resolvePresentation(input);
  expect(result.status).toBe('needs-input');
  if (result.status !== 'needs-input') throw new Error('Expected a clarification decision');
  expect(result.choices.map(choice => choice.id)).toEqual(['profit', 'revenue']);
});
```

- [ ] Candidate-plan details may use existing Outcome types; reconcile this acceptance shape once in T01/T07 rather than add parallel status systems.
- [ ] Implement explicit missing-candidate vs needs-input fallback behavior, bounded composition nodes/edges, view pin enforcement, and role/field/config validation.
- [ ] Test focus/selection/draft mapping between compatible views; reject unsupported mappings; do not force table-to-cards when simultaneous comparison is required.
- [ ] Add resize hysteresis, coalescing, and previous-UI preservation tests. Run adaptation/browser/consumer suites and document real adaptive eligibility per view.

## T09 — Workspace-wide adaptive presentation without tenancy changes

**Requirements:** RQ41. **Dependencies:** T04, T08.

**Files:** Extend existing core presentation graph/validation and runtime presentation/interaction seams. Create `tests/vnext/workspace-layout.test.ts`, `tests/vnext/fixtures/workspace.ts`; browser coverage joins T10/T13 under `tests/vnext/browser/workspace.spec.ts`. Do not create a parallel workflow engine or mandatory top-level Workspace component.

**Consumes:** scoped controllers, validated presentation graph, state mappings and registered typed intent. **Produces:** a bounded workspace presentation recipe plus explicit coordination contracts that reuse current graph/task/result validation. The same scope can present single, split/detail, and compare modes without recreating business features or changing principal/tenant.

- [ ] Implement `createWorkspaceFixture()` with real runtime, workspace presentation and child view bindings. It exposes `{surface, scope, intents, view, renderer, dispose}`. `intents.split` and `intents.compare` are registered typed custom intents; `view.snapshot()` reads the real validated plan plus child instance/address bindings, not a manufactured expected object.
- [ ] Write and observe failure of the main contract:

```ts
it('changes the workspace layout without changing scope or losing the current selection', async () => {
  const f = await createWorkspaceFixture();
  await f.surface.request(f.intents.browse);
  await f.view.selectThroughControl(['order-1', 'order-2']);
  const before = f.scope.getSnapshot();
  await f.surface.request(f.intents.compare);
  const after = f.view.snapshot();
  expect(after.layout).toBe('compare');
  expect(after.selectedIds).toEqual(['order-1', 'order-2']);
  expect(f.scope.getSnapshot()).toBe(before);
  expect(after.scopeEpoch).toBe(before.activationEpoch);
  await f.dispose();
});
```

- [ ] Use a single coordinating surface for one bounded multi-pane plan by default. Child nodes have stable identities and one render owner. Cross-independent-surface coordination is explicitly registered, not implicit broadcasting to all features.
- [ ] Prepare new results/views against one scope activation. Recheck read sets and child revisions before publication. A failed required child retains the authorized prior layout; optional partial children are labeled under explicit policy. Concurrent user edits invalidate an obsolete plan rather than being overwritten.
- [ ] Test lazy child failure, unsupported view/metric, mixed-scope child injection, duplicate ownership, resize during edit, renderer exception and late acknowledgement. View composition cannot execute mutations or pretend backend transactions are atomic.
- [ ] T10/T13 browser tests must verify actual panes/labels/focus/drafts, not only a plan ID. Controls and fake-model intents take the same route. Leave application header/sidebar/router outside the adaptive area untouched.
- [ ] Run graph/coverage/state-transfer tests and focused vNext cases. Document simple surface adaptation versus workspace composition versus tenant transition as separate concepts.

## T10 — React DX, native custom views, and headless consumption

**Requirements:** RQ02, RQ06, RQ13. **Dependencies:** T04, T09.

**Create:** `packages/react/src/surface/` hooks, render components, native view binding, selector integration. **Modify:** React context/exports and web registration boundaries only as needed. **Tests:** `tests/vnext/react.spec.tsx`, `tests/vnext/browser/react.spec.ts`, installed consumer fixture.

**Produces:** `useDataSurface`, `useSurface`, `useSurfaceState`, `AdaptiveSurface`, `ViewSurface`, native renderer binding, AeliqoScope consuming a ScopeController, and useAeliqoScope from the frozen T01 contract. Optional agent connection remains in @aeliqo/agent/browser, never imported by the default React entry.

- [ ] Add real browser/React tests:

```ts
test('keeps normal controls usable without a model connection', async ({ page, baseURL }) => {
  if (baseURL === undefined) throw new Error('This fixture requires a configured baseURL');
  const fixtureOrigin = new URL(baseURL).origin;
  const providerRequests: string[] = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== fixtureOrigin) {
      providerRequests.push(request.url());
    }
  });
  await page.goto('/vnext/people-no-ai');
  await page.getByRole('button', { name: 'Engineering' }).click();
  await expect(page.getByText('Sam Rivera')).toBeVisible();
  await expect(page.getByText('Ada Chen')).not.toBeVisible();
  expect(providerRequests).toEqual([]);
});
```

- [ ] Fixture origin handling must be set before navigation so startup document requests are not misclassified; include an explicit allowed static asset set if needed, never a broad provider exception.
- [ ] Implement pure/inert hook construction and effect-owned attachment; correctly replay Strict Mode setup/cleanup without permanent disposal of a reused handle. Use stable external-store selectors, not global context broadcasts. Do not unconditionally suspend an existing surface when external-store state chooses a lazy renderer; preload/stage the candidate and keep the authorized previous presentation until ready. Scope activation creates new targets, while ordinary data updates preserve target identity.
- [ ] Prove React context, controlled input, portals, error boundaries, and host component identity through native custom view rendering. Do not mount a new React root for each presentation node.
- [ ] Test providerless local scope, provider-owned advanced runtime, no dispose of injected runtime, no double registration, interrupted render, duplicate render ownership, and component unmount during async work.
- [ ] Run platform/framework/React installed consumers and module graph assertion. Remove design-probe-only imports from actual runtime consumers.

## T11 — Host actions and a genuine non-data feature

**Requirements:** RQ14, RQ15. **Dependencies:** T04, T10.

**Modify:** existing runtime action boundaries and feature/capability binding. **Create:** non-data fixture under `examples/vnext/job/`; action integration tests `tests/vnext/actions.test.ts`, `job.test.ts`.

**Produces:** typed action references retaining current preview/confirm/execute behavior; job progress/cancel/output capability that does not force rows into the data engine.

- [ ] Test stale confirmation against the real action boundary:

```ts
it('cannot execute a preview after host authorization changes', async () => {
  const f = createActionFixture();
  const preview = await f.previewRefund();
  f.host.revokeExecution();
  const result = await f.confirmAndExecute(preview);
  expect(result.ok).toBe(false);
  expect(f.backend.effects).toHaveLength(0);
  await f.dispose();
});
```

- [ ] Reuse current action types and ambiguity states. Server idempotency includes durable operation identity when effects survive process restart; frontend retry maps are not the durability mechanism.
- [ ] Test double submit, changed payload/revision, expired confirmation, ambiguous timeout, inspect-before-retry, backend restart, and cancellation after completion.
- [ ] Implement synthetic file/job flow with host-owned progress and opaque output refs. No real file/customer transfer to models. Editing/animation loops remain outside semantic orchestration.
- [ ] Run action/security/protocol-boundary checks, document ownership, and demonstrate both manual and optional agent proposals using the same action contract.

## T12 — SSR, hydration, framework and islands compatibility

**Requirements:** RQ16, RQ17. **Dependencies:** T10.

**Modify:** React SSR and web SSR/hydration seams, `examples/next-platform`, existing Vanilla/Vue framework fixtures. **Create:** minimal static/island embedding fixture under `examples/vnext/islands/`; `tests/vnext/browser/ssr.spec.ts`.

**Produces:** safe request-scoped server snapshot and matching initial client state; documented support matrix.

- [ ] Assert useful content before JavaScript:

```ts
test('server output contains useful initial DOM with JavaScript disabled', async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error('SSR fixture requires baseURL');
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  try {
    const page = await context.newPage();
    const response = await page.goto('/vnext/ssr/people');
    expect(response?.ok()).toBe(true);
    await expect(page.getByRole('cell', { name: 'Ada Chen', exact: true })).toBeVisible();
    const html = await response!.text();
    expect(html).not.toContain('TEST_PRIVATE_CREDENTIAL');
  } finally {
    await context.close();
  }
});
```

- [ ] Render two concurrent requests with different synthetic principals and marker records; assert no cross-user markup/snapshot/cache. Capture hydration mismatch and console errors.
- [ ] Honor host framework server/client boundaries and initial environment fallback; do not infer SSR from an empty div rendered before an effect. Test disabled JS, slow hydration, rapid navigation, RTL, and theme bootstrap.
- [ ] Preserve existing Vue/Vanilla integration; prove a static/island embedding without creating a mandatory new framework package. Unsupported adapters stay clearly marked.
- [ ] Run `pnpm test:framework:consumers`, `pnpm test:next-platform`, SSR package consumers and vNext browser cases. Record actual runtime/browser versions.

## T13 — Accessible and predictable adaptive experience

**Requirements:** RQ18, RQ19. **Dependencies:** T08, T09, T10, T11, T12.

**Modify:** existing input/feedback/data/navigation/view components and design token source as required; do not replace branding gratuitously. **Tests:** relevant component-family suites plus `tests/vnext/browser/experience.spec.ts`.

**Produces:** complete states, clarification controls, preserved work, consistent tokens/locale, and composable host UI integration.

- [ ] Test keyboard recovery and draft preservation:

```ts
test('a layout change does not discard an unsaved draft', async ({ page }) => {
  await page.goto('/vnext/form');
  await page.getByLabel('Name').fill('Unsubmitted draft');
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(page.getByLabel('Name')).toHaveValue('Unsubmitted draft');
  await page.getByRole('button', { name: 'Cancel' }).focus();
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();
});
```

- [ ] Implement visible filtering/scope/metric choices and loading, refresh, empty, partial, stale, denied, unsupported, error, cancelled states. Keep previous valid UI on recoverable errors.
- [ ] Review focus movement, announcements, reduced motion, touch targets, zoom, RTL, long translated text, number/date/timezone formatting, and high contrast. New adaptive controls reuse proper native/component semantics.
- [ ] Run affected family tests, `pnpm test:components:a11y`, browser checks, and `pnpm test:visual` at required widths in three engines. Store actual screenshots outside committed source. Log missing manual assistive-technology qualification explicitly.

## T14 — Optional scoped agent bridge and truthful receipts

**Requirements:** RQ20, RQ35, RQ38, RQ44. **Dependencies:** T04, T09, T10, T11.

**Modify:** `packages/agent/src/app/`, protocol/session/capability modules, optional web client transport; runtime dispatch boundary only through the shared seam. **Tests:** `tests/vnext/agent-bridge.test.ts`, browser agent parity cases.

**Produces:** session-bound connectAgent({scope,client,targets}) lifecycle targeting explicit surface IDs, bounded authorized context discovery, and actual operation receipts.

- [ ] Test a model that only says it changed the screen:

```ts
it('does not claim success for model prose without a renderer receipt', async () => {
  const f = createAgentFixture({ modelResponse: { text: 'Done', calls: [] } });
  const result = await f.runExperience('Show Engineering');
  expect(result.status).toBe('no-commit');
  expect(f.surface.getSnapshot()).toEqual(f.initialSnapshot);
  await f.dispose();
});
```

- [ ] Use current loop outcomes or a documented facade mapping; do not invent a second truth signal. Preserve runtime commit vs renderer acknowledgement vs business effect distinctions.
- [ ] Connect/disconnect without changing feature definitions or manual UI. Do not register every runtime surface automatically for model access. Model input contains minimal approved metadata, not all rows. connectAgent is an optional imperative adapter; a host React effect wrapper passes its explicit scope and allowlisted targets and closes the connection on cleanup. There is no ambient AgentBridge inferring a descendant scope. Preserve a transport connection only when origin/credential policy and protocol permit it.
- [ ] Test manual/agent equivalent intent parity, expired sessions, wrong principal/surface/epoch, delayed controlled approval, missing native WebMCP, forged acknowledgements, and disconnect during request.
- [ ] Test an agent request started in workspace A, switch to workspace B before completion, then resolve the old tool/model response. It must be stale/cancelled and must not mutate workspace B. The underlying transport may stay connected; revoke the old capability endpoint and any stored provider response/continuation ID, clear old context, and pair a new scope/goal session before B requests. Prove the next outbound model payload has no A transcript, reasoning continuation, row or tool-result marker.
- [ ] Verify model-visible context contains only the current authorized scope's bounded metadata. The model cannot switch tenant/workspace by submitting a different scope ID, and no prior-scope rows, selections, confirmations, or cached tool results are reused after transition.
- [ ] Preserve MCP/WebMCP adapters with separate native/simulated evidence. Run agents/protocol consumers and real browser parity tests using fake model transport only.

## T15 — Protocol-based BYOK and provider conformance

**Requirements:** RQ21, RQ22. **Dependencies:** T14.

**Modify:** current model protocol/connection/Chat Completions/Responses modules, credential handling, server helper exports. **Tests:** `tests/vnext/model-profile.test.ts`, current protocol-model suites and installed agent consumer.

**Produces:** explicit protocol/capability configuration, redacted env setup, optional local no-auth profile, generic compatible endpoint testing, and qualification matrix.

- [ ] Add an explicit local profile test:

```ts
it('supports explicitly allowed local no-auth without a dummy secret', async () => {
  const f = await createModelProtocolFixture({ auth: 'none', endpoint: 'local-allowlisted' });
  await f.runToolTurn();
  expect(f.receivedHeaders.authorization).toBeUndefined();
  expect(f.receivedToolCalls).toHaveLength(1);
  await f.dispose();
});
```

- [ ] Implement auth-none as an explicit policy-checked union member, not a permissive fallback when keys are missing. Hosted missing credentials fail safely. Never infer vendor/model from URL or key format.
- [ ] Retain protocol distinctions; test alternate token parameter support, absent usage/token-count endpoint, rejected streaming, tool call correlation, multiple calls, malformed JSON, oversized data, timeout and retry budgets.
- [ ] Keep server-only secret/credential resolvers out of browser graphs. Fixture requests do not contact real providers. Live tests require separate approved endpoint/model/corpus/spend cap; record absent permission as a live-qualification blocker.
- [ ] Run protocol-model/agent consumer/security checks. Document configuration recipes and actual tested model profiles, not a universal compatibility checkbox.

## T16 — Threat model, authority, retention, and abuse limits

**Requirements:** RQ23, RQ34, RQ42. **Dependencies:** T11, T12, T14, T15.

**Modify:** appropriate existing runtime/agent/server boundary modules; create threat model under docs and `tests/vnext/security.test.ts`. **Produces:** adversarial test coverage with scoped grants, retention, quotas, and egress enforcement.

- [ ] Pin cross-scope rejection:

```ts
it('rejects a request carrying another tenant scope', async () => {
  const f = createTwoTenantFixture();
  const result = await f.tenantB.invoke(f.tenantA.capturedRequest);
  expect(result.status).toBe('denied');
  expect(f.tenantB.backend.effects).toHaveLength(0);
  expect(f.tenantB.visibleRows).not.toContainEqual(f.tenantA.privateRow);
  await f.dispose();
});
```

- [ ] Test prompt injection in data, arbitrary URL/module/HTML payloads, forged authority, client metadata as grants, principal change, stale confirmations, cross-tenant cursors/cache, secret-bearing errors, unexpected redirects, and replay. Include cookie-auth CSRF checks, CORS allowlist enforcement, escaped SSR inline serialization and rich-text/URL rendering, getters/prototype-polluting keys in untrusted input, request-scoped HTTP caches, signed output URL exposure, bfcache/session revalidation and origin-bound tool sessions. These are boundary tests, not a claim that the framework owns host authentication.
- [ ] Exercise slow transports, noncooperative cancellation, huge tool output, pending queues, repeated calls, exhausted quotas, and result retention. Limits fail closed with recoverable errors.
- [ ] Audit server enforcement separately from UI hiding and browser receipts. Retain ambiguous effects rather than treating a timeout as a failed transaction.
- [ ] Run security, auth-retention, action, protocol, and boundary checks; independent security review before qualification.

## T17 — Every component documented and copyable examples verified

**Requirements:** RQ24, RQ25. **Dependencies:** T13, T14, T15, T16.

**Modify:** `docs/site/components/<id>.md`, `docs/site/pages/`, `docs/packages/`, `examples/catalog/`, docs generators and catalog tests. **Create:** inventory coverage gate under existing docs tooling, not a parallel docs platform.

**Produces:** exact current catalog/doc/example/API parity and complete beginner/production/agent guides.

- [ ] Enumerate every active catalog ID and create a per-ID subtask row in the task ledger. Each subtask owns its actual component page and runnable example. Do not stop after a sample of ten components.
- [ ] Fail on missing current pages:

```ts
it('has one current authored page per active catalog component', async () => {
  const catalog = JSON.parse(await readFile('catalog/components.json', 'utf8'));
  const expected = catalog.components.map((item: { id: string }) => `${item.id}.md`).sort();
  const actual = (await readdir('docs/site/components')).filter(name => name.endsWith('.md')).sort();
  expect(actual).toEqual(expected);
});
```

- [ ] For each component, perform the exact checklist in acceptance section 3, implement missing behavior or label unsupported truthfully, update the example, typecheck/copy/install it, and run family/browser checks. Review generated defaults/events against actual declarations.
- [ ] Include standalone vs semantic vs automatic adaptive eligibility. Example previews must use the same source as copy buttons; no screenshot-only proof.
- [ ] Update onboarding, troubleshooting, SSR, custom UI, agent model profiles, migration, and machine-readable documentation map from canonical inputs. No old invented API in current quickstart.
- [ ] Run catalog examples, docs artifact verification, package consumers, site build/test, and link/search checks. Every ID has evidence, not just a generated page count.

## T18 — Four cross-domain reference journeys and value comparison

**Requirements:** RQ26. **Dependencies:** T17.

**Create/modify:** `examples/vnext/` content, consumer, enterprise, job fixtures; corresponding public docs and `tests/vnext/browser/journeys.spec.ts`.

**Produces:** working examples covering distinct data/non-data and small/large-app integration needs, with manual/agent parity where appropriate.

- [ ] Specify task outcomes and equivalent host-only baselines; synthetic data only. Do not build another production business product.
- [ ] Add a consumer journey assertion:

```ts
test('manual comparison and agent comparison commit the same intent', async ({ page }) => {
  await page.goto('/vnext/catalog');
  const manual = await runManualCompareJourney(page, ['p1', 'p2']);
  await resetJourneyThroughHostControl(page);
  const assisted = await runFixtureAgentCompareJourney(page, ['p1', 'p2']);
  expect(assisted.normalizedIntent).toEqual(manual.normalizedIntent);
  expect(assisted.selectedIds).toEqual(manual.selectedIds);
});
```

- [ ] Implement public-content/islands, consumer catalog, enterprise remote/approval, and non-data job/editor flows using public package APIs. No privileged internal imports in reference consumers.
- [ ] Record integration steps, glue-code/duplicate-state comparison, debugging effort, and any human usability sessions actually conducted. Do not fabricate value measurements or claim product-market fit.
- [ ] Run journeys from installed tarballs in three browsers where supported; refresh docs and coverage state.

## T19 — Bundle, latency, heap, and module-scale qualification

**Requirements:** RQ27, RQ28. **Dependencies:** T12, T13, T14, T15, T16, T17, T18.

**Modify:** existing `tests/performance/`, consumer manifests, relevant runtime hot paths only when measurements justify it. **Create:** vNext workload manifest and raw-sample report generator within existing performance tooling.

**Produces:** source-bound qualification for the exact profiles in acceptance section 4.

- [ ] Add deterministic isolation assertions before timing claims:

```ts
it('does not notify an unrelated surface on an intent change', async () => {
  const f = createTwoSurfaceFixture();
  let notifications = 0;
  const unsubscribe = f.right.subscribe(() => { notifications += 1; });
  await f.left.request(f.engineeringIntent);
  expect(notifications).toBe(0);
  unsubscribe();
  await f.dispose();
});
```

- [ ] Run installed-tarball graphs/caps, current runtime/browser/heap/adverse tests, and new workload tiers using the recorded environment. Report both total and incremental costs accurately.
- [ ] Measure resolver CPU, event-to-paint, remote window memory, live module count, discovery bytes, listener counts, and post-disposal heap. No model/network time hidden inside resolver benchmarks.
- [ ] Fix measured hot paths by indexing, selector isolation, bounded queues, incremental updates, or lazy loading; do not cache across permission boundaries. Rerun correctness after every optimization.
- [ ] Store all raw repetitions and failures, retain baseline comparison, and report failed profiles honestly. No silent threshold/fixture reduction.

## T20 — Packaging, migrations, and qualified support

**Requirements:** RQ29, RQ36, RQ46. **Dependencies:** T17, T18, T19.

**Modify:** package export maps, optional-peer metadata, release metadata, migration guide, support matrix, consumer fixtures. **Produces:** installable vNext candidate with deliberate compatibility policy and no secret/server import leakage.

- [ ] Create a clean consumer for old 0.4 public usage and one for each new entry; compile and run from packed artifacts rather than workspace symlinks.
- [ ] Assert unexpected browser imports are absent:

```ts
it('keeps the no-agent entry free of model and server modules', () => {
  const forbidden = noAgentGraph.modules.filter(id => {
    const path = id.replaceAll('\\', '/');
    return path.startsWith('node:') ||
      path.includes('@aeliqo/agent/') ||
      path.includes('/node_modules/openai/') ||
      path.includes('/node_modules/server-only/');
  });
  expect(forbidden).toEqual([]);
});
```

- [ ] Normalize real installed module IDs before the assertion, extend the forbidden set to every resolved provider/server-only dependency in the lockfile, and preserve the existing bundle-gate checks. Negative-test the detector by intentionally bundling a forbidden import in a disposable fixture; the detector must fail. Test server helpers intentionally fail or remain unavailable in browser entrypoints.
- [ ] Select the next release line from registry/workflows and actual breakage. Preserve historical tags/packages; add versioned migration and deliberate compatibility adapters. Avoid endless aliases and unsupported dual engines.
- [ ] Publish the precise framework/browser/provider/workload qualification matrix, with untested entries visibly unqualified. Verify docs install commands against the actual candidate.
- [ ] Run export/framework/protocol/package-notice consumers and full affected checks; freeze the candidate source for review.

## T21 — Full review, candidate, and authorized release

**Requirements:** RQ30, RQ31. **Dependencies:** T00, T01, T02, T03, T04, T05, T06, T07, T08, T09, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20.

**Read/modify:** actual discovered release workflows, quality evidence wiring, site-image/GitOps contracts only within authorized scope; docs/release records and checkpoint. No speculative new infrastructure.

**Produces:** independently reviewed candidate and separate published/deployed/runtime-verified evidence, or exact external blockers.

- [ ] Re-read every requirement row and task evidence. Resolve missing tests/docs/support claims. An implemented task without required evidence is not verified.
- [ ] Run the complete fresh `pnpm check` on the candidate commit, with new categories wired into the acceptance matrix. Verify source digest stayed unchanged; run required supplemental qualification separately when appropriate.
- [ ] Perform independent whole-diff review for API consistency, ownership/security, SSR, data semantics, adaptive UX, migration, and dependency cost. Fix findings with regression tests and invalidate stale review/evidence when source changes.
- [ ] Build clean tarballs/site image from the same accepted source. Verify package contents, notices, integrity, provenance, consumers, and production-image smoke without replacing current production prematurely.
- [ ] If and only if explicit current authorization and required approvals are available, execute existing RC → clean registry consumer → stable package/image → reviewed deployment procedures. Revalidate exact versions/tags rather than reuse historical 0.4 commands. Keep npm and site deployment states separate.
- [ ] Verify live health, readiness, version/source/image digest, docs/search/playground, representative no-AI and agent-disabled paths, and package installation. Keep rollback digest and release-repair procedure. A successful build or workflow dispatch alone is not a deployed result.
- [ ] If publication/production access or approval is unavailable, retain the fully tested candidate, report that exact release blocker, and do not claim publication/deployment. Continue other unblocked verification.
- [ ] Produce the acceptance final report described in `03-ACCEPTANCE.md` and update `07-EXECUTION-STATE.md` so another session can reconcile source-to-live state.

## Completion checklist

- [ ] RQ01–RQ46 mapped to actual source-bound evidence.
- [ ] Every catalog ID has its own complete page and executed example.
- [ ] No-AI, custom host UI, remote data, SSR, multi-instance, non-data, and optional agent paths verified.
- [ ] Security and recovery behavior tested, not inferred from type signatures.
- [ ] Performance profiles and limits published accurately.
- [ ] API contract, migration, exports, docs, and installed consumers agree.
- [ ] Release states and remaining blockers are explicit; no broad "done" over blocked gates.


## Appendix A — Shared test fixture contracts

These are test-only setup/observation contracts. Implement each helper in its owning task using actual production modules. They do not create alternate product APIs. When the frozen public contract changes in T01, update these signatures, the task assertions, and installed consumers in the same change. A declaration-only probe may exist before implementation; a runtime test cannot pass by returning manufactured product outcomes.

### Deterministic People data (T00)

`tests/vnext/fixtures/people.ts` owns the following data and schema. Export `PersonSchema` to the feature fixture, rather than maintaining two schema definitions.

```ts
import { z } from 'zod';

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  team: z.enum(['Design', 'Engineering']),
});
export type Person = z.infer<typeof PersonSchema>;
export const fixtureRows: readonly Person[] = Object.freeze([
  Object.freeze({ id: 'ada', name: 'Ada Chen', team: 'Design' as const }),
  Object.freeze({ id: 'sam', name: 'Sam Rivera', team: 'Engineering' as const }),
]);
export const updatedRows: readonly Person[] = Object.freeze([
  fixtureRows[0]!,
  Object.freeze({ id: 'sam', name: 'Sam Rivera', team: 'Design' as const }),
]);
```

Each test module imports `it/expect` from Vitest or `test/expect` from its configured Playwright fixture, and imports the exact named helpers below. Snippets in tasks are the behavior assertions to embed in those modules, not complete product source or a claim of already executable vNext packages.

| Helper / observation | Owner and path | Required implementation and return contract |
|---|---|---|
| `createScopeFixture()` | T04, `tests/vnext/fixtures/scope.ts` | See T04: actual runtime/scope/controllers plus synthetic host membership and delayed source boundary. Old handles remain old targets. `deferNext().started` resolves only when real source execution begins; `release(scopeId)` releases the one observed deferred request and awaits its transport completion and product continuations, using the deterministic fixture scheduler. Later same-tenant requests are not deferred. This is not an arbitrary sleep. |
| `createWorkspaceFixture()` | T09, `tests/vnext/fixtures/workspace.ts` | See T09: actual scoped composite surface, registered intents and render-plan observer. Selection is made through real controls/interaction port. No fake plan/receipt success. |
| `peopleFeature` | T02, `tests/vnext/fixtures/people.ts` | Export the real `defineDataFeature({id:'people',schema:PersonSchema,identity:['id']})` result. No runtime or principal in the definition. |
| `createPeopleFixture()` | T03/T05, same file | Return actual runtime, active local scope, feature, typed bindings, and actual LocalDataService. `observeRows(surface)` reads the real committed ResultStore through its public result reader, not a fixture copy. `updatedSnapshot` uses the same catalog with a new sourceRevision and `updatedRows`. `dispose()` releases all owned surfaces/runtime. Default authority is a synthetic, explicit host grant, not a fake dispatcher. |
| `createControlledFixture()` | T03, `tests/vnext/fixtures/host.ts` | Return People fixture plus `hostStore` with stable `getSnapshot/subscribe`, revision-checked accept/reject operations, and read-only `proposals`. Host store is a boundary fake; all requested operations still go through the real controller. |
| `createRemotePeopleFixture(options)` | T06, `tests/vnext/fixtures/remote.ts` | Start a localhost HTTP source implementing real server handlers. Options are `{logicalRows:number,pageSize:number,aggregate:boolean}`. Return live surface, a typed registered global-count intent, `server.observedRequests: readonly {kind:string}[]`, and async disposal. Record request observations before server evaluation, never by guessing final results. Generate rows by cursor/window; do not allocate the entire logical population. |
| `resolverFixture()` | T07, `tests/vnext/fixtures/presentation.ts` | Return a full normalized resolver input with equivalent permitted table/list candidates, approved descriptors, no explicit ordered preference, and fixed environment/current revision. Use stable IDs for tie-breaking. |
| `twoMetricTrendFixture()` | T08, same file | Use one explicit date field and two approved numeric measures identified `profit` and `revenue`; request a trend without selecting either measure. Return the same normalized input type as resolverFixture. No network operation in fixture decision evaluation. |
| `createActionFixture()` | T11, `tests/vnext/fixtures/actions.ts` | Bind the real action boundary to a fake side-effecting backend. Expose `previewRefund()`, `confirmAndExecute(preview)`, `host.revokeExecution()`, `backend.effects` observations, and async `dispose()`. Preview and confirmation results must come from production action code. |
| `createAgentFixture(options)` | T14, `tests/vnext/fixtures/agent.ts` | Options contain bounded fake model response text/calls only. Return actual live surface, pre-request initialSnapshot, `runExperience(prompt)` returning a normalized observation of the existing loop outcome, and async disposal. `no-commit` is mapped from the actual missing-receipt outcome; never inserted solely because a test expects it. |
| `createModelProtocolFixture(options)` | T15, `tests/vnext/fixtures/model.ts` | Options `{auth:'none',endpoint:'local-allowlisted'}` select an ephemeral localhost protocol fixture with explicit egress permission. Return `runToolTurn()`, observed HTTP `receivedHeaders`, decoded `receivedToolCalls`, and async disposal. Use real connection encoder/decoder and loop; the fake endpoint returns a fixed correlated tool proposal. |
| `createTwoTenantFixture()` | T16, `tests/vnext/fixtures/security.ts` | Return tenantA and tenantB with actual authenticated request scopes. A captured request is the actual serialized request including its A-bound correlation/capability, not a hand-authored fake grant. B's `invoke(request)` uses B server credentials and real validation. Each exposes `backend.effects`, `visibleRows`, and its private marker row; observations come from real backend/read results. Async dispose revokes both scopes. |
| `runManualCompareJourney(page, ids)` | T18, `tests/vnext/browser/journey-helpers.ts` | Click visible selection/compare controls. Await actual committed-intent and renderer acknowledgement through a bounded test observer. Return `{normalizedIntent,selectedIds}`; normalization removes transport/request IDs only, not meaningful fields/filter/selection. |
| `resetJourneyThroughHostControl(page)` | T18, same file | Activate the fixture's host-owned reset control; await reset acknowledgement. Do not mutate React or runtime internals directly from page.evaluate. |
| `runFixtureAgentCompareJourney(page, ids)` | T18, same file | Use visible agent input with a fake model transport; real bridge, runtime, and renderer run. Read the same actual receipt observer used by the manual helper. |
| `createTwoSurfaceFixture()` | T19, `tests/vnext/fixtures/module-scale.ts` | Create two real controllers from the same People definition with distinct IDs. Return `{left,right,engineeringIntent,dispose}`. `engineeringIntent` is the exact typed team-equality browse intent used in T03. Do not share mutable surface state or inject a mocked notification count. Async dispose releases both controllers and the owned runtime. |
| `createModuleScaleFixture(count)` | T19, `tests/vnext/fixtures/module-scale.ts` | Register `count` lightweight feature definitions but activate only explicitly selected surfaces. Record actual listeners/renders/live handles. `changeFirstSurface()` performs one valid local intent. Every observer unsubscribes on disposal. |
| `noAgentGraph` | T20, installed consumer build | `{modules: readonly string[]}` from actual bundler metadata, normalized to package-resolved paths. Include a negative fixture that imports an agent module and proves the detector rejects it. |

Fixture helpers may wrap production results for assertions but cannot invent authorization, commitment, adaptive plans, rows, renderer-ready, or transaction success. Their implementations belong in the tasks above and must be reviewed with the tests that consume them.

## Final-review evidence rules

The plan package's own checksum/type/traceability tests qualify this handoff only. They never qualify product functionality. Remove declaration-only probes from product consumer tests before marking features implemented. The final runtime must run against the installed package exports. Negative tests need observed positive preconditions: requests started, scope active, source seen, renderer mounted. Waiting a fixed timeout and seeing no error does not prove cancellation, isolation or SSR.

Every task ends with its own focused red/green evidence, affected existing checks, docs changes, review and a checkpoint; no source commit is permission for publishing. At context exhaustion, persist the exact next command rather than fabricate broad completion.

# Aeliqo vNext — acceptance, qualification, and coverage

Status at handoff: NOT RUN. This is a set of proposed product requirements and test gates, not evidence that Aeliqo already satisfies them. Every requirement has an owning task in `02-EXECPLAN.md`. Cross-cutting tests may add owners but cannot remove the primary owner without updating both files.

## 1. Traceability matrix

| ID | Required outcome | Primary task | Evidence |
|---|---|---|---|
| RQ01 | Fresh checkout, active policy, toolchain, catalog, and baseline recorded | T00 | Baseline manifest and source SHA |
| RQ02 | No-AI standalone and adaptive paths work without model imports/requests | T10 | Installed consumer + network/module-graph assertion |
| RQ03 | Public DX has small typed APIs; no giant all-props component or config | T01 | Positive/negative TypeScript consumer fixtures |
| RQ04 | Features are immutable definitions; data and identities are scoped bindings | T02 | Definition tests + server import graph |
| RQ05 | Multiple instances of one feature are independent and explicitly addressed | T03 | Two-surface isolation and wrong-target tests |
| RQ06 | Lifecycle survives Strict Mode, interrupted render, unmount, and disposal | T10 | Browser lifecycle tests + retained-handle counts |
| RQ07 | Controlled host state cannot be bypassed by UI or agent requests | T03 | Proposal/accept/reject/revision tests |
| RQ08 | Local data updates retain controller identity and bounded resource use | T05 | Snapshot-update, duplicates, null/empty/shape tests |
| RQ09 | Remote queries preserve coverage, pagination, unsupported capabilities | T06 | Real protocol fixture and query assertions |
| RQ10 | Analytics respects grain, units, ratios, time, nulls, and partial data | T06 | Expected-value semantic fixtures |
| RQ11 | Same normalized inputs yield the same resolver result and explanation | T07 | Determinism/property tests with injected environment |
| RQ12 | Eligibility, pins, ambiguity, fallback, and composition are explicit | T08 | Candidate/coverage/fallback/state-mapping tests |
| RQ13 | Existing host UI and native React custom views work without remount hacks | T10 | React-context/portal/controlled-input consumer |
| RQ14 | Writes retain preview, confirmation, authorization, idempotency, ambiguity | T11 | Server-side action integration and restart/retry cases |
| RQ15 | Non-relational/editor/job feature uses capabilities without fake table data | T11 | Real non-data vertical slice |
| RQ16 | SSR has meaningful initial content and matching safe hydration | T12 | HTML assertions + hydration error capture |
| RQ17 | Framework-independent paths and support matrix are honestly qualified | T12 | React/Lit/Vanilla/Vue/Next/island fixture results |
| RQ18 | UX preserves work and exposes all important states accessibly | T13 | Keyboard/browser/visual/state-transition tests |
| RQ19 | Theme, locale, RTL, time, reduced motion, zoom, and expansion work | T13 | Per-profile visual and behavior evidence |
| RQ20 | Agent connection is optional, scoped, authenticated, and cancellable | T14 | Session expiry/disconnect/replay/race tests |
| RQ21 | BYOK uses protocol capabilities, not hardcoded vendor/model selection | T15 | Model conformance profiles and secret scan |
| RQ22 | Model/provider quality is separated from mock protocol compatibility | T15 | Explicit synthetic/live evaluation ledger |
| RQ23 | Permissions, egress, prompt injection, forged receipts are contained | T16 | Adversarial cross-boundary tests |
| RQ24 | Every catalog component has accurate standalone/semantic/adaptive docs | T17 | Catalog-to-doc/example/API coverage report |
| RQ25 | Every advertised copyable code example typechecks in its declared environment and key examples run from tarballs | T17 | Generated docs consumer and browser preview tests |
| RQ26 | Product value is shown across distinct application classes | T18 | Four reference journeys + host-only comparison |
| RQ27 | Bundle, work, latency, memory, and module scaling meet measured budgets | T19 | Reproducible raw performance artifacts |
| RQ28 | Large apps use scoped registries/lazy loading, not global eager imports | T19 | Import graph + unrelated-surface isolation counters |
| RQ29 | Versioned public APIs/protocols/migrations and old consumers are covered | T20 | Export/ABI/consumer matrix and migration fixtures |
| RQ30 | Existing full quality matrix stays enforced with new gates added | T21 | Fresh `pnpm check` on accepted unchanged source |
| RQ31 | Publish and deploy are separately authorized, verified, and recoverable | T21 | Registry/tarball/image/runtime evidence or named blocker |
| RQ32 | Checkpoints preserve decisions, failures, and remaining work | T00 | Continuously updated execution state and task ledger |
| RQ33 | No duplicate authority/query/business-state engine introduced | T02 | Dependency review and existing/new path parity tests |
| RQ34 | Rate, concurrency, cancellation, retention, and quotas remain bounded | T16 | Slow/hostile-client saturation and release tests |
| RQ35 | Progress/results/diagnostics never imply success without actual receipts | T14 | Rejected/no-commit/late-ack/partial/ambiguous tests |
| RQ36 | No unsupported claim of unlimited scale or every framework/provider | T20 | Machine-readable qualification/support matrix |
| RQ37 | Application scope switching is isolated, stale-safe, and has explicit state portability rules | T04 | Workspace A→B transition, late-result, cache/cursor/action-revocation tests |
| RQ38 | Agent context follows the current trusted scope without allowing the model to choose or reuse another scope | T14 | Mid-request workspace switch, rebind, cross-scope metadata/tool-result tests |
| RQ39 | Voluntary scope changes guard unsaved work; forced invalidation fences access without carrying drafts | T04 | Save/Discard/Stay, failed save, forced logout and scoped recovery tests |
| RQ40 | Old controller callbacks and A-B-A activations cannot retarget a new scope | T04 | Monotonic activation and immutable surface-generation/address race tests |
| RQ41 | Workspace-wide layouts adapt coherently without changing tenancy or duplicating controllers | T09 | Single/split/compare, child-failure, stale-read-set and real-DOM composition tests |
| RQ42 | Browser/server transport and rendering boundaries resist credential, CSRF, XSS and cache leakage | T16 | SSR escaping, origin checks, cookie mutation, session/bfcache and cross-principal fixtures |
| RQ43 | Cache/cursor semantics separate value identity and freshness from active UI fencing | T06 | A-B-A reauthorization, live/snapshot pagination and no-per-render cache explosion tests |
| RQ44 | Agent pairing and conversation/continuation state are isolated by scope and target | T14 | Outbound payload audit, old continuation rejection and explicit target allowlists |
| RQ45 | One consistent API contract and non-vacuous consumer tests replace conflicting chat examples | T01 | Positive/negative installed consumers, immutable target types, visible SSR DOM proof |
| RQ46 | Final handoff, migration and export/entry documentation refer to the same version and requirements | T20 | Manifest, task graph, public export/docs mapping and checkpoint migration checks |

## 2. Required adversarial scenarios

A voluntary pending leave guard must keep the authorized old subtree mounted and labeled with its old selector. Save/Discard/Stay does not destroy component state. Recheck draft, active selector and permission revisions after asynchronous guards; an outdated acceptance cannot switch scope. Test A1→B→A2 with A1 actually completing only after A2 is active and rendered.


### Runtime, state, and UX

Use the same feature in two visible surfaces and two simultaneous server requests. Change one filter; the other must not change. Target a missing, disposed, unauthorized, or ambiguous surface from an agent; there must be no fallback to the first surface. Re-register an identical module twice; references are counted, not duplicated. Register conflicting revisions/definitions; reject explicitly.

Start request A, then B; resolve A last. Only B may replace the active query state. A cancelled query must not destroy a prior valid presentation. Writes do not use latest-wins in a way that hides executed effects. Change permissions or entity revision while a confirmation is open; old confirmation must fail.

In controlled mode reject a proposal, accept a newer proposal before an older response, and unmount while approval is pending. The framework must never report commit merely because `onProposal` ran.


Switch A→B, A→B→A and A→B→C with a real pending read/renderer acknowledgement/controlled proposal/action preview/agent request in separate cases. Observe the operation start before transitioning, then resolve old work late. Old handles remain bound to their immutable old address and cannot commit in a new activation. Rebind hooks to new controllers. Check dirty voluntary switch choices (Save/Discard/Stay, save failure) before activating B. Forced logout/revocation masks old content without a veto; optional draft recovery stays partitioned to the old authorized scope. Prevent cross-scope cursor/cache misuse without inserting every UI revision into value cache keys. Model input cannot replace server-verified membership; old provider continuation and transcript markers are absent from new-scope outbound payloads.

Exercise rapid resize across the layout breakpoint, focus inside a control, unsaved form input, keyboard-only comparison, errors in a lazy renderer import, and cancellation during transition. Preserve compatible state; blocked transitions show a useful recovery. Host-pinned views never silently switch. A recoverable error retains prior valid UI only if current scope and permission still authorize it. Revocation and scope changes hide old content immediately instead of keeping it as an error fallback. A workspace layout change stays within the same scope, preserves compatible child state, and never claims distributed mutation atomicity.

### Data and semantics

Cover empty arrays with/without schema, all-null fields, heterogeneous records, duplicate IDs, IDs changing on update, huge strings, invalid dates, nested arrays/objects, decimal precision, timezone boundaries, DST where relevant, mixed currencies, semi-additive snapshots, and ratio metrics.

For remote queries assert requested operations and parameters at the server. A 25-row first page with a million-record logical source must not yield a fake global aggregate. Test unsupported sort/filter/aggregate independently, duplicate-page boundaries, cursor invalidation, unknown totals, schema drift, cross-tenant cursor use, source revision change, streaming interruption, and slow/non-cancellable source adapters.

Test at least one source whose API does not support arbitrary query predicates. Capability negotiation must prevent pretend functionality; adaptation cannot manufacture missing data.

### Agent and security

Inject text such as instructions to reveal secrets into rows and tool results. Attempt executable HTML, module paths, arbitrary URLs, undeclared capabilities, schema-valid but semantically wrong metric selections, forged principal/scope fields, cross-surface changes, expired sessions, stale goal epochs, fake renderer receipts, and action execution without current host confirmation.

Exercise protocol profiles with different tool support, missing usage, custom auth header, explicit auth-none local mode, unsupported streaming, malformed/oversized outputs, rate limiting, timeouts, delayed responses, and cancellation after a tool side effect. Reject a model-only claim that UI changed. A client-reported UI receipt must never authorize a server mutation.

Do not submit real secrets or customer records to these tests. Live tests use the same synthetic intent corpus across provider profiles and report semantic correctness, unsupported behavior, and cost separately.

## 3. Component documentation and behavior gate

The active set is loaded from `catalog/components.json.components[].id` on the execution SHA. Do not hardcode 71 as the actual count; that number is the inspected contributor guide's description. Fail on missing or duplicate IDs, missing authored pages, stale props, absent previews, nonexistent imports, or undocumented advertised surfaces.

For each active component, verify:

| Area | Required evidence |
|---|---|
| Purpose | What it does, appropriate use, inappropriate use, related alternatives |
| Distribution | Exact package/subpath, peers, registration requirements, supported framework paths |
| Example | Complete minimal runnable code and an integration example where relevant |
| API | Types/defaults/events/callbacks/ref or imperative API from declarations; no invented defaults |
| State ownership | Controlled/uncontrolled behavior, update ownership, valid/invalid combinations |
| Data | Accepted values, empty/null/invalid/partial/large input behavior |
| Lifecycle | Mount/update/unmount, disabled/pending/failure/cancel behavior as applicable |
| Accessibility | Semantic element/roles, keyboard, focus, accessible names, announcements |
| Layout | Responsive behavior, zoom, RTL, localization, text expansion, touch target behavior |
| Customization | Tokens, slots/parts, class/style boundaries, theming without global CSS takeover |
| Performance | Relevant constraints and measured limits, virtualization/aggregation caveats |
| Security | Text/HTML/URL/file/action boundaries relevant to that component |
| Adaptive use | Standalone only vs semantic binding vs eligible adaptive manifest; state mapping |
| Compatibility | Version notes, deprecation/migration, SSR/hydration support and limits |

Every page is authored English prose, not generated filler. Generate API facts and synchronize code examples with real source. Tests must verify example behavior, not only that a preview container exists. Preserve useful legacy pages and redirects with version-aware navigation.

The inventory gate created in T17 must enforce set equality for current catalog pages and runnable examples. Historical/versioned pages are retained separately, not mistaken for current coverage. A human-readable report identifies the exact missing component and section.

Accessibility qualification includes automated scans plus keyboard/focus checks. Manual assistive-technology checks should be recorded with browser/OS/tool versions. Missing manual certification is visible; do not claim universal WCAG compliance from an axe pass.

## 4. Performance qualification

### 4.1 Existing gates

Preserve current `tests/performance/bundles.mjs` limits and total/excluding-Lit definitions. During research these include 15 KiB for button/input/metric, 40 KiB for standalone table, 70 KiB for core planner-validation, and 160 KiB for region-table. Read the complete gate at execution time. Do not silently externalize dependencies, exclude code paths, increase budgets, or weaken assertions to pass.

Use current runtime/browser/heap/adverse-workload tests as the baseline. An added feature cannot mark an existing category skipped. Do not rerun flaky tests until a single pass and discard failures; retain every run.

### 4.2 New proposed engineering targets

These are acceptance targets chosen for this plan, not research-derived facts or existing measurements. Record the reference runner/browser, CPU, memory, throttle settings, workload hash, package integrity, and commit in T00. Use the same environment for baseline and candidate. If a target is not reached, fix the issue or explicitly report a failed qualification; changing targets requires a documented owner decision, not an automatic adjustment.

| Measure | Target and measurement contract |
|---|---|
| No-AI module graph | Zero provider SDK/model transport imports in standalone and no-agent surface entry graphs |
| Unused features | A lazy feature renderer's executable code is absent from unrelated route entry chunks |
| New controller-only facade | Incremental facade code above the equivalent existing headless path <=10 KiB gzip; publish total cost too |
| Minimal no-AI adaptive data example | Installed-consumer total remains within the existing region-table cap, or a clearly separate reviewed cap; do not compare incremental with total |
| Deterministic resolver | p95 <=16 ms for 100 manifests with <=20 eligible candidates and a bounded 50-node plan on the recorded runner; injected inputs, no model/network/render included |
| Warm local interaction | p95 <=100 ms from user event to committed paint for the standard 1,000-row/20-column browse/filter fixture; report full distribution |
| Unrelated surface updates | Zero listener notifications/renders for a selector whose selected state is unchanged |
| Lifecycle cleanup | No active handles/listeners/jobs remain after disposal; detached-node count returns to baseline |
| Heap soak | After warmup and explicit test-only GC, final 200-cycle median <= initial 200-cycle median + max(5 MiB, 5%); report trend and retained-object roots |
| Cancellation | A late response cannot commit after disposal or supersession, regardless of timing |
| Public reference page experience | Aim for good Web Vitals; actual field qualification uses p75 LCP<=2.5s, INP<=200ms, CLS<=0.1, distinct from lab timing |

Run at least five measured repetitions with at least 100 interactions per repetition after fixed warmup. Store raw samples; compute quantiles over the defined measured workload, not over an arbitrary handful of aggregate samples. Investigate regressions against baseline even when an absolute cap still passes.

Heap tests require a GC-enabled test browser; lacking it is not a passed heap gate. Do not add GC to production code. CPU throttling is an emulation profile, not evidence from a physical low-end phone.

### 4.3 Workload tiers

- Local: 1,000 and 10,000 synthetic rows at 20 columns with local limits explicitly set. 100,000 rows is an opt-in stress profile, not an automatic default-support promise.
- Remote: 1,000,000 and 10,000,000 logical rows behind a paged synthetic server fixture; only bounded pages enter browser memory. This proves protocol/window behavior, not that a production database processed that many rows efficiently. Separately profile one real backend adapter if claiming DB throughput.
- Module scale: 10, 100, and 1,000 declared features, only 5 active; then 10 and 50 active surfaces. Measure discovery payload, active subscriptions, query volume, and update cost. No all-feature scan for each ordinary keystroke.
- Lifecycle: 1,000 mount/update/unmount cycles and 10,000 intent transitions, including failures and cancellation.
- Concurrency: 1, 10, and 100 independent authenticated server sessions. Use controlled source latency and configured quotas; verify no cross-session data and bounded queues. These are adapter load profiles, not internet-scale traffic claims.
- Rendering: Chromium, Firefox, WebKit; 360, 768, 1440 CSS pixel widths; RTL, reduced motion, and zoom/text-expansion profiles. Record actual versions.

## 5. Four reference journeys and value evidence

1. **Public content/islands:** server/static content, search/filter/detail region, no model, useful HTML before hydration, no unrelated runtime imports.
2. **Consumer catalog:** search, selection, comparison, detail, host-owned cart action, custom design-system components, optional agent for the same operations.
3. **Enterprise operations:** remote pagination, partial/unknown totals, two independent surfaces, permission changes, review/confirm action, audit trace, legacy UI binding.
4. **Non-data editor/job:** host-controlled document or file job, configuration, progress, cancel, output references; high-frequency editing stays local and outside the semantic pipeline.

For each, define the same concrete tasks in a host-only baseline. Count glue code and duplicated state transitions, record integration steps and debugging outcomes, then perform structured usability tasks with developers who did not implement the fixture when available. Treat human study status as separate from automated acceptance. Do not invent participants, scores, retention gains, or product-market fit. Technical release may state what was tested while leaving commercial validation explicitly unproven.

## 6. Verification command matrix

Existing command names were read from package.json. Re-resolve their behavior and the full `quality/commands.json` in T00. New vNext tests must be wired into existing suites or added to that matrix before claiming full acceptance.

| Area | Existing commands to retain/use |
|---|---|
| Types/core/contracts | `pnpm typecheck`, `pnpm test:contracts`, `pnpm test:semantics`, `pnpm test:query` |
| Runtime | `pnpm test:data`, `pnpm test:results`, `pnpm test:regions`, `pnpm test:actions`, `pnpm test:interaction`, `pnpm test:evaluation` |
| Adaptive | `pnpm test:presentation-adaptation`, `pnpm test:presentation-adaptation:browser`, `pnpm test:presentation-adaptation:consumers` |
| Web/React/SSR | `pnpm test:platform`, `pnpm test:platform:browser`, `pnpm test:framework:consumers`, `pnpm test:next-platform` |
| Agent/protocol | `pnpm test:agents`, `pnpm test:protocol-model`, `pnpm test:protocol-mcp`, `pnpm test:protocol-webmcp`, `pnpm test:protocol:consumers` |
| Security | `pnpm test:security`, `pnpm test:boundaries`, `pnpm test:data:auth-retention` |
| Components/docs | `pnpm test:components:a11y`, `pnpm test:catalog-examples`, `pnpm test:docs-artifact`, `pnpm test:visual` |
| Performance | `pnpm test:performance:bundles`, `pnpm test:performance:runtime`, `pnpm test:performance:browser`, `pnpm test:performance:heap-lifecycle`, adverse suites |
| Site/release | `pnpm site:build`, `pnpm site:test`, `pnpm test:release-tooling`, `pnpm check` |

Native WebMCP qualification and live-model evaluation retain separate status. A simulated WebMCP test never becomes a native-browser pass. Paid evaluation is not authorized merely because a script exists.

## 7. Evidence and completion states

Each test/review records task and requirement IDs, source SHA/diff hash, command, timestamps, exit status, environment, fixture hash, artifact path, and conclusion. Redact secrets and user data. Checkpoint files link to artifacts; do not commit generated screenshots or build outputs when AGENTS.md prohibits them.

Use exact states: `not-started`, `in-progress`, `implemented`, `verified`, `blocked`. Release ledger additionally distinguishes `candidate-built`, `reviewed`, `rc-published`, `stable-published`, `image-published`, `deployed`, and `runtime-verified`.

A blocker names the exact missing credential, permission, review, environment, or failed contract. Continue independent safe tasks. Do not report the entire effort done with any mandatory task blocked. Do not rerun destructive publish commands to "verify"; inspect registry integrity and version instead.

Required final report: source/diff, completed requirement IDs, real test evidence, compatibility/breaking changes, remaining blockers, provider/framework/workload support, release status, rollback target, and next concrete action. No count of passing tests replaces unresolved requirement coverage. Planning artifact tests are not product test evidence; every scope race test must demonstrate that the earlier operation was actually in flight, and SSR assertions must inspect useful DOM with scripts disabled.

## 8. Handoff qualification and unsupported-condition policy

`PLAN-INDEX.json` is the machine-readable traceability graph for 22 tasks and 46 requirements. `verify_pack.py` verifies this final planning handoff, not Aeliqo behavior. Its evidence is kept separate from T00–T21 execution.

Supported framework/provider/workload means a named, versioned passing profile. All other integrations retain an adapter contract and an unverified label. Missing live-provider budget or a real low-end device does not block manual/protocol fixture implementation; it blocks only the corresponding claim. A numerical performance target is an engineering acceptance proposal, not a guarantee for all hardware. Existing budget thresholds cannot be silently loosened.

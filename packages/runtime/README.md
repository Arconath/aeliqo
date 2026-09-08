# @aeliqo/runtime

Effectful Aeliqo integration, separate from the pure core. The
`@aeliqo/runtime/data` entry provides the bounded Application Data Contract (ADC)
boundary and its in-process evaluator. A host owns authentication, policy and
physical execution; the runtime never treats a client-supplied principal or tenant
field as authority.

The local service accepts a canonical catalog and immutable, typed source snapshot:

```ts
const service = createLocalDataService({
  snapshot: {catalog, sourceRevision: 'source-1', records: {employees: rows}},
});
const page = await service.describe({
  version: '1', requestId: 'describe-1', catalogRevision: null,
  target: {kind: 'catalog'}, budget,
});
const plan = await service.plan({
  version: '1', requestId: 'plan-1', catalogRevision: page.value.catalogRevision,
  target: {outputId: 'employees-table'}, query, budget,
});
if (plan.ok) {
  for await (const event of service.execute(plan.value, {signal})) {
    // Handle descriptor, batch, progress and completion/error events.
  }
}
```

The local source is bounded before it is cloned or exposed. One snapshot defaults
to at most 10,000 rows and 8 MiB of UTF-8 JSON row data across all entities. A host
can configure explicit bounds with
`sourceLimits: {rows, bytes}`; the limits are host configuration, are retained
when `replaceSnapshot` installs a new revision, and reject a replacement that
exceeds either aggregate bound. Source rows are typed against the catalog,
including unique identity tuples (decimal identity values are normalized so
`1.0` and `1.00` identify the same row). Instant identity and comparisons preserve
fractional-second digits, normalize equivalent offsets, and reject invalid dates
and clock ranges.

Every request is schema-checked before evaluation. Discovery, planning and
execution intersect the requested budget with host and principal grants. Catalog
and source revisions, scope digests, policy revisions and SHA-256
plan/population identities are pinned across those phases. A changed snapshot,
grant, policy or catalog makes the accepted plan stale. Row policies run again for
every execution and may return different principal-scoped populations only when the
host supplies a matching scope and policy revision.

An ADC plan may set `target.taskId` beside `target.outputId` to bind its Result
descriptor to the semantic Task. `requestId` still identifies transport work.
The accepted plan pins both target fields; changing either before execution is
rejected. Direct legacy requests that omit `taskId` retain the request ID as
their descriptor task ID. These identifiers grant no authority.

The local evaluator uses the core query planner for typed predicates, projection,
ordering, paging, registered measures, validated relations, grouping and explicit
temporal operations. Discovery negotiates supported operations; unsupported plans
return structured diagnostics. The runtime evaluates only its bounded host-owned
snapshot. Decimal values use exact decimal comparison, and result descriptors
carry identity, grain, consistency, evidence, counts, population and complete or
partial coverage.

The same request and result schemas are used by the generic HTTP client and host.
HTTP credentials and authenticated principals stay at that transport/application
boundary. `readResultStream` validates bounded NDJSON framing, canonical event
shape, accepted query/output/scope pins, stable result lineage, batch sequence,
progress and terminal events. Supply explicit byte, per-message, message-count
and row budgets and connect the host's cancellation signal. Cancellation and
early consumer exit cancel the reader and release its lock.

HTTP endpoint paths are configurable. The client sends only bounded
`POST`/`application/json` request envelopes and accepts bounded NDJSON result
streams; caller credentials belong in configured headers, while the server's
`authenticate` callback supplies the principal used by authorization. The host
uses a 30-second whole-transport deadline, 32 concurrent request slots and an
8 MiB default request-body limit. Applications own per-principal rate limits and
retry policy; the generic client does not retry automatically because source
semantics determine whether a retry is safe. Authentication, authorization and
source callbacks receive a cancellation signal, and stalled callbacks are
detached when the signal aborts. Accepted query and population pins are checked
at the transport boundary; they do not prove business truth.

Native fetch responses use one consumed clone branch, with the original branch
immediately canceled. This preserves streaming and avoids a reproduced Chromium
completion/cancellation race. In-process responses with an empty `url` retain
their direct reader path; custom fetch adapters that reconstruct a native
response and erase its URL also take that path. The client still enforces byte
budgets, deadlines and caller cancellation on the consumed stream.

A completion event is withheld until EOF validates that no trailing event exists.
A dropped stream throws a structured error; already delivered batches remain
provisional. The caller must not mark those batches complete before receiving a
validated terminal event. Source error events remain error events, not completion.
These checks establish framing and lineage, not arithmetic correctness, field
authorization, completeness truth, or permission to send results to a model.
The host and later data/evaluation passes retain those responsibilities.

## Result handles

`@aeliqo/runtime/results` exposes `createResultStore`. Begin a handle with the
host's principal partition, accepted scope/policy/query/catalog/function/source
pins, output/task/request IDs and accepted population digest. Consume
`handle.subscribe(service.execute(accepted, {signal}), {signal})` as an async
iterator. Each pull requests one event. Snapshot rows are immutable and retain
identity, grain, coverage, precision and lineage. A sampled or partial population
never becomes complete merely because the stream ends.

`begin` owns one reference; `handle.release()` releases it idempotently.
`handle.retain()` creates a separate lease with its own `release()`. Live owners,
leases and subscriptions prevent TTL/LRU eviction. A full store whose entries are
all pinned throws `RangeError`; release ownership before refreshing within a
one-entry store. `dispose` releases a handle immediately. The store bounds encoded
descriptor/batch retention, including a previous snapshot kept during refresh.
TTL applies to unpinned idle entries; it does not revoke authorization.

A same-population refresh can preserve prior authorized rows with an explicit
`refreshing`/`stale` status when the source fails. Different populations or semantic
pins never share that carry. A denied or cancelled refresh clears its rows.
The host must call `store.revoke({principalKey, scopeDigest?, policyRevision?})`
when authorization changes; revocation clears rows before source cleanup runs.
Result revisions are separate from source revisions. Validation checks declared
pins and internal consistency, and does not certify business truth or grant model
egress. Persistence and columnar codecs are not implemented by this memory store.

## Region transactions

`@aeliqo/runtime/regions` exposes `createRegionStore`. The application supplies
`readAuthority` and `authorizeCommit`; neither comes from a proposal. Current
authority includes the private principal partition, scope, policy, catalog,
experience and function-registry revisions, and authorized result references.
The store owns task, region and data revisions. Each region incarnation receives
a fresh revision identity, including after disposal or restore.

```ts
const regions = createRegionStore({readAuthority, authorizeCommit, restoreRegion});
const created = regions.create({id: task.regionId, state: {task}});
if (created.ok) {
  const region = created.value;
  const staged = await region.stage({
    requestId: 'present-employees',
    expected: region.snapshot().readSet!,
    state: {task: proposedTask, presentation: proposedPresentation},
    resultHandles: [resultHandle],
  });
  if (staged.ok) {
    const committed = await region.commit(staged.value);
    if (committed.ok) resultHandle.release();
  }
}
```

Staging captures the complete declared and derived dependency read set in an
opaque token. Commit serializes changes per region, awaits bounded host
authorization, then rechecks authority, revisions and result generations before
swapping state. A stale proposal leaves the current authorized state intact;
revocation clears it. These checks do not establish intent correctness or
presentation feasibility, which require the semantic and presentation passes.
When read access is revoked, the host must revoke the affected region and
result-store partition. Denial of a presentation commit preserves existing
authorized data.

Explicit result handles must belong to the current principal and semantic pins.
Staged and committed regions own separate leases; failed proposals, replacement,
revocation and disposal release those leases. References supplied without handles
remain application-managed. Call `region.discard(token)` when dismissing an unused
proposal to release its staged resources. Histories contain bounded lifecycle metadata.
`publishData` advances data revision independently and targets observers by
logical output, query and scope; even a same-reference refresh invalidates a
proposal that read the previous data revision. Host callbacks receive an
`AbortSignal` and must stop work when it aborts. Deadlines also stop waiting for
uncooperative callbacks, whose late results cannot commit.
`region.commit(token, {signal})` can cancel queued or pending authorization work
before the atomic state swap and releases the proposal's leases. Cancellation
after the swap does not undo an already completed commit.

`@aeliqo/runtime/persistence` serializes versioned task metadata and semantic
pins, without result rows, principal keys or presentation plans. Storage remains
the application's responsibility. `await regions.restore(document)` requires a
host `restoreRegion` callback: requery the persisted task under current
permissions, update the host's current result authority, and return fresh task
content and result handles. Only the validated fresh state becomes active.
Restoration starts a new materialization revision and history; saved references
do not grant access to data. The callback remains responsible for its original
result-handle ownership after the restored region acquires its own leases.

`RegionContent.interaction` holds versioned port values and domain/entity/field
drafts. A commit publishes this state together with its Task and presentation,
before notifying observers. Omitting it in a later layout or Task update preserves
the current values; explicitly supplying empty `values` and `drafts` clears them.
Layout revisions alone do not imply an entity-edit conflict. An explicit selection
keeps its exact Result reference in the commit dependency set, and a layout-only
commit preserves leases for results still referenced by the new state.
Persistence exports Task metadata only; it does not automatically save these
potentially sensitive selections or drafts.

## Typed interactions

`@aeliqo/runtime/interaction` exposes `createInteractionGraph` and
`createInteractionController`. Register typed ports and mapping manifests through
the core graph validator. Selection-equivalence links use built-in identity
propagation; directed mappings require registered local callbacks. The controller
validates wire events, bounds queued work, and commits retained values through
the owning region. Events carry stable node and region identities, without actor
or permission fields. The host supplies trusted context for each operation.

For filter, range, group and page events, provide `validateScope` and `materialize`.
The latter receives all routed query payloads, the resolution context and the next
canonical interaction state in one call. Evaluate through the data service and
return a full `RegionContent` plus its fresh result handles. Preserve the captured
read dependencies in host authority while adding the fresh results; activate the
new view only after commit succeeds. A callback that only changes control state
cannot establish that query rows changed.

`maxEventMilliseconds` covers processing after the event leaves the bounded
queue. The controller checks elapsed time as well as cancellation before publishing.
It cannot interrupt synchronous application code while that code is running;
callbacks must yield for responsive cancellation. Failed events can retry, while
successful events are deduplicated within a bounded retention window. Reusing a
retained event ID with different event data or a different source port is rejected.

Provide `validateSelection` for permitted population membership and `validateDraft`
for editable fields/current entity revisions. Navigation uses application-declared
destinations and explicit host callbacks. Action interaction callbacks only propose
an action; business execution uses the separate action boundary below. No model is
required for these interactions. Initialize controls and drafts through
`RegionStore.create` state, and read the committed region state in view observers.

Controller revocation disables that input channel. When read permission itself is
withdrawn, the host must also revoke the region and affected result-store partition.

## Host actions

`@aeliqo/runtime/actions` exposes `createActionRegistry` and `createActionPort`.
The application registers versioned input/output schemas and its business dispatch
callback. Requests contain an action reference, scalar input, and any required
entity revision or idempotency key. They cannot supply an actor or approval.
The port obtains its principal, actor, permissions and current revisions from
the host's `readContext` callback.

Call `preview(request)`, then `confirm(preview)`, then `execute(receipt)`, checking
each Outcome. Preview requires `action.propose`; execution separately requires
`action.execute`. Required confirmation comes only from the host's
`issueConfirmation` callback. Preview and confirmation perform no business write.
Opaque previews and receipts are one-use and cannot be recreated from JSON.
Execution rechecks current authority and entity revisions before dispatch.
`preview.input` is available only while that opaque preview is live; it becomes
`undefined` when consumed, revoked or disposed. Any copy deliberately made by the
application remains the application's responsibility.

The in-memory idempotency ledger prevents repeated dispatch within the port's
lifetime. An ambiguous outcome must be reconciled by the application, because a
timeout cannot prove that an external write failed. Durable idempotency and
transactional business checks remain the application's responsibility. Histories
contain metadata rather than action input. Call `revoke` on authority withdrawal
and `dispose` when the owning application scope ends.
`await port.inspect(idempotencyKey)` and `await port.history()` return Outcomes
after reading fresh host context. They expose only metadata for the current
principal, actor, scope, policy and domain revision. A closed port returns a
failure; it does not expose retained entries from an earlier context.

`maxPreviews`, `maxPending` and `maxInFlight` bound pending records and awaited
host calls. `maxIdentityBytes`, `maxOutputBytes` and `maxLedgerBytes` bound
idempotency retention, including metadata and rejected outcomes. A full ledger
refuses a new dispatch. If a completed action's output cannot fit, its retained
entry becomes ambiguous and subsequent attempts cannot dispatch it again.
Revocation and disposal are terminal and clear retained ledger inputs/outputs.
Host callbacks must honor their `AbortSignal`; a timeout stops the port waiting
but cannot terminate an application's external operation.


## Named task evaluation

`@aeliqo/runtime/evaluation` exposes `createTaskEvaluator` and
`createResultCohortResolver`. The evaluator validates a Task, evaluates selected
outputs in dependency order through the host's data service, and returns leased
result handles with their original descriptors and lineage. It does not commit
or render a view. By default it evaluates eager query outputs and reused outputs,
including their dependencies. Use `requestedOutputs` for an on-demand read.

The host supplies the authenticated context, catalog, data service, result store,
and exact-reference handle resolver. `task.evaluate` is required independently
of `result.inspect`, which is also needed for reused results and cohorts.
Authority is checked again before returning an evaluation. Pass an AbortSignal
and bounded budget; call the evaluation's `release()` once the region has retained
its handles, or when discarding the evaluation.

A live-output cohort resolves membership from the dependency evaluated during
that task. A fixed cohort resolves its pinned, complete source result and can
retain those members across a source-data revision. This does not retain revoked
read authority. Cohort resolution checks scope, identities, grain, completeness,
and current host permission; arbitrary result references are not capabilities.
See `examples/vertical-slice` in the source repository for an application-owned
catalog and the full evaluate, validate, stage, commit, and interaction sequence.

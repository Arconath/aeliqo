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

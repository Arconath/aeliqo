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

Every request is schema-checked before evaluation. Discovery, planning and
execution intersect the requested budget with host and principal grants. Catalog
and source revisions, scope digests, policy revisions and SHA-256
plan/population identities are pinned across those phases. A changed snapshot,
grant, policy or catalog makes the accepted plan stale. Row policies run again for
every execution and may return different principal-scoped populations only when the
host supplies a matching scope and policy revision.

The local evaluator deliberately supports a small, explicit subset: projection,
typed predicates (`and`, `or`, `not`, comparisons, membership and null checks),
deterministic code-point/text and numeric ordering, and bounded cursor paging.
Relations, grouping, measures and inferred temporal operators return structured
unsupported diagnostics; the runtime does not download an unbounded collection to
simulate them. Decimal values use exact decimal comparison, and result descriptors
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

A completion event is withheld until EOF validates that no trailing event exists.
A dropped stream throws a structured error; already delivered batches remain
provisional. The caller must not mark those batches complete before receiving a
validated terminal event. Source error events remain error events, not completion.
These checks establish framing and lineage, not arithmetic correctness, field
authorization, completeness truth, or permission to send results to a model.
The host and later data/evaluation passes retain those responsibilities.

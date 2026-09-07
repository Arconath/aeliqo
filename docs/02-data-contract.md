# 02 — Application Data Contract: agnostic without connector proliferation

## One application boundary

Aeliqo Application Data Contract (ADC) is the project's v0.1.0 contract, **not a claim of an industry standard**. It is a versioned description/read protocol. A host can be a local in-memory dataset, the application's own backend, or an existing semantic service. The application's backend maps the contract to its database/API; Aeliqo does not ship a different runtime for every vendor.

The SDK provides an in-process implementation, one HTTP transport, shared conformance tests and authoring import helpers. HTTP endpoint paths are application-configurable. A source's execution capabilities are data; they are not inferred from whether the URL says GraphQL, REST or SQL.

## Minimal port sketch

```ts
interface DataService {
  describe(request: CatalogRequest, context: ReadContext): Promise<CatalogPage>;
  plan(request: BoundQuery, context: ReadContext): Promise<PlanAcceptance>;
  execute(request: AcceptedQuery, context: ReadContext): AsyncIterable<ResultMessage>;
}
```

`describe` supports summary listing and detailed entity/metric descriptions with pagination/versioning. `plan` can be a cheap validation pass for a local source, but may estimate cost and return supported/rejected fragments for a server. `execute` yields descriptor, batch, progress, completion or typed failure messages. The effectful runtime connects cancellation to its host `AbortSignal`; no signal is serialized in a query or required as a browser-only core type. Do not require a separate cancel RPC when aborting the transport suffices. An optional cancel capability is appropriate for durable remote jobs. Polling/streaming updates are optional capabilities, not mandatory methods.

A remote context's principal is derived by the authenticated server. Never trust a client-provided tenant ID as authorization. Tokens stay at transport/application boundaries and are not fields in serializable plans.

## Request/response envelope

Every request carries contract version, request ID, catalog revision, logical query or accepted plan handle, declared budget, and explicit target. Server responses carry matching request identity, result identity, effective authorization scope identifier, plan digest and source revision if known. Unknown fields/operators fail explicitly unless marked negotiated extensions.

HTTP supports request/response for small complete results and bounded NDJSON streaming for large reads. The parser enforces byte, message and depth limits before building unbounded objects. Batch order/sequence is checked. A dropped stream before a completion message is partial/error, never complete. Reconnection resumes only when the source offers a stable cursor/checkpoint contract.

## Source capability descriptor

Declare supported predicates, field types, aggregations, grouping, sort/null order, stable cursor pagination, temporal bucket semantics, relation paths, consistency/snapshot guarantees, maximum group cardinality, output schemas, supported function versions, and cost-estimate quality. A capability can depend on an entity or relation; a global `joins: true` boolean is too weak.

An unsupported plan returns a structured gap with the missing capability and acceptable alternatives. Do not fetch an unbounded API collection into the browser to simulate a database operation. Local residual work requires explicit permission, completeness and byte/row/time budgets. An approximate sample must be labeled approximate and cannot supply an exact global count/ranking.

## Discovery does not require bulk rows

Prefer supplied runtime/JSON schemas, generated catalogs, explicit foreign-key metadata, or a schema-authoring import. OpenAPI and GraphQL can reduce typing but cannot prove a business metric or determine that an endpoint supports a join. Introspection may be unavailable. Standard Schema offers a validation interface; introspection/JSON-schema conversion must be negotiated separately. A TypeScript interface alone is not runtime metadata. [S05, S06]

For JSON-only sources, inspect a **bounded, authorized** sample and produce provisional field types. Preserve unresolved union/null/date/decimal cases. Require a stable identity configuration for linked selection. Do not invent foreign-key relationships from equal labels. Sample-based discovery has a provenance flag and does not imply exhaustive field coverage.

## Developer experience

Simple local data should work with a source helper that derives safe field shape and asks only for missing identity/semantics. A remote integration should primarily supply a catalog and the application's existing query function. The default authoring flow displays: “12 fields imported; identity unresolved; amount currency unknown.” It does not demand 300 lines duplicating an available schema.

A raw `fetch('/employees')` is a valid collection source with limited operations. It is **not** automatically a complete analytics API. Standard Aeliqo helpers can compose bounded local processing, but they expose that scope honestly.

## Result requirements

Every result states row grain, field roles/types/units, identity definition, ordering, null/missing rules, population scope, completeness, source freshness and version/consistency. Total counts distinguish loaded-row count, filtered-total count, and full-population count. Distinct-count estimates need an error/algorithm disclosure. A response without these guarantees still renders original records but cannot claim unsupported aggregate meanings.

## Security and operations

Rate-limit requests per principal. Bound concurrent queries and projected columns. Use server-side field/row policy both at discovery and execution, and authorize derived fields through their dependencies. Prevent inference leaks from rejected hidden-field names, joins, caches, debug traces and timing where relevant. Generic HTTP transport accepts a configured allowlisted origin, not arbitrary agent URLs.

Credentials, retry/backoff, pagination and abort behavior are tested against the same conformance suite in local and HTTP mode. Tenant-bound result handles expire and cannot be replayed under a different principal.

## Why this scales

New database/vendor: host implements the same contract, normally using its existing backend library. New frontend framework: mounts the same shared web implementation. New metric: adds a validated definition. New visual: adds a trusted manifest/renderer. None requires changing generic core or adding intent-specific adapter branches.

This transfers unavoidable domain/source knowledge to an explicit integration seam. It does not make that knowledge disappear. The value is one stable seam, reusable tooling and conformance—not a claim that every arbitrary API can be queried automatically.


## Nested and irregular raw payloads

A raw JSON object is not assumed to be a flat relational table. Schema-authoring helpers may expose bounded field paths using a standardized JSON-pointer-like representation; never evaluate arbitrary path code. Repeated nested records require a declared child entity/identity and parent relationship before relational expansion. Blind array flattening can multiply facts and is not allowed. Tagged unions, optional fields and heterogeneous samples stay explicit or unresolved. Files, binary values and opaque documents are referenced through approved safe preview capabilities, not coerced into numeric fields. Normalization carries source lineage and scope so the original record remains inspectable.

## Master consolidation integration tiers and negotiated semantics

**Local records:** source + stable identity + available schema; Aeliqo supplies the bounded evaluator. **Collection API:** catalog plus a collection reader with pagination/filter capability; use the same evaluator only for complete bounded populations. **Analytical host:** application supplies the ADC methods over its existing backend/query service; Aeliqo owns logical validation and the host owns physical execution. A registered opaque named metric/output is legitimate when the host supplies typed inputs, grain, scope and authoritative results. Consumers do not have to write a compiler merely to display a table.

Plan acceptance pins normalized operator/function semantics, known null/collation/time behavior and a source snapshot/consistency statement. Unknown collation or date bucketing cannot pass a parity claim. A complete stream is complete for its declared population, which can still be a sample. Continuation cursors include query and scope identity; changing a filter invalidates a cursor.

Permission to read a source field, to compute an authorized aggregate, and to send either to a model are separate host decisions. A restricted raw column may legally feed an approved aggregate-only metric through a host capability; do not expose its formula/rows or let an arbitrary client expression declassify it. Conversely a visible UI result is not automatically approved for external model egress. Test both routes.

In-process and HTTP share contracts, not a false assumption of equal failure/latency. HTTP can drop after a batch, authenticate differently, impose rate limits and refuse expensive work. Conformance tests simulate these differences instead of merely wrapping the same successful function in two call signatures.

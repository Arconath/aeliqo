# 05 — Results, resources and consistency

## Result is data plus an honest description

The result descriptor defines output fields, semantic roles, identities and grain, metric versions/units, ordering, scope, precision, source revision and provenance. Measured properties such as row count, cardinality, series count and null distribution are tagged known/estimated/unknown. The descriptor is not a free-form model summary.

Separate immutable data batches from descriptor metadata. Small data can use readonly records. Large data can use chunked/column-oriented storage behind a ResultHandle; do not impose Arrow/WASM on all users. The public interface permits a future columnar codec without exposing a third-party engine as core API.

## Lifecycle

```text
idle -> planning -> loading -> partial -> ready
                 \-> denied / unsupported / error
loading/partial/ready -> stale -> refreshing -> ready/error
any active operation -> cancelled -> disposed
```

Completeness is separate from status: a ready sampled result is not a complete population. Loading a new query may retain a stale previous result with an explicit refreshing indicator. Never fabricate zero totals while loading.

Each handle has request/task identity, query digest, authorization scope, schema version, source revision, refcount/lease and abort/dispose lifecycle. A user selection references entity identity plus result lineage, not a row index or Canvas point index.

## Batching and backpressure

Consumers request or acknowledge bounded batches. A stream cannot accumulate unlimited pending messages because rendering is slower than the network. Maintain limits for row count, projected bytes, group cardinality and processing time. Yield long work to an injected scheduler or bounded worker; keep user input responsive. Avoid copying whole arrays on every update.

For streaming aggregates, choose and declare append-only/incremental/replacement semantics. Retractions and corrections require explicit delta operators and version checks. Do not increment a total twice on reconnect. If v0.1.0 cannot safely support a delta mode, use validated snapshot replacement and document the limit.

## Quality indicators

Provide distinct signals for empty population, no matching rows, missing observations, invalid values, partial page, sample, approximate result, stale source, permission restriction and transport failure. These are visible at the smallest useful scope, not a wall of global warning banners.

A no-data state offers a next step only when the application provides one. A plot with one timestamp is not labeled a trend. Unknown latest values remain unknown instead of backfilling the last known value without a declared policy.

## Provenance and drill-through

A result has a lineage reference to source/catalog/definition/query versions and bounded contributing-record queries. Storing every raw row in the workspace is unnecessary. For joins/aggregates, drill-through must reproduce the contributor population under the same policy/snapshot or disclose changed source data.

Source names and URLs may be sensitive. End-user provenance is authorized and redacted; devtools access is not an authorization bypass.

## Caching and persistence

Memory caches are bounded LRU/TTL with explicit dependency invalidation. TTL alone does not solve authorization revocation. Cache keys partition by principal/policy; revalidate on reuse. Local storage is opt-in; never persist provider keys, raw sensitive rows, result capability tokens, or every model transcript as workspace state.

Persist task references, semantic/profile versions, user choices and interaction state in a versioned document. Restore validates the document against current permissions and re-queries data. A saved result may be supported only via an explicitly configured secure storage service and retention policy.

## Resource tests

Mount/unmount loops must release subscriptions, event listeners, ResizeObservers, AbortControllers, workers, overlays, object URLs and data leases. Assert that a removed region has no active query ownership and no delayed callback capable of committing. Track retention by live handles/bytes, not only a noisy heap sample.

On a source schema change, invalidate incompatible plans and report a migration need rather than falling back to guessed field names. Invalid batch sequence, schema drift or type mismatch fails the affected result and cannot report renderer-ready success.

## Master consolidation independent quality axes

Counts are a tagged union: unknown; exact with a nonnegative safe integer and declared population scope; estimated with method and quantified or explicitly unquantified uncertainty. A descriptor cannot say an exact total exists without supplying it. Loaded count is a local materialization count, never the global count by default.

Coverage (complete/partial/sample/unknown), arithmetic precision (exact/approximate), evidence class (observed/computed/inferred), and freshness (current/stale/unknown) are distinct axes. A sample can contain exact record values but still be insufficient for an exact global ranking. A complete stream of a sample remains a sample. Do not convert an inferred label to observed truth merely by storing it in a complete Result.

Named result references bind result ID/revision, output ID, query digest and authorized scope. Multioutput bundles report per-source snapshots and whether consistency is shared, mixed or unknown. A number appearing in an explanation points to a version-bound evidence reference and an approved computation, not a model-created string.

Update batches specify replacement/append semantics and schema version; accepted streaming values never get committed merely because JSON became syntactically valid. Invalid/duplicate sequences, missing completion, changed source scope and unexpected batches fail locally and release buffers. Performance projection and source semantics cannot redefine one another.

# 11 — Transactions, concurrency, and honest receipts

## Execution

Parse bounded payload → validate structure/meaning/capabilities/permissions → identify exact workspace target → check base revision → prepare modules/query dependencies → recheck revision and permission after async work → commit one logical presentation update → track renderer acknowledgment and data readiness → return/retrieve compact receipt.

Use one serialized mutation owner per workspace for the first implementation. Async preparation can be concurrent, but compare-and-swap at commit prevents lost updates. Do not introduce CRDT or distributed transaction machinery before a real collaboration requirement exists.

## Idempotency and retry

RequestId is scoped to principal/tenant/workspace and associated with a canonical payload hash. Same identity plus same payload returns its known receipt without duplicating nodes. Same identity with different payload returns `idempotency_conflict`. Check authorization before serving a cached result, and do not expose another principal's receipt.

Define a bounded retention window. A retry outside that window must not promise exactly-once effects. For reconnect with uncertain state, inspect request status/current revision; never blindly replay irreversible actions. A cancelled request may already be committed: receipt states which stage occurred. UI undo after commit is a new operation, not evidence cancellation prevented the commit.

## Three independent states

| Axis | States | Meaning |
|---|---|---|
| Operation | rejected, conflict, prepared, committed, cancelled | Was the presentation state changed? |
| Render | not-required, pending, acknowledged, failed, disconnected | Did the target renderer acknowledge the exact revision? |
| Data | not-required, pending, ready, partial, failed | Are required bound results ready at their declared scope? |

A command can be committed while renderer is disconnected or data pending. A skeleton rendered with data pending is not a complete comparison. Partial outcomes identify which nodes are ready/failed. Do not encode these axes as one enum that erases important information.

A renderer acknowledgment verifies application projection/lifecycle, not metaphysical proof that pixels were seen by a human. Record `evidence: renderer-ack` and target revision. Browser-based tests separately check DOM/accessibility tree/screenshot for expected content. Foreground visibility/render opportunity should be recorded when available. A hidden tab must not claim user-visible completion solely because state was stored.

## Compact receipt

```json
{
  "contractVersion": "0.1",
  "requestId": "req-42",
  "workspaceId": "ws-demo",
  "operation": "committed",
  "revision": 12,
  "render": {"status": "acknowledged", "rendererId": "tab-a", "revision": 12},
  "data": {"status": "ready"},
  "outcome": "completed",
  "changedNodeIds": ["comparison"],
  "summary": "Comparison updated using the authorized snapshot."
}
```

This is a local normalized receipt, not a claim about the wire envelope of every MCP revision. Adapters wrap it using the pinned SDK/protocol. The reference schema validates shape; semantic checks require revision correlation, active target, and readiness before `outcome: completed` is legal.

## Pending outcomes

`workspace_apply` returns after a bounded wait, or returns `outcome: pending` with requestId. `workspace_inspect` can retrieve status by requestId; avoid unbounded polling or long silent model loops. A self-controlled harness can resume on completion events where supported. External harnesses vary; document the tested behavior and provide status recovery without claiming universal background execution.

Do not permanently mark the operation failed merely because a client's response deadline elapsed. Preserve inspectable status. A renderer crash after a successful commit yields a recoverable render failure; the next render/reconnect may project the current revision. Never roll back a newer human edit because an earlier renderer acknowledgment arrived late.

## Conflicts and rollback

Stale revision returns current revision and relevant conflict context, not a full private dataset. Agent must inspect/replan against current state. Automatic rebase is limited to explicitly commutative operations and must be documented/tested; default is no silent rebase. Prepare failure commits nothing. Commit itself is synchronous/atomic for presentation state. Module/data side effects during preparation are cancellable/cacheable but not part of database ACID.

## Bounded history and observability

Record logical operation IDs, status, durations, counts and sanitized reason codes. Full rows/prompts/tokens are not default telemetry. Keep history bounded by count/bytes with documented eviction. Undo records enough inverse presentation information, not a copy of the entire dataset per step.

Measure preparation, validation, commit, render opportunity and data latency separately. Do not report queue acknowledgment latency as “UI updated in 5 ms.”

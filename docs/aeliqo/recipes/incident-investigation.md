# Recipe — incident investigation

Purpose: exercise time, event/detail relationships and interaction without inventing an incident root cause.

Describe service, incident and event entities with stable IDs and explicit relations. Timezone/instant semantics, event source, ingestion delay, coverage and severity vocabulary are declared. Events occurring together provide temporal association only. A source may supply a known cause with attribution, but the UI does not infer it from proximity.

Compose an event timeline, service list, authorized detail and optional observed metric trend. Selection highlights related records without silently filtering the underlying event population. A brush applies a clearly labeled time-range filter only when the user requests filtering. Logs remain paged/server-owned; workspace state stores references rather than copying all events.

Acceptance: out-of-order arrivals, equal timestamps, duplicate keys, gaps, partial source outage, stale selected event, timezone switch and reconnect. Pointer navigation is immediate and never waits for a model. The same core must work even with no agent or MCP connection.

# 10 — Interaction semantics and business actions

## Event contracts

A shared interaction envelope contains eventId, origin node, workspace/revision context, event kind, typed payload, causationId/correlationId and propagation scope. The payload references domain entity keys or field ranges, not DOM elements, row indices, arbitrary JS handlers or raw sensitive records. Events are ephemeral unless explicitly mapped to durable presentation commands.

Supported first-wave intents: select/clear/compare-set, set filter/range, sort, page, expand/detail, drill to declared grain, focus/reveal, pin, change representation. Hover and pointer motion stay local unless a declared highlight link needs them.

## Links

A link connects a typed source port to a typed target port through a registered mapping. Same entity type can be mapped directly where scope agrees. Cross-dataset propagation requires a relation path/cardinality. A link is not permission to query data beyond the principal's authorization.

Prevent feedback loops using origin/causation tracking and idempotent application. Do not indiscriminately forbid every cyclic UI link: bidirectional selection can be useful. Reject unsupported cycles/transform graphs; for permitted equivalence links process each causation once per recipient and skip no-op changes. Property tests verify convergence and bounded propagation.

## Filters and scope

Predicate AST explicitly defines comparison, set inclusion, range endpoints, null checks and boolean composition. Visible chips show active filters, scope and source. Component-local, group and workspace filters do not silently override one another; combine by declared precedence and show inherited context. An empty set selection differs from “all”; null is not equal to empty string or zero.

Server paging and filtering: declare the operation executor. A local filter on loaded rows cannot be labeled global. “Select all matching” needs a server-supported predicate selection and snapshot behavior. IME composition is respected; debounce search only after composition completes, while UI typing remains immediate.

## Drill, compare and navigation

Drilldown changes grain/context through a declared relation, preserving a reversible breadcrumb. Compare is a stable entity set independent of current row order. Domain navigation occurs via app-owned ActionPort/navigation adapter and route allowlist; an agent-supplied URL is not automatically trusted. Browser Back behavior is tested for URL-synchronized presentation state.

## Editing and business actions

Editing primitives maintain a local draft with explicit validation and save/cancel. Server mutation uses business entity revision/idempotency, separate from workspace revision. Optimistic UI requires an app-declared policy and visible rollback/error handling. An edit form cannot save because a layout planner happens to rerender it.

Every business action declares side-effect type, input schema, permissions, confirmation policy, idempotency support and expected result. Read-only descriptor annotations are hints, not access control. Runtime/server rechecks authorization at execution. Human approval requirements are not bypassed by invoking the same action via MCP.

## Feedback without noise

Show local progress and a single concise status for a logical action. Do not stream every pointer tick into global history, chat, telemetry or screen-reader live regions. Announce relevant committed changes with throttling and respect user context. Provide undo only when it truly reverses the operation.

## Required tests

Keyboard and pointer parity; clearing filter restores full eligible data; field-specific range types; null predicate behavior; relation rejection; select-all remote semantics; causation loop termination; simultaneous user/agent selection; draft preserved through variant change; mutation conflict and retry; permission revoked between preview and execute; cancelled query cannot overwrite current result.

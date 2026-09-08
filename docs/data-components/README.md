# Data components

The data family is one shared Lit implementation with direct imports under
`@aeliqo/web/data`. It renders host supplied values and scopes; it does not
execute a query, infer a metric, or create a region/runtime. Each component
accepts the same explicit loading, partial, stale, error and unavailable
states where those states apply.

`Metric` renders one validated value with its unit and visible scope.
`Delta` requires an explicitly compatible baseline. Its `absolute`, `relative`
and `percentage-point` modes remain distinct, and a missing or zero baseline
is unavailable instead of being treated as zero. Terminating decimal ratios
remain exact; repeating ratios are unavailable instead of being silently
rounded. `KeyValue` uses a native definition list. `Detail` keeps the selected
record's stable identity and renders declared fields even when a field is
missing.

`RecordList` and `CardCollection` derive selection keys from declared identity
fields. Render position is never an identity. Selection events are proposals;
the host owns `selectedKeys`, permissions and the result reference. Cards have
an explicit bounded **Load more** event and disclose the current scope.

`Table` uses a native `table` by default. `mode="grid"` is an explicit
interactive mode with roving cell keyboard navigation and explicit row and
column positions. Sorting and paging emit typed
requests for the host. Virtualization is bounded by `virtualStart`,
`virtualCount` and `overscan`, and known loaded/total counts remain visible in
the scope text and ARIA row count. Exact decimal cells remain display strings.

`FilterBuilder` builds the canonical typed predicate vocabulary, shows the
inherited scope, and emits only after the user activates **Apply**. Field
options may include the complete core `semanticType`; when only the convenience
`type` is supplied, entered values are still validated before emission. Unknown
fields, invalid dates and unsafe integers are rejected. Typing and IME
composition update a local draft and never execute a query. `SelectionSummary`
distinguishes observed identity selection from a server predicate selection so
it cannot imply that loaded rows represent an unobserved global set.

The components prefer native lists, definition lists, tables, buttons, form
controls and visible focus. The shared styles include wrapping, RTL-safe
logical sizing, forced-colors focus and reduced-motion-compatible controls;
application tokens supply the final visual values. Browser and screen-reader
review remains part of the product release gate.

Focused local checks for this slice are:

```sh
pnpm exec vitest run --config tests/data-components/vitest.config.mjs
pnpm exec playwright test --config tests/data-components/playwright.config.mjs
```

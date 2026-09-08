# Input primitives

The input family is a shared native form boundary for the web package. Each
field owns a labeled native control, participates in `ElementInternals` form
submission and reset, and emits typed user proposals. A host remains the
authority that accepts a proposal or performs an action.

The family includes text and number editing, checkbox/radio/switch/select
choices, bounded combobox loading, calendar dates and ranges, sliders, search,
file metadata, field groups and forms. Values that carry meaning stay typed:
number fields retain an exact canonical decimal string, date fields retain a
`YYYY-MM-DD` calendar value, and file events expose metadata without copying
file bytes into an agent payload.

`AeliqoComboboxElement` accepts a bounded `options` array or an
`optionsLoader(query, signal)` callback. Each request is abortable and a late
response is ignored. `AeliqoSearchFieldElement` emits `aeliqo-search` only on
Enter or after an explicit bounded debounce; IME composition never commits a
partial query.

Direct imports are available from `packages/web/src/input/index.ts`. The
package root and custom-element registration remain thin integration layers;
applications can register only the tags they use.

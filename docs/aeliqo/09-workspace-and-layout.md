# 09 — Workspace and adaptive layout

## Workspace is a coordinator, not a mega-component

Store normalized nodes, stable IDs, bindings, shared interaction state, reading order, layout tree and pin policy. Node content is lazy-loaded through a registry. Workspace must not eager-import every component or own all application rows. Data caches remain outside presentation snapshots.

Layout primitives: stack, grid, split, tabs and leaf. Higher-level master/detail, comparison, dashboard and investigation layouts are recipes over these primitives. The initial implementation should use a small deterministic constraint planner and CSS, not a general-purpose solver or freeform design editor.

## Constraint model

Each component declares minimum usable size, preferred aspect/size range, optional compact variant, priority, and allowed overflow behavior. Workspace adds container dimensions, readable order, group relationships, user pins, active interaction and device preferences. Reject impossible layouts or fall back with explanation; do not shrink interactive targets until unusable.

Hard constraints precede preference scoring. Priority can hide secondary details behind a disclosed expansion, not discard task-critical data. Reading order is explicit and must remain meaningful in DOM/keyboard traversal; CSS visual reordering is not sufficient by itself. [R15]

## Layout adaptation sequence

Update sizes with CSS → simplify labels/density if allowed → use approved compact variants → stack groups in stable order → move secondary detail into a disclosed region only when interaction/focus rules permit. Do not repeatedly switch layouts on tiny width fluctuations. Hysteresis rules are evaluated under repeated resize and input stress, not only static breakpoints.

## Identity and input preservation

Stable keys within one parent are necessary but do not guarantee preservation across reparenting. Preserve interaction-critical state in a stable keyed owner and test actual moves. Never move/destroy a focused editing subtree during typing/IME composition. Save draft, validation, caret/selection when a transition genuinely requires remount, or defer it. [R31]

Pin scopes: node position, representation, query/filter, dimensions, or full node. Pin conflicts return `policy_conflict` with target IDs. Agent plans built on old revision cannot override newer human pins. UI offers explicit unpin/retry; a planner cannot unpin as an invisible convenience.

## State views

Persist only serializable presentation state: descriptor IDs/versions, binding/query, layout, pins and view preferences. Auth context, data rows, transient focus, model keys, DOM snapshots and provider tokens are excluded. URL-state adapters are optional and must cap size, omit sensitive filters and use app-owned navigation. Save/load migrates versioned specs explicitly.

Undo/redo covers local presentation operations and filter/selection changes according to policy. Hover and every resize tick are not history entries. Group a drag into one history event. UI undo does not reverse a payment or mutate database rollback; business compensating actions belong to the application.

## Responsive surfaces

Mobile supports one-column primary flow with accessible region navigation and visible active-filter context. Desktop can use master/detail and multi-panel comparison without burying the main visualization under toolbars. Panels expose local controls only when relevant; keyboard commands remain discoverable. Resizers need keyboard and reset-to-default actions.

## Acceptance scenarios

Sixteen blocks with one shared filter: only affected bindings recompute, unrelated input stays responsive. An agent adds a chart while the user types in a detail form: draft/focus remains intact. Resize across thresholds repeatedly: variant does not oscillate. A persisted workspace references a missing optional component: display a recoverable placeholder and preserve spec for later load, not delete it. Last tab closes while an operation is queued: report disconnected/not-presented honestly.

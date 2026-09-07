# 10 — Interaction, accessibility and user agency

## Baseline

Target WCAG 2.2 AA for complete supported flows, with WAI-ARIA APG patterns as interaction references, not an automatic certification. Native elements are preferred. Automated checks cannot replace keyboard, zoom and actual assistive-technology review. [S01, S03, S04]

## Interaction state machine

Separate ephemeral hover/pressed/drag state from durable selection/filter/navigation and from domain drafts. Typed events carry eventId, origin, causationId, target region, task/result revisions and payload. No raw DOM node, arbitrary URL, code string or record index is a semantic event identity.

State transitions are deterministic and idempotent where appropriate. Controlled components emit proposals; application props remain authoritative. Uncontrolled components honor initial defaults and own only their declared state. Never switch modes implicitly after adaptation.

## Selection and linked views

An entity selection means a stable entity key within authorized scope. A multi-selection distinguishes explicit IDs, loaded page selection and server-supported “all matching” predicates. The latter requires a query/snapshot contract and cannot be faked with selected visible rows.

Bindings can propagate selection, groups, range and filters only through compatible declared ports. A chart brush is not permission to change every region's query. Reset/clear must restore the correct prior scope, not an unfiltered unauthorized population. Stale results cannot overwrite active selection; unavailable selected identities remain visible as unavailable when that is meaningful.

## Focus and draft preservation

Each interactive view owns focus through a stable semantic target (view role, entity, field/action), with a documented fallback on removal. Variant changes transfer focus and selection where a valid equivalent exists. Do not steal focus to a newly streamed chart. A keyboard action that opens detail moves focus predictably; closing returns focus to the invoking control.

Keep editing drafts in an explicit draft controller keyed by entity/field and domain version. Layout changes do not save/discard them. Dirty drafts, IME composition, dragging and critical dialogs postpone incompatible structural adaptation. Source updates raise conflict/resolution rather than replacing a draft silently.

## Layout and navigation

Reading order and DOM order match meaningful hierarchy. Do not visually reorder panels via CSS without matching navigation order. Drill-in uses an explicit breadcrumb/back operation tied to application navigation policy. App-owned routes are declared templates/handlers; an agent cannot choose arbitrary destination URLs.

An explicit table can remain a scrollable table when its relational layout is essential. Narrow adaptations must preserve operations as well as field reachability. Text resizing is not counteracted with smaller fonts simply to make the same layout fit. [S02, S03]

## Forms and actions

Inputs have persistent labels, associated hints/errors, required/invalid/disabled/read-only/pending states and stable validation timing. Preserve native form behavior, Enter/submit rules, autofill/password-manager compatibility where relevant and form-associated custom element tests. Native control reset must synchronize runtime state.

Business actions are separate from view changes. An action declares input/output schema, side-effect class, authorization, confirmation, idempotency and entity revision behavior. The server rechecks authorization at execute time. Undo is offered only when a real inverse/compensating operation exists. A model/renderer cannot bypass confirmation by calling a lower-level method.

## Accessibility matrix

Keyboard operation, no trap, visible focus, focus not obscured, escape/return for overlays, touch targets, screen reader names/descriptions/status, contrast, non-color state cues, reduced motion, forced colors, 200% text, 400% zoom/reflow, RTL and long translated content. Use a design default of comfortable large targets; WCAG minimum target-size exceptions are documented rather than assumed. [S01]

Graphs/charts need a name, summary, units/time/scope and an accessible data exploration path. A hidden textual sentence alone is not always an equivalent interactive alternative. Dense Canvas plots have a bounded navigable selection/detail mechanism; never create 100,000 hidden focusable nodes.

Virtualized collections disclose row counts when known, maintain focus when rows recycle, provide stable keyboard behavior and a nonvirtualized/paged alternative where the assistive-technology contract requires it. Test the actual implementation instead of asserting virtualization is automatically accessible.

## Error and announcement quality

Use one local progress message for a logical operation, not announcements per streamed token/point. Error text explains what happened and a valid next step. Do not expose hidden field names or sensitive records in accessible error strings. Loading placeholders reserve space but do not masquerade as real values.

## Required review

Automated axe/browser checks are necessary but insufficient. Before declaring AA support, record manual VoiceOver/Safari and NVDA/Firefox or Chromium review for the actual supported platform matrix, including custom element boundaries. If these environments/people are unavailable, report the gate blocked rather than claiming conformance.

## Master consolidation materialization, trusted origin and collaboration boundaries

A typed interaction describes semantics, not physical DOM events. Runtime maps a filter/range/page request to an explicit parameter update; a view-only change reuses data where possible. Confirmation and principal identity are supplied by the trusted application context. An agent payload claiming to be `human` never bypasses confirmation.

The v0.1.0 local region has one serialized commit authority; multiple input channels share it. Optimistic concurrent proposals validate a read set. Rebase only verified disjoint changes; conservative rejection is preferable to erasing a user's newer choice. Do not add CRDT/multiplayer infrastructure to implement this local concurrency guarantee. Hosted collaboration can add a separate coordination service later through the same versioned contracts.

A schema-valid interaction still needs contextual checks: selected ID must belong to permitted population, temporal endpoints must match the bound calendar, page cursor must match the current filter/order/snapshot, and draft field must be editable. Do not treat syntactic payload checks as sufficient.

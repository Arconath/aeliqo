# 07 — UI grammar and component abstraction

## Right abstraction level

Core must not model arbitrary DOM/JSX or domain screens such as HRDashboard. Model reusable experience nodes: structure, content, collection, control, visualization and approved application action/navigation affordances. Public component APIs can expose `Table`, `Trend`, `Dialog`, etc.; the internal grammar can share foundations without making every user author a giant JSON tree.

A node has stable ID, semantic role, registry kind/version, data binding reference, typed configuration, interaction ports and accessibility requirements. Large datasets are held through scoped result handles. Callbacks and render functions exist only in trusted local code and never become serializable agent payloads.

## Primitive families

Structure includes stack/grid/split/panel/tabs/overlay primitives. Content includes text, metric, status and detail. Collection includes list/table/cards/tree. Controls include selection, search/filter/range and form inputs. Visualization uses declarative plot specifications plus relationship/hierarchy layouts. Navigation is an application-approved intention such as open detail or follow route, not an arbitrary URL.

The release catalog enumerates ready-to-use components. That catalog is not the grammar itself: a new approved component can realize an existing grammar role. Semantic query fields do not become CSS or D3 arguments.

## Composition, not copied behavior

An Explorer is a trusted composition of filter, collection and detail plus typed bindings. An Investigation is a composition of metric, plot, timeline and contributors. Compounds may own a small domain-neutral coordination controller, but they cannot duplicate selection/query/permission logic or create another workspace state system.

Expose compounds as convenient standalone components with controlled values. Their expansion must preserve the same event semantics as manual composition. Test both forms against common fixtures.

## Interaction ports

Ports declare payload type and scope, for example entity selection, bounded entity set, dimension group, temporal range, filter predicate, page cursor, draft edit, or action proposal. Links declare an approved mapping with compatible identity/grain/units. A range does not automatically filter every view in a region; the binding must explicitly say what it affects.

Selection can be bidirectional where it is a convergent identity equivalence. Causation IDs, no-op suppression and visit guards prevent loops. Reject arbitrary feedback computation or mismatched relation cycles. Do not prohibit all cycles merely to avoid implementing correct event propagation.

## Extension boundary

A trusted extension supplies a versioned manifest, validated config schema, compatibility/semantic preconditions, a platform realization, state-transfer rules, and conformance evidence. Register it at build/startup through trusted code. The model may choose a registered extension ID; it may not provide a URL to load a module or eval a renderer.

Profiles can forbid extensions or approve a subset. Standard conformance means the extension respects identity, focus, accessibility, theming, events and result completeness; it is not a way to certify arbitrary third-party code safe.

## Plot specification

A plot declares marks, field/metric encodings, scale/axis/legend constraints, grouping and interactions. Public helpers such as Trend/Scatter/Distribution compile into it. Do not expose every D3 or Vega option as Aeliqo API; use a deliberately supported vocabulary with typed errors for unsupported combinations. Declarative grammars are established prior art, not a novelty claim. [S07]

The renderer receives compiled geometry and semantic accessibility information, not an arbitrary query. SVG is the default for modest mark counts. Dense geometry can switch to a tested Canvas realization while retaining accessible summaries and a bounded interactive data alternative. Form controls and primary text remain native DOM.

## Escape hatches without chaos

Default customization is tokens, density, approved variants, icon/text slots, formatters and named parts. Trusted local custom content is allowed only in documented slots and carries explicit accessibility responsibility. Wire profiles cannot contain arbitrary style maps or executable callbacks. Teams that override undocumented internals are outside conformance guarantees, but ordinary CSS customization is not falsely called impossible or prohibited by the browser.

## Source of truth

There is one registry manifest for each component/pattern. It drives API type generation, wire validation, docs, Studio options, planner discovery and conformance tests. Keep compiled TypeScript and JSON Schema in sync through generation; neither is separately hand-maintained. Snapshot/public API diffs expose breaking changes.

## Master consolidation explicit graph structures

Store containment as an ordered tree with unique parent ownership of rendered nodes; shared templates expand into distinct instance IDs. Store result/task dependencies as a separate DAG. Store interaction links as typed port pairs with registered mapping versions. A cycle in data or containment is invalid; a tested convergent selection-equivalence cycle is permitted. Avoid a single generic graph engine with unlimited feedback expressions.

Built-in interaction payloads are discriminated: entity-key selection/clear, predicate-set selection, temporal range, group, filter, page/cursor, approved navigation, draft changes and action requests. A generic JSON payload is allowed only for an allowlisted versioned extension with its registered runtime schema, never as a bypass for built-ins.

State-transfer maps refer to stable semantic view/field/entity identities. Draft lifetime is independent of rendering lifetime. The agent cannot set actor, trust, confirmation, or authorization by passing them in a serialized event. The authenticated adapter supplies execution context.

Plot grammar includes unit, layer, facet and concatenated views with explicit shared/independent scale resolution. Repetition can be a trusted compile-time macro; it need not be another unbounded wire mechanism. Encodings require semantic compatibility. Relationship/hierarchy layout remains a distinct tested geometry family rather than forcing every diagram into Cartesian axes. All charts render through the same owned web surface/behavior conventions.

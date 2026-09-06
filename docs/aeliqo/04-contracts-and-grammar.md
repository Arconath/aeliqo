# 04 — Contract, schema, grammar, and extensibility

## Contract layers

1. **Developer authoring API**: ergonomic typed functions/props; trusted callbacks and slots are allowed here.
2. **Portable semantic specification**: JSON-compatible meaning, bindings, interactions, layout constraints, and policy; no executable callbacks.
3. **Runtime command model**: validated operations/intent plans with revision, target, and request identity.
4. **Renderer projection**: implementation-specific DOM/SVG/Canvas concerns; not leaked into the portable spec.
5. **Protocol adapters**: MCP/WebMCP/BYOK translate schemas and transport envelopes without inventing UI semantics.

Do not expose a giant DOM AST as the primary public API. Equally, do not constrain everything to `type: chart, data: []`. The grammar must express task, data meaning, relationships, and reversible presentation choices independently.

## Canonical model

`DatasetDescriptor` describes entity/grain/key, typed fields, optional metrics and relations, query capability, and metadata confidence. `ComponentManifest` describes version, level, tasks, accepted data shape, prop-schema ID, typed ports, variants, capabilities, lifecycle/fallback obligations, and a trusted build-time loader key. `WorkspaceSpec` contains nodes, bindings, interactions, layout tree, policies, and presentation revision. Source rows and provider keys are not part of workspace serialization.

`ViewIntent` represents a bounded semantic task (e.g. compare, explore, trend, inspect) plus target/binding/metrics/constraints; it is not a second free-form prompt to another hidden LLM. `CommandBatch` represents explicit reversible UI changes. Both compile to the same typed operation pipeline; intent support is discoverable and extensible by registry.

## Grammar sketch

```ebnf
Workspace = Version, Id, Revision, Nodes, Layout, Links, Policy ;
Node      = Id, ComponentRef, Props, Binding?, NodePolicy ;
Layout    = Stack | Grid | Split | Tabs | Leaf ;
Binding   = DatasetRef, ViewQuery, DataScope ;
Predicate = Compare | InSet | Range | NullCheck | And | Or | Not ;
Metric    = Aggregate | Ratio | WeightedMean | RegisteredMetric ;
Intent    = TaskRef, Target, Binding, Metrics?, Preferences? ;
Batch     = Target, BaseRevision, RequestId, Operation+ ;
Operation = Add | Configure | Remove | LayoutSet | LinkAdd | LinkRemove
          | FilterSet | SelectionSet | PinSet ;
```

This EBNF explains composition; the machine-readable reference schemas in `contracts/v0.1/` specify the narrower executable candidate subset. Features not represented there (for example custom transform extensions) are **future/host registry contracts**, not silently accepted JSON. Docs, schema, generated types, and fixtures must evolve in the same change.

## Versioning

Separate package version, contract version, descriptor revision, workspace presentation revision, and data revision. A new dataset snapshot must not be mistaken for a compatible schema change. Component IDs are namespaced and stable; versions describe contract compatibility. Unknown major contract versions are rejected with `unsupported_version`. Optional additive fields require schema compatibility review, because strict validators can reject even additive wire changes.

Migration functions are explicit, pure, tested on saved fixtures, and produce warnings for changed meaning. Never silently rewrite a saved spec to use different metric/aggregation/renderer. Contract compatibility checks occur before side effects. Keep a documented supported read/write version matrix.

## Single source of truth

For a reconciled implementation, nominate one authoritative runtime/wire schema source and generate TypeScript types, validators, tool schemas and API docs where possible. Avoid hand-maintaining three near-identical interfaces. TS types alone do not validate network inputs. Optional Zod adapter cannot erase refinements silently; unsupported refinements need shared runtime semantic checks or rejection. Use JSON Schema draft 2020-12 for the reference authoring format, and compile an explicit subset per model/protocol target. [R06, R07]

Structural limits: maximum request bytes, nodes, ops, nested predicates/layout depth, text length, sample rows and registry result size. A recursion-friendly schema is not a DoS defense by itself; a bounded traversal validates depth and referenced graph complexity before expensive work.

## Progressive semantics, not a descriptor tax

Standalone primitive may receive explicit `value` or `rows` with a formatter/accessor and no workspace. A shared semantic binding needs minimal dataset ID, stable keys, fields, and scope. Aggregation adds grain/unit/aggregation rules. Cross-dataset interaction adds typed relations. Remote queries add declared capabilities. Do not require dozens of unrelated fields for a simple local Metric.

## Extension ladder

Theme tokens → named part styles → trusted slots → custom component registration → custom semantic metric/transform registration → renderer/DataPort/protocol adapters. Every extension declares the surface it owns and passes conformance. Advanced escape hatches cannot backdoor agent-provided arbitrary code.

A plugin can register a typed extension such as `acme:retention-cohort@1`, with schema, input/output semantic type, resource budget, implementation, deterministic behavior or declared effects, and fallback. Wire payload holds only namespaced extension ID + validated configuration. Registry loader mapping is compiled or explicitly supplied by the developer; never import an arbitrary URL named by the model. Core can reject unsupported extension while preserving the rest of a saved document for migration/read-only inspection.

## Semantic validation phases

Parse/size bounds → version/schema validation → resolve IDs/refs → validate component-specific props → bind fields/metrics → units/grain/aggregation checks → relation/cardinality checks → query capability checks → policy/permission → plan preparation → revision recheck → commit. Return structured error with path, reason code, and supported alternatives. A well-typed JSON tree may still be mathematically or operationally wrong.

## Preventing abstraction lock-in

A new valid use case should normally add a manifest/renderer/semantic extension, not a conditional branch in a mega-component. Require two unrelated domain recipes (model comparison and revenue investigation) plus a third custom manifest to verify that APIs are not hardcoded to `model`, `price`, or `benchmark`. Conversely, do not invent generic services before those examples show repeated logic. Document capabilities and limits directly; “unlimited components” is not a meaningful API guarantee.

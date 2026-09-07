# 09 — Aeliqo experience standard and developer/designer workflow

## Opinionated without being hostile

Aeliqo defines the design vocabulary and approved adaptive patterns. Users do not construct an unrestricted mini-CSS framework or override core behavior per team. The standard is an Aeliqo project convention, not a certified industry specification.

The default components are polished and complete. Teams customize brand tokens, density, content labels, permitted variants, approved slots and experience profiles. They do not need to design each dashboard or author every possible user question. Developers connect capability; domain owners define meaning; designers choose constraints within Aeliqo patterns; end users express intent.

## Four entry levels

1. **Use a component:** records/value props, styling included, stable identity when needed. No planner or agent setup.
2. **Connect meaning:** reuse an entity/metric descriptor across components. Only unresolved identity/unit/grain needs clarification.
3. **Mount a smart region:** attach a DataService and approved profile. Aeliqo coordinates tasks, data, views and interaction.
4. **Enable agent control:** attach external MCP/WebMCP or a server-side model port. Everything still works manually.

`<Table data={employees}>` is a useful target convenience, but incomplete/ambiguous row IDs must not silently become array-index identity. In docs show the ergonomic path and the honest errors. Every public code sample is compiled against built packages before release.

## Profiles

Profiles include `fixed`, `adaptive` and `composable` layout authority. Agent enablement is a separate control. A fixed region can still support agent filtering/query selection while preserving its approved representation. A composable region can add approved patterns but not change the app shell or trigger business actions by layout mutation.

A profile chooses allowed pattern families, content/interaction priorities, density, comparison rules, narrow-layout strategies, visual invariants, motion, and supported navigation surface. Provide meaningful presets (record inspection, comparison, analytical exploration, form task) so most teams do not author profiles from scratch.

## Design token system

Use semantic tokens for surface, text, border, focus, accent, status, spacing, typography, radius, elevation, motion and visualization encodings. Light/dark themes and high-contrast behavior are first-class. Tokens may import/export the DTCG format where supported; DTCG is a community specification, not a W3C Recommendation. [S13]

Use a deliberate spacing/type scale and consistent control metrics. Color alone cannot carry selection/status. Support long text and translations without fixed-height clipping. Do not add gradients, glass effects, cards and dashboards solely to appear sophisticated.

## Developer workflow

The init/doctor command imports available metadata, reports unknowns and produces editable manifests; it does not silently call arbitrary production APIs. Devtools shows source capabilities, semantic gaps, query plan/cost, result scope, UI decision, changed constraints, subscriptions and resource ownership. Errors identify a path, expected meaning, actual issue and remedy. Avoid vague “invalid config” or repeated console spam.

Local hot reload updates definitions/profile previews with dependency invalidation. A breaking change shows impacted tasks before activation. API inference should avoid requiring `any`, duplicated generic arguments or schema-library-specific component props.

## Designer workflow

Local Studio has four spaces: **Data & Meaning**, **Experience**, **Component Gallery**, and **Inspect**. Data & Meaning supports AI-assisted/manual semantic authoring with preview and scope. Experience previews approved patterns across sizes/data states and lets designers set constraints/tokens, not arbitrary pixels per record. Gallery shows actual components, not screenshots pretending to be implementations. Inspect explains why a candidate was selected/rejected.

The main preview is uncluttered; advanced details use an inspector drawer. Studio is an authoring tool, not an end-user prerequisite. Changes export the same versioned manifests used by code. Code and Studio are two editors of one document model; do not make incompatible formats or two sources of truth. Local editing includes validation/diff/export without paid login.

## End-user workflow

End users see a normal app region, a clear optional request control, active scope/filters, useful loading feedback and undo for reversible view changes. They are not exposed to schema ASTs or model settings on every query. When a domain term is genuinely unknown, show Define with AI/Define manually only to authorized authors; other users see a concise request-for-definition path.

View suggestions should be deliberate where they change mental model. Do not rearrange controls while a user is typing. Keep inspector/tool logs secondary, not mandatory UI clutter. Announce meaningful changes via one throttled status region.

## Onboarding acceptance

A new developer must render a standalone table, connect a local semantic source, connect one HTTP service, mount a region, and enable an agent with copyable tested examples. A designer must modify brand tokens, preview narrow/zoom/RTL states, limit an approved pattern, export a profile, and understand one planning decision without changing runtime code.

Run these tasks with at least one independent developer and one design reviewer. Record completion, errors and confusing terminology. Target fewer required concepts rather than artificially short code that hides missing setup. This is a release evidence requirement, not a claim that these sessions happened during kit preparation.

## Master consolidation opinionated freedom within Aeliqo

Our system owns the design vocabulary, native behavior defaults, semantic slots, pattern library and adaptation rules. Consumers can choose tested variants/tokens, constrain profiles, and register conformant extensions; they do not have to invent every screen or source a separate UI library. Designer control is bounded, but not hostile: escaping incidental DOM/CSS internals forfeits only the guarantees it invalidates, not the ability to use the library.

Studio and code edit one versioned document model. Temporary task derivations need not pollute the global meaning catalog. A reviewer can compare actual query/result/experience diffs before publication. Default UI keeps tool traces and schema/graph internals in a secondary inspector.

A composable profile allows compositions without an exact preset. An `allowedPatterns` list alone must not accidentally mean that custom valid compositions are forbidden; composition authority and allowed primitive/operation families are explicit. User-specified representations are constraints; inferred tastes are soft preferences. Preference learning requires an explicit user-visible setting, can be reset, and never changes meaning/permission.

End-user task success, developer setup mistakes, time to first useful view, and number of integration callbacks are measured on external onboarding tasks. Counts of schemas/components are not substitutes for those outcomes. No mandatory cloud account, model key or giant descriptor for a standalone component.

## Master experience acceptance

Use [38-public-site-docs-playground.md](38-public-site-docs-playground.md) for concrete public routes, docs/examples/Studio/playground behavior. The default appearance is Aeliqo-owned, with bounded tokens/parts/profiles and real component states. AI failure retains a usable authorized prior view, explains actionable gaps and does not fill the page with mandatory diagnostics. Do not label generated imagery as live runtime proof.

## Developer-authored meaning DX (edition 1.1)

Developers can ship built-in meaning through typed code/config using the manual authoring route. They must not need Studio, a model provider or runtime approval from every end user. Provide field/metric autocomplete from reused Catalog schemas, concise builders, path-specific errors, local tests/previews and documented compile/startup registration. Do not expose the internal expression DAG as compulsory boilerplate. Meaning definitions do not choose UI.

The application bundle is the source of truth for code-owned definitions. Studio inspects it or creates a proposed diff; editable personal/session derivatives have distinct IDs/scope. Never silently merge conflicting definitions or overwrite repo-owned code. A permitted reviewed release pipeline activates definitions through the same validations. Developer origin alone is not authority. Detailed rules are in [meaning](03-semantics-derived.md) and a proposed ergonomic example is in [API sketches](22-api-sketches.md).

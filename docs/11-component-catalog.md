# 11 — Complete ready-to-use release catalog

The exact v0.1.0 inventory is `harness/components.json`. Each entry is a **required implementation**, not an available feature in this kit. The table is deliberately finite so “complete” is testable. No component may be advertised merely because a manifest or screenshot exists.

## Public product levels

**Primitives** offer direct data/value APIs, styling, accessibility and interaction. **Semantic compounds** coordinate the same primitives around a task. **Adaptive regions** compose approved patterns with shared semantics, data and interaction. All three may work without an LLM; all remain subject to the same contracts when an agent is enabled.

## Common definition of done

Every component requires: stable typed API; direct import isolation; styled light/dark/high-contrast states; disabled/read-only/invalid/pending where relevant; loading/empty/partial/stale/error where data applies; long text/localization/RTL; controlled/uncontrolled contract when applicable; keyboard/touch/focus; SSR/hydration where supported; resize/text-zoom behavior; cleanup; actual runnable docs; visual baselines and review; unit/browser tests; and component-specific performance evidence.

A component has named parts/tokens, documented semantic inputs, emitted/accepted interaction ports, version/migration policy, renderer capabilities, and allowed adaptation transitions. Named parts are stable API; incidental DOM nesting is not.

## Catalog organization

Foundation and layout provide surfaces, text, status, spacing, panel, split/tabs and state feedback. Inputs and actions provide native-quality controls, validation and confirmation. Collections provide table/list/cards/tree/detail/search/pagination. Visualization provides point/line/bar/area/distribution/matrix/heatmap/hierarchy/relationship views with correct data semantics. Compounds provide record exploration, comparison, time investigation and form tasks. Studio/region controls provide view choice, scope, history and diagnostics without cluttering end-user screens.

Do not hide a second unfinished catalog behind “enterprise.” The complete finite v0.1.0 inventory is OSS. Hosted collaboration and service governance are separate commercial capabilities.

## 2D completeness boundary

The plotting core supports the declared marks/encodings and tested chart families. A full GIS stack, a spreadsheet engine, CAD, 3D, rich media editor or universal scheduling optimizer is not implied. Large hierarchical/relationship data must use bounded expansion, stable layouts and accessible alternatives; they cannot hide expensive force simulations in a render loop.

## Implementation strategy

Build native behavior foundations first, then families with shared controllers/geometry/tokens. Complete each family through actual states and docs before claiming it done. Compounds expand the same primitives rather than copy markup/state. A standalone Metric or Button must not allocate a Region runtime. A standalone chart must not instantiate a model or import MCP.

## Catalog gate

`harness/components.json` starts with all entries `planned`. Change one to `done` only with evidence mapping code paths, public entry, tests, screenshots, accessibility review and package size. `scripts/gate.py release` rejects any unfinished entry. The final runtime API/export checker must compare actual built exports to this inventory and reject undocumented or missing entries.

A generated per-component acceptance table is in [component contracts](29-component-contracts.md). Keep it synchronized with the JSON inventory; shared checks do not replace the specific behavior listed per entry.

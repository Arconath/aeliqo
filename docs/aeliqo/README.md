# Aeliqo — engineering and product docs

Version 2 continuation kit; prepared 6 September 2026. **Design target, not an audited implementation.** Read [context/status](00-context-and-status.md) and follow [PoC migration](18-poc-migration.md) before editing source. Keep the existing project; map actual APIs/commands instead of scaffolding anew.

## First session

Use [START-IMPLEMENTATION.md](START-IMPLEMENTATION.md). Produce actual `current-state.md` from the template, then an active execution plan. If proposed files were staged in `.aeliqo-incoming/`, reconcile them with existing files instead of deleting a folder. Only local `.agents/skills/aeliqo-*` workflows are in scope.

## Reading map

- [00 — Context, authority, and evidence](00-context-and-status.md)
- [01 — Product requirements](01-product-prd.md)
- [02 — Smartness: level, mode, and ownership](02-smartness-model.md)
- [03 — Architecture and dependency direction](03-architecture.md)
- [04 — Contract, schema, grammar, and extensibility](04-contracts-and-grammar.md)
- [05 — Data semantics and correctness](05-data-semantics.md)
- [06 — Component contract and developer experience](06-component-contract-and-dx.md)
- [07 — Component needs catalog](07-component-catalog.md)
- [08 — 2D visualization system](08-visualization-2d.md)
- [09 — Workspace and adaptive layout](09-workspace-and-layout.md)
- [10 — Interaction semantics and business actions](10-interactions-and-actions.md)
- [11 — Transactions, concurrency, and honest receipts](11-runtime-transactions.md)
- [12 — Agent routing, MCP, BYOK and WebMCP](12-agent-routing-mcp-webmcp.md)
- [13 — CSS, tokens, visual design, and motion](13-css-tokens-motion.md)
- [14 — Performance targets and evidence](14-performance-and-benchmarks.md)
- [15 — Accessibility and inclusive behavior](15-accessibility-quality.md)
- [16 — Test strategy and evaluation oracles](16-test-strategy.md)
- [17 — Documentation website experience](17-docs-site-ux.md)
- [18 — Continue the PoC safely](18-poc-migration.md)
- [19 — Implementation plan with gates](19-execution-plan.md)
- [20 — OSS to business: boundary and validation](20-oss-business-strategy.md)
- [21 — Competitive validation and differentiation](21-competitive-validation.md)
- [22 — Packaging, release and basic security](22-packaging-release-security.md)
- [23 — Catalog waves and maintenance economics](23-component-waves.md)
- [24 — Research ledger](24-research-ledger.md)
- [25 — Traceability to the user's eleven requirements](25-acceptance-matrix.md)
- [26 — Defaults, unknowns, and decision triggers](26-open-decisions.md)

## Supporting assets

[Reference schemas](contracts/v0.1/README.md), [catalog data](catalog/component-needs.json), [routing/data eval specifications](evals/README.md), [benchmark targets](benchmarks/targets.json), [documentation-site pages](docs-site/README.md), and [design tokens](design/README.md). Recipes prove [model exploration](recipes/model-explorer.md), [revenue investigation](recipes/revenue-investigation.md) and [incident investigation](recipes/incident-investigation.md) use the same abstractions.

Templates: [current state](templates/current-state.md), [component spec](templates/component-spec.md), [execution plan](templates/exec-plan.md), [release evidence](templates/release-evidence.md), [bug reproduction](templates/bug-reproduction.md). Architecture decisions are in `decisions/`. Primary-source research metadata is in [research/sources.json](research/sources.json).

## Authority and evidence

User direction and applicable repository instructions govern. This package preserves prior product decisions while turning them into proposed contracts and gates. Source status, version support and actual commands must come from the local repository. A plan/catalog/schema does not establish implementation, a mocked test does not establish external harness behavior, and performance targets do not establish measured speed. Do not publish aspirational capabilities as stable docs.

Read only the pages and local skill relevant to the task. Keep live session context focused; do not paste all documentation into every prompt.

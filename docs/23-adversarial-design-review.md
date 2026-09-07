# 23 — Adversarial review of the architecture

This review identifies design risks; it is not an independent executed agent audit. Turn each item into the indicated gate.

| Risk | Design correction | Evidence required |
|---|---|---|
| “Agnostic” hides hundreds of connectors | One ADC and local/HTTP transports; optional authoring importers | Same protocol for HR and commerce hosts; explicit unsupported query |
| Shared core but duplicated React/Vue visuals | One web implementation and thin bindings | Vanilla/React/Vue consumer parity |
| Custom elements harm SSR/accessibility | Blocking M0 platform spike; native semantic boundaries | Hydration/form/focus/manual AT matrix |
| Expression AST becomes a programming language | Bounded typed operators/functions; no eval/loops/remote code | Depth/cost/unknown-function tests |
| AI formula is syntactically valid but wrong | Provenance, scope, assumptions, test examples, activation policy | AI/manual parity and ambiguous-domain failure |
| Numeric fields automatically summed | Additivity/grain/unit declaration | Balance, currency and distinct-count counterexamples |
| Relations multiply measures | Grain/cardinality-aware plans and pre-aggregation | Multi-one-to-many fan-out fixture |
| Time defaults change meaning | Calendar/timezone/half-open interval bound once | Three-month vs ninety-day and DST tests |
| UI selection is a hardcoded demo switch | Compositional tasks and capability-based bounded planner | Held-out intent variants without source edits |
| Planner combinatorial explosion | Limited candidate expansion and stable fallback | Adversarial catalog and latency evidence |
| Mobile hides required comparison | Operation coverage in addition to fields | Eight-field comparison at 360px/zoom |
| Adaptation steals focus/drafts | Stable role/entity IDs and transaction/state transfer | IME, dirty form, overlay and resize tests |
| A pipeline ignores interactive feedback | Incremental query/result/view dependencies | Filter/selection without model call |
| Results leak across tenants | Scoped handles/cache/auth recheck | Revocation and same-query-two-principals tests |
| Canvas destroys accessibility | Native DOM text/controls plus accessible dense-data navigation | Keyboard/AT equivalence on dense plot |
| Paint confidence from callback | Separate receipts and actual browser traces | Commit vs renderer vs frame evidence |
| Pixel-perfect becomes marketing fiction | Environment-pinned reviewed baselines | Cross-browser visual review |
| Component catalog is only names | Per-entry ready gate with actual code/tests/docs | Built exports and catalog completeness check |
| Huge enterprise stack blocks ordinary use | Local default; optional services behind ports | Offline/simple component integration |
| OSS intentionally crippled | Complete catalog and security/a11y OSS | Package/license/runtime check |
| Release gate is fake green JSON | Actual CI commands + source/artifact-bound evidence | Clean candidate and external consumer rerun |
| Agent swarm causes conflicts | Worktrees, path ownership, contract/lockfile owner | Concurrent-task audit and model spawn evidence |
| Rewrite erases rollback | New clean branch with old parent and immutable artifacts | Git history + deploy rollback rehearsal |
| npm packages updated “atomically” | Staged RC and coordinated promotion; versions immutable | Registry install + interrupted publish recovery |

## Decisions deliberately deferred to measured evidence

Exact dependency patch versions; final SSR integration details after M0; performance thresholds refined against recorded hardware; provider/model config IDs in the user's runtime; existing GitOps deployment location; registry namespace/version availability; commercial pricing and paid demand. None can be invented from architecture prose.

## Simplicity test

A new source, metric, UI family, renderer platform or protocol path must name the single contract it implements and the conformance suite it passes. If adding a domain requires editing core planner switch statements or duplicating UI behavior, reject the design. If a feature requires a new generic language before any concrete user flow, reconsider its scope.

## Master consolidation review closure

The previous separate revalidation identified twelve issues, not proof that the whole design needed replacing. Master consolidation folds them into the affected canonical chapters and reference probes. [Audit resolution](35-audit-resolution.md) maps findings to files/tests/tasks. Remaining product evidence is not silently marked closed.

Additional risks checked in this revision: evaluator versus renderer coupling, stale human/agent races, multioutput source consistency, inference versus observed result provenance, arbitrary caller-set trust, adapter work merely transferred to consumers, quality-gate circular release prerequisites, and evidence digest omitting design/test command changes.

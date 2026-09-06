# Recipe — model/provider exploration

Purpose: prove that the data-rich model dataset can exercise semantics and interactions, not turn the framework into a hardcoded AI model directory. Use synthetic fixtures in public reproducible tests unless factual sources are independently maintained.

The ten domain entities are Provider, Model, Pricing, Capability, Modality, ModelLimit, Benchmark, BenchmarkResult, Release, and Availability. Model-to-price is generally one-to-many by region, unit, tier, date and modality; a single `price` number on Model is insufficient. BenchmarkResult carries benchmark/version/protocol/split and measured conditions. Availability is region/date/deployment-specific. Links require actual explicit keys and cardinalities.

## Vertical slice

Explorer filters by declared capability and availability. Comparison binds compatible offers and benchmark cohorts. A trade-off scatterplot uses a common price basis and comparable result; the table preserves missing values and provenance. Entity detail explains pricing, effective date, limits and release. Selection is shared through typed model/offer references, not array indices.

## Agent outcome

The user asks to compare reasoning-capable models under a supported cost threshold. Agent inspects permitted metadata, resolves the currency/unit/availability constraints and applies a compatible comparison. Unknown capability is not false. Incompatible benchmarks are grouped or flagged, not averaged into a universal winner. Unsupported pricing assumptions are surfaced without changing the task silently.

## Contract stress tests

Two pricing records for one model, a missing result, an old release, overlapping effective prices, mixed modalities, unknown capability and region-limited availability. Change the container while a filter input is composing and confirm focus, drafts and selection survive. No global names such as `modelId` should appear in framework core conditionals.

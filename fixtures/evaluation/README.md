# T40 held-out data-query corpus

This directory contains the independently authored data-query partition for T40. The corpus is held out from the agent-evaluation implementation and contains 18 versioned cases: six HR cases, six commerce cases, and six service/support cases. Every case carries its own catalog, source rows, scope and budget, canonical data Task, expected named outputs, and an explanation of the independent oracle inputs.

The expected rows were calculated in a separate Python authoring pass. Record cases use independent filtering, identity ordering and relation-membership calculations. Aggregate cases use explicit grouping, ISO Monday buckets, exact `Decimal` currency sums, pooled ratio-of-sums, and the production function registry's null propagation policy. Decimal cells preserve source scale for a one-value sum and use normalized exact addition for multi-value sums. Expected output metadata records identity, grain, population count, precision, source revisions, evidence kind and meaning definitions; the scorer compares the result rows, fields, grain, coverage and scope separately.

The manifest is `t40-data-query-heldout.manifest.json`; the sealed cases are in `t40-data-query-heldout.json`. The case prompts include paraphrases and changed field names, while the fixtures exercise record browsing, nulls, currency, grouping, ranking, temporal buckets, declared semijoins, and named multioutput tasks across independent grains. Per-case fixture variants keep positive aggregates and null-only or null-propagating groups observable without changing the production catalog.

To run the deterministic explicit-task preflight from the repository root:

```text
node tests/agent-evaluation/run.mjs \
  --corpus fixtures/evaluation/t40-data-query-heldout.json \
  --output /tmp/aeliqo-t40-data-preflight
```

The preflight performs no provider or network request. It is an explicit-task data-correctness baseline and does not qualify the live T40 provider, MCP, UI-completion, narrative-grounding, or ablation requirements. Those remain blocked until an owner-authorized configuration and the corresponding independent evidence are available.

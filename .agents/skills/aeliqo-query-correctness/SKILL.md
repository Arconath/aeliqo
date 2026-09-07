---
name: aeliqo-query-correctness
description: Implement or review data semantics, derived meanings, query plans and result scope.
---

# aeliqo-query-correctness

Read docs/02 through docs/05 as needed and docs/27-reference-host.md. Establish identity, grain, join cardinality, units, null/time policy and complete population before optimizing. Use an independent exact oracle, not production code to generate expected results. Exercise fanout, ratio-of-sums, fixed population before trend, stale results and principal isolation. Do not infer business truth from a column name.

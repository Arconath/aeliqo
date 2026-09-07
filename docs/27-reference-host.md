# 27 — Reference host and executable proof strategy

## Purpose

The ADC reference host demonstrates the standard contract, not a vendor connector or production database. Provide one local in-memory implementation and one HTTP server using the same logical evaluator on synthetic fixtures. The host is separate from the user's real application backend and must never be silently connected to production HR data.

## Raw fixtures

`fixtures/hr/raw.json` contains employees, scheduled days, attendance observations and approved leave. `fixtures/hr/expected.json` contains exact rational expected outcomes for a clearly labeled example policy. `scripts/reference_oracle.py` computes those outcomes independently using Python rational arithmetic. This oracle is a **test reference**, not the Aeliqo production query engine.

The production TypeScript evaluator must match it without importing the Python oracle or hardcoding employee IDs. The HTTP reference server must process the same accepted plan and return matching descriptors, records and completeness. Add commerce and adverse fixtures to demonstrate domain independence.

## Required host behavior

Catalog pagination, field/metric/relation capability descriptions, strict query/schema validation, explicit identity/grain, supported operator negotiation, bounded query budget, cursor consistency, structured errors, principal scoping, abort handling, NDJSON batch framing, source revisions and a complete/partial distinction. A fake always-ready response is insufficient.

## Unknown or incomplete data

Provide fixtures with missing observations, duplicated observations, missing relations, invalid decimals, unavailable numerator/denominator, overlapping groups and late source revisions. Unknown attendance remains unknown. Aggregating a loaded page cannot create a global result. Declare deterministic duplicate resolution only where the source policy supports it; otherwise reject the invalid population.

## No prompt-specific routes

Do not implement `/top-absent-employees` solely to pass the demo. The same contract must accept grouped/ranked/temporal/inspection tasks assembled from declared capabilities. Applications may legitimately expose opaque domain metrics, but the reference host must still prove the generic query subset.

## Reproducible end-to-end test

Start a per-worktree HTTP host on an available isolated port; seed fixtures; run the browser consumer and actual tools against it; record task/result/region revisions; assert displayed data and interaction behavior; stop the host and assert cleanup. Do not kill an existing service to reuse a fixed port. Synthetic results are labeled synthetic in the public playground.

## Master consolidation reference versus product

Added test vectors exercise independent SQLite/Python calculations and TypeScript contract probes. SQLite is a test oracle only, not a new Aeliqo connector or the chosen production backend. Python/TypeScript reference calculations must not replace real ADC/compiler tests at release. Seeded cases and deliberate wrong implementations verify that the assertions can detect errors, rather than merely repeat the implementation's own output.

Exact floating-point bit parity is not promised across different physical backends; declared integer/decimal/rational semantics and tolerances govern the comparison. Query behavior includes ordering/ties/null semantics and population, not only final arithmetic.

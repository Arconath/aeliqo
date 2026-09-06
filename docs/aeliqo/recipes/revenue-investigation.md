# Recipe — revenue investigation

Purpose: prove the same components support a non-model business domain. Use synthetic branch/transaction data, not private production records.

Descriptor: transaction ID as identity; branch ID as entity relation; occurred-at as an instant; amount as exact decimal money; currency as a declared dimension/monetary unit; period grain and query scope explicit. A one-to-many transaction/line-item join must not multiply transaction total. A daily or monthly aggregate is a server/source capability, not an arbitrary chart heuristic.

Use Metric for authorized totals per currency, Trend for approved grain, Ranking for branch comparison and Detail for selected records. Filter changes are local or workspace-wide according to an explicit visible scope. A Comparison must not rank USD versus IDR numbers directly. An approved FX adapter can produce a derived comparison with source/time/rounding shown; no live FX is bundled in this kit.

Acceptance: ratio-of-sums, precise decimal sums, zero/missing, refunds/negative values, date/timezone, pagination, revoked permissions and stale query results. Reuse manifests/ports/operations from the model recipe. A revenue-only fork of the core fails the portability test.

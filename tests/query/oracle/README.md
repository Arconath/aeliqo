# T07 numerical oracle

This directory is a test-only reference boundary. `oracle.py` calculates the
expected values with Python `Fraction`, `Decimal`, deterministic seeded rows,
and an in-memory SQLite semijoin. It does not import Aeliqo code, call a query
planner, or use the production evaluator as an oracle.

The fixtures cover:

- join fanout versus an identity-preserving semijoin;
- pooled ratio-of-sums versus the invalid mean-of-rates mutant;
- empty populations, missing inputs, zero denominators and valid zero rates;
- exact decimal and large integer arithmetic beyond the IEEE-754 safe boundary;
- grouped ranking with stable tie order, fixed top-K population before weekly
  trend evaluation, and a partial-page ranking counterexample;
- violated many-to-one cardinality, half-open time boundaries and malformed
  decimal input.

Run `python3 tests/query/oracle/oracle.py --check` to verify the checked-in
expected output. The sibling Vitest bridge invokes the same script and also
asserts independent literals and deliberate wrong results. A future query
adapter can bind its outputs to these fixtures without moving the oracle into
production code.

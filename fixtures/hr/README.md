# Synthetic HR oracle fixture

Eight synthetic employees, twelve calendar weeks, declared work schedules, attendance observations and approved leave. There are no real employee records or claims about actual workplace behavior.

`raw.json` is raw source data, not a precomputed absences endpoint. `expected.json` is an independent exact-fraction result for this explicit demonstration policy. This policy is not a universal HR rule.

The producer of expected results used set-based schedule/leave/absence counting. `scripts/reference_oracle.py` independently classifies each scheduled day. Future TypeScript production queries must match both, then add larger randomized/property-based tests. Do not import the Python oracle into production code or dispatch user prompts to this fixture.

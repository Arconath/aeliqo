# Evaluation execution status

T40 is not accepted. No live model score is recorded by this directory.

`tests/agent-evaluation/host.ts` is a synthetic application host around the
production evaluator, Result store, cohort resolver, and capability dispatcher.
It exposes scoped catalog read and data evaluation through the same tool endpoint
used by the protocol/model adapters. Its independent host grants do not expose
presentation commit, meaning activation, or business execution. It records
observable tasks, result descriptors/rows, diagnostics, and execution intervals;
it does not record private reasoning. Oracle answers never enter tool context.

The initial development tests establish exact explicit-task/dispatcher parity,
wire-authority rejection, revocation, and stale-goal denial. These deterministic
tests are harness validation, not AI performance or T40 release acceptance.

Still required: an independent held-out three-domain corpus; owner-selected exact
weak/strong model configurations and explicit spend ceiling; bounded live trials
through the official model adapter; actual MCP client trials; first-attempt and
recovery scores; arithmetic/scope/grounding oracles; UI task completion and
ablation results. Report unavailable credentials, incomplete UI observation,
unreviewed prose, or missing cost data as blocked/unmeasured. Never substitute
scripted replies or successful schema validation for a model-quality score.

## Bounded data-only preflight

The Node entry is `node tests/agent-evaluation/run.mjs --corpus CORPUS.json
--output OUTPUT_DIRECTORY`. Without `--live`, it runs explicit tasks only and
never opens a provider connection. Exit 2 and `status: blocked` are deliberate:
the data-only preflight cannot mark T40 complete. Exit 1 means an explicit
baseline failed. The development fixture in `tests/agent-evaluation/development.ts`
is exposed training material for the harness, not a held-out evaluation case.

Live execution additionally requires `--config OWNER_CONFIG.json --live` and
`AELIQO_EVAL_OPENAI_API_KEY` in the process environment. The owner configuration
must explicitly authorize the exact corpus SHA-256, two distinct weak/strong
model IDs, repeated trial count, token/request/time limits, a maximum USD spend
reservation, and positive reviewed input/output prices with their source. The
configuration has no credential field. No live run has been authorized or run.
The existing official OpenAI adapter uses provider-default sampling/reasoning
settings; this runner does not silently emulate an unsupported effort setting.

Before each trial, the runner reserves a conservative bound using all permitted
model requests, input tokens, turns, output tokens, and the supplied rates. It
records reservation and usage-derived estimates separately from charged cost,
which remains unknown. Price changes or extra provider fees are outside this
estimate; live approval must use current reviewed rates. It captures reported
model snapshots and response IDs without storing raw provider reasoning or
headers. Source and corpus hashes accompany every report. A changed source
invalidates candidate qualification.

Data correctness compares named outputs, selected values/order, grain,
completeness, and scope against fixture answers excluded from model context.
Wilson intervals show sample size and uncertainty; unrun groups have null
intervals. UI completion and prose grounding remain null until those independent
checks are supplied. Provider failures stay in the model trial denominator.

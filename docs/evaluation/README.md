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

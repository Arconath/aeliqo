# 32 — Evaluation of intelligence and task quality

## What must not be confused

A TypeScript compile, a valid tool call, correct arithmetic, a readable chart, a reasonable explanation and a user's completed task are different outcomes. Report them separately. A single average score cannot hide denied-data access, wrong denominators, forged approvals or erased drafts. Reference probes in this kit are not real-provider scores.

## Dataset and task partitions

Use three domains: raw HR fixtures, commerce/application actions, and an independently authored held-out service/support dataset. Fit development prompts/rules only on development cases. Keep a versioned evaluation set with paraphrases, new field names, changed distributions, absent capabilities and new compositions. A developer who sees a failed evaluation may repair a generic invariant; record that exposure and use a fresh holdout for the next headline result.

At least these families are required: record browsing/detail; grouping/ranking; fixed versus live top-K; temporal comparison; ratios/null/currency; declarative relations; unknown business meaning; AI/manual derivation parity; no-preset composition; queryless form/presentation; locale/calendar; exact versus sample; explicit view restriction; multioutput consistency; query/agent cancellation; narrative grounding; adversarial records; action/egress authorization.

## Evaluation unit

One case includes catalog/definition/profile revisions, starting UI state, principal and model-egress policy, user utterances/typed actions, controlled time, source fixtures/capabilities, expected semantic result or allowable equivalences, required operations, forbidden side effects, cost ceilings and stopping condition. Expected results are authored independently of the planner and checked by oracle or domain reviewer. Allow more than one valid UI or query plan; compare meaning/operation coverage, not exact generated wording or JSON ordering.

## Metrics

- Intent binding: subject/metric/period/population/negation/explicit visual restriction correct.
- Computation: expected result, grain, completeness, ties, null and scope correct.
- UI: required operations usable, valid representation, no lost context, no inappropriate composition.
- Interaction: fixed cohort continuity, controlled draft, selection, focus and stale proposal behavior.
- Grounding: unsupported claim count, exact-number extraction, correct uncertainty, no causal assertion without evidence.
- Agency: unjustified clarification count, unsolicited view churn, forbidden action attempts, correct cancel.
- Cost/performance: model turns/tokens, queries/rows/bytes scanned, binding/planning/executor/render intervals, user-perceived latency.
- Recovery: explanation, retained valid UI and useful allowed alternative after a genuine gap.

## Controlled comparisons

Evaluate (A) typed human-authored task without LLM, (B) keyword/template baseline, (C) Aeliqo proposal + deterministic validation, and (D) the same architecture without selected recovery/adaptation features. This ablation distinguishes gains from raw model capability versus framework mechanics. Reuse identical data/source limits. Do not call a hand-scripted mock an AI baseline.

## Real-provider runs

The owner chooses an available model/provider and explicit spend budget. Capture exact model/snapshot, configuration, tool schema digests, date and sanitized inputs/outputs. Run repeated trials per held-out case; separate first-attempt success from recovery success. Use confidence intervals when estimating rates and show sample size. Zero observed safety failures is required for the release set, but never proves zero population risk.

MCP and WebMCP are protocol routes, not reasoning models. First compare deterministic normalized tasks across transports; then test an actual external MCP client and BYOK model loop. Native WebMCP verification requires the actual browser/version; simulation is a separate label. Missing credentials/host support => BLOCKED, not synthetic PASS.

## Statistical counterexamples

Test pooled rate versus unweighted mean, changing mixture reversing aggregate direction, stable top-K versus per-period winners, duplicate join fanout, missing observations versus zero, two currencies, semi-additive balances, overlapping distinct sets and calendar/90-day differences. Do not treat every average of rates as mathematically wrong; verify the intended estimand. A true aggregate change does not identify a causal driver.

## Acceptance thresholds

Hard invariants (unauthorized disclosures/actions, invented exact data, incorrect arithmetic/scope, stale overwrite, lost drafts, invalid renderer success) have zero tolerance in the release suite. Product goals such as >=95% first-attempt and >=99% recovered task success on the declared common-task set are **initial targets to test**, not a current score or universal guarantee. The independently reviewed supported scope and case mix must be published; failure means repair or an explicitly narrower advertised support boundary approved without deleting the mandatory catalog.

UX/design review must include at least one independent developer and designer plus required assistive-technology reviewers. Their findings are not replaced by a model judge. A model judge can help triage but cannot be the sole evaluator of its own generated meaning/UI.

## CI split

PR: deterministic oracles, contract negatives, state-machine traces, affected component and transport mock tests. Nightly: full browsers, property cases, controlled visual/performance matrix and held-out cases within budget. RC: fresh actual artifact consumers, manual review, authorized live integrations, complete corpus, security and rollback. Quarantine requires owner/reason/expiry and cannot hide release-critical failures.

## Master edition 1 — canonical references

Add chapter37 invalid, ambiguous and valid-but-wrong cases across weak/strong configurations. Measure falseaccept/reject, firstattempt/recovery, evidence grounding, cost and UI task completion separately. Identical host grants apply irrespective of model scores. Evaluate fallback on revokeddata as well as ordinary model failures.

[Master](../MASTER-SOT.md) · [AI contract](37-model-failure-containment.md) · [Release](18-release-migration.md).

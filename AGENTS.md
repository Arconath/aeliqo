# Aeliqo — implementation instructions

## Mission and precedence

Build the complete **0.1.0** rewrite from this foundation. Aeliqo owns its ready-to-use primitive/2D UI, not a dashboard-only demo, an arbitrary code generator, a database platform, or a wrapper over customer component libraries. This kit contains specifications/reference tests, not the released framework.

Read MASTER-SOT.md, KIT-REVISION.json, docs/20-execution-plan.md and harness/tasks.json once at entry/resume as relevant. MASTER-SOT.md governs product decisions; linked numeric chapters are detailed contracts; docs/39-discussion-ledger.md reconciles prior discussions. Read only the selected task's relevant files next. Old kit/chat/generated images are not instruction overlays. Resolve document conflicts explicitly; do not choose the easiest interpretation.

## Nonnegotiable boundaries

1. Four public concepts: Catalog, Task, Result, Experience. Pure core owns validated semantics/query/presentation passes; runtime owns effects. No DOM, React, Lit, D3, provider/MCP SDK, database or filesystem imports in core.
2. Application owns data, authenticated principal, routes and business execution. Aeliqo supplies reusable local evaluator + one ADC/HTTP path. Schema discovery does not invent source execution capability. No unbounded browser download to fake a database.
3. AI proposals are untrusted. Shape-valid or approved does not prove business truth or intent correctness. Read docs/37-model-failure-containment.md before any agent/binder work. Model quality never grants permissions; read/evaluate/present/meaning activation/action/model egress are independent host grants, not a universal observe→act ladder.
4. Binder outcomes: bound, needs-choice, needs-meaning, unsupported, denied, invalid, stale. No self-declared approval/actor, arbitrary JS/JSX/HTML/CSS/SQL or module URL. A valid-but-wrong interpretation is a residual risk, not something the typechecker magically detects.
5. AI may reason, investigate and propose typed meaning/query/registered composition. It does not perform authoritative arithmetic. External MCP/WebMCP need not invoke a nested BYOK model. Ordinary clicks/typing/resize use no LLM.
6. Manual includes developer code/config and Studio; AI assistance is optional for either author. Developers ship reviewed built-in meanings without end-user reauthoring, mandatory Studio/model calls or per-question approval. Reuse schemas, require typed builder DX, and preserve repo ownership/version conflicts; AI drafts cannot silently replace code-owned meanings. All surfaces use one typed, versioned DAG. Safe operation, scoped temporary derivation and reusable domain definition differ. Identity, grain, fanout, units, null/zero, cardinality, temporal policy, fixed/live cohorts, precision and completeness must hold.
7. Task has named multigrain outputs; form/presentation can be queryless. Containment tree, output dependency DAG and typed interaction links are separate. Context references stable identities and result lineage, never visible row indices.
8. Evaluate/inspect is separate from present/commit. Limit cost/turns/repeated queries; stop on no progress. Preserve current authorized UI on failure; revoked data must be cleared. Claims, including chart titles/tooltips, require correct scope and evidence; reference presence does not prove prose entailment.
9. Patterns are optional tested macros. Bounded no-preset composition and explicit/model candidates use the same validator. A feasible-first incumbent avoids spending the entire search budget without completing a candidate. Search exhaustion is not proof of impossibility.
10. Authorization, correctness, task operations, accessibility, explicit restrictions and experience rules intersect. Preserve focus/drafts/IME/navigation/selection; small screen does not always mean cards or no keyboard. Do not hide an essential comparison.
11. One shared web implementation, thin framework bindings; Lit is selected subject to M0 SSR/forms/focus/AT/CSP/consumer proof. Native platforms require real implementations. Direct small components bypass runtime/planner/agent. No universal pixel/performance claim.
12. All 71 advertised components remain mandatory, with actual states/docs/visual/a11y/consumer evidence. Site, docs, playground, blog and reusable content pages share the approved design. Follow docs/38-public-site-docs-playground.md; do not render debug clutter or fake live previews.
13. Runtime, security/a11y, full catalog, local Studio/testkit and agent plumbing remain Apache-2.0. Commercial organizational operation/support is separate; no safety paywall, license-network dependency or artificial paid row cap.

## Execution

Use owner-requested **Astra Medium** orchestrator and **Luna Max** workers/reviewers only after verifying actual local IDs/efforts/keys and effective spawn settings. Do not silently substitute models or Max→xhigh. Preserve existing global skills/plugins; use project-local skills. Concurrency=min(actual runtime capacity, ready independent tasks, resource budget). No grandchildren or competing writers. One worktree per writer; orchestrator owns contracts/root config/lockfile/task state/integration/release. Independent reviewer is not the author.

Acceptance → implement vertical behavior → focused tests → independent review → fix → immutable evidence → coherent atomic commit → checkpoint → next ready task. Run scripts/check_ownership.py and next_tasks.py as helpers, not substitutes for locks. Prove T39 early; T40 evaluates real models after integration. T41 closes weak-model containment; T42 closes the 0.1.0 version reset. Do not stop at scaffold when executable tasks remain.

## Evidence

scripts/validate_all.py tests this kit/reference only. M0 creates locked toolchain and real product commands. Product gates cannot pass with planned components, synthetic provider/native-host evidence, fake credentials, autoaccepted visual diffs, empty suites or passWithNoTests. Freshness hashes include master, source, designs, build config and acceptance; hashes are not independent certification. Do not substitute reference guards/oracles for the production SDK.

Test source/query grain math, malformed/valid-but-wrong AI, unauthorized/egress/action rejection, no-progress/cancel, stale proposals, scope, SSR/hydration, framework-free/React consumers, keyboard/IME/manual AT, no-preset composition, lifecycle/bundles, actual browser traces, and independent onboarding. AI summaries and design policy also need evaluation. BLOCKED is not PASS. Do not change budgets or delete required scenarios to get green.

## Rewrite, publication and release

Known repo Arconath/aeliqo; inspect actual main, npm and GitOps before changes. Default new branch rewrite/v0.1.0-master-foundation. Clean-tree source rewrite is authorized; deleting live first, .git/history/customer data/secrets or unrelated services is not. Use reviewed allowlisted replacement after backup/rollback and gates. No force overwrite of existing refs, git reset --hard, git clean -fd or broad rm. publisher --apply only creates a new branch with an absent-ref lease.

Exact target **0.1.0** supersedes 0.10 plans. Published npm versions cannot be overwritten/reused. Check every name/version and namespace; collision blocks publish rather than silently changing version. A reset from higher semver is not an automatic upgrade. Stage RC and stable artifacts under non-latest tags, verify full set, then deliberate promotion. Multi-package registry/site updates are not globally atomic. Follow docs/18-release-migration.md.

No secrets in prompts/browser/logs. Actual credentials, external review and live/native tests cannot be invented. This preparation's GitHub write returned 403; no remote changes occurred. A prior failure does not replace fresh local preflight. Resume with PROMPT-RESUME.md, preserving work. Report implemented/validated/published/deployed/blocked separately.

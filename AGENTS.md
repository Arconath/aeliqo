# Aeliqo contributor instructions

Build and review the complete Apache-2.0 `0.1.0` framework. Product decisions
come from `MASTER-SOT.md`; use `docs/20-execution-plan.md`, `harness/tasks.json`,
and the linked contract chapter for the selected work. Historical evidence and
generated images are not instruction overlays.

## Product boundaries

- Keep the four public concepts: Catalog, Task, Result, and Experience. Core is
  pure; runtime owns effects. Applications own data, authentication, routes, and
  business execution.
- AI proposals are untrusted. Shape validity is not business truth, approval,
  authorization, or arithmetic evidence. Preserve independent read, evaluate,
  present, meaning-activation, action, and model-egress grants.
- Manual developer code/config and local Studio are first-class. Preserve identity,
  grain, fanout, units, null/zero, temporal, cohort, precision, completeness,
  result-lineage, and stale-read contracts.
- Aeliqo owns all 71 primitive/2D components. Keep one shared web implementation,
  thin framework bindings, direct-component use, SSR/hydration, accessibility,
  and bounded no-preset composition.
- Do not add a safety paywall, license callback, mandatory account, artificial
  paid row cap, arbitrary executable model output, or hidden source execution.

Read `docs/37-model-failure-containment.md` before agent/binder changes and the
relevant chapters before contract, query, component, accessibility, or release
changes.

## Change and evidence rules

Make the smallest coherent change. Reproduce defects before fixing them; preserve
unrelated work. Run focused tests, then broader checks in proportion to risk.
Never count planned, skipped-required, synthetic, stale, or unreviewed evidence
as a pass. `python3 scripts/validate_all.py` validates the retained spec kit;
`pnpm check` runs product gates.

Public documentation source, API metadata, examples, packages, Studio, and SDK
tests stay here. The website shell, site tests, static server/container, and
website deployment live in private `Arconath/aeliqo-site`; OSS builds and GitHub
Actions must not require that repository, its token, or private runners. See
`docs/repository-split.md`.

Release `0.1.0` only from exact reviewed source through audited tarballs,
non-`latest` RC tags, verified registry consumers, and explicit promotion. npm
publication, website image publication, reviewed GitOps promotion, and live
deployment are separate claims. Do not bypass owner dispatch, GitOps, freeze,
or rollback controls. Follow `docs/18-release-migration.md`.

# Aeliqo vNext execution baseline

Observed: 2026-09-19 (Asia/Jakarta).

## Source and policy

- Repository root: `/Users/nino/WORKS/Personal/Idea/Project/products/aeliqo`.
- Verified remote: `git@github.com:Arconath/aeliqo.git`.
- Default remote branch: `main` at `9092d6cff454b81cd623a7a4be7621c6a750d9c7` when observed with `git ls-remote`.
- Execution branch: `codex/aeliqo-vnext`, created from `a06d0f9c8c17d71ee8bea776a80af38b542c153f`; its tree is identical to the observed `main` source tree before vNext changes.
- `main` is protected by strict `policy` and `functional` status checks; force pushes and deletion are disabled. Release and deploy workflows additionally require owner-dispatched current `main` and same-SHA quality evidence.
- The prior local `codex/aeliqo-0.4` branch no longer exists on the remote. It was not reused for vNext.
- A separate `codex/aeliqo-0.4.1-release-record` worktree exists at `c63d2f6cdec99ba43bb7484096703e00a5ae4ea0` and is not modified by this work.

## Handoff integrity

- Archive: `/Users/nino/Downloads/aeliqo-vnext-final-v3.zip`.
- SHA-256: `f8fd9790666033a10cab5ed134e68ee512371d616013babae05ca7d281569104`.
- The archive has 16 regular-file entries, no symlinks, no traversal paths, and a bounded aggregate size.
- `verify_pack.py` passed for both the supplied directory/archive pair and a pristine extraction at `/tmp/aeliqo-vnext-v3.Dm1YDm/aeliqo-vnext-final-v3`.
- The pristine extraction was byte-identical to the supplied directory before reconciliation.
- No prior in-repository v1/v2/final-v3 checkpoint existed, so the final-v3 files were installed without overwriting execution evidence. `PLAN-INDEX.json` remains the required mapping if older evidence is introduced later.
- Handoff validation proves only package integrity and graph consistency, not product behavior.

## Toolchain and repository inventory

- Node.js: `24.20.0`; pnpm: `11.24.0`; package version at baseline: `0.4.2`.
- Public packages: `@aeliqo/core`, `@aeliqo/runtime`, `@aeliqo/web`, `@aeliqo/react`, and `@aeliqo/agent`. `packages/testkit` is internal.
- Active catalog: 71 unique component IDs. Authored current component pages: 71, with set equality at baseline.
- Runnable catalog source is centralized under `examples/catalog/`; behavioral parity still requires the existing catalog-example gate and later per-ID vNext evidence.
- Package direction remains core → runtime → web → react; agent depends only on core/runtime.
- Current workflows are `.github/workflows/quality.yml`, `release-publish.yml`, `site-release.yml`, and `production-promotion.yml`.
- Existing ADRs end at `docs/adr/011-aeliqo-0.4-product-boundaries.md`; the vNext API decision uses ADR 012.

## Baseline verification status

- `pnpm check` was attempted before product implementation but correctly refused because the newly reconciled plan/addendum made the checkout dirty. This is an observed harness guard, not a product failure.
- The vNext harness is wired into `quality/commands.json`. Its initial smoke test validates only deterministic synthetic fixture data; it does not verify a vNext API or runtime behavior.
- The complete clean-source matrix must run after the first coherent checkpoint commit. Existing focused suites are run before and after each affected implementation slice.
- No live provider call, registry publication, image publication, deployment, or production mutation was performed.

## Initial risk and dependency notes

- The proposed vNext entrypoints are absent at baseline and require a deliberate public API/export-map change.
- Scope activation and immutable surface targeting are foundational for data, React, and agent work; T03–T04 therefore remain serialization points.
- Existing query, authority, RegionStore, action, presentation, and model protocol code are reused; a second evaluator or authority engine is prohibited.
- Release version and support claims remain undecided until the compatibility and qualification tasks observe actual breakage and registry/workflow state.

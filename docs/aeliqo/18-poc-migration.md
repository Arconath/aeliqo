# 18 — Continue the PoC safely

## G0 is reconciliation, not a rewrite

Inventory actual files before proposing removals. Read active scoped instructions, package manager/lockfile, scripts/CI, app entry points, core contracts, stores, component registry, agent adapters, examples/tests and current docs. Do not open real environment secrets; inspect `.env.example` for configuration names. Do not run unknown scripts with destructive/deployment side effects without review.

Record `git status --short` and branch/commit where available. Do not run reset/clean/checkout/stash to obtain a clean baseline. Work with the current dirty tree and distinguish user edits from new work. Running a build may generate artifacts; inspect script behavior first.

## Required current-state report

| Area | Existing paths/API | Observed behavior/check | Decision | Why | Replacement/test dependency |
|---|---|---|---|---|---|
| Core/state | Actual path only | Evidence or not-run | keep/refactor/replace/defer | Invariant/cost | Exact dependent work |
| Components/styles | Actual path only | Browser outcome if available | ... | ... | ... |
| MCP/browser link | Actual path only | Connection and target evidence | ... | ... | ... |
| Docs/skills | Actual path only | Scope/duplication check | ... | ... | ... |

Keep means useful compatible code remains. Refactor preserves tested observable behavior while improving boundary/correctness. Replace needs explicit defect/incompatibility evidence, a migration strategy and a tested replacement. Defer means don't create a parallel implementation merely because the proposed architecture contains a box.

## Non-destructive kit installation

Installer default is dry-run. `--apply` copies absent files; identical content is skipped; different existing files are staged under `.aeliqo-incoming/<relative-path>`. It never overwrites source/docs/instructions, installs dependencies or modifies global files. Staged AGENTS.md/skills do not become effective until locally reconciled.

If a conflicting skill already exists, compare its trigger/scope/workflow. Merge useful project-specific requirements into a single local canonical skill, preserving global skills untouched. Codex can show duplicate same-name skills rather than merge them, so unique local names and deliberate deduplication matter. [R01]

A new nested `docs/aeliqo/` does not make older documentation wrong automatically. Add one root index pointer only after review, identify obsolete claims, and archive/remove individual stale files after references are migrated. Never `rm -rf docs` or overwrite all package files from a generated blueprint.

## Strangler-style implementation sequence

Capture PoC behavior with tests → add small adapters to existing contracts → move one vertical slice through normalized semantics/dispatcher → verify user-facing behavior → migrate adjacent slices → retire dead path only when no call sites remain and replacement tests pass. Temporary adapters have owners and removal conditions; do not maintain two permanent sources of truth.

Do not rename every public API solely for taste. Keep existing working types if they satisfy the invariant; add compatibility wrappers when migration cost is real. Generic extension APIs should be proven with two different use cases before broad stabilization.

## Commands

Discover actual scripts from package.json/workspace/CI; do not copy fictional `pnpm test:all` commands into AGENTS.md. Use the detected package manager's lockfile-preserving install mode only when dependency installation is needed and allowed. Record the runtime version and actual tested matrix instead of imposing a remembered latest Node/React version.

## Exit G0

Current-state report completed with real paths; PoC smoke/baseline run or clear blocker; proposed keep/refactor/replace decisions; minimal next milestone with file ownership; no lost user changes; local instruction/skill duplication resolved; existing license recorded but not silently changed. Then proceed to implementation, not another endless planning cycle.

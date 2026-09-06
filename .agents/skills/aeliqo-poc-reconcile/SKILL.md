---
name: aeliqo-poc-reconcile
description: "Use for first-time integration of this kit, PoC audit, migration, cleanup, or reconciling existing source/docs/skills. Not for starting a replacement project."
---

# Continue the existing Aeliqo PoC

## Scope

This skill is repository-local. Read applicable AGENTS instructions first; use this workflow only for the matching task. Do not install global skills/plugins or load every other Aeliqo skill.

## Read only what this task needs

- [00-context-and-status.md](../../../docs/aeliqo/00-context-and-status.md)
- [18-poc-migration.md](../../../docs/aeliqo/18-poc-migration.md)
- [19-execution-plan.md](../../../docs/aeliqo/19-execution-plan.md)

## Workflow

Read applicable existing AGENTS instructions, repository status, manifests, lockfiles, scripts, relevant tests and actual PoC entry points before proposing changes. Inspect only configuration examples; never print secrets. Record existing architecture, supported flows, actual commands, known failures and dependencies in the current-state template.

Map every proposed area to keep/refactor/replace/defer with code evidence. Retain working components and the existing package manager. Compare .aeliqo-incoming proposals deliberately; the incoming folder is not an automatically active instruction hierarchy. Reconcile same-purpose local skills into one owner instead of duplicating triggers. Do not touch global plugins/skills.

Add characterization tests for current successful flows, then implement the smallest end-to-end slice that closes an important gap. A logical package diagram is not an instruction to move every file. Remove an old implementation only after its callers and tests migrate; never use reset/clean/stash or erase user changes. Update the active execution plan with actual evidence and blockers.

## Completion evidence

Actual file/command map; baseline results with unrun items explicit; justified keep/refactor map; one verified slice or a precise access blocker; no blanket deletion.

Report checks actually executed and their results. A schema, plan, screenshot, or mocked adapter proves only its own scope. Preserve user changes and record concrete blockers without inventing completion.

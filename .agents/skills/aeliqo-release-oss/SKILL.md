---
name: aeliqo-release-oss
description: "Use for package boundaries, compatibility, license decisions, release checklist, commercial split, competitor comparison or pilot planning. Does not authorize publishing."
---

# Prepare evidence-based OSS releases

## Scope

This skill is repository-local. Read applicable AGENTS instructions first; use this workflow only for the matching task. Do not install global skills/plugins or load every other Aeliqo skill.

## Read only what this task needs

- [20-oss-business-strategy.md](../../../docs/aeliqo/20-oss-business-strategy.md)
- [21-competitive-validation.md](../../../docs/aeliqo/21-competitive-validation.md)
- [22-packaging-release-security.md](../../../docs/aeliqo/22-packaging-release-security.md)
- [25-acceptance-matrix.md](../../../docs/aeliqo/25-acceptance-matrix.md)

## Workflow

Inspect the actual repository license, dependencies, distribution artifacts and public APIs. Do not replace a license or publish without explicit owner approval. Keep useful semantics, basic components/workspace, accessibility, performance and self-host adapters OSS. Commercial additions consume public extension contracts; they must not make core secretly dependent on a private package.

Run package dry-run and consumer import checks; verify no secrets, local-only material or unintended private code enters published artifacts. Record supported browser/framework/client versions from real tests, migration notes and known limitations. Basic tenant isolation/authorization are not premium-only.

For competitive claims, verify current primary sources and compare equivalent user tasks. Distinguish existing competitor capability, our design target and our measured result. Stars and a feature checklist are not willingness to pay. Treat prices/pilot counts as hypotheses until external evidence exists. Require an identifiable buyer, repeated problem and commercial support-cost model before building W4 candidates.

Complete the release evidence table with commands/artifacts and explicit unrun areas. No perfection claim, automatic deploy, license change or paid service signup.

## Completion evidence

Release evidence and compatibility matrix; license/dependency review findings; artifact inspection; precise OSS/commercial boundary; approvals and unmet gates explicit.

Report checks actually executed and their results. A schema, plan, screenshot, or mocked adapter proves only its own scope. Preserve user changes and record concrete blockers without inventing completion.

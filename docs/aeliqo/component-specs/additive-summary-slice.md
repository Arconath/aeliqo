# Additive summary slice — Delta, RecordList, SelectionSummary, Overview

Status: implemented local POC. Owner: React renderer / core catalog. Source: corresponding modules in `packages/react/src`; tests: `additions.test.tsx`. These additions do not alter the eleven frozen historical capability entries.

## Tasks and admission

Delta answers change against a supplied baseline, a task Metric does not answer. RecordList scans entity summaries without ranking or table-grid semantics. SelectionSummary makes selected identity and incomplete scope explicit, independent of entity Detail. Overview combines declared aggregate context with selectable summaries using existing Level-1 Metric and RecordList. These are bounded current-workflow additions; advanced comparison, selected-all paging and automatic temporal baselines remain unsupported. Basic functionality stays in the local OSS-candidate boundary; publication/license decisions are unchanged.

## Contracts and ownership

Delta direct props: value/baseline (number|null), label/baselineLabel, optional metric formatter and absolute|relative mode. Semantic Delta requires metric plus strict node.config baseline/baselineLabel/mode, validated before commit; unknown executable config is rejected. Both values share one declared unit. Relative change is `(value-baseline)/abs(baseline)`; zero denominator is unavailable. Labels never imply favorable/adverse meaning.

RecordList accepts dataset/snapshot, up to eight fields, positive limit (drawing capped at 100 with disclosure), selectedId/onSelect/title. Semantic mode uses node.columns/limit and normal entity selection. SelectionSummary takes up to 100 unique explicit selectedIds and optional host onClear; semantic mode receives one resolved selection and intentionally offers no cross-source clear mutation. Unknown selected identities remain visible as unavailable in loaded scope.

Overview accepts one to six unique declared metrics and controlled selection. Semantic mode uses node.columns or node.metric. Metric and RecordList supply the actual Level-1 rendering; Overview has no parallel store, aggregate semantics, or network effects.

## States, adaptation and accessibility

Snapshot components expose loading/error/empty/partial/stale. Permission errors are host-supplied error text; no separate authorization engine is claimed. Delta has no asynchronous direct snapshot and uses explicit unavailable current/baseline states. Native buttons expose selected state and normal keyboard behavior. Selection clear is controlled. Lists and definition lists retain DOM reading order, long labels wrap, logical CSS supports RTL, and Overview grid collapses to narrow columns. No new motion, portals or observers are introduced; normal shared reduced-motion/forced-color policies apply.

## Evidence scope

Focused tests cover signed/zero/missing Delta, runtime rejected config, RecordList bounded scope and selection, unavailable selected identities, ratio-of-sums Overview, linked workspace selection and standalone SSR. Compiled documentation examples use the actual modules. Browser, package and visual evidence are recorded by the current executed checks; this document does not claim independent screen-reader research or external onboarding. Maintenance cost is four small modules with no new dependencies; no copied application data store, pagination controller or chart geometry dependency.

Executed for this slice: `pnpm test` passed 155 tests; typecheck, lint and all five dependency boundaries passed. `pnpm check:packages` passed installed tarball SSR for all eleven direct components; standalone Metric remains 7,008 bytes excluding React, unchanged from the prior baseline. Production entry plus shared renderer totals 431.90 kB raw / 129.62 kB gzip versus prior 424.76 / 128.12 kB; the difference includes concurrent integrated source changes and is not an isolated per-component cost. `pnpm proof:stress` passed ten intents with the historical catalog hash unchanged. `tests/additions.spec.ts` passed keyboard selection/clear, 360px RTL dark Overview, no page overflow, and zero axe violations in the four example regions. `test-results/additions-overview-narrow-rtl.png` was visually reviewed: measures, records, selected state and focus remain readable. Initial test styling applied a dark theme to the host docs header; the fixture was corrected to theme only the component preview, preserving the host-owned styles.

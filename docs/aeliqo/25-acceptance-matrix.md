# 25 — Traceability to the user's eleven requirements

| User requirement | Canonical specification | Proof required |
|---|---|---|
| 1 Continue existing PoC | 00, 18, 19 | Real local inventory, characterization, no destructive replacement |
| 2 Quality/performance | 14–16, 22 | Executed checks, production traces, source/diff review |
| 3 Broad component needs / 2D | 07, 08, 23 | Task-grounded catalog; D3/SVG/Canvas boundaries; no Three.js scope creep |
| 4 Semantics/contracts/architecture/DX | 03–06, 11 | Schema+semantic tests; extension without core fork; progressive API |
| 5 Docs website UI/UX | 17, docs-site/ | Runnable examples, navigation/search, responsive and external-user review |
| 6 OSS to business | 20, 21, 22 | Explicit package/license boundaries, independent paid-pilot evidence |
| 7 Many useful high-quality components | 07, 23 | Promotion rubric and per-component evidence rather than inflated count |
| 8 CSS/lightweight/dynamic/adaptive | 02, 09, 13, 14 | Scoped CSS, import isolation, resize/input/cleanup measurements |
| 9 Smooth professional UX | 09, 10, 13, 15 | Focus/draft continuity, reduced motion, edge states, visual review |
| 10 All smartness levels and axes | 02, 05, 08–12 | Cross-axis scenarios from primitive through workspace |
| 11 Scalable grammar/API/abstraction | 04, 06, contracts/, decisions/ | Version/migration/extension conformance; multiple unrelated domains |

## Critical regressions that block a gate

Wrong currency/ratio/query scope; stale agent overwriting new user state; chat-only substitution for a requested UI result in a supported configured harness; mutating UI for explicit chat-only request; cross-tab/tenant misrouting; lost input/focus; agent/provider code in standalone imports; false completed receipt; inaccessible primary tasks; core requiring premium/cloud; public claims without evidence.

## Evidence levels

Design proposed → schema validated → unit/semantic verified → browser verified → real-harness observed → external-user validated → commercially validated. Do not skip labels. A passing JSON fixture in this kit reaches only the structural validation level; the rest must be demonstrated in the real project.

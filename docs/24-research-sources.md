# 24 — Primary research and evidence boundary

Research date: **7 September 2026**. URLs are provided for verification. This kit paraphrases small relevant facts and makes its own design choices; it does not republish source documents. Volatile APIs/dependencies must be rechecked at implementation/release.

| ID | Primary source | Decision supported / limit |
|---|---|---|
| S01 | https://www.w3.org/TR/WCAG22/ | Accessibility target and conformance requirements; a framework cannot claim conformance from a linter alone |
| S02 | https://www.w3.org/WAI/WCAG22/Understanding/reflow.html | Reflow and essential two-dimensional layout exceptions; no universal mobile-to-card rule |
| S03 | https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html | Preserve meaningful focus/navigation order |
| S04 | https://www.w3.org/WAI/ARIA/apg/patterns/ | Established control interaction patterns; implementation testing remains necessary |
| S05 | https://standardschema.dev/ | Validation interoperability; validation and JSON-schema conversion are distinct interfaces |
| S06 | https://spec.openapis.org/oas/latest.html | API operation/schema description; does not imply arbitrary execution capability or domain meaning |
| S07 | https://vega.github.io/vega-lite/docs/ | Prior art for declarative visualization; not a required Aeliqo runtime dependency |
| S08 | https://lit.dev/docs/frameworks/react/ | Thin React integration around web components; test current React behavior separately |
| S09 | https://react.dev/blog/2024/12/05/react-19 | React 19 custom-element behavior; nonprimitive SSR props require care |
| S10 | https://lit.dev/docs/ssr/overview/ | SSR integration and documented limitations; blocking platform spike required |
| S11 | https://nodejs.org/en/about/previous-releases | Node 24 LTS baseline; exact patch version must be checked and pinned |
| S12 | https://playwright.dev/docs/test-snapshots | Screenshot variability and environment-controlled visual tests |
| S13 | https://www.designtokens.org/tr/2025.10/format/ | Design-token interchange; community specification, not W3C Recommendation |
| S14 | https://web.dev/articles/vitals | Field UX metrics and good thresholds; library microbenchmarks are not page performance |
| S15 | https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization | Audience-bound auth and no token passthrough; verify supported current SDK/spec at implementation |
| S16 | https://developer.chrome.com/docs/ai/webmcp/imperative-api | Current experimental browser API and cancellation; updated 1 September 2026 in retrieved source |
| S17 | https://opensource.org/license/apache-2.0 | Apache-2.0 license identity; commercial distribution/contracts need appropriate review |
| S18 | https://tambo.co/ | Existing agent-to-React-component product; avoid false novelty/no-competitor claims |
| S19 | https://docs.npmjs.com/policies/unpublish/ | Name/version immutability and deprecation alternative |
| S20 | https://docs.npmjs.com/trusted-publishers/ | Trusted publishing setup; actual account/runner support must be checked |
| S21 | https://developers.openai.com/codex/subagents | Subagent orchestration/model controls, progressive delegation |
| S22 | https://developers.openai.com/codex/config-reference | Actual supported config keys; retrieved reference and subagent effort descriptions differ |
| S23 | https://help.openai.com/en/articles/20001354 | Astra/Luna product availability context; not proof of this user's exact local model IDs/settings |
| S24 | https://openai.com/index/harness-engineering/ | Repository-local instructions/evidence and mechanically enforced boundaries |
| S25 | https://developers.openai.com/codex/guides/agents-md | AGENTS discovery and project instruction behavior |
| S26 | https://substrait.io/spec/specification/ | Logical compute plan prior art; optional interoperability, not initial dependency |
| S27 | https://lit.dev/docs/components/shadow-dom/ | Component DOM ownership/style boundaries; does not certify accessibility |
| S28 | https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver | Web adapter container measurement; core receives abstract environment |

## Connected repository observations

Read through the GitHub connector: repository metadata, `main` branch and `docs/aeliqo/exec-plan.md` at `75540de0de5f6dfc7fc383afdd3f8325e590cfd9`. The repository reports the earlier release; this is not a new execution of those old tests. A Git trees write returned HTTP 403, `Resource not accessible by integration`.

## Explicitly unresolved

Direct registry/container networking failed DNS resolution during preparation. Do not take this as evidence that npm or the site is down. The web crawler returned old rental-site material for aeliqo.com; it is stale/inconclusive and is not used to judge today's deployment. Exact dependency versions, namespace status and the unused 0.1.0 version remain release-time checks.

The official subagent documentation mentions Luna and Max/xhigh choices, while the fetched general configuration reference retains a narrower effort list. The runtime config generator therefore requires verified local capabilities rather than hardcoding an unverified Astra ID or silently mapping Max to another effort.

## Evidence classification

Established mechanisms: source documents above. Proposed Aeliqo design: this repository's contracts/ADRs. Implemented in this kit: only harness scripts, reference types and fixture oracles. Not implemented here: production query engine/runtime/components/Studio/providers/deployment. Not proven: product-market fit, global enterprise scale, accessibility conformance and performance budgets. Those have explicit delivery gates rather than unsupported assurances.


## Master consolidation update

The current consolidation's primary-source review is [chapter 36](36-research-update.md). The dated S-prefixed baseline is retained for traceability; R-prefixed decisions take precedence for volatile API observations. No prior validation log becomes evidence for the rewritten product.

## Current-source register

This inherited register records earlier design research. The current preparation's primary-source checks and decision limits are consolidated in [40-current-research.md](40-current-research.md). A retrieved third-party documentation claim is not proof of the installed local runtime or Aeliqo implementation. MASTER-SOT.md and current release chapter supersede historical version assumptions.

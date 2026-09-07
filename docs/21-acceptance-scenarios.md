# 21 — End-to-end acceptance scenarios

Use synthetic fixtures and held-out language variants, not hardcoded prompt handlers. Each scenario records data/definition/profile versions, normalized task, expected result, allowed representations, required interactions, forbidden outcomes and proof environment. The machine-readable scenario list lives in `harness/scenarios.json`.

## HR exploration from raw data

Raw employees, work schedules, attendance observations and approved leave are supplied through the same ADC used for other domains. Start with “show employees as a table,” then scope to a department, rank a confirmed absence definition, trend the same top identities, compare calendar periods and inspect contributing employee-day records. Define the missing metric via both AI and manual editor; compare the canonical expression.

Expected: one declared business definition reused across tasks; stable population through top-K/trend; correct denominator/grain; no missing check-in automatically labeled absence; manual interaction continues without LLM. The fixture oracle is independent of the production query compiler.

## Commerce without a dashboard

A user browses a filtered product collection, compares selected products, opens detail and prepares a permitted form/action. Test cards/list/table without assuming every collection is an analytics dashboard. Do not compute “loyalty” or “best product” from an invented metric; use declared criteria or an explicitly labeled hypothesis.

## Source capability gap

A collection API supports paging/filtering but not aggregation. Request an exact global ranking larger than the local budget. Expected: negotiate/reject with a precise capability gap or application-backed implementation, not fetch all pages without consent or rank a sample as global truth.

## Small screen and comparison

At 360px a user explicitly requests a table comparison across two records and eight fields. Expected: preserve the comparison task with an approved readable/scrollable arrangement, or explain a profile conflict. It is not sufficient that every field exists in a separate record detail page. At 200% text and 400% zoom, avoid clipping and shrinking text to defeat accessibility.

## Adaptive browse/detail

An inspection region may shift from table+detail to list+drill-in when allowed. Selected identity, filter/time scope, focus return, draft values and navigation context survive. Resize oscillation does not repeatedly remount views. Screen/input metadata does not incorrectly assume no keyboard.

## Query and renderer concurrency

Issue A, then B; deliver B first and A late. B remains committed. Cancel during streaming and dispose the region; no late mutation or leaked handle occurs. A missing renderer or invalid data cannot generate a success receipt. A compound view can retain prior valid content while a new result is staged.

## Permission boundary

Two principals request identical semantic tasks. Their field/row visibility and caches remain isolated. Revoke a permission during a pending query; results cannot appear after revocation. Definition dependencies do not leak forbidden attributes through a derived metric or debug error.

## Controlled forms

Type using IME, resize, receive background data, then submit/cancel. Drafts persist and controlled props win. Native form/reset/autofill behavior is tested where supported. A layout planner cannot save a draft. Action confirmations and entity revisions are enforced regardless of direct/MCP/BYOK/WebMCP path.

## Dense data and accessible plots

Plot many points with explicit geometry budget. Exact summary retains correct values and missing gaps; displayed samples are labeled. Keyboard users can inspect selected entities without 100,000 hidden focusable nodes. Server pagination/virtualization do not misrepresent “all selected” or lose focus when recycling rows.

## Package interoperability

Install built tarballs outside the monorepo. Mount native elements in vanilla HTML, use React bindings with controlled state/SSR, and embed the shared elements in Vue without rewriting their templates. Core imports in Node without browser globals. Small-component imports exclude planner/agent/charts/Studio unless needed.

## AI and transport truth

Simulated tool parity is verified first. Then run an actual MCP client, a real authorized provider through BYOK and a compatible native WebMCP host when available. Preserve the distinction between adapter pass and native support. A generated tool response or instruction file does not count as execution.

## Production cutover

Candidate tarballs and immutable site image pass external consumers and preview smoke. Rehearse rollback, then promote through the existing deployment path. Validate artifact identities and routes after cutover. Existing npm consumers can still install v0.2.0; migration warnings do not remove old artifacts.

## Master consolidation additions

The extended JSON scenario inventory includes no-preset composition; queryless presentation/form use; named outputs with independent grain; fixed versus live cohort refresh; evaluate without UI mutation; independent present receipts; stale proposal rejection; unknown SSR size; typed built-in events; exact/estimated/suppressed counts; versioned functions; model-egress policy; aggregate-only authorization; resource budget exhaustion; generated narrative counterexamples; and quality-input evidence invalidation.

None is marked done merely because a reference test exists. Run every matching vector against the production compiler/runtime and public artifacts. See [evaluation plan](32-evaluation-plan.md).

## Developer meaning without AI (S65–S67)

S65: A developer imports existing source schema/metric references, defines a new metric in code, and registers it from a reviewed app bundle without a provider key, model call or Studio. End users reuse it for table/ranking/trend without reauthoring the rule.

S66: Invalid refs, units, grain or unknown functions fail registration. Identical ID/revision/content may register idempotently; different content with the same identity fails. Studio proposes a diff for repo-owned definitions, and AI/session definitions cannot silently replace them. Runtime activation still uses host authority.

S67: External tarball consumer compiles ergonomic code examples with useful negative type cases and no duplicate schema. Code and Studio equivalent definitions execute via the same validation/evaluator with matching results; AI-assisted equivalent drafts share that contract. Reuse one meaning across different views. Record actual model calls (zero on the manual path) and actual bundle imports.

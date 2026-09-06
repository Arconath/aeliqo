# POC v2 executed proof

## Rich semantic Showcase — frozen result

**Verdict: STRONGLY PROVEN FOR THE DEFINED POC SCOPE**

At the time of this frozen proof, one connected AI Landscape graph drove nine semantic primitives and two compounds; eight task-oriented Showcase scenarios substantially reshaped the workspace through versioned semantic operations; compatible nodes retained identity; and one selection fanned out through typed bindings. No scenario emitted JSX, CSS, JavaScript, HTML or arbitrary executable UI. Later implementation and evidence are tracked in `docs/aeliqo/exec-plan.md` and the component completion matrix.

The data graph covers Provider, Model, Pricing, Capability, Modality, ModelLimit, Benchmark, BenchmarkResult, Release and Availability. Scatter, Distribution, Relationship and Matrix join the existing Metric, Ranking, Trend, Table and Detail primitives. Comparison and Explorer continue to compose primitives. Scenario definitions declare semantic needs; a catalog matcher chooses trusted components and emits ordinary `mount`, `remove`, `configure`, `move`, `connect`, `disconnect` and `select` operations.

### Visible acceptance evidence

- The Showcase starts with Metric + Explorer and offers eight distinct semantic tasks: price distribution, price/performance, large-context value, provider portfolio, capability landscape, release evolution, availability and multi-dimensional trade-offs.
- Ranking, Matrix and Scatter expose deterministic container/data-shape adaptation. Proof Lab records the selected mode, contracts, datasets, relationships, operation source, render counts and timing.
- A Ranking or Table selection updates compatible Detail, Scatter, Relationship and Matrix consumers through runtime bindings. The browser scenario keeps the unrelated `baseline` Metric at one render while affected components update.
- Trend reports insufficient temporal evidence for single-snapshot pricing. Relationship rejects undeclared edges. Benchmark comparison retains its declared synthetic methodology caveat. An undefined universal quality metric is rejected.
- Direct React examples render Ranking, Scatter and Explorer without an agent. MCP, deterministic BYOK and experimental WebMCP project the same four shared capability contracts.

### Native WebMCP execution

On the live production tab, native `workspace_inspect` returned revision 0. `catalog_search` and `data_query` discovered the Model/Provider graph and trusted components. A native `workspace_apply` mounted a Model Table plus Provider Detail, connected them with the declared `provider` relationship, selected Gemini 3.5 Flash-Lite and received browser acknowledgement at revision 1. Selecting GPT-5.4 mini in the rendered table advanced the workspace to revision 2 and changed the linked Provider Detail to OpenAI. Browser automation observed the result; it did not mutate the workspace. [Captured evidence](evidence/native-webmcp-v2.json) records the calls and semantic outcome.

After the final production build, native WebMCP restored the same composition at revision 1 and an official-SDK MCP client independently inspected that exact graph and selection. [Cross-protocol live evidence](evidence/mcp-webmcp-shared-live-v2.json) confirms both adapters converge on the active browser workspace.

### Frozen unseen-intent evaluation

The expanded dataset and component catalog were frozen at SHA-256 `2bd641afeaca96eff5ac943a6d65c87728d764572a38796baaaa2cc9481942ef`. Ten additional intents ran afterward without product source changes: eight passed, one used a safe insufficient-history fallback, and one failed safely because `universalQuality` is not a declared metric. All used existing semantic components and generated zero executable UI. [Detailed results](evidence/unseen-intents-v2.json) retain the correctness statements and outcomes.

### Performance and build observations

On the production Vite preview in Playwright Chromium, the measured price/performance→capability mutation took 0.10 ms for validation, 0.60 ms for capability execution, 0.70 ms for core mutation, and 1.80 ms until affected React effects committed. Only `smart-matrix`, `smart-ranking` and `smart-inspection` updated. The React number includes browser scheduling and excludes paint; external-agent and transport latency were separately null for this direct Showcase run. [Measurement](evidence/showcase-performance.json).

The latest production build before final documentation verification produced a 115.83 kB gzip main entry, 4.86 kB gzip CSS and 0.69 kB gzip browser adapter. It contains modular D3 packages and excludes MCP server/provider code. Strict typecheck, lint, dependency boundaries, 60 unit/integration/parity tests, four production-browser tests and the production build passed.

### Remaining limits

- Coding benchmark values are clearly labelled synthetic same-methodology fixtures. They prove semantic comparison behavior, not actual model quality or a purchasing recommendation.
- Prices are a curated current snapshot. The framework correctly refuses to fabricate historical price trends.
- Live OpenAI BYOK remains unverified because the user selected deterministic provider tests without a configured key.
- Native WebMCP was demonstrated in the compatible Codex in-app browser. Other browsers feature-detect the optional API.
- Ten deterministic post-freeze plans measure catalog coverage and correctness. They do not claim ten independent live-LLM reasoning successes.

The earlier partial verdict and its frozen evaluation remain below as historical evidence. The later rich-catalog upgrade closes the visual composition, relationship, adaptation and generalization gaps within the stated POC boundary; the limits above remain intentional and observable.

## Follow-up: user-requested flexibility expansion

The original frozen evaluation below remains historical. A subsequent explicit scope expansion added selectable semantic table columns, multi-series time-scaled Trend, bounded table virtualization, grid spans, viewport height/density, move operations and clearing optional configuration. The richer fixture contains 720 synthetic workload observations over 90 days and derived model/org summaries. It does not establish real market adoption or historical prices.

Fresh validation: 54 unit/integration/parity tests and four production browser tests pass; typecheck, lint, boundary checks and production build pass. The expanded MCP browser test verifies organization columns, span=8, moving a table to first position, multi-series workload Trend, bounded table rows and an unchanged unrelated baseline render count. React tests additionally cover 10,000 records with fewer than 30 mounted rows, keyboard selection of the last row, and selection after filtering. Core benchmark: 1,000 measured patches, p95 0.0104ms, zero unrelated notifications. Main production gzip: 105.77kB.

Native WebMCP also applied the expanded composition to the real in-app browser, acknowledged revision 1, and inspection confirmed the graph. The visible page showed 90 periods/four organization series, a model-company-price table, OpenAI detail linked from GPT-5.4 and 19 visible virtualized rows out of 720. This is scoped evidence for the expanded capabilities, not a repeat of every frozen unseen-intent challenge or a claim of arbitrary UI expressiveness. Live BYOK remains unverified by user choice.

**Verdict: PARTIALLY PROVEN**

The architecture works end to end for shared semantics, deterministic components, linked selections, incremental operations, real external Codex MCP control and native experimental WebMCP control. Deterministic BYOK completes the same semantic task through the production browser. Live OpenAI execution was not run, by user instruction, without a configured key. Post-freeze evaluation also exposes real gaps in flagship classification, derived group metrics and reverse collection relationships.

## Environment and preserved implementation

Executed 2026-09-06 on macOS ARM64, Node 24.20.0, pnpm 10.30.3, TypeScript 5.9.3, Vite 7.3.6 and Playwright Chromium 153. The Codex in-app browser separately exposed native `document.modelContext` tools. Its exact browser engine version was not recorded.

The original workspace state/store, operation model, React primitives and compounds, CSS design tokens, MCP acknowledgement bridge and tests were retained and extended. Semantic handlers moved from the MCP browser adapter into typed core CapabilityContracts. No alternative business handlers exist in BYOK or WebMCP. Independent review fixed stale selection after filtering, mutable nested filters and missing direct-selection telemetry.

## Frozen dataset

Snapshot `ai-landscape-2026-09-06-v1`: 8 models, 4 organizations, 8 pricing records and 3 people. Sources were retrieved from official vendor documentation. [Snapshot source metadata](../apps/playground/src/snapshot.ts) and every record carry retrieval/version/source information. Missing Anthropic cached-input prices stay null. The model view is an application-owned one-time join of pricing and organization labels, not data copied into workspace state.

Baseline prices are USD per million tokens, standard paid text API pricing. GPT and Grok context surcharges, Google thinking/storage conditions and capacity-versus-priced-context distinctions remain explicit. No unsupported person-to-model authorship is claimed. There is only one date; Trend explicitly reports no historical trend.

[The freeze record](evidence/catalog-freeze.json) contains the datasets, records, component catalog, timestamp and SHA-256. `scripts/summarize-proof.ts` confirmed the dataset/component catalog was unchanged after all challenge runs. No new intent-specific pages or components were added after failures.

## Executed checks

- Strict typecheck, ESLint and package dependency checks: pass.
- 44 unit/integration/parity tests across core, React, MCP, BYOK, WebMCP and companion: pass.
- Four production-browser tests: pass (direct/compound/linked interaction, real MCP transport, accessibility, and deterministic BYOK through HTTP→tool loop→WebSocket→browser).
- Production Vite build: pass. Build checks reject MCP server/SDK, companion or provider code entering browser assets.
- Automated axe WCAG A/AA checks on overview and investigation: zero reported violations. Keyboard tabs and Enter selection, 390px mobile no-overflow behavior, and desktop/mobile screenshots checked. This is not full accessibility certification.

## Direct operation and semantic reuse

Explicit Ranking, Explorer’s Ranking/Table toggle, Comparison’s reused Ranking/Metric, Metric, Trend and Detail all use the same contracts. Direct investigation creates linked Ranking→Model Detail→Organization Detail through semantic operations. Clicking a model changes downstream details without page-specific selection state. Pricing→Model and Person→Organization relationships are also declared and tested; the live challenge exercised Person→Organization.

The initial metric remains mounted while investigation blocks change. A targeted title patch leaves unrelated Ranking and Comparison render counters unchanged. Selection changes only the relevant blocks. Subscription and ResizeObserver cleanup tests pass.

## Component smartness

Ranking measures its container and reports compact/full representation, width and shown/total rows. CSS removes bars in compact containers while retaining labels, values and selection. A 390px mobile run verified hidden bars and no page overflow. ResizeObserver instrumentation records actual dimensions and cleans up; it does not call a model. The Proof Lab shows these measurements alongside block commit counts.

## Protocol proof

| Path | Actual execution | Result |
| --- | --- | --- |
| MCP | Codex root agent sent discovered tool calls through a generic official-SDK stdio client relay to the real companion and production in-app browser | Verified live; browser acknowledged revisions 1 and 2, selected Gemini 3.5 Flash-Lite and showed Google details |
| BYOK | Deterministic provider traversed companion HTTP, bounded model-tool loop, shared capabilities, acknowledged WebSocket delivery and production UI | Verified deterministic end to end; explicitly not live model reasoning |
| OpenAI BYOK | Real Responses provider implementation and mocked HTTP contract/error tests | Live execution unverified; no key supplied and user chose deterministic proof |
| WebMCP support: experimental | Codex in-app-browser native tool discovery and calls through `document.modelContext.registerTool` | Verified live; canonical mutation acknowledged revision 3; subsequent MCP inspect saw the same graph |
| WebMCP in ordinary test Chromium | Feature unavailable; fake-host lifecycle/schema/dispatcher tests run separately | Native proof not claimed for this host |

The MCP relay contains no intent templates. Codex inspected the catalog/query results, reasoned externally, then supplied semantic operations. Browser controls were used to open/observe the page and view evidence, never as a fallback mutation protocol. MCP success required browser acknowledgement. Native WebMCP used the browser-provided tool capability, not injected host mocks.

The experimental adapter follows the [current Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api): `document.modelContext.registerTool(tool, { signal })`, with AbortController removal. The real provider follows the [OpenAI Responses function-calling API](https://developers.openai.com/api/docs/guides/function-calling). Keys remain in the companion environment; no key or provider code enters localStorage or the browser bundle.

## Canonical parity

Intent: “Show the AI models with the lowest output-token pricing and let me inspect the selected model and its organization.”

All paths discover the same four capabilities, order models by `outputPrice` ascending, mount trusted Ranking/Detail blocks, bind model selection to model Detail and follow the declared `organization` relationship. Selecting `gemini-3-5-flash-lite` resolves `google`. No executable UI was generated.

[Protocol parity evidence](evidence/protocol-parity.json) records calls, operations, events and equal normalized graphs for SDK-projected MCP, deterministic BYOK and a simulated WebMCP host. It labels the simulation boundaries. The real [MCP transcript](evidence/codex-live-mcp.json) and [native WebMCP record](evidence/native-webmcp.json) supplement that fixture proof. Live paths preserve an unrelated baseline block and have different revision numbers, while satisfying the same semantic outcome constraints. Live three-provider reasoning parity is not claimed.

## Post-freeze unseen-intent results

The following requests were evaluated by Codex through actual MCP calls after freezing the dataset/component catalog. The runtime has no intent-specific handlers. Full calls and revisions are in the live MCP transcript; [summarized results](evidence/unseen-intents.json) include assumptions and calculations.

| Intent | Outcome | Evidence/limit |
| --- | --- | --- |
| Low output prices with large context | PASS with assumptions | Baseline price ≤$5 and capacity ≥1M produces Gemini Flash-Lite and Grok 4.3; filtered Ranking and Table mounted at revision 4. Capacity is not a promise of baseline pricing at full context. |
| Flagship input/output comparison | NOT PROVEN | No sourced flagship classification. The unknown-field request is rejected. An all-model comparison table is possible but does not answer the exact flagship intent. |
| Output below a threshold with organization inspection | PASS | Price <$5, selected GPT-5.4 mini, linked OpenAI Detail; revision 6. |
| Labs, key people and models | PARTIAL | Reused Table/Detail and declared Person→Organization + Model→Organization edges work. Reverse organization→model collection filtering is not automatic; the OpenAI example uses a semantic filter. |
| Organizations with widest price spread | NOT PROVEN as a workspace visualization | The agent can compute spreads from bounded query records, but no grouped derived metric contract exists. `outputPriceSpread` is correctly rejected. External output spreads: Anthropic $15, OpenAI $10.50, Google $6.50, xAI $3.50. |
| Compare two organizations, focus biggest differences | PARTIAL | Filtered OpenAI Ranking and Anthropic Comparison render at revision 9. External output-price mean difference is $7.75 vs $1.875 input-price mean difference. No dynamic delta metric is available. |

These tests demonstrate composition reuse and falsifiable limits, not broad generalization across unknown natural-language tasks. Listed challenges were supplied in advance; evaluation artifacts were created after catalog freeze and were not installed as product flows.

## Performance observations

[Core measurement](evidence/performance.json): 50 mounted nodes, 100 warm-up patches and 1,000 measured configuration patches. p50 0.0055 ms, p95 0.01025 ms, maximum 0.20292 ms. Exactly 1,100 targeted notifications and zero unrelated notifications. This Node measurement excludes React, networking and paint.

[Scale measurement](evidence/performance-scale.json): the production preview rendered a filtered/sorted 100,000-row × 20-column Table with 23 DOM rows, retained End/Enter keyboard navigation, and produced a 34.0 ms warm median / 35.7 ms p95 observable result across seven samples. A 50,000-point Trend drew a disclosed 793-point SVG sample while its accessible exact summary retained all raw points, extrema, latest value and missing count; warm observable result was 65.4 ms median / 65.5 ms p95. Script, layout and Paint trace totals are recorded separately. This one Apple M4 Pro/Chromium fixture does not prove field INP, other browsers/devices, remote data, resize, or brush behavior.

Production browser assertions show unchanged baseline render counts during external composition/selection and unchanged unrelated counters during a targeted patch. The live session retained baseline commit count 1 across all protocol/challenge updates. Proof Lab reports browser validation/execution timings at host timer resolution; zero can mean below that resolution. Model/provider latency is separate. Standard production React does not expose profiler durations here; the UI explicitly marks that duration unavailable rather than fabricating it.

Production gzip: main entry 102.91 kB, MCP browser adapter 0.69 kB, optional WebMCP adapter 0.35 kB, CSS 3.76 kB. Core validation/JSON Schema code moved into the shared entry. `dist/bundle-report.json` records modular D3/React/Zod composition and excludes provider/server code. No Canvas, Worker or custom scheduler was introduced. These are local observations, not service-level latency or large-data scalability claims.

## Failures and limitations

- The first live MCP reads timed out because an earlier v1 preview tab held the one-browser connection. Closing that prior preview released the bridge; subsequent live operations succeeded. The transcript retains failed reads.
- A large request line exceeded the terminal’s input limit before reaching MCP. The canonical change was then submitted as two acknowledged patches. Protocol-level atomicity remains per patch.
- Live BYOK was not attempted without credentials, as explicitly requested by the user. Provider tests do not prove real-model composition quality.
- Native WebMCP was verified only in the compatible in-app browser. Other browsers remain feature-detected and optional.
- No sourced flagship field, grouped derived metric or reverse collection-binding model was added to repair failed challenges.
- Foreign-key values changing inside a live application DataPort do not independently trigger downstream selection notifications. This frozen-snapshot POC avoids that path; a future live-data implementation needs explicit invalidation.
- Per-record source dates exist, but no historical price series is available. Token capacity, baseline price conditions and observed coverage remain explicit.
- Browser block counts reset on remount; Proof Lab accumulates session commits. Model latency is not framework-render latency. Browser acknowledgement confirms core application, not completed paint.

The framework architecture is credible and several live control/composition paths work. The evidence supports continuing with focused semantic gaps and a real-provider evaluation, but does not support a fully PROVEN verdict yet.

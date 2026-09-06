# Aeliqo · POC v2

A headless TypeScript UI core, framework-owned React components and one shared capability layer projected into MCP, BYOK and experimental WebMCP. This upgrades the original POC in place.

The production-quality continuation is tracked in the [local implementation audit](docs/aeliqo/current-state.md) and [execution record](docs/aeliqo/exec-plan.md). The PoC proof below does not establish package-release or production readiness.

**Frozen proof verdict: strongly proven for its defined POC scope.** That dated proof used eleven trusted catalog components. The current runtime exposes sixteen catalog components plus Workspace, with a per-surface evidence matrix rather than one blanket quality claim. Live Codex→MCP→browser and native in-app-browser WebMCP worked in the frozen proof. Deterministic BYOK parity has fresh local evidence; live OpenAI execution remains unverified. See [the executed proof report](docs/PROOF.md).

## Run

Node 22.12+ and the pinned pnpm 10 are required.

```sh
corepack pnpm install
pnpm dev
```

Open [the playground](http://127.0.0.1:5173). Direct UI works with no companion, keys or agent.

- **Showcase:** start with Metric + Explorer, then choose any of eight semantic tasks. The workspace incrementally becomes distributions, correlations, relationship maps, matrices, rankings and linked inspection without generated UI code.
- **Primitives / Explorer:** explicit `Ranking`, `Scatter` and compound use of the same semantic model. Explorer switches between Ranking and Table locally.
- **Proof Lab:** semantic needs, matched contracts, datasets, relationships, operations, adaptation modes, component updates and separate local/agent timings.
- **Documentation:** searchable guides, eleven compiled standalone component examples, the full implemented inventory, source previews, semantics, workspace controls, agent integration and support boundaries.
- **Test isolated update:** reconfigure only the baseline. Unrelated block counters stay unchanged.

The curated snapshot contains 8 models and a connected Provider, Model, Pricing, Capability, Modality, ModelLimit, Benchmark, BenchmarkResult, Release and Availability graph. It is representative, not exhaustive or a latest-only comparison. Source URLs, retrieval date and version are included. Coding benchmark results are explicitly synthetic same-methodology fixtures. A single price snapshot cannot establish a historical price trend.

## MCP and companion

The expanded fixture adds `usage`: 720 explicitly synthetic daily observations (90 days × 8 models), and `model-usage`: per-model totals. Requests, token counts, latency and simulated spend are test workloads, **not real popularity or historical pricing**. Organizations also expose model count, mean prices and output-price spread derived from the curated snapshot.

Workspace configuration supports `columns` (declared dimensions, time fields or metrics), `seriesBy` (Trend grouping dimension), `span` (1–12 grid columns), `height` (240–900px table viewport), `density` (`compact`/`comfortable`), filters and limits up to 10,000 rows. Large tables render a bounded window of rows. `move` with `id` and zero-based `index` changes reading order while preserving component identity. `configure` accepts `unset` to clear optional fields. Narrow screens stack blocks. No arbitrary CSS or UI code is accepted.

Example requests to Codex through native WebMCP:

- “Show every model and its company in a wide table, with company details beside it.”
- “Show the synthetic 90-day request trend by organization across the full width, and a compact workload table below it.”
- “Move the trend to the top and make the model table two-thirds width.”

The native proof for this release used: “Show every model and its company in a table, with company details following the selected model.” WebMCP mounted a model Table and Provider Detail, connected them with the declared `provider` relationship, and acknowledged revision 1. Selecting GPT-5.4 mini advanced the workspace to revision 2 and resolved Provider Detail to OpenAI.

For display requests the agent applies configuration, then inspects and observes the result. `data_query` alone never changes the dashboard. Native WebMCP tool results are JSON strings: parse them before reading `revision`. Refresh discovery after a page reload. This in-memory POC resets workspace state on reload.

An MCP client should launch this **stdio** command with the repository as working directory:

```json
{
  "mcpServers": {
    "aeliqo": {
      "command": "node",
      "args": ["--import", "tsx", "apps/companion/src/cli.ts"],
      "cwd": "/absolute/path/to/aeliqo"
    }
  }
}
```

Client configuration formats vary; the command, arguments and absolute working directory are the launch contract. `pnpm companion` starts the same local process manually. It owns WebSocket port **4318** and HTTP port **4319**. Open its diagnostic pairing URL to explicitly bind one workspace and renderer. The secret fragment is removed from browser history after parsing. A different renderer cannot replace that target; restarting/revoking pairing requires a fresh URL. Both development port 5173 and production preview port 4173 are allowed. The existing MCP-only `pnpm mcp` command remains available.

Ask the external agent:

> Show me models with low output pricing and large context windows, and let me inspect the selected model.

The capabilities are defined once in core:

| Capability | Meaning |
| --- | --- |
| `workspace_inspect` | Read revision, nodes, bindings and selections |
| `catalog_search` | Discover semantic data, relationships and trusted components |
| `data_query` | Bounded reads, declared-field filters, metric ordering |
| `workspace_apply` | Validated, atomic, revision-checked semantic operations |

Agents inspect the revision, then apply `mount`, `remove`, `configure`, `connect`, `disconnect` or `select`. A model-to-organization binding uses `relationship: "organization"` and target `entity: "Organization"`. No arbitrary code, HTML, JSX or CSS is accepted. MCP only reports success after the browser core acknowledges application. Timeouts are ambiguous: inspect before retrying. Acknowledgement is not a browser-paint guarantee.

## BYOK · OpenAI

The real provider uses the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/function-calling). Configure `OPENAI_API_KEY` in the **companion process environment**, then restart it. Optional `OPENAI_MODEL` defaults to `gpt-5.4-mini`. Never place the key in Vite variables, client source, browser storage or tool arguments. Do not commit a secret file.

The playground command input calls the loopback companion, which runs a bounded provider/tool loop with explicit workspace output policy. Text or a data query alone cannot satisfy this policy: a valid presented receipt is required. Programmatic `runAgent` also supports explicit chat policy, which cannot apply workspace mutations. This is a trusted host choice, not a natural-language classifier. Provider latency is measured separately. The deterministic provider is an explicitly scripted test fixture, not a natural-language reasoning engine.

## WebMCP support: experimental

The optional package feature-detects **`document.modelContext.registerTool(tool, { signal })`** and unregisters with AbortController, following the [current imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api). It does not use the older navigator/provideContext APIs. Absence does not break any other package.

The Codex in-app browser in this proof exposed compatible native tools; actual discovery/query/mutation worked. Standard Playwright Chromium did not expose this API. Fake-host contract tests remain labeled simulations, separately from native evidence. There is no browser-automation control fallback.

## Framework API

`DataPort` remains application-owned: `listDatasets`, `getDataset`, stable `getSnapshot`, and `subscribe`. Define semantics once with `defineDataset`: entity, identity, dimensions, metrics, formatting, aggregation, time fields and relationships. `apps/playground/src/data.ts` contains a one-time application-owned join of model pricing and organization labels; components reuse it.

Linked selection subscribers observe the datasets along their binding chain, so an application snapshot update can refresh related Detail views without a workspace mutation. Unsubscribing releases those data subscriptions. Observer exceptions are diagnosed through `console.error` and do not turn committed operations into failures; apply results and their telemetry retain that operation's revision even if a subscriber makes a subsequent edit.

Every adapter uses the core version-0.2 receipt tracker. `presented` requires the exact committed revision, a visible renderer acknowledgement and valid ready affected data; missing/error renderers and invalid snapshots cannot report completion. Pending receipts can be recovered with `workspace_inspect({requestId})`. Acknowledgement does not prove that a person saw pixels. Failed validation and revision conflicts remain explicit operation errors.

Human controls support pins and bounded undo/redo. Agents cannot bypass pins, including through linked source changes. `mode: "filter"` bindings combine declared filters within one dataset, separately from selection links. `serializeWorkspace` and `restoreWorkspace` persist only validated presentation state; the host owns storage I/O. No data records or provider secrets enter saved workspace documents.

Trend retains explicitly missing observations as gaps. Missing endpoints remain in the time domain, and an unavailable latest measurement is not replaced by the last known value. Entirely absent periods are not inferred without a declared time grain.

```tsx
const node = {
  id: 'ranking', component: 'Ranking' as const,
  datasetId: 'models', metric: 'outputPrice', direction: 'asc' as const,
};
const store = createWorkspace({ dataPort, nodes: [node] });
<Ranking store={store} node={node} />;

const scatter = {
  id: 'value', component: 'Scatter' as const,
  datasetId: 'models', xMetric: 'outputPrice', metric: 'contextWindow',
  seriesBy: 'provider',
};
<Scatter store={store} node={scatter} />;
```

Import core/React from `@aeliqo/core` and `@aeliqo/react`, plus `@aeliqo/react/styles.css`. Metric, Table, Filter, Ranking, Trend, Detail and Comparison have direct props and matching package subpaths. Scatter, Distribution, Relationship, Matrix and Explorer use the semantic store/node API; Workspace composes all registered renderers. Trusted extensions register their schema and React renderer without adding a central component union. `pnpm check:packages` builds private ESM/types/CSS tarballs, installs a consumer, checks SSR/types and measures standalone imports. Public npm publication and license selection remain pending owner decisions. Theme tokens are scoped with `.aeliqo-theme` or `data-aeliqo-theme`; importing CSS does not restyle the host root.

## Verify and reproduce evidence

```sh
pnpm exec playwright install chromium
pnpm check
pnpm test:parity
pnpm proof:stress
```

`pnpm check` runs typecheck, lint, dependency checks, unit/integration/parity tests, production build, browser tests and the core benchmark. `pnpm check:packages` verifies actual local package consumers. `pnpm proof:stress` verifies the historical catalog subset unchanged and records ten intents; Filter was added after that frozen proof. Browser tests choose isolated preview/bridge/HTTP ports. `pnpm exec tsx scripts/browser-test-collision.ts` verifies they work while the old default ports are occupied. Existing services are not stopped. Screenshots and traces are regenerated in artifacts/test-results; build composition is in `dist/bundle-report.json`.

`pnpm exec tsx scripts/mcp-session.ts` is a generic official-SDK client relay used by Codex for the live proof. It launches the companion and accepts one JSON `{name, arguments, intent?}` per line; it contains no intent-specific composition rules. Enter `exit` to stop. Its captured transcript is `docs/evidence/codex-live-mcp.json`. The catalog freeze and protocol-parity records are also in `docs/evidence/`.

See [architecture](docs/ARCHITECTURE.md), [decisions](docs/DECISIONS.md) and [proof results and limitations](docs/PROOF.md). Historical v1 results remain in `docs/VALIDATION.md`.

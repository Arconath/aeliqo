import { useState, type ReactNode } from 'react';
import { DeltaExample, RecordListExample, SelectionSummaryExample, OverviewExample } from './documentation-examples';
import { MetricExample, TableExample, FilterExample, RankingExample, TrendExample, DetailExample, ComparisonExample, RatioExample, PartialExample } from './documentation-examples';
import { MetricBreakdownExample, EventTimelineExample, TimeInvestigationExample, QualityPanelExample, ScatterExample, DistributionExample, RelationshipExample, MatrixExample, ExplorerExample, OperationalWorkspaceExample } from './documentation-examples';
import exampleSource from './documentation-examples.tsx?raw';
import { AeliqoLogo, SiteFrame } from './site-chrome';
import './documentation.css';

const pages = [
  { id: 'start', title: 'Start here', group: 'Learn', terms: 'install packages first component getting started' },
  { id: 'components', title: 'Component reference', group: 'Build', terms: 'Metric Table Filter Ranking Trend Detail Scatter Distribution Relationship Matrix Explorer Delta RecordList SelectionSummary Overview Comparison MetricBreakdown EventTimeline TimeInvestigation QualityPanel primitive explicit standalone input selection catalog' },
  { id: 'data', title: 'Data that keeps its meaning', group: 'Build', terms: 'ratio rate currency money units partial stale scope' },
  { id: 'workspace', title: 'Compose a workspace', group: 'Build', terms: 'links selection filters pin undo revision' },
  { id: 'agents', title: 'Connect an agent', group: 'Integrate', terms: 'MCP BYOK WebMCP pairing target receipt pending' },
  { id: 'quality', title: 'Accessibility & customization', group: 'Integrate', terms: 'keyboard theme dark CSS performance extension renderer' },
  { id: 'reference', title: 'Support & migration', group: 'Reference', terms: 'API version license OSS release Next.js compatibility' },
] as const;
type PageId = typeof pages[number]['id'];

type DocumentationProps = {
  readonly embedded?: boolean;
};

type DocumentationNavItem = {
  readonly id: PageId;
  readonly label: string;
  readonly primary?: boolean;
};

const navigationGroups: readonly { readonly title: string; readonly items: readonly DocumentationNavItem[] }[] = [
  {
    title: 'Getting started',
    items: [
      { id: 'start', label: 'Start here', primary: true },
      { id: 'start', label: 'Installation' },
      { id: 'start', label: 'Quickstart' },
      { id: 'start', label: 'Framework notes' },
    ],
  },
  {
    title: 'Foundations',
    items: [
      { id: 'data', label: 'Data that keeps its meaning', primary: true },
      { id: 'quality', label: 'Accessibility & customization', primary: true },
    ],
  },
  {
    title: 'Semantic components',
    items: [
      { id: 'components', label: 'Component reference', primary: true },
      { id: 'components', label: 'Metric' },
      { id: 'components', label: 'Table' },
      { id: 'components', label: 'Explorer' },
      { id: 'components', label: 'Investigation components' },
    ],
  },
  {
    title: 'Adaptive workspaces',
    items: [
      { id: 'workspace', label: 'Compose a workspace', primary: true },
      { id: 'workspace', label: 'Selection and links' },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { id: 'agents', label: 'Connect an agent', primary: true },
      { id: 'agents', label: 'MCP, BYOK & WebMCP' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { id: 'reference', label: 'Support & migration', primary: true },
    ],
  },
] as const;

function navigationHref(item: DocumentationNavItem): string {
  if (item.primary) return `#docs-${item.id}`;
  const slug = item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `#docs-${item.id}-${slug}`;
}

const pageSummaries: Record<PageId, string> = {
  start: 'Start with one useful component, then add shared semantics and workspace coordination as your product grows.',
  components: 'Explore the semantic primitives and compound components that power explicit, data-aware, and workspace usage.',
  data: 'Describe units, ratios, scope, and freshness once so every view keeps the same meaning.',
  workspace: 'Compose connected views incrementally while your application keeps ownership of its source records.',
  agents: 'Connect trusted capability calls through explicit MCP, BYOK, or experimental WebMCP boundaries.',
  quality: 'Keep adaptive interfaces readable, accessible, and predictable across input methods and container sizes.',
  reference: 'Review supported packages, tested integrations, licensing, and migration boundaries for the current release.',
};

type TocItem = { readonly id: string; readonly label: string };

const tocByPage: Record<PageId, readonly TocItem[]> = {
  start: [
    { id: 'docs-overview', label: 'Overview' },
    { id: 'docs-preview', label: 'Live preview' },
    { id: 'docs-install', label: 'Install / Import' },
    { id: 'docs-quickstart', label: 'Quickstart' },
  ],
  components: [
    { id: 'docs-overview', label: 'Overview' },
    { id: 'docs-preview', label: 'Live preview' },
    { id: 'docs-examples', label: 'Examples' },
    { id: 'docs-api', label: 'API reference' },
  ],
  data: [
    { id: 'docs-overview', label: 'Overview' },
    { id: 'docs-preview', label: 'Live preview' },
    { id: 'docs-semantic-contract', label: 'Semantic contract' },
    { id: 'docs-scope', label: 'Scope and freshness' },
  ],
  workspace: [
    { id: 'docs-overview', label: 'Overview' },
    { id: 'docs-preview', label: 'Live preview' },
    { id: 'docs-workspace-contract', label: 'Workspace contract' },
  ],
  agents: [
    { id: 'docs-overview', label: 'Overview' },
    { id: 'docs-install', label: 'Install / Import' },
    { id: 'docs-capabilities', label: 'Semantic capabilities' },
    { id: 'docs-api', label: 'Integration reference' },
  ],
  quality: [
    { id: 'docs-overview', label: 'Overview' },
    { id: 'docs-accessibility', label: 'Accessibility' },
    { id: 'docs-adaptive', label: 'Adaptive behavior' },
    { id: 'docs-performance', label: 'Performance' },
  ],
  reference: [
    { id: 'docs-overview', label: 'Overview' },
    { id: 'docs-api', label: 'API reference' },
    { id: 'docs-migration', label: 'Migration' },
  ],
};

function Example({ title, children }: { title: string; children: ReactNode }) {
  const [code, setCode] = useState(false);
  const [copied, setCopied] = useState('');
  return <section className="docs-example" aria-label={`${title} example`}>
    <header><strong>{title}</strong><button type="button" aria-pressed={code} onClick={() => setCode(!code)}>{code ? 'Show preview' : 'Show source'}</button></header>
    {code ? <><div className="docs-source-toolbar"><p className="docs-caption">Actual compiled example module, including shared fixtures and imports.</p><div><button type="button" onClick={() => { if (typeof navigator === 'undefined' || !navigator.clipboard) { setCopied('Copy unavailable; select the source below.'); return; } void navigator.clipboard.writeText(exampleSource).then(() => setCopied('Source copied.'), () => setCopied('Copy unavailable; select the source below.')); }}>Copy source</button><span role="status" aria-live="polite">{copied}</span></div></div><pre tabIndex={0}><code>{exampleSource}</code></pre></> : <div className="docs-preview">{children}</div>}
  </section>;
}
function Page({ id }: { id: PageId }) {
  if (id === 'start') return <>
    <p className="docs-lead">Start with one useful component. Add shared data meaning and workspace coordination when your application needs them.</p>
    <Example title="Your first Metric"><MetricExample /></Example>
    <h3 id="docs-install">Install Aeliqo 0.2.0</h3><p>The first public release is available from npm. Install only the surfaces your application needs.</p>
    <pre><code>{'npm install @aeliqo/core @aeliqo/react'}</code></pre>
    <p>The release contains five allowlisted packages: core contracts, React components, MCP, server-side BYOK, and experimental WebMCP. The package check also installs the published names into consumers outside the workspace and verifies declarations, server rendering, CSS, and isolated imports.</p>
    <h3>Bring the visual styles</h3><pre><code>{'import "@aeliqo/react/styles.css";\nimport { Metric } from "@aeliqo/react/metric";\n\n<Metric value={42} label="Active records" />'}</code></pre>
    <p>The explicit Metric needs no dataset registry, workspace, agent, or network connection. The subpath above is available from the published package.</p>
    <h3>React quickstart</h3><pre><code>{'import { defineDataset } from "@aeliqo/core";\nimport { Table } from "@aeliqo/react/table";\nimport "@aeliqo/react/styles.css";\n\nconst services = defineDataset({\n  id: "services", entity: "Service", label: "Services",\n  identity: "id", labelField: "name",\n  dimensions: [{ key: "name", label: "Service" }],\n  metrics: [{ key: "requests", label: "Requests", aggregation: "sum" }],\n  timeFields: []\n});\n\n<Table dataset={services} snapshot={{ status: "ready", records }} />;'}</code></pre>
    <h3>Next.js App Router</h3><p>Import the stylesheet from your root layout. Put interactive Aeliqo components behind a client boundary; dataset descriptors and serializable snapshots may be supplied by a server component.</p><pre><code>{'// app/layout.tsx\nimport "@aeliqo/react/styles.css";\n\n// app/services/service-table.tsx\n"use client";\nimport { Table } from "@aeliqo/react/table";\nexport function ServiceTable(props) { return <Table {...props} />; }'}</code></pre>
    <p>The tested matrix is listed under Support &amp; migration. Do not infer support for every React and Next.js pair from the peer range.</p>
  </>;
  if (id === 'components') return <>
    <p className="docs-lead">Standalone, semantic, and workspace entry paths backed by the same component implementations.</p>
    <h3>Metric</h3><p>Use for a known value or a declared aggregate. <code>value</code> and <code>label</code> are required; an optional <code>metric</code> supplies formatting. Null and non-finite values display an unavailable marker.</p><Example title="Standalone Metric"><MetricExample /></Example>
    <h3>Table</h3><p>Pass <code>dataset</code> and an application-owned <code>snapshot</code>. Optional <code>selectedId</code> and <code>onSelect</code> make selection controlled. Selection uses stable record IDs, never array positions.</p><Example title="Selectable Table"><TableExample /></Example>
    <h3>Filter</h3><p>Pass <code>dataset</code>, <code>filters</code>, and <code>onChange</code>. Draft input stays local until Apply. This example deliberately performs its own local filtering; a remote host must execute an authorized query instead.</p><Example title="Controlled Filter"><FilterExample /></Example>
    <h3>Ranking</h3><p>Pass <code>dataset</code>, <code>snapshot</code>, and a declared <code>metric</code> key. Optional direction, limit, and controlled selection configure the same ranking used by the workspace. Compact rendering preserves values and meaning.</p><Example title="Standalone Ranking"><RankingExample /></Example>
    <h3>Trend</h3><p>Pass <code>dataset</code>, <code>snapshot</code>, <code>metric</code>, and <code>timeField</code>. The month-grain synthetic example below declares its temporal meaning. Missing values remain gaps; one observation is not sufficient to claim a trend.</p><Example title="Standalone Trend"><TrendExample /></Example>
    <h3>Detail</h3><p>Pass <code>dataset</code>, <code>snapshot</code>, and an optional <code>selectedId</code>. No selected record produces an explicit selection prompt. The application supplies selection when used directly.</p><Example title="Standalone Detail"><DetailExample /></Example>
    <h3>Comparison</h3><p>Pass <code>dataset</code>, <code>snapshot</code>, declared <code>metrics</code>, and controlled <code>selectedIds</code>. Compare 2–8 identities across 1–20 metrics. Each row keeps its own unit, so counts, currency and percentages remain separate; rows never form a mixed-unit total. Optional <code>onSelectionChange</code> enables selection controls. In a workspace, use <code>node.compareIds</code> for the identities and <code>node.columns</code> for metric keys.</p><Example title="Standalone Comparison"><ComparisonExample /></Example>
    <h3>Delta</h3><p>Supply current <code>value</code>, <code>baseline</code>, <code>baselineLabel</code> and <code>label</code>. Relative mode divides signed change by the absolute baseline; a zero baseline is unavailable. No prior period is inferred.</p><Example title="Standalone Delta"><DeltaExample /></Example>
    <h3>RecordList</h3><p>Scan named records with a few declared fields. Selection is controlled by identity. At most 100 loaded records are shown; omitted scope is disclosed.</p><Example title="Standalone RecordList"><RecordListExample /></Example>
    <h3>SelectionSummary</h3><p>Pass explicit <code>selectedIds</code>; unavailable identities stay visible. This never implies all records across pages are selected. The optional clear callback belongs to the host.</p><Example title="Standalone SelectionSummary"><SelectionSummaryExample /></Example>
    <h3>Overview</h3><p>A compact compound of the existing Metric and RecordList primitives. Pass 1–6 declared metric keys and optional controlled record selection; each aggregate retains its own unit.</p><Example title="Standalone Overview"><OverviewExample /></Example>
    <h3>Scatter</h3><p>Compare two declared metrics while preserving entity identity and deterministic compact annotations. Optional controlled selection links the same point identity to other views.</p><Example title="Standalone Scatter"><ScatterExample /></Example>
    <h3>Distribution</h3><p>Inspect a declared metric's bins, quartiles, and outliers. Missing values stay outside the numeric population and partial scope stays visible.</p><Example title="Standalone Distribution"><DistributionExample /></Example>
    <h3>Relationship</h3><p>Render only an application-declared relationship between source and target datasets. A matching foreign key is evidence of linkage, not causality.</p><Example title="Standalone Relationship"><RelationshipExample /></Example>
    <h3>Matrix</h3><p>Compare several declared metrics across stable entity identities. Narrow layouts shorten visible labels while retaining accessible names.</p><Example title="Standalone Matrix"><MatrixExample /></Example>
    <h3>Explorer</h3><p>Compose Filter, Ranking, Table, and Detail behavior around controlled selection and filters. The representation switch reuses the same primitives.</p><Example title="Standalone Explorer"><ExplorerExample /></Example>
    <h3>MetricBreakdown</h3><p>Group an additive or ratio-of-sums metric by a declared dimension, then inspect the exact contributing records. Percentages are recomputed from their numerator and denominator.</p><Example title="Smart MetricBreakdown"><MetricBreakdownExample /></Example>
    <h3>EventTimeline</h3><p>Order explicit events using a declared time field. A keyboard-operable range narrows the visible events; time proximity is never described as causation.</p><Example title="Smart EventTimeline"><EventTimelineExample /></Example>
    <h3>TimeInvestigation</h3><p>Coordinate Delta, Trend, EventTimeline, and Table around one selected temporal range while retaining an explicit comparison baseline.</p><Example title="Smart TimeInvestigation"><TimeInvestigationExample /></Example>
    <h3>QualityPanel</h3><p>Expose provenance, scope, coverage, freshness, missing values, and stated comparison limits. Missing evidence remains unknown.</p><Example title="Smart QualityPanel"><QualityPanelExample /></Example>
    <h3>The implemented catalog</h3><p>Every released component is being verified for direct and semantic use through package subpaths, and Workspace composes the same registered renderers. Full per-component evidence and limitations are recorded in <code>docs/aeliqo/component-specs/completion-matrix.md</code>.</p>
    <p className="docs-note">Synthetic approval data. These examples demonstrate API behavior, not real organizational performance.</p>
  </>;
  if (id === 'data') return <>
    <p className="docs-lead">A shared descriptor lets a table, ranking and metric answer the same question consistently.</p>
    <h3>Ratios aggregate their inputs</h3><p>One cohort approved 1 of 2 requests; another approved 90 of 100. The combined rate is 91 ÷ 102 = 89.2%. Averaging 50% and 90% would incorrectly produce 70%.</p><Example title="Ratio of sums"><RatioExample /></Example>
    <p>Declare <code>aggregation: "ratio-of-sums"</code> with numerator, denominator, <code>zeroDenominator: "null"</code>, and <code>missing: "exclude-pair"</code>. Inputs must be additive measures with compatible units and declared grain. Incomplete pairs are excluded together. A zero denominator or non-finite result is unavailable.</p>
    <h3>Currency formatting is not conversion</h3><p>A currency measure declares <code>format: "currency"</code> and a supported currency code such as <code>unit: "USD"</code>. Changing the label to EUR does not convert the amount. Currency conversion and exact monetary accounting remain the application's responsibility; the current numeric PoC is not an exact-decimal ledger.</p>
    <h3>A loaded page is not the entire dataset</h3><p>Snapshots can disclose <code>scope</code>, <code>totalCount</code>, <code>stale</code>, and <code>revision</code>. Page-local results cannot establish a global ranking. An omitted scope makes no completeness claim.</p><Example title="Partial and stale snapshot"><PartialExample /></Example>
  </>;
  if (id === 'workspace') return <>
    <p className="docs-lead">The workspace owns composition and semantic references. Your application keeps ownership of source records.</p>
    <ol><li>Define datasets and implement a stable <code>DataPort</code> snapshot/subscription boundary.</li><li>Create a workspace with trusted nodes referencing dataset and field IDs.</li><li>Apply versioned operations against the inspected revision.</li><li>Connect compatible selection sources and targets through declared relationships.</li></ol>
    <h3>Use the same operation path</h3><pre><code>{'store.apply({\n  version: 1,\n  baseRevision: store.getState().revision,\n  operations: [{ type: "select", id: "ranking", recordId: "record-1" }]\n});'}</code></pre>
    <p>This fragment assumes an existing selectable node and record. Invalid IDs, incompatible relationships and stale revisions are rejected. A selection link does not imply a filter link: explicitly configure the supported interaction.</p>
    <h3>A manual linked investigation</h3><p>This operational dataset is unrelated to AI Landscape. Select a team in MetricBreakdown to narrow the Table, then select an event to update Detail. QualityPanel receives the same typed group and keeps provenance visible. The flow uses only local data and manual controls.</p><Example title="Operational Workspace without an agent"><OperationalWorkspaceExample /></Example>
    <h3>Preserve a person's work</h3><p>Prefer incremental configure/move operations to removing and rebuilding nodes. Stable IDs preserve local controls. Keep draft text inside the input until a deliberate commit; keep shared selection in the workspace. Inspect current revision before an agent applies a later change.</p>
  </>;
  if (id === 'agents') return <>
    <p className="docs-lead">Agent reasoning chooses the change. Trusted components render it through the same capability dispatcher.</p>
    <h3>Local MCP setup</h3><pre><code>{'AELIQO_WORKSPACE_ID=operations npx --yes @aeliqo/mcp'}</code></pre><p>Configure your MCP client to launch one public MCP executable per explicit workspace. A configured renderer is pinned ahead of time; otherwise the first authorized pairing chooses it.</p><p>The process prints a pairing URL containing the non-secret expected workspace and optional renderer identity. Open that URL to pair the intended workspace. Read the workspace, renderer, and connection status before issuing mutations; another browser context cannot silently replace that target. Pairing tokens are local credentials: do not include them in screenshots or shared examples. Cancelled MCP requests propagate to pending bridge work. Revoking or stopping the local process rejects later operations and requires a fresh credential.</p>
    <h3>Local BYOK backend recipe</h3><p>Install <code>@aeliqo/core</code>, <code>@aeliqo/mcp</code>, and <code>@aeliqo/byok</code> in a Node backend. The runnable repository recipe at <code>apps/companion/examples/byok-local-server.ts</code> composes those public packages, binds both servers to <code>127.0.0.1</code>, checks one explicit loopback origin and bearer pairing credential, limits input/concurrency/turns/time, and reads <code>OPENAI_API_KEY</code> only in the Node process.</p><pre><code>{'import { createAeliqoServer } from "@aeliqo/mcp";\nimport { runAgent } from "@aeliqo/byok";\nimport { createOpenAIProvider } from "@aeliqo/byok/openai";\n\nconst bridge = createAeliqoServer({\n  port: 4318,\n  allowedOrigins: ["http://127.0.0.1:5173"],\n  workspaceId: "operations"\n});\nconst provider = createOpenAIProvider({\n  apiKey: process.env.OPENAI_API_KEY!,\n  model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini"\n});\n// Your authenticated local POST handler calls runAgent(provider, intent,\n//   (name, input, options) => bridge.bridge.request(name, input, "BYOK", options),\n//   { output: "workspace", signal });'}</code></pre><p>This is a local or self-hosted integration boundary, not a hosted multi-user inference service. For remote deployments, the application must supply its own user authentication, authorization, rate limits, TLS, and an authorized <code>DataPort</code>. Never expose the provider key or an unauthenticated spending endpoint to browser users.</p>
    <h3>Four semantic capabilities</h3><p><code>workspace_inspect</code>, <code>catalog_search</code>, <code>data_query</code>, and <code>workspace_apply</code> expose data and trusted operations. They do not accept arbitrary JSX, scripts, HTML or CSS.</p>
    <h3>A commit is only one part of completion</h3><p>A successful operation can still have a pending renderer receipt. An acknowledgement identifies the exact revision projected by React; it does not prove that a person saw the pixels. Partial data must remain visibly partial.</p>
    <div className="docs-note"><strong>Integration evidence</strong><p>MCP is the primary local path and has been exercised with an external Codex client against an explicitly paired workspace. BYOK is a local or self-hosted backend integration; deterministic provider and request-contract tests pass, while a paid-provider request remains the application's responsibility. WebMCP support is experimental and feature-detected; standard browsers may not expose it. This documentation does not simulate a connected model.</p></div>
  </>;
  if (id === 'quality') return <>
    <p className="docs-lead">Keep the interface understandable when data, container size, or input method changes.</p>
    <h3>Keyboard and accessible meaning</h3><p>Use visible labels, stable row identity and text equivalents for chart values. Do not make a tooltip the only way to learn an important value. Exercise filtering, selection, error states and focus using a keyboard. A passing automated check does not replace an external usability session.</p>
    <h3>Theme the component boundary</h3><p>Styles use <code>--aeliqo-*</code> variables. A local scope can override surface, text, border and accent values. Use <code>data-theme="dark"</code> for the supplied dark palette. Validate contrast after overrides; RTL and reduced motion deserve their own checks.</p>
    <pre><code>{'.my-panel {\n  --aeliqo-accent: #52678f;\n  --aeliqo-radius: 12px;\n}'}</code></pre>
    <h3>Measure the actual import</h3><p><code>pnpm check:packages</code> records the standalone Metric bundle, excluding React, and rejects retained workspace, D3 or protocol implementations. <code>pnpm perf</code> measures the core workload. These are configuration-specific measurements, not universal latency guarantees.</p>
    <h3>Extend through trusted application code</h3><p>Keep custom components and renderers in developer-owned modules. Validate any exposed configuration and register only capabilities the renderer actually implements. An agent-supplied module URL or callback string is never a trusted extension. Consult the current source contract before adopting an extension API; the broader catalog blueprint is not an implementation promise.</p>
  </>;
  return <>
    <p className="docs-lead">Five allowlisted 0.x packages with explicit evidence boundaries.</p>
    <div className="docs-table-wrap"><table><thead><tr><th>Surface</th><th>Current support</th></tr></thead><tbody>
      <tr><td>Core / React</td><td>Local ESM artifacts and declarations; standalone and semantic entry points.</td></tr>
      <tr><td>React / server rendering</td><td>Tarball consumers verify React 18.3.1 and 19.2.8 with strict declarations, Vite production builds, and server rendering.</td></tr>
      <tr><td>Next.js App Router</td><td>Candidate artifacts are tested with Next.js 15.5.25 + React 18.3.1 and Next.js 16.3.4 + React 19.2.8, including production build, SSR, hydration, and client selection. This is a tested matrix, not a claim about every Next.js version.</td></tr>
      <tr><td>MCP / BYOK</td><td>Shared dispatcher. Deterministic adapter tests are distinct from external-agent or real-provider evidence.</td></tr>
      <tr><td>WebMCP</td><td>Experimental; unavailable hosts degrade safely.</td></tr>
      <tr><td>License / publication</td><td>Apache-2.0; version 0.2.0 is published to npm and verified from a clean external consumer.</td></tr>
      <tr><td>Commercial / adoption</td><td>Business hypotheses; independent pilots and paid demand are not validated.</td></tr>
    </tbody></table></div>
    <h3>Migration from the existing PoC</h3><p>Existing semantic <code>store</code>/<code>node</code> props remain valid. Explicit Metric and Table props are additive. Legacy <code>sum</code>, <code>mean</code>, and <code>none</code> measures remain available; derived ratios use their own explicit declaration. Existing two-argument filtering remains supported; pass the dataset as the third argument to resolve derived measures.</p>
    <p>Do not mix candidate 0.1 JSON schemas from the blueprint with the executing version-1 workspace operation format. The current TypeScript model and capability runtime validation describe the implemented contract.</p>
  </>;
}
function DocsRail({ active }: { readonly active: PageId }) {
  const toc = tocByPage[active];
  return <aside className="docs-rail" aria-label="On this page">
    <details className="docs-toc-disclosure" open>
      <summary>On this page</summary>
      <nav aria-label="On this page navigation"><ol className="docs-toc">{toc.map((item, index) => <li key={item.id}><a href={`#${item.id}`} aria-current={index === 0 ? 'location' : undefined}>{item.label}</a></li>)}</ol></nav>
    </details>
    <section className="docs-rail-card docs-inspector-card" aria-labelledby="docs-inspector-title">
      <div className="docs-rail-card-icon"><AeliqoLogo compact /></div>
      <h2 id="docs-inspector-title">Aeliqo Inspector</h2>
      <p>See how Aeliqo keeps data meaning, component behavior, and interaction contracts together.</p>
      <dl className="docs-inspector-list">
        <div><dt>Surface</dt><dd>Semantic component</dd></div>
        <div><dt>Behavior</dt><dd>Explicit and adaptive</dd></div>
        <div><dt>Evidence</dt><dd>Compiled example</dd></div>
      </dl>
      <a className="docs-rail-action" href="/playground/">Open in Playground <span aria-hidden="true">→</span></a>
    </section>
    <section className="docs-rail-card docs-help-card" aria-labelledby="docs-help-title">
      <h2 id="docs-help-title">Need help?</h2>
      <p>Check the source examples and support notes before connecting an application-owned integration.</p>
      <a href="https://github.com/aeliqo/aeliqo" target="_blank" rel="noreferrer">View on GitHub <span aria-hidden="true">→</span></a>
    </section>
  </aside>;
}

export function Documentation({ embedded }: DocumentationProps = {}) {
  const [active, setActive] = useState<PageId>(() => {
    const id = typeof window === 'undefined' ? '' : window.location.hash.replace('#docs-', '');
    return pages.some(page => page.id === id) ? id as PageId : 'start';
  });
  const [query, setQuery] = useState('');
  const [actionStatus, setActionStatus] = useState('');
  const page = pages.find(item => item.id === active)!;
  const filtered = pages.filter(item => `${item.title} ${item.terms}`.toLowerCase().includes(query.toLowerCase().trim()));
  const visiblePageIds = new Set(filtered.map(item => item.id));
  const navigate = (id: PageId) => { setActive(id); history.replaceState(null, '', `#docs-${id}`); };
  const position = pages.findIndex(item => item.id === active);
  const standalone = embedded === undefined
    ? (typeof window === 'undefined' || window.location.pathname.replace(/\/+$/, '') === '/docs')
    : !embedded;
  const copyPageContext = () => {
    const context = `Aeliqo documentation: ${page.title}\n${pageSummaries[active]}\nAnchor: #docs-${active}`;
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      setActionStatus('Copy unavailable; select the page text instead.');
      return;
    }
    void navigator.clipboard.writeText(context).then(() => setActionStatus('Page context copied.'), () => setActionStatus('Copy unavailable; select the page text instead.'));
  };
  const content = <div className="docs-page">
    <div className="docs-shell">
      <aside className="docs-sidebar">
        <details className="docs-nav-disclosure" open>
          <summary>Documentation navigation</summary>
          <div className="docs-nav-body">
            <p className="docs-eyebrow">Aeliqo / Developer guide</p>
            <label htmlFor="docs-search">Find a topic</label>
            <input id="docs-search" type="search" placeholder="Try currency, Table, or MCP" value={query} onChange={event => setQuery(event.target.value)} />
            <nav aria-label="Documentation topics">
              {navigationGroups.map(group => {
                const items = group.items.filter(item => visiblePageIds.has(item.id));
                if (!items.length) return null;
                return <section className="docs-nav-group" key={group.title}><h2>{group.title}</h2><ul>{items.map(item => <li key={`${item.id}-${item.label}`}><a className={item.primary && active === item.id ? 'is-active' : undefined} href={navigationHref(item)} aria-current={item.primary && active === item.id ? 'page' : undefined} onClick={event => { event.preventDefault(); navigate(item.id); }}>{item.label}</a></li>)}</ul></section>;
              })}
            </nav>
            {!filtered.length && <p role="status">No matching topics. Try a component or integration name.</p>}
            <p className="docs-caption">Aeliqo 0.2.0<br />Apache-2.0</p>
          </div>
        </details>
      </aside>
      <article className="docs-article" aria-label={page.title}>
        <header className="docs-page-header">
          <nav className="docs-breadcrumb" aria-label="Breadcrumb"><a href="/docs/">Docs</a><span aria-hidden="true">›</span><span>{page.group}</span><span aria-hidden="true">›</span><span aria-current="page">{page.title}</span></nav>
          <div className="docs-heading-row">
            <div>
              <p className="docs-eyebrow">{page.group} <span>Aeliqo 0.2.0</span></p>
              <h1>{page.title} <span className="docs-status">Stable</span></h1>
              <p className="docs-page-summary">{pageSummaries[active]}</p>
              <div className="docs-tag-list" aria-label="Documentation attributes"><span>React-first</span><span>Type-safe</span><span>Accessible</span><span>Open source</span></div>
            </div>
            <div className="docs-heading-actions">
              <button type="button" className="docs-secondary-action" onClick={copyPageContext}>Copy for agent</button>
              <a className="docs-primary-action" href="/playground/">Open in Playground <span aria-hidden="true">→</span></a>
              {actionStatus && <span className="docs-action-status" role="status" aria-live="polite">{actionStatus}</span>}
            </div>
          </div>
        </header>
        <div className="docs-article-body">
          {tocByPage[active].map(item => <span className="docs-anchor" id={item.id} key={item.id} aria-hidden="true" />)}
          <Page key={active} id={active} />
        </div>
        <footer className="docs-pagination">{position > 0 && <button type="button" onClick={() => navigate(pages[position - 1]!.id)}>← {pages[position - 1]!.title}</button>}{position < pages.length - 1 && <button type="button" onClick={() => navigate(pages[position + 1]!.id)}>{pages[position + 1]!.title} →</button>}</footer>
      </article>
      <DocsRail active={active} />
    </div>
  </div>;
  return standalone ? <SiteFrame active="docs" footer>{content}</SiteFrame> : content;
}

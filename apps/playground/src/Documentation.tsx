import { useState, type ReactNode } from 'react';
import { DeltaExample, RecordListExample, SelectionSummaryExample, OverviewExample } from './documentation-examples';
import { MetricExample, TableExample, FilterExample, RankingExample, TrendExample, DetailExample, ComparisonExample, RatioExample, PartialExample } from './documentation-examples';
import exampleSource from './documentation-examples.tsx?raw';
import './documentation.css';

const pages = [
  { id: 'start', title: 'Start here', group: 'Learn', terms: 'install packages first component getting started' },
  { id: 'components', title: 'Component reference', group: 'Build', terms: 'Metric Table Filter Ranking Trend Detail primitive explicit standalone input selection catalog' },
  { id: 'data', title: 'Data that keeps its meaning', group: 'Build', terms: 'ratio rate currency money units partial stale scope' },
  { id: 'workspace', title: 'Compose a workspace', group: 'Build', terms: 'links selection filters pin undo revision' },
  { id: 'agents', title: 'Connect an agent', group: 'Integrate', terms: 'MCP BYOK WebMCP pairing target receipt pending' },
  { id: 'quality', title: 'Accessibility & customization', group: 'Integrate', terms: 'keyboard theme dark CSS performance extension renderer' },
  { id: 'reference', title: 'Support & migration', group: 'Reference', terms: 'API version license OSS release Next.js compatibility' },
] as const;
type PageId = typeof pages[number]['id'];
function Example({ title, children }: { title: string; children: ReactNode }) {
  const [code, setCode] = useState(false);
  const [copied, setCopied] = useState('');
  return <section className="docs-example" aria-label={`${title} example`}>
    <header><strong>{title}</strong><button type="button" aria-pressed={code} onClick={() => setCode(!code)}>{code ? 'Show preview' : 'Show source'}</button></header>
    {code ? <><p className="docs-caption">Actual compiled example module, including shared fixtures and imports.</p><button type="button" onClick={() => { if (!navigator.clipboard) { setCopied('Copy unavailable; select the source below.'); return; } void navigator.clipboard.writeText(exampleSource).then(() => setCopied('Source copied.'), () => setCopied('Copy unavailable; select the source below.')); }}>Copy source</button><span role="status">{copied}</span><pre tabIndex={0}><code>{exampleSource}</code></pre></> : <div className="docs-preview">{children}</div>}
  </section>;
}
function Page({ id }: { id: PageId }) {
  if (id === 'start') return <>
    <p className="docs-lead">Start with one useful component. Add shared data meaning and workspace coordination when your application needs them.</p>
    <Example title="Your first Metric"><MetricExample /></Example>
    <h3>Build the local packages</h3><p>Package names are provisional. This repository produces private local artifacts; it has not published an npm release.</p>
    <pre><code>{'pnpm install --frozen-lockfile\npnpm check:packages'}</code></pre>
    <p>The check builds five packages, packs them, installs the tarballs into an isolated consumer, checks declarations, renders on the server, and examines the standalone bundle. Existing third-party dependencies are linked offline. Find the tarballs in <code>artifacts/tarballs/</code> and measured results in <code>artifacts/package-evidence.json</code>.</p>
    <h3>Bring the visual styles</h3><pre><code>{'import "@aeliqo/react/styles.css";\nimport { Metric } from "@aeliqo/react/metric";\n\n<Metric value={42} label="Active records" />'}</code></pre>
    <p>The explicit Metric needs no dataset registry, workspace, agent, or network connection. The subpath above is exposed by the generated local package. Repository examples use the source module directly.</p>
  </>;
  if (id === 'components') return <>
    <p className="docs-lead">Eleven direct entry points, backed by the same implementations used inside a workspace.</p>
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
    <h3>The implemented catalog</h3><p>The eleven direct APIs above have local package subpaths. Scatter, Distribution, Relationship, Matrix and Explorer currently use semantic <code>store</code>/<code>node</code> props. Workspace is the seventeenth implemented UI surface and composes those nodes. Full per-component evidence and remaining limitations are recorded in <code>docs/aeliqo/component-specs/completion-matrix.md</code>.</p>
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
    <h3>Preserve a person's work</h3><p>Prefer incremental configure/move operations to removing and rebuilding nodes. Stable IDs preserve local controls. Keep draft text inside the input until a deliberate commit; keep shared selection in the workspace. Inspect current revision before an agent applies a later change.</p>
  </>;
  if (id === 'agents') return <>
    <p className="docs-lead">Agent reasoning chooses the change. Trusted components render it through the same capability dispatcher.</p>
    <h3>Local MCP setup</h3><pre><code>{'pnpm dev'}</code></pre><p>Configure your MCP client to launch <code>pnpm companion</code> with this repository as its working directory. That process provides MCP over standard input/output and the local BYOK companion. For MCP alone, the alternative entry is <code>pnpm mcp</code>; run one bridge entry per configured port.</p><p>The process prints a pairing URL to its diagnostic output. Open that URL to pair the playground. Read the selected workspace and connection status before issuing mutations; another tab must not silently replace your target. Pairing tokens are local credentials: do not include them in screenshots or shared examples.</p>
    <h3>Four semantic capabilities</h3><p><code>workspace_inspect</code>, <code>catalog_search</code>, <code>data_query</code>, and <code>workspace_apply</code> expose data and trusted operations. They do not accept arbitrary JSX, scripts, HTML or CSS.</p>
    <h3>A commit is only one part of completion</h3><p>A successful operation can still have a pending renderer receipt. An acknowledgement identifies the exact revision projected by React; it does not prove that a person saw the pixels. Partial data must remain visibly partial.</p>
    <div className="docs-note"><strong>Integration evidence</strong><p>MCP is the primary local path. Scripted BYOK is deterministic test evidence; a real-provider run remains unverified. WebMCP support is experimental, feature-detected, and historically observed in a compatible browser. Standard browsers may not expose it. This documentation does not simulate a connected model.</p></div>
  </>;
  if (id === 'quality') return <>
    <p className="docs-lead">Keep the interface understandable when data, container size, or input method changes.</p>
    <h3>Keyboard and accessible meaning</h3><p>Use visible labels, stable row identity and text equivalents for chart values. Do not make a tooltip the only way to learn an important value. Exercise filtering, selection, error states and focus using a keyboard. A passing automated check does not replace an external usability session.</p>
    <h3>Theme the component boundary</h3><p>Styles use <code>--aeliqo-*</code> variables. A local scope can override surface, text, border and accent values. Use <code>data-theme="dark"</code> for the supplied dark palette. Validate contrast after overrides; RTL and reduced motion deserve their own checks.</p>
    <pre><code>{'.my-panel {\n  --aeliqo-accent: #117568;\n  --aeliqo-radius: 12px;\n}'}</code></pre>
    <h3>Measure the actual import</h3><p><code>pnpm check:packages</code> records the standalone Metric bundle, excluding React, and rejects retained workspace, D3 or protocol implementations. <code>pnpm perf</code> measures the core workload. These are configuration-specific measurements, not universal latency guarantees.</p>
    <h3>Extend through trusted application code</h3><p>Keep custom components and renderers in developer-owned modules. Validate any exposed configuration and register only capabilities the renderer actually implements. An agent-supplied module URL or callback string is never a trusted extension. Consult the current source contract before adopting an extension API; the broader catalog blueprint is not an implementation promise.</p>
  </>;
  return <>
    <p className="docs-lead">Five private 0.2.0 packages with explicit evidence boundaries.</p>
    <div className="docs-table-wrap"><table><thead><tr><th>Surface</th><th>Current support</th></tr></thead><tbody>
      <tr><td>Core / React</td><td>Local ESM artifacts and declarations; standalone and semantic entry points.</td></tr>
      <tr><td>Server rendering</td><td>Node import and React render smoke checks. Not a full Next.js compatibility certification.</td></tr>
      <tr><td>MCP / BYOK</td><td>Shared dispatcher. Deterministic adapter tests are distinct from external-agent or real-provider evidence.</td></tr>
      <tr><td>WebMCP</td><td>Experimental; unavailable hosts degrade safely.</td></tr>
      <tr><td>License / publication</td><td>Private artifacts; license undecided; no public npm availability promised.</td></tr>
      <tr><td>Commercial / adoption</td><td>Business hypotheses; independent pilots and paid demand are not validated.</td></tr>
    </tbody></table></div>
    <h3>Migration from the existing PoC</h3><p>Existing semantic <code>store</code>/<code>node</code> props remain valid. Explicit Metric and Table props are additive. Legacy <code>sum</code>, <code>mean</code>, and <code>none</code> measures remain available; derived ratios use their own explicit declaration. Existing two-argument filtering remains supported; pass the dataset as the third argument to resolve derived measures.</p>
    <p>Do not mix candidate 0.1 JSON schemas from the blueprint with the executing version-1 workspace operation format. The current TypeScript model and capability runtime validation describe the implemented contract.</p>
  </>;
}
export function Documentation() {
  const [active, setActive] = useState<PageId>(() => { const id = typeof location === 'undefined' ? '' : location.hash.replace('#docs-', ''); return pages.some(page => page.id === id) ? id as PageId : 'start'; });
  const [query, setQuery] = useState('');
  const page = pages.find(item => item.id === active)!;
  const filtered = pages.filter(item => `${item.title} ${item.terms}`.toLowerCase().includes(query.toLowerCase().trim()));
  const navigate = (id: PageId) => { setActive(id); history.replaceState(null, '', `#docs-${id}`); };
  const position = pages.findIndex(item => item.id === active);
  return <div className="docs-shell">
    <aside className="docs-sidebar"><p className="docs-eyebrow">Aeliqo / Developer guide</p><label htmlFor="docs-search">Find a topic</label><input id="docs-search" type="search" placeholder="Try currency, Table, or MCP" value={query} onChange={event => setQuery(event.target.value)} />
      <nav aria-label="Documentation topics">{filtered.map(item => <a key={item.id} href={`#docs-${item.id}`} aria-current={active === item.id ? 'page' : undefined} onClick={event => { event.preventDefault(); navigate(item.id); }}><small>{item.group}</small>{item.title}</a>)}</nav>{!filtered.length && <p role="status">No matching topics. Try a component or integration name.</p>}<p className="docs-caption">Local 0.x proof<br />License and release gates remain open.</p></aside>
    <article className="docs-article" aria-label={page.title}><header><p className="docs-eyebrow">{page.group} <span>Local POC</span></p><h2>{page.title}</h2></header><Page key={active} id={active} /><footer className="docs-pagination">{position > 0 && <button onClick={() => navigate(pages[position - 1]!.id)}>← {pages[position - 1]!.title}</button>}{position < pages.length - 1 && <button onClick={() => navigate(pages[position + 1]!.id)}>{pages[position + 1]!.title} →</button>}</footer></article>
  </div>;
}

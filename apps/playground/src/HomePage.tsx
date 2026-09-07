import { useState } from "react";
import { SiteFrame } from "./site-chrome";
import "./home-page.css";

const installCommand = "npm install @aeliqo/core @aeliqo/react";

type FeatureKind = "primitive" | "semantic" | "workspace";

const featureCards: readonly {
  readonly kind: FeatureKind;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
}[] = [
  {
    kind: "primitive",
    title: "Primitives",
    description: "Composable building blocks for any interface.",
    tags: ["Layout", "Data", "Form", "Navigation"],
  },
  {
    kind: "semantic",
    title: "Semantic Components",
    description: "Higher-level components that understand intent.",
    tags: ["Table", "Chart", "Card", "CRUD"],
  },
  {
    kind: "workspace",
    title: "Adaptive Workspaces",
    description: "Complete, data-aware interfaces that adapt to your users.",
    tags: ["Dashboard", "Analytics", "Management", "More"],
  },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3 9h11M9.5 4.5 14 9l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <rect x="6.5" y="2.5" width="8.5" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M11 12.5v1A2 2 0 0 1 9 15.5H4.5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CopyButton({ label, value }: { readonly label: string; readonly value: string }) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className="home-copy-button" type="button" aria-label={copied ? `${label} copied` : label} onClick={() => void copyValue()}>
      {copied ? <span className="home-copy-check" aria-hidden="true">✓</span> : <CopyIcon />}
    </button>
  );
}

function FeatureIcon({ kind }: { readonly kind: FeatureKind }) {
  if (kind === "primitive") {
    return (
      <svg viewBox="0 0 54 54" aria-hidden="true">
        <path d="m27 5 19 11v22L27 49 8 38V16L27 5Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="m8 16 19 11 19-11M27 27v22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "semantic") {
    return (
      <svg viewBox="0 0 54 54" aria-hidden="true">
        <path d="m27 7 19 11-19 11L8 18 27 7Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        <path d="m8 27 19 11 19-11M8 36l19 11 19-11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 54 54" aria-hidden="true">
      <rect x="8" y="8" width="38" height="38" rx="3" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M27 8v38M8 27h38" fill="none" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

function IntentCard() {
  return (
    <div className="home-intent-card">
      <div className="home-intent-heading">
        <span>Your intent</span>
        <span className="home-intent-edit" aria-hidden="true">↗</span>
      </div>
      <p>Create a customer dashboard with key metrics, a revenue chart, and a table of recent orders.</p>
      <div className="home-intent-tags" aria-label="Intent capabilities">
        <span>dashboard</span>
        <span>chart</span>
        <span>table</span>
        <span>analytics</span>
        <span>data</span>
      </div>
    </div>
  );
}

function TrendChart({ compact = false }: { readonly compact?: boolean }) {
  return (
    <svg className={`home-trend-chart${compact ? " is-compact" : ""}`} viewBox="0 0 420 140" role="img" aria-label="Revenue trend rising over six months">
      <defs>
        <linearGradient id={compact ? "home-chart-fill-compact" : "home-chart-fill"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#556cff" stopOpacity=".34" />
          <stop offset="1" stopColor="#556cff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={compact ? "home-chart-line-compact" : "home-chart-line"} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#3ba7ff" />
          <stop offset=".55" stopColor="#6664ff" />
          <stop offset="1" stopColor="#9b6dff" />
        </linearGradient>
      </defs>
      <g className="home-chart-grid" aria-hidden="true">
        <path d="M28 20h374M28 52h374M28 84h374M28 116h374" />
        <path d="M28 20v96M90 20v96M152 20v96M214 20v96M276 20v96M338 20v96M402 20v96" />
      </g>
      <path className="home-chart-area" d="M28 99C50 94 61 92 78 91s24-10 39-8 22 8 35 4 24-19 38-17 22 10 35 5 24-15 39-11 24 2 36-6 22-10 35-5 24 3 35-7 23-13 36-7 22-12 34-18v91H28Z" fill={`url(#${compact ? "home-chart-fill-compact" : "home-chart-fill"})`} />
      <path className="home-chart-line" d="M28 99C50 94 61 92 78 91s24-10 39-8 22 8 35 4 24-19 38-17 22 10 35 5 24-15 39-11 24 2 36-6 22-10 35-5 24 3 35-7 23-13 36-7 22-12 34-18" fill="none" stroke={`url(#${compact ? "home-chart-line-compact" : "home-chart-line"})`} strokeWidth={compact ? "3" : "3.5"} strokeLinecap="round" />
      <circle className="home-chart-dot" cx="402" cy="21" r={compact ? "4" : "5"} />
      <g className="home-chart-labels" aria-hidden="true">
        <text x="28" y="133">Jan</text><text x="88" y="133">Feb</text><text x="150" y="133">Mar</text><text x="212" y="133">Apr</text><text x="274" y="133">May</text><text x="336" y="133">Jun</text><text x="394" y="133">Jul</text>
      </g>
    </svg>
  );
}

function DashboardPreview({ compact = false }: { readonly compact?: boolean }) {
  return (
    <div className={`home-dashboard${compact ? " is-compact" : ""}`} role="img" aria-label="Customer overview dashboard preview with metrics and a revenue trend">
      <aside className="home-dashboard-sidebar" aria-hidden="true">
        <div className="home-dashboard-brand"><img className="home-dashboard-brand-mark" src="/aeliqo-logo.png" alt="" width="19" height="19" /><span>Aeliqo</span><span className="home-dashboard-chevron">›</span></div>
        <nav className="home-dashboard-nav" aria-label="Dashboard preview navigation">
          <span className="is-selected"><i>⌂</i>Dashboard</span>
          <span><i>♙</i>Customers</span>
          <span><i>□</i>Orders</span>
          <span><i>⌁</i>Analytics</span>
          <span><i>⚙</i>Settings</span>
        </nav>
      </aside>
      <div className="home-dashboard-body">
        <header className="home-dashboard-topbar" aria-hidden="true">
          <span className="home-dashboard-search"><i>⌕</i>Search...</span>
          <span className="home-dashboard-shortcut">⌘ K</span>
        </header>
        <div className="home-dashboard-content">
          <div className="home-dashboard-title-row"><h3>Customer Overview</h3><span className="home-dashboard-kebab">⋯</span></div>
          <div className="home-metric-grid">
            <div><span>Total Customers</span><strong>12,480</strong><em>↑ 12%</em></div>
            <div><span>Total Revenue</span><strong>$248,320</strong><em>↑ 8%</em></div>
            <div><span>Active Orders</span><strong>1,429</strong><em>↑ 6%</em></div>
          </div>
          <div className="home-dashboard-chart-card">
            <div className="home-chart-heading"><strong>Revenue Trend</strong><span>Last 6 months⌄</span></div>
            <div className="home-chart-y-axis" aria-hidden="true"><span>300K</span><span>200K</span><span>100K</span><span>0</span></div>
            <TrendChart compact={compact} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="home-hero-visual">
      <div className="home-visual-grid" aria-hidden="true" />
      <div className="home-visual-orb home-visual-orb-one" aria-hidden="true" />
      <div className="home-visual-orb home-visual-orb-two" aria-hidden="true" />
      <span className="home-visual-note" aria-hidden="true">From intent<br />to interface.</span>
      <IntentCard />
      <div className="home-intent-arrow" aria-hidden="true"><ArrowIcon /></div>
      <DashboardPreview />
    </div>
  );
}

function FeatureCard({ description, kind, tags, title }: (typeof featureCards)[number]) {
  return (
    <article className="home-feature-card">
      <div className="home-feature-icon"><FeatureIcon kind={kind} /></div>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
        <ul aria-label={`${title} capabilities`}>
          {tags.map((tag) => <li key={tag}>{tag}</li>)}
        </ul>
      </div>
    </article>
  );
}

function CodePreview() {
  return (
    <div className="home-code-preview">
      <div className="home-code-panel">
        <div className="home-panel-tabs">
          <span className="home-window-dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="is-active">app.tsx</span>
          <span>package.json</span>
          <CopyButton label="Copy example code" value={'import { createWorkspace } from "@aeliqo/core";\nimport { Metric, Trend } from "@aeliqo/react";'} />
        </div>
        <pre className="home-code"><code><span className="home-code-line"><b>1</b><span><i>import</i> &#123; createWorkspace &#125; <i>from</i> <em>"@aeliqo/core"</em></span></span><span className="home-code-line"><b>2</b><span><i>import</i> &#123; Metric, Trend &#125; <i>from</i> <em>"@aeliqo/react"</em></span></span><span className="home-code-line"><b>3</b><span>&nbsp;</span></span><span className="home-code-line"><b>4</b><span><i>const</i> workspace = createWorkspace(&#123;</span></span><span className="home-code-line"><b>5</b><span>&nbsp;&nbsp;dataPort,</span></span><span className="home-code-line"><b>6</b><span>&#125;)</span></span><span className="home-code-line"><b>7</b><span>&nbsp;</span></span><span className="home-code-line"><b>8</b><span><i>export default function</i> RevenueView() &#123;</span></span><span className="home-code-line"><b>9</b><span>&nbsp;&nbsp;<strong>return</strong> &lt;&gt;&lt;Metric /&gt; &lt;Trend /&gt;&lt;/&gt;</span></span></code></pre>
      </div>
      <div className="home-preview-panel">
        <div className="home-preview-heading"><div><span className="is-active">Preview</span><span>Live</span></div><span className="home-expand" aria-label="Preview expands with the workspace" role="img">↗</span></div>
        <div className="home-preview-content">
          <div className="home-preview-title"><strong>Sales Dashboard</strong><span>Last 30 days⌄</span></div>
          <div className="home-preview-metrics"><div><span>Revenue</span><strong>$248,320</strong><em>↑ 12%</em></div><div><span>Orders</span><strong>1,429</strong><em>↑ 8%</em></div><div><span>Conversion Rate</span><strong>3.4%</strong><em>↑ 6%</em></div></div>
          <div className="home-preview-chart"><TrendChart compact /></div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  return (
    <SiteFrame className="aeliqo-home-page" footer>
      <main className="home-main">
        <section className="home-hero" aria-labelledby="home-title">
          <div className="home-hero-copy">
            <p className="home-eyebrow">A SMART UI FRAMEWORK</p>
            <h1 id="home-title" aria-label="Smart components from intent. Build smart UI from intent."><span>Build smart UI</span><strong>from intent.</strong></h1>
            <p className="home-hero-description">Aeliqo is a smart UI framework for adaptive interfaces. Compose primitives, use semantic components, and create adaptive workspaces from simple intent.</p>
            <div className="home-hero-actions">
              <a className="home-button home-button-primary" href="/docs/">Get Started <ArrowIcon /></a>
              <a className="home-button home-button-secondary" href="/docs/">Read the Docs</a>
            </div>
            <div className="home-install-command" role="group" aria-label="Install Aeliqo">
              <span className="home-command-prompt" aria-hidden="true">›</span>
              <code>{installCommand}</code>
              <CopyButton label="Copy install command" value={installCommand} />
            </div>
            <p className="home-install-note">Open source. Built for what’s next.</p>
          </div>
          <HeroVisual />
        </section>

        <section className="home-features" aria-labelledby="home-features-title">
          <div className="home-section-divider"><span /><p id="home-features-title">A FRAMEWORK FOR ADAPTIVE INTERFACES</p><span /></div>
          <div className="home-feature-grid">{featureCards.map((feature) => <FeatureCard key={feature.title} {...feature} />)}</div>
        </section>

        <section className="home-build-section" aria-labelledby="home-build-title">
          <div className="home-build-copy">
            <p className="home-eyebrow">FROM INTENT TO INTERFACE</p>
            <h2 id="home-build-title">Turn intent into a real interface.</h2>
            <p>Describe what you need in code, and Aeliqo generates a production-ready, adaptive interface.</p>
          </div>
          <CodePreview />
        </section>
      </main>
    </SiteFrame>
  );
}

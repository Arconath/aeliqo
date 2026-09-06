import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { Metric } from "@aeliqo/react/metric";
import { Overview } from "@aeliqo/react/overview";
import { defineDataset, type DataSnapshot } from "@aeliqo/core";
import "@aeliqo/react/styles.css";
import "./styles.css";

const path = window.location.pathname.replace(/\/+$/, "") || "/";

if (path.startsWith("/playground")) {
  void import("./main");
} else {
  const Documentation = lazy(() => import("./Documentation").then((module) => ({ default: module.Documentation })));
  const OperationalWorkspaceExample = lazy(() => import("./documentation-examples").then((module) => ({ default: module.OperationalWorkspaceExample })));
  const services = defineDataset({
    id: "public-services", entity: "Service", label: "Service operations", identity: "id", labelField: "name", grain: "service-day",
    dimensions: [{ key: "name", label: "Service" }, { key: "team", label: "Team" }], timeFields: [],
    metrics: [{ key: "requests", label: "Requests", unit: "requests", aggregation: "sum" }, { key: "availability", label: "Availability", format: "percent", aggregation: "mean", goal: "maximize" }],
  } as const);
  const serviceSnapshot: DataSnapshot = { status: "ready", scope: "entire-dataset", records: [
    { id: "billing", name: "Billing API", team: "Payments", requests: 12840, availability: .9992 },
    { id: "identity", name: "Identity", team: "Platform", requests: 9360, availability: .9978 },
    { id: "search", name: "Search", team: "Discovery", requests: 7640, availability: .9941 },
  ] };

  function PublicNav() {
    return <nav className="public-nav" aria-label="Primary navigation"><a className="public-brand" href="/">Aeliqo</a><div><a href="/docs/">Docs</a><a href="/playground/">Playground</a><a href="/changelog/">Changelog</a></div></nav>;
  }
  function Home() {
    return <div className="public-site aeliqo-theme" data-aeliqo-theme="light"><PublicNav /><main className="public-main">
      <section className="hero"><p className="eyebrow">SEMANTIC UI FOR REACT</p><h1>Smart components.<br />Adaptive workspaces.<br />Your choice of agent.</h1><p className="hero-copy">Ready-to-use UI components that adapt to data, interactions, and user intent—without generating application code.</p><div className="hero-actions"><a className="primary-link" href="/docs/">Get started</a><a href="/playground/">Explore the playground</a></div><div><p className="release-note">Registry publication pending · candidate command</p><pre className="install-command"><code>npm install @aeliqo/core @aeliqo/react</code></pre></div></section>
      <section className="product-proof" aria-labelledby="product-proof-title"><div className="product-proof-copy"><p className="eyebrow">ONE SEMANTIC MODEL</p><h2 id="product-proof-title">Start with a component. Grow into a connected investigation.</h2><p>Use a primitive on its own, share selection across a compound view, then let a validated workspace operation compose the same implementations. AI is an optional control plane.</p><ol><li><strong>Primitive</strong><span>Useful with explicit props and no runtime.</span></li><li><strong>Compound</strong><span>Reuses the same components and data meaning.</span></li><li><strong>Workspace</strong><span>Connects selection, filters, layout, pins, and history.</span></li></ol></div><div className="home-demo"><Metric value={29840} label="Requests in view" metric={services.metrics[0]} /><Overview dataset={services} snapshot={serviceSnapshot} metrics={["requests", "availability"]} /><div className="home-workspace-demo"><p className="eyebrow">MANUAL LINKED WORKSPACE</p><Suspense fallback={<p role="status">Loading operational workspace…</p>}><OperationalWorkspaceExample /></Suspense></div></div></section>
      <section className="principles" aria-label="Framework principles"><article><span>01</span><h2>Meaning stays attached</h2><p>Units, aggregation, grain, relationships, provenance, and incomplete data remain explicit.</p></article><article><span>02</span><h2>Adaptation stays predictable</h2><p>Components respond to space and density deterministically while preserving selection and focus.</p></article><article><span>03</span><h2>Agents stay bounded</h2><p>MCP, BYOK, and experimental WebMCP project the same trusted capability contracts.</p></article></section>
      <section className="public-cta"><div><p className="eyebrow">PUBLIC FRAMEWORK CANDIDATE</p><h2>Bring your data. Keep your application in control.</h2></div><a className="primary-link" href="/docs/">Build your first view</a></section>
    </main><footer className="public-footer"><span>Aeliqo release candidate</span><span>React-first · Application-owned data · Agent optional</span></footer></div>;
  }
  function DocsPage() { return <div className="public-site aeliqo-theme" data-aeliqo-theme="light"><PublicNav /><main className="public-main docs-route"><Suspense fallback={<p role="status">Loading documentation…</p>}><Documentation /></Suspense></main></div>; }
  function Changelog() { return <div className="public-site aeliqo-theme" data-aeliqo-theme="light"><PublicNav /><main className="public-main changelog"><p className="eyebrow">CHANGELOG</p><h1>Release history</h1><article><header><strong>Unreleased</strong><span>Public framework release candidate</span></header><p>Installable package work, broader direct component APIs, smart investigation components, hardened workspace pairing, and the public documentation experience are being verified.</p></article><p>No public package version has been released yet. Historical proof milestones remain in the engineering documentation and are not presented as registry releases.</p></main></div>; }
  const root = createRoot(document.getElementById("root")!);
  root.render(<React.StrictMode>{path === "/docs" ? <DocsPage /> : path === "/changelog" ? <Changelog /> : <Home />}</React.StrictMode>);
}

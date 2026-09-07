import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "@aeliqo/react/styles.css";
import "./styles.css";
import "./changelog-page.css";
import { SiteFrame } from "./site-chrome";

// Deployment-owned static configuration; local previews and SDK consumers stay off.
if (window.location.hostname === "aeliqo.com" && window.location.protocol === "https:") {
  void fetch("/browser-monitoring.json", { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" })
    .then((response) => response.ok ? response.json() : null)
    .then(async (config: { enabled?: boolean; version?: string } | null) => {
      if (config?.enabled !== true) return;
      const { startBasicMonitoring } = await import("./basic-monitoring");
      startBasicMonitoring({ enabled: true, product: "aeliqo", version: config.version });
    }).catch(() => { /* Unavailable monitoring never prevents rendering. */ });
}

const path = window.location.pathname.replace(/\/+$/, "") || "/";

if (path.startsWith("/playground")) {
  void import("./main");
} else {
  const HomePage = lazy(() => import("./HomePage").then((module) => ({ default: module.HomePage })));
  const Documentation = lazy(() => import("./Documentation").then((module) => ({ default: module.Documentation })));
  const BlogPage = lazy(() => import("./BlogPage").then((module) => ({ default: module.BlogPage })));
  const AboutPage = lazy(() => import("./AboutPage").then((module) => ({ default: module.AboutPage })));
  function ChangelogPage() {
    return (
      <SiteFrame className="changelog-page">
        <main className="changelog-content">
          <p className="design-eyebrow">RELEASE NOTES</p>
          <h1>Release history</h1>
          <article>
            <header><strong>0.2.0</strong><span>7 September 2026 · public release</span></header>
            <p>Five installable packages, twenty direct component entry points, smart investigation components, typed range and group selection, deterministic explainable adaptation, explicit MCP pairing, local BYOK integration, and experimental WebMCP support.</p>
            <ul>
              <li>Install from npm with React 18.3 or 19 and the tested Next.js App Router pairs.</li>
              <li>Use MetricBreakdown, EventTimeline, TimeInvestigation, and QualityPanel with application-owned data.</li>
              <li>Compose the same renderers manually, semantically, or through validated workspace operations.</li>
            </ul>
          </article>
          <p>Historical proof milestones remain in the engineering documentation and are not presented as separate registry releases.</p>
        </main>
      </SiteFrame>
    );
  }

  function DocsPage() {
    return <Suspense fallback={<p role="status">Loading documentation…</p>}><Documentation /></Suspense>;
  }

  function App() {
    if (path === "/docs") return <DocsPage />;
    if (path === "/blog") return <Suspense fallback={<p role="status">Loading blog…</p>}><BlogPage /></Suspense>;
    if (path === "/about") return <Suspense fallback={<p role="status">Loading about page…</p>}><AboutPage /></Suspense>;
    if (path === "/changelog") return <ChangelogPage />;
    return <Suspense fallback={<p role="status">Loading Aeliqo…</p>}><HomePage /></Suspense>;
  }

  const root = createRoot(document.getElementById("root")!);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}

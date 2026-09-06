import React, { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Workspace, Ranking, Scatter, Explorer } from "@aeliqo/react";
import "@aeliqo/react/styles.css";
import "./styles.css";
import { dataPort } from "./data";
import {
  store,
  dispatcher,
  explicit,
  explicitScatter,
  explorer,
  demoStore,
  canonicalIntent,
  resetOverview,
  applyDirect,
  runShowcaseScenario,
} from "./runtime";
import { showcaseScenarios } from "./showcase";
import { proof } from "./proof-store";
import { ProofLab } from "./ProofLab";
import { playgroundEndpoints } from "./endpoints";
const Documentation = lazy(() => import('./Documentation').then(module => ({ default: module.Documentation })));
interface CompanionStatus {
  providerConfigured: boolean;
  model: string;
  busy: boolean;
  workspaceConnected: boolean;
  workspaceId: string;
  rendererId?: string;
}
function Playground({ initialTab = "Showcase" }: { initialTab?: string }) {
  const [tab, setTab] = useState(initialTab);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [mcp, setMcp] = useState("disconnected");
  const [webmcp, setWebmcp] = useState("Checking browser support");
  const [companion, setCompanion] = useState<CompanionStatus | null>(null);
  const [intent, setIntent] = useState(canonicalIntent);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(
    "Curated snapshot. Choose a model to follow its semantic relationships.",
  );
  useEffect(
    () =>
      store.subscribeOperations(({ request, result }) => {
        queueMicrotask(() => {
          if (
            !proof
              .getSnapshot()
              .events.some((event) => event.operations === request.operations)
          )
            proof.operation(request, result);
        });
      }),
    [],
  );
  useEffect(() => {
    let disposed = false;
    let disconnect: (() => void) | undefined;
    let unregister: (() => void) | undefined;
    void import("@aeliqo/mcp/browser")
      .then(({ connectWorkspace }) => {
        if (!disposed)
          disconnect = connectWorkspace(store, dataPort, {
            dispatcher,
            onStatus: setMcp,
            url: playgroundEndpoints.bridgeUrl,
            pairingToken: playgroundEndpoints.pairingToken,
            rendererId: playgroundEndpoints.rendererId,
          });
      })
      .catch(() => setMcp("disconnected"));
    void import("@aeliqo/webmcp-experimental")
      .then(async ({ registerWebMCP }) => {
        if (disposed) return;
        const registration = await registerWebMCP(dispatcher);
        if (disposed) {
          registration.dispose();
          return;
        }
        unregister = registration.dispose;
        setWebmcp(
          registration.supported
            ? "Available · tools registered"
            : "Unavailable in this browser",
        );
      })
      .catch(() => setWebmcp("Registration failed"));
    return () => {
      disposed = true;
      disconnect?.();
      unregister?.();
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const update = async () => {
      try {
        const response = await fetch(`${playgroundEndpoints.companionUrl}/status`, {
          headers: playgroundEndpoints.pairingToken ? {Authorization:`Bearer ${playgroundEndpoints.pairingToken}`} : {},
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const status = (await response.json()) as CompanionStatus;
        if (!disposed) setCompanion(status);
      } catch {
        if (!disposed) setCompanion(null);
      }
    };
    void update();
    const timer = setInterval(() => void update(), 4000);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
    };
  }, []);
  function direct(action: () => unknown) {
    try {
      action();
      setNotice(
        "Semantic workspace operation applied. Select a model to inspect its organization.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Operation rejected");
    }
  }
  function runScenario(id: string) {
    try {
      runShowcaseScenario(id);
      setActiveScenario(id);
      setNotice(
        "Semantic needs matched to trusted components. The workspace changed through incremental operations.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Scenario composition rejected",
      );
    }
  }
  async function askProvider(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(`${playgroundEndpoints.companionUrl}/byok`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization:`Bearer ${playgroundEndpoints.pairingToken ?? ""}` },
        body: JSON.stringify({ intent }),
      });
      const result = (await response.json()) as {
        text?: string;
        error?: string;
        providerMs?: number;
        totalMs?: number;
      };
      if (!response.ok)
        throw new Error(result.error ?? "Provider request failed");
      proof.latency(
        result.providerMs ?? 0,
        Math.max(0, (result.totalMs ?? 0) - (result.providerMs ?? 0)),
      );
      setNotice(result.text ?? "Provider completed its capability calls.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Companion unavailable",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="shell aeliqo-theme" data-aeliqo-theme="light">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">A</span> Aeliqo
        </a>
        <div className="sidebar-caption">RESEARCH WORKSPACE</div>
        <div className="nav-active">
          <span>◫</span> AI landscape
        </div>
        <div className="sidebar-bottom">
          <span className="avatar">0.2</span>
          <div>
            Framework playground<small>Curated data · Local runtime</small>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <a href="/">Aeliqo</a> <span>/</span> <a href="/docs/">Docs</a> <span>/</span> AI landscape
          </div>
          <span className="sandbox">Playground · Deterministic snapshot</span>
        </header>
        <div className="page">
          <div className="heading">
            <div>
              <div className="eyebrow">
                PROVIDERS · MODELS · CAPABILITIES · EVIDENCE
              </div>
              <h1>AI landscape</h1>
              <p>
                One semantic snapshot. Multiple views. A shared control plane.
              </p>
            </div>
            <div className="period">Snapshot · 06 Sep 2026</div>
          </div>
          <div className="toolbar">
            <div className="tabs" role="tablist" aria-label="Proof scenarios">
              {["Showcase", "Primitives", "Explorer", "Documentation", "Proof Lab"].map((t) => (
                <button
                  key={t}
                  role="tab"
                  id={`tab-${t.replaceAll(" ", "-")}`}
                  aria-controls="demo-panel"
                  aria-selected={tab === t}
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => setTab(t)}
                  onKeyDown={(event) => {
                    const buttons = Array.from(
                      event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>(
                        '[role="tab"]',
                      ),
                    );
                    const i = buttons.indexOf(event.currentTarget);
                    const next =
                      event.key === "ArrowRight"
                        ? (i + 1) % buttons.length
                        : event.key === "ArrowLeft"
                          ? (i + buttons.length - 1) % buttons.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? buttons.length - 1
                              : -1;
                    if (next >= 0) {
                      event.preventDefault();
                      buttons[next]!.focus();
                      buttons[next]!.click();
                    }
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            <span className="connection">
              <i className={mcp === "connected" ? "online" : ""} />
              {mcp === "connected"
                ? "MCP bridge connected"
                : "MCP bridge offline"}
            </span>
          </div>
          <section
            id="demo-panel"
            role="tabpanel"
            aria-labelledby={`tab-${tab.replaceAll(" ", "-")}`}
          >
            {tab === "Showcase" ? (
              <>
                <section className="showcase-intro">
                  <div>
                    <span className="eyebrow">ADAPTIVE WORKSPACE</span>
                    <h2>
                      {activeScenario
                        ? showcaseScenarios.find(
                            (item) => item.id === activeScenario,
                          )?.intent
                        : "Start small. Ask a semantic question."}
                    </h2>
                    <p>
                      {activeScenario
                        ? showcaseScenarios.find(
                            (item) => item.id === activeScenario,
                          )?.rationale
                        : "The same connected data graph can become a distribution, correlation study, relationship map, matrix, or investigation without generated UI code."}
                    </p>
                  </div>
                  <span className="zero-code">
                    0 JSX · 0 CSS · 0 JavaScript generated
                  </span>
                </section>
                <div
                  className="scenario-strip"
                  role="group"
                  aria-label="Showcase scenarios"
                >
                  {showcaseScenarios.map((scenario, index) => (
                    <button
                      key={scenario.id}
                      type="button"
                      aria-pressed={activeScenario === scenario.id}
                      onClick={() => runScenario(scenario.id)}
                    >
                      <span aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {scenario.shortLabel}
                    </button>
                  ))}
                </div>
                <div className="section-title">
                  <h2>
                    {activeScenario
                      ? "Composed semantic workspace"
                      : "Minimal starting workspace"}
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => {
                      direct(resetOverview);
                      setActiveScenario(null);
                    }}
                  >
                    Reset to minimal
                  </button>
                </div>
                <Workspace
                  store={store}
                  instrumentation
                  onRender={proof.render}
                  presentation={dispatcher.presentation}
                  rendererId={playgroundEndpoints.rendererId}
                  onAdaptation={proof.adapt}
                />
                <div className="diagnostics">
                  <span>
                    Prices are USD per million tokens · See source conditions in
                    Detail
                  </span>
                  <button
                    onClick={() =>
                      direct(() =>
                        applyDirect([
                          {
                            type: "configure",
                            id: "baseline",
                            patch: {
                              title:
                                store.getNode("baseline")?.title ===
                                "Average output price"
                                  ? "Snapshot output-price baseline"
                                  : "Average output price",
                            },
                          },
                        ]),
                      )
                    }
                  >
                    Test isolated update
                  </button>
                </div>
              </>
            ) : tab === "Primitives" ? (
              <>
                <div className="section-title">
                  <h2>Explicit primitives · no agent required</h2>
                </div>
                <div className="direct-grid">
                  <Ranking store={demoStore} node={explicit} />
                  <Scatter store={demoStore} node={explicitScatter} />
                </div>
              </>
            ) : tab === "Documentation" ? (
              <Suspense fallback={<p role="status">Loading documentation…</p>}><Documentation /></Suspense>
            ) : tab === "Explorer" ? (
              <>
                <div className="section-title">
                  <h2>Explore the model snapshot</h2>
                </div>
                <Explorer store={demoStore} node={explorer} />
              </>
            ) : (
              <ProofLab />
            )}
          </section>
          <section className="protocol-panel">
            <div className="section-title">
              <h2>Protocol control</h2>
              <span className="sandbox">Same four capabilities</span>
            </div>
            <div className="protocol-status">
              <p>
                <strong>MCP</strong>
                <span>
                  {mcp === "connected"
                    ? companion
                      ? `Connected · ${companion.workspaceId} · ${companion.rendererId ?? "renderer pending"}`
                      : "Connected to this workspace"
                    : "Start an MCP client or companion"}
                </span>
              </p>
              <p>
                <strong>BYOK · OpenAI</strong>
                <span>
                  {companion
                    ? companion.providerConfigured
                      ? `Configured · ${companion.model}`
                      : "Key not configured · live proof unavailable"
                    : "Companion offline"}
                </span>
              </p>
              <p>
                <strong>WebMCP support: experimental</strong>
                <span>{webmcp}</span>
              </p>
            </div>
            <form onSubmit={(event) => void askProvider(event)}>
              <label htmlFor="intent">Ask your configured provider</label>
              <div className="command-row">
                <input
                  id="intent"
                  value={intent}
                  maxLength={2000}
                  onChange={(event) => setIntent(event.target.value)}
                  disabled={busy}
                />
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !companion?.providerConfigured ||
                    mcp !== "connected"
                  }
                >
                  {busy ? "Reasoning…" : "Run with BYOK"}
                </button>
              </div>
              <p>
                Keys stay in the companion environment. Direct components and
                workspace operations work without an agent.
              </p>
            </form>
          </section>
          <p className="notice" role="status">
            {notice}
          </p>
          <footer>
            <span>
              <b>aeliqo</b> / Public framework release candidate
            </span>
            <span>
              Curated sources · Application-owned data · No live ingestion
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Playground initialTab={window.location.pathname.includes("proof-lab") ? "Proof Lab" : "Showcase"} />
  </React.StrictMode>,
);

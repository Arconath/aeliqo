---
id: "knowledge-example"
path: "/examples/knowledge/"
section: "Examples"
title: "Knowledge example"
description: "Search content, read an article, navigate between results, and render a consumer-owned custom presentation."
---

<p class="lead">Knowledge proves extension outside tables, cards, and analytics. The application registers a content-oriented custom intent and view; no core package is edited.</p>
<h2>Journeys</h2><div class="doc-checklist"><ul><li>Search article title and summary using a browse intent.</li><li>Open a single-column reading layout with host-owned navigation.</li><li>Use a namespaced custom intent compiled into the normal Task contract.</li><li>Render a trusted custom view with cancellation and disposal.</li><li>Reject duplicate registration, unknown import paths, and state transfer that would lose context.</li></ul></div>
<h2>Run the complete starter</h2><ol class="doc-steps"><li><span>1</span><div><h3>Create the files below</h3><p>Every required file is included. There is no undocumented helper or workspace alias.</p></div></li><li><span>2</span><div><h3>Install and start</h3><p>Run <code>pnpm install</code>, then <code>pnpm dev</code>.</p></div></li><li><span>3</span><div><h3>Inspect the result</h3><p>The status changes to <code>renderer-ready</code> and the synthetic records appear through a real Aeliqo Region.</p></div></li></ol>
<h2>What you own</h2><div class="doc-checklist"><ul><li>Replace the synthetic records with your application data adapter.</li><li>Replace the local principal and policy with trusted host authority.</li><li>Keep resource identity and business meaning explicit.</li><li>Dispose the app when the host removes the surface.</li></ul></div>
<h2>Failure and recovery</h2><p>An unknown field or view returns a diagnostic and leaves the last permitted UI intact. A denied authority read does not evaluate data. Fix the contract or trusted policy, then send the intent again; do not bypass validation.</p>
<h2>Inspect the full journey</h2><div class="doc-checklist"><ul><li>Run Guided demo to send deterministic intent fixtures through the real runtime.</li><li>Use Manual controls to exercise the same behavior without an agent.</li><li>Open Inspector to see intent, compiled Task, Result descriptor, chosen view, policy reason, and diagnostics.</li><li>Resize the Region—not only the page—to verify equivalent responsive behavior.</li><li>Reset restores the synthetic session and removes local demo writes.</li></ul></div><p><a class="primary" href="/playground/?scenario=knowledge">Run Knowledge in the playground →</a></p>
<h2>Complete source</h2><aeliqo-project data-scenario="knowledge"></aeliqo-project>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/custom-views/"><span>Build an extension</span><small>Register custom view and intent contracts.</small><b aria-hidden="true">→</b></a><a href="/examples/"><span>All examples</span><small>Compare the four domain shapes.</small><b aria-hidden="true">→</b></a></nav>

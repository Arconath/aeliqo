---
id: "people-example"
path: "/examples/people/"
section: "Examples"
title: "People example"
description: "Browse, filter, detail, and trend over a registered People resource with correct temporal meaning."
---

<p class="lead">People demonstrates the familiar table-to-cards adaptation without making dashboards the framework’s identity.</p>
<h2>Registered contract</h2><p>Stable employee identity, readable fields, team dimension, active status, and a versioned absence meaning with explicit period and grain.</p>
<h2>Journeys</h2><div class="doc-checklist"><ul><li>Browse active people and sort by name.</li><li>Filter a team without losing selection identity.</li><li>Open one person in detail and preserve back context on narrow layouts.</li><li>Analyze the registered absence measure by permitted temporal grain.</li><li>Reject a made-up field, invalid aggregate, or unregistered view.</li></ul></div>
<h2>Run the complete starter</h2><ol class="doc-steps"><li><span>1</span><div><h3>Create the files below</h3><p>Every required file is included. There is no undocumented helper or workspace alias.</p></div></li><li><span>2</span><div><h3>Install and start</h3><p>Run <code>pnpm install</code>, then <code>pnpm dev</code>.</p></div></li><li><span>3</span><div><h3>Inspect the result</h3><p>The status changes to <code>renderer-ready</code> and the synthetic records appear through a real Aeliqo Region.</p></div></li></ol>
<h2>What you own</h2><div class="doc-checklist"><ul><li>Replace the synthetic records with your application data adapter.</li><li>Replace the local principal and policy with trusted host authority.</li><li>Keep resource identity and business meaning explicit.</li><li>Dispose the app when the host removes the surface.</li></ul></div>
<h2>Failure and recovery</h2><p>An unknown field or view returns a diagnostic and leaves the last permitted UI intact. A denied authority read does not evaluate data. Fix the contract or trusted policy, then send the intent again; do not bypass validation.</p>
<h2>Inspect the full journey</h2><div class="doc-checklist"><ul><li>Run Guided demo to send deterministic intent fixtures through the real runtime.</li><li>Use Manual controls to exercise the same behavior without an agent.</li><li>Open Inspector to see intent, compiled Task, Result descriptor, chosen view, policy reason, and diagnostics.</li><li>Resize the Region—not only the page—to verify equivalent responsive behavior.</li><li>Reset restores the synthetic session and removes local demo writes.</li></ul></div><p><a class="primary" href="/playground/?scenario=people">Run People in the playground →</a></p>
<h2>Complete source</h2><aeliqo-project data-scenario="people"></aeliqo-project>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/concepts/semantics/"><span>Why the trend is valid</span><small>Understand meaning, period, unit, and grain.</small><b aria-hidden="true">→</b></a><a href="/examples/products/"><span>Products</span><small>Move beyond table-first UI.</small><b aria-hidden="true">→</b></a></nav>

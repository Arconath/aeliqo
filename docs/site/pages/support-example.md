---
id: 'support-example'
path: '/examples/support/'
section: 'Examples'
title: 'Support example'
description: 'Search tickets, inspect details, edit a draft, and move status through a confirmed application action.'
---

<p class="lead">Support demonstrates business UI: records contain untrusted text, but that text cannot expand grants, install code, or trigger a status write.</p>
<h2>Journeys</h2><div class="doc-checklist"><ul><li>Search permitted tickets across registered text fields.</li><li>Open ticket detail while keeping list context.</li><li>Edit nested form values with validation and dirty-draft preservation.</li><li>Preview a status action, require trusted confirmation, and execute with idempotency.</li><li>Show denied, stale entity, failed, and ambiguous write outcomes distinctly.</li></ul></div>
<h2>Run the complete starter</h2><ol class="doc-steps"><li><span>1</span><div><h3>Create the files below</h3><p>Every required file is included. There is no undocumented helper or workspace alias.</p></div></li><li><span>2</span><div><h3>Install and start</h3><p>Run <code>pnpm install</code>, then <code>pnpm dev</code>.</p></div></li><li><span>3</span><div><h3>Inspect the result</h3><p>The status changes to <code>renderer-ready</code> and the synthetic records appear through a real Aeliqo Region.</p></div></li></ol>
<h2>What you own</h2><div class="doc-checklist"><ul><li>Replace the synthetic records with your application data adapter.</li><li>Replace the local principal and policy with trusted host authority.</li><li>Keep resource identity and business meaning explicit.</li><li>Dispose the app when the host removes the surface.</li></ul></div>
<h2>Failure and recovery</h2><p>An unknown field or view returns a diagnostic and leaves the last permitted UI intact. A denied authority read does not evaluate data. Fix the contract or trusted policy, then send the intent again; do not bypass validation.</p>
<h2>Inspect the full journey</h2><div class="doc-checklist"><ul><li>Choose a task in Without AI to send deterministic intents through the real runtime.</li><li>Open Structured intent to review the request shape and send one of the registered requests without an agent.</li><li>Open Inspector to see intent, compiled Task, Result descriptor, chosen view, policy reason, and diagnostics.</li><li>Resize the Region—not only the page—to verify equivalent responsive behavior.</li><li>Reset restores the synthetic session and removes local demo writes.</li></ul></div><p><a class="primary" href="/playground/?scenario=support">Run Support in the playground →</a></p>
<h2>Complete source</h2><aeliqo-project data-scenario="support"></aeliqo-project>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/actions/"><span>Action boundary</span><small>Implement preview, confirmation, execution, and reconciliation.</small><b aria-hidden="true">→</b></a><a href="/examples/knowledge/"><span>Knowledge</span><small>See a custom content presentation.</small><b aria-hidden="true">→</b></a></nav>

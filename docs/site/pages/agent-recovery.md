---
id: "agent-recovery"
path: "/agents/recovery/"
section: "Connect agents"
title: "Agent recovery"
description: "Keep the application understandable when language is ambiguous, the provider fails, the session expires, or an action outcome is uncertain."
---

<h2>Ambiguous intent</h2><p>Return <code>needs-input</code> with bounded choices such as the intended period, resource, or action. Show the proposed filters and target view so the user can inspect the interpretation.</p>
<h2>Provider or transport failure</h2><p>Preserve the last still-authorized UI, explain that the connection failed, and keep manual controls available. Stop repeated failures that provide no new information.</p>
<h2>Expired or revoked pairing</h2><p>Reject the call, cancel in-flight work, clear any now-unauthorized Region data, and require the trusted host to pair again.</p>
<h2>Uncertain write</h2><p>If a remote write may have occurred, display an ambiguous receipt and a host-defined reconciliation action. Never report cancellation as rollback or automatically retry a non-idempotent write.</p>
<h2>Truthful UI copy</h2><div class="doc-checklist"><ul><li>“UI updated” appears only after the matching runtime/renderer receipt.</li><li>Displayed numeric summaries are derived from Result evidence.</li><li>Model prose is not promoted to application fact.</li><li>The inspector shows intent, compiled Task, Result descriptor, selected view, and diagnostics—not chain-of-thought.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/reference/diagnostics/"><span>Diagnostics</span><small>Map outcomes to actionable recovery.</small><b aria-hidden="true">→</b></a><a href="/ship/"><span>Ship checklist</span><small>Verify manual and connected journeys together.</small><b aria-hidden="true">→</b></a></nav>

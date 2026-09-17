---
id: "actions"
path: "/guides/actions/"
section: "Build"
title: "Business actions"
description: "Register schema-validated commands with permission, confirmation, revision, idempotency, and ambiguous-completion handling."
---

<p class="lead">An action is trusted application code behind an Aeliqo boundary. The agent or form may provide bounded JSON input; only the host can confirm and dispatch a registered command.</p>
<h2>Lifecycle</h2><ol class="concept-flow"><li><span>01</span><div><h3>Preview</h3><p>Validate action identity, input schema, permission, entity revision, size, and idempotency policy.</p></div></li><li><span>02</span><div><h3>Confirm</h3><p>The trusted host or user interaction issues confirmation. An agent cannot confirm itself.</p></div></li><li><span>03</span><div><h3>Execute</h3><p>Recheck current authority and revision, then dispatch once through the registered application command.</p></div></li><li><span>04</span><div><h3>Reconcile</h3><p>Show executed, rejected, or ambiguous completion. Cancellation after a remote write is not a rollback.</p></div></li></ol>
<h2>Payloads</h2><p>Inputs and outputs are bounded schema-validated JSON, including nested form groups, repeaters, and multiselect values. Files use host-owned upload references; arbitrary bytes do not travel through an agent argument.</p>
<aside class="doc-callout" data-tone="warning"><strong>Do not auto-retry uncertainty</strong><p>If the remote system may have completed a write, return an ambiguous receipt and provide a reconciliation path. Retrying may duplicate the command.</p></aside>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/forms/"><span>Forms</span><small>Bind create and edit recipes to registered actions.</small><b aria-hidden="true">→</b></a><a href="/agents/quickstart/"><span>Agent actions</span><small>Expose preview and execution through the bounded tool endpoint.</small><b aria-hidden="true">→</b></a></nav>

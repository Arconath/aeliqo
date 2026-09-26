---
id: 'safety'
path: '/concepts/safety/'
section: 'Reference'
title: 'Safety infrastructure'
description: 'Make invalid, stale, unauthorized, and over-budget proposals non-executable while keeping limitations visible.'
---

<p class="lead">Aeliqo’s safety claim is structural: runtime boundaries reject proposals that do not satisfy registered contracts and current authority. It is not a promise that a language model always understands the user.</p>
<h2>Non-bypassable pipeline</h2><ol class="doc-steps"><li><span>1</span><div><h3>Parse</h3><p>Treat every ingress as unknown and validate a bounded intent schema.</p></div></li><li><span>2</span><div><h3>Authorize</h3><p>Read principal, scope, policy, grants, and limits from the trusted host.</p></div></li><li><span>3</span><div><h3>Compile and evaluate</h3><p>Use only registered fields, meanings, functions, operations, and data services.</p></div></li><li><span>4</span><div><h3>Present</h3><p>Select only registered recipes and views compatible with the Result and Experience.</p></div></li><li><span>5</span><div><h3>Recheck and commit</h3><p>Reject stale read sets or revoked authority before replacing the Region.</p></div></li></ol>
<h2>Example: a rejected proposal</h2><p>An agent or any caller cannot smuggle authority or markup inside an intent. The schema allows only the declared envelope fields, so this request fails during parsing—before any data is read:</p>

**Rejected intent**

```json
{
  "version": "1",
  "id": "show-everything",
  "kind": "browse",
  "resource": "people",
  "principal": "admin",
  "html": "<script>…</script>"
}
```

<p>The caller receives a bounded <code>wire.unrecognized_keys</code> diagnostic naming the undeclared fields; the previous committed view stays in place.</p>
<h2>Always rejected</h2><div class="doc-checklist"><ul><li>Unknown resource, field, action, view, meaning, or function.</li><li>Principal, grants, credentials, executable code, HTML, JavaScript, SQL, network endpoint, or import path from an agent.</li><li>Cross-session or cross-Region invocation.</li><li>Stale Catalog, Result, source, policy, entity, or presentation revision.</li><li>Payload or loop that exceeds configured limits.</li><li>Agent-created confirmation for a protected action.</li></ul></div>
<h2>Data egress</h2><p>Context discovery sends only allowed metadata by default. Records or detailed Results leave the application for a model only when a separate host egress policy allows it. Prompt injection inside records cannot add grants or install code.</p>
<h2>Truth boundary</h2><p>“Renderer ready” means the runtime evidence committed and the renderer accepted the plan. It does not prove pixels were painted or the user noticed them. Numeric claims shown by the app come from Result evidence; arbitrary model prose remains prose.</p>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/agents/recovery/"><span>Agent recovery</span><small>Turn failures and ambiguity into understandable user choices.</small><b aria-hidden="true">→</b></a><a href="/reference/diagnostics/"><span>Diagnostics</span><small>Map stable codes to recovery.</small><b aria-hidden="true">→</b></a></nav>

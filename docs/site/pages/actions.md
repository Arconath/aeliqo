---
id: 'actions'
path: '/guides/actions/'
section: 'Build'
title: 'Business actions'
description: 'Register schema-validated commands with permission, confirmation, revision, idempotency, and ambiguous-completion handling.'
---

<p class="lead">An action is trusted application code behind an Aeliqo boundary. The agent or form may provide bounded JSON input; only the host can confirm and dispatch a registered command.</p>
<h2>Lifecycle</h2><ol class="concept-flow"><li><span>01</span><div><h3>Preview</h3><p>Validate action identity, input schema, permission, entity revision, size, and idempotency policy.</p></div></li><li><span>02</span><div><h3>Confirm</h3><p>The trusted host or user interaction issues confirmation. An agent cannot confirm itself.</p></div></li><li><span>03</span><div><h3>Execute</h3><p>Recheck current authority and revision, then dispatch once through the registered application command.</p></div></li><li><span>04</span><div><h3>Reconcile</h3><p>Show executed, rejected, or ambiguous completion. Cancellation after a remote write is not a rollback.</p></div></li></ol>
<h2>Register an action</h2><p>The host registers each command with a versioned descriptor, schema-checked input and output, and a dispatch function that only the runtime boundary can call:</p>

**actions.ts**

```ts
import { ActionRegistry } from '@aeliqo/runtime/actions';
import { z } from 'zod';

const input = z.object({ ticketId: z.string(), status: z.enum(['open', 'resolved']) });
const output = z.object({ ticketId: z.string(), revision: z.string() });

export const actions = new ActionRegistry();
actions.register({
  descriptor: {
    ref: { id: 'support.set-status', revision: '1' },
    input: { id: 'support.set-status-input', revision: '1' },
    output: { id: 'support.set-status-output', revision: '1' },
    sideEffect: 'domain-write',
    confirmation: 'required', // a trusted host or user confirms; an agent cannot
    idempotency: 'required', // retries carry one stable key
    entityRevision: 'required', // refuse to write over a stale ticket
  },
  inputSchema: {
    ref: { id: 'support.set-status-input', revision: '1' },
    parse: (value) => {
      const parsed = input.safeParse(value);
      return parsed.success
        ? { ok: true, value: parsed.data }
        : {
            ok: false,
            diagnostics: [
              { code: 'support.set-status.input', message: 'The status update input is invalid.', retryable: false },
            ],
          };
    },
  },
  outputSchema: {
    ref: { id: 'support.set-status-output', revision: '1' },
    // A completed dispatch returns an Outcome; validate its payload the same way.
    parse: (value) => {
      const parsed = z.object({ ok: z.literal(true), value: output }).safeParse(value);
      return parsed.success
        ? { ok: true, value: parsed.data }
        : {
            ok: false,
            diagnostics: [
              { code: 'support.set-status.output', message: 'The status update output is invalid.', retryable: false },
            ],
          };
    },
  },
  dispatch: ({ input: proposal, context, idempotencyKey, signal }) =>
    tickets.setStatus(proposal, { context, idempotencyKey, signal }), // completed, rejected, or ambiguous
});
```

<p><code>tickets.setStatus</code> is ordinary application code on a real backend. An agent or form can only propose bounded input; the registered dispatch performs the effect.</p>
<h2>Payloads</h2><p>Inputs and outputs are bounded schema-validated JSON, including nested form groups, repeaters, and multiselect values. Files use host-owned upload references; arbitrary bytes do not travel through an agent argument.</p>
<aside class="doc-callout" data-tone="warning"><strong>Do not auto-retry uncertainty</strong><p>If the remote system may have completed a write, return an ambiguous receipt and provide a reconciliation path. Retrying may duplicate the command.</p></aside>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/forms/"><span>Forms</span><small>Bind create and edit recipes to registered actions.</small><b aria-hidden="true">→</b></a><a href="/agents/quickstart/"><span>Agent actions</span><small>Expose preview and execution through the bounded tool endpoint.</small><b aria-hidden="true">→</b></a></nav>

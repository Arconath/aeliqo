# Runtime presentation adaptation

Import the opt-in adapter from `@aeliqo/sdk-web/region/adaptation` and install
`@aeliqo/sdk-runtime` explicitly. Ordinary web primitives do not require runtime.
The lower-level controller is `@aeliqo/sdk-runtime/presentation`.

Provide a RegionHandle, the canonical presentation registry, and host context
containing the Experience, authorized Result descriptors and renderer
capabilities. `readContext`, when present, replaces the base context completely.
Task, incumbent and current revisions always come from the region snapshot.
Optional `candidates` are ordinary core composition proposals; explicit and
registered pattern candidates pass the same validation as generated candidates.

The web adapter measures the region and guards focused editors (including nested
shadow roots), IME and active pointers. The application can add a live dirty-draft
or drag guard. Resize requests coalesce, small deltas accumulate from the last
applied environment, and text-scale changes are re-evaluated. Routine adaptation
has no model dependency. Applications provide honest keyboard facts where known;
the default measurement keeps unknown keyboard availability explicit.

Composition and staging finish before visible application. The final synchronous
commit recheck gives the renderer the exact prospective revisions. Failed commits
roll back; revocation clears the surface and invalidates old prepared rollbacks.
The default web adapter clears the region. A custom callback renderer that writes
visible/private content must provide its own `clear` callback; omitting it is only
appropriate for headless instrumentation. Generic callbacks cannot prove browser
paint, host navigation execution or assistive-technology behavior.

Interaction and navigation transfer require declared ownership and matching port
semantics. Domain drafts remain keyed independently of layout. A live guard may
defer a candidate; ending the interaction retries the newest measurement.
Disconnect disposes subscriptions and queued work.

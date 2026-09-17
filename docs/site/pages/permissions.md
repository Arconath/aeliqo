---
id: "permissions"
path: "/guides/permissions/"
section: "Build"
title: "Permissions and authority"
description: "Provide one trusted host adapter for principal, scope, policy revision, grants, and query context."
---

<p class="lead">Authority is read from the host immediately before evaluation, presentation commit, and action execution. It is never accepted from an intent.</p>
<h2>Adapter</h2>

**authority.ts**

```ts
const authority = {
  read: ({resourceId, regionId, effect, signal}) => {
    const session = currentAuthenticatedSession();
    return session.canUse(resourceId, effect)
      ? {ok: true, value: {
          principalKey: session.principalKey,
          scopeDigest: session.scopeDigest,
          policyRevision: session.policyRevision,
          experienceRevision: 'web-1',
          grants: session.aeliqoGrants,
          readContext: {principal: session.principalKey},
        }}
      : denied(resourceId, regionId);
  },
};
```


<h2>Revocation behavior</h2><p>If principal, scope, or policy changes while work is running, the commit fails stale. When access is removed, unmount or rerender the Region so previously visible unauthorized data is cleared.</p>
<h2>Server remains final</h2><p>Browser checks improve UX and contain agent capability. They are not a substitute for authenticated server authorization on remote reads or business actions.</p>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/concepts/safety/"><span>Safety infrastructure</span><small>See the checks that make invalid proposals non-executable.</small><b aria-hidden="true">→</b></a><a href="/guides/actions/"><span>Business actions</span><small>Apply the same authority model to writes.</small><b aria-hidden="true">→</b></a></nav>

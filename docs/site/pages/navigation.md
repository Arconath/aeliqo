---
id: "navigation"
path: "/guides/navigation/"
section: "Guides"
title: "Navigation"
description: "Keep the host router in control while Aeliqo preserves selection and back context across adaptive views."
---

<p class="lead">Navigation is a host adapter, not a universal workflow engine. Aeliqo can request a registered route transition; the application owns URL policy, guards, history, and loading.</p>
<h2>Recommended mapping</h2>

**navigation.ts**

```ts
const navigation = {
  open: ({resourceId, identity}) => router.push(resourceRoute(resourceId, identity)),
  back: () => router.back(),
};
```


<h2>Preserve context</h2><p>A wide master-detail view may become list then detail on a narrow container. The selected identity, filter, scroll context, and a discoverable Back action must survive that change.</p>
<div class="doc-checklist"><ul><li>Back/forward restores the equivalent Region state.</li><li>Unknown or unauthorized destinations are rejected by the host.</li><li>A route change cancels obsolete evaluation and renderer loading.</li><li>Focus moves to the new page or detail heading and returns predictably.</li></ul></div>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/responsive-behavior/"><span>Responsive behavior</span><small>See the default cross-container policy.</small><b aria-hidden="true">→</b></a><a href="/concepts/state-ownership/"><span>Selection ownership</span><small>Understand which state transfers between views.</small><b aria-hidden="true">→</b></a></nav>

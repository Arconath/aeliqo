---
id: 'responsive'
path: '/guides/responsive-behavior/'
section: 'Build'
title: 'Responsive behavior'
description: 'Adapt registered views from container conditions without another model call or silent information loss.'
---

<p class="lead">The default policy considers the task, semantics, allowed recipes, and Region container—not only viewport or user agent.</p>
<h2>Default behavior</h2><div class="doc-table"><table><thead><tr><th>Need</th><th>Wide</th><th>Narrow</th></tr></thead><tbody><tr><th>Browse</th><td>Table or grid</td><td>Cards or list</td></tr><tr><th>Detail</th><td>Master-detail when valid</td><td>Detail with back context</td></tr><tr><th>Create/edit</th><td>Grouped form</td><td>Stacked form or wizard</td></tr><tr><th>Compare</th><td>Bounded split pane when two identities are requested</td><td>Equivalent comparison</td></tr><tr><th>Analyze</th><td>Bar or trend plus exact values</td><td>Compact chart plus exact values</td></tr><tr><th>Content</th><td>Reading layout with navigation</td><td>Single-column reading layout</td></tr></tbody></table></div>
<aside class="doc-callout" data-tone="note"><strong>Table does not always become cards</strong><p>If simultaneous column comparison is essential, an accessible horizontally scrollable table may be the correct narrow view. The task contract wins over a cosmetic breakpoint.</p></aside>
<h2>Transition guards</h2><p>Adaptation coalesces resize signals and waits through active typing, IME composition, drag, and dirty draft transitions. If no equivalent allowed view exists, it keeps the current valid presentation.</p>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/adaptive-region/"><span>Adaptive Region</span><small>Use the lifecycle and inspect selected recipes.</small><b aria-hidden="true">→</b></a><a href="/guides/custom-views/"><span>Custom views</span><small>Add a domain-specific renderer without changing core.</small><b aria-hidden="true">→</b></a></nav>

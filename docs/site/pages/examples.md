---
id: 'examples'
path: '/examples/'
section: 'Examples'
title: 'Runnable examples'
description: 'Run four synthetic applications and the public 0.5 People, attendance, and workspace journeys.'
---

<p class="lead">The public Playground runs four synthetic scenarios and the 0.5 Jakarta, attendance, and workspace journeys. Each uses registered resources, meanings, views, and application-owned data.</p>
<aeliqo-release-status></aeliqo-release-status>
<h2>Run the 0.5 source</h2>
<p>Use a checkout of the exact 0.5 source revision used to build the Playground. From that checkout, install the locked dependencies and run the source fixtures:</p>

```sh
pnpm install --frozen-lockfile
pnpm test:vnext:browser
pnpm --dir apps/site dev
```

<p>The first command installs this repository's workspace dependencies. The browser suite runs the synthetic People, attendance, and workspace fixtures. The final command serves the public Playground locally; open the URL printed by Vite and choose one of its 0.5 journeys. The stable site offers downloadable starter ZIPs for the four base scenarios—People, Products, Support, and Knowledge—only after the matching 0.5 packages pass a registry install and build check. The Jakarta, attendance, and workspace journeys use the matching source fixtures instead of those starter ZIPs. See the <a href="https://github.com/Arconath/aeliqo/tree/main/examples/vnext">source fixture directory</a> and the <a href="/start/">package quickstart</a>.</p>
<div class="decision-grid"><article><h3>People</h3><p>Browse, filter, detail, and analyze a temporal meaning. Table becomes cards only when task semantics permit.</p><a href="/examples/people/">Open example →</a></article><article><h3>Products</h3><p>Grid or list, detail, comparison, and a product form.</p><a href="/examples/products/">Open example →</a></article><article><h3>Support</h3><p>Search, ticket detail, edit draft, status action, confirmation, and recovery.</p><a href="/examples/support/">Open example →</a></article><article><h3>Knowledge</h3><p>Content search, article reading, navigation, and a consumer-owned custom view and intent.</p><a href="/examples/knowledge/">Open example →</a></article></div>
<h2>0.5 reference journeys</h2>
<p>The maintained <code>examples/vnext/journeys</code> fixture exercises four intentionally small integration classes: public static content with an optional island, catalog comparison through manual and deterministic host-fixture paths, independently mounted remote windows with a host approval, and a non-data document job. It imports public package entries, keeps all records synthetic, and does not make a model request.</p>
<p>The fixture-agent comparison is deterministic parity coverage for the same typed intent; it uses the scoped bridge with a fake model response and a renderer receipt, not a provider evaluation or a claim of user research. The enterprise transport evidence is a companion test against the repository's HTTP DataService fixture, including two authenticated, independent partial windows. The separate <code>examples/vnext/host-only</code> fixture implements the same synthetic Jakarta people-filter task without Aeliqo; the browser test checks the visible rows and committed filter label in both fixtures. This is one executable host-only baseline, not a developer study or measured integration-time saving.</p>
<p>Additional development fixtures exercise the 0.5 product journeys. <code>examples/vnext</code> shows a committed Jakarta filter and allows eligible wide and narrow browse views. A scoped fake-model test proposes the same Jakarta filter on the same authorized target; it is not a live provider evaluation. <code>examples/vnext/attendance</code> renders approved daily attendance as a trend with a visible period, timezone, denominator, missing-date coverage, and metric clarification. <code>examples/vnext/workspace-goal</code> compiles one registered three-need attendance goal, evaluates three Results, discovers the registered pattern from an empty candidate list, commits the plan, and renders summary, trend, and breakdown in one Region; its browser tests cover unknown-goal and mandatory breakdown failure retention. The separate <code>examples/vnext/workspace</code> fixture covers stable child focus and 360/768/1440 reflow. A live model is not demonstrated by these fixtures.</p>
<aside class="doc-callout" data-tone="note"><strong>Synthetic by design</strong><p>Public demo data contains no customer records. Demo writes live only in the local session and can be reset.</p></aside>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/playground/"><span>Open playground</span><small>Run four scenarios and the three 0.5 journeys in one interface.</small><b aria-hidden="true">→</b></a><a href="/start/"><span>Build your own</span><small>Run a small local React example, then connect a registered app when you need host-owned data.</small><b aria-hidden="true">→</b></a></nav>

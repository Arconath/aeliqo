---
id: 'home'
path: '/'
section: 'Get started'
title: 'Build your first adaptive interface'
description: 'Define one resource, render a validated intent, and let Aeliqo select the right registered view without giving up application control.'
---

<section class="docs-landing-hero"><div><p class="docs-steps-label">Start here</p><p class="lead">Aeliqo is a TypeScript framework that renders UI from typed requests. You register your data and its views once. Each request then returns a validated view that fits its container. An AI agent is optional.</p><div class="docs-landing-actions"><a class="primary" href="/start/">Run the quickstart <span aria-hidden="true">→</span></a><a href="/playground/">See it in the playground</a></div></div><dl class="docs-facts"><div><dt>01</dt><dd>Describe your data</dd></div><div><dt>02</dt><dd>Send a request</dd></div><div><dt>03</dt><dd>Get a view</dd></div></dl></section>
<aside class="doc-callout" data-tone="boundary"><strong>The agent boundary in one sentence</strong><p>An agent can only send the same typed requests you can. It cannot supply HTML, JavaScript, SQL, credentials, or an unregistered view.</p></aside>
<h2>Choose your starting point</h2>
<div class="decision-grid"><article><h3>Run something in 10 minutes</h3><p>Render a real adaptive table in React with local data. No account, model key, or backend.</p><a href="/start/">Start the quickstart →</a></article><article><h3>Connect your own data</h3><p>Register resources, read permissions from your app, and add forms and actions.</p><a href="/start/registered-app/">Follow the tutorial →</a></article><article><h3>Add it to an existing app</h3><p>Keep your backend, router, state, and design system. Adopt one region at a time.</p><a href="/start/existing-app/">See the path →</a></article><article><h3>Connect an agent</h3><p>Expose bounded tools through MCP or your own model. The same request contract applies.</p><a href="/agents/quickstart/">Connect safely →</a></article></div>
<h2>How a request becomes UI</h2>
<p>Every request moves through the same four stages. Your code and an agent take the same path.</p>
<ol class="concept-flow"><li><span>01</span><div><h3>Request</h3><p>Your code or an agent asks to browse, inspect, compare, analyze, create, or edit a registered resource.</p></div></li><li><span>02</span><div><h3>Check</h3><p>Aeliqo validates the request against your resources and rechecks the signed-in user's permissions.</p></div></li><li><span>03</span><div><h3>Evaluate</h3><p>Your data adapter returns bounded rows with identity, scope, and revision evidence.</p></div></li><li><span>04</span><div><h3>Render</h3><p>Aeliqo picks a registered view for the task and container. It commits to an adaptive region (a mounted view slot).</p></div></li></ol>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/start/what-is-aeliqo/"><span>What is Aeliqo?</span><small>Understand the framework boundary before writing code.</small><b aria-hidden="true">→</b></a><a href="/start/"><span>Quickstart</span><small>Run a real adaptive region without an agent.</small><b aria-hidden="true">→</b></a></nav>

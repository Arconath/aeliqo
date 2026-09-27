---
id: 'home'
path: '/'
section: 'Get started'
title: 'Build interfaces that adapt to the task'
description: 'Aeliqo turns typed requests into views of your application data, using the components, permissions, and layouts you register.'
---

<section class="docs-landing-hero"><div><p class="docs-steps-label">Aeliqo documentation</p><p class="lead">Describe your data once, then ask for what you want to see. “Show everyone” becomes a table, or cards on a phone. “How many people joined each month?” becomes a line chart. The request can come from a button, your code, or an optional AI agent. Your application keeps control of the records, permissions, and business actions.</p><div class="docs-landing-actions"><a class="primary" href="/start/">Ask your first questions <span aria-hidden="true">→</span></a><a href="/playground/">Try the playground</a></div></div><dl class="docs-facts"><div><dt>01</dt><dd>Provide data</dd></div><div><dt>02</dt><dd>Request a task</dd></div><div><dt>03</dt><dd>Render an allowed view</dd></div></dl></section>

Read [What is Aeliqo?](/start/what-is-aeliqo/) for the main concepts and ownership boundaries.

## Start with one useful result

The [React quickstart](/start/) describes five local People records once, then
asks four questions about them: everyone, one team, hires per month, and hires
per team. Aeliqo answers with a table, a filtered table, a line chart, and a bar
chart, without any table or chart markup from you. You need Node.js 24; no
account, backend, or model key is needed.

After that first view, follow the steps in order:

1. [Connect your data](/start/registered-app/): define resource fields and
   identity, provide a data service, and render typed requests in a named region.
2. [Add an agent](/agents/quickstart/): expose a working surface through a
   bounded tool endpoint. Manual controls keep working alongside it.
3. [Compose a workspace](/guides/workspace/): coordinate multiple results and
   register application layouts once one region is working.

## When to use Aeliqo

Use it for data interfaces where the same records need different presentations:
lists and details, comparisons, forms, dashboards, or workspaces controlled by
application intent. It also supplies [standalone components](/start/standalone-components/)
when your screen already owns its interaction state.

A fixed marketing page or a one-off illustration usually needs authored HTML
and CSS. Aeliqo becomes useful when validation, data identity, view selection,
and state preservation are recurring application work.

## What your application registers

A resource describes the data and its meaning. A data adapter reads it. Your
application supplies current authority and allowed actions. Registered views
and recipes define how approved results appear. An adaptive region is the
container where a result is mounted.

Every request passes through validation, authorization, bounded data evaluation,
and rendering. An agent submits the same kind of request as application code;
it cannot supply executable UI or grant itself access. Your server still
checks real data access and business effects.

## Find the right guide

<div class="decision-grid"><article><h3>Adopt one screen</h3><p>Integrate with your existing data, router, and lifecycle.</p><a href="/start/existing-app/">Existing applications →</a></article><article><h3>Choose your framework</h3><p>Use React, Vanilla, or Vue, with an explicit Next.js server rendering path.</p><a href="/start/frameworks/">Framework setup →</a></article><article><h3>Choose a component</h3><p>Inspect runnable examples, generated API facts, and interaction behavior.</p><a href="/components/">Component catalog →</a></article><article><h3>Go deeper</h3><p>Connect remote data, extend views, manage scopes, or prepare for production.</p><a href="/advanced/">Advanced guides →</a></article></div>

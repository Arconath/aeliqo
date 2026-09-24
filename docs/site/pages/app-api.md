---
id: "app-api"
path: "/reference/app-api/"
section: "Reference"
title: "Application API"
description: "Lifecycle, ownership, outcomes, and extension points for the Aeliqo 0.5.0 application facade."
---

Import the application facade from `@aeliqo/web/app`. This entry point uses
`@aeliqo/runtime`; component-only consumers can import the web package root.
<aeliqo-release-status></aeliqo-release-status>

This page follows the 0.5.0 source and its exact package version.

<h2>createAeliqoApp</h2>

**Signature**

```ts
createAeliqoApp(options: AeliqoAppOptions): AeliqoApp
```

<p><strong>Required:</strong> a resources array with at least one resource/data binding, plus an authority adapter. <strong>Optional:</strong> runtime ID, custom intents, action port, result store and result-store options, region/render limits, recipes, views, form-state adapter, and an action-event callback. Standard recipes are used when no recipes are supplied.</p>
<h2>mount</h2>

**Signature**

```ts
app.mount({target, regionId, resourceId}): Outcome<AeliqoRegionElement>
```

<p>Creates one Region and begins container observation. Region IDs are unique within the app. Mount does not fetch data until <code>render</code>.</p>
<h2>render</h2>

**Signature**

```ts
await app.render({regionId, intent, signal?}): Promise<WebRenderReceipt>
```

<p>Parses unknown input, reads current authority, compiles, evaluates, selects a recipe, validates state transfer, commits, and returns a typed receipt. A newer request in the same Region supersedes an older one.</p>
<h2>subscribe and snapshot</h2>

**Signatures**

```ts
app.subscribe(regionId, listener): () => void
app.snapshot(regionId): RuntimeRegionState | undefined
```

<p>Subscribers receive sanitized lifecycle state, Result references, and diagnostics—not materialized rows. Subscription is safe before the Region child lifecycle completes.</p>
<h2>unmount and dispose</h2>

**Signatures**

```ts
app.unmount(regionId): boolean
app.dispose(): void
```

<p>Unmount cancels and releases one Region. Dispose is idempotent and releases every Region, listener, pending render, Result handle, and owned observer. Calls after disposal fail closed.</p>
<h2>Receipts</h2><p><code>renderer-ready</code>, <code>needs-input</code>, <code>denied</code>, <code>cancelled</code>, <code>unsupported</code>, and <code>failed</code> are distinct. Presentation failures retain the already-committed runtime evidence for inspection while the previous valid UI is restored.</p>
<h2>Source declarations</h2><aeliqo-source data-label="AeliqoApp types" data-path="packages/web/src/app/types.ts"></aeliqo-source>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/reference/intent-schema/"><span>Intent schema</span><small>Build valid render inputs.</small><b aria-hidden="true">→</b></a><a href="/reference/diagnostics/"><span>Diagnostics</span><small>Handle failure and recovery consistently.</small><b aria-hidden="true">→</b></a></nav>

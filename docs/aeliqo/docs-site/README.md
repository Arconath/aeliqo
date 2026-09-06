# Documentation site delivery pack

These files are authored page briefs and seed copy, not a rendered website. Reconcile the existing docs app first. Treat current package names/API snippets as proposals until confirmed against the PoC. Preserve a healthy framework; use a static-first system only if needed. Reference design direction is in the parent docs-site UX chapter.

Build four representative pages first: [Start](start.md), [Comparison](comparison.md), [Money and units](money-and-units.md), and [Agent setup](agents.md). Each gets a real routed page, checked navigation, a narrow-screen layout, and runnable source examples where available. The API/docs should be generated from actual code, not from this page brief alone.

Ship navigation in this order: Start, Components, Visuals, Workspace, Data, Integrations, Recipes, Reference. Add search synonyms and deep anchors. Use a readable article width, restrained navigation, one primary demo and progressively disclosed advanced controls. Do not convert every section into a card or place a large hero above the first usable example.

## Acceptance route

An independent engineer opens Start, renders a standalone component, reads Comparison, binds typed data, then finds the exact explanation of currency conversion versus formatting. Agent setup shows the explicit difference between local development instructions and end-user MCP integration. They can identify stable/experimental and OSS/Pro without opening pricing pages. Record what was confusing and improve the actual navigation/copy.

No simulated live agent is labeled live. No empty “coming soon” component reference is indexed as stable. No model key is stored by the demo browser. No documentation page loads the whole visualization library just to show API text.

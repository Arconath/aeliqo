# Aeliqo public site

The static 0.1.0 rewrite site belongs to this product repository. It uses the
built Aeliqo packages and locked Vite toolchain. Deployment remains the explicit
release/GHCR/GitOps path; this package does not deploy itself.

Home has an executable, manually filtered record-list example. Documentation,
blog, and content pages are static HTML. Each of the 71 component routes mounts
its real example and includes public declarations plus inherited property
initializers read by the locked TypeScript parser. Class-specific parts and
referenced tokens are reported without running component constructors at build
time. The compiler parser API is experimental and pinned to TypeScript 7.0.2.

The playground lazy-loads the real local evaluator, Result store, typed meaning
authoring, cohort resolver, and presentation validator. Its synthetic workflows
cover employees, filtering, absence totals, frozen-cohort trends, two named
period outputs, contributor records, and product comparison/detail/local forms.
The Task editor uses the same generic evaluator. Failures retain the authorized
view; panels preserve local drafts. Provider modes are unpaired/unconfigured
and do not claim live model reasoning. No credential entry or model backend is
included in this static demo.

Run `pnpm build:site` before serving `apps/site/dist`. `pnpm test:site` covers
arithmetic, lineage, task rejection, and strict types. `pnpm test:site:browser`
checks flows, all 71 mounted routes, search, themes, panels, and 404 behavior.
Generated route sources live under `artifacts/site-source`; they are build
output, not checked-in source. Configure the production static server to return
`404.html` with status 404 for unknown routes, and cache HTML separately from
hashed assets. T27's complete copy-source/installed-example evidence and the
release device, performance, and manual accessibility matrix remain pending.

`public/aeliqo.png` is an unchanged copy of the workspace's canonical
`assets/logo/aeliqo.png`. Product builds do not reach into the parent workspace.
The same asset supplies the visible brand and favicon. No visitor analytics or
provider credential is included.

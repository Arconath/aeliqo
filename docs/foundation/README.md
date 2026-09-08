# Foundation components

The foundation family is the direct, framework-free web surface for Aeliqo. Each
element is a Lit custom element with an open shadow root, native semantic markup,
documented parts, and no Region, planner, chart, provider or model dependency.

Import and register the individual elements in a host application. Registration
belongs to the application because importing a leaf must not mutate the global
custom-element registry. The parent package integrates these constructors into
the shared registry; the standalone tests define them locally to prove that the
same implementation works outside a region.

Actions dispatch cancelable `aeliqo-action` proposals with `source: "user"` and
an explicit action kind. A host may call `preventDefault()` while validating or
authorizing the registered action reference. `Button` and `IconButton` expose
native `button` semantics, form association, submit/reset behavior, disabled and
pending latching, and stable named parts. `Link` accepts a host-resolved href
only at the direct API boundary; manifest configuration carries registered
`routeRef` and `contentRef` values, never an arbitrary URL or module reference.

`SplitPane` is controlled when `position` is supplied and otherwise keeps a
bounded local position from `defaultPosition`. Pointer movement and
Arrow/Home/End keyboard input emit typed `aeliqo-split-change` proposals. The
splitter exposes separator value semantics, respects minimum and maximum bounds,
and accounts for RTL horizontal direction.

Text, heading, badge, avatar, separator, surface, stack, grid and scroll area
remain data-free primitives. Text is interpolated through Lit as text; Avatar
uses initials and a generic accessible name when identity data is absent, and
network images are limited to HTTP(S) with a local fallback.

The versioned `manifest.ts` metadata is an integration boundary for the parent
registry. Its validator accepts only bounded typed configuration and host
registered references (`actionRef`, `routeRef`, `contentRef`, `identityRef`),
rejecting executable callbacks, actor/approval claims, arbitrary URLs and
module paths. It does not resolve business actions or invent source capability.

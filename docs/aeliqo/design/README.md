# Design-token candidate

`tokens.css` is an opt-in reference for implementing the visual system after the PoC audit. It is not imported automatically and does not alter the app through this installer. Reconcile existing tokens and component styles instead of keeping two parallel theme systems. CSS variables alone do not make inaccessible markup accessible.

All tokens are scoped to `[data-aeliqo-root]`; no host reset, font download or global `body` selector. Use documented semantic tokens in component styles, not arbitrary agent CSS. Typography uses system stacks; supply licensed fonts through the host only when appropriate. Choose one neutral surface hierarchy and a restrained accent. Density changes spacing within accessible target rules, not precision or data meaning.

Contrast must be verified for actual adjacent colors, text sizes, focus states, chart marks, overlays and disabled states. This file's candidate values are not a completed WCAG audit. Data charts need redundant shapes/labels and a sequential/diverging palette appropriate to data; a single accent does not define a complete chart palette.

Motion timing/easing is a baseline, not a requirement to animate every change. Use transform/opacity selectively; layout/Canvas work still needs profiling. Respect reduced-motion and user pin preferences. Forced-colors mode must be tested in the real component tree; don't remove browser adjustments globally.

# 13 — CSS, tokens, visual design, and motion

## Design direction

A calm, precise data application: clear typography, modest radii, restrained borders, meaningful color and ample but efficient spacing. No decorative dashboard clutter, mandatory gradients, oversized empty cards, emoji controls or animated particles. Density is configurable; compact does not mean illegible. Charts and tables share typography, color semantics and focus treatment with ordinary controls.

## Styling contract

Use semantic CSS custom properties with a stable `--aeliqo-*` namespace: surface/text/border/accent/status colors, font roles, spacing, radius, elevation, density, motion and chart palette. Public tokens are an API with versioning. Component-level tokens inherit semantic tokens but can be overridden locally. Do not expose hundreds of incidental implementation variables as permanent API.

Use optional CSS layers for reset/base/components/utilities and document the cascade order. A global reset is opt-in; importing a Metric must not restyle the host page. Prefer low-specificity selectors and stable data attributes/named parts. Avoid dependence on Tailwind or runtime CSS-in-JS. Consumer may use either without rewriting the component.

Theme scope must work at document root and nested boundaries. Portalled overlays need the correct theme/locale/direction and stacking context; test nested themes and dialogs. Avoid global CSS name collisions, broad element selectors, unsafe agent CSS strings, or `!important` escalation. Agent styling is through approved variants/tokens, not arbitrary CSS injection.

## Layout primitives

CSS Grid/Flex handle ordinary layout. Size container queries provide component responsiveness without binding behavior to viewport alone. JavaScript measurement is reserved for visual geometry and semantic adaptation requiring it; batch reads/writes and clean up ResizeObserver. Container containment affects size/overflow behavior and must be tested around popovers, sticky headers and focus rings. [R13]

Use logical properties for RTL/writing direction. Avoid fixed widths that clip translated text, number labels, currency signs or error messages. Data areas can overflow horizontally when appropriate, with discoverable access; the entire documentation page must not become a sideways scroll trap.

## Tokens starter

See `design/tokens.css` for a candidate token palette/spacing/motion contract. It is a reference asset, not an audited drop-in theme. Validate contrast for each actual foreground/background/state combination after integration. Semantic colors need icons/text or pattern cues, never color alone. Forced-colors mode uses system color behavior rather than hardcoded low-contrast chart surfaces.

## Motion budget

Candidate timings: micro feedback 80–120 ms, local surface 140–180 ms, deliberate layout change at most 220 ms. Use transform/opacity where valid, but do not hide layout cost behind an animation claim. Disable or simplify nonessential motion for reduced-motion preferences. No continuous shimmer or chart looping when idle.

Preserve spatial continuity and focus. User input has priority over transition completion; cancellation/re-targeting must be supported. A resize drag responds immediately; heavy recomposition is coalesced. A streamed number changing frequently should not run a full counting animation on every update.

## Component finish checklist

Text alignment including numeric tabular alignment where useful; predictable icon size/baseline; clear click/focus target; no clipped focus outline; loading reserves sensible dimensions; empty/error copy is specific; disabled versus read-only visually distinct; touch/keyboard interactions equivalent; tooltips readable within viewport; no default layout shift on hydration; theme change without full remount.

## Visual review protocol

Review desktop wide/regular, narrow container inside wide viewport, mobile width, long locale strings, 200%/400% zoom/reflow as applicable, RTL, dark/light, reduced motion and high contrast. Compare screenshots for the same fixture and viewport; don't accept a golden image blindly when meaning or focus is wrong. Record reviewer findings and unresolved defects alongside the screenshot.

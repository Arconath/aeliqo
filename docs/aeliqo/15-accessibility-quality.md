# 15 — Accessibility and inclusive behavior

Target WCAG 2.2 AA for the documented supported experience, with manual review for complex interactions. Automated scanning is necessary but not sufficient; Playwright documentation itself distinguishes automated checks from full accessibility testing. [R15, R16]

## Shared requirements

Semantic HTML first; roles only where necessary and correctly implemented. Accessible names/descriptions/states; visible focus; logical DOM/read order; no keyboard traps; errors associated with fields; status messages restrained; zoom/reflow; pointer and keyboard equivalents; contrast and non-color encoding; reduced motion; touch target usability; RTL and locale formatting.

Do not use `role=grid` simply because something looks tabular. Static data tables use table semantics; interactive grids require the full expected navigation model. Virtualized content needs coherent row counts/indices, focus retention and an accessible navigation strategy; provide pagination/table alternatives where full virtualization harms access.

## Visualizations

Each meaningful visual has a title, concise description, unit/time/grain context, and access to underlying authorized data/summary. Keyboard users can inspect and select relevant marks without traversing 50k individual focus stops. Screen-reader text describes actual information, not merely “chart.” Canvas fallback is designed, not an empty hidden div.

Tooltip content is available on focus/activation and stays dismissible. Color palettes are accompanied by labels, shapes or patterns where needed. Animations never become the sole indicator of change. Uncertainty and partial-data warnings are accessible as well as visible.

## Workspace

Composing accessible primitives does not automatically produce an accessible workspace. Test focus after adding/removing/reordering panels, replacing variants, opening detail overlays and restoring layouts. Announce a logical agent update once; do not flood live regions with every subcomponent mutation. User action takes precedence over automated focus moves.

Resizers and drag handles have keyboard alternatives. Pin and undo controls have stateful names. Hidden/collapsed panels cannot retain active keyboard traps. Adaptive layout preserves meaning and tasks at narrow widths rather than merely fitting boxes.

## Test matrix

Automated axe checks on key states; browser integration on supported Chromium/Firefox/WebKit; manual keyboard-only workflows; at least one documented screen-reader/browser combination per relevant platform before claiming support; 200%/400% zoom as applicable; forced colors; reduced motion; long text/RTL; mixed locale/currency; error recovery. Actual supported combinations are listed from evidence, not assumed from the framework name.

Acceptance blocks: inaccessible critical controls, lost draft/focus, unreadable chart meaning, misleading state announcements, or keyboard-inoperable core tasks. A release cannot buy performance by removing these requirements. Safety/security/accessibility basics remain in OSS.

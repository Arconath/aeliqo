# Component review captures

Run `pnpm test:visual`. This builds the production packages used by the catalog fixtures, typechecks the review harness, and runs Chromium, Firefox, and WebKit. For a focused run after a fresh `pnpm build:platform`, use `pnpm exec playwright test --config tests/visual/playwright.config.mjs field-states`.

`catalog.spec.ts` captures every one of the 71 real catalog mounts in desktop light and narrow dark RTL with doubled root text size. `field-states.spec.ts` additionally activates disabled, host-invalid, and pending validation states on the 13 native field components, plus read-only typing on text, multiline, and number fields. It checks actual native disabled state, exposed invalid semantics, error text, pending status, and popup overlap before capturing. Axe violations must be empty; incomplete checks are attached for review.

These are **unapproved review captures**, not pixel regression baselines or manual assistive-technology evidence. Do not autoaccept them. Full state coverage, focus/keyboard/IME flows, forced colors, visual approval, and manual VoiceOver/Safari and NVDA review remain separate requirements. Every run replaces the local output directory; preserve reviewed evidence with its source and environment before another run.

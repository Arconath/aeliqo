---
name: aeliqo-docs-experience
description: "Use for the docs website, navigation, component reference, playground, onboarding, design tokens or developer-facing examples."
---

# Build the documentation experience

## Scope

This skill is repository-local. Read applicable AGENTS instructions first; use this workflow only for the matching task. Do not install global skills/plugins or load every other Aeliqo skill.

## Read only what this task needs

- [17-docs-site-ux.md](../../../docs/aeliqo/17-docs-site-ux.md)
- [06-component-contract-and-dx.md](../../../docs/aeliqo/06-component-contract-and-dx.md)
- [docs-site/README.md](../../../docs/aeliqo/docs-site/README.md)
- [13-css-tokens-motion.md](../../../docs/aeliqo/13-css-tokens-motion.md)

## Workflow

Inspect the existing site before choosing a docs framework. Preserve a healthy implementation; a static-first engine is a candidate, not a migration mandate. Start with the user's first useful component, not a giant configuration wall. Organize by start/concepts/components/recipes/integrations/reference, with clear maturity and OSS/Pro labels.

Use actual compiled examples and API metadata where possible. Documentation should distinguish standalone explicit, adaptive and agent-directed use without implying AI is required. Show preview/code/contract selectively; make advanced settings collapsible. Keep real data or synthetic fixtures clearly labeled and never fake a successful agent exchange.

Implement readable typography, restrained surfaces, responsive navigation, keyboard search, accessible code copy, persistent page anchors and clear previous/next guidance. Lazy-load interactive demos only when needed. Verify mobile/narrow views, long names, 200% zoom, reduced motion, focus and contrast. A beautiful static mockup is not evidence that the docs site works.

Publish only supported API names, package install commands and tested integrations. Proposed examples from the kit remain proposals until reconciled with code.

## Completion evidence

Built site pages; checked links/search/anchors; runnable typechecked examples; screenshots of key responsive states; no fictional package/API instructions.

Report checks actually executed and their results. A schema, plan, screenshot, or mocked adapter proves only its own scope. Preserve user changes and record concrete blockers without inventing completion.

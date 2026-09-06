# 22 — Packaging, release and basic security

## Publish boundaries

ESM/subpath imports with declarations and explicit CSS exports. No heavy eager barrel registry. Components-only builds must exclude server/provider/MCP implementations. Browser/server entry separation is tested with bundler graph inspection and SSR import smoke tests. CSS needed by a component cannot be accidentally tree-shaken; package sideEffects metadata must reflect actual style entry behavior.

Keep public package names provisional until available/approved. Pin tested dependency versions using the existing lockfile; do not blindly upgrade to latest during architectural work. Version contracts and packages deliberately; prerelease tags do not justify silent breaking behavior without migration notes.

## Release checklist

Actual build/type/lint/unit/integration checks; positive/negative contract fixtures; published-package consumer test; browser/a11y/visual evidence; measured budgets; license/third-party notice review; public/private artifact inspection; changelog/migration notes; no secrets/private datasets; install/uninstall/SSR examples; documented supported versions; explicitly authorized publication. Use existing CI rather than replace it wholesale.

Basic read-only APIs and component imports should not require network license checks. Any future commercial package has clear rights and offline/runtime behavior; it must not pull proprietary code or licensing services into OSS imports unintentionally.

## Threat boundaries

Agent/data text is untrusted. Tool result text cannot redefine system instructions or permissions. No eval/new Function/remote module/HTML/CSS execution from payloads. Validate sizes/depth/types and component-specific properties. Escape labels/Markdown/URLs according to actual rendering context; rich text sanitization is explicit. Dangerous URLs and arbitrary resource fetching are not implied by a view manifest.

Authorization is enforced on the data/action service and on browser-link routing; schema validity and MCP annotations are not access control. Use same-origin/allowlisted origins, deliberate pairing, replay/idempotency controls, scoped credentials and revoke. Private keys stay in backend/local secret environment, not browser localStorage, logs or saved workspace specs.

## Proportionate engineering

Do not build a standalone policy platform, SOC product or gatekeeper business. Implement the small controls needed for safe component data/tool execution. Security, accessibility and correctness are part of product quality and remain basic OSS behavior, not upsells.

## Telemetry

Off by default for the library. Application can subscribe to sanitized lifecycle hooks without sending data anywhere. Managed services later require explicit notices/consent, retention and tenant isolation. Never claim to know total user intents or model thinking from MCP call counts. Published demo analytics must not ingest arbitrary query contents or customer data by default.

## Public versus local docs

The kit contains architecture/business proposals, not customer secrets. Before making a repository public, review docs and fixtures deliberately. Private customer notes, pricing negotiations, credentials, commercial source and ops details belong outside a public git history. `.gitignore` is not a security boundary for already tracked files.

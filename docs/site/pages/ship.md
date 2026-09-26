---
id: "ship"
path: "/ship/"
section: "Ship"
title: "Ship an Aeliqo application"
description: "Verify contracts, authority, interaction, accessibility, framework integration, agent behavior, and clean installation before release."
---

Readiness applies to the packaged product and its deployed site. Complete the
checks below against the same source revision.

## Packages and contracts

- Install all five public tarballs in clean Vanilla, React, Vue, and Next.js
  consumers, including server rendering and hydration.
- Check that invalid intents, unknown fields, unregistered views, stale
  revisions, and unsupported query operations fail with a bounded outcome.
- Exercise data limits, authorization changes, cancellation, pagination, and
  action confirmation through success and failure paths.

## Site and components

- Generate one page, live example, and component route for every active catalog ID; the inventory gate enforces exact set equality.
- Mount every example and verify search, links, and route fallback behavior.
- Test 360, 768, and 1440 pixel layouts; keyboard, focus, reduced motion,
  forced colors, 200% text, 400% reflow, long labels, and right-to-left text.
- Scan representative journeys for serious and critical accessibility issues,
  then review screen-reader flows for docs, previews, playground, and action
  confirmation.
- Compare route bundles with the previous baseline and keep layout shift below
  the agreed budget.

## Release and cutover

Build one release candidate from the final commit. Publish the five packages
and deploy the immutable site image from that revision only after package,
documentation, browser, accessibility, performance, container, and health
checks pass. Keep the previous site image available for rollback. If an npm
package has already been published, correct it with a patch release.

See [SSR and hydration](/ship/ssr/), [browser support](/ship/browser-support/),
the [0.3 to 0.4 migration guide](/ship/migration-0.3/), and the
[0.5 migration guide](/ship/migration-0.4/) for the matching integration
details. The [0.5 support matrix](/ship/support-matrix/) records the exact
qualified and unverified profiles.

---
name: aeliqo-release
description: Prepare npm/source/site release, migration, promotion or rollback.
---

# aeliqo-release

Read docs/18-release-migration.md and docs/16-quality-gates.md. Inspect actual main, version availability, authentication, existing GitOps and immutable rollback identity. Require real ready evidence; never overwrite npm versions or force-push main. Test exact packed artifacts in clean consumers, publish RC before stable, promote dist-tags only after full package smoke, and update existing deployment by digest. Credential/action failures remain blocked. Do not unpublish/delete production to simplify a rewrite.

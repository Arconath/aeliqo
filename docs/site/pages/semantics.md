---
id: "semantics"
path: "/concepts/semantics/"
section: "Understand"
title: "Semantic contracts"
description: "Separate technical field types from business definitions, units, aggregation, grain, and temporal policy."
---

<p class="lead">Semantic metadata stops a valid-looking query from making an invalid claim. “Number” is not enough to decide sum, average, ratio, currency, precision, or trend.</p>
<h2>What a Result must preserve</h2><div class="doc-checklist"><ul><li>Stable entity identity and authorized population scope.</li><li>Row or aggregation grain.</li><li>Unit, precision, null behavior, and completeness.</li><li>Temporal field, calendar, timezone, and bucket grain when applicable.</li><li>Catalog, source, policy, and Result revisions.</li><li>Lineage from registered meaning and query operations.</li></ul></div>
<h2>Example: absence rate</h2><p>Absence days can be summed. Absence rate is a ratio with a defined numerator, denominator, population, period, and precision. Aeliqo accepts analysis only when the requested meaning and grain are registered and compatible.</p>
<h2>Missing and partial data</h2><p>Null is not zero. Partial is not exact. Sampled is not complete. The Result contract keeps these distinctions available to the recipe so the UI cannot silently overstate evidence.</p>
<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p><a href="/guides/resources/"><span>Resource metadata</span><small>Declare field roles and connect an existing Catalog.</small><b aria-hidden="true">→</b></a><a href="/concepts/safety/"><span>Semantic validation</span><small>See how invalid operations are rejected.</small><b aria-hidden="true">→</b></a></nav>

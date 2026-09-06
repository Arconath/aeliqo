# Comparison

Suggested summary: Compare entities using compatible measures, with the table, chart and selection working from one semantic binding.

Status badge must reflect the actual release state. Core comparison is OSS; do not use a Pro badge for basic linked selection or accessible variants.

## When it helps

Use Comparison for the same questions across multiple entities: price and quality, observed revenue by branch, or a measure across two periods. Use a simple Table when there is no comparative task. Do not produce a global rank from incompatible currencies, units or benchmark protocols.

## Default preview

Present a table and a compact trade-off chart from the same synthetic offers. Selecting an entity highlights it in both views. A clearly marked missing benchmark remains missing. Switching to a narrow container preserves selections and explains the chart's table alternative without implying the question changed.

Controls: compare set, display variant, density and data state. Advanced: allowed metric fields, units, scope and the inspectable operation receipt. Avoid exposing all registry internals in the default view.

## Reference sections

Minimal standalone usage; shared binding; controlled state; adaptive variants; typed events; data prerequisites; loading/empty/partial/stale states; keyboard navigation; supported rendering paths; measured limits; custom styling; API; related recipes. API names and import examples must come from the implementation, not a mock signature.

## Agent example

“Bandingkan model reasoning berdasarkan biaya dan benchmark.” With a connected supported agent and paired workspace, the result is a valid updated view plus a concise acknowledgement. In deterministic replay mode, visibly say “Recorded scenario”; don't claim an LLM made the plan. Without a valid comparison cohort, show limitations rather than a fabricated winner.

---
id: 'analytics'
path: '/guides/analytics/'
section: 'Build'
title: 'Analytics and time'
description: 'Declare analytical meanings, periods, denominators, completeness, and eligible trend views.'
---

<p class="lead">An analytical chart is trustworthy only when the application defines what its numbers mean. Aeliqo evaluates registered meanings and carries their grain, time policy, population, and coverage into the Result used by the view.</p>

## Register the meaning before requesting it

Define the entity fields and their roles, then register the measure and its allowed aggregation. A count, sum, and ratio are different meanings even when they use the same source rows. A ratio of daily totals must divide the summed numerator by the summed denominator for each day; averaging individual percentages changes the meaning. The query may refer only to registered fields, meanings, relations, and operations authorized for its resource. See [semantic contracts](/concepts/semantics/) and [resource metadata](/guides/resources/).

## Make the time window explicit

Choose a registered temporal field, calendar, timezone, bucket grain, and visible period. The September 2026 attendance fixture registers `day` with `Asia/Jakarta` and requests daily buckets in that timezone. The host describes September as the half-open interval `[2026-09-01T00:00:00+07:00, 2026-10-01T00:00:00+07:00)`; for its fixed September 6 as-of date, it evaluates supported civil-day filters from September 1 through before September 6. The fixture does not execute `QuerySpec.period`: offset and DST period execution remain unsupported in this local path. A record at a half-open end boundary belongs to the next period. The timezone is declared on the temporal field and query time bucket rather than inferred from the browser clock.

The approved attendance rate is **present eligible employee-days / eligible employee-days**. Its synthetic daily values are 1 on September 1, 0.5 on September 2, and 1 on September 3. September 4–5 have no observations; the fixture labels them as missing instead of plotting zero. September 6 is marked future in that fixture. A partial month is not presented as complete coverage.

## Request the analysis

An `analyze` intent names the registered meaning and the declared temporal policy. This is the request the maintained tutorial sends for its headcount trend:

**analyze intent**

```json
{
  "version": "1",
  "id": "monthly-headcount",
  "kind": "analyze",
  "resource": "workforce-headcount",
  "measures": [{ "id": "month-end-headcount", "revision": "1" }],
  "time": { "field": "month", "grain": "month", "calendar": "gregorian", "timezone": "UTC" },
  "preferredView": "trend",
  "sort": [{ "field": "month", "direction": "asc" }]
}
```

The measure must be a registered meaning on that resource at that revision; an ad-hoc aggregate such as “average of headcount” is not accepted.

## Select an eligible presentation

The resolver may choose a trend when the Result has a compatible time field, registered measure, and renderer. The application can pin a valid view, but a preference does not bypass eligibility or authority. The browser attendance example renders a chart and exposes the metric, denominator, period, timezone, and missing coverage as text. When both the approved rate and count are requested without a choice, it asks which metric to show. See [adaptive regions](/guides/adaptive-region/) and [runnable examples](/examples/).

## Failure and recovery

- Unknown or ambiguous metrics require a registered default or explicit clarification.
- Mixed units, incompatible grain, unsupported aggregation, and missing required denominators cannot be converted into a plausible chart.
- Cancellation and late Results cannot replace a newer committed view.
- A failed update keeps the previous Result only while that Result remains authorized; scope revocation clears it.

Run **Daily attendance** in the [public Playground](/playground/) to see the fixture's committed trend, denominator, period, missing coverage, and clarification choice in one shell. The journey uses synthetic records and does not validate a live provider or a customer dataset. A server adapter must enforce the same authorization and coverage claims before returning data; see [HTTP data](/guides/http-data/).

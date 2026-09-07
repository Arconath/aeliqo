# Basic monitoring contract

## Product and platform ownership

The public runtime remains a static site. Platform container/ingress metrics cover the serving workload; this change adds browser signals only and creates no application backend, database, or companion service.

The product emits measurements. `Arconath/platform-apps` owns the same-origin
`/otel/v1/metrics` and `/otel/v1/traces` routes, an isolated browser receiver in
the existing OpenTelemetry Collector, body/rate limits, strict signal/attribute
allowlists, delta-to-cumulative conversion, and Prometheus/Tempo storage. The
internal OTLP receiver and a public logs route must not be exposed.

## Activation

The image ships /browser-monitoring.json with enabled=false. The platform mounts a static ConfigMap at /srv/aeliqo/browser-monitoring.json with {"enabled":true}; an optional version must be a 40-character source SHA, optionally prefixed sha-. No rebuild is required to change activation. The public entrypoint reads the file; SDK packages and preview/example consumers do not initialize monitoring.

Only HTTPS on `aeliqo.com` may send from this product's integration. Browser
failure, disabled configuration or unavailable collection must never block the
application. Existing consented analytics remain a separate feature; this
setting does not enable them or the older Faro transport.

## Signals and units

| Signal | Type | Meaning |
|---|---|---|
| browser.page_views | Delta monotonic sum, unit 1 | One instrumented document initialization |
| browser.errors | Delta monotonic sum, unit 1 | Script errors or unhandled rejections, capped at 3 per document |
| browser.web_vital.lcp | Delta histogram, milliseconds | Largest Contentful Paint |
| browser.web_vital.inp | Delta histogram, milliseconds | Interaction to Next Paint |
| browser.web_vital.cls | Delta histogram, unit 1 | Cumulative Layout Shift |
| browser.web_vital.fcp | Delta histogram, milliseconds | First Contentful Paint |
| browser.web_vital.ttfb | Delta histogram, milliseconds | Time to First Byte |
| browser.navigation | Internal span | Navigation start to loadEventEnd |

The standard, pinned [web-vitals](https://github.com/GoogleChrome/web-vitals)
library supplies the browser algorithms; no attribution build is used. The
wire format is [OTLP HTTP JSON](https://opentelemetry.io/docs/specs/otlp/).
Histograms carry one finalized observation per metric per document. Unsupported
metrics and pages without an interaction remain absent, never fabricated zero.
The timing histogram bounds are 100, 250, 500, 1000, 1800, 2500, 4000, 8000 ms; CLS bounds
are 0.01, 0.05, 0.1, 0.25, 0.5, 1. Collectors may add Prometheus unit suffixes.

Navigation traces describe browser document loading. They do not claim a
correlated frontend-to-database trace or comprehensive SPA route/session counts.
Back/forward-cache restores and subsequent soft navigations are not counted as
new documents by this initial implementation. Percentiles describe received
observations, not all visitors; blockers, unsupported APIs and page termination
can prevent delivery.

## Privacy and resource bounds

Only fixed service identity, numeric values, a bounded web_vital.rating,
error.type, and navigation.type are serialized. The collector further strips
untrusted attributes and fixes resource identity. No page path, query, hash,
referrer, DOM content, input, request/response body, exception message/stack,
metric identifier, account/user identifier, or persistent session identifier is
sent. No cookies/storage or third-party endpoint is used; fetch uses
credentials=omit, referrerPolicy=no-referrer and redirects are rejected.

At most 10 small posts are attempted per document: five vitals, one page count,
one navigation span and three error counts. There are no retries or durable
queues. Collector-side limits and sanitization remain necessary because a
public ingestion endpoint can receive requests from clients other than this
reviewed code. Browser client clocks are untrusted; collection normalizes delta
metric timestamps before aggregation.

## Verification and rollout

The focused basic-monitoring tests exercise actual serialized outgoing payloads:
disabled/preview gating, histogram values/buckets, valid span identity/timing,
omission of private metric fields, duplicate initialization, error-storm bounds,
and failed collector requests. The product's ordinary checks still apply.

Source tests are not deployment evidence. Release the reviewed exact commit
through the existing pipeline, promote its immutable digest with GitOps, and
verify a real browser POST plus stored Prometheus/Tempo signals before declaring
production coverage. If a browser lacks INP or CLS support, record that gap
rather than treating another metric as a substitute.

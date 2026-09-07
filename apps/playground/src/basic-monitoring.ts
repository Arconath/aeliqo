import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

export interface BasicMonitoringConfig {
  enabled: boolean;
  product: 'releasepassport' | 'foundiqo' | 'loklyo' | 'boringkit' | 'syviora' | 'aeliqo';
  version?: string;
}

type Attribute = { key: string; value: { stringValue: string } };
const attribute = (key: string, value: string): Attribute => ({ key, value: { stringValue: value } });
const nanoTime = (milliseconds: number) => `${Math.round(milliseconds * 1000)}000`;
const timingBounds = [100, 250, 500, 1000, 1800, 2500, 4000, 8000];
const clsBounds = [0.01, 0.05, 0.1, 0.25, 0.5, 1];
let started = false;

// Construct a new payload from the numeric measurement only. Metric.entries,
// metric.id, attribution, DOM selectors, navigation URLs and user data never
// cross this boundary. The standard web-vitals build supplies the algorithms.
export function webVitalData(metric: Pick<Metric, 'name' | 'value' | 'rating'>, now: number) {
  if (!['LCP', 'INP', 'CLS', 'FCP', 'TTFB'].includes(metric.name)
      || !Number.isFinite(metric.value) || metric.value < 0
      || !['good', 'needs-improvement', 'poor'].includes(metric.rating)) return null;
  const bounds = metric.name === 'CLS' ? clsBounds : timingBounds;
  const bucket = bounds.findIndex((bound) => metric.value <= bound);
  return {
    name: `browser.web_vital.${metric.name.toLowerCase()}`,
    unit: metric.name === 'CLS' ? '1' : 'ms',
    histogram: {
      aggregationTemporality: 1, // DELTA; collector converts before Prometheus export.
      dataPoints: [{
        attributes: [attribute('web_vital.rating', metric.rating)],
        startTimeUnixNano: nanoTime(now - 1),
        timeUnixNano: nanoTime(now),
        count: '1', sum: metric.value, min: metric.value, max: metric.value,
        explicitBounds: bounds,
        bucketCounts: Array.from({ length: bounds.length + 1 }, (_, i) =>
          i === (bucket < 0 ? bounds.length : bucket) ? '1' : '0'),
      }],
    },
  };
}

export function startBasicMonitoring(config: BasicMonitoringConfig) {
  if (started || !config.enabled || typeof window === 'undefined'
      || window.location.hostname !== `${config.product}.com`
      || window.location.protocol !== 'https:') return;
  started = true;
  const start = performance.timeOrigin;
  const resourceAttributes = [
    attribute('service.name', `${config.product}-browser`),
    attribute('service.namespace', config.product),
    attribute('deployment.environment', 'production'),
  ];
  if (config.version && /^(sha-)?[a-f0-9]{40}$/.test(config.version)) {
    resourceAttributes.push(attribute('service.version', config.version));
  }
  const resource = { attributes: resourceAttributes };
  const scope = { name: 'arconath.browser.basic', version: '1' };
  let sends = 0;
  function send(signal: 'metrics' | 'traces', payload: unknown) {
    if (sends >= 10) return;
    sends += 1;
    try {
      // No retries, persistent IDs, storage, cookies, referrer or third-party
      // endpoints. Keepalive permits the final vitals to finish on page hide.
      void fetch(`/otel/v1/${signal}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), keepalive: true, credentials: 'omit',
        referrerPolicy: 'no-referrer', mode: 'same-origin', redirect: 'error',
      }).catch(() => { /* Monitoring failure must not affect the product. */ });
    } catch { /* Older browsers may not support keepalive. */ }
  }
  function sendMetric(metric: unknown) {
    send('metrics', { resourceMetrics: [{ resource, scopeMetrics: [{ scope, metrics: [metric] }] }] });
  }
  function count(name: 'browser.page_views' | 'browser.errors', attributes: Attribute[] = []) {
    const now = Date.now();
    sendMetric({ name, unit: '1', sum: {
      aggregationTemporality: 1, isMonotonic: true,
      dataPoints: [{ attributes, startTimeUnixNano: nanoTime(now - 1), timeUnixNano: nanoTime(now), asInt: '1' }],
    } });
  }
  count('browser.page_views');
  let errors = 0;
  function countError(type: 'script' | 'unhandledrejection') {
    if (errors >= 3) return;
    errors += 1;
    count('browser.errors', [attribute('error.type', type)]);
  }
  window.addEventListener('error', () => countError('script'));
  window.addEventListener('unhandledrejection', () => countError('unhandledrejection'));

  const reportedVitals = new Set<string>();
  function report(metric: Metric) {
    if (reportedVitals.has(metric.name)) return;
    const data = webVitalData(metric, Date.now());
    if (!data) return;
    reportedVitals.add(metric.name);
    sendMetric(data);
  }
  // Report one finalized observation per metric for this document lifecycle.
  // No fabricated zeros for browsers without support or pages without input.
  for (const observe of [onCLS, onFCP, onINP, onLCP, onTTFB]) {
    try { observe(report); } catch { /* Unsupported observer is simply absent. */ }
  }

  function reportNavigation() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!navigation || !Number.isFinite(navigation.loadEventEnd) || navigation.loadEventEnd <= 0
        || !window.crypto?.getRandomValues) return;
    const randomHex = (bytes: number) => Array.from(window.crypto.getRandomValues(new Uint8Array(bytes)),
      (value) => value.toString(16).padStart(2, '0')).join('');
    const type = ['navigate', 'reload', 'back_forward', 'prerender'].includes(navigation.type) ? navigation.type : 'unknown';
    send('traces', { resourceSpans: [{ resource, scopeSpans: [{ scope, spans: [{
      traceId: randomHex(16), spanId: randomHex(8), name: 'browser.navigation', kind: 1,
      startTimeUnixNano: nanoTime(start), endTimeUnixNano: nanoTime(start + navigation.loadEventEnd),
      attributes: [attribute('navigation.type', type)],
    }] }] }] });
  }
  // loadEventEnd is populated after the load event's handlers finish.
  if (document.readyState === 'complete') setTimeout(reportNavigation, 0);
  else window.addEventListener('load', () => { setTimeout(reportNavigation, 0); }, { once: true });
}

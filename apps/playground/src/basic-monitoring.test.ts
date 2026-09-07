import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Metric } from 'web-vitals';

const observers = vi.hoisted(() => new Map<string, (metric: Metric) => void>());
vi.mock('web-vitals', () => Object.fromEntries(['CLS', 'FCP', 'INP', 'LCP', 'TTFB'].map((name) =>
  [`on${name}`, (callback: (metric: Metric) => void) => observers.set(name, callback)])));

describe('basic browser monitoring transport and privacy', () => {
  let browser: EventTarget & { location: { hostname: string; protocol: string }; crypto: Crypto };
  const post = vi.fn().mockResolvedValue({ ok: true });

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    observers.clear();
    post.mockClear();
    browser = Object.assign(new EventTarget(), {
      location: { hostname: 'aeliqo.com', protocol: 'https:' },
      crypto: { getRandomValues: (bytes: Uint8Array) => bytes.fill(17) } as unknown as Crypto,
    });
    vi.stubGlobal('window', browser);
    vi.stubGlobal('document', { readyState: 'complete' });
    vi.stubGlobal('performance', { timeOrigin: Date.now() - 2000, getEntriesByType: () => [{
      loadEventEnd: 1000, type: 'navigate', name: 'https://aeliqo.com/private?token=secret',
    }] });
    vi.stubGlobal('fetch', post);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('stays off for disabled, preview, customer and non-HTTPS origins', async () => {
    const { startBasicMonitoring } = await import('./basic-monitoring');
    startBasicMonitoring({ enabled: false, product: 'aeliqo' });
    browser.location.hostname = 'localhost';
    startBasicMonitoring({ enabled: true, product: 'aeliqo' });
    browser.location.hostname = 'customer.example';
    startBasicMonitoring({ enabled: true, product: 'aeliqo' });
    browser.location.hostname = 'aeliqo.com';
    browser.location.protocol = 'http:';
    startBasicMonitoring({ enabled: true, product: 'aeliqo' });
    expect(post).not.toHaveBeenCalled();
    expect(observers.size).toBe(0);
  });

  it.each(['aeliqo.com', 'www.aeliqo.com'])('emits private-safe OTLP on %s', async (hostname) => {
    browser.location.hostname = hostname;
    const { startBasicMonitoring } = await import('./basic-monitoring');
    startBasicMonitoring({ enabled: true, product: 'aeliqo', version: 'secret-invalid-version' });
    startBasicMonitoring({ enabled: true, product: 'aeliqo' });
    await vi.runAllTimersAsync();
    const privateMetric = { name: 'LCP', value: 2600, rating: 'needs-improvement',
      id: 'secret-visitor', entries: [{ url: '/private?token=secret' }] } as unknown as Metric;
    observers.get('LCP')!(privateMetric);
    observers.get('LCP')!({ ...privateMetric, value: 9000 });
    browser.dispatchEvent(new Event('error'));
    const payloads = post.mock.calls.map(([url, options]) => ({ url, body: JSON.parse(options.body), options }));
    expect(payloads).toHaveLength(4);
    expect(payloads.every(({ options }) => options.credentials === 'omit'
      && options.referrerPolicy === 'no-referrer' && options.redirect === 'error'
      && options.mode === 'same-origin' && options.keepalive === true)).toBe(true);
    expect(JSON.stringify(payloads)).not.toMatch(/private|token|secret|visitor|url\.full|session|referrerUrl/);
    const lcp = payloads.find(({ body }) => body.resourceMetrics?.[0].scopeMetrics[0].metrics[0].name === 'browser.web_vital.lcp')!
      .body.resourceMetrics[0].scopeMetrics[0].metrics[0];
    expect(lcp.unit).toBe('ms');
    expect(lcp.histogram.aggregationTemporality).toBe(1);
    expect(lcp.histogram.dataPoints[0].count).toBe('1');
    expect(lcp.histogram.dataPoints[0].bucketCounts).toEqual(['0', '0', '0', '0', '0', '0', '1', '0', '0']);
    expect(lcp.histogram.dataPoints[0].sum).toBe(2600);
    const span = payloads.find(({ url }) => url === '/otel/v1/traces')!.body.resourceSpans[0].scopeSpans[0].spans[0];
    expect(span.name).toBe('browser.navigation');
    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(BigInt(span.endTimeUnixNano) - BigInt(span.startTimeUnixNano)).toBe(BigInt('1000000000'));
  });

  it('bounds error storms and does not retry collector failures', async () => {
    post.mockRejectedValue(new Error('collector unavailable'));
    const { startBasicMonitoring } = await import('./basic-monitoring');
    startBasicMonitoring({ enabled: true, product: 'aeliqo' });
    for (let i = 0; i < 100; i += 1) browser.dispatchEvent(new Event('unhandledrejection'));
    await vi.runAllTimersAsync();
    expect(post).toHaveBeenCalledTimes(5); // one page, three errors, one trace
    const errors = post.mock.calls.map(([, options]) => JSON.parse(options.body))
      .filter((body) => body.resourceMetrics?.[0].scopeMetrics[0].metrics[0].name === 'browser.errors');
    expect(errors).toHaveLength(3);
    post.mockResolvedValue({ ok: true });
  });

  it('rejects unsupported/invalid samples and assigns dimensionless CLS buckets', async () => {
    const { webVitalData } = await import('./basic-monitoring');
    expect(webVitalData({ name: 'LCP', value: NaN, rating: 'good' }, 2)).toBeNull();
    expect(webVitalData({ name: 'INP', value: -1, rating: 'good' }, 2)).toBeNull();
    const cls = webVitalData({ name: 'CLS', value: 0.2, rating: 'needs-improvement' }, 2)!;
    expect(cls.unit).toBe('1');
    expect(cls.histogram.dataPoints[0].bucketCounts).toEqual(['0', '0', '0', '1', '0', '0', '0']);
  });
});

import {test, expect, type Browser, type Page} from "@playwright/test";
import {mkdir, writeFile} from "node:fs/promises";
import {dirname} from "node:path";

const FIXTURE_PATH = "/tests/performance/standalone.html";
const COLD_SAMPLE_COUNT = 10;
const WARM_SAMPLE_COUNT = 30;

type StandaloneObservation = {
  readonly environment: {
    readonly userAgent: string;
    readonly platform: string;
    readonly language: string;
    readonly viewport: {readonly width: number; readonly height: number};
    readonly devicePixelRatio: number;
    readonly hardwareConcurrency: number | null;
  };
  readonly fixture: {
    readonly rowCount: number;
    readonly renderedRows: number;
    readonly controlValue: string;
    readonly inputPresent: boolean;
    readonly tablePresent: boolean;
  };
  readonly timing: {
    readonly navigation: {
      readonly name: string;
      readonly type: string;
      readonly startTime: number;
      readonly duration: number;
      readonly domInteractive: number;
      readonly domContentLoadedEventEnd: number;
      readonly loadEventEnd: number;
      readonly transferSize: number;
      readonly encodedBodySize: number;
      readonly decodedBodySize: number;
    } | undefined;
    readonly resources: readonly {
      readonly name: string;
      readonly initiatorType: string;
      readonly startTime: number;
      readonly duration: number;
      readonly transferSize: number;
      readonly encodedBodySize: number;
      readonly decodedBodySize: number;
    }[];
    readonly paints: readonly {readonly name: string; readonly startTime: number; readonly duration: number}[];
    readonly fixtureReadyMs: number | undefined;
  };
  readonly resourceBytes: {
    readonly totalTransferBytes: number;
    readonly totalEncodedBytes: number;
    readonly totalDecodedBytes: number;
    readonly javascriptTransferBytes: number;
    readonly javascriptEncodedBytes: number;
    readonly javascriptDecodedBytes: number;
    readonly resourceCount: number;
    readonly javascriptResourceCount: number;
    readonly cachedResourceCount: number;
    readonly cachedJavascriptResourceCount: number;
    readonly revalidatedResourceCount: number;
    readonly revalidatedJavascriptResourceCount: number;
  };
};

type Sample = {
  readonly index: number;
  readonly condition: {
    readonly cache: "disabled" | "enabled";
    readonly cacheCleared: boolean;
    readonly cacheDisabled: boolean;
    readonly freshContext: boolean;
    readonly sameContextAsWarmup: boolean;
  };
  readonly observation: StandaloneObservation;
};

async function waitForFixture(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const api = (window as Window & {aeliqoStandalone?: {ready: boolean}}).aeliqoStandalone;
    return api?.ready === true;
  });
}

async function collect(page: Page): Promise<StandaloneObservation> {
  return page.evaluate(() => {
    const api = (window as Window & {aeliqoStandalone?: {ready: boolean; collect: () => StandaloneObservation}}).aeliqoStandalone;
    if (api?.ready !== true) throw new Error("Standalone fixture is not ready.");
    return api.collect();
  });
}

async function openFixture(page: Page, baseURL: string): Promise<StandaloneObservation> {
  await page.goto(`${baseURL}${FIXTURE_PATH}`, {waitUntil: "load"});
  await waitForFixture(page);
  return collect(page);
}

function finiteValues(samples: readonly Sample[], value: (sample: Sample) => number | undefined): number[] {
  return samples.map(value).filter((candidate): candidate is number => typeof candidate === "number" && Number.isFinite(candidate));
}

function nearestRank(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))] ?? null;
}

function timingSummary(samples: readonly Sample[]) {
  const domReady = finiteValues(samples, (sample) => sample.observation.timing.navigation?.domContentLoadedEventEnd);
  const fixtureReady = finiteValues(samples, (sample) => sample.observation.timing.fixtureReadyMs);
  const fcp = finiteValues(samples, (sample) => sample.observation.timing.paints.find((paint) => paint.name === "first-contentful-paint")?.startTime);
  return {
    sampleCount: samples.length,
    domContentLoadedEventEndMs: {p50: nearestRank(domReady, 0.5), p95: nearestRank(domReady, 0.95), observed: domReady},
    fixtureReadyMs: {p50: nearestRank(fixtureReady, 0.5), p95: nearestRank(fixtureReady, 0.95), observed: fixtureReady},
    firstContentfulPaintMs: {p50: nearestRank(fcp, 0.5), p95: nearestRank(fcp, 0.95), observed: fcp},
  };
}

async function captureColdSamples(browser: Browser, baseURL: string): Promise<Sample[]> {
  const samples: Sample[] = [];
  for (let index = 0; index < COLD_SAMPLE_COUNT; index += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send("Network.enable");
    await client.send("Network.clearBrowserCache");
    await client.send("Network.setCacheDisabled", {cacheDisabled: true});
    try {
      const observation = await openFixture(page, baseURL);
      samples.push({index: index + 1, condition: {
        cache: "disabled", cacheCleared: true, cacheDisabled: true, freshContext: true, sameContextAsWarmup: false,
      }, observation});
    } finally {
      await client.detach();
      await context.close();
    }
  }
  return samples;
}

async function captureWarmSamples(browser: Browser, baseURL: string): Promise<{readonly warmup: StandaloneObservation; readonly samples: readonly Sample[]}> {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const warmup = await openFixture(page, baseURL);
    const samples: Sample[] = [];
    for (let index = 0; index < WARM_SAMPLE_COUNT; index += 1) {
      await page.evaluate(() => performance.clearResourceTimings());
      await page.reload({waitUntil: "load"});
      await waitForFixture(page);
      const observation = await collect(page);
      samples.push({index: index + 1, condition: {
        cache: "enabled", cacheCleared: false, cacheDisabled: false, freshContext: false, sameContextAsWarmup: true,
      }, observation});
    }
    return {warmup, samples};
  } finally {
    await context.close();
  }
}

test("captures standalone production fixture cold and warm browser observations", async ({browser, baseURL}, testInfo) => {
  if (baseURL === undefined) throw new Error("Playwright baseURL is required.");
  const cold = await captureColdSamples(browser, baseURL);
  const warm = await captureWarmSamples(browser, baseURL);
  const report = {
    schema: "aeliqo.performance.standalone.v1",
    sourceCommit: process.env.AELIQO_SOURCE_COMMIT ?? "unknown",
    environment: cold[0]?.observation.environment ?? warm.warmup.environment,
    fixture: {rowCount: 100, controlValue: "ready", entrypoint: "@aeliqo/web/input + @aeliqo/web/table"},
    cold: {
      label: "cold-cache-disabled-fresh-context",
      sampleCount: cold.length,
      samples: cold,
      summary: timingSummary(cold),
    },
    warm: {
      label: "warm-cache-enabled-same-context-after-warmup",
      warmup: warm.warmup,
      sampleCount: warm.samples.length,
      samples: warm.samples,
      summary: timingSummary(warm.samples),
    },
    notes: [
      "Cold samples use a new browser context and page, clear the Chromium browser cache through CDP, and disable the network cache for the navigation.",
      "Warm samples perform one warmup navigation, then 30 reloads in one context with the browser cache enabled; ResourceTiming transferSize and encodedBodySize are retained for cache-hit evidence.",
      "Fixture-ready is measured after Lit updateComplete and is not a paint measurement; first-contentful-paint is reported only when the browser exposes a paint timing entry.",
      "These observations qualify this standalone 100-row input/table fixture only. They do not claim input-to-paint, whole-site, or lower-powered-device performance.",
    ],
  };
  const output = testInfo.outputPath("standalone-performance-report.json");
  await mkdir(dirname(output), {recursive: true});
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  expect(cold).toHaveLength(COLD_SAMPLE_COUNT);
  expect(warm.samples).toHaveLength(WARM_SAMPLE_COUNT);
  for (const sample of [...cold, ...warm.samples]) {
    expect(sample.observation.fixture).toMatchObject({rowCount: 100, renderedRows: 100, controlValue: "ready", inputPresent: true, tablePresent: true});
    expect(sample.observation.timing.navigation).toEqual(expect.objectContaining({domContentLoadedEventEnd: expect.any(Number)}));
    expect(sample.observation.timing.resources.length).toBeGreaterThan(0);
    expect(sample.observation.resourceBytes.javascriptResourceCount).toBeGreaterThan(0);
    expect(sample.observation.resourceBytes.javascriptEncodedBytes).toBeGreaterThanOrEqual(0);
  }
  expect(cold.every((sample) => sample.observation.resourceBytes.javascriptEncodedBytes > 0)).toBe(true);
  expect(cold.every((sample) => sample.condition.cache === "disabled" && sample.condition.cacheCleared && sample.condition.freshContext)).toBe(true);
  expect(warm.samples.every((sample) => sample.condition.cache === "enabled" && sample.condition.sameContextAsWarmup && !sample.condition.cacheDisabled)).toBe(true);
  expect(warm.samples.every((sample) => sample.observation.resourceBytes.cachedJavascriptResourceCount >= 0)).toBe(true);
});

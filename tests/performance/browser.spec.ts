import {test, expect, type Page} from "@playwright/test";
import {mkdir, writeFile} from "node:fs/promises";
import {dirname} from "node:path";

type PerformanceApi = {
  smallStandalone: (options?: {timed?: boolean}) => Promise<any>;
  mediumViews: (options?: {timed?: boolean}) => Promise<any>;
  targetedReducer: (options?: {timed?: boolean}) => Promise<any>;
  boundedGeometry: () => Promise<any>;
  mountDispose: () => Promise<any>;
  runAll: (options?: {timed?: boolean}) => Promise<any>;
  ready: boolean;
};

async function openFixture(page: Page): Promise<void> {
  await page.goto("/tests/performance/browser.html");
  await page.waitForFunction(() => (window as Window & {aeliqoPerformance?: PerformanceApi}).aeliqoPerformance?.ready === true);
}

test("runs small, medium, large-window, reducer and teardown workloads", async ({page}) => {
  await openFixture(page);
  const result = await page.evaluate(async (): Promise<any> => {
    const api = (window as Window & {aeliqoPerformance?: PerformanceApi}).aeliqoPerformance;
    if (api === undefined) throw new Error("Performance API is unavailable.");
    return {
      small: await api.smallStandalone(), medium: await api.mediumViews(), large: await api.runAll({timed: false}).then((all: any) => all.large),
      reducer: await api.targetedReducer(), geometry: await api.boundedGeometry(), cleanup: await api.mountDispose(),
    };
  });
  expect(result.small.rowCount).toBe(100);
  expect(result.small.renderedRows).toBe(100);
  expect(result.small.inputValue).toBe("ready");
  expect(result.medium.rowCount).toBe(10_000);
  expect(result.medium.views).toBe(30);
  expect(result.medium.virtualRows).toBeLessThanOrEqual(30 * 100);
  expect(["composed", "search-exhausted"]).toContain(result.medium.plan.status);
  expect(result.medium.plan.nodes).toBe(31);
  expect(result.medium.plan.candidateCount).toBe(64);
  expect(result.large.populationRows).toBe(1_000_000);
  expect(result.large.transferredRows).toBe(100);
  expect(result.large.mountedRows).toBeLessThanOrEqual(100);
  expect(result.reducer.successful).toBe(result.reducer.iterations);
  expect(result.reducer.unrelatedRoutes).toBe(0);
  expect(result.geometry.geometry.bounded).toBe(true);
  expect(result.cleanup.bounded).toBe(true);
});

test("records cold and warm observations with a browser layout/paint trace", async ({page, context}, testInfo) => {
  test.skip(process.env.AELIQO_RUN_PERFORMANCE !== "1", "Set AELIQO_RUN_PERFORMANCE=1 to run timing workloads in isolation.");
  await openFixture(page);
  await context.tracing.start({screenshots: true, snapshots: true, sources: true});
  let report: unknown;
  try {
    report = await page.evaluate(async (): Promise<any> => {
      const api = (window as Window & {aeliqoPerformance?: PerformanceApi}).aeliqoPerformance;
      if (api === undefined) throw new Error("Performance API is unavailable.");
      return api.runAll({timed: true});
    });
  } finally {
    await context.tracing.stop({path: testInfo.outputPath("browser-trace.zip")});
  }
  const output = testInfo.outputPath("performance-report.json");
  await mkdir(dirname(output), {recursive: true});
  await writeFile(output, `${JSON.stringify({sourceCommit: process.env.AELIQO_SOURCE_COMMIT ?? "unknown", report}, null, 2)}\n`, "utf8");
  expect(report).toMatchObject({environment: {runtime: "browser"}, small: {measurement: {cold: {rawMs: expect.any(Array)}, warm: {rawMs: expect.any(Array)}}}});
});

import {test, expect, type Page} from "@playwright/test";
import {mkdir, writeFile} from "node:fs/promises";
import {createServer} from "node:http";
import {dirname} from "node:path";

type PerformanceApi = {
  smallStandalone: (options?: {timed?: boolean}) => Promise<any>;
  mediumViews: (options?: {timed?: boolean}) => Promise<any>;
  targetedReducer: (options?: {timed?: boolean}) => Promise<any>;
  boundedGeometry: (sourceUrl: string) => Promise<any>;
  mountDispose: () => Promise<any>;
  runAll: (options: {timed?: boolean; sourceUrl: string}) => Promise<any>;
  ready: boolean;
};

interface LargeSourceFixture {
  readonly url: string;
  close(): Promise<void>;
}

async function startLargeSourceFixture(): Promise<LargeSourceFixture> {
  const source = {
    populationRows: 1_000_000,
    recordAt(index: number) { return {id: `source-row-${index + 1}`, label: `Source row ${index + 1}`, value: index}; },
    readWindow(limit: number, cursor: string | null) {
      const start = cursor === "page-1" || cursor === null ? 0 : 100;
      const records = Array.from({length: limit}, (_, index) => this.recordAt(start + index));
      return {populationRows: this.populationRows, requestedRows: limit, executedRows: records.length, examinedRows: records.length, cursor, records};
    },
  };
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method !== "GET" || requestUrl.pathname !== "/rows") {
      response.writeHead(404).end();
      return;
    }
    const parsedLimit = Number(requestUrl.searchParams.get("limit") ?? "100");
    const requestedRows = Number.isSafeInteger(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 100;
    const encoded = JSON.stringify(source.readWindow(requestedRows, requestUrl.searchParams.get("cursor")));
    response.writeHead(200, {"content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(encoded),
      "access-control-allow-origin": "*", "access-control-expose-headers": "content-length"}).end(encoded);
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve()); });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Large source fixture did not bind a TCP port.");
  return {url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))};
}

async function openFixture(page: Page): Promise<void> {
  await page.goto("/tests/performance/browser.html");
  await page.waitForFunction(() => (window as Window & {aeliqoPerformance?: PerformanceApi}).aeliqoPerformance?.ready === true);
}

test("runs small, medium, large-window, reducer and teardown workloads", async ({page}) => {
  await openFixture(page);
  const source = await startLargeSourceFixture();
  let result: any;
  try {
    result = await page.evaluate(async (sourceUrl): Promise<any> => {
      const api = (window as Window & {aeliqoPerformance?: PerformanceApi}).aeliqoPerformance;
      if (api === undefined) throw new Error("Performance API is unavailable.");
      const all = await api.runAll({timed: false, sourceUrl}) as any;
      return {
        small: await api.smallStandalone(), medium: await api.mediumViews(), large: all.large,
        reducer: await api.targetedReducer(), geometry: await api.boundedGeometry(sourceUrl), cleanup: await api.mountDispose(),
      };
    }, source.url);
  } finally {
    await source.close();
  }
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
  expect(result.large.requestedRows).toBe(100);
  expect(result.large.executedRows).toBe(100);
  expect(result.large.examinedRows).toBe(100);
  expect(result.large.transferredRows).toBe(100);
  expect(result.large.transportBytes).toBeGreaterThan(0);
  expect(result.large.responseBodyBytes).toBe(result.large.transportBytes);
  expect(result.large.mountedRows).toBeLessThanOrEqual(100);
  expect(result.reducer.successful).toBe(result.reducer.iterations);
  expect(result.reducer.unrelatedRoutes).toBe(0);
  expect(result.geometry.geometry.bounded).toBe(true);
  expect(result.cleanup.bounded).toBe(true);
});

test("records first/subsequent observations with a Chromium layout/paint trace", async ({page}, testInfo) => {
  test.skip(process.env.AELIQO_RUN_PERFORMANCE !== "1", "Set AELIQO_RUN_PERFORMANCE=1 to run timing workloads in isolation.");
  test.skip(testInfo.project.use.browserName !== "chromium", "The CDP timeline trace is Chromium-specific.");
  await openFixture(page);
  const source = await startLargeSourceFixture();
  const client = await page.context().newCDPSession(page);
  const traceEvents: unknown[] = [];
  client.on("Tracing.dataCollected", (event: {value?: unknown[]}) => { if (Array.isArray(event.value)) traceEvents.push(...event.value); });
  await client.send("Tracing.start", {transferMode: "ReportEvents", categories: [
    "devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-lighthouse", "blink.user_timing", "v8.execute", "toplevel", "blink", "cc",
  ].join(",")});
  let report: unknown;
  try {
    report = await page.evaluate(async (sourceUrl): Promise<any> => {
      const api = (window as Window & {aeliqoPerformance?: PerformanceApi}).aeliqoPerformance;
      if (api === undefined) throw new Error("Performance API is unavailable.");
      return api.runAll({timed: true, sourceUrl});
    }, source.url);
  } finally {
    await new Promise<void>((resolve, reject) => {
      const complete = () => resolve();
      client.once("Tracing.tracingComplete", complete);
      client.send("Tracing.end").catch(reject);
    });
    await source.close();
  }
  await client.detach();
  await writeFile(testInfo.outputPath("chromium-timeline-trace.json"), `${JSON.stringify({traceEvents}, null, 2)}\n`, "utf8");
  const measured = report as any;
  const budgetAssertions = {
    presentationPlannerP95Ms: measured.medium?.measurement?.subsequent?.p95Ms,
    targetedReducerP95Ms: measured.reducer?.subsequent?.p95Ms,
    largeMountedRows: measured.large?.sample?.mountedRows,
    presentationPlannerWithinBudget: measured.medium?.measurement?.subsequent?.p95Ms <= 16,
    targetedReducerWithinBudget: measured.reducer?.subsequent?.p95Ms <= 4,
    largeGeometryWithinBudget: measured.large?.sample?.mountedRows <= 100,
    enforced: process.env.AELIQO_ENFORCE_PERFORMANCE_BUDGETS === "1",
  };
  const output = testInfo.outputPath("performance-report.json");
  await mkdir(dirname(output), {recursive: true});
  await writeFile(output, `${JSON.stringify({sourceCommit: process.env.AELIQO_SOURCE_COMMIT ?? "unknown", report, budgetAssertions}, null, 2)}\n`, "utf8");
  expect(report).toMatchObject({environment: {runtime: "browser"}, small: {measurement: {first: {rawMs: expect.any(Array)}, subsequent: {rawMs: expect.any(Array)}}}});
  if (budgetAssertions.enforced) expect(budgetAssertions).toMatchObject({presentationPlannerWithinBudget: true, targetedReducerWithinBudget: true, largeGeometryWithinBudget: true});
  expect(traceEvents.some((event) => typeof event === "object" && event !== null && ["Layout", "Paint", "CompositeLayers"].includes((event as {name?: string}).name ?? ""))).toBe(true);
});

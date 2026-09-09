# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browser.spec.ts >> records first/subsequent observations with a Chromium layout/paint trace
- Location: tests/performance/browser.spec.ts:131:5

# Error details

```
Error: expect(received).toMatchObject(expected)

- Expected  - 1
+ Received  + 1

  Object {
    "largeGeometryWithinBudget": true,
-   "presentationPlannerWithinBudget": true,
+   "presentationPlannerWithinBudget": false,
    "targetedReducerWithinBudget": true,
  }
```

# Page snapshot

```yaml
- main [ref=e2]:
  - heading "Aeliqo performance workloads" [level=1] [ref=e3]
  - paragraph [ref=e4]: Bounded production-package probes. Results are collected by the test harness.
  - region "Performance fixture"
```

# Test source

```ts
  85  | 
  86  | async function openFixture(page: Page): Promise<void> {
  87  |   await page.goto("/tests/performance/browser.html");
  88  |   await page.waitForFunction(() => (window as Window & {aeliqoPerformance?: PerformanceApi}).aeliqoPerformance?.ready === true);
  89  | }
  90  | 
  91  | test("runs small, medium, large-window, reducer and teardown workloads", async ({page}) => {
  92  |   await openFixture(page);
  93  |   const source = await startLargeSourceFixture();
  94  |   let result: any;
  95  |   try {
  96  |     result = await page.evaluate(async (sourceUrl): Promise<any> => {
  97  |       const api = (window as Window & {aeliqoPerformance?: PerformanceApi}).aeliqoPerformance;
  98  |       if (api === undefined) throw new Error("Performance API is unavailable.");
  99  |       const all = await api.runAll({timed: false, sourceUrl}) as any;
  100 |       return {
  101 |         small: await api.smallStandalone(), medium: await api.mediumViews(), large: all.large,
  102 |         reducer: await api.targetedReducer(), geometry: await api.boundedGeometry(sourceUrl), cleanup: await api.mountDispose(),
  103 |       };
  104 |     }, source.url);
  105 |   } finally {
  106 |     await source.close();
  107 |   }
  108 |   expect(result.small.rowCount).toBe(100);
  109 |   expect(result.small.renderedRows).toBe(100);
  110 |   expect(result.small.inputValue).toBe("ready");
  111 |   expect(result.medium.rowCount).toBe(10_000);
  112 |   expect(result.medium.views).toBe(30);
  113 |   expect(result.medium.virtualRows).toBeLessThanOrEqual(30 * 100);
  114 |   expect(["composed", "search-exhausted"]).toContain(result.medium.plan.status);
  115 |   expect(result.medium.plan.nodes).toBe(31);
  116 |   expect(result.medium.plan.candidateCount).toBe(64);
  117 |   expect(result.large.populationRows).toBe(1_000_000);
  118 |   expect(result.large.requestedRows).toBe(100);
  119 |   expect(result.large.executedRows).toBe(100);
  120 |   expect(result.large.examinedRows).toBe(100);
  121 |   expect(result.large.transferredRows).toBe(100);
  122 |   expect(result.large.contentLengthBodyBytes).toBeGreaterThan(0);
  123 |   expect(result.large.responseBodyBytes).toBe(result.large.contentLengthBodyBytes);
  124 |   expect(result.large.mountedRows).toBeLessThanOrEqual(100);
  125 |   expect(result.reducer.successful).toBe(result.reducer.iterations);
  126 |   expect(result.reducer.unrelatedRoutes).toBe(0);
  127 |   expect(result.geometry.geometry.bounded).toBe(true);
  128 |   expect(result.cleanup.bounded).toBe(true);
  129 | });
  130 | 
  131 | test("records first/subsequent observations with a Chromium layout/paint trace", async ({page}, testInfo) => {
  132 |   test.skip(process.env.AELIQO_RUN_PERFORMANCE !== "1", "Set AELIQO_RUN_PERFORMANCE=1 to run timing workloads in isolation.");
  133 |   test.skip(testInfo.project.use.browserName !== "chromium", "The CDP timeline trace is Chromium-specific.");
  134 |   await openFixture(page);
  135 |   const source = await startLargeSourceFixture();
  136 |   const client = await page.context().newCDPSession(page);
  137 |   const traceEvents: unknown[] = [];
  138 |   client.on("Tracing.dataCollected", (event: {value?: unknown[]}) => { if (Array.isArray(event.value)) traceEvents.push(...event.value); });
  139 |   await client.send("Tracing.start", {transferMode: "ReportEvents", categories: [
  140 |     "devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-lighthouse", "blink.user_timing", "v8.execute", "toplevel", "blink", "cc",
  141 |   ].join(",")});
  142 |   let report: unknown;
  143 |   try {
  144 |     report = await page.evaluate(async (sourceUrl): Promise<any> => {
  145 |       const api = (window as Window & {aeliqoPerformance?: PerformanceApi}).aeliqoPerformance;
  146 |       if (api === undefined) throw new Error("Performance API is unavailable.");
  147 |       return api.runAll({timed: true, sourceUrl});
  148 |     }, source.url);
  149 |   } finally {
  150 |     await new Promise<void>((resolve, reject) => {
  151 |       const complete = () => resolve();
  152 |       client.once("Tracing.tracingComplete", complete);
  153 |       client.send("Tracing.end").catch(reject);
  154 |     });
  155 |     await source.close();
  156 |   }
  157 |   await client.detach();
  158 |   const measured = report as any;
  159 |   const trace = summarizeTrace(traceEvents);
  160 |   const tracePhasesAvailable = trace.script.count > 0 && trace.layout.count > 0 && trace.paint.count > 0;
  161 |   const plannerDurations = (measured as any)?.medium?.measurement?.results?.subsequent
  162 |     ?.map((sample: any) => sample?.plan?.durationMs)
  163 |     ?.filter((duration: unknown): duration is number => typeof duration === "number" && Number.isFinite(duration)) ?? [];
  164 |   const reducerDispatchDurations = (measured as any)?.reducer?.results?.subsequent
  165 |     ?.flatMap((sample: any) => Array.isArray(sample?.rawMs) ? sample.rawMs : [])
  166 |     ?.filter((duration: unknown): duration is number => typeof duration === "number" && Number.isFinite(duration)) ?? [];
  167 |   const plannerP95Ms = percentile(plannerDurations, 0.95);
  168 |   const reducerDispatchP95Ms = percentile(reducerDispatchDurations, 0.95);
  169 |   await writeFile(testInfo.outputPath("chromium-timeline-trace.json"), `${JSON.stringify({traceEvents, trace}, null, 2)}\n`, "utf8");
  170 |   const budgetAssertions = {
  171 |     presentationPlannerP95Ms: plannerP95Ms,
  172 |     targetedReducerDispatchP95Ms: reducerDispatchP95Ms,
  173 |     largeMountedRows: measured.large?.sample?.mountedRows,
  174 |     presentationPlannerWithinBudget: plannerP95Ms !== null && plannerP95Ms <= 16,
  175 |     targetedReducerWithinBudget: reducerDispatchP95Ms !== null && reducerDispatchP95Ms <= 4,
  176 |     largeGeometryWithinBudget: measured.large?.sample?.mountedRows <= 100,
  177 |     tracePhasesAvailable,
  178 |     enforced: process.env.AELIQO_ENFORCE_PERFORMANCE_BUDGETS !== "0",
  179 |   };
  180 |   const output = testInfo.outputPath("performance-report.json");
  181 |   await mkdir(dirname(output), {recursive: true});
  182 |   await writeFile(output, `${JSON.stringify({sourceCommit: process.env.AELIQO_SOURCE_COMMIT ?? "unknown", report, trace, budgetAssertions}, null, 2)}\n`, "utf8");
  183 |   expect(report).toMatchObject({environment: {runtime: "browser"}, small: {measurement: {first: {rawMs: expect.any(Array)}, subsequent: {rawMs: expect.any(Array)}}}});
  184 |   expect(tracePhasesAvailable).toBe(true);
> 185 |   if (budgetAssertions.enforced) expect(budgetAssertions).toMatchObject({presentationPlannerWithinBudget: true, targetedReducerWithinBudget: true, largeGeometryWithinBudget: true});
      |                                                           ^ Error: expect(received).toMatchObject(expected)
  186 | });
  187 | 
```
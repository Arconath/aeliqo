import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { cpus, freemem, platform, release, totalmem } from "node:os";

type ScaleKind = "table" | "trend";
type ScaleResult = {
  observableMs: number;
  elements: number;
  renderedRows: number;
  paths: number;
  circles: number;
  disclosure: string | null;
};

function percentile(samples: readonly number[], fraction: number) {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1]!;
}

test("B02 and B03 keep production Table and Trend output bounded", async ({ page, browserName }) => {
  await page.goto("/performance.html");
  await page.waitForFunction(() => "__AELIQO_SCALE__" in window);
  const browserVersion = await page.context().browser()!.version();
  const session = await page.context().newCDPSession(page);
  await session.send("Performance.enable");
  await session.send("HeapProfiler.enable");

  const runSeries = async (kind: ScaleKind) => {
    const before = await session.send("Performance.getMetrics");
    const events: { name: string; dur?: number }[] = [];
    const collectTrace = (event: { value: unknown[] }) => {
      for (const raw of event.value) {
        const item = raw as { name?: unknown; dur?: unknown };
        if (typeof item.name === "string")
          events.push({
            name: item.name,
            dur: typeof item.dur === "number" ? item.dur : undefined,
          });
      }
    };
    session.on("Tracing.dataCollected", collectTrace);
    await session.send("Tracing.start", {
      categories: "devtools.timeline,blink.user_timing",
      transferMode: "ReportEvents",
    });
    const cold = await page.evaluate((target) => window.__AELIQO_SCALE__.render(target), kind);
    await page.evaluate(() => window.__AELIQO_SCALE__.unmount());
    const warm: ScaleResult[] = [];
    for (let sample = 0; sample < 7; sample++) {
      warm.push(await page.evaluate((target) => window.__AELIQO_SCALE__.render(target), kind));
      await page.evaluate(() => window.__AELIQO_SCALE__.unmount());
    }
    const tracingComplete = new Promise<void>((resolve) =>
      session.once("Tracing.tracingComplete", () => resolve()),
    );
    await session.send("Tracing.end");
    await tracingComplete;
    session.off("Tracing.dataCollected", collectTrace);
    const after = await session.send("Performance.getMetrics");
    const start = Object.fromEntries(before.metrics.map((metric) => [metric.name, metric.value]));
    const end = Object.fromEntries(after.metrics.map((metric) => [metric.name, metric.value]));
    const duration = (name: string) =>
      events
        .filter((event) => event.name === name)
        .reduce((sum, event) => sum + (event.dur ?? 0), 0) / 1000;
    const observable = warm.map((sample) => sample.observableMs);
    return {
      cold,
      warm,
      warmObservableMs: {
        raw: observable,
        median: percentile(observable, 0.5),
        p95: percentile(observable, 0.95),
      },
      phaseTotalsMs: {
        script: (end.ScriptDuration! - start.ScriptDuration!) * 1000,
        layout: (end.LayoutDuration! - start.LayoutDuration!) * 1000,
        paintEventCpu: duration("Paint"),
      },
      paintEvents: events.filter((event) => event.name === "Paint").length,
    };
  };

  const table = await runSeries("table");
  const mountedTable = await page.evaluate(() => window.__AELIQO_SCALE__.render("table"));
  expect(mountedTable.renderedRows).toBeLessThan(30);
  expect(await page.getByRole("table").getAttribute("aria-rowcount")).toBe("100001");
  expect(await page.getByRole("columnheader").count()).toBe(20);
  await page.getByRole("region").press("End");
  expect(await page.locator("tbody button").count()).toBeLessThan(30);
  expect(await page.locator("tbody button").count()).toBeGreaterThan(0);
  await expect(page.locator("tbody button").last()).toBeVisible();
  await page.getByRole("region").press("Enter");
  await page.evaluate(() => window.__AELIQO_SCALE__.unmount());

  const trend = await runSeries("trend");
  const mountedTrend = await page.evaluate(() => window.__AELIQO_SCALE__.render("trend"));
  expect(mountedTrend.paths).toBe(1);
  expect(mountedTrend.circles).toBeLessThanOrEqual(800);
  expect(mountedTrend.disclosure).toMatch(
    /^Visual sample: \d+ of 50000 aggregated points drawn\. Exact summaries use all points\.$/,
  );
  expect(Number(mountedTrend.disclosure!.match(/\d+/)![0])).toBeLessThanOrEqual(800);
  await expect(page.getByText(/Exact summary for 50000 aggregated points:/)).toContainText(
    "minimum -999, maximum 999, latest 4, and 51 missing measurements",
  );
  await page.evaluate(() => window.__AELIQO_SCALE__.unmount());

  await session.send("HeapProfiler.collectGarbage");
  const heapSamples: number[] = [];
  for (let cycle = 0; cycle < 25; cycle++) {
    const kind: ScaleKind = cycle % 2 ? "table" : "trend";
    await page.evaluate((target) => window.__AELIQO_SCALE__.render(target), kind);
    expect(await page.evaluate(() => window.__AELIQO_SCALE__.unmount())).toBe(0);
    if ((cycle + 1) % 5 === 0) {
      await session.send("HeapProfiler.collectGarbage");
      const metrics = await session.send("Performance.getMetrics");
      heapSamples.push(metrics.metrics.find((metric) => metric.name === "JSHeapUsedSize")!.value);
    }
  }
  const retainedGrowthBytes = heapSamples.at(-1)! - heapSamples[0]!;
  expect(retainedGrowthBytes).toBeLessThan(8 * 1024 * 1024);

  const fixture = await page.evaluate(() => ({
    preparationMs: window.__AELIQO_SCALE__.preparationMs,
    queryMs: window.__AELIQO_SCALE__.queryMs,
    devicePixelRatio,
    viewport: { width: innerWidth, height: innerHeight },
  }));
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const implementationFiles = [
    "packages/react/src/table.tsx",
    "packages/react/src/trend.tsx",
    "apps/playground/src/performance-main.tsx",
    "tests/performance-scale.spec.ts",
  ];
  const implementationHash = createHash("sha256");
  for (const file of implementationFiles) implementationHash.update(readFileSync(file));
  const lockfileHash = createHash("sha256")
    .update(readFileSync("pnpm-lock.yaml"))
    .digest("hex");
  if (process.env.AELIQO_RECORD_EVIDENCE === "1") {
    writeFileSync(
      "docs/evidence/performance-scale.json",
      JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        commit,
        sourceState: "Active product sources are outside the parent repository index; use implementationSha256 with the named files for exact reproduction.",
        implementationFiles,
        implementationSha256: implementationHash.digest("hex"),
        lockfileSha256: lockfileHash,
        buildMode: "Vite production build served by vite preview",
        environment: {
          browser: `${browserName} ${browserVersion}`,
          os: `${platform()} ${release()}`,
          cpu: cpus()[0]?.model,
          logicalCpuCount: cpus().length,
          totalMemoryBytes: totalmem(),
          freeMemoryBytesAtReport: freemem(),
          viewport: fixture.viewport,
          devicePixelRatio: fixture.devicePixelRatio,
          network: "loopback; datasets generated before measurement",
        },
        workload: {
          seed: "deterministic arithmetic fixture",
          table: "100,000 logical rows × 20 declared columns; one semantic filter; descending metric sort; 420px compact viewport",
          trend: "50,000 one-minute raw points; one series; 51 missing values; known global extrema",
          warmupPerComponent: 1,
          measuredSamplesPerComponent: 7,
          lifecycleCycles: 25,
          dataPreparationMs: fixture.preparationMs,
          independentEquivalentTableFilterSortMs: fixture.queryMs,
        },
        table,
        trend,
        cleanup: {
          forcedGcHeapUsedBytesEveryFiveCycles: heapSamples,
          retainedGrowthBytes,
          emptyDomAfterEveryUnmount: true,
          acceptanceLimitBytes: 8 * 1024 * 1024,
        },
        limitations:
          "One local Apple/Chromium environment and synthetic in-memory data. Observable time ends after two animation frames; trace Paint duration is CPU event time, not GPU pixel completion. The independent query sample is equivalent preparation measured outside React; component totals also include their own filter/sort. This does not establish field INP, remote-data cost, other browsers/devices, or a universal support limit.",
      },
      null,
      2,
      ) + "\n",
    );
  }
  await session.detach();
});

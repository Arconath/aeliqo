import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { availablePort } from "../scripts/browser-test-port";

test("focused filter draft survives resize and IME; keyboard history and motion remain usable", async ({ page }) => {
  const bridgePort = await availablePort();
  const companionPort = await availablePort();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/?aeliqoBridgePort=${bridgePort}&aeliqoCompanionPort=${companionPort}`);
  const session = await page.context().newCDPSession(page);
  await session.send("Performance.enable");
  const before = await session.send("Performance.getMetrics");
  const events: { name: string; dur?: number }[] = [];
  session.on("Tracing.dataCollected", event => {
    for (const raw of event.value) {
      const item = raw as unknown as { name?: unknown; dur?: unknown };
      if (typeof item.name === "string") events.push({ name: item.name, dur: typeof item.dur === "number" ? item.dur : undefined });
    }
  });
  await session.send("Tracing.start", { categories: "devtools.timeline", transferMode: "ReportEvents" });
  await page.getByRole("tab", { name: "Documentation", exact: true }).click();
  await page.locator('nav[aria-label="Documentation topics"] a[href="#docs-components"]').click();
  const input = page.getByLabel("Value", { exact: true });
  await input.fill("Small cohort");
  await input.focus();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("Small cohort");
  await input.dispatchEvent("compositionstart", { data: "Small cohort" });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Committed filters" })).toBeEmpty();
  await input.dispatchEvent("compositionend", { data: "Small cohort" });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Committed filters" })).toContainText("Small cohort");
  await expect(input).toBeFocused();
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
  await page.screenshot({ path: "test-results/filter-mobile-ime.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole("tab", { name: "Showcase", exact: true }).click();
  // Target the stable baseline block rather than depending on its human title.
  const baseline = page.locator('[data-node-id="baseline"]');
  const pinButton = baseline.locator(".aeliqo-pin");
  await pinButton.focus();
  await page.keyboard.press("Enter");
  await expect(pinButton).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Undo", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(pinButton).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Redo", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(pinButton).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Price × performance", exact: true }).click();
  await expect(page.locator('[data-node-id="smart-correlation"] svg')).toBeVisible();
  const complete = new Promise<void>(resolve => session.once("Tracing.tracingComplete", () => resolve()));
  await session.send("Tracing.end");
  await complete;
  const after = await session.send("Performance.getMetrics");
  const start = Object.fromEntries(before.metrics.map(metric => [metric.name, metric.value]));
  const end = Object.fromEntries(after.metrics.map(metric => [metric.name, metric.value]));
  const duration = (name: string) => events.filter(event => event.name === name).reduce((sum, event) => sum + (event.dur ?? 0), 0) / 1000;
  writeFileSync("docs/evidence/browser-workspace-quality.json", JSON.stringify({
    environment: "Production Vite preview; Playwright Chromium; reduced motion; 1440px→390px→1440px",
    workload: "Documentation Filter IME submit and resize; pin, undo, redo; price/performance composition",
    measuredAt: new Date().toISOString(),
    scriptMs: (end.ScriptDuration! - start.ScriptDuration!) * 1000,
    layoutMs: (end.LayoutDuration! - start.LayoutDuration!) * 1000,
    paintEventMs: duration("Paint"),
    paintEvents: events.filter(event => event.name === "Paint").length,
    heapUsedBeforeBytes: start.JSHeapUsedSize, heapUsedAfterBytes: end.JSHeapUsedSize,
    domNodesBefore: start.Nodes, domNodesAfter: end.Nodes,
    limitations: "Single bounded interaction scenario; heap includes allocations before garbage collection. Paint event duration is CPU trace time, not end-to-end pixels or GPU time. No universal performance budget or leak claim.",
  }, null, 2) + "\n");
  await session.detach();
});

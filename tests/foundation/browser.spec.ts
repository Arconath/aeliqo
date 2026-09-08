import {expect, test} from "@playwright/test";

test.beforeEach(async ({page}) => {
  await page.goto("/tests/foundation/index.html");
  await expect.poll(() => page.evaluate(() => (window as typeof window & {aeliqoFoundationReady?: boolean}).aeliqoFoundationReady)).toBe(true);
});

test("native action controls submit, reset and cancellation exactly once", async ({page}) => {
  const form = page.locator("#action-form");
  const draft = page.locator("#draft");
  await draft.fill("changed");
  await page.locator("#submit").locator("button").click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & {aeliqoFoundationStats: () => {submits: number; resets: number; submittedEntries: readonly [string, FormDataEntryValue][]}}).aeliqoFoundationStats().submits)).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as typeof window & {aeliqoFoundationStats: () => {submits: number; resets: number; submittedEntries: readonly [string, FormDataEntryValue][]}}).aeliqoFoundationStats().submittedEntries)).toEqual([["draft", "changed"], ["intent", "save"]]);
  expect(await page.evaluate(() => (window as typeof window & {aeliqoFoundationEvents: {kind: string; event: CustomEvent}[]}).aeliqoFoundationEvents.filter((entry) => entry.kind === "action").map((entry) => entry.event.detail))).toEqual([{source: "user", action: "button", type: "submit"}]);
  expect(await page.locator("#submit").getAttribute("type")).toBe("submit");
  await page.locator("#cancelled").locator("button").click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & {aeliqoFoundationStats: () => {submits: number; resets: number}}).aeliqoFoundationStats().submits)).toBe(1);
  await page.locator("#reset").locator("button").click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & {aeliqoFoundationStats: () => {submits: number; resets: number}}).aeliqoFoundationStats().resets)).toBe(1);
  await expect(draft).toHaveValue("initial");

  const submit = page.locator("#submit");
  await submit.evaluate((element) => { (element as HTMLElement & {pending: boolean}).pending = true; });
  await expect(submit.locator("button")).toBeDisabled();
  await submit.locator("button").press("Enter").catch(() => undefined);
  await expect.poll(() => page.evaluate(() => (window as typeof window & {aeliqoFoundationStats: () => {submits: number; resets: number}}).aeliqoFoundationStats().submits)).toBe(1);
  await expect(page.locator("#icon button")).toHaveAttribute("aria-label", "Open details");
});

test("links, identity fallback, hierarchy and composed foundations retain semantics", async ({page}) => {
  await expect(page.locator("#unsafe-link").locator("a")).toHaveCount(0);
  await expect(page.locator("#external-link").locator("a")).toHaveAttribute("target", "_blank");
  await expect(page.locator("#external-link").locator("a")).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.locator("#avatar").locator("[part=initials]")).toHaveText("AL");
  await expect(page.locator("#avatar").locator("[part=avatar]")).toHaveAttribute("role", "img");
  await expect(page.locator("#heading").locator("h3")).toHaveClass(/display/);
  await expect(page.locator("#composition").locator("aeliqo-stack")).toHaveCount(1);
  await expect(page.locator("#composition").locator("aeliqo-grid")).toHaveCount(1);
  await expect(page.locator("#scroll").locator("[part=scroll]")).toHaveAttribute("role", "region");
  await expect(page.locator("#scroll").locator("[part=scroll]")).toHaveAttribute("aria-label", "Results");
});

test("split pane provides keyboard and RTL pointer semantics", async ({page}) => {
  const split = page.locator("#split");
  const splitter = split.locator("[part=splitter]");
  await splitter.focus();
  await splitter.press("ArrowRight");
  await expect(splitter).toHaveAttribute("aria-valuenow", "55");
  await splitter.press("Home");
  await expect(splitter).toHaveAttribute("aria-valuenow", "20");
  await splitter.press("End");
  await expect(splitter).toHaveAttribute("aria-valuenow", "80");
  const box = await splitter.boundingBox();
  if (box === null) throw new Error("splitter is not measurable");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 40, box.y + box.height / 2);
  await page.mouse.up();
  await expect(splitter).toHaveAttribute("aria-valuenow", "20");
  await page.locator("html").evaluate((element) => {(element as HTMLElement).dir = "rtl";});
  await splitter.press("End");
  await splitter.press("ArrowRight");
  await expect(splitter).toHaveAttribute("aria-valuenow", "75");
  const eventCount = await page.evaluate(() => (window as typeof window & {aeliqoFoundationEvents: unknown[]}).aeliqoFoundationEvents.length);
  expect(eventCount).toBeGreaterThanOrEqual(4);
});

test("mount and dispose leaves no foundation nodes behind", async ({page}) => {
  await page.evaluate(() => {
    for (let index = 0; index < 100; index += 1) {
      const element = document.createElement("aeliqo-split-pane");
      element.innerHTML = '<span slot="start">start</span><span slot="end">end</span>';
      document.body.append(element);
      element.remove();
    }
  });
  await expect(page.locator("body > aeliqo-split-pane")).toHaveCount(0);
});

test("forced colors, RTL and large text preserve visible controls", async ({page}) => {
  await page.emulateMedia({forcedColors: "active", reducedMotion: "reduce"});
  await page.locator("html").evaluate((element) => {(element as HTMLElement).dir = "rtl";});
  await page.locator("body").evaluate((element) => {element.style.fontSize = "200%";});
  await expect(page.locator("#submit button")).toBeVisible();
  await expect(page.locator("#icon button")).toBeVisible();
  await expect(page.locator("#split [part=splitter]")).toBeVisible();
  await expect(page.locator("#scroll [part=scroll]")).toBeVisible();
  const overflow = await page.locator("#fixture").evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(overflow).toBe(false);
});

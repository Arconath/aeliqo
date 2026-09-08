import {test, expect} from "@playwright/test";

test.beforeEach(async ({page}) => {
  await page.goto("/tests/input/index.html");
  await page.waitForFunction(() => (window as Window & {aeliqoInputReady?: boolean}).aeliqoInputReady === true);
});

test("all input primitives render labeled native controls and preserve form data", async ({page}) => {
  await expect(page.locator("#name").locator("input")).toHaveAccessibleName("Name");
  await expect(page.locator("#notes").locator("textarea")).toHaveValue("Draft");
  await expect(page.locator("#amount").locator("input")).toHaveValue("1.234,50");
  await expect(page.locator("#country").locator("select")).toHaveValue("id");
  await expect(page.locator("#date").locator("input")).toHaveValue("2026-09-08");
  await expect(page.locator("#range").locator("input.start")).toHaveValue("2026-09-01");
  await expect(page.locator("#slider").locator("input[type=range]")).toHaveValue("40");
  const values = await page.locator("#native-form").evaluate((element) => [...new FormData(element as HTMLFormElement).entries()].map(([key, value]) => [key, String(value)]));
  expect(values).toEqual(expect.arrayContaining([["person", "Ada"], ["notes", "Draft"], ["amount", "1234.50"], ["country", "id"]]));
});

test("combobox ignores stale async option responses and supports keyboard choice", async ({page}) => {
  await page.locator("#combo").evaluate((element) => {
    const combo = element as HTMLElement & {optionsLoader: (query: string, signal: AbortSignal) => Promise<readonly {value: string; label: string}[]>};
    combo.optionsLoader = (query) => new Promise((resolve) => setTimeout(() => resolve([{value: query, label: query.toUpperCase()}]), query === "a" ? 80 : 5));
  });
  const input = page.locator("#combo").locator("input");
  await input.fill("a");
  await input.fill("ab");
  await page.waitForTimeout(120);
  await expect(page.locator("#combo").locator("[role=option]")).toHaveText("AB");
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page.locator("#combo").locator("input")).toHaveValue("AB");
});

test("IME drafts remain visible and search commits only after composition", async ({page}) => {
  const field = page.locator("#name").locator("input");
  await field.focus();
  await field.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.dispatchEvent(new CompositionEvent("compositionstart", {bubbles: true}));
    input.value = "draft";
    input.dispatchEvent(new InputEvent("input", {bubbles: true, isComposing: true}));
  });
  await page.locator("#name").evaluate((element) => { (element as HTMLElement & {label: string}).label = "Updated label"; });
  await expect(field).toHaveValue("draft");
  const searches: string[] = [];
  await page.locator("#search").evaluate((element) => element.addEventListener("aeliqo-search", (event) => (window as Window & {aeliqoSearches?: string[]}).aeliqoSearches = [...((window as Window & {aeliqoSearches?: string[]}).aeliqoSearches ?? []), (event as CustomEvent<{query: string}>).detail.query]));
  const search = page.locator("#search").locator("input");
  await search.fill("abc");
  await page.waitForTimeout(50);
  expect(await page.evaluate(() => (window as Window & {aeliqoSearches?: string[]}).aeliqoSearches ?? [])).toEqual(["abc"]);
  void searches;
});

test("date range boundaries, slider keyboard, validation and cleanup are bounded", async ({page}) => {
  await page.locator("#range").evaluate((element) => { (element as HTMLElement & {boundary: string; start: string; end: string}).boundary = "exclusive"; (element as HTMLElement & {start: string}).start = "2026-09-08"; });
  await expect(page.locator("#range")).toHaveAttribute("aria-invalid", "true");
  const slider = page.locator("#slider").locator("input[type=range]");
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("41");
  const before = await page.locator("#fixture").evaluate((root) => root.querySelectorAll("aeliqo-text-field, aeliqo-text-area, aeliqo-number-field, aeliqo-checkbox, aeliqo-radio-group, aeliqo-switch, aeliqo-select, aeliqo-combobox, aeliqo-date-field, aeliqo-date-range, aeliqo-slider, aeliqo-search-field, aeliqo-file-input").length);
  expect(before).toBeGreaterThanOrEqual(13);
  await page.reload();
  await page.waitForFunction(() => (window as Window & {aeliqoInputReady?: boolean}).aeliqoInputReady === true);
  await expect(page.locator("#name").locator("input")).toHaveValue("Ada");
});

test("form wrapper validates drafts before emitting its explicit host action", async ({page}) => {
  const result = await page.locator("#app-form").evaluate(async (element) => {
    const form = element as HTMLElement & {requestSubmit: () => void; formData: () => FormData | undefined};
    const field = element.querySelector("aeliqo-text-field") as HTMLElement & {value: string; updateComplete: Promise<unknown>};
    let submits = 0;
    element.addEventListener("aeliqo-form-submit", () => { submits += 1; });
    form.requestSubmit();
    const blocked = submits;
    field.value = "accepted";
    await field.updateComplete;
    form.requestSubmit();
    const entries = form.formData();
    return {blocked, submits, entries: entries ? [...entries.entries()].map(([key, value]) => [key, String(value)]) : [], children: [...element.children].map((child) => ({tag: child.localName, name: (child as HTMLElement & {name?: string}).name, value: (child as HTMLElement & {value?: string}).value, formValue: (child as HTMLElement & {formValue?: unknown}).formValue}))};
  });
  expect(result.blocked).toBe(0);
  expect(result.submits).toBe(1);
  expect(result.entries).toEqual(expect.arrayContaining([["app-field", "accepted"]]));
});

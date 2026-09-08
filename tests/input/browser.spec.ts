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

test("form wrapper bridges slotted native buttons, Enter and form data", async ({page}) => {
  const result = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>("#fixture");
    if (root === null) throw new Error("fixture missing");
    const form = document.createElement("aeliqo-form") as HTMLElement & {formData: () => FormData | undefined; updateComplete: Promise<unknown>};
    const input = document.createElement("input");
    input.name = "native-name";
    input.required = true;
    input.value = "Ada";
    input.defaultValue = "Ada";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.name = "save";
    submit.textContent = "Save";
    const reset = document.createElement("button");
    reset.type = "reset";
    reset.textContent = "Reset";
    let submits = 0;
    form.addEventListener("aeliqo-form-submit", () => { submits += 1; });
    form.append(input, submit, reset);
    root.append(form);
    await form.updateComplete;
    submit.click();
    const clickSubmit = submits;
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter", bubbles: true, cancelable: true}));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const enterSubmit = submits;
    const data = [...(form.formData()?.entries() ?? [])].map(([key, value]) => [key, String(value)]);
    input.value = "changed";
    reset.click();
    return {clickSubmit, enterSubmit, data, resetValue: input.value};
  });
  expect(result).toEqual({clickSubmit: 1, enterSubmit: 2, data: [["native-name", "Ada"]], resetValue: "Ada"});
});

test("form wrapper honors a trusted child-cancelled submit click", async ({page}) => {
  await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>("#fixture");
    if (root === null) throw new Error("fixture missing");
    const form = document.createElement("aeliqo-form") as HTMLElement & {updateComplete: Promise<unknown>};
    form.id = "cancelled-click-form";
    const submit = document.createElement("button");
    submit.type = "submit";
    const label = document.createElement("span");
    label.textContent = "Cancelled";
    submit.append(label);
    submit.addEventListener("click", (event) => event.preventDefault());
    let submits = 0;
    form.addEventListener("aeliqo-form-submit", () => { submits += 1; });
    form.append(submit);
    root.append(form);
    await form.updateComplete;
    (window as Window & {cancelledClickSubmits?: number}).cancelledClickSubmits = submits;
  });
  await page.locator("#cancelled-click-form span").click();
  expect(await page.evaluate(() => (window as Window & {cancelledClickSubmits?: number}).cancelledClickSubmits)).toBe(0);
});

test("form wrapper defers child Enter behavior and respects native ownership", async ({page}) => {
  await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>("#fixture");
    if (root === null) throw new Error("fixture missing");
    const form = document.createElement("aeliqo-form") as HTMLElement & {formData: () => FormData | undefined; updateComplete: Promise<unknown>};
    form.id = "semantics-form";
    const notes = document.createElement("textarea");
    notes.name = "notes";
    notes.defaultValue = "draft";
    notes.value = "draft";
    const required = document.createElement("input");
    required.name = "required";
    required.required = true;
    const fieldset = document.createElement("fieldset");
    fieldset.disabled = true;
    const disabled = document.createElement("input");
    disabled.name = "disabled-field";
    disabled.value = "secret";
    fieldset.append(disabled);
    const normal = document.createElement("button");
    normal.type = "submit";
    normal.textContent = "Normal";
    const bypass = document.createElement("button");
    bypass.type = "submit";
    bypass.formNoValidate = true;
    const bypassLabel = document.createElement("span");
    bypassLabel.textContent = "Bypass";
    bypass.append(bypassLabel);
    const customNotes = document.createElement("aeliqo-text-area") as HTMLElement & {value: string; updateComplete: Promise<unknown>};
    customNotes.name = "custom-notes";
    customNotes.value = "draft";
    const combo = document.createElement("aeliqo-combobox") as HTMLElement & {options: readonly {value: string; label: string}[]; updateComplete: Promise<unknown>};
    combo.options = [{value: "a", label: "Alpha"}, {value: "b", label: "Beta"}];
    const select = document.createElement("aeliqo-select") as HTMLElement & {options: readonly {value: string; label: string}[]; updateComplete: Promise<unknown>};
    select.options = [{value: "a", label: "Alpha"}, {value: "b", label: "Beta"}];
    const submits = {form: 0, nested: 0};
    form.addEventListener("aeliqo-form-submit", () => { submits.form += 1; });
    form.append(notes, required, fieldset, normal, bypass, customNotes, combo, select);
    root.append(form);
    await Promise.all([form.updateComplete, customNotes.updateComplete, combo.updateComplete, select.updateComplete]);
    (window as Window & {formSemantics?: {form: HTMLElement; submits: typeof submits}}).formSemantics = {form, submits};
  });

  const notes = page.locator("#semantics-form > textarea");
  await notes.press("Enter");
  await page.waitForTimeout(10);
  const afterTextarea = await page.locator("#semantics-form").evaluate((element) => {
    const state = (window as Window & {formSemantics?: {submits: {form: number}}}).formSemantics;
    return {value: (element.querySelector("textarea") as HTMLTextAreaElement).value, submits: state?.submits.form ?? -1};
  });
  expect(afterTextarea.submits).toBe(0);
  expect(afterTextarea.value.replace("\n", "")).toBe("draft");

  await page.locator("#semantics-form").locator("button").filter({hasText: "Normal"}).click();
  const afterBlocked = await page.locator("#semantics-form").evaluate(() => (window as Window & {formSemantics?: {submits: {form: number}}}).formSemantics?.submits.form ?? -1);
  expect(afterBlocked).toBe(0);
  await page.locator("#semantics-form").locator("button").filter({hasText: "Bypass"}).locator("span").click();
  const afterBypass = await page.locator("#semantics-form").evaluate(() => (window as Window & {formSemantics?: {submits: {form: number}}}).formSemantics?.submits.form ?? -1);
  expect(afterBypass).toBe(1);

  await page.locator("#semantics-form aeliqo-text-area").locator("textarea").press("Enter");
  await page.locator("#semantics-form aeliqo-combobox").locator("input").press("ArrowDown");
  await page.locator("#semantics-form aeliqo-combobox").locator("input").press("Enter");
  await page.locator("#semantics-form aeliqo-select").locator("select").press("Enter");
  await page.waitForTimeout(10);
  const final = await page.locator("#semantics-form").evaluate((element) => {
    const state = (window as Window & {formSemantics?: {submits: {form: number}}}).formSemantics;
    const data = element instanceof HTMLElement && "formData" in element ? (element as HTMLElement & {formData: () => FormData | undefined}).formData() : undefined;
    return {submits: state?.submits.form ?? -1, customNotes: (element.querySelector("aeliqo-text-area") as HTMLElement & {value: string}).value, combo: (element.querySelector("aeliqo-combobox") as HTMLElement & {value: string}).value, disabled: data?.get("disabled-field") ?? null};
  });
  expect(final.submits).toBe(1);
  expect(final.customNotes.replace("\n", "")).toBe("draft");
  expect(final.combo).toBe("b");
  expect(final.disabled).toBeNull();
});

test("nested and externally owned controls stay with their owning form", async ({page}) => {
  await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>("#fixture");
    if (root === null) throw new Error("fixture missing");
    const submits = {outer: 0, inner: 0, external: 0};
    const outer = document.createElement("aeliqo-form") as HTMLElement & {updateComplete: Promise<unknown>};
    outer.id = "nested-outer";
    const inner = document.createElement("aeliqo-form") as HTMLElement & {updateComplete: Promise<unknown>};
    inner.id = "nested-inner";
    const innerInput = document.createElement("input");
    innerInput.name = "inner";
    innerInput.value = "inner";
    inner.append(innerInput);
    outer.append(inner);
    outer.addEventListener("aeliqo-form-submit", (event) => { if (event.target === outer) submits.outer += 1; });
    inner.addEventListener("aeliqo-form-submit", (event) => { if (event.target === inner) submits.inner += 1; });
    root.append(outer);

    const external = document.createElement("form");
    external.id = "external-owner";
    const wrapped = document.createElement("aeliqo-form") as HTMLElement & {updateComplete: Promise<unknown>};
    wrapped.id = "nested-external-wrapper";
    const externalInput = document.createElement("input");
    externalInput.name = "external";
    externalInput.value = "external";
    const externalSubmit = document.createElement("button");
    externalSubmit.type = "submit";
    externalSubmit.textContent = "External";
    wrapped.append(externalInput, externalSubmit);
    external.addEventListener("submit", (event) => { event.preventDefault(); submits.external += 1; });
    external.append(wrapped);
    root.append(external);
    await Promise.all([outer.updateComplete, inner.updateComplete, wrapped.updateComplete]);
    (window as Window & {nestedFormSubmits?: typeof submits}).nestedFormSubmits = submits;
  });

  await page.locator("#nested-inner > input").press("Enter");
  await page.waitForTimeout(10);
  const nested = await page.evaluate(() => (window as Window & {nestedFormSubmits?: {outer: number; inner: number; external: number}}).nestedFormSubmits);
  expect(nested).toEqual({outer: 0, inner: 1, external: 0});

  await page.locator("#external-owner input").press("Enter");
  await page.waitForTimeout(10);
  const counts = await page.evaluate(() => {
    const external = document.querySelector<HTMLFormElement>("#external-owner");
    const wrapped = document.querySelector<HTMLElement>("#nested-external-wrapper");
    const submits = (window as Window & {nestedFormSubmits?: {outer: number; inner: number; external: number}}).nestedFormSubmits;
    return {
      submits,
      externalData: [...new FormData(external as HTMLFormElement).entries()].map(([key, value]) => [key, String(value)]),
      wrappedData: wrapped && "formData" in wrapped ? [...((wrapped as HTMLElement & {formData: () => FormData}).formData()).entries()] : [],
    };
  });
  expect(counts).toEqual({
    submits: {outer: 0, inner: 1, external: 1},
    externalData: [["external", "external"]],
    wrappedData: [],
  });
});

test("combobox keeps its selected label and active descendant synchronized", async ({page}) => {
  const state = await page.locator("#combo").evaluate(async (element) => {
    const combo = element as HTMLElement & {
      options: readonly {value: string; label: string}[];
      value: string;
      updateComplete: Promise<unknown>;
    };
    combo.options = [
      {value: "a", label: "Alpha"},
      {value: "b", label: "Beta"},
    ];
    combo.value = "a";
    await combo.updateComplete;
    const input = combo.shadowRoot?.querySelector<HTMLInputElement>("input[part=input]");
    if (input === null || input === undefined) throw new Error("combobox input missing");
    const selectedLabel = input.value;
    input.focus();
    await combo.updateComplete;
    const focused = input.getAttribute("aria-activedescendant");
    input.dispatchEvent(new KeyboardEvent("keydown", {key: "ArrowDown", bubbles: true, cancelable: true}));
    await combo.updateComplete;
    const moved = input.getAttribute("aria-activedescendant");
    input.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape", bubbles: true, cancelable: true}));
    await combo.updateComplete;
    return {selectedLabel, focused, moved, closed: input.getAttribute("aria-activedescendant"), list: combo.shadowRoot?.querySelector("[role=listbox]") !== null};
  });
  expect(state).toEqual({selectedLabel: "Alpha", focused: "option-0", moved: "option-1", closed: null, list: false});
});

test("text fields are uncontrolled by default and searches only commit user proposals", async ({page}) => {
  const state = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>("#fixture");
    if (root === null) throw new Error("fixture missing");
    const field = document.createElement("aeliqo-text-field") as HTMLElement & {defaultValue: string; updateComplete: Promise<unknown>};
    field.defaultValue = "Ada";
    root.append(field);
    const search = document.createElement("aeliqo-search-field") as HTMLElement & {queryOnInput: boolean; debounceMs: number; value: string; updateComplete: Promise<unknown>};
    search.queryOnInput = true;
    search.debounceMs = 0;
    let searches = 0;
    search.addEventListener("aeliqo-search", () => { searches += 1; });
    root.append(search);
    await Promise.all([field.updateComplete, search.updateComplete]);
    const native = field.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (native === null || native === undefined) throw new Error("text input missing");
    native.value = "Lin";
    native.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertText", data: "Lin"}));
    await field.updateComplete;
    const afterEdit = {native: native.value, value: (field as HTMLElement & {value: string}).value};
    await search.updateComplete;
    const afterMount = searches;
    search.value = "programmatic";
    await search.updateComplete;
    const afterProgrammatic = searches;
    const searchInput = search.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (searchInput === null || searchInput === undefined) throw new Error("search input missing");
    searchInput.value = "user";
    searchInput.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertText", data: "user"}));
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {afterEdit, afterMount, afterProgrammatic, afterUser: searches};
  });
  expect(state).toEqual({afterEdit: {native: "Lin", value: "Lin"}, afterMount: 0, afterProgrammatic: 0, afterUser: 1});
});

test("stale text validation cannot mark a newer programmatic value invalid", async ({page}) => {
  const state = await page.evaluate(async () => {
    const root = document.querySelector<HTMLElement>("#fixture");
    if (root === null) throw new Error("fixture missing");
    const field = document.createElement("aeliqo-text-field") as HTMLElement & {
      value: string;
      validator: (value: string, signal: AbortSignal) => Promise<string | boolean>;
      updateComplete: Promise<unknown>;
      error: string;
    };
    const pending: Array<(result: string | boolean) => void> = [];
    field.validator = (value) => new Promise((resolve) => {
      if (value === "old") pending.push(resolve);
      else resolve(true);
    });
    root.append(field);
    await field.updateComplete;
    const input = field.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (input === null || input === undefined) throw new Error("text input missing");
    input.value = "old";
    input.dispatchEvent(new InputEvent("input", {bubbles: true, inputType: "insertText", data: "old"}));
    await field.updateComplete;
    field.value = "new";
    await field.updateComplete;
    for (const resolve of pending) resolve("Old value invalid");
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {value: field.value, error: field.error, state: (field as HTMLElement & {validationState: string}).validationState};
  });
  expect(state).toEqual({value: "new", error: "", state: "idle"});
});

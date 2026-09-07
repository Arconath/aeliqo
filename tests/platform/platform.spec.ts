import {test, expect} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {html} from "lit";
import {renderAeliqo} from "../../packages/web/src/server.js";

test("vanilla embedding keeps controlled events, forms, focus and style isolation", async ({page}) => {
  await page.goto("/index.html");
  const input = page.locator("#standalone-form aeliqo-input").locator("input");
  await expect(input).toHaveValue("Ada");

  await input.fill("Lin");
  await expect(page.locator("#standalone-status")).toHaveText("Draft: Lin");
  await expect(input).toHaveValue("Lin");

  await input.focus();
  await input.evaluate((element) => (element as HTMLInputElement).setSelectionRange(2, 2));
  const focusedInsideShadow = await page.locator("#standalone-form aeliqo-input").evaluate((element) => {
    const nativeInput = element.shadowRoot?.querySelector("input");
    return document.activeElement === element && element.shadowRoot?.activeElement === nativeInput;
  });
  expect(focusedInsideShadow).toBe(true);

  const shadowStyle = await page.locator("#standalone-form aeliqo-input").evaluate((element) => {
    const style = element.shadowRoot?.querySelector("style");
    const nativeInput = element.shadowRoot?.querySelector("input");
    return {
      nonce: style?.getAttribute("nonce"),
      hasAdoptedStyleSheet: (element.shadowRoot?.adoptedStyleSheets.length ?? 0) > 0,
      color: nativeInput === null || nativeInput === undefined ? "" : getComputedStyle(nativeInput).color,
    };
  });
  expect(shadowStyle.nonce === "t02nonce" || shadowStyle.hasAdoptedStyleSheet).toBe(true);
  expect(shadowStyle.color).not.toBe("rgb(255, 0, 0)");

  await page.locator("#standalone-form aeliqo-input").evaluate((element) => {
    (element as HTMLElement & {value: string}).value = "Externally accepted";
  });
  await expect(input).toHaveValue("Externally accepted");
  const focusAfterControlledUpdate = await page.locator("#standalone-form aeliqo-input").evaluate((element) => {
    const nativeInput = element.shadowRoot?.querySelector("input");
    return document.activeElement === element && element.shadowRoot?.activeElement === nativeInput;
  });
  expect(focusAfterControlledUpdate).toBe(true);
  const caretAfterControlledUpdate = await input.evaluate((element) => ({
    start: (element as HTMLInputElement).selectionStart,
    end: (element as HTMLInputElement).selectionEnd,
  }));
  expect(caretAfterControlledUpdate).toEqual({start: 2, end: 2});

  await page.locator("#standalone-fieldset").evaluate((element) => {
    (element as HTMLFieldSetElement).disabled = true;
  });
  await expect(input).toBeDisabled();
  const disabledSubmitted = await page.locator("#standalone-form").evaluate((element) => {
    const form = element as HTMLFormElement;
    return new FormData(form).get("person");
  });
  expect(disabledSubmitted).toBeNull();
  await page.locator("#standalone-fieldset").evaluate((element) => {
    (element as HTMLFieldSetElement).disabled = false;
  });
  await expect(input).toBeEnabled();
  const enabledSubmitted = await page.locator("#standalone-form").evaluate((element) => {
    const form = element as HTMLFormElement;
    return new FormData(form).get("person");
  });
  expect(enabledSubmitted).toBe("Externally accepted");

  await page.getByRole("button", {name: "Reset"}).click();
  await expect(input).toHaveValue("Ada");
  const submitted = await page.locator("#standalone-form").evaluate((element) => {
    const form = element as HTMLFormElement;
    return new FormData(form).get("person");
  });
  expect(submitted).toBe("Ada");

  const axe = await new AxeBuilder({page}).include("#standalone-root").analyze();
  expect(axe.violations).toEqual([]);
});

test("a rejected controlled edit cannot become native form data", async ({page}) => {
  await page.goto("/index.html");
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>("#standalone-form");
    if (form === null) {
      throw new Error("form missing");
    }
    form.replaceChildren();
    const input = document.createElement("aeliqo-input");
    input.setAttribute("label", "Locked");
    input.setAttribute("name", "locked");
    input.setAttribute("value", "fixed");
    form.append(input);
  });

  const input = page.locator("#standalone-form aeliqo-input").locator("input");
  await expect(input).toHaveValue("fixed");
  await input.fill("rejected");
  await expect(input).toHaveValue("fixed");
  const submitted = await page.locator("#standalone-form").evaluate((element) => {
    const form = element as HTMLFormElement;
    return new FormData(form).get("locked");
  });
  expect(submitted).toBe("fixed");
});

test("property-only names remain form-associated", async ({page}) => {
  await page.goto("/index.html");
  await page.evaluate(async () => {
    const form = document.querySelector<HTMLFormElement>("#standalone-form");
    if (form === null) {
      throw new Error("form missing");
    }
    form.replaceChildren();
    const input = document.createElement("aeliqo-input") as HTMLElement & {
      name: string;
      value: string;
      updateComplete: Promise<unknown>;
    };
    input.setAttribute("label", "Property name");
    input.name = "person-property";
    input.value = "Ada";
    input.addEventListener("aeliqo-input", (event) => {
      input.value = (event as CustomEvent<{readonly value: string}>).detail.value;
    });
    form.append(input);
    await input.updateComplete;
  });

  const input = page.locator("#standalone-form aeliqo-input").locator("input");
  await input.fill("Lin");
  const submitted = await page.locator("#standalone-form").evaluate((element) => {
    const form = element as HTMLFormElement;
    return {
      name: form.querySelector("aeliqo-input")?.getAttribute("name"),
      value: new FormData(form).get("person-property"),
    };
  });
  expect(submitted).toEqual({name: "person-property", value: "Lin"});
});

test("IME composition preserves drafts across host updates and commits once", async ({page}) => {
  await page.goto("/index.html");
  const result = await page.evaluate(async () => {
    const form = document.querySelector<HTMLFormElement>("#standalone-form");
    if (form === null) {
      throw new Error("form missing");
    }
    form.replaceChildren();
    const element = document.createElement("aeliqo-input") as HTMLElement & {
      name: string;
      value: string;
      updateComplete: Promise<unknown>;
    };
    element.name = "ime";
    element.value = "base";
    const state = {accept: true, proposals: [] as string[]};
    element.addEventListener("aeliqo-input", (event) => {
      const value = (event as CustomEvent<{readonly value: string}>).detail.value;
      state.proposals.push(value);
      if (state.accept) {
        element.value = value;
      }
    });
    form.append(element);
    await element.updateComplete;
    const input = element.shadowRoot?.querySelector<HTMLInputElement>("input");
    if (input === null || input === undefined) {
      throw new Error("native input missing");
    }

    const run = async (draft: string, accept: boolean) => {
      state.accept = accept;
      element.value = "base";
      await element.updateComplete;
      input.focus();
      input.value = draft;
      input.setSelectionRange(2, 2);
      input.dispatchEvent(new CompositionEvent("compositionstart", {bubbles: true}));
      element.value = "host update";
      await element.updateComplete;
      const preserved = {
        value: input.value,
        start: input.selectionStart,
        end: input.selectionEnd,
      };
      input.dispatchEvent(new CompositionEvent("compositionend", {bubbles: true}));
      await element.updateComplete;
      const afterCompositionEnd = {
        value: input.value,
        formValue: new FormData(form).get("ime"),
        proposalCount: state.proposals.length,
      };
      input.dispatchEvent(new Event("input", {bubbles: true}));
      await element.updateComplete;
      return {
        preserved,
        afterCompositionEnd,
        trailingProposalCount: state.proposals.length,
      };
    };

    return {
      accepted: await run("draft accepted", true),
      rejected: await run("draft rejected", false),
      proposals: state.proposals,
    };
  });

  expect(result).toEqual({
    accepted: {
      preserved: {value: "draft accepted", start: 2, end: 2},
      afterCompositionEnd: {value: "draft accepted", formValue: "draft accepted", proposalCount: 1},
      trailingProposalCount: 1,
    },
    rejected: {
      preserved: {value: "draft rejected", start: 2, end: 2},
      afterCompositionEnd: {value: "host update", formValue: "host update", proposalCount: 2},
      trailingProposalCount: 2,
    },
    proposals: ["draft accepted", "draft rejected"],
  });
});

test("Enter bridges to the associated form with validation and composition guards", async ({page}) => {
  await page.goto("/index.html");
  await page.evaluate(() => {
    const form = document.querySelector<HTMLFormElement>("#standalone-form");
    if (form === null) {
      throw new Error("form missing");
    }
    (form as HTMLFormElement & {submitState?: unknown[]}).submitState = [];
    form.addEventListener("submit", (event) => {
      const state = form as HTMLFormElement & {submitState: unknown[]};
      state.submitState.push({
        value: new FormData(form).get("person"),
        submitter: (event as SubmitEvent).submitter?.textContent?.trim() ?? null,
      });
    });
  });

  const input = page.locator("#standalone-form aeliqo-input").locator("input");
  await input.press("Enter");
  const firstSubmission = await page.locator("#standalone-form").evaluate((element) => {
    return (element as HTMLFormElement & {submitState: unknown[]}).submitState;
  });
  expect(firstSubmission).toEqual([{value: "Ada", submitter: "Submit"}]);

  await page.locator("#standalone-form aeliqo-input").evaluate((element) => {
    (element as HTMLElement & {value: string}).value = "";
  });
  await input.press("Enter");
  const invalidSubmission = await page.locator("#standalone-form").evaluate((element) => {
    return (element as HTMLFormElement & {submitState: unknown[]}).submitState;
  });
  expect(invalidSubmission).toEqual([{value: "Ada", submitter: "Submit"}]);

  await page.locator("#standalone-form aeliqo-input").evaluate((element) => {
    const host = element as HTMLElement & {value: string; readOnly: boolean};
    host.value = "Ada";
    host.readOnly = true;
  });
  await input.press("Enter");
  const readOnlySubmission = await page.locator("#standalone-form").evaluate((element) => {
    return (element as HTMLFormElement & {submitState: unknown[]}).submitState;
  });
  expect(readOnlySubmission).toEqual([{value: "Ada", submitter: "Submit"}]);

  await page.locator("#standalone-form aeliqo-input").evaluate((element) => {
    (element as HTMLElement & {readOnly: boolean}).readOnly = false;
  });
  await page.locator("#standalone-form aeliqo-input").evaluate((element) => {
    (element as HTMLElement & {disabled: boolean}).disabled = true;
  });
  await input.evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent("keydown", {bubbles: true, key: "Enter"}));
  });
  const disabledSubmission = await page.locator("#standalone-form").evaluate((element) => {
    return (element as HTMLFormElement & {submitState: unknown[]}).submitState;
  });
  expect(disabledSubmission).toEqual([{value: "Ada", submitter: "Submit"}]);
  await page.locator("#standalone-form aeliqo-input").evaluate((element) => {
    (element as HTMLElement & {disabled: boolean}).disabled = false;
  });
  await input.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent("compositionstart", {bubbles: true}));
    element.dispatchEvent(new KeyboardEvent("keydown", {bubbles: true, key: "Enter"}));
  });
  const composingSubmission = await page.locator("#standalone-form").evaluate((element) => {
    return (element as HTMLFormElement & {submitState: unknown[]}).submitState;
  });
  expect(composingSubmission).toEqual([{value: "Ada", submitter: "Submit"}]);
});

test("strict script CSP blocks injected inline code while the fixture remains interactive", async ({page}) => {
  await page.goto("/index.html");
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.textContent = "document.body.dataset.inlineExecuted = 'yes'";
    document.head.append(script);
  });
  expect(await page.locator("body").getAttribute("data-inline-executed")).toBeNull();
  await expect(page.locator("#standalone-root aeliqo-table")).toBeVisible();
});

test("React and Vue consume the same registered web elements", async ({page}) => {
  await page.goto("/react.html");
  const reactInput = page.locator("#react-form aeliqo-input").locator("input");
  await expect(reactInput).toHaveValue("React");
  await reactInput.fill("React updated");
  await expect(page.locator("#react-value")).toHaveText("React updated");
  await expect(page.locator("aeliqo-table").locator("tbody tr")).toHaveCount(2);

  await page.goto("/vue.html");
  const vueInput = page.locator("#vue-form aeliqo-input").locator("input");
  await expect(vueInput).toHaveValue("Vue");
  await vueInput.fill("Vue updated");
  await expect(page.locator("#vue-value")).toHaveText("Vue updated");
  await expect(page.locator("aeliqo-chart").locator("details")).toBeVisible();
});

test("SSR declarative shadow content upgrades and hydrates without duplication", async ({page}) => {
  const serverMarkup = await renderAeliqo(html`
    <main>
      <aeliqo-input label="Name" value="Ada" name="person"></aeliqo-input>
    </main>
  `);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/ssr-document", async (route) => {
    await route.fulfill({status: 200, contentType: "text/html", body: serverMarkup});
  });
  await page.goto("/ssr-document");

  const registryBefore = await page.evaluate(() => customElements.get("aeliqo-input"));
  expect(registryBefore).toBeUndefined();

  const before = await page.locator("aeliqo-input").evaluate((element) => ({
    hasShadow: element.shadowRoot !== null,
    inputCount: element.shadowRoot?.querySelectorAll("input").length ?? 0,
  }));
  expect(before).toEqual({hasShadow: true, inputCount: 1});

  const serverInput = page.locator("aeliqo-input").locator("input");
  const serverInputHandle = await serverInput.elementHandle();
  if (serverInputHandle === null) {
    throw new Error("server input missing");
  }
  await serverInput.fill("typed before hydration");
  await serverInput.focus();
  await page.addScriptTag({url: `${new URL("/src/hydrate.ts", page.url())}`, type: "module"});
  await page.waitForFunction(() => {
    const constructor = customElements.get("aeliqo-input");
    const element = document.querySelector("aeliqo-input");
    return constructor !== undefined && element instanceof constructor;
  });
  await expect(serverInput).toHaveValue("typed before hydration");

  const after = await page.locator("aeliqo-input").evaluate((element) => ({
    inputCount: element.shadowRoot?.querySelectorAll("input").length ?? 0,
    shadowTemplateCount: element.shadowRoot?.querySelectorAll("template").length ?? 0,
    focused: document.activeElement === element && element.shadowRoot?.activeElement?.localName === "input",
  }));
  expect(after).toEqual({inputCount: 1, shadowTemplateCount: 0, focused: true});
  const sameInputNode = await page.locator("aeliqo-input").evaluate(
    (element, originalInput) => element.shadowRoot?.querySelector("input") === originalInput,
    serverInputHandle,
  );
  expect(sameInputNode).toBe(true);
  await serverInputHandle.dispose();
  expect(pageErrors).toEqual([]);
});

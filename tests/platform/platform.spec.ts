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
  expect(pageErrors).toEqual([]);
});

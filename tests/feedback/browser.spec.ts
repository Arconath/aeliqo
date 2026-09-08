import {expect, test} from "@playwright/test";

test.beforeEach(async ({page}) => {
  await page.goto("/tests/feedback/index.html");
  await expect.poll(() => page.evaluate(() => (window as typeof window & {aeliqoFeedbackReady?: boolean}).aeliqoFeedbackReady)).toBe(true);
});

test("tooltip is supplemental, focusable and dismissible", async ({page}) => {
  const tooltip = page.locator("#tooltip");
  const trigger = tooltip.getByRole("button", {name: "Help"});
  await expect(trigger).toHaveAccessibleName("Help");
  await trigger.focus();
  await expect(tooltip.locator("[role=tooltip]")).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-describedby", /content/);
  await trigger.hover();
  const surface = tooltip.locator("[role=tooltip]");
  const triggerBox = await trigger.boundingBox();
  const surfaceBox = await surface.boundingBox();
  if (triggerBox === null || surfaceBox === null) throw new Error("Tooltip geometry is unavailable.");
  await page.mouse.move(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height + 2);
  await page.mouse.move(surfaceBox.x + surfaceBox.width / 2, surfaceBox.y + surfaceBox.height / 2);
  await page.waitForTimeout(150);
  await expect(surface).toBeVisible();
  await trigger.press("Escape");
  await expect(tooltip.locator("[role=tooltip]")).toBeHidden();
  await expect(trigger).toHaveAccessibleName("Help");
});

test("popover distinguishes nonmodal dismissal from modal focus containment", async ({page}) => {
  const popover = page.locator("#popover");
  const trigger = popover.getByRole("button", {name: "Details"});
  await trigger.click();
  const firstSurface = popover.locator("[part=popover]");
  await expect(firstSurface).toBeVisible();
  const action = popover.getByRole("button", {name: "Popover action"});
  await action.focus();
  await popover.evaluate((element) => {(element as HTMLElement & {modal: boolean}).modal = true;});
  const modalSurface = popover.locator("[part=popover]");
  await expect(modalSurface).toHaveAttribute("aria-modal", "true");
  await expect(action).toBeFocused();
  await popover.evaluate((element) => {(element as HTMLElement & {modal: boolean}).modal = false;});
  await expect(popover.locator("[part=popover]")).toHaveAttribute("aria-modal", "false");
  await expect(action).toBeFocused();
  await page.locator("#after").click();
  await expect(popover.locator("[part=popover]")).toBeHidden();

  await popover.evaluate((element) => {(element as HTMLElement & {modal: boolean}).modal = true;});
  await trigger.click();
  const surface = popover.locator("[part=popover]");
  await expect(surface).toHaveAttribute("aria-modal", "true");
  const close = popover.getByRole("button", {name: "Close"});
  await action.focus();
  await action.press("Tab");
  await expect(close).toBeFocused();
  await close.press("Shift+Tab");
  await expect(action).toBeFocused();
  await action.press("Escape");
  await expect(surface).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("dialog uses native modal semantics and returns focus", async ({page}) => {
  const dialog = page.locator("#dialog");
  const before = page.locator("#before");
  await before.focus();
  await dialog.evaluate((element) => {(element as HTMLElement & {open: boolean}).open = true;});
  const nativeDialog = dialog.locator("dialog");
  await expect(nativeDialog).toBeVisible();
  await expect.poll(() => nativeDialog.evaluate((element) => element.matches(":modal"))).toBe(true);
  const action = dialog.getByRole("button", {name: "Continue"});
  const close = dialog.getByRole("button", {name: "Close"});
  await action.focus();
  await action.press("Tab");
  await expect(close).toBeFocused();
  await close.press("Shift+Tab");
  await expect(action).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(nativeDialog).toBeHidden();
  await expect(before).toBeFocused();

  await dialog.evaluate((element) => {const value = element as HTMLElement & {modal: boolean; open: boolean}; value.modal = false; value.open = true;});
  await expect.poll(() => nativeDialog.evaluate((element) => element.matches(":modal"))).toBe(false);
  await expect(action).toBeVisible();
  await action.focus();
  await dialog.evaluate((element) => {(element as HTMLElement & {modal: boolean}).modal = true;});
  await expect.poll(() => nativeDialog.evaluate((element) => element.matches(":modal"))).toBe(true);
  await expect(action).toBeFocused();
  await close.click();
  await expect(nativeDialog).toBeHidden();
});

test("dialog focus containment skips hidden slotted controls", async ({page}) => {
  const dialog = page.locator("#focus-dialog");
  await dialog.evaluate((element) => {(element as HTMLElement & {open: boolean}).open = true;});
  const close = dialog.getByRole("button", {name: "Close"});
  const real = dialog.getByRole("button", {name: "Real"});
  await close.focus();
  await close.press("Shift+Tab");
  await expect(real).toBeFocused();
});

test("dialog focus containment follows nested shadow controls", async ({page}) => {
  const dialog = page.locator("#nested-dialog");
  await dialog.evaluate((element) => {(element as HTMLElement & {open: boolean}).open = true;});
  const close = dialog.getByRole("button", {name: "Close"});
  const nested = dialog.getByRole("button", {name: "Nested control"});
  await nested.focus();
  await nested.press("Tab");
  await expect(close).toBeFocused();
  await close.press("Shift+Tab");
  await expect(nested).toBeFocused();
});

test("drawer keeps inline and modal modes separate", async ({page}) => {
  const drawer = page.locator("#drawer");
  await drawer.evaluate((element) => {(element as HTMLElement & {open: boolean}).open = true;});
  await expect(drawer.locator("[part=inline]")).toBeVisible();
  await expect(drawer.locator("dialog")).toHaveCount(0);
  const drawerAction = drawer.getByRole("button", {name: "Drawer action"});
  await drawerAction.focus();
  await drawer.evaluate((element) => {const value = element as HTMLElement & {mode: string}; value.mode = "modal";});
  await expect(drawer.locator("[part=modal]")).toBeVisible();
  await expect.poll(() => drawer.locator("dialog").evaluate((element) => element.matches(":modal"))).toBe(true);
  await expect(drawerAction).toBeFocused();
  await drawer.evaluate((element) => {const value = element as HTMLElement & {mode: string}; value.mode = "inline";});
  await expect(drawer.locator("[part=inline]")).toBeVisible();
  await expect(drawerAction).toBeFocused();
  await drawer.getByRole("button", {name: "Close"}).click();
  await expect(drawer.locator("dialog")).toBeHidden();
});

test("toast, alert and progress expose honest status states", async ({page}) => {
  const toast = page.locator("#toast");
  await toast.evaluate((element) => {(element as HTMLElement & {open: boolean}).open = true;});
  await expect(toast.locator("[role=status]")).toBeVisible();
  await expect(toast.locator("[role=status]")).toBeHidden();
  await toast.evaluate((element) => {const value = element as HTMLElement & {open: boolean; tone: string; duration: number}; value.tone = "danger"; value.duration = 20; value.open = true;});
  await page.waitForTimeout(80);
  await expect(toast.locator("[role=alert]")).toBeVisible();
  await toast.getByRole("button", {name: "Dismiss"}).click();

  const alert = page.locator("#alert");
  await expect(alert.locator("[role=alert]")).toBeVisible();
  await alert.getByRole("button", {name: "Review"}).click();
  await expect.poll(() => page.evaluate(() => {const events = (window as typeof window & {aeliqoFeedbackEvents: CustomEvent[]}).aeliqoFeedbackEvents; return events?.[events.length - 1]?.detail;})).toMatchObject({source: "user"});
  await alert.getByRole("button", {name: "Dismiss"}).click();
  await expect(alert.locator("[role=alert]")).toBeHidden();

  const determinate = page.locator("#determinate").locator("progress");
  await expect(determinate).toHaveAttribute("value", "100");
  const indeterminate = page.locator("#indeterminate").locator("[role=progressbar]");
  await expect(indeterminate).toHaveAttribute("aria-valuetext", "In progress");
  await expect(indeterminate).not.toHaveAttribute("aria-valuenow", /./);

  const skeleton = page.locator("#skeleton").locator("[part=skeleton]");
  await expect(skeleton).toHaveRole("status");
  await expect(skeleton).toHaveAttribute("aria-label", "Loading records");
  await expect(skeleton.locator("[part=line]")).toHaveCount(3);
  await page.emulateMedia({reducedMotion: "reduce"});
  await expect.poll(() => skeleton.locator("[part=line]").first().evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  const empty = page.locator("#empty");
  await expect(empty.locator("[part=state]")).toHaveAttribute("data-kind", "no-matches");
  await empty.getByRole("button", {name: "Clear filter"}).click();
  await expect.poll(() => page.evaluate(() => {const events = (window as typeof window & {aeliqoFeedbackEvents: CustomEvent[]}).aeliqoFeedbackEvents; return events?.[events.length - 1]?.detail;})).toMatchObject({kind: "no-matches", source: "user"});
  await empty.evaluate((element) => {(element as HTMLElement & {kind: string}).kind = "forbidden";});
  await expect(empty.locator("[role=alert]")).toHaveAttribute("data-kind", "forbidden");
  await empty.evaluate((element) => {(element as HTMLElement & {kind: string}).kind = "loading";});
  await expect(empty.locator("[role=status]")).toHaveAttribute("aria-busy", "true");
  await expect(empty.getByRole("button", {name: "Clear filter"})).toHaveCount(0);
  await empty.evaluate((element) => {(element as HTMLElement & {kind: string}).kind = "failure";});
  await expect(empty.locator("[role=alert]")).toHaveAttribute("data-kind", "failure");
});

test("feedback remains usable at narrow RTL text scale", async ({page}) => {
  await page.setViewportSize({width: 360, height: 720});
  await page.locator("html").evaluate((element) => {(element as HTMLElement).dir = "rtl";});
  await page.locator("body").evaluate((element) => {element.style.fontSize = "125%";});
  await expect(page.locator("#tooltip button")).toBeVisible();
  await expect(page.locator("#alert [part=alert]")).toBeVisible();
  const overflow = await page.locator("#fixture").evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(overflow).toBe(false);
});

test('nonmodal popover does not steal focus on open or listener policy updates',async({page})=>{
 const popover=page.locator('#popover');const trigger=popover.getByRole('button',{name:'Details'});
 await trigger.click();await expect(popover.locator('[part=popover]')).toBeVisible();
 await expect(trigger).toBeFocused();
 await page.locator('#before').focus();
 await popover.evaluate(async(el:any)=>{el.closeOnOutside=false;await el.updateComplete;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 await expect(page.locator('#before')).toBeFocused();
});

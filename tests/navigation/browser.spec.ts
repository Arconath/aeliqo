import {expect, test} from "@playwright/test";

test.beforeEach(async ({page}) => {
  await page.goto("/tests/navigation/index.html");
  await expect.poll(() => page.evaluate(() => (window as typeof window & {aeliqoNavigationReady?: boolean}).aeliqoNavigationReady)).toBe(true);
});

test("tabs preserve named panels and keyboard activation policy", async ({page}) => {
  const tabs = page.locator("#tabs");
  const overview = tabs.getByRole("tab", {name: "Overview"});
  const details = tabs.getByRole("tab", {name: "Details"});
  await expect(overview).toHaveAttribute("aria-controls", /overview/);
  await expect(overview).toHaveAttribute("aria-selected", "true");
  await expect(tabs.getByRole("tabpanel").filter({hasText: "Overview content"})).toBeVisible();
  await overview.focus();
  await overview.press("ArrowRight");
  await expect(details).toBeFocused();
  await expect(details).toHaveAttribute("aria-selected", "true");
  await expect(tabs.getByRole("tabpanel").filter({hasText: "Details content"})).toBeVisible();
  await expect(tabs.getByRole("tab", {name: "Disabled"})).toBeDisabled();

  await tabs.evaluate((element) => {(element as HTMLElement & {activation: string}).activation = "manual";});
  await details.focus();
  await details.press("ArrowLeft");
  await expect(overview).toBeFocused();
  await expect(details).toHaveAttribute("aria-selected", "true");
  const beforeEnter = await page.evaluate(() => (window as typeof window & {aeliqoNavigationEvents: CustomEvent[]}).aeliqoNavigationEvents.length);
  await overview.press("Enter");
  await expect(overview).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => page.evaluate(() => (window as typeof window & {aeliqoNavigationEvents: CustomEvent[]}).aeliqoNavigationEvents.length)).toBe(beforeEnter + 1);
  await details.click();
  await tabs.evaluate((element) => {const value = element as HTMLElement & {items: readonly {id: string; label: string; content: string}[]}; value.items = value.items.map((item) => ({...item}));});
  await expect(details).toHaveAttribute("aria-selected", "true");
  await tabs.evaluate((element) => {const value = element as HTMLElement & {items: readonly {id: string; label: string; content: string}[]}; value.items = [{id: "a b", label: "Space", content: "Space"}, {id: "a?b", label: "Question", content: "Question"}];});
  const tabControls = await tabs.getByRole("tab").evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-controls")));
  expect(new Set(tabControls).size).toBe(2);
});

test("breadcrumb and pagination retain approved navigation and page scope", async ({page}) => {
  const breadcrumb = page.locator("#breadcrumb");
  await expect(breadcrumb.locator("a")).toHaveCount(1);
  await expect(breadcrumb.locator("a")).toHaveAttribute("href", "/home");
  await expect(breadcrumb.getByText("Unsafe")).toHaveCount(1);
  await expect(breadcrumb.getByText("Unsafe")).not.toHaveAttribute("href", /./);
  await expect(breadcrumb.locator("[aria-current=page]")).toHaveText("Current");
  await breadcrumb.locator("a").click();
  await expect.poll(() => page.evaluate(() => {const events = (window as typeof window & {aeliqoNavigationEvents: CustomEvent[]}).aeliqoNavigationEvents; return events?.[events.length - 1]?.detail;})).toMatchObject({id: "home", source: "user"});

  const pagination = page.locator("#pagination");
  await expect(pagination.getByText("Page 2 of 3")).toBeVisible();
  await pagination.getByRole("button", {name: "Next page"}).click();
  await expect(pagination.getByText("Page 3 of 3")).toBeVisible();
  await expect(pagination.getByRole("button", {name: "Next page"})).toBeDisabled();
  await expect.poll(() => page.evaluate(() => {const events = (window as typeof window & {aeliqoNavigationEvents: CustomEvent[]}).aeliqoNavigationEvents; return events?.[events.length - 1]?.detail;})).toMatchObject({page: 3, direction: "next", source: "user"});
});

test("menu returns focus and tree navigation keeps stable node identity", async ({page}) => {
  const menu = page.locator("#menu");
  const trigger = menu.getByRole("button", {name: "Menu"});
  await trigger.click();
  await expect(menu.getByRole("menu")).toBeVisible();
  const open = menu.getByRole("menuitem", {name: "Open"});
  await open.focus();
  await open.press("Enter");
  await expect(menu.getByRole("menu")).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await menu.getByRole("menuitem", {name: "Open"}).press("Escape");
  await expect(menu.getByRole("menu")).toBeHidden();

  const tree = page.locator("#tree");
  const reports = tree.getByRole("treeitem", {name: "Reports"});
  await reports.focus();
  await reports.press("ArrowRight");
  await expect(tree.getByRole("treeitem", {name: "Weekly"})).toBeVisible();
  await reports.press("ArrowDown");
  await expect(tree.getByRole("treeitem", {name: "Weekly"})).toBeFocused();
  await tree.getByRole("treeitem", {name: "Weekly"}).press("Enter");
  await expect(tree.getByRole("treeitem", {name: "Weekly"})).toHaveAttribute("aria-selected", "true");
  await expect(tree.getByRole("treeitem", {name: "Settings"})).toHaveAttribute("aria-disabled", "true");
  await expect.poll(() => page.evaluate(() => {const events = (window as typeof window & {aeliqoNavigationEvents: CustomEvent[]}).aeliqoNavigationEvents.filter((event) => event.type === "aeliqo-tree-nav-select"); return events?.[events.length - 1]?.detail;})).toMatchObject({id: "weekly", source: "user"});
});

test("navigation remains readable on a narrow RTL viewport", async ({page}) => {
  await page.setViewportSize({width: 360, height: 720});
  await page.locator("html").evaluate((element) => {(element as HTMLElement).dir = "rtl";});
  await page.locator("body").evaluate((element) => {element.style.fontSize = "125%";});
  await expect(page.locator("#tabs [role=tablist]")).toBeVisible();
  await expect(page.locator("#breadcrumb nav")).toBeVisible();
  const overflow = await page.locator("#fixture").evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(overflow).toBe(false);
});

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

test("scoped themes coexist without styling host and remain usable in RTL forced colors", async ({ page }) => {
  const { metric, filter } = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
    import { createRequire } from 'node:module';
    import { Metric } from './packages/react/src/metric.tsx';
    import { Filter } from './packages/react/src/filter.tsx';
    const require = createRequire(new URL('./packages/react/package.json', 'file://' + process.cwd() + '/'));
    const { createElement } = require('react');
    const { renderToString } = require('react-dom/server');
    const metric = renderToString(createElement(Metric, {label:'Active records',value:42}));
    const filter = renderToString(createElement(Filter,{dataset:{id:'teams',entity:'Team',label:'Teams',identity:'id',labelField:'name',dimensions:[{key:'name',label:'Name'}],metrics:[],timeFields:[]},filters:[],onChange:()=>{}}));
    console.log(JSON.stringify({metric,filter}));
  `], { encoding: "utf8" })) as { metric: string; filter: string };
  await page.setContent(`<style>body{margin:16px;color:rgb(80,20,30);font-family:serif}#host{padding:7px;border:2px solid rgb(30,40,50)}</style><button id="host">Host control</button><div id="light" data-aeliqo-theme="light">${metric}<div id="dark" data-aeliqo-theme="dark">${metric}<div id="nested-light" data-aeliqo-theme="light">${metric}</div>${filter}</div></div>`);
  const hostBefore = await page.locator("#host").evaluate(element => { const css = getComputedStyle(element); const body = getComputedStyle(document.body); return { color: css.color, font: css.fontFamily, border: css.border, bodyColor: body.color, bodyFont: body.fontFamily }; });
  await page.addStyleTag({ content: readFileSync(new URL("../packages/react/src/styles.css", import.meta.url), "utf8") });
  const hostAfter = await page.locator("#host").evaluate(element => { const css = getComputedStyle(element); const body = getComputedStyle(document.body); return { color: css.color, font: css.fontFamily, border: css.border, bodyColor: body.color, bodyFont: body.fontFamily }; });
  expect(hostAfter).toEqual(hostBefore);
  await expect(page.locator("#light > .aeliqo-card")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator("#dark > .aeliqo-card").first()).toHaveCSS("background-color", "rgb(27, 38, 52)");
  await expect(page.locator("#nested-light > .aeliqo-card")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await page.getByLabel("Field", { exact: true }).focus();
  await expect(page.getByLabel("Field", { exact: true })).toHaveCSS("outline-style", "solid");
  await page.screenshot({ path: "test-results/themes-coexist.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#light").evaluate(element => { element.setAttribute("dir", "rtl"); (element as HTMLElement).style.zoom = "2"; });
  await expect(page.locator("#light > .aeliqo-card")).toHaveCSS("direction", "rtl");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.locator("#host").evaluate(element => { (element as HTMLElement).style.transition = "opacity 1s"; });
  await expect(page.locator("#host")).toHaveCSS("transition-duration", "1s");
  await page.getByLabel("Field", { exact: true }).focus();
  await expect(page.getByLabel("Field", { exact: true })).toHaveCSS("outline-style", "solid");
  await page.screenshot({ path: "test-results/themes-rtl-200percent-forced-colors.png", fullPage: true });
});

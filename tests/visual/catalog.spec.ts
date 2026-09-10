import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import components from '../../harness/components.json' with {type:'json'};
// These are unapproved review captures, never auto-accepted pixel baselines.
for(const component of components.components)for(const variant of ['desktop-light','narrow-dark-rtl'] as const){
 const id=component.id.slice(component.id.indexOf('.')+1);
 test(`${id} ${variant}`,async({page},info)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.setViewportSize(variant==='desktop-light'?{width:1280,height:900}:{width:360,height:800});
  await page.emulateMedia({colorScheme:variant==='desktop-light'?'light':'dark'});
  await page.goto(`/tests/visual/index.html?component=${id}&variant=${variant}`);
  await page.waitForFunction(()=>Boolean((window as typeof window&{aeliqoReviewReady?:boolean}).aeliqoReviewReady));
  await expect(page.locator(`#fixture aeliqo-${id}`).first()).toBeAttached();
  const axe=await new AxeBuilder({page}).analyze();
  await info.attach('accessibility.json',{body:JSON.stringify({violations:axe.violations,incomplete:axe.incomplete},null,2),contentType:'application/json'});
  const measurements=await page.evaluate(()=>({viewport:{width:innerWidth,height:innerHeight},documentWidth:document.documentElement.scrollWidth,rootFontSize:getComputedStyle(document.documentElement).fontSize,theme:document.documentElement.dataset.theme,dir:document.documentElement.dir,devicePixelRatio,renderedText:document.body.innerText}));
  await info.attach('environment.json',{body:JSON.stringify({browser:page.context().browser()?.version(),project:info.project.name,...measurements},null,2),contentType:'application/json'});
  await page.screenshot({path:info.outputPath('review.png'),fullPage:true});
  expect(errors).toEqual([]);
  expect(axe.violations.map(({id,impact,nodes})=>({id,impact,nodes:nodes.map(({target,failureSummary})=>({target,failureSummary}))}))).toEqual([]);
  expect(measurements.documentWidth).toBeLessThanOrEqual(measurements.viewport.width);
  if(variant==='narrow-dark-rtl'&&id==='quality-panel'){
   const columns=await page.locator('aeliqo-quality-panel').evaluate(element=>getComputedStyle(element.shadowRoot!.querySelector('dl')!).gridTemplateColumns);
   expect(columns.trim().split(/\s+/)).toHaveLength(1);
  }
  if(variant==='narrow-dark-rtl'&&id==='timeline'){
   const direction=await page.locator(`aeliqo-${id}`).evaluate(element=>getComputedStyle(element.shadowRoot!.querySelector('[part="viewport"]')!).direction);
   expect(direction).toBe('ltr');
  }
  if(variant==='narrow-dark-rtl'&&id==='investigation'){
   const direction=await page.locator('aeliqo-investigation').evaluate(element=>{const trend=element.shadowRoot!.querySelector('aeliqo-trend')!;return getComputedStyle(trend.shadowRoot!.querySelector('[part="viewport"]')!).direction;});
   expect(direction).toBe('ltr');
  }
 });
}

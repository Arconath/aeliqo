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
   const layout=await page.locator(`aeliqo-${id}`).evaluate(element=>{const root=element.shadowRoot!;const viewport=root.querySelector<HTMLElement>('[part="viewport"]')!;const data=root.querySelector<HTMLElement>('[part="data"]')!;const graphic=viewport.querySelector('svg')!.getBoundingClientRect();const viewportBox=viewport.getBoundingClientRect();return{direction:getComputedStyle(viewport).direction,dataOverflow:data.scrollWidth-data.clientWidth,graphicStart:graphic.left-viewportBox.left,graphicEnd:viewportBox.right-graphic.right};});
   expect(layout.direction).toBe('ltr');
   expect(layout.dataOverflow).toBeLessThanOrEqual(1);
   expect(layout.graphicStart).toBeGreaterThanOrEqual(-1);
   expect(layout.graphicEnd).toBeGreaterThanOrEqual(-1);
  }
  if(variant==='narrow-dark-rtl'&&id==='investigation'){
   const layout=await page.locator('aeliqo-investigation').evaluate(element=>{const trend=element.shadowRoot!.querySelector('aeliqo-trend')!;const root=trend.shadowRoot!;const viewport=root.querySelector<HTMLElement>('[part="viewport"]')!;const data=root.querySelector<HTMLElement>('[part="data"]')!;const graphic=viewport.querySelector('svg')!.getBoundingClientRect();const viewportBox=viewport.getBoundingClientRect();return{direction:getComputedStyle(viewport).direction,dataOverflow:data.scrollWidth-data.clientWidth,graphicStart:graphic.left-viewportBox.left,graphicEnd:viewportBox.right-graphic.right};});
   expect(layout.direction).toBe('ltr');
   expect(layout.dataOverflow).toBeLessThanOrEqual(1);
   expect(layout.graphicStart).toBeGreaterThanOrEqual(-1);
   expect(layout.graphicEnd).toBeGreaterThanOrEqual(-1);
  }
  if(variant==='narrow-dark-rtl'&&['relationship','tree','treemap'].includes(id)){
   const layout=await page.locator(`aeliqo-${id}`).evaluate(element=>{const root=element.shadowRoot!;const host=element.getBoundingClientRect();const viewport=root.querySelector<HTMLElement>('[part="viewport"]')!;const viewportBox=viewport.getBoundingClientRect();const graphic=viewport.querySelector('svg')!.getBoundingClientRect();const data=root.querySelector<HTMLElement>('[part="data"]')!;const caption=root.querySelector('caption')!.getBoundingClientRect();const cells=[...root.querySelectorAll<HTMLElement>('tbody tr:first-child td')].map(cell=>({display:getComputedStyle(cell).display,width:cell.getBoundingClientRect().width}));return{hostStart:host.left,hostEnd:host.right,direction:getComputedStyle(viewport).direction,graphicStart:graphic.left-viewportBox.left,graphicEnd:viewportBox.right-graphic.right,dataOverflow:data.scrollWidth-data.clientWidth,captionStart:caption.left,captionEnd:caption.right,cells};});
   expect(layout.direction).toBe('ltr');
   expect(layout.graphicStart).toBeGreaterThanOrEqual(-1);
   expect(layout.graphicEnd).toBeGreaterThanOrEqual(-1);
   expect(layout.dataOverflow).toBeLessThanOrEqual(1);
   expect(layout.captionStart).toBeGreaterThanOrEqual(layout.hostStart-1);
   expect(layout.captionEnd).toBeLessThanOrEqual(layout.hostEnd+1);
   expect(layout.cells.length).toBeGreaterThan(1);
   expect(layout.cells.every(cell=>cell.display==='grid'&&cell.width>=layout.hostEnd-layout.hostStart-1)).toBe(true);
  }
  if(variant==='narrow-dark-rtl'&&id==='heatmap'){
   const labels=await page.locator('aeliqo-heatmap').evaluate(element=>{const svg=element.shadowRoot!.querySelector('svg')!;const graphic=svg.getBoundingClientRect();return [...svg.querySelectorAll<SVGTextElement>('text')].map(label=>{const box=label.getBoundingClientRect();return{text:label.textContent,start:box.left,end:box.right,graphicStart:graphic.left,graphicEnd:graphic.right};});});
   expect(labels.length).toBeGreaterThan(0);
   for(const label of labels){expect(label.start,`${label.text} starts outside the heatmap`).toBeGreaterThanOrEqual(label.graphicStart-.5);expect(label.end,`${label.text} ends outside the heatmap`).toBeLessThanOrEqual(label.graphicEnd+.5);}
  }
  if(variant==='narrow-dark-rtl'&&id==='calendar-grid'){
   const layout=await page.locator('aeliqo-calendar-grid').evaluate(element=>{const root=element.shadowRoot!;const host=element.getBoundingClientRect();const data=root.querySelector<HTMLElement>('[part="data"]')!;const cells=[...root.querySelectorAll<HTMLElement>('tbody tr:first-child td')].map(cell=>({display:getComputedStyle(cell).display,width:cell.getBoundingClientRect().width,text:cell.textContent}));return{hostWidth:host.width,dataOverflow:data.scrollWidth-data.clientWidth,cells};});
   expect(layout.dataOverflow).toBeLessThanOrEqual(1);
   expect(layout.cells.length).toBeGreaterThan(4);
   expect(layout.cells.every(cell=>cell.display==='grid'&&cell.width>=layout.hostWidth-1&&cell.text?.trim())).toBe(true);
  }
  if(variant==='narrow-dark-rtl'&&id==='breakdown'){
   const layout=await page.locator('aeliqo-breakdown').evaluate(element=>{const host=element.getBoundingClientRect();const table=element.shadowRoot!.querySelector('aeliqo-table')!;const root=table.shadowRoot!;const scroll=root.querySelector<HTMLElement>('[part="scroll"]')!;const caption=root.querySelector('caption')!.getBoundingClientRect();const scope=root.querySelector<HTMLElement>('[part="scope"]')!.getBoundingClientRect();const cells=[...root.querySelectorAll<HTMLElement>('tbody tr:first-child td')].map(cell=>({display:getComputedStyle(cell).display,width:cell.getBoundingClientRect().width}));return{hostStart:host.left,hostEnd:host.right,scrollOverflow:scroll.scrollWidth-scroll.clientWidth,captionStart:caption.left,captionEnd:caption.right,scopeStart:scope.left,scopeEnd:scope.right,cells};});
   expect(layout.scrollOverflow).toBeLessThanOrEqual(1);
   for(const [start,end] of [[layout.captionStart,layout.captionEnd],[layout.scopeStart,layout.scopeEnd]]){expect(start).toBeGreaterThanOrEqual(layout.hostStart-1);expect(end).toBeLessThanOrEqual(layout.hostEnd+1);}
   expect(layout.cells.length).toBeGreaterThan(1);
   expect(layout.cells.every(cell=>cell.display==='grid'&&cell.width>=layout.hostEnd-layout.hostStart-1)).toBe(true);
  }
  if(variant==='narrow-dark-rtl'&&id==='combobox'){
   const layout=await page.locator('aeliqo-combobox').evaluate(element=>{const host=element.getBoundingClientRect();const root=element.shadowRoot!;const nodes=[root.querySelector<HTMLElement>('[part="label"]')!,root.querySelector<HTMLInputElement>('[part="input"]')!,...root.querySelectorAll<HTMLElement>('[part="option"] span,[part="option"] small')];return{hostStart:host.left,hostEnd:host.right,nodes:nodes.map(node=>{const box=node.getBoundingClientRect();return{start:box.left,end:box.right,text:node.textContent};})};});
   expect(layout.nodes.length).toBeGreaterThan(2);
   for(const node of layout.nodes){expect(node.start,`${node.text} starts outside the combobox`).toBeGreaterThanOrEqual(layout.hostStart-.5);expect(node.end,`${node.text} ends outside the combobox`).toBeLessThanOrEqual(layout.hostEnd+.5);}
   const title=await page.locator('#title').evaluate(element=>{const box=element.getBoundingClientRect();const main=element.parentElement!.getBoundingClientRect();return{start:box.left,end:box.right,mainStart:main.left,mainEnd:main.right};});
   expect(title.start).toBeGreaterThanOrEqual(title.mainStart);
   expect(title.end).toBeLessThanOrEqual(title.mainEnd);
  }
 });
}

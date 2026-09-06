import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { writeFileSync } from "node:fs";
import { request } from "node:http";
import { availablePort } from "../scripts/browser-test-port";
import { receiptSchema } from "../packages/core/src/index";

test.beforeEach(async ({ page }) => {
  const bridgePort = await availablePort();
  const companionPort = await availablePort();
  await page.addInitScript(({ bridgePort, companionPort }) => {
    const url = new URL(location.href);
    if (!url.searchParams.has("aeliqoBridgePort"))
      url.searchParams.set("aeliqoBridgePort", String(bridgePort));
    if (!url.searchParams.has("aeliqoCompanionPort"))
      url.searchParams.set("aeliqoCompanionPort", String(companionPort));
    history.replaceState(null, "", url);
  }, { bridgePort, companionPort });
});

test("showcase morphs, links semantic selections and isolates unrelated updates", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Minimal starting workspace" })).toBeVisible();
  await page.getByRole("tab", { name: "Showcase", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Primitives", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  const baseline = page.locator('[data-node-id="baseline"]');
  const initial = await baseline.getAttribute("data-render-count");
  await page.getByRole("button", { name: "Price × performance" }).click();
  await expect(page.locator('[data-node-id="smart-correlation"]')).toBeVisible();
  await expect(page.locator('[data-node-id="smart-ranking"]')).toBeVisible();
  await expect(page.locator('[data-node-id="smart-inspection"]')).toBeVisible();
  await expect(page.getByText("0 JSX · 0 CSS · 0 JavaScript generated")).toBeVisible();
  expect(await baseline.getAttribute("data-render-count")).toBe(initial);
  const ranking = page.locator('[data-node-id="smart-ranking"]');
  const rankCount = await ranking.getAttribute("data-render-count");
  await ranking.getByRole("button", { name: /Gemini 3.5 Flash-Lite/ }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page
      .locator('[data-node-id="smart-inspection"]')
      .getByRole("heading", { name: "Gemini 3.5 Flash-Lite" }),
  ).toBeVisible();
  await expect(page.locator('[data-node-id="smart-correlation"] [data-selected="true"]')).toHaveCount(1);
  expect(await baseline.getAttribute("data-render-count")).toBe(initial);
  expect(await ranking.getAttribute("data-render-count")).not.toBe(rankCount);
  await page.getByRole("button", { name: "Capabilities", exact: true }).click();
  await expect(page.locator('[data-node-id="smart-matrix"]')).toBeVisible();
  await expect(page.locator('[data-node-id="smart-correlation"]')).toHaveCount(0);
  expect(await baseline.getAttribute("data-render-count")).toBe(initial);
  await page.getByRole("tab", { name: "Proof Lab", exact: true }).click();
  const timingText = await page
    .locator("article")
    .filter({ hasText: "Mutation & update timing" })
    .locator("pre")
    .innerText();
  const timing = JSON.parse(timingText) as {
    capabilityExecutionMs: number | null;
    coreWorkspaceMutationMs: number | null;
    reactUpdateObservedMs: number | null;
    componentsUpdated: string[];
    externalAgentMs: number | null;
  };
  expect(timing.coreWorkspaceMutationMs).not.toBeNull();
  expect(timing.reactUpdateObservedMs).not.toBeNull();
  expect(timing.componentsUpdated).toEqual(
    expect.arrayContaining(["smart-matrix", "smart-ranking", "smart-inspection"]),
  );
  writeFileSync(
    "docs/evidence/showcase-performance.json",
    JSON.stringify(
      {
        environment: "Production Vite preview in Playwright Chromium",
        workload: "Price/performance workspace transformed into capability landscape",
        ...timing,
        reactMeasurement: "Elapsed time from semantic plan dispatch until affected component effects committed; includes browser scheduling and excludes paint.",
        agentLatency: "Direct showcase plan; external agent latency not applicable and remains separately reported as null.",
      },
      null,
      2,
    ) + "\n",
  );
  await page.getByRole("tab", { name: "Showcase", exact: true }).click();
  const retainedRanking = page.locator('[data-node-id="smart-ranking"]');
  const selectedCount = await retainedRanking.getAttribute("data-render-count");
  await page.getByRole("button", { name: "Test isolated update" }).click();
  expect(await retainedRanking.getAttribute("data-render-count")).toBe(selectedCount);
  expect(await baseline.getAttribute("data-render-count")).not.toBe(initial);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/investigation-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Primitives", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Models by output-token price" }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /Output.*versus.*Published context capacity/i })).toBeVisible();
  await page.getByRole("tab", { name: "Explorer", exact: true }).click();
  await page.getByRole("button", { name: /Gemini 3.5 Flash-Lite/ }).click();
  await expect(
    page.getByRole("heading", { name: "Gemini 3.5 Flash-Lite" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await page
    .getByRole("button", { name: "Grok 4.3", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Grok 4.3" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Showcase", exact: true }).click();
  await expect(retainedRanking.locator(".aeliqo-bar-track").first()).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: "test-results/investigation-mobile.png",
    fullPage: true,
  });
  await page.getByRole("tab", {name:"Proof Lab",exact:true}).click();
  const directLog=page.locator("details").filter({hasText:"Direct primitive operations"});
  await directLog.locator("summary").click();
  await expect(directLog.locator("pre")).toContainText('"type": "select"');
  await expect(directLog.locator("pre")).toContainText('"source": "direct"');
  await page.screenshot({path:"test-results/proof-lab.png",fullPage:true});
  expect(errors).toEqual([]);
});

test("official MCP client mutates the live production browser and receives acknowledged revision", async ({
  page,
  baseURL,
}) => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "tests/fixtures/mcp-stdio.ts", baseURL!],
    cwd: process.cwd(),
    stderr: "pipe",
  });
  const bridgePort = new Promise<{port:number;token:string}>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("MCP fixture did not announce its port")), 10_000);
    let output = "";
    transport.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/AELIQO_TEST_BRIDGE_PORT=(\d+)/);
      const token = output.match(/AELIQO_TEST_PAIR_TOKEN=([a-f0-9]+)/);
      if (match && token) { clearTimeout(timer); resolve({port:Number(match[1]),token:token[1]!}); }
    });
  });
  const client = new Client({ name: "poc-acceptance-agent", version: "1.0.0" });
  try {
    await client.connect(transport);
    const {port,token} = await bridgePort;
    const deniedStatus = await new Promise<number | undefined>((resolve, reject) => {
      const upgrade = request(`http://127.0.0.1:${port}`, { headers: {
        Origin: "https://untrusted.example", Connection: "Upgrade", Upgrade: "websocket",
        "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
      }}, (response) => { response.resume(); resolve(response.statusCode); });
      upgrade.once("upgrade", (_response, socket) => { socket.destroy(); resolve(101); });
      upgrade.once("error", reject);
      upgrade.end();
    });
    expect(deniedStatus).toBe(401);
    await page.goto(`/?aeliqoBridgePort=${port}#aeliqoPairToken=${token}`);
    await expect(
      page.getByText("MCP bridge connected", { exact: true }),
    ).toBeVisible();
    const secondTab = await page.context().newPage();
    const rejectedPairing = new Promise<void>(resolve => {
      secondTab.on("websocket", socket => socket.on("close", () => resolve()));
    });
    await secondTab.goto(`/?aeliqoBridgePort=${port}#aeliqoPairToken=${token}`);
    await rejectedPairing;
    await expect(secondTab.getByText("MCP bridge offline", {exact:true})).toBeVisible();
    await secondTab.close();
    const catalog = await client.callTool({
      name: "catalog_search",
      arguments: {},
    });
    expect(JSON.stringify(catalog)).toContain("outputPrice");
    const query = await client.callTool({
      name: "data_query",
      arguments: {
        datasetId: "models",
        metric: "outputPrice",
        direction: "asc",
        limit: 1,
      },
    });
    expect(JSON.stringify(query)).toContain("Gemini 3.5 Flash-Lite");
    const inspected = await client.callTool({
      name: "workspace_inspect",
      arguments: {},
    });
    const content = inspected.content as { type: string; text: string }[];
    const state = JSON.parse(content[0]!.text) as { revision: number };
    const count = await page
      .locator('[data-node-id="baseline"]')
      .getAttribute("data-render-count");
    const applied = await client.callTool({
      name: "workspace_apply",
      arguments: {
        version: 1,
        baseRevision: state.revision,
        operations: [
          {
            type: "mount",
            node: {
              id: "agent-ranking",
              component: "Ranking",
              datasetId: "models",
              metric: "outputPrice",
              direction: "asc",
              title: "Agent: lowest output prices",
            },
          },
          {
            type: "mount",
            node: {
              id: "agent-detail",
              component: "Detail",
              datasetId: "models",
              title: "Agent: branch detail",
            },
          },
          {
            type: "connect",
            binding: {
              id: "agent-link",
              source: "agent-ranking",
              target: "agent-detail",
              entity: "Model",
            },
          },
        ],
      },
    });
    expect(applied.isError).not.toBe(true);
    const receipt = receiptSchema.parse(JSON.parse((applied.content as {text:string}[])[0]!.text));
    expect(receipt).toMatchObject({
      operation: "committed", revision: state.revision + 1,
      render: {status:"acknowledged",revision:state.revision + 1,evidence:"renderer-ack",visible:true},
      data: {status:"ready"}, outcome:"presented",
    });
    expect(receipt.changedNodeIds).toEqual(expect.arrayContaining(["agent-ranking", "agent-detail"]));
    expect(JSON.stringify(applied)).toContain(
      `\\"revision\\":${state.revision + 1}`,
    );
    await expect(
      page.getByRole("heading", { name: "Agent: lowest output prices" }),
    ).toBeVisible();
    await page
      .locator('[data-node-id="agent-ranking"]')
      .getByRole("button", { name: /Gemini 3.5 Flash-Lite/ })
      .click();
    await expect(
      page
        .locator('[data-node-id="agent-detail"]')
        .getByRole("heading", { name: "Gemini 3.5 Flash-Lite" }),
    ).toBeVisible();
    expect(
      await page
        .locator('[data-node-id="baseline"]')
        .getAttribute("data-render-count"),
    ).toBe(count);
    const rejected = await client.callTool({
      name: "workspace_apply",
      arguments: {
        version: 1,
        baseRevision: state.revision,
        operations: [{ type: "remove", id: "baseline" }],
      },
    });
    expect(rejected.isError).toBe(true);
    await expect(page.locator('[data-node-id="baseline"]')).toBeVisible();
    const latest = await client.callTool({name:"workspace_inspect",arguments:{}});
    const current = JSON.parse((latest.content as {text:string}[])[0]!.text) as {revision:number};
    const flexible = await client.callTool({name:"workspace_apply",arguments:{version:1,baseRevision:current.revision,operations:[
      {type:"mount",node:{id:"company-table",component:"Table",datasetId:"models",columns:["name","organization"],title:"Models and companies",span:8}},
      {type:"mount",node:{id:"mcp-scatter",component:"Scatter",datasetId:"models",xMetric:"outputPrice",metric:"contextWindow",seriesBy:"provider",title:"MCP: price × context",span:12}},
      {type:"connect",binding:{id:"mcp-scatter-selection",source:"agent-ranking",target:"mcp-scatter",entity:"Model"}},
      {type:"mount",node:{id:"usage-trend",component:"Trend",datasetId:"usage",metric:"requests",timeField:"date",seriesBy:"organization",title:"Synthetic usage by company",span:12}},
      {type:"mount",node:{id:"usage-table",component:"Table",datasetId:"usage",columns:["model","organization","date","requests"],limit:10000,height:320,density:"compact",span:12,title:"Synthetic workload records"}},
      {type:"move",id:"company-table",index:0}
    ]}});
    expect(flexible.isError).not.toBe(true);
    const companyTable=page.locator('[data-node-id="company-table"]');
    await expect(companyTable.getByRole("columnheader",{name:"Organization",exact:true})).toBeVisible();
    await expect(companyTable.getByRole("cell",{name:"Anthropic",exact:true}).first()).toBeVisible();
    await expect(page.locator('.aeliqo-workspace > .aeliqo-block').first()).toHaveAttribute('data-node-id','company-table');
    expect(await companyTable.evaluate(element=>getComputedStyle(element).gridColumn)).toContain('8');
    await expect(page.locator('[data-node-id="usage-trend"] svg')).toBeVisible();
    await expect(page.locator('[data-node-id="mcp-scatter"] [data-selected="true"]')).toHaveCount(1);
    const rows=page.locator('[data-node-id="usage-table"] tbody tr');
    expect(await rows.count()).toBeLessThan(100);
    expect(await page.locator('[data-node-id="baseline"]').getAttribute('data-render-count')).toBe(count);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "test-results/mcp-live-browser.png",
      fullPage: true,
    });
  } finally {
    await client.close();
  }
});

test("accessible overview and investigation", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  await page.goto("/");
  const overview = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    overview.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page.getByRole("button", { name: "Price landscape" }).click();
  const investigation = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    investigation.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
});

test('deterministic BYOK tool loop reaches the production browser through companion HTTP and acknowledgement',async({page,baseURL})=>{
 const {createCompanion}=await import('../apps/companion/src/server');
 const {createScriptedProvider}=await import('../packages/byok/src/index');
 const scripted=createScriptedProvider([
  {calls:[{id:'inspect',name:'workspace_inspect',arguments:{}}]},
  {calls:[{id:'catalog',name:'catalog_search',arguments:{}}]},
  {calls:[{id:'query',name:'data_query',arguments:{datasetId:'models',metric:'outputPrice',direction:'asc',limit:1}}]},
  {calls:[{id:'apply',name:'workspace_apply',arguments:{version:1,baseRevision:0,operations:[
   {type:'mount',node:{id:'byok-ranking',component:'Ranking',datasetId:'models',metric:'outputPrice',direction:'asc',filters:[{field:'outputPrice',operator:'lte',value:10},{field:'contextWindow',operator:'gte',value:1000000}],title:'BYOK fixture: low price, large context'}},
   {type:'mount',node:{id:'byok-scatter',component:'Scatter',datasetId:'models',xMetric:'outputPrice',metric:'contextWindow',seriesBy:'provider',title:'BYOK fixture: price × context'}},
   {type:'mount',node:{id:'byok-detail',component:'Detail',datasetId:'models',title:'BYOK selected model'}},
   {type:'mount',node:{id:'byok-org',component:'Detail',datasetId:'organizations',title:'BYOK related organization'}},
   {type:'connect',binding:{id:'byok-selection',source:'byok-ranking',target:'byok-detail',entity:'Model'}},
   {type:'connect',binding:{id:'byok-scatter-selection',source:'byok-ranking',target:'byok-scatter',entity:'Model'}},
   {type:'connect',binding:{id:'byok-relation',source:'byok-detail',target:'byok-org',entity:'Organization',relationship:'organization'}},
   {type:'select',id:'byok-ranking',recordId:'gemini-3-5-flash-lite'}
  ]}}]},
  {calls:[],text:'Deterministic BYOK fixture completed; no live model was called.'}
 ]);
 const toolResults: {id:string;result:unknown}[] = [];
 const companion=createCompanion({port:0,bridgePort:0,allowedOrigins:[baseURL!],provider:{
   ...scripted,
   next: async input => {toolResults.push(...input.results);return scripted.next(input);},
 }});
 try{await companion.ready;
  const denied = await fetch(`http://127.0.0.1:${companion.port}/status`, {headers:{Origin:'https://untrusted.example'}});
  expect(denied.status).toBe(403);
  expect(denied.headers.get('Access-Control-Allow-Origin')).toBeNull();
  await page.goto(`/?aeliqoBridgePort=${companion.mcp.bridge.port}&aeliqoCompanionPort=${companion.port}#aeliqoPairToken=${companion.mcp.bridge.pairingToken}`);await expect(page.getByText('MCP bridge connected',{exact:true})).toBeVisible();
  const baseline=await page.locator('[data-node-id="baseline"]').getAttribute('data-render-count');
  await expect(page.getByRole('button',{name:'Run with BYOK',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Run with BYOK',exact:true}).click();
  await expect(page.locator('.notice[role="status"]')).toContainText('Deterministic BYOK fixture completed');
  expect(toolResults.map(item=>item.result)).not.toContainEqual(expect.objectContaining({error:expect.any(String)}));
  const receipt=receiptSchema.parse(toolResults.find(item=>item.id==='apply')?.result);
  expect(receipt).toMatchObject({operation:'committed',outcome:'presented',render:{status:'acknowledged',visible:true,revision:1},data:{status:'ready'}});
  await expect(page.locator('[data-node-id="byok-detail"]').getByRole('heading',{name:'Gemini 3.5 Flash-Lite'})).toBeVisible();
  await expect(page.locator('[data-node-id="byok-scatter"] [data-selected="true"]')).toHaveCount(1);
  await expect(page.locator('[data-node-id="byok-org"]').getByRole('heading',{name:'Google / Google DeepMind'})).toBeVisible();
  expect(await page.locator('[data-node-id="baseline"]').getAttribute('data-render-count')).toBe(baseline);
  await page.getByRole('tab',{name:'Proof Lab',exact:true}).click();await expect(page.getByText('BYOK · workspace_apply',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/byok-deterministic-proof.png',fullPage:true});
 }finally{await companion.close();}
});

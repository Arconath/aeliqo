import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import OpenAI from 'openai';
import {parseCatalog,parseTask,parseWireValue,type Task} from '@aeliqo/core';
import {createOpenAIToolModel} from '../../packages/agent/src/model/openai.js';
import {runToolModel} from '../../packages/agent/src/model/loop.js';
import type {ToolModelBudget} from '../../packages/agent/src/model/types.js';
import {createEvaluationHost,type EvaluationFixture} from './host.js';
import {scoreData,wilsonInterval,type ExpectedOutput} from './scoring.js';
import {runExplicitMcp} from './mcp-baseline.js';
interface EvaluationCase{readonly id:string;readonly partition:'development'|'heldout';readonly independentAuthor:string;readonly exposure:string;readonly prompt:string;readonly fixture:EvaluationFixture;readonly explicitTask:Task;readonly expected:readonly ExpectedOutput[];}
interface ModelConfig{readonly label:'weak'|'strong';readonly model:string;readonly expectedReportedModel:string;readonly inputUSDPerMillion:number;readonly outputUSDPerMillion:number;readonly priceSource:string;}
interface LiveConfig{readonly version:'1';readonly authorized:boolean;readonly authorizationReference:string;readonly authorizedCorpusSha256:string;readonly maxUSD:number;readonly trials:number;readonly models:readonly ModelConfig[];readonly budget:ToolModelBudget;}
const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,min:number,max:number):value is number=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;
const boundedText=(value:unknown,max=160):value is string=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
function parseConfig(value:unknown):LiveConfig|undefined{
 if(!object(value)||value.version!=='1'||typeof value.authorized!=='boolean'||!boundedText(value.authorizationReference,512)||typeof value.authorizedCorpusSha256!=='string'||!/^([a-f0-9]{64})$/.test(value.authorizedCorpusSha256)||!integer(value.trials,1,20)||typeof value.maxUSD!=='number'||!Number.isFinite(value.maxUSD)||value.maxUSD<=0||!Array.isArray(value.models)||value.models.length!==2||!object(value.budget))return;
 const models=value.models;if(!models.every(model=>object(model)&&['weak','strong'].includes(String(model.label))&&boundedText(model.model,128)&&boundedText(model.expectedReportedModel,256)&&typeof model.inputUSDPerMillion==='number'&&Number.isFinite(model.inputUSDPerMillion)&&model.inputUSDPerMillion>0&&typeof model.outputUSDPerMillion==='number'&&Number.isFinite(model.outputUSDPerMillion)&&model.outputUSDPerMillion>0&&boundedText(model.priceSource,512))||new Set(models.map(model=>model.label)).size!==2||models[0].model===models[1].model)return;
 const budget=value.budget;for(const [key,max]of Object.entries({maxTurns:32,maxModelRequests:64,maxToolCalls:64,maxMilliseconds:300000,maxInputTokens:1000000,maxOutputTokens:100000,maxTotalTokens:2000000,maxInputBytes:1000000,maxOutputBytes:1000000,maxRepeatedCalls:4}))if(!integer(budget[key],1,max))return;
 return value as unknown as LiveConfig;
}
function parseCase(value:unknown):EvaluationCase|undefined{
 if(!object(value)||!boundedText(value.id)||!['development','heldout'].includes(String(value.partition))||!boundedText(value.independentAuthor,512)||!boundedText(value.exposure,2048)||!boundedText(value.prompt,16000)||!object(value.fixture)||!Array.isArray(value.expected))return;
 const fixture=value.fixture;if(!parseCatalog(fixture.catalog).ok||!parseTask(value.explicitTask).ok||!object(fixture.records)||!object(fixture.budget))return;
 for(const key of ['id','sourceRevision','scopeDigest','principalKey','regionId','goalEpoch'])if(!boundedText(fixture[key]))return;
 for(const [key,max]of Object.entries({maxRows:10000,maxBytes:8*1024*1024,maxMessages:1000,maxMilliseconds:60000,maxColumns:256}))if(!integer(fixture.budget[key],1,max))return;
 if(!Object.values(fixture.records).every(rows=>Array.isArray(rows)&&rows.length<=10000&&rows.every(object)))return;
 if(!value.expected.every(output=>object(output)&&boundedText(output.id)&&Array.isArray(output.fields)&&output.fields.every(field=>boundedText(field))&&Array.isArray(output.grain)&&output.grain.every(field=>boundedText(field))&&Array.isArray(output.rows)&&output.rows.every(object)&&typeof output.orderMatters==='boolean'&&['complete','partial','sample','unknown'].includes(String(output.coverage))))return;
 if(value.expected.length===0||new Set(value.expected.map(output=>output.id)).size!==value.expected.length)return;
 for(const output of value.expected){const quality=output.quality;if(!object(quality)||!Array.isArray(quality.identity)||!quality.identity.every(id=>boundedText(id))||new Set(quality.identity).size!==quality.identity.length||!integer(quality.populationCount,0,10000)||quality.precision!=='exact'||!object(quality.sourceRevisions)||!Object.values(quality.sourceRevisions).every(revision=>boundedText(revision))||!['observed','computed'].includes(String(quality.evidenceKind))||!Array.isArray(quality.definitions)||!quality.definitions.every(ref=>object(ref)&&boundedText(ref.id)&&boundedText(ref.revision)))return;if(new Set(output.fields).size!==output.fields.length||output.fields.length===0||new Set(output.grain).size!==output.grain.length||!output.rows.every((row:Record<string,unknown>)=>Object.keys(row).length===output.fields.length&&output.fields.every((field:string)=>Object.hasOwn(row,field))))return;}
 if(!parseWireValue(value).ok)return;
 return value as unknown as EvaluationCase;
}
export async function runEvaluation(args:readonly string[]):Promise<number>{
 const options=new Map<string,string>();let live=false;let mcpExplicit=false;
 for(let index=0;index<args.length;index++){const argument=args[index]!;if(argument==='--live'){live=true;continue;}if(argument==='--mcp-explicit'){mcpExplicit=true;continue;}if(!['--config','--corpus','--output'].includes(argument)||!args[index+1])throw Error('Use --config FILE --corpus FILE --output DIRECTORY [--live] [--mcp-explicit].');options.set(argument,args[++index]!);}
 const corpusPath=options.get('--corpus');const configPath=options.get('--config');const outputPath=options.get('--output');if(!corpusPath||!outputPath)throw Error('Provide a corpus file and output directory.');
 const corpusBytes=await readFile(resolve(corpusPath),'utf8');const raw:unknown=JSON.parse(corpusBytes);if(!Array.isArray(raw)||raw.length===0||raw.length>200)throw Error('The corpus must contain 1–200 cases.');
 const cases=raw.map(parseCase);if(cases.some(item=>item===undefined)||new Set(cases.map(item=>item!.id)).size!==cases.length)throw Error('The corpus contains invalid or repeated cases.');const validCases=cases as EvaluationCase[];
 const root=resolve(import.meta.dirname,'../..');const sourceDigest=()=>execFileSync('python3',['scripts/gate.py','digest'],{cwd:root,encoding:'utf8'}).trim();const before=sourceDigest();const output=resolve(outputPath);await mkdir(output,{recursive:true});
 const rows:Record<string,unknown>[]=[];const blocks:string[]=[];const config=configPath?parseConfig(JSON.parse(await readFile(resolve(configPath),'utf8'))):undefined;
 for(const testCase of validCases){
  const host=createEvaluationHost(testCase.fixture);
  try{const started=performance.now();const evaluated=await host.evaluate(testCase.explicitTask);rows.push({caseId:testCase.id,partition:testCase.partition,mode:'explicit-task',model:null,elapsedMs:performance.now()-started,score:evaluated.ok?scoreData(evaluated.value,testCase.expected,testCase.fixture.scopeDigest,testCase.fixture.sourceRevision):{dataCorrect:false,diagnostics:evaluated.diagnostics},observations:host.observations});}finally{host.dispose();}
  if(mcpExplicit){
   const baseline=await runExplicitMcp(testCase.fixture,testCase.explicitTask);
   rows.push({caseId:testCase.id,partition:testCase.partition,mode:'explicit-mcp',model:null,
    score:baseline.result.ok?scoreData(baseline.result.value,testCase.expected,testCase.fixture.scopeDigest,testCase.fixture.sourceRevision):{dataCorrect:false,diagnostics:baseline.result.diagnostics},
    observation:baseline.observation,outputs:baseline.result.ok?baseline.result.value:undefined});
  }
 }
 if(!live)blocks.push('Live trials were not requested. No provider request was made.');
 else if(!config||!config.authorized)blocks.push('An explicit owner-authorized configuration with exact weak/strong models, prices, and spend ceiling is required.');
 else if(config.authorizedCorpusSha256!==hash(corpusBytes))blocks.push('The corpus bytes differ from the owner-authorized corpus digest. No provider request was made.');
 else if(!process.env.AELIQO_EVAL_OPENAI_API_KEY)blocks.push('AELIQO_EVAL_OPENAI_API_KEY is unavailable. No provider request was made.');
 else{
  let reservedUSD=0;
  for(const model of config.models)for(const testCase of validCases)for(let trial=1;trial<=config.trials;trial++){
   // Reserve the whole configured trial bound before making either counting or generation requests.
   const maximum=(config.budget.maxModelRequests*config.budget.maxInputTokens*model.inputUSDPerMillion+config.budget.maxTurns*config.budget.maxOutputTokens*model.outputUSDPerMillion)/1_000_000;
   if(!Number.isFinite(maximum)||reservedUSD+maximum>config.maxUSD){blocks.push(`Spend reservation prevents ${model.label}/${testCase.id}/trial-${trial}.`);continue;}reservedUSD+=maximum;
   const snapshots:{model:string;responseId:string}[]=[];const host=createEvaluationHost(testCase.fixture,'byok');const started=performance.now();
   try{
    const client=new OpenAI({apiKey:process.env.AELIQO_EVAL_OPENAI_API_KEY,maxRetries:0,fetch:async(input,init)=>{const response=await fetch(input,init);if(response.ok){try{const body=await response.clone().json() as unknown;if(object(body)&&boundedText(body.model,256)&&boundedText(body.id,256))snapshots.push({model:body.model,responseId:body.id});}catch{/* No raw provider response or headers enter the report. */}}return response;}});
    const port=createOpenAIToolModel({client,model:model.model});const result=await runToolModel({requestId:`trial-${trial}`,goal:'chat',prompt:testCase.prompt,endpoint:host.endpoint,model:port,budget:config.budget});
    if(snapshots.length===0||snapshots.some(item=>item.model!==model.expectedReportedModel))blocks.push(`Missing or non-authorized reported model snapshot for ${model.label}/${testCase.id}/trial-${trial}.`);
    const evaluations=host.observations.filter(item=>item.stage==='evaluate');const first=evaluations[0]?.outputs;const last=evaluations.at(-1)?.outputs;
    rows.push({caseId:testCase.id,partition:testCase.partition,mode:'governed-model-data',model:model.model,modelLabel:model.label,snapshots,trial,elapsedMs:performance.now()-started,reservedUSD:maximum,firstAttempt:first?scoreData(first,testCase.expected,testCase.fixture.scopeDigest,testCase.fixture.sourceRevision):{dataCorrect:false},score:last&&result.ok&&result.value.stop==='text-ready'?scoreData(last,testCase.expected,testCase.fixture.scopeDigest,testCase.fixture.sourceRevision):{dataCorrect:false},result,observations:host.observations,uiTaskCompletion:null,narrativeGrounding:null,chargedUSD:null,usageEstimatedUSD:result.ok?(result.value.inputTokens*model.inputUSDPerMillion+result.value.outputTokens*model.outputUSDPerMillion)/1_000_000:null,priceSource:model.priceSource});
   }catch{rows.push({caseId:testCase.id,partition:testCase.partition,mode:'governed-model-data',model:model.model,modelLabel:model.label,trial,status:'provider-failed',elapsedMs:performance.now()-started,score:{dataCorrect:false},reservedUSD:maximum});}finally{host.dispose();}
  }
 }
 const groups=['weak','strong'].map(label=>{const trials=rows.filter(row=>row.modelLabel===label);const successes=trials.filter(row=>object(row.score)&&row.score.dataCorrect===true).length;return{label,trials:trials.length,dataCorrect:successes,interval:wilsonInterval(successes,trials.length),uiTaskCompletion:null,narrativeGrounding:null};});
 const after=sourceDigest();if(after!==before)blocks.push('Source changed during the run; these results cannot qualify the candidate.');
 if(!mcpExplicit)blocks.push('Actual MCP-client explicit trials were not requested.');
 blocks.push('This data-only runner does not establish full T40: UI completion, narrative review, fixed-template ablation, external MCP-host reasoning trials, and independently accepted held-out coverage remain separate requirements.');
 const report={schemaVersion:1,status:'blocked',mcpExplicit,sourceDigest:before,sourceChangedDuringRun:after!==before,corpus:{path:resolve(corpusPath),sha256:hash(corpusBytes),cases:validCases.map(item=>({id:item.id,partition:item.partition,independentAuthor:item.independentAuthor,exposure:item.exposure}))},authorization:config?{reference:config.authorizationReference,maximumUSD:config.maxUSD,authorizedCorpusSha256:config.authorizedCorpusSha256}:null,groups,blocks,rows};await writeFile(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(`Evaluation evidence written to ${join(output,'report.json')}. Overall T40 status: BLOCKED.`);return rows.some(row=>(row.mode==='explicit-task'||row.mode==='explicit-mcp')&&object(row.score)&&row.score.dataCorrect===false)?1:2;
}
export{parseConfig,parseCase};

/** These assignments MUST fail statically; runtime ingress additionally needs validators. */
import type { Environment, Measurement, PopulationCount, Precision, Expression, InteractionPayload, MeaningScope, Task, TaskBase } from './reference.js';
// @ts-expect-error known measurement cannot omit its value
const badSize:Measurement = {state:'known'};
// @ts-expect-error exact total cannot omit a count
const badCount:PopulationCount = {kind:'exact',populationDigest:'p'};
// @ts-expect-error estimate requires method and uncertainty
const badEstimate:PopulationCount = {kind:'estimated',value:10,populationDigest:'p'};
// @ts-expect-error approximation requires an explicit method and uncertainty
const badPrecision:Precision = {kind:'approximate'};
// @ts-expect-error function identity is version-bound
const badFunction:Expression = {kind:'call',function:'sum',arguments:[]};
// @ts-expect-error caller cannot use a mismatched generic payload for selection
const badSelection:InteractionPayload = {kind:'selection',selection:{mode:'ids',keys:[1]}};
// @ts-expect-error old user/personal mismatch is not silently accepted
const badScope:MeaningScope = 'user';
// @ts-expect-error phone-sized screen does not establish no keyboard
const badKeyboard:Environment['keyboard'] = 'unavailable';
const common:TaskBase = {version:'1',id:'x',revision:'1',catalogRevision:'c',functionRegistryDigest:'f',
  regionId:'r',goal:'test',needs:[],assumptions:[]};
// @ts-expect-error data task requires at least one named output
const noOutputs:Task = {...common,kind:'data',outputs:[]};
// @ts-expect-error presentation-only request cannot smuggle query execution through query field
const queryInView:Task = {...common,kind:'presentation',inputs:[],query:{}};
// @ts-expect-error form task requires an approved schema reference
const badForm:Task = {...common,kind:'form',action:{id:'a',revision:'1'}};
// @ts-expect-error group event requires a target output
const wrongGroup:InteractionPayload = {kind:'group',field:'f',value:'x'};
void [badSize,badCount,badEstimate,badPrecision,badFunction,badSelection,badScope,badKeyboard,noOutputs,queryInView,badForm,wrongGroup];

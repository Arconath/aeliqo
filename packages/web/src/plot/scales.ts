import {scaleLinear, scaleLog, scalePoint} from 'd3-scale';
import {compareScalars, scalarIdentity, scalarInstantParts, validateScalar} from '@aeliqo/core';
import type {PlotEncoding, Scalar, SemanticType} from '@aeliqo/core';

export interface PlotTick {readonly position:number; readonly value:Scalar; readonly label:string}
export interface PlotScale {
  readonly at:(value:Scalar)=>number|undefined;
  readonly ticks:readonly PlotTick[];
}
export function exactLabel(value:Scalar):string {
  return value === null ? 'Missing' : typeof value === 'object' ? value.decimal : String(value);
}
interface Exact {coefficient:bigint; scale:number}
function numericExact(value:Scalar,type:SemanticType):Exact {
  if(type.value==='date') return {coefficient:BigInt(Date.parse(`${value}T00:00:00Z`)),scale:0};
  if(type.value==='instant') {
    if(typeof value!=='string')throw Error('Invalid instant');
    const parts=scalarInstantParts(value);if(parts===undefined)throw Error('Invalid instant');
    const {milliseconds,fraction}=parts;
    const scale=Math.max(3,fraction.length);
    return {coefficient:BigInt(milliseconds)*10n**BigInt(scale-3)+BigInt(fraction.padEnd(scale,'0')||'0'),scale};
  }
  const raw=typeof value==='object'&&value!==null?value.decimal:String(value);
  const match=/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/iu.exec(raw);
  if(!match)throw Error('Invalid number');
  const exponent=Number(match[4]??0); const fraction=match[3]??'';
  let coefficient=BigInt(`${match[1]}${match[2]}${fraction}`);let scale=fraction.length-exponent;
  if(scale<0){coefficient*=10n**BigInt(-scale);scale=0;}
  return {coefficient,scale};
}
/** Offset exact values before floating geometry conversion, preserving small differences on large baselines. */
export function makePlotScale(encoding:PlotEncoding,type:SemanticType,input:readonly Scalar[],range:readonly [number,number]):PlotScale {
  const values:Scalar[]=[]; const identities=new Set<string>();
  for(const value of input) {
    if(value===null)continue;
    if(!validateScalar(value,type).ok)throw Error('Invalid scale value');
    const id=scalarIdentity(value,type);if(!id.ok)throw Error('Invalid scale identity');
    if(!identities.has(id.value)){identities.add(id.value);values.push(value);}
  }
  const identify=(v:Scalar):string=>{const x=scalarIdentity(v,type);if(!x.ok)throw Error('Invalid scale identity');return x.value;};
  let at:(value:Scalar)=>number|undefined;
  if(encoding.scale==='ordinal') {
    const scale=scalePoint<string>().domain(values.map(identify)).range([...range]).padding(0.5);
    at=v=>v===null?undefined:scale(identify(v));
  } else {
    values.sort((a,b)=>{const c=compareScalars(a,b,type);if(!c.ok||c.value===null)throw Error('Unordered scale');return c.value;});
    const exact=values.map(v=>numericExact(v,type));
    if(encoding.zero) exact.push({coefficient:0n,scale:0});
    const places=Math.max(0,...exact.map(v=>v.scale));
    const integer=(v:Exact)=>v.coefficient*10n**BigInt(places-v.scale);
    const ints=exact.map(integer);
    let min=ints[0]??0n,max=min;
    for(const i of ints){if(i<min)min=i;if(i>max)max=i;}
    if(encoding.scale==='log') {
      if(ints.some(i=>i<=0n))throw Error('Log scales require positive observations');
      // Logarithms consume bounded ratios, not underflowing/overflowing raw decimals.
      const logInt=(v:bigint)=>{const s=v.toString();return Math.log10(Number(s.slice(0,16)))+s.length-Math.min(16,s.length);};
      const low=logInt(min||1n),high=logInt(max||1n);
      if(min!==max && low===high)throw Error('Log scale precision cannot distinguish the observations');
      const scale=scaleLog().domain([1,10]).range([...range]);
      at=v=>{if(v===null)return undefined;const x=integer(numericExact(v,type));if(x<=0n)throw Error('Log scales require positive observations');return scale(10**(high===low?0.5:(logInt(x)-low)/(high-low)));};
    } else {
      const span=max-min;
      const scale=scaleLinear().domain([0,1]).range([...range]);
      at=v=>{if(v===null)return undefined;const x=integer(numericExact(v,type));
        const ratio=span===0n?0.5:Number((x-min)*1_000_000_000_000n/span)/1_000_000_000_000;
        return scale(ratio);};
    }
  }
  const samples=values.filter((_,i)=>values.length<=6||i===0||i===values.length-1||i%Math.ceil(values.length/5)===0);
  return {at,ticks:samples.map(value=>({position:at(value)!,value,label:exactLabel(value)}))};
}

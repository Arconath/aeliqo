import {it,expect} from 'vitest';
import {makePlotScale} from '../../packages/web/src/plot/scales.js';
it('retains tiny exact differences on an enormous decimal baseline',()=>{
  const values=['9007199254740993123456789.0001','9007199254740993123456789.0002','9007199254740993123456789.0003'].map(decimal=>({decimal}));
  const scale=makePlotScale({field:'amount',scale:'linear'},{value:'decimal',nullable:false},values,[0,100]);
  expect(values.map(scale.at)).toEqual([0,50,100]);expect(scale.ticks.map(t=>t.label)).toEqual(values.map(v=>v.decimal));
});
it('uses exact fractional instant offsets and preserves gaps',()=>{
  const values=['2026-09-08T00:00:00.0001Z','2026-09-08T00:00:00.0002Z','2026-09-08T00:00:00.0003Z'];
  const scale=makePlotScale({field:'time',scale:'temporal'},{value:'instant',nullable:true},values,[0,100]);
  expect(values.map(scale.at)).toEqual([0,50,100]);expect(scale.at(null)).toBeUndefined();
});
it('rejects nonpositive log observations and centers equal values',()=>{
  expect(()=>makePlotScale({field:'v',scale:'log'},{value:'float',nullable:false},[0,1],[0,100])).toThrow();
  const scale=makePlotScale({field:'v',scale:'linear'},{value:'float',nullable:false},[2,2],[0,100]);expect(scale.at(2)).toBe(50);
});

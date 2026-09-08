import {expect,it} from 'vitest';
import {wilsonInterval} from './scoring.js';
it('does not call an unrun or tiny perfect sample a universal success rate',()=>{expect(wilsonInterval(0,0)).toBeNull();const one=wilsonInterval(1,1);expect(one?.lower).toBeCloseTo(0.20655,4);expect(one?.upper).toBeCloseTo(1);expect(wilsonInterval(95,100)?.lower).toBeGreaterThan(0.88);expect(()=>wilsonInterval(2,1)).toThrow();});

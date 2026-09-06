import {expect,it} from 'vitest';
import {createWorkspace,defineDataset,type DataPort,type DataSnapshot,type Operation} from './index';

const dataset=defineDataset({id:'items',entity:'Item',label:'Items',identity:'id',labelField:'name',dimensions:[{key:'name',label:'Name'}],metrics:[],timeFields:[]});
const snapshot:DataSnapshot={status:'ready',records:[{id:'one',name:'One'}]};
const port:DataPort={listDatasets:()=>[dataset],getDataset:id=>id===dataset.id?dataset:undefined,getSnapshot:()=>snapshot,subscribe:()=>()=>{}};

it('an agent cannot rebind or disconnect an indirect dependency of pinned content',()=>{
  const store=createWorkspace({dataPort:port,nodes:[{id:'source',component:'Table',datasetId:'items'},{id:'middle',component:'Detail',datasetId:'items'},{id:'pinned',component:'Detail',datasetId:'items',pinned:true}],bindings:[{id:'tail',source:'middle',target:'pinned',entity:'Item'}]});
  const apply=(operations:Operation[],actor:'agent'|'human')=>store.apply({version:1,baseRevision:store.getState().revision,operations},{actor});
  apply([{type:'select',id:'source',recordId:'one'}],'human');
  const connect:Operation={type:'connect',binding:{id:'head',source:'source',target:'middle',entity:'Item'}};
  const before=store.getState();
  expect(apply([connect],'agent')).toMatchObject({ok:false});
  expect(store.getState()).toBe(before);
  expect(store.getSelection('pinned')).toBeNull();
  expect(apply([connect],'human')).toMatchObject({ok:true});
  expect(store.getSelection('pinned')).toBe('one');
  const connected=store.getState();
  expect(apply([{type:'disconnect',id:'head'}],'agent')).toMatchObject({ok:false});
  expect(store.getState()).toBe(connected);
  expect(store.getSelection('pinned')).toBe('one');
});

it('relationship selection never picks an arbitrary match from ambiguous application data',()=>{
  const source=defineDataset({...dataset,id:'source',dimensions:[...dataset.dimensions,{key:'fk',label:'Foreign key'}],relationships:[{id:'related',field:'fk',targetDatasetId:'target',targetField:'code',cardinality:'many-to-one' as const}]});
  const target=defineDataset({...dataset,id:'target',dimensions:[...dataset.dimensions,{key:'code',label:'Code'}]});
  let sourceSnapshot:DataSnapshot={status:'ready',records:[{id:'one',name:'One',fk:'x'}]};
  let targetSnapshot:DataSnapshot={status:'ready',records:[{id:'first',name:'First',code:'x'},{id:'second',name:'Second',code:'x'}]};
  const relatedPort:DataPort={listDatasets:()=>[source,target],getDataset:id=>id==='source'?source:target,getSnapshot:id=>id==='source'?sourceSnapshot:targetSnapshot,subscribe:()=>()=>{}};
  const store=createWorkspace({dataPort:relatedPort,nodes:[{id:'table',component:'Table',datasetId:'source'},{id:'detail',component:'Detail',datasetId:'target'}],bindings:[{id:'link',source:'table',target:'detail',entity:'Item',relationship:'related'}]});
  store.apply({version:1,baseRevision:0,operations:[{type:'select',id:'table',recordId:'one'}]});
  expect(store.getSelection('detail')).toBeNull();
  targetSnapshot={status:'ready',records:[{id:'second',name:'Second',code:'x'}]};
  expect(store.getSelection('detail')).toBe('second');
  sourceSnapshot={status:'ready',records:[{id:'one',name:'One',fk:'x'},{id:'one',name:'Duplicate',fk:'x'}]};
  expect(store.getSelection('detail')).toBeNull();
});

it('shared entity labels cannot implicitly join separate datasets',()=>{
  const other=defineDataset({...dataset,id:'other'});
  const shared:DataPort={...port,listDatasets:()=>[dataset,other],getDataset:id=>id==='items'?dataset:other};
  const store=createWorkspace({dataPort:shared,nodes:[{id:'source',component:'Table',datasetId:'items'},{id:'target',component:'Detail',datasetId:'other'}]});
  const before=store.getState();
  expect(store.apply({version:1,baseRevision:0,operations:[{type:'connect',binding:{id:'implicit',source:'source',target:'target',entity:'Item'}}]})).toMatchObject({ok:false,error:'Cross-dataset binding requires an explicit relationship'});
  expect(store.getState()).toBe(before);
});

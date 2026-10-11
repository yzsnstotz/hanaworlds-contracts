import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const clone=x=>structuredClone(x);
const load=async()=>JSON.parse(await readFile(new URL('../fixtures/local/world-lifecycle.json',import.meta.url),'utf8'));
const reject=(fn,code)=>assert.throws(fn,e=>e instanceof a.ContractError&&e.code===code);

test('major-2 lifecycle metadata declares all 15 operations and ownership',()=>{
 assert.ok(a.worldLifecycle,'missing additive lifecycle declaration');
 assert.equal(a.worldLifecycle.operations.length,15);
 for(const id of ['C-world-lifecycle','C-engine-runtime','C-local-worlds'])assert.equal(a.worldLifecycle.contracts.find(c=>c.id===id).major,2);
 for(const c of a.worldLifecycle.contracts){assert.ok(a.wireVersions.includes(c.wire));assert.ok(a.operationContracts[c.wire]);}
});
test('every published success/refusal strictly decodes and binds to its request',async()=>{
 const f=await load();
 for(const x of f.exchanges){
  a.admitRequest(x.wire,x.operation,Buffer.from(JSON.stringify(x.request)));
  a.validateBoundResponse(x.wire,x.operation,x.request,x.response);
  const bad=clone(x.response);bad.requestId='another-request';
  reject(()=>a.validateBoundResponse(x.wire,x.operation,x.request,bad),'TRANSACTION_CONFLICT');
 }
 assert.equal(f.exchanges.filter(x=>x.response.result!==null).length,15);
 for(const d of a.worldLifecycle.operations)for(const code of d.errors)assert.ok(f.exchanges.some(x=>x.wire===d.wire&&x.operation===d.operation&&x.response.error?.code===code),`${d.operation}:${code}`);
});
test('closed envelopes reject unknown fields, wrong versions and illegal result/error combinations',async()=>{
 const f=await load();for(const x of f.exchanges.filter(x=>x.response.result!==null)){
  const q={...x.request,engineSecret:'extra'};reject(()=>a.validateRequest(x.wire,x.operation,q),'UNKNOWN_REQUIRED_FIELD');
  reject(()=>a.validateResponse(x.wire,x.operation,{...x.response,contractVersion:x.wire.replace('/v2','/v1')}),'UNSUPPORTED_VERSION');
  reject(()=>a.validateResponse(x.wire,x.operation,{...x.response,result:null}),'SCHEMA_INVALID');
  const r=clone(x.response);r.error={code:'MODEL_UNAVAILABLE',phase:'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason:'REQUIRED_FACT_UNKNOWN'};r.result=null;
  reject(()=>a.validateResponse(x.wire,x.operation,r),'SCHEMA_INVALID');
 }
});
test('opaque creation facts and engine profiles carry any strict JSON unchanged, without executable values',async()=>{
 const f=await load(),x=f.exchanges.find(x=>x.operation==='create'&&x.response.result);
 for(const value of [null,false,7,'source-token',[1,{engineOwned:{arbitrary:true}}],{nested:{unfamiliar:'kept'},array:[]}]){
  const r=clone(x.response);r.result.creationFacts=value;
  assert.equal(a.canonicalJSON(a.validateResponse(x.wire,x.operation,r).result.creationFacts),a.canonicalJSON(value));
 }
 const bad=clone(x.response);bad.result.creationFacts={fn:()=>1};reject(()=>a.validateResponse(x.wire,x.operation,bad),'SCHEMA_INVALID');
 const y=f.exchanges.find(x=>x.operation==='StartWorldRuntime'&&x.response.result);
 for(const value of [null,[],{sourceOwned:'profile'}])a.validateRequest(y.wire,y.operation,{...y.request,engineProfile:value});
 const raw=JSON.stringify(x.response).replace('"creationFacts":{','"creationFacts":{"duplicate":1,"duplicate":2,');
 reject(()=>a.admitType('WorldLifecycleCreateResponse',Buffer.from(raw)),'NON_CANONICAL_AMBIGUITY');
});
test('receipts bind world, template, confirmation and connection; pair readback is internally coherent',async()=>{
 const f=await load();
 for(const x of f.exchanges.filter(x=>x.response.result!==null)){
  for(const field of ['worldId','worldRef','templateId','displayName','confirmationName','connectionRef'])if(field in x.request && field in x.response.result){
   const r=clone(x.response);r.result[field]='different';reject(()=>a.validateBoundResponse(x.wire,x.operation,x.request,r),field==='worldId'||field==='worldRef'||field==='connectionRef'?'CURRENT_WORLD_MISMATCH':'TRANSACTION_CONFLICT');
  }
 }
 const pair=f.exchanges.find(x=>x.operation==='pair'&&x.response.result),r=clone(pair.response);r.result.capabilities.worldRef='different';
 reject(()=>a.validateResponse(pair.wire,pair.operation,r),'CURRENT_WORLD_MISMATCH');
});
test('mock is published, returns admitted examples and fails honestly for unavailable selectors',async()=>{
 const f=await load(),mock=a.createWorldLifecycleMock(f);
 for(const x of f.exchanges.filter(x=>x.response.result!==null)){
  const q={...x.request,requestId:'fresh-id'};assert.equal(mock(x.wire,x.operation,q).requestId,'fresh-id');
 }
 for(const x of f.exchanges.filter(x=>x.response.error)){
  const refuse=a.createWorldLifecycleMock(f,{[`${x.wire}:${x.operation}`]:x.response.error.code});
  assert.equal(refuse(x.wire,x.operation,x.request).error.code,x.response.error.code);
 }
 const create=f.exchanges.find(x=>x.operation==='create'&&x.response.result);
 assert.equal(mock(create.wire,'create',{...create.request,templateId:'unknown'}).error.code,'ADAPTER_UNAVAILABLE');
 const del=f.exchanges.find(x=>x.operation==='delete'&&x.response.result);
 assert.equal(mock(del.wire,'delete',{...del.request,confirmationName:'wrong'}).error.code,'TRANSACTION_CONFLICT');
});
test('catalogue and inventory identities are unique; nested envelope fields stay closed',async()=>{
 const f=await load();
 for(const operation of ['describe','list','discover']){
  const x=f.exchanges.find(x=>x.operation===operation&&x.response.result),r=clone(x.response);
  const key=operation==='describe'?'templates':'worlds';r.result[key].push(clone(r.result[key][0]));
  reject(()=>a.validateResponse(x.wire,operation,r),'SCHEMA_INVALID');
 }
 const x=f.exchanges.find(x=>x.operation==='describe'&&x.response.result),r=clone(x.response);r.result.templates[0].flatMap=true;
 reject(()=>a.validateResponse(x.wire,x.operation,r),'UNKNOWN_REQUIRED_FIELD');
 const create=f.exchanges.find(x=>x.operation==='create'&&x.response.result);
 const both=clone(create.response);both.error=f.exchanges.find(x=>x.operation==='create'&&x.response.error).response.error;
 reject(()=>a.validateResponse(create.wire,create.operation,both),'SCHEMA_INVALID');
});
test('opaque engine inputs participate in existing request digest without rewriting any value',async()=>{
 const f=await load(),x=f.exchanges.find(x=>x.operation==='StartWorldRuntime'&&x.response.result);
 const first=a.requestDigest(x.wire,x.operation,x.request);
 const reordered=Object.fromEntries(Object.entries(x.request).reverse());assert.equal(a.requestDigest(x.wire,x.operation,reordered),first);
 const changed=clone(x.request);changed.engineProfile.sourceOwned.push('changed');assert.notEqual(a.requestDigest(x.wire,x.operation,changed),first);
 const input=clone(x.request),admitted=a.validateRequest(x.wire,x.operation,input);
 input.engineProfile.sourceOwned.push('caller edit');assert.notEqual(a.canonicalJSON(input),a.canonicalJSON(admitted));
 assert.ok(Object.isFrozen(admitted.engineProfile.sourceOwned));
});

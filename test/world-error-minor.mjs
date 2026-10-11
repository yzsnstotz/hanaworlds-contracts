import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const reject=(fn,code)=>assert.throws(fn,e=>e instanceof a.ContractError&&e.code===code);
const load=async()=>JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/world-error')),'utf8'));
const seven=['code','phase','retryability','mutationState','transactionRef','causeCode','reason'];

test('Error gains exactly one optional non-null worldRef; the seven fields are untouched',()=>{
 const e=a.schemaBundle.definitions.Error;
 assert.deepEqual(e.required,seven);
 assert.deepEqual(Object.keys(e.properties).filter(k=>k!=='source'),[...seven,'worldRef']);
 assert.deepEqual(e.properties.worldRef,{$ref:'#/definitions/Ref'});
 assert.equal(e.additionalProperties,false);
 assert.equal(a.worldErrorContext.introducedIn,'2.7.0');
 assert.equal(a.worldErrorContext.field,'worldRef');
 assert.equal(a.worldErrorContext.fixture,'hanaworlds-contracts/fixtures/world-error');
});
test('SDK ContractError carries worldRef only when given; old constructions are byte-identical',()=>{
 const old=new a.ContractError('CAPABILITY_UNAVAILABLE','validate','REQUIRED_FACT_UNKNOWN');
 assert.deepEqual(Object.keys(old.publicError),seven);
 assert.equal(old.worldRef,undefined);
 assert.equal(a.canonicalJSON(new a.ContractError('READBACK_MISMATCH','readback','PAYLOAD_CHANGED',{mutationState:'UNKNOWN',transactionRef:'t'}).publicError),
  a.canonicalJSON({code:'READBACK_MISMATCH',phase:'readback',retryability:'AFTER_NEW_FACTS',mutationState:'UNKNOWN',transactionRef:'t',causeCode:null,reason:'PAYLOAD_CHANGED'}));
 assert.deepEqual(Object.keys(new a.ContractError('X','validate','R',{worldRef:undefined}).publicError),seven);
 const named=new a.ContractError('CAPABILITY_UNAVAILABLE','validate','REQUIRED_FACT_UNKNOWN',{mutationState:'PARTIAL',transactionRef:'t',worldRef:'w'});
 assert.equal(named.worldRef,'w');assert.equal(named.mutationState,'PARTIAL');
 assert.equal(a.publicError(named),named.publicError);assert.equal(a.publicError(named).worldRef,'w');
 a.validateType('Error',named.publicError);
 assert.ok(!Object.hasOwn(a.publicError(new Error('world w is gone at /tmp/w')),'worldRef'),'exception messages never become a target');
 for(const bad of [null,'',7,{}])assert.throws(()=>new a.ContractError('X','validate','R',{worldRef:bad}),TypeError);
});
test('published success and failure fixtures decode and bind; the old seven-field error stays valid',async()=>{
 const f=await load();
 for(const x of [...f.exchanges,...f.legacy]){
  a.admitType(a.operationContracts[x.wire].find(o=>o.operation===x.operation).response,Buffer.from(JSON.stringify(x.response)));
  const r=a.validateBoundResponse(x.wire,x.operation,x.request,x.response);
  assert.equal(a.canonicalJSON(r),a.canonicalJSON(x.response),x.title);
  if(x.response.error)assert.equal(r.error.worldRef,x.response.error.worldRef,x.title);
 }
 const old=f.legacy.find(x=>!Object.hasOwn(x.response.error,'worldRef'));
 assert.deepEqual(Object.keys(a.validateBoundResponse(old.wire,old.operation,old.request,old.response).error),seven);
 const kept=f.legacy.find(x=>x.response.error.mutationState==='UNKNOWN');
 const r=a.validateBoundResponse(kept.wire,kept.operation,kept.request,kept.response).error;
 assert.deepEqual([r.mutationState,r.transactionRef,r.phase,r.retryability,r.worldRef],['UNKNOWN','fixture-transaction-1','readback','AFTER_NEW_FACTS',kept.request.worldRef]);
});
test('wrong world, illegal references and smuggled context reject',async()=>{
 const f=await load();
 assert.ok(f.reject.length>=10);
 for(const c of f.reject)reject(()=>a.validateBoundResponse(c.wire,c.operation,c.request,c.response),c.code);
 for(const c of f.reject.filter(c=>c.code!=='CURRENT_WORLD_MISMATCH'))reject(()=>a.validateType('Error',c.response.error),c.code);
});
test('request selectors bind; without a selector the provider binding is unverifiable but must be a Ref',async()=>{
 const f=await load(),[,select,tool,bound,none]=f.exchanges;
 assert.deepEqual(a.requestWorldSelectors(select.request),['fixture-world-A']);
 assert.deepEqual(a.requestWorldSelectors(tool.request),[tool.request.hostContext.localContext.worldRef]);
 assert.deepEqual(a.requestWorldSelectors(bound.request),[]);
 assert.equal(a.targetWorldRef(bound.request,f.trustedSessionWorlds),'fixture-world-A');
 assert.equal(a.targetWorldRef(none.request,f.trustedSessionWorlds),undefined);
 assert.equal(a.targetWorldRef(bound.request,new Map([['fixture-session-S1','fixture-world-Z']])),'fixture-world-Z');
 // The request selector decides; another Session's binding never overrides it.
 assert.equal(a.targetWorldRef(select.request,{[select.request.sessionRef]:'fixture-world-B'}),'fixture-world-A');
 assert.equal(a.targetWorldRef({...bound.request,sessionRef:'other-session'},f.trustedSessionWorlds),undefined);
 // Inherited keys are not trusted bindings.
 assert.equal(a.targetWorldRef({...bound.request,sessionRef:'constructor'},{}),undefined);
 reject(()=>a.targetWorldRef({worldRef:'a',localContext:{worldRef:'b'}}),'CURRENT_WORLD_MISMATCH');
 const tmpl={code:'ADAPTER_UNAVAILABLE',phase:'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason:'REQUIRED_FACT_UNKNOWN'};
 assert.deepEqual(Object.keys(a.worldUnavailableError(none.request,tmpl,f.trustedSessionWorlds)),seven);
 assert.equal(a.worldUnavailableError(bound.request,tmpl,f.trustedSessionWorlds).worldRef,'fixture-world-A');
 assert.throws(()=>a.worldUnavailableError(bound.request,{...tmpl,worldRef:'model-said-so'},f.trustedSessionWorlds),TypeError);
 reject(()=>a.worldUnavailableError(bound.request,{...tmpl,message:'x'},f.trustedSessionWorlds),'UNKNOWN_REQUIRED_FIELD');
});
test('published mock names the target from the request or trusted Session, preserving mutationState',async()=>{
 const f=await load(),before=a.canonicalJSON(f),mock=a.createWorldErrorMock(f);
 const select=f.exchanges[1].request;
 const r=mock('canvas/v7','SelectWorldConnection',{...select,requestId:'fresh',worldRef:'fixture-world-C'});
 assert.deepEqual([r.requestId,r.result,r.error.worldRef,r.error.mutationState,r.error.code,r.error.reason],['fresh',null,'fixture-world-C','NONE','CAPABILITY_UNAVAILABLE','REQUIRED_FACT_UNKNOWN']);
 assert.ok(Object.isFrozen(r.error));
 const resume={contractVersion:'session/v5',requestId:'q',expectedRevision:null};
 assert.equal(mock('session/v5','StartOrResumeSession',{...resume,sessionRef:'fixture-session-S1'}).error.worldRef,'fixture-world-A');
 assert.ok(!Object.hasOwn(mock('session/v5','StartOrResumeSession',{...resume,sessionRef:'fixture-session-S2'}).error,'worldRef'));
 reject(()=>mock('session/v5','StartOrResumeSession',{...resume,sessionRef:'fixture-session-S1',worldRef:'raw-json-world'}),'UNKNOWN_REQUIRED_FIELD');
 const bad=structuredClone(f);bad.exchanges[3].response.error.worldRef='fixture-world-B';
 assert.throws(()=>a.createWorldErrorMock(bad),TypeError);
 assert.equal(a.canonicalJSON(f),before);
});
test('a pre-2.7 closed decoder shape refuses worldRef; carrying it requires the new SDK',async()=>{
 const f=await load(),e=f.exchanges[1].response.error;
 const oldError=structuredClone(a.schemaBundle.definitions.Error);delete oldError.properties.worldRef;delete oldError.properties.source;
 assert.equal(oldError.additionalProperties,false);
 assert.ok(Object.keys(e).some(k=>!Object.hasOwn(oldError.properties,k)),'an error naming a world is outside the 2.6 closed shape');
 assert.match(a.worldErrorContext.compatibility,/UNKNOWN_REQUIRED_FIELD/u);
 assert.match(a.worldErrorContext.compatibility,/Same package major/u);
 assert.equal(a.contractsCompatibility.rule,'same-major');
});

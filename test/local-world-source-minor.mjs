import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as a from 'hanaworlds-contracts';
const wire='local-worlds/v2', operation='describeSourceWorld';
const request={contractVersion:wire,requestId:'read-source',worldRef:'source-world-a'};
const response={contractVersion:wire,requestId:request.requestId,result:{worldRef:request.worldRef,sourceLocator:{sourceOwned:{locator:'fixture-a'}}},error:null};
const reject=(fn,code)=>assert.throws(fn,e=>e instanceof a.ContractError&&e.code===code);
const load=async()=>JSON.parse(await readFile(new URL('../fixtures/local/local-world-source.json',import.meta.url),'utf8'));

test('source description is an additive read with the existing error vocabulary',()=>{
 const declaration=a.worldLifecycle.operations.find(o=>o.wire===wire&&o.operation===operation);
 assert.ok(declaration,'missing read-only describeSourceWorld');
 assert.deepEqual(declaration.errors,['WORLD_NOT_FOUND','ADAPTER_UNAVAILABLE','CURRENT_WORLD_MISMATCH']);
 assert.equal(a.canonicalJSON(a.validateBoundResponse(wire,operation,request,response).result),a.canonicalJSON(response.result));
});
test('successful receipt binds worldRef; success and refusal both echo requestId',()=>{
 reject(()=>a.validateBoundResponse(wire,operation,request,{...response,result:{...response.result,worldRef:'source-world-b'}}),'CURRENT_WORLD_MISMATCH');
 reject(()=>a.validateBoundResponse(wire,operation,request,{...response,requestId:'wrong-id'}),'TRANSACTION_CONFLICT');
 const error={code:'CURRENT_WORLD_MISMATCH',phase:'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason:'REVISION_CHANGED'};
 a.validateBoundResponse(wire,operation,request,{...response,result:null,error});
 reject(()=>a.validateBoundResponse(wire,operation,request,{...response,requestId:'wrong-id',result:null,error}),'TRANSACTION_CONFLICT');
 reject(()=>a.validateResponse(wire,operation,{...response,error}),'SCHEMA_INVALID');
 reject(()=>a.validateResponse(wire,operation,{...response,result:null}),'SCHEMA_INVALID');
 reject(()=>a.validateResponse(wire,operation,{...response,result:null,error:{...error,code:'INVALID_NAME'}}),'SCHEMA_INVALID');
});
test('closed envelopes and result reject unknown fields and mismatched versions',()=>{
 reject(()=>a.validateRequest(wire,operation,{...request,displayName:'Same world'}),'UNKNOWN_REQUIRED_FIELD');
 reject(()=>a.validateResponse(wire,operation,{...response,sourceLocator:{}}),'UNKNOWN_REQUIRED_FIELD');
 reject(()=>a.validateResponse(wire,operation,{...response,result:{...response.result,worldPath:'/host'}}),'UNKNOWN_REQUIRED_FIELD');
 reject(()=>a.validateRequest(wire,operation,{...request,contractVersion:'local-worlds/v1'}),'UNSUPPORTED_VERSION');
 reject(()=>a.validateResponse(wire,operation,{...response,contractVersion:'local-worlds/v1'}),'UNSUPPORTED_VERSION');
 reject(()=>a.validateRequest(wire,operation,{...request,worldRef:''}),'SCHEMA_INVALID');
});
test('sourceLocator carries strict opaque JSON unchanged, frozen and without executables',()=>{
 for(const value of [null,false,7,'source-token',[1,{unknown:[true,null]}],{worldRef:'opaque-is-not-a-selector',nested:{unknown:'kept'}}]){
  const input={...response,result:{worldRef:request.worldRef,sourceLocator:value}};
  const admitted=a.validateBoundResponse(wire,operation,request,input);
  assert.equal(a.canonicalJSON(admitted.result.sourceLocator),a.canonicalJSON(value));
  if(value&&typeof value==='object')assert.ok(Object.isFrozen(admitted.result.sourceLocator));
 }
 for(const value of [undefined,NaN,{fn:()=>1},{bad:undefined}])reject(()=>a.validateResponse(wire,operation,{...response,result:{...response.result,sourceLocator:value}}),'SCHEMA_INVALID');
 const raw=JSON.stringify(response).replace('"sourceOwned":','"duplicate":1,"duplicate":2,"sourceOwned":');
 reject(()=>a.admitType('LocalWorldsDescribeSourceResponse',Buffer.from(raw)),'NON_CANONICAL_AMBIGUITY');
 const input=structuredClone(response), admitted=a.validateResponse(wire,operation,input);
 input.result.sourceLocator.sourceOwned.locator='changed';
 assert.equal(admitted.result.sourceLocator.sourceOwned.locator,'fixture-a');
});
test('published mock selects distinct worlds with the same name and covers every refusal',async()=>{
 const f=await load(),before=a.canonicalJSON(f),mock=a.createLocalWorldSourceMock(f);
 const successes=f.exchanges.filter(x=>x.response.result!==null);
 assert.equal(successes.length,2);
 assert.equal(f.worlds[0].displayName,f.worlds[1].displayName);
 const locators=[];
 for(const x of successes){
  a.validateBoundResponse(wire,operation,x.request,x.response);
  const q={...x.request,requestId:'fresh-id'};
  const r=mock(q);assert.equal(r.requestId,q.requestId);assert.equal(r.result.worldRef,q.worldRef);
  locators.push(a.canonicalJSON(r.result.sourceLocator));
 }
 assert.notEqual(locators[0],locators[1]);
 assert.equal(mock({...request,worldRef:'unknown-world'}).error.code,'WORLD_NOT_FOUND');
 for(const x of f.exchanges.filter(x=>x.response.error)){
  a.validateBoundResponse(wire,operation,x.request,x.response);
  const r=a.createLocalWorldSourceMock(f,x.response.error.code)({...x.request,requestId:'refused-id'});
  assert.equal(r.requestId,'refused-id');assert.equal(r.error.code,x.response.error.code);
 }
 const malformed=structuredClone(f);malformed.exchanges[0].response.result.worldRef='wrong-world';
 reject(()=>a.createLocalWorldSourceMock(malformed),'CURRENT_WORLD_MISMATCH');
 assert.equal(a.canonicalJSON(f),before);
});
test('consumer explicitly reports absent optional capability and validates provider replies',async()=>{
 await assert.rejects(a.describeSourceWorld({},request),e=>e.code==='CAPABILITY_UNAVAILABLE');
 const provider={marker:'kept',async describeSourceWorld(q){assert.equal(this.marker,'kept');return {...response,requestId:q.requestId};}};
 assert.equal((await a.describeSourceWorld(provider,request)).result.worldRef,request.worldRef);
 await assert.rejects(a.describeSourceWorld({async describeSourceWorld(){return {...response,result:{...response.result,worldRef:'wrong-world'}};}},request),e=>e.code==='CURRENT_WORLD_MISMATCH');
 await assert.rejects(a.describeSourceWorld({async describeSourceWorld(){return {...response,requestId:'wrong-id'};}},request),e=>e.code==='TRANSACTION_CONFLICT');
});
test('every old schema, operation, digest rule and fixture stays unchanged',async()=>{
 // Hashes recorded from immutable v2.4.0 before implementation; no external run directory dependency.
 const baseline=JSON.parse(await readFile(new URL('./local-world-source-baseline.json',import.meta.url),'utf8'));
 const sha=v=>createHash('sha256').update(a.canonicalJSON(v)).digest('hex');
 const definitions=structuredClone(Object.fromEntries(baseline.definitionNames.map(n=>[n,a.schemaBundle.definitions[n]])));
 // 2.6.0 appends one build variant and one optional host carrier. Project the frozen 2.4 branches.
 for(const name of ['ToolBuildInput','ToolBuildResult']){
  assert.deepEqual(definitions[name].oneOf.pop(),{$ref:'#/definitions/'+(name==='ToolBuildInput'?'ToolDirectBuildInput':'ToolDirectBuildResult')});
  assert.equal(definitions[name]['x-variantKeys'].pop(),'build');
 }
 assert.deepEqual(definitions.ToolBuildRequest.properties.intentAuthorization,{$ref:'#/definitions/HostBuildIntentAuthorization'});
 delete definitions.ToolBuildRequest.properties.intentAuthorization;
 // 2.7.0 appends the optional Error.worldRef.
 assert.deepEqual(definitions.Error.properties.worldRef,{$ref:'#/definitions/Ref'});
 delete definitions.Error.properties.worldRef;
 delete definitions.Error.properties.source;
 for(const name of ['WorldSourceCapabilities','EngineFacts','WriteProfile']) if(definitions[name]) delete definitions[name].properties.transportPolicy;
 // 2.8.0 appends the optional QueryTransactionResponse historical pair.
 const q=definitions.QueryTransactionResponse.properties;
 assert.deepEqual([q.currentLocalContext,q.receiptDigest],[{$ref:'#/definitions/LocalWorldContext'},{$ref:'#/definitions/Digest'}]);
 delete q.currentLocalContext;delete q.receiptDigest;
 assert.equal(sha(definitions),baseline.definitionsDigest);
 const operations=Object.fromEntries(Object.entries(baseline.operationNames).map(([w,names])=>[w,names.map(n=>a.operationContracts[w].find(o=>o.operation===n))]));
 assert.equal(sha(operations),baseline.operationsDigest);
 const digest=structuredClone(a.digestProfile);
 assert.equal(digest.projectionTypes['confirmed-region-undo-scope'],'ConfirmedRegionUndoScope');
 delete digest.projectionTypes['confirmed-region-undo-scope'];
 assert.equal(sha(digest),baseline.digestProfileDigest);
 for(const [file,hash] of Object.entries(baseline.fixtures))assert.equal(sha(JSON.parse(await readFile(new URL('../fixtures/local/'+file,import.meta.url),'utf8'))),hash,file);
});

test('opaque source startup facts are optional for old providers and survive renamed/heterogeneous sources',async()=>{
 const old=await a.describeSourceWorld({describeSourceWorld:async()=>response},request);
 assert.equal(Object.hasOwn(old.result,'sourceStartupFacts'),false);
 const startup=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/source-startup')),'utf8'));
 for(const x of startup.exchanges){
  a.validateBoundResponse(wire,operation,x.request,x.response);
  const sourceStartupFacts=x.response.result.sourceStartupFacts;
  const r=await a.describeSourceWorld({describeSourceWorld:async()=>({...response,result:{...response.result,sourceStartupFacts}})},request);
  assert.equal(a.canonicalJSON(r.result.sourceStartupFacts),a.canonicalJSON(sourceStartupFacts));
 }
 reject(()=>a.validateResponse(wire,operation,{...response,result:{...response.result,sourceStartupFacts:{unsafe:()=>true}}}),'SCHEMA_INVALID');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as a from 'hanaworlds-contracts';
import tools from 'hanaworlds-contracts/tools' with {type:'json'};
import skill from 'hanaworlds-contracts/skill' with {type:'json'};
const load=n=>readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/'+n)),'utf8').then(JSON.parse);
const sha=v=>createHash('sha256').update(a.canonicalJSON(v)).digest('hex');
const reject=(fn,code)=>assert.throws(fn,e=>e instanceof a.ContractError&&e.code===code);
async function sample(kind='BUILD'){
 const f=await load('skill-tools');
 const old=f.exchanges.find(x=>x.operation==='hanaworlds_build'&&x.request.input.action==='apply'&&x.response.result);
 const proposal=f.exchanges.find(x=>x.operation===(kind==='BUILD'?'hanaworlds_proposal':'hanaworlds_region_proposal')).request.input.proposal;
 const main=await load('main'),host=structuredClone(old.request.hostContext);
 const message={messageRef:'current-user-message',text:'Build this exact structure here',media:[]};
 const authorization={...host,messageRef:message.messageRef,messageDigest:sha(message),intent:main.request.intent.confirmedIntent,proposalDigest:sha(proposal)};
 const q={...old.request,input:{action:'build',proposal},intentAuthorization:authorization};
 const facts={...host,currentUserRequest:message,intentAuthorization:authorization};
 const response={...old.response,result:{...old.response.result,action:'build'}};
 return {q,facts,response};
}
test('direct build accepts both neutral proposals with an independently stored current user authorization',async()=>{
 for(const kind of ['BUILD','REGION']){
  const {q,facts,response}=await sample(kind);
  assert.equal(a.validateToolRequest('hanaworlds_build',q,facts).input.action,'build');
  assert.equal(a.validateToolResponse('hanaworlds_build',q,response).result.action,'build');
 }
});
test('missing, changed or undetermined intent is refused even when the model proposal is shape-valid',async()=>{
 const {q,facts}=await sample();
 reject(()=>a.validateToolRequest('hanaworlds_build',{...q,intentAuthorization:undefined},facts),'SCHEMA_INVALID');
 const missing=structuredClone(q);delete missing.intentAuthorization;
 reject(()=>a.validateToolRequest('hanaworlds_build',missing,facts),'INTENT_UNCONFIRMED');
 for(const key of ['intentAuthorization','currentUserRequest']){
  const host=structuredClone(facts);delete host[key];
  reject(()=>a.validateToolRequest('hanaworlds_build',q,host),'INTENT_UNCONFIRMED');
 }
 const changed=structuredClone(q);changed.input.proposal.boxes[0].max[0]+=1;
 reject(()=>a.validateToolRequest('hanaworlds_build',changed,facts),'INTENT_UNCONFIRMED');
 for(const intentPatch of [{text:' '},{kind:'MODIFY_OBJECT'},{confirmedTurnRevision:'old'}]){
  const x=structuredClone(q),h=structuredClone(facts);Object.assign(x.intentAuthorization.intent,intentPatch);h.intentAuthorization=x.intentAuthorization;
  reject(()=>a.validateToolRequest('hanaworlds_build',x,h),intentPatch.confirmedTurnRevision?'TURN_REVISION_MISMATCH':'INTENT_UNCONFIRMED');
 }
});
test('authorization cannot cross session, turn, revision, world or current message',async()=>{
 const {q,facts}=await sample();
 for(const [key,value,code] of [['sessionRef','other','TRANSACTION_CONFLICT'],['turnRef','other','TRANSACTION_CONFLICT'],['turnRevision','old','TURN_REVISION_MISMATCH']]){
  const x=structuredClone(q),h=structuredClone(facts);x.intentAuthorization[key]=value;h.intentAuthorization=x.intentAuthorization;
  reject(()=>a.validateToolRequest('hanaworlds_build',x,h),code);
 }
 const x=structuredClone(q),h=structuredClone(facts);x.intentAuthorization.localContext.worldRef='other';h.intentAuthorization=x.intentAuthorization;
 reject(()=>a.validateToolRequest('hanaworlds_build',x,h),'CURRENT_WORLD_MISMATCH');
 for(const patch of [{messageRef:'old-message'},{text:'Changed request'}]){
  const h=structuredClone(facts);Object.assign(h.currentUserRequest,patch);
  reject(()=>a.validateToolRequest('hanaworlds_build',q,h),'INTENT_UNCONFIRMED');
 }
 const forged=structuredClone(q);forged.intentAuthorization.intent.text='model claim';
 reject(()=>a.validateToolRequest('hanaworlds_build',forged,facts),'INTENT_UNCONFIRMED');
 const noWorld=structuredClone(q),noWorldFacts=structuredClone(facts);noWorld.hostContext.localContext=null;noWorldFacts.localContext=null;
 reject(()=>a.validateToolRequest('hanaworlds_build',noWorld,noWorldFacts),'WORLD_NOT_BOUND');
});
test('model cannot submit authorization, world identity or confirmation and cannot change the proposal discriminator',async()=>{
 const {q,facts,response}=await sample();
 for(const key of ['intentAuthorization','confirmed','clear','sessionRef','worldRef']){
  const x=structuredClone(q);x.input[key]=true;
  reject(()=>a.validateToolRequest('hanaworlds_build',x,facts),'UNKNOWN_REQUIRED_FIELD');
 }
 const x=structuredClone(q);x.input.proposal.decision='REGION';
 reject(()=>a.validateToolRequest('hanaworlds_build',x,facts),'UNKNOWN_REQUIRED_FIELD');
 const missing=structuredClone(q);delete missing.intentAuthorization;
 reject(()=>a.validateToolResponse('hanaworlds_build',missing,response),'INTENT_UNCONFIRMED');
 reject(()=>a.validateToolResponse('hanaworlds_build',q,{...response,result:{...response.result,action:'apply'}}),'TRANSACTION_CONFLICT');
});
test('published direct-build fixture and skill calls cover success and every legal refusal for both decisions',async()=>{
 const f=await load('direct-build');
 const declaration=a.toolManifest.tools.find(t=>t.name==='hanaworlds_build').actions.find(t=>t.action==='build');
 assert.equal(declaration.input,'ToolDirectBuildInput');assert.equal(declaration.output,'ToolDirectBuildResult');
 assert.equal(a.directBuild.authorization,'HostBuildIntentAuthorization');
 assert.equal(a.canonicalJSON(tools.directBuild),a.canonicalJSON(a.directBuild));
 assert.equal(a.canonicalJSON(skill.directBuild),a.canonicalJSON(a.directBuild));
 for(const decision of ['BUILD','REGION']){
  const xs=f.exchanges.filter(x=>x.request.input.proposal.decision===decision);
  assert.equal(xs.filter(x=>x.response.result).length,1);
  assert.deepEqual(xs.filter(x=>x.response.error).map(x=>x.response.error.code),declaration.errors);
 }
 for(const x of f.exchanges){
  a.admitRequest(x.wire,x.operation,Buffer.from(JSON.stringify(x.request)));
  a.validateToolRequest(x.operation,x.request,x.hostFacts);
  a.validateToolResponse(x.operation,x.request,x.response);
  const mock=a.createSkillToolsMock(f,{[`${x.operation}:build`]:x.response.error?.code});
  assert.equal(a.canonicalJSON(mock(x.operation,{...x.request,requestId:'fresh'},x.hostFacts)),a.canonicalJSON({...x.response,requestId:'fresh'}));
  const wrong={...x.response,requestId:'wrong'};
  reject(()=>a.validateToolResponse(x.operation,x.request,wrong),'TRANSACTION_CONFLICT');
 }
 for(const x of f.calls)a.validateBoundResponse(x.wire,x.operation,x.request,x.response);
 const x=f.exchanges.find(x=>x.response.result),missing=structuredClone(x.request);delete missing.intentAuthorization;
 // A refusal can describe a missing authorization; a successful result cannot bypass it.
 const e=f.exchanges.find(x=>x.response.error?.code==='INTENT_UNCONFIRMED').response;
 assert.equal(a.validateToolResponse(x.operation,missing,e).error.code,'INTENT_UNCONFIRMED');
 reject(()=>a.validateToolResponse(x.operation,x.request,{...e,error:{...e.error,code:'REDO_UNAVAILABLE'}}),'SCHEMA_INVALID');
 const guardRefusal={guard:'BODY_CLEARANCE',stage:a.engineGuards.stages.find(s=>s.phase==='apply').stage,finding:'BODY_OCCUPIED'};
 const guarded={...x.response,result:null,error:a.guardRefusalError(guardRefusal),guardRefusal};
 assert.equal(a.canonicalJSON(a.validateToolResponse(x.operation,x.request,guarded).guardRefusal),a.canonicalJSON(guardRefusal));
 const affected=f.exchanges.find(x=>x.response.error?.code==='OTHER_OBJECTS_AFFECTED');
 assert.equal(a.createSkillToolsMock(f,{'hanaworlds_build:build':'OTHER_OBJECTS_AFFECTED'})(affected.operation,affected.request,affected.hostFacts).result,null);
});
test('old build calls remain valid with no authorization or current user readback',async()=>{
 const f=await load('skill-tools');
 const old=f.exchanges.filter(x=>x.operation==='hanaworlds_build');
 for(const x of old){
  assert.ok(!Object.hasOwn(x.request,'intentAuthorization'));
  assert.ok(['apply','inspect','undo','redo'].includes(x.request.input.action));
  a.validateToolRequest(x.operation,x.request,x.request.hostContext);
  a.validateToolResponse(x.operation,x.request,x.response);
 }
 const x=f.exchanges.find(x=>x.operation==='hanaworlds_proposal'&&x.response.result);
 assert.equal(a.validateToolResponse(x.operation,x.request,x.response).result.confirmed,false);
 const r=f.exchanges.find(x=>x.operation==='hanaworlds_region_proposal'&&x.response.result);
 assert.equal(a.validateToolResponse(r.operation,r.request,r.response).result.confirmed,false);
});
test('2.5.0 definitions, operations, digests, ownership and old tool branches are unchanged after projecting the optional extension',async()=>{
 const b=JSON.parse(await readFile(new URL('./direct-build-baseline.json',import.meta.url),'utf8'));
 const d=structuredClone(Object.fromEntries(b.definitionNames.map(n=>[n,a.schemaBundle.definitions[n]])));
 for(const n of ['ToolBuildInput','ToolBuildResult']){
  assert.deepEqual(d[n].oneOf.pop(),{$ref:'#/definitions/'+(n==='ToolBuildInput'?'ToolDirectBuildInput':'ToolDirectBuildResult')});
  assert.equal(d[n]['x-variantKeys'].pop(),'build');
 }
 assert.deepEqual(d.ToolBuildRequest.properties.intentAuthorization,{$ref:'#/definitions/HostBuildIntentAuthorization'});
 assert.ok(!d.ToolBuildRequest.required.includes('intentAuthorization'));
 delete d.ToolBuildRequest.properties.intentAuthorization;
 // 2.7.0 appends the optional Error.worldRef; project it out of the frozen 2.5.0 shape.
 assert.deepEqual(d.Error.properties.worldRef,{$ref:'#/definitions/Ref'});
 delete d.Error.properties.worldRef;
 // 2.8.0 appends the optional QueryTransactionResponse historical pair.
 assert.deepEqual([d.QueryTransactionResponse.properties.currentLocalContext,d.QueryTransactionResponse.properties.receiptDigest],[{$ref:'#/definitions/LocalWorldContext'},{$ref:'#/definitions/Digest'}]);
 delete d.QueryTransactionResponse.properties.currentLocalContext;delete d.QueryTransactionResponse.properties.receiptDigest;
 assert.equal(sha(d),b.definitionsDigest);
 // 2.9.0 appends world-inspection/v1 ReadPluginRoles; project it out of the frozen 2.5.0 operations.
 const operations=structuredClone(a.operationContracts);
 assert.deepEqual(operations['world-inspection/v1'].pop(),{operation:'ReadPluginRoles',request:'ReadPluginRolesRequest',response:'ReadPluginRolesResponse'});
 // 2.10.0 adds only this C-canvas read.
 assert.deepEqual(operations['canvas/v7'].pop(),{operation:'ReadPlacementSettings',request:'ReadPlacementSettingsRequest',response:'ReadPlacementSettingsResponse'});
 assert.equal(sha(operations),b.operationsDigest);
 assert.equal(sha(a.digestProfile),b.digestDigest);
 assert.equal(sha(a.ownership),b.ownershipDigest);
 const tools=structuredClone(a.toolManifest.tools),t=tools.find(t=>t.name==='hanaworlds_build');
 assert.equal(t.actions.pop().action,'build');assert.equal(t.hostInjectedFields.pop(),'intentAuthorization');
 assert.equal(a.canonicalJSON(tools),a.canonicalJSON(b.tools));
});

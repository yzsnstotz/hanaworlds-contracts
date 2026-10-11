import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
import toolDocument from 'hanaworlds-contracts/tools' with {type:'json'};
import skillDocument from 'hanaworlds-contracts/skill' with {type:'json'};
const fixture=()=>readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/skill-tools')),'utf8').then(JSON.parse);
const reject=(fn,code)=>assert.throws(fn,e=>e instanceof a.ContractError&&e.code===code);
const names=['hanaworlds_context','hanaworlds_proposal','hanaworlds_region_proposal','hanaworlds_build','hanaworlds_write_methods','hanaworlds_download_image','hanaworlds_image_material'];

test('published declaration lists exactly the seven approved tools and their complete action schemas',()=>{
 assert.ok(a.toolManifest,'missing machine readable tool manifest');
 assert.deepEqual(a.toolManifest.tools.map(t=>t.name),names);
 assert.equal(a.toolManifest.version,a.version);
 assert.deepEqual(toolDocument.tools,a.toolManifest.tools);
 assert.deepEqual(toolDocument.definitions,a.schemaBundle.definitions);
 assert.equal(skillDocument.name,'hanaworlds-building');
 assert.deepEqual(skillDocument.definitions,a.schemaBundle.definitions);
 for(const t of a.toolManifest.tools)for(const d of t.actions){
  assert.ok(a.schemaBundle.definitions[d.input]);assert.ok(a.schemaBundle.definitions[d.output]);
  assert.ok(d.errors.every(c=>a.schemaBundle.definitions.ErrorCode.enum.includes(c)));
 }
 assert.deepEqual(a.toolManifest.tools.find(t=>t.name==='hanaworlds_build').actions.map(d=>d.action),['apply','inspect','undo','redo','build']);
 assert.equal(a.buildingSkill.name,'hanaworlds-building');
 assert.equal(a.buildingSkill.hostInjected,true);
 assert.deepEqual(a.buildingSkill.tools,names);
 assert.ok(a.operationContracts['session/v5'].some(d=>d.operation==='RedoCurrentBuild'));
});
test('all public success and operation-specific refusal examples decode, bind and run through the fixture mock',async()=>{
 const f=await fixture(),mock=a.createSkillToolsMock(f);
 for(const x of f.exchanges){
  a.admitRequest(x.wire,x.operation,Buffer.from(JSON.stringify(x.request)));
  a.validateToolRequest(x.operation,x.request,x.request.hostContext);
  a.validateToolResponse(x.operation,x.request,x.response);
  const changed=structuredClone(x.response);changed.requestId='wrong';
  reject(()=>a.validateToolResponse(x.operation,x.request,changed),'TRANSACTION_CONFLICT');
  const invoke=a.createSkillToolsMock(f,{[`${x.operation}:${x.request.input.action}`]:x.response.error?.code});
  const q={...x.request,requestId:'fresh'};
  assert.equal(invoke(x.operation,q,q.hostContext).requestId,'fresh');
 }
 for(const t of a.toolManifest.tools)for(const d of t.actions.filter(d=>d.action!=='build')){
  const xs=f.exchanges.filter(x=>x.operation===t.name&&x.request.input.action===d.action);
  assert.ok(xs.some(x=>x.response.result));
  for(const code of d.errors)assert.ok(xs.some(x=>x.response.error?.code===code),`${t.name}/${d.action}/${code}`);
 }
 const x=f.exchanges.find(x=>x.response.result);
 assert.ok(mock(x.operation,x.request,x.request.hostContext).result);
});
test('model inputs reject host identity, unapproved actions and fabricated confirmation; host facts remain authoritative',async()=>{
 const f=await fixture();
 for(const x of f.exchanges.filter(x=>x.response.result)){
  for(const key of ['sessionRef','worldRef','localContext','confirmed']){
   const q=structuredClone(x.request);q.input[key]='model-supplied';
   reject(()=>a.validateToolRequest(x.operation,q,q.hostContext),'UNKNOWN_REQUIRED_FIELD');
  }
  const q=structuredClone(x.request);q.input.action='legacy-action';
  reject(()=>a.validateToolRequest(x.operation,q,q.hostContext),'SCHEMA_INVALID');
  const host=structuredClone(x.request.hostContext);host.sessionRef='different';
  reject(()=>a.validateToolRequest(x.operation,x.request,host),'TRANSACTION_CONFLICT');
  host.sessionRef=x.request.hostContext.sessionRef;host.localContext.worldRef='different';
  reject(()=>a.validateToolRequest(x.operation,x.request,host),'CURRENT_WORLD_MISMATCH');
 }
});
test('responses reject action swapping, illegal error codes, result/error coexistence and cross-world facts',async()=>{
 const f=await fixture();
 for(const x of f.exchanges.filter(x=>x.response.result)){
  const r=structuredClone(x.response);r.result.action='unknown';
  reject(()=>a.validateToolResponse(x.operation,x.request,r),'SCHEMA_INVALID');
  const e=structuredClone(x.response);e.result=null;e.error={code:'MODEL_UNAVAILABLE',phase:'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason:'REQUIRED_FACT_UNKNOWN'};
  reject(()=>a.validateToolResponse(x.operation,x.request,e),'SCHEMA_INVALID');
  e.result=x.response.result;reject(()=>a.validateToolResponse(x.operation,x.request,e),'SCHEMA_INVALID');
 }
 const x=f.exchanges.find(x=>x.operation==='hanaworlds_context'&&x.response.result),r=structuredClone(x.response);
 r.result.engineFacts.connection.worldRef='different';
 reject(()=>a.validateToolResponse(x.operation,x.request,r),'CURRENT_WORLD_MISMATCH');
 const build=f.exchanges.find(x=>x.operation==='hanaworlds_build'&&x.request.input.action==='undo'&&x.response.result),swap=f.exchanges.find(x=>x.operation==='hanaworlds_build'&&x.request.input.action==='inspect'&&x.response.result);
 reject(()=>a.validateToolResponse(build.operation,build.request,{...build.response,result:swap.response.result}),'TRANSACTION_CONFLICT');
 const proposal=f.exchanges.find(x=>x.operation==='hanaworlds_region_proposal'&&x.response.result),bad=structuredClone(proposal.response);
 bad.result.plan.buildDigest='0'.repeat(64);
 reject(()=>a.validateToolResponse(proposal.operation,proposal.request,bad),'NON_CANONICAL_AMBIGUITY');
});
test('download bytes and image colour matches retain integrity and legal world-source material references',async()=>{
 const f=await fixture(),x=f.exchanges.find(x=>x.operation==='hanaworlds_download_image'&&x.response.result);
 const bad=structuredClone(x.response);bad.result.image.bytesBase64='AAAA';
 reject(()=>a.validateToolResponse(x.operation,x.request,bad),'SCHEMA_INVALID');
 const y=f.exchanges.find(x=>x.operation==='hanaworlds_image_material'&&x.response.result),r=structuredClone(y.response);
 r.result.matches[0].materialRef='not-in-catalogue';
 reject(()=>a.validateToolResponse(y.operation,y.request,r),'SCHEMA_INVALID');
 const q=structuredClone(y.request);q.catalogueFacts.connection.worldRef='different';
 reject(()=>a.validateToolRequest(y.operation,q,q.hostContext),'CURRENT_WORLD_MISMATCH');
});
test('skill current-turn text/attachment references, clarification/proposal/tool output and both Redo calls are public operations',async()=>{
 const f=await fixture();
 for(const x of f.calls){
  a.admitRequest(x.wire,x.operation,Buffer.from(JSON.stringify(x.request)));
  a.validateBoundResponse(x.wire,x.operation,x.request,x.response);
 }
 const call=f.calls.find(x=>x.operation==='hanaworlds-building'&&x.response.result?.kind==='tool_call');
 const bad=structuredClone(call.response);bad.result.call.input.worldRef='invented';
 reject(()=>a.validateBoundResponse(call.wire,call.operation,call.request,bad),'UNKNOWN_REQUIRED_FIELD');
 const redo=f.calls.find(x=>x.operation==='RedoCurrentBuild'),r=structuredClone(redo.response);
 r.result.localContext.worldRef='another';
 reject(()=>a.validateBoundResponse(redo.wire,redo.operation,redo.request,r),'CURRENT_WORLD_MISMATCH');
});
test('build preserves existing guard refusal and rejects a refusal/error mismatch',async()=>{
 const f=await fixture(),x=f.exchanges.find(x=>x.operation==='hanaworlds_build'&&x.request.input.action==='redo'&&x.response.result);
 const guardRefusal={guard:'BODY_CLEARANCE',stage:a.engineGuards.stages.find(s=>s.phase==='apply').stage,finding:'BODY_OCCUPIED'};
 const r={...x.response,result:null,error:a.guardRefusalError(guardRefusal),guardRefusal};
 assert.equal(a.canonicalJSON(a.validateToolResponse(x.operation,x.request,r).guardRefusal),a.canonicalJSON(guardRefusal));
 reject(()=>a.validateToolResponse(x.operation,x.request,{...r,error:{...r.error,code:'TRANSACTION_CONFLICT'}}),'SCHEMA_INVALID');
});

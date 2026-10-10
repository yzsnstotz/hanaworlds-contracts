// region-rollback-cause/v1 conformance (SOURCE/FIXTURE). A successful whole-region rollback states the
// failure Canvas observed in that transaction inside its result; an absent cause is UNKNOWN; nothing is
// inferred, defaulted or attributed to natural simulation. Providers and consumers run this against the
// installed package.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const load=async n=>JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/'+n))));
const fx=await load('region-rollback-cause'),region=await load('region');
const clone=v=>JSON.parse(JSON.stringify(v));
let passed=0;function test(name,fn){fn();console.log('ok',++passed,name)}
const rejects=(fn,error,title)=>assert.throws(fn,e=>{for(const [k,v] of Object.entries(error))assert.equal(e[k],v,`${title}: ${k}`);return true;},title);

test('contract surface: optional field without null form, capability, invariant, metadata',()=>{
 assert.equal(a.contractsCompatibility.major,1);
 const def=a.schemaBundle.definitions.RegionCommitResult;
 assert.ok(!def.required.includes('rollbackCause'));assert.deepEqual(def.properties.rollbackCause,{$ref:'#/definitions/FailureDetail'});
 assert.equal(a.regionRollbackCause.id,'region-rollback-cause/v1');assert.equal(a.regionRollbackCause.unknown,'UNKNOWN');
 assert.equal(fx.capability,a.regionRollbackCause.capability);
 assert.ok(a.regionCapabilities.some(c=>c.id==='canvas-region/v2:rollback-cause'&&c.owner==='hanaworlds-canvas'));
 assert.ok(a.regionInvariants.some(i=>i.id==='REGION-ROLLBACK-CAUSE-OBSERVED'&&i.switchable===false));
 assert.ok(a.wireVersions.includes('canvas-region/v2'));
 // Envelope unchanged: result XOR error; applyFailure still only beside a restore error.
 assert.deepEqual(Object.keys(a.schemaBundle.definitions.ApplyRegionCommitResponse.properties),['contractVersion','requestId','result','error','guardRefusal','applyFailure']);
});
test('every accepted case reads back exactly the recorded cause, bound to request, transaction, World and context',()=>{
 for(const c of fx.accept){
  const read=a.regionRollbackCauseOf(c.request,c.response);
  assert.deepEqual(clone(read),c.read,c.id);
  assert.ok(Object.isFrozen(read),c.id);
  assert.equal(read.requestId,c.request.requestId);assert.equal(read.transactionId,c.request.transactionId);
  assert.equal(read.worldRef,c.request.worldRef);assert.deepEqual(clone(read.localContext),c.request.localContext);
  assert.equal(read.operationDigest,c.request.operationDigest);
  if(read.cause==='REPORTED')assert.deepEqual(clone(read.failure),c.response.result.rollbackCause,c.id);
  else{assert.equal(read.cause,'UNKNOWN');assert.equal(read.failure,null);assert.ok(!Object.hasOwn(c.response.result,'rollbackCause'));}
  // The commit validator accepts the same pair; the helper is pure and never writes.
  a.validateRegionCommit(c.request,c.response);
 }
 assert.deepEqual(fx.accept.map(c=>c.read.cause),['REPORTED','REPORTED','REPORTED','UNKNOWN']);
});
test('a relayed Adapter guard refusal stays exactly explained by guardRefusalError',()=>{
 const f=fx.accept.find(c=>c.id==='A1').read.failure;
 assert.deepEqual(clone(a.guardRefusalError(f.guardRefusal,{transactionRef:f.error.transactionRef})),f.error);
});
test('every rejected case is refused with the recorded public error',()=>{
 for(const c of fx.reject)rejects(()=>a.regionRollbackCauseOf(c.request,c.response),{code:c.error.code,reason:c.error.reason},`${c.id} ${c.what}`);
 const codes=Object.fromEntries(fx.reject.map(c=>[c.id,c.error.code]));
 assert.deepEqual(codes,{R1:'SCHEMA_INVALID',R2:'SCHEMA_INVALID',R3:'SCHEMA_INVALID',R4:'SCHEMA_INVALID',R5:'SCHEMA_INVALID',R6:'SCHEMA_INVALID',
  R7:'UNKNOWN_REQUIRED_FIELD',R8:'SCHEMA_INVALID',R9:'TRANSACTION_CONFLICT',R10:'CURRENT_WORLD_MISMATCH',R11:'SCHEMA_INVALID'});
});
test('validateResponse alone refuses the same malformed causes (not only the helper)',()=>{
 for(const id of ['R1','R2','R3','R4','R5','R6','R7','R8']){const c=fx.reject.find(x=>x.id===id);
  rejects(()=>a.validateResponse('canvas-region/v2','ApplyRegionCommit',c.response),{code:c.error.code},id);}
});
test('cause adds no digest or summary change: 1.1 region commit values keep their digests',()=>{
 const r=region.commitResponse.result;
 a.validateRegionCommit(region.commitRequest,region.commitResponse);
 const rb=fx.accept.find(c=>c.id==='A2').response.result;
 assert.equal(a.digestValue('region-summary',rb.beforeSummary).sha256,a.digestValue('region-summary',r.beforeSummary).sha256);
 assert.equal(rb.snapshot.beforeSummaryDigest,r.snapshot.beforeSummaryDigest);
});
test('Undo results do not carry a rollback cause (not covered by this capability)',()=>{
 assert.ok(!Object.hasOwn(a.schemaBundle.definitions.RegionUndoResult.properties,'rollbackCause'));
 const u=clone(region.undoResponse);u.result.rollbackCause=clone(fx.accept[1].read.failure);
 rejects(()=>a.validateResponse('canvas-region/v2','UndoRegionCommit',u),{code:'UNKNOWN_REQUIRED_FIELD'},'undo');
});
console.log(`region-rollback-cause: ${passed} passed`);

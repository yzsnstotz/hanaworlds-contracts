import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from 'hanaworlds-contracts';
test('D-21=A publishes an independent scoped undo and keeps the old validator', () => {
  assert.equal(typeof api.deriveConfirmedRegionUndoScope, 'function');
  assert.equal(typeof api.validateScopedRegionUndo, 'function');
  assert.equal(typeof api.validateRegionUndo, 'function');
  assert.ok(api.operationContracts['canvas-region/v3'].some(o => o.operation === 'UndoScopedRegionCommit'));
});
const f=JSON.parse(await (await import('node:fs/promises')).readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/scoped-region-undo')),'utf8'));
const clone=x=>structuredClone(x),D=(k,v)=>api.digestValue(k,v).sha256;
const reject=(fn,code)=>assert.throws(fn,e=>e.code===code);
test('truthful complete summaries differ externally; new helper passes and old helper still rejects',async()=>{
  const r=api.validateScopedRegionUndo(f.request,f.response,f.origin);
  assert.notEqual(D('region-summary',r.result.outcome.preUndoSummary),r.result.outcome.originAfterSummaryDigest);
  assert.notEqual(D('region-summary',r.result.outcome.actualSummary),r.result.outcome.originBeforeSummaryDigest);
  assert.equal(r.result.scope.positions.length,8);
  const q=clone(f.request);delete q.expectedScopeDigest;
  reject(()=>api.validateRegionUndo(q,{...f.response,result:r.result.outcome,undoFailure:undefined},f.origin.result),'SCHEMA_INVALID');
  const legacy={contractVersion:q.contractVersion,requestId:q.requestId,result:r.result.outcome,error:null,guardRefusal:null,applyFailure:null};
  reject(()=>api.validateRegionUndo(q,legacy,f.origin.result),'UNDO_CONFLICT');
  assert.equal(api.canonicalJSON(await api.createScopedRegionUndoMock(f).call('UndoScopedRegionCommit',f.request)),api.canonicalJSON(f.response));
});
test('missing scope, wrong origin/world/session/identity/digest and UNSPECIFIED scope expansion refuse',()=>{
  for(const field of ['expectedScopeDigest']){const q=clone(f.request);delete q[field];reject(()=>api.validateScopedRegionUndoRequest(q,f.origin),'SCHEMA_INVALID');}
  for(const field of ['originTransactionId','expectedHistoryRevision','expectedScopeDigest']){const q={...f.request,[field]:field==='expectedScopeDigest'?'e'.repeat(64):'wrong'};reject(()=>api.validateScopedRegionUndoRequest(q,f.origin),'UNDO_CONFLICT');}
  for(const field of ['sessionRef','worldRef'])reject(()=>api.validateScopedRegionUndoRequest({...f.request,[field]:'wrong'},f.origin),'CURRENT_WORLD_MISMATCH');
  reject(()=>api.validateScopedRegionUndoRequest({...f.request,localContext:{...f.request.localContext,connectionIncarnationRef:'expired'}},f.origin),'CURRENT_WORLD_MISMATCH');
  const bad=clone(f.origin);bad.request.operationDigest='a'.repeat(64);reject(()=>api.deriveConfirmedRegionUndoScope(bad),'NON_CANONICAL_AMBIGUITY');
  const enlarged=clone(f.response);enlarged.result.scope.positions.push([3,0,3]);reject(()=>api.validateScopedRegionUndo(f.request,enlarged,f.origin),'UNDO_CONFLICT');
  const wrong=clone(f.origin);wrong.result.transactionId='other';reject(()=>api.deriveConfirmedRegionUndoScope(wrong),'TRANSACTION_CONFLICT');
});
test('in-scope edit and StateProfile drift refuse; forged full digest is never accepted',()=>{
  const edit=clone(f.response.result.preUndoContent),c=edit.chunks[0];
  c.state.block=api.encodeRegionBlock({origin:[0,0,0],size:[4,1,4],palette:[{materialRef:'fixture:gold',orientation:0}],indices:new Int32Array(16)});
  c.stateDigest=D('region-state',c.state);reject(()=>api.composeScopedRegionUndoTarget(f.origin,edit),'UNDO_CONFLICT');
  const drift=clone(f.response.result.preUndoContent);drift.chunks[0].state.stateProfile.derivedFields=['different'];drift.chunks[0].stateDigest=D('region-state',drift.chunks[0].state);reject(()=>api.composeScopedRegionUndoTarget(f.origin,drift),'CAPABILITY_GAP');
  const forged=clone(f.response);forged.result.actualContent.chunks[0].stateDigest='f'.repeat(64);reject(()=>api.validateScopedRegionUndo(f.request,forged,f.origin),'NON_CANONICAL_AMBIGUITY');
});
test('same scoped rollback preserves current outside and refuses unproved in-scope values',()=>{
  const pre=f.response.result.preUndoContent;
  const rollback=api.composeScopedRegionUndoRecoveryTarget(f.origin,pre,f.response.result.actualContent);
  assert.equal(api.canonicalJSON(rollback),api.canonicalJSON(pre));
  const bad=clone(f.response.result.actualContent);bad.chunks[0].state.extras.push({position:[0,0,0],state:{metadata:{unproved:true}}});bad.chunks[0].state.extras.sort((a,b)=>api.comparePosition(a.position,b.position));bad.chunks[0].stateDigest=D('region-state',bad.chunks[0].state);
  reject(()=>api.composeScopedRegionUndoRecoveryTarget(f.origin,pre,bad),'RECOVERY_PENDING');
});
test('multi-partition origin fixture uses actual coordinates and all committed cells',async()=>{
 const old=JSON.parse(await (await import('node:fs/promises')).readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/region')),'utf8'));
 const before=old.snapshotContent;
 const after={...before,chunks:before.chunks.map((c,i)=>{const state=api.expectedRegionState(c.state,old.commitRequest.operations.chunks[i].block);return {chunkPos:c.chunkPos,state,stateDigest:D('region-state',state)};})};
 const origin={request:old.commitRequest,result:old.commitResponse.result,before,after};
 const scope=api.deriveConfirmedRegionUndoScope(origin);
 assert.ok(before.chunks.length>1);assert.ok(scope.positions.some(p=>p[0]<0));assert.ok(scope.positions.some(p=>p[0]>=16));
 assert.equal(api.canonicalJSON(api.composeScopedRegionUndoTarget(origin,after)),api.canonicalJSON(before));
});
test('a rollback must carry the observed failure and a successful undo has none',()=>{
 const rollback=clone(f.response);rollback.result.outcome.status='ROLLED_BACK';rollback.result.actualContent=rollback.result.preUndoContent;rollback.result.outcome.actualSummary=rollback.result.outcome.preUndoSummary;
 reject(()=>api.validateScopedRegionUndo(f.request,rollback,f.origin),'SCHEMA_INVALID');
 rollback.undoFailure={error:{code:'RESTORE_FAILED',phase:'restore',retryability:'AFTER_MANUAL_RECOVERY',mutationState:'PARTIAL',transactionRef:f.request.undoTransactionId,causeCode:null,reason:'RESTORE_ERROR'},guardRefusal:null};
 api.validateScopedRegionUndo(f.request,rollback,f.origin);
 const verified=clone(f.response);verified.undoFailure=rollback.undoFailure;reject(()=>api.validateScopedRegionUndo(f.request,verified,f.origin),'SCHEMA_INVALID');
});

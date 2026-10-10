// Regenerates spec/local-world/fixtures/region-rollback-cause.json (region-rollback-cause/v1) from the
// published region fixture. Each case is a canvas-region/v2 ApplyRegionCommit request/response pair; the
// expected outcome (accepted with the read cause, or the exact refusal) is computed with the package's own
// public functions and recorded as data so Canvas (producer) and consumers run the same cases. Hand-built
// SOURCE/FIXTURE: no Canvas, Adapter, World or durable store ran. Run after `npm run build`, then build
// again to publish fixtures/local.
import {readFile,writeFile} from 'node:fs/promises';
import * as a from '../dist/local/index.mjs';
const regionFx=JSON.parse(await readFile('spec/local-world/fixtures/region.json','utf8'));
const clone=v=>JSON.parse(JSON.stringify(v));
const tx=regionFx.commitResponse.result.transactionId;
// A successful whole rollback: the actual summary equals the before summary.
function rolledBack(rollbackCause){
 const request=clone(regionFx.commitRequest),response=clone(regionFx.commitResponse);
 Object.assign(response.result,{status:'ROLLED_BACK',actualSummary:clone(response.result.beforeSummary)});
 if(rollbackCause!==undefined)response.result.rollbackCause=clone(rollbackCause);
 return {request,response};
}
const err=(code,phase,mutationState,reason,transactionRef=tx)=>({code,phase,retryability:'AFTER_NEW_FACTS',mutationState,transactionRef,causeCode:null,reason});
// Adapter WriteRegion APPLY refused by an engine guard after earlier chunks were written: relayed unchanged.
const refusal={guard:'BODY_CLEARANCE',stage:'REGION_APPLY',finding:'BODY_OCCUPIED'};
const guarded={error:a.guardRefusalError(refusal,{transactionRef:null}),guardRefusal:refusal};
const readbackMismatch={error:err('READBACK_MISMATCH','readback','PARTIAL','READBACK_ERROR'),guardRefusal:null};
const outcomeUnknown={error:err('APPLY_FAILED','apply','UNKNOWN','TRANSPORT_OUTCOME_UNKNOWN'),guardRefusal:null};
const capture=fn=>{try{fn();}catch(e){return {code:e.code,phase:e.phase,reason:e.reason};}throw Error('expected a refusal');};
const accept=[
 {id:'A1',what:'rollback caused by a relayed Adapter guard refusal at REGION_APPLY (transactionRef null as relayed)',...rolledBack(guarded)},
 {id:'A2',what:'rollback caused by Canvas readback mismatch, bound to the same transaction',...rolledBack(readbackMismatch)},
 {id:'A3',what:'rollback after an apply whose outcome was unknown to Canvas',...rolledBack(outcomeUnknown)},
 {id:'A4',what:'rollback without a reported cause (the 1.1 value): cause UNKNOWN',...rolledBack()},
].map(c=>({...c,read:clone(a.regionRollbackCauseOf(c.request,c.response))}));
const variant=(id,what,edit)=>{const c=rolledBack(guarded);edit(c);return {id,what,request:c.request,response:c.response};};
const reject=[
 {id:'R1',what:'VERIFIED result carrying a rollback cause',request:clone(regionFx.commitRequest),response:(()=>{const r=clone(regionFx.commitResponse);r.result.rollbackCause=clone(readbackMismatch);return r;})()},
 variant('R2','cause in phase restore (a failed restore keeps the RESTORE_FAILED/applyFailure form)',c=>{c.response.result.rollbackCause={error:err('RESTORE_FAILED','restore','PARTIAL','RESTORE_ERROR'),guardRefusal:null};}),
 variant('R3','cause with mutationState ROLLED_BACK',c=>{c.response.result.rollbackCause={...clone(readbackMismatch),error:{...readbackMismatch.error,mutationState:'ROLLED_BACK'}};}),
 variant('R4','cause naming another transaction',c=>{c.response.result.rollbackCause={...clone(readbackMismatch),error:{...readbackMismatch.error,transactionRef:'region-tx-other'}};}),
 variant('R5','guard refusal that does not explain the error',c=>{c.response.result.rollbackCause={error:clone(readbackMismatch.error),guardRefusal:refusal};}),
 variant('R6','null rollback cause (no null form)',c=>{c.response.result.rollbackCause=null;}),
 variant('R7','unknown field inside the cause',c=>{c.response.result.rollbackCause.note='engine ABM';}),
 variant('R8','successful rollback with a non-null envelope error and applyFailure (unchanged 1.1 refusal)',c=>{const cause=c.response.result.rollbackCause;delete c.response.result.rollbackCause;c.response.error=err('RESTORE_FAILED','restore','PARTIAL','RESTORE_ERROR');c.response.applyFailure=cause;}),
 variant('R9','response of another request (replay binding)',c=>{c.response.requestId='commit-region-other';}),
 variant('R10','response for another local context',c=>{c.response.result.localContext.connectionIncarnationRef='socket-open-2';}),
 {id:'R11',what:'reading a rollback cause of a VERIFIED result',request:clone(regionFx.commitRequest),response:clone(regionFx.commitResponse)},
].map(c=>({...c,error:capture(()=>a.regionRollbackCauseOf(c.request,c.response))}));
const out={profileVersion:'region-rollback-cause-fixture/v1',contract:a.regionRollbackCause.id,capability:a.regionRollbackCause.capability,
 level:'SOURCE/FIXTURE (hand-built from fixtures/region; no peer, World or durable store ran)',accept,reject};
await writeFile('spec/local-world/fixtures/region-rollback-cause.json',JSON.stringify(out,null,2)+'\n');
console.log('region-rollback-cause fixture',accept.length,'accept',reject.length,'reject');

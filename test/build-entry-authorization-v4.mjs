import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as C from 'hanaworlds-contracts/v4';
assert.equal(typeof C.deriveCurrentBuildAuthorization, 'function',
  'default non-frame Build has no public current-build-action authority derivation');
const fixture=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/v4/fixtures/current-build-authorization'))));
const clone=x=>JSON.parse(JSON.stringify(x));
const {facts,context,expected}=fixture;
let cases=0;const failures=[];
function ok(name,fn){try{fn();cases++;console.log('PASS FIXTURE '+name);}catch(error){failures.push(name+': '+error.message);console.error('FAIL FIXTURE '+name, error.actual?.publicError ?? error.message);}}
function reject(name,fn,code){ok(name,()=>assert.throws(fn,e=>e.publicError?.code===code && e.publicError.mutationState==='NONE',name));}
const derive=(f=facts,c=context)=>C.deriveCurrentBuildAuthorization(f,c);
const candidate=derive();
const request={...facts.apply,authorizationBinding:candidate.authorizationBinding,authorizationBindingDigest:candidate.authorizationBindingDigest};
const use=(r=request,i=candidate,f=facts,c=context)=>C.validateCurrentBuildAuthorizedApply(r,i,f,c);
ok('exact current package capability',()=>assert.equal(C.checkCurrentBuildAuthorizationHandshake(C.contractHandshake).result,'HANDSHAKE_OPERATION_MATCH'));
for(const version of ['0.3.8','0.4.0']) reject('noncurrent package '+version,()=>C.checkCurrentBuildAuthorizationHandshake({...C.contractHandshake,contracts:'hanaworlds-contracts@'+version}),'UNSUPPORTED_VERSION');
for(const wire of ['session/v2','canvas/v4','session-authorization/v1']) reject('missing wire '+wire,()=>C.checkCurrentBuildAuthorizationHandshake({...C.contractHandshake,wireVersions:C.contractHandshake.wireVersions.filter(w=>w!==wire)}),'UNSUPPORTED_VERSION');
ok('typed facts candidate and actual complete Canvas child',()=>{
 assert.deepEqual(clone(C.validateCurrentBuildAuthorizationFacts(facts)),facts);
 assert.deepEqual(clone(candidate),expected.candidate);assert.deepEqual(clone(use()),clone(request));
 assert.ok(Object.isFrozen(candidate.action.facts.apply.operations.effects));
 assert.equal(candidate.authorizationBinding.authorizerRef,'game-verifier-1');
 assert.notEqual(candidate.authorizationBinding.authorizerRef,context.originalBinding.hostIssuerRef);
});
ok('domain-separated golden preimage and independent SHA256',()=>{
 const d=C.digestValue('current-build-action',candidate.action);
 assert.equal(d.canonicalUtf8,expected.canonicalUtf8);assert.equal(d.preimageUtf8,expected.preimageUtf8);
 assert.equal(d.sha256,expected.sha256);assert.equal(createHash('sha256').update(expected.preimageUtf8).digest('hex'),expected.sha256);
 assert.equal(candidate.authorizationBinding.surfaceActionDigest,d.sha256);
 assert.equal(C.digestValue('authorization-binding',candidate.authorizationBinding).sha256,candidate.authorizationBindingDigest);
});
reject('non-frame facts cannot masquerade as ActionProjection',()=>C.digestValue('surface-action',candidate.action),'UNKNOWN_REQUIRED_FIELD');
for(const [type,input] of [['CurrentBuildAuthorizationFacts',facts],['CurrentBuildAuthorityContext',context],['CurrentBuildActionProjection',candidate.action],['CurrentBuildAuthorization',candidate],['CurrentBuildApplyPayload',facts.apply]]) {
 for(const key of Object.keys(input)) {
  const missing=clone(input);delete missing[key];reject(type+' missing '+key,()=>C.validateType(type,missing),'SCHEMA_INVALID');
 }
 reject(type+' unknown field',()=>C.validateType(type,{...input,forgedAuthority:true}),'UNKNOWN_REQUIRED_FIELD');
}
for(const path of ['parentRequest','intent','analysis','apply','apply.operations','apply.regionInspectionBinding']) {
 const f=clone(facts);path.split('.').reduce((x,k)=>x[k],f).extra=true;
 reject('nested unknown '+path,()=>derive(f),'UNKNOWN_REQUIRED_FIELD');
}
reject('strict raw duplicate key',()=>C.admitType('CurrentBuildAuthorizationFacts',new TextEncoder().encode('{"turnRef":"a","turnRef":"b"}')),'NON_CANONICAL_AMBIGUITY');
for(const key of ['actorRef','sessionRef','authorizationRef','worldRef','requestId']) {
 const f=clone(facts);f.parentRequest[key]='other';reject('parent identity '+key,()=>derive(f),'PERMISSION_DENIED');
 const c=clone(context);c.capturedParent[key]='other';reject('captured parent '+key,()=>derive(facts,c),'PERMISSION_DENIED');
}
for(const key of ['actorRef','sessionRef','authorizationRef','worldRef','requestId']) {
 const f=clone(facts);f.apply[key]='other';reject('child identity '+key,()=>derive(f),'PERMISSION_DENIED');
}
for(const key of ['transactionId','expectedWorldRevision']) {
 const c=clone(context);c.capturedApply[key]='other';reject('captured exact child '+key,()=>derive(facts,c),'PERMISSION_DENIED');
}
for(const key of ['workshopServiceRef','expectedWorkshopServiceRef','canvasServiceRef','expectedCanvasServiceRef','liveSessionIncarnationRef']) {
 const c=clone(context);c[key]='other';reject('live identity '+key,()=>derive(facts,c),'PERMISSION_DENIED');
}
for(const key of Object.keys(context.originalBinding)) {
 const c=clone(context);c.currentBinding[key]=key==='allowedActions'?['READ']:'other';
 reject('current original grant differs '+key,()=>derive(facts,c),'PERMISSION_DENIED');
}
for(const key of ['actorRef','bindingRef','worldRef','grantEpoch','allowedActions']) {
 const c=clone(context);c.verifiedBinding[key]=key==='allowedActions'?['READ']:'other';
 reject('engine binding differs '+key,()=>derive(facts,c),'PERMISSION_DENIED');
}
for(const status of ['REVOKED','EXPIRED','UNKNOWN']) {
 const c={...context,grantStatus:status};reject('grant '+status,()=>derive(facts,c),status==='UNKNOWN'?'CAPABILITY_UNAVAILABLE':'AUTHORIZATION_REVOKED');
}
for(const status of ['ENDED','CANCELLED','SESSION_REPLACED']) reject('invocation '+status,()=>derive(facts,{...context,invocationStatus:status}),'PERMISSION_DENIED');
const noApply=clone(context);noApply.originalBinding.allowedActions=['READ'];noApply.currentBinding.allowedActions=['READ'];noApply.verifiedBinding.allowedActions=['READ'];
reject('READ cannot authorize Apply',()=>derive(facts,noApply),'PERMISSION_DENIED');
for(const [status,code] of [['UNCONFIRMED','INTENT_UNCONFIRMED'],['SUPERSEDED','TURN_REVISION_MISMATCH']]) reject('turn '+status,()=>derive(facts,{...context,turnStatus:status}),code);
for(const key of ['currentTurnRef','currentTurnRevision','currentConfirmationInputId']) reject('current turn mismatch '+key,()=>derive(facts,{...context,[key]:'other'}),'TURN_REVISION_MISMATCH');
for(const key of ['currentIntentDigest','currentOperationDigest','currentAnalysisDigest']) reject('current digest mismatch '+key,()=>derive(facts,{...context,[key]:'f'.repeat(64)}),'STALE_REVISION');
for(const stage of ['PLACEMENT','PLAN','COMPILE','ANALYZE','COMPLETE']) reject('wrong stage '+stage,()=>derive(facts,{...context,currentStage:stage}),'TRANSACTION_CONFLICT');
let f=clone(facts);f.intent.confirmedIntent.confirmedTurnRevision='old';reject('confirmed intent revision differs',()=>derive(f),'TURN_REVISION_MISMATCH');
f=clone(facts);f.apply.operations.effects[0].param2=1;reject('operations changed without digest',()=>derive(f),'NON_CANONICAL_AMBIGUITY');
f=clone(facts);f.analysis.selectionRevision='old';reject('analysis changed without digest',()=>derive(f),'NON_CANONICAL_AMBIGUITY');
f=clone(facts);f.apply.expectedWorldRevision='old';reject('child world revision mismatch',()=>derive(f),'STALE_REVISION');
f=clone(facts);f.analysis.affectedObjectRefs=['other-object'];f.apply.analysisDigest=C.digestValue('affected-analysis',f.analysis).sha256;reject('affected objects need existing Canvas choice path',()=>derive(f),'OTHER_OBJECTS_AFFECTED');
f=clone(facts);f.apply.expectedObjectRevisions={'object':'rev'};reject('object revision expansion',()=>derive(f),'OTHER_OBJECTS_AFFECTED');
f=clone(facts);f.apply.decisionRevision='decision';reject('default path cannot assert conflict decision',()=>derive(f),'SCHEMA_INVALID');
f=clone(facts);f.apply.guarantee='BEST_EFFORT';reject('cannot lower guarantee',()=>derive(f),'SCHEMA_INVALID');
f=clone(facts);f.apply.regionInspectionBinding.build.documentId='changed';let c=clone(context);c.capturedApply=clone(f.apply);reject('existing region build coherence stays required',()=>derive(f,c),'PERMISSION_DENIED');
const retry={...context,replay:'EXACT_REPLAY',priorAuthorization:candidate};
ok('exact durable replay uses same action auth and child',()=>{assert.deepEqual(clone(derive(facts,retry)),clone(candidate));assert.deepEqual(clone(use(request,candidate,facts,retry)),clone(request));});
reject('replay conflict',()=>derive(facts,{...context,replay:'CONFLICT'}),'REPLAY_MISMATCH');
reject('replay without original issuance',()=>derive(facts,{...context,replay:'EXACT_REPLAY'}),'REPLAY_MISMATCH');
reject('new issuance cannot overwrite prior',()=>derive(facts,{...context,priorAuthorization:candidate}),'REPLAY_MISMATCH');
f=clone(facts);f.apply.transactionId='replacement-tx';c=clone(retry);c.capturedApply=clone(f.apply);reject('retry cannot mint new transaction',()=>derive(f,c),'REPLAY_MISMATCH');
c=clone(retry);c.verifiedBinding.authorizerRef='other-authorizer';reject('retry cannot change engine verifier',()=>derive(facts,c),'REPLAY_MISMATCH');
c=clone(retry);c.workshopServiceRef='new-instance';c.expectedWorkshopServiceRef='new-instance';reject('restart cannot silently reissue prior service action',()=>derive(facts,c),'REPLAY_MISMATCH');
for(const status of ['REVOKED','EXPIRED','UNKNOWN']) reject('retry rechecks grant '+status,()=>use(request,candidate,facts,{...retry,grantStatus:status}),status==='UNKNOWN'?'CAPABILITY_UNAVAILABLE':'AUTHORIZATION_REVOKED');
for(const key of ['requestId','transactionId','authorizationRef','expectedWorldRevision']) {
 const r=clone(request);r[key]='other';reject('dispatch exact payload '+key,()=>use(r),key==='transactionId'?'CONNECTION_UNAUTHORIZED':'PERMISSION_DENIED');
}
let r=clone(request);r.regionInspectionBinding.inspectionId='other';reject('dispatch exact inspection identity',()=>use(r),'PERMISSION_DENIED');
r=clone(request);r.regionInspectionBinding=null;reject('dispatch cannot drop issued region binding',()=>use(r),'PERMISSION_DENIED');
for(const key of Object.keys(candidate.authorizationBinding).filter(k=>k!=='contractVersion')) {
 const issued=clone(candidate);issued.authorizationBinding[key]=key==='allowedAction'?'READ':key.endsWith('Digest')?'f'.repeat(64):'other';
 issued.authorizationBindingDigest=C.digestValue('authorization-binding',issued.authorizationBinding).sha256;
 const r={...request,authorizationBinding:issued.authorizationBinding,authorizationBindingDigest:issued.authorizationBindingDigest};
 reject('dispatch rejects modified issued '+key,()=>use(r,issued),['actorRef','sessionRef','worldRef','transactionId','operationDigest'].includes(key)?'CONNECTION_UNAUTHORIZED':'PERMISSION_DENIED');
}
reject('late cancellation at dispatch',()=>use(request,candidate,facts,{...context,invocationStatus:'CANCELLED'}),'PERMISSION_DENIED');
reject('late changed confirmation at dispatch',()=>use(request,candidate,facts,{...context,currentConfirmationInputId:'new'}),'TURN_REVISION_MISMATCH');
for(const code of ['REPLAY_MISMATCH','NON_CANONICAL_AMBIGUITY']) ok('honest parent failure '+code,()=>assert.equal(C.sessionV2.response('AdvanceCurrentBuild',{contractVersion:'session/v2',requestId:facts.parentRequest.requestId,result:null,error:{code,phase:'validate',retryability:'NEVER',mutationState:'NONE',transactionRef:null,causeCode:null,reason:'PAYLOAD_CHANGED'}}).error.code,code));
assert.deepEqual(failures,[],failures.join('\n'));
console.log(JSON.stringify({result:'PASS_CURRENT_BUILD_AUTHORIZATION_CONFORMANCE',evidence:'SOURCE/FIXTURE',cases,actualWorldWrites:0,providerAuthentication:'NOT_RUN',realRuntime:'NOT_RUN',realUI:'NOT_RUN',actionDigest:expected.sha256}));

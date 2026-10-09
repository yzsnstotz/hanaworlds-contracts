import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const fixture=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/main'))));
const {request:r,response:resp,facts}=fixture,ctx=r.localContext,D=(k,v)=>a.digestValue(k,v).sha256,clone=structuredClone;
let passed=0;function test(name,fn){fn();console.log('ok',++passed,name)}
const bound=(w,n,x)=>a.validateBoundRequest(w,n,x);
const envelope=(wire,requestId,fields)=>({contractVersion:wire,sessionRef:r.sessionRef,requestId,worldRef:r.worldRef,localContext:ctx,...fields});
const stateProfile={profileVersion:'state-profile/v2',nodeFields:['nodeName','param1','param2'],metadataMode:'exact',inventoryMode:'exact',timerMode:'exact',derivedLightMode:'recompute-with-readback'};
test('current package and same-major handshake',()=>{a.checkContractsVersion(a.contractHandshake.contracts);assert.equal(a.contractHandshake.contracts,'hanaworlds-contracts@'+a.version);a.checkContractHandshake(a.contractHandshake);a.checkContractHandshake({...a.contractHandshake,contracts:'hanaworlds-contracts@'+a.contractsCompatibility.major+'.99.0'});assert.throws(()=>a.checkContractHandshake({...a.contractHandshake,contracts:'hanaworlds-contracts@'+(a.contractsCompatibility.major+1)+'.0.0'}),{code:'UNSUPPORTED_VERSION'});});
test('all current request/schema fields have no MVP authority or protection dependency',()=>{assert.doesNotMatch(JSON.stringify(a.schemaBundle),/authorization|grantEpoch|allowedActions|requireProtected|protectedPositions|AuthProjection|OriginalSessionBinding|regionProtectionWriters/);assert.equal(a.ownership['world-adapter/v7'].mutationCaller,'Canvas only through internal dispatch');assert.equal(a.ownership['painter/v5'].mutationCaller,'none');});
const capabilities={providerRef:'adapter',capabilityRevision:'cap-1',worldRef:r.worldRef,engineBounds:r.targetFacts.sampledBounds,limits:[],recoveryGuarantee:'RECOVERABLE_VERIFIED',stateProfile,sessionDeleteSupported:true,imageMediaTypes:[],model:null,
 engineGuards:{profileVersion:'engine-guards/v1',coverage:[{guard:'BODY_CLEARANCE',stages:['INSPECT_REGION','PREPARE_RECOVERABLE','APPLY_COMPILED','RESTORE'],protectionPrincipal:null},{guard:'CELL_PROTECTION',stages:['PREPARE_RECOVERABLE','APPLY_COMPILED'],protectionPrincipal:'ANONYMOUS'},{guard:'PLAYER_ENCLOSURE',stages:['APPLY_COMPILED'],protectionPrincipal:null}]}};
const connection={connectionRef:ctx.connectionRef,connectionIncarnationRef:ctx.connectionIncarnationRef,worldRef:r.worldRef,payloadVersion:'local-world/v1',payloadDigest:'1'.repeat(64),capabilities};
test('Desktop discovers and reads the actual local connection before Canvas selection',()=>{
 bound('world-adapter/v7','DiscoverConnections',{contractVersion:'world-adapter/v7',sessionRef:r.sessionRef,requestId:'discover',adapterId:'adapter'});
 const read={contractVersion:'world-adapter/v7',sessionRef:r.sessionRef,requestId:'connection-read',connectionRef:ctx.connectionRef};
 a.validateBoundResponse('world-adapter/v7','ReadLocalConnection',read,{contractVersion:'world-adapter/v7',requestId:read.requestId,result:connection,error:null});
 const select={contractVersion:'canvas/v6',sessionRef:r.sessionRef,requestId:'select',worldRef:r.worldRef,connectionRef:ctx.connectionRef,connectionIncarnationRef:ctx.connectionIncarnationRef,expectedRevision:'selection-0',expectedContext:null};
 a.validateWorldSelection(select,{...facts.requestFacts,currentContext:null,currentTurnRevision:null,currentBriefDigest:null},connection);
 a.validateResponse('canvas/v6','SelectWorldConnection',{contractVersion:'canvas/v6',requestId:'select',result:{currentSession:r.sessionRef,activeWorldRef:r.worldRef,orderedSelectedObjectRefs:[],sessionRevision:'session-1',selectionRevision:'selection-1',localContext:ctx},error:null});
});
test('Workshop and Painter consume the no-authority proposal and exact BUILD',()=>{a.validateBuildProposalContext(r,facts);a.validateBuildProposalResponse(r,resp);});
const b=resp.result.build,positions=r.targetFacts.knownEmptyCells.filter(p=>b.operations.some(o=>p.every((v,i)=>v>=o.min[i]&&v<=o.max[i]))).sort(a.comparePosition);
const effects=positions.map(position=>({position,...b.materials[b.operations.findLast(o=>position.every((v,i)=>v>=o.min[i]&&v<=o.max[i])).materialRef]}));
const config={profileVersion:'compilation-config/v2',backendProfileId:'static-local',worldeditRevision:'static-1',nodeWriteSemantics:'explicit-nodeName-param2-static-v2',overlapRule:'last-writer-wins',effectOrder:'numeric-x-y-z',compressionRule:'exact-final-effects-only'};
const operations={contractVersion:'operations/v3',buildDigest:resp.result.buildDigest,compilerRevision:'brush-1',compilationConfigDigest:D('compilation-config',config),worldRef:r.worldRef,frameDigest:r.targetFacts.frameDigest,catalogueDigest:b.catalogueDigest,targetFactsDigest:r.targetFactsDigest,effects};
const operationDigest=D('operations',operations);
test('Brush validates public BUILD and exact compilation effects',()=>{
 const req=envelope('BUILD/V4','compile',{build:b,buildDigest:resp.result.buildDigest,catalogue:r.catalogue,catalogueDigest:b.catalogueDigest,targetFacts:r.targetFacts,targetFactsDigest:r.targetFactsDigest,safetyProfile:r.safetyProfile,safetyProfileDigest:r.safetyProfileDigest,compilationConfig:config,compilationConfigDigest:D('compilation-config',config),compilerRevision:'brush-1'});
 bound('BUILD/V4','BuildDocument',req);a.validateExactEffects(b.operations,b.materials,effects);
 a.validateBoundResponse('BUILD/V4','BuildDocument',req,{contractVersion:'BUILD/V4',requestId:req.requestId,result:{projection:operations,operationDigest,readBounds:r.targetFacts.sampledBounds,writeBounds:b.declaredBounds},error:null});
});
const analysis={contractVersion:'canvas/v6',worldRef:r.worldRef,worldRevision:r.targetFacts.worldRevision,registryRevision:'registry-1',selectionRevision:'selection-1',operationDigest,orderedSelectedRefs:[],affectedObjectRefs:[]};
const apply=envelope('canvas/v6','apply',{transactionId:'transaction-1',operations,operationDigest,analysisDigest:D('affected-analysis',analysis),decisionRevision:null,expectedWorldRevision:r.targetFacts.worldRevision,expectedObjectRevisions:{},guarantee:'RECOVERABLE_VERIFIED',regionInspectionBinding:{inspectionId:r.regionInspection.inspectionId,build:b}});
const advance=envelope('session/v4','advance',{expectedTurnRevision:r.turnRevision});
const submission={parentRequest:advance,turnRef:'turn-1',confirmationInputId:'confirmation-1',intent:r.intent,analysis,apply};
test('Workshop advances only current turn through Canvas analysis and apply',()=>{a.validateCurrentBuildSubmission(submission,facts.requestFacts);});
const scope={transactionId:apply.transactionId,worldRef:r.worldRef,operationDigest,stateProfile,checkedPositions:positions,objects:[],cells:positions.map(position=>({position,availability:'KNOWN',stateDigest:'2'.repeat(64)})),localContext:ctx};
const scopeDigest=D('scoped-world',scope),beforeImageDigest='3'.repeat(64);
const payload={contractVersion:'world-adapter/v7',transactionId:apply.transactionId,worldRef:r.worldRef,operationDigest,scopeDigest,beforeImageDigest,localContext:ctx};
const prepared={payload,transactionPayloadDigest:D('scoped-transaction-payload',payload),beforeImageDigest,scopeDigest,guarantee:'RECOVERABLE_VERIFIED',stateProfile,adapterExecutionRevision:'exec-1',beforeStateReadbackDigest:'4'.repeat(64)};
test('Canvas prepares and applies one exact scoped transaction via Adapter',()=>{
 const req=envelope('world-adapter/v7','prepare',{transactionId:apply.transactionId,operationDigest,operations,scope,scopeDigest,guarantee:'RECOVERABLE_VERIFIED'});
 bound('world-adapter/v7','PrepareRecoverableTransaction',req);
 a.validateBoundResponse('world-adapter/v7','PrepareRecoverableTransaction',req,{contractVersion:'world-adapter/v7',requestId:req.requestId,result:prepared,error:null,guardRefusal:null});
 bound('world-adapter/v7','ApplyCompiledTransaction',{...req,requestId:'transport-apply',preparedTransaction:a.projectScopedPreparedTransaction(prepared)});
});
const records=effects.map(e=>({...e,param1:0,metadata:{},inventory:{},timer:null}));
const readback={worldRef:r.worldRef,coveredPositions:positions,records,stateProfile};
const receipt={contractVersion:'canvas/v6',transactionId:apply.transactionId,operationDigest,transactionPayloadDigest:prepared.transactionPayloadDigest,status:'VERIFIED',previousWorldRevision:r.targetFacts.worldRevision,observedWorldRevision:'world-2',readbackDigest:D('readback',readback),restoreStatus:'NOT_REQUIRED',error:null,localContext:ctx,guardRefusal:null,applyFailure:null};
const history={transactionId:apply.transactionId,originTransactionId:null,affectedObjectRefs:['object-1'],operationDigest,beforeImageDigest,expectedAfterReadbackDigest:receipt.readbackDigest,receiptDigest:D('receipt',receipt),historyRevision:'history-1',status:'VERIFIED'};
test('Canvas verifies matching complete readback with same durable history row',()=>{a.validateCommitReadback(receipt,readback,readback,history);});
test('completed duplicate returns stored outcome without a second write instruction',()=>{const admission=a.validateCurrentRequest('canvas/v6','ApplyRecoverableCommit',apply,facts.requestFacts);assert.equal(admission.disposition,'EXECUTE');const duplicate=a.validateCurrentRequest('canvas/v6','ApplyRecoverableCommit',apply,{...facts.requestFacts,requestState:'COMPLETED',replay:'EXACT_REPLAY',priorRequestDigest:admission.requestDigest});assert.equal(duplicate.disposition,'RETURN_STORED');});
const before={...readback,records:records.map(x=>({...x,nodeName:'air',param2:0}))};
test('failed apply expresses whole-before-image rollback with verified readback',()=>{const rollback={...receipt,status:'ROLLED_BACK',restoreStatus:'VERIFIED_RESTORED',readbackDigest:D('readback',before)};a.validateCommitReadback(rollback,before,before,null);});
test('history Undo carries the original transaction and before-state target',()=>{
 const req=envelope('world-adapter/v7','undo-prepare',{originTransactionId:apply.transactionId,transactionId:'undo-1',direction:'UNDO',affectedObjectRefs:['object-1'],originVerifiedReceiptDigest:history.receiptDigest,originBeforeImageDigest:history.beforeImageDigest,originBeforeStateReadbackDigest:D('readback',before),originAfterReadbackDigest:receipt.readbackDigest,expectedHistoryRevision:'history-1',expectedWorldRevision:'world-2',expectedObjectRevisions:{'object-1':'object-revision-1'},expectedCurrentStateDigest:receipt.readbackDigest,targetStateDigest:D('readback',before),guarantee:'RECOVERABLE_VERIFIED'});
 const keys=Object.keys(a.schemaBundle.definitions.HistoryOperationProjection.properties);req.historyOperationDigest=D('history-operation',Object.fromEntries(keys.map(k=>[k,req[k]])));
 bound('world-adapter/v7','PrepareHistoryTransaction',req);
 bound('session/v4','UndoCurrentBuild',envelope('session/v4','undo',{expectedTurnRevision:r.turnRevision,expectedHistoryRevision:'history-1'}));
 a.validateResponse('session/v4','UndoCurrentBuild',{contractVersion:'session/v4',requestId:'undo',result:{sessionRef:r.sessionRef,worldRef:r.worldRef,turnRef:'turn-1',turnRevision:r.turnRevision,status:'VERIFIED',beforeHead:{historyRevision:'history-1',headTransactionId:apply.transactionId},afterHead:{historyRevision:'history-2',headTransactionId:null}},error:null});
});
test('wrong current world or reopened connection rejects old work',()=>{assert.throws(()=>a.validateCurrentRequest('canvas/v6','ApplyRecoverableCommit',apply,{...facts.requestFacts,currentContext:{...ctx,worldRef:'different'}}),{code:'CURRENT_WORLD_MISMATCH'});assert.throws(()=>a.validateCurrentRequest('canvas/v6','ApplyRecoverableCommit',apply,{...facts.requestFacts,currentContext:{...ctx,connectionIncarnationRef:'socket-open-2'}}),{code:'CURRENT_WORLD_MISMATCH'});});
test('Painter geometry and existing Canvas object conflict stay enforced',()=>{const q=clone(r);q.proposal.boxes[0].max[0]=Number.MAX_SAFE_INTEGER;assert.throws(()=>a.validateBuildProposalRequest(q));const s=clone(submission);s.analysis.affectedObjectRefs=['existing-object'];s.apply.analysisDigest=D('affected-analysis',s.analysis);assert.throws(()=>a.validateCurrentBuildSubmission(s,facts.requestFacts),{code:'OTHER_OBJECTS_AFFECTED'});});
test('readback mismatch never becomes verified success',()=>{const bad=clone(readback);bad.records[0].nodeName='air';assert.throws(()=>a.validateCommitReadback(receipt,readback,bad,history),{code:'READBACK_MISMATCH'});});
test('strict unknown authority fields and duplicate raw keys are rejected',()=>{assert.throws(()=>bound('session/v4','AdvanceCurrentBuild',{...advance,authorizationRef:'fake'}),{code:'UNKNOWN_REQUIRED_FIELD'});assert.throws(()=>a.admitRequest('session/v4','AdvanceCurrentBuild','{"requestId":"a","requestId":"b"}'));});

test('existing local acquire and native process facts need no account credentials',()=>{
 const input={connectionRef:ctx.connectionRef,requesterRef:'desktop',userPath:'/local/user',action:'BIND_RUNNING_WORLD'};
 a.validateType('LocalWorldAcquireInput',input);
 a.validateType('NativeControlInput',{requesterRef:'adapter',worldPath:'/local/world',userPath:'/local/user',operationRef:'open-1'});
 a.validateType('NativeControlEvidence',{state:'CURRENT',worldPath:'/local/world',processId:1234,operationRef:'open-1'});
 a.validateType('LocalWorldObservation',{current:true,leaseRef:'process-handle',connectionRef:ctx.connectionRef,worldPath:'/local/world',worldRef:r.worldRef,action:'BIND_RUNNING_WORLD',nativeProcessId:1234});
 assert.throws(()=>a.validateType('LocalWorldAcquireInput',{...input,username:'unused',password:'unused'}),{code:'UNKNOWN_REQUIRED_FIELD'});
});

console.log(JSON.stringify({evidence:'SOURCE/FIXTURE',checks:passed,worldWrites:0,realRuntime:'NOT_RUN',realUI:'NOT_RUN'}));

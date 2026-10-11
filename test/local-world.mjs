import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const fixture=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/main'))));
const {request:r,response:resp,facts}=fixture,ctx=r.localContext,D=(k,v)=>a.digestValue(k,v).sha256,clone=structuredClone;
let passed=0;function test(name,fn){fn();console.log('ok',++passed,name)}
const bound=(w,n,x)=>a.validateBoundRequest(w,n,x);
const envelope=(wire,requestId,fields)=>({contractVersion:wire,sessionRef:r.sessionRef,requestId,worldRef:r.worldRef,localContext:ctx,...fields});
const stateProfile={profileVersion:'state-profile/v3',derivedFields:['param1'],preservedFields:[],clearedFields:['inventory','metadata','timer']};
test('current package and same-major handshake',()=>{a.checkContractsVersion(a.contractHandshake.contracts);assert.equal(a.contractHandshake.contracts,'hanaworlds-contracts@'+a.version);a.checkContractHandshake(a.contractHandshake);a.checkContractHandshake({...a.contractHandshake,contracts:'hanaworlds-contracts@'+a.contractsCompatibility.major+'.99.0'});assert.throws(()=>a.checkContractHandshake({...a.contractHandshake,contracts:'hanaworlds-contracts@'+(a.contractsCompatibility.major+1)+'.0.0'}),{code:'UNSUPPORTED_VERSION'});});
test('all current request/schema fields have no MVP authority or protection dependency',()=>{assert.doesNotMatch(JSON.stringify(a.schemaBundle),/authorization|grantEpoch|allowedActions|requireProtected|protectedPositions|AuthProjection|OriginalSessionBinding|regionProtectionWriters/);assert.equal(a.ownership['world-adapter/v8'].mutationCaller,'Canvas only through internal dispatch');assert.equal(a.ownership['painter/v6'].mutationCaller,'none');});
const capabilities={providerRef:'adapter',capabilityRevision:'cap-1',worldRef:r.worldRef,engineBounds:r.targetFacts.sampledBounds,worldGeometry:{profileVersion:'world-geometry/v1',geometryProfiles:['voxel-grid/v1'],partition:{edge:[16,16,16]},postWriteLighting:'REQUIRED'},limits:[],recoveryGuarantee:'RECOVERABLE_VERIFIED',stateProfile,sessionDeleteSupported:true,imageMediaTypes:[],model:null,
 engineGuards:{profileVersion:'engine-guards/v1',coverage:[{guard:'BODY_CLEARANCE',stages:['INSPECT_REGION','PREPARE_RECOVERABLE','APPLY_COMPILED','RESTORE'],protectionPrincipal:null},{guard:'CELL_PROTECTION',stages:['PREPARE_RECOVERABLE','APPLY_COMPILED'],protectionPrincipal:'ANONYMOUS'},{guard:'PLAYER_ENCLOSURE',stages:['APPLY_COMPILED'],protectionPrincipal:null}]}};
const connection={connectionRef:ctx.connectionRef,connectionIncarnationRef:ctx.connectionIncarnationRef,worldRef:r.worldRef,payloadVersion:'local-world/v1',payloadDigest:'1'.repeat(64),capabilities};
test('Desktop discovers and reads the actual local connection before Canvas selection',()=>{
 bound('world-adapter/v8','DiscoverConnections',{contractVersion:'world-adapter/v8',sessionRef:r.sessionRef,requestId:'discover',adapterId:'adapter'});
 const read={contractVersion:'world-adapter/v8',sessionRef:r.sessionRef,requestId:'connection-read',connectionRef:ctx.connectionRef};
 a.validateBoundResponse('world-adapter/v8','ReadLocalConnection',read,{contractVersion:'world-adapter/v8',requestId:read.requestId,result:connection,error:null});
 const select={contractVersion:'canvas/v7',sessionRef:r.sessionRef,requestId:'select',worldRef:r.worldRef,connectionRef:ctx.connectionRef,connectionIncarnationRef:ctx.connectionIncarnationRef,expectedRevision:'selection-0',expectedContext:null};
 a.validateWorldSelection(select,{...facts.requestFacts,currentContext:null,currentTurnRevision:null,currentBriefDigest:null},connection);
 a.validateResponse('canvas/v7','SelectWorldConnection',{contractVersion:'canvas/v7',requestId:'select',result:{currentSession:r.sessionRef,activeWorldRef:r.worldRef,orderedSelectedObjectRefs:[],sessionRevision:'session-1',selectionRevision:'selection-1',localContext:ctx},error:null});
});
test('Workshop and Painter consume the no-authority proposal and exact BUILD',()=>{a.validateBuildProposalContext(r,facts);a.validateBuildProposalResponse(r,resp);});
const b=resp.result.build,positions=r.targetFacts.knownEmptyCells.filter(p=>b.operations.some(o=>p.every((v,i)=>v>=o.min[i]&&v<=o.max[i]))).sort(a.comparePosition);
const effects=positions.map(position=>({position,geometryProfile:'voxel-grid/v1',...b.materials[b.operations.findLast(o=>position.every((v,i)=>v>=o.min[i]&&v<=o.max[i])).materialRef]}));
const config={profileVersion:'compilation-config/v3',writeBackend:{profileId:'static-local',revision:'static-1'},overlapRule:'last-writer-wins',effectOrder:'numeric-x-y-z',compressionRule:'exact-final-effects-only'};
const operations={contractVersion:'operations/v4',buildDigest:resp.result.buildDigest,compilerRevision:'brush-1',compilationConfigDigest:D('compilation-config',config),worldRef:r.worldRef,frameDigest:r.targetFacts.frameDigest,catalogueDigest:b.catalogueDigest,targetFactsDigest:r.targetFactsDigest,effects};
const operationDigest=D('operations',operations);
test('Brush validates public BUILD and exact compilation effects',()=>{
 const req=envelope('BUILD/V5','compile',{build:b,buildDigest:resp.result.buildDigest,catalogue:r.catalogue,catalogueDigest:b.catalogueDigest,targetFacts:r.targetFacts,targetFactsDigest:r.targetFactsDigest,safetyProfile:r.safetyProfile,safetyProfileDigest:r.safetyProfileDigest,compilationConfig:config,compilationConfigDigest:D('compilation-config',config),compilerRevision:'brush-1'});
 bound('BUILD/V5','BuildDocument',req);a.validateExactEffects(b.operations,b.materials,effects);
 a.validateBoundResponse('BUILD/V5','BuildDocument',req,{contractVersion:'BUILD/V5',requestId:req.requestId,result:{projection:operations,operationDigest,readBounds:r.targetFacts.sampledBounds,writeBounds:b.declaredBounds},error:null});
});
const analysis={contractVersion:'canvas/v7',worldRef:r.worldRef,worldRevision:r.targetFacts.worldRevision,registryRevision:'registry-1',selectionRevision:'selection-1',operationDigest,orderedSelectedRefs:[],affectedObjectRefs:[]};
const apply=envelope('canvas/v7','apply',{transactionId:'transaction-1',operations,operationDigest,analysisDigest:D('affected-analysis',analysis),decisionRevision:null,expectedWorldRevision:r.targetFacts.worldRevision,expectedObjectRevisions:{},guarantee:'RECOVERABLE_VERIFIED',regionInspectionBinding:{inspectionId:r.regionInspection.inspectionId,build:b}});
const advance=envelope('session/v5','advance',{expectedTurnRevision:r.turnRevision});
const submission={parentRequest:advance,turnRef:'turn-1',confirmationInputId:'confirmation-1',intent:r.intent,analysis,apply};
test('Workshop advances only current turn through Canvas analysis and apply',()=>{a.validateCurrentBuildSubmission(submission,facts.requestFacts);});
const scope={transactionId:apply.transactionId,worldRef:r.worldRef,operationDigest,stateProfile,checkedPositions:positions,objects:[],cells:positions.map(position=>({position,availability:'KNOWN',stateDigest:'2'.repeat(64)})),localContext:ctx};
const scopeDigest=D('scoped-world',scope),beforeImageDigest='3'.repeat(64);
const payload={contractVersion:'world-adapter/v8',transactionId:apply.transactionId,worldRef:r.worldRef,operationDigest,scopeDigest,beforeImageDigest,localContext:ctx};
const prepared={payload,transactionPayloadDigest:D('scoped-transaction-payload',payload),beforeImageDigest,scopeDigest,guarantee:'RECOVERABLE_VERIFIED',stateProfile,adapterExecutionRevision:'exec-1',beforeStateReadbackDigest:'4'.repeat(64)};
test('Canvas prepares and applies one exact scoped transaction via Adapter',()=>{
 const req=envelope('world-adapter/v8','prepare',{transactionId:apply.transactionId,operationDigest,operations,scope,scopeDigest,guarantee:'RECOVERABLE_VERIFIED'});
 bound('world-adapter/v8','PrepareRecoverableTransaction',req);
 a.validateBoundResponse('world-adapter/v8','PrepareRecoverableTransaction',req,{contractVersion:'world-adapter/v8',requestId:req.requestId,result:prepared,error:null,guardRefusal:null});
 bound('world-adapter/v8','ApplyCompiledTransaction',{...req,requestId:'transport-apply',preparedTransaction:a.projectScopedPreparedTransaction(prepared)});
});
const records=effects.map(e=>({...e,state:{param1:0,metadata:{},inventory:{},timer:null}}));
const readback={worldRef:r.worldRef,coveredPositions:positions,records,stateProfile};
const receipt={contractVersion:'canvas/v7',transactionId:apply.transactionId,operationDigest,transactionPayloadDigest:prepared.transactionPayloadDigest,status:'VERIFIED',previousWorldRevision:r.targetFacts.worldRevision,observedWorldRevision:'world-2',readbackDigest:D('readback',readback),restoreStatus:'NOT_REQUIRED',error:null,localContext:ctx,guardRefusal:null,applyFailure:null};
const history={transactionId:apply.transactionId,originTransactionId:null,affectedObjectRefs:['object-1'],operationDigest,beforeImageDigest,expectedAfterReadbackDigest:receipt.readbackDigest,receiptDigest:D('receipt',receipt),historyRevision:'history-1',status:'VERIFIED'};
test('Canvas verifies matching complete readback with same durable history row',()=>{a.validateCommitReadback(receipt,readback,readback,history);});
test('completed duplicate returns stored outcome without a second write instruction',()=>{const admission=a.validateCurrentRequest('canvas/v7','ApplyRecoverableCommit',apply,facts.requestFacts);assert.equal(admission.disposition,'EXECUTE');const duplicate=a.validateCurrentRequest('canvas/v7','ApplyRecoverableCommit',apply,{...facts.requestFacts,requestState:'COMPLETED',replay:'EXACT_REPLAY',priorRequestDigest:admission.requestDigest});assert.equal(duplicate.disposition,'RETURN_STORED');});
const before={...readback,records:records.map(x=>({...x,materialRef:r.catalogue.emptyMaterialRef,orientation:0}))};
test('failed apply expresses whole-before-image rollback with verified readback',()=>{const rollback={...receipt,status:'ROLLED_BACK',restoreStatus:'VERIFIED_RESTORED',readbackDigest:D('readback',before)};a.validateCommitReadback(rollback,before,before,null);});
test('history Undo carries the original transaction and before-state target',()=>{
 const req=envelope('world-adapter/v8','undo-prepare',{originTransactionId:apply.transactionId,transactionId:'undo-1',direction:'UNDO',affectedObjectRefs:['object-1'],originVerifiedReceiptDigest:history.receiptDigest,originBeforeImageDigest:history.beforeImageDigest,originBeforeStateReadbackDigest:D('readback',before),originAfterReadbackDigest:receipt.readbackDigest,expectedHistoryRevision:'history-1',expectedWorldRevision:'world-2',expectedObjectRevisions:{'object-1':'object-revision-1'},expectedCurrentStateDigest:receipt.readbackDigest,targetStateDigest:D('readback',before),guarantee:'RECOVERABLE_VERIFIED'});
 const keys=Object.keys(a.schemaBundle.definitions.HistoryOperationProjection.properties);req.historyOperationDigest=D('history-operation',Object.fromEntries(keys.map(k=>[k,req[k]])));
 bound('world-adapter/v8','PrepareHistoryTransaction',req);
 bound('session/v5','UndoCurrentBuild',envelope('session/v5','undo',{expectedTurnRevision:r.turnRevision,expectedHistoryRevision:'history-1'}));
 a.validateResponse('session/v5','UndoCurrentBuild',{contractVersion:'session/v5',requestId:'undo',result:{sessionRef:r.sessionRef,worldRef:r.worldRef,turnRef:'turn-1',turnRevision:r.turnRevision,status:'VERIFIED',beforeHead:{historyRevision:'history-1',headTransactionId:apply.transactionId},afterHead:{historyRevision:'history-2',headTransactionId:null}},error:null,guardRefusal:null});
});
test('wrong current world or reopened connection rejects old work',()=>{assert.throws(()=>a.validateCurrentRequest('canvas/v7','ApplyRecoverableCommit',apply,{...facts.requestFacts,currentContext:{...ctx,worldRef:'different'}}),{code:'CURRENT_WORLD_MISMATCH'});assert.throws(()=>a.validateCurrentRequest('canvas/v7','ApplyRecoverableCommit',apply,{...facts.requestFacts,currentContext:{...ctx,connectionIncarnationRef:'socket-open-2'}}),{code:'CURRENT_WORLD_MISMATCH'});});
test('Painter geometry and existing Canvas object conflict stay enforced',()=>{const q=clone(r);q.proposal.boxes[0].max[0]=Number.MAX_SAFE_INTEGER;assert.throws(()=>a.validateBuildProposalRequest(q));const s=clone(submission);s.analysis.affectedObjectRefs=['existing-object'];s.apply.analysisDigest=D('affected-analysis',s.analysis);assert.throws(()=>a.validateCurrentBuildSubmission(s,facts.requestFacts),{code:'OTHER_OBJECTS_AFFECTED'});});
test('readback mismatch never becomes verified success',()=>{const bad=clone(readback);bad.records[0].materialRef=r.catalogue.emptyMaterialRef;assert.throws(()=>a.validateCommitReadback(receipt,readback,bad,history),{code:'READBACK_MISMATCH'});});
test('strict unknown authority fields and duplicate raw keys are rejected',()=>{assert.throws(()=>bound('session/v5','AdvanceCurrentBuild',{...advance,authorizationRef:'fake'}),{code:'UNKNOWN_REQUIRED_FIELD'});assert.throws(()=>a.admitRequest('session/v5','AdvanceCurrentBuild','{"requestId":"a","requestId":"b"}'));});

test('existing local acquire and native process facts need no account credentials',()=>{
 const input={connectionRef:ctx.connectionRef,requesterRef:'desktop',userPath:'/local/user',action:'BIND_RUNNING_WORLD'};
 a.validateType('LocalWorldAcquireInput',input);
 a.validateType('NativeControlInput',{requesterRef:'adapter',worldPath:'/local/world',userPath:'/local/user',operationRef:'open-1'});
 a.validateType('NativeControlEvidence',{state:'CURRENT',worldPath:'/local/world',processId:1234,operationRef:'open-1'});
 a.validateType('LocalWorldObservation',{current:true,leaseRef:'process-handle',connectionRef:ctx.connectionRef,worldPath:'/local/world',worldRef:r.worldRef,action:'BIND_RUNNING_WORLD',nativeProcessId:1234});
 assert.throws(()=>a.validateType('LocalWorldAcquireInput',{...input,username:'unused',password:'unused'}),{code:'UNKNOWN_REQUIRED_FIELD'});
});

test('material, state and write backend are world-source vocabulary, never engine literals',()=>{
 const cat=r.catalogue,defs=JSON.stringify(a.schemaBundle.definitions);
 assert.doesNotMatch(defs,/nodeName|param[12]|worldedit|nodeWriteSemantics|derivedLightMode|LOADED_BY_EMERGE|picture-blocks|adapter-luanti/i);
 assert.ok(a.regionCapabilities.every(c=>!/adapter-luanti/.test(c.owner)));
 assert.throws(()=>a.validateType('Catalogue',{...cat,emptyMaterialRef:'not-declared'}),{code:'SCHEMA_INVALID'});
 assert.throws(()=>a.validateType('StateProfile',{...stateProfile,preservedFields:['param1']}),{code:'SCHEMA_INVALID'});
 const occupied=clone(r.targetFacts);occupied.occupiedCells[0].materialRef=cat.emptyMaterialRef;
 assert.throws(()=>a.requireOccupiedNotEmpty(occupied,cat),{code:'SCHEMA_INVALID'});
 // The state map is opaque: any strict JSON the world source reports is carried and digested unchanged.
 const record={position:[0,1,3],geometryProfile:'voxel-grid/v1',materialRef:'fixture:stone',orientation:0,state:{param1:0,opaque:{nested:[1,'x',null,true]}}};
 assert.equal(a.canonicalJSON(a.validateType('Record',record)),a.canonicalJSON(record));
 assert.throws(()=>a.validateType('Record',{...record,param2:0}),{code:'UNKNOWN_REQUIRED_FIELD'});
 assert.throws(()=>a.validateType('MaterialSpec',{materialRef:'fixture:stone',orientation:-1}),{code:'SCHEMA_INVALID'});
 assert.deepEqual({...a.requireKnownWriteBackend({profileVersion:'config-engine-facts/v2',connection:{worldRef:r.worldRef,connectionRef:ctx.connectionRef,connectionIncarnationRef:ctx.connectionIncarnationRef},catalogueDigest:'0'.repeat(64),avatarEnvelope:{availability:'UNAVAILABLE',reason:'NO_PUBLIC_SOURCE'},writeBackend:{availability:'KNOWN',basis:'LOADED_PAYLOAD_DECLARATION',writeBackend:config.writeBackend},sourceRevision:'0'.repeat(64)})},config.writeBackend);
});

test('geometry profile, partition and lighting are world-source declarations (2.0.0)',()=>{
 const G='voxel-grid/v1',defs=a.schemaBundle.definitions;
 // Every effect, record and footprint carries the discriminator; this major defines one value.
 assert.deepEqual(defs.GeometryProfile.enum,[G]);
 for(const t of ['Effect','Record','ScopedObjectFootprint','TargetFacts','RegionVoxelBlock','BuildProjection'])assert.ok(defs[t].required.includes('geometryProfile'),t);
 assert.throws(()=>a.validateType('Effect',{...effects[0],geometryProfile:'props/v1'}),{code:'SCHEMA_INVALID'});
 const {geometryProfile,...bare}=effects[0];assert.throws(()=>a.validateType('Effect',bare),{code:'SCHEMA_INVALID'});
 // A world source may declare profiles this major does not define; a payload profile it does not declare is a gap.
 const wg=capabilities.worldGeometry;assert.equal(a.requireGeometryProfile(wg,G).postWriteLighting,'REQUIRED');
 const props={...wg,geometryProfiles:['props/v1'],partition:null};a.validateType('WorldGeometry',props);
 for(const w of [props,null])assert.throws(()=>a.requireGeometryProfile(w,G),e=>e.code==='CAPABILITY_GAP'&&e.reason==='GEOMETRY_PROFILE_UNSUPPORTED');
 // partition is present exactly when voxel-grid/v1 is declared.
 assert.throws(()=>a.validateType('WorldGeometry',{...wg,partition:null}),{code:'SCHEMA_INVALID'});
 assert.throws(()=>a.validateType('WorldGeometry',{...props,partition:wg.partition}),{code:'SCHEMA_INVALID'});
 // Chunking follows the declared edge per axis; no 16 is built in.
 assert.equal(a.mapblockOf,undefined);assert.equal(a.CHUNK_EDGE,undefined);
 assert.deepEqual([...a.chunkOf([-1,17,40],{edge:[16,16,16]})],[-1,1,2]);
 assert.deepEqual([...a.chunkOf([-1,17,40],{edge:[32,8,1]})],[-1,2,40]);
 assert.deepEqual(a.regionChunksOfBox({min:[0,0,0],max:[9,0,0]},{edge:[4,1,1]}).map(c=>[c.chunkPos,c.box]),
  [[[0,0,0],{min:[0,0,0],max:[3,0,0]}],[[1,0,0],{min:[4,0,0],max:[7,0,0]}],[[2,0,0],{min:[8,0,0],max:[9,0,0]}]]);
 assert.throws(()=>a.chunkOf([0,0,0],{edge:[0,16,16]}),{code:'SCHEMA_INVALID'});
 // The light rule is normalised (0..1), not an engine light scale.
 a.validateType('LightRule',{minimumLight:0.5,sourceRevision:'r'});
 assert.throws(()=>a.validateType('LightRule',{minimumLight:14,sourceRevision:'r'}),{code:'SCHEMA_INVALID'});
 // No engine node names, chunk edge or light scale constants in the schema or the shipped runtime source.
 assert.doesNotMatch(JSON.stringify(defs),/chunkEdge|mapblock|"const":16\b/);
 assert.ok(defs.ErrorCode.enum.includes('CAPABILITY_GAP'));
 const dir=new URL('./',import.meta.resolve('hanaworlds-contracts'));
 for(const f of readdirSync(dir).filter(f=>/\.(mjs|ts)$/.test(f)))
  assert.doesNotMatch(readFileSync(new URL(f,dir),'utf8'),/CHUNK_EDGE|mapblock|luanti|voxelmanip|'air'|'ignore'/i,f);
});
console.log(JSON.stringify({evidence:'SOURCE/FIXTURE',checks:passed,worldWrites:0,realRuntime:'NOT_RUN',realUI:'NOT_RUN'}));

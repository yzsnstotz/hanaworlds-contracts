import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as C from 'hanaworlds-contracts/v4';
import * as Painter from 'hanaworlds-contracts/painter/v3';
const fixture=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/v4/proposal-fixtures/text-build-proposal'))));
const clone=x=>JSON.parse(JSON.stringify(x));const bytes=x=>new TextEncoder().encode(JSON.stringify(x));
const {request,facts,response}=fixture;
const failures=[];let cases=0;
function ok(name,fn){try{fn();cases++;console.log('PASS FIXTURE '+name);}catch(e){failures.push(name+': '+e.message);console.error('FAIL FIXTURE '+name,e.actual?.publicError??e.message);}}
const reject=(name,fn,code)=>ok(name,()=>assert.throws(fn,e=>e.publicError?.code===code&&e.publicError.mutationState==='NONE',name));
const validate=(r=request)=>C.validateBuildProposalRequest(r);
const current=(r=request,f=facts)=>C.validateBuildProposalContext(r,f);
const output=(r=request,s=response)=>C.validateBuildProposalResponse(r,s);
const changed=(base,mutate)=>{const x=clone(base);mutate(x);return x;};
const badRequest=(name,mutate,code)=>reject(name,()=>validate(changed(request,mutate)),code);
const badFacts=(name,mutate,code)=>reject(name,()=>current(request,changed(facts,mutate)),code);
function bindBrief(r){r.referenceBriefDigest=C.digestValue('reference-brief',r.referenceBrief).sha256;r.intent.referenceBriefDigest=r.referenceBriefDigest;r.intentDigest=C.digestValue('intent',r.intent).sha256;}
function bindTarget(r){r.regionInspection.targetFacts=clone(r.targetFacts);r.targetFactsDigest=C.digestValue('target-facts',r.targetFacts).sha256;r.regionInspection.targetFactsDigest=r.targetFactsDigest;}
function bindCatalogue(r){r.targetFacts.catalogueDigest=C.digestValue('catalogue',r.catalogue).sha256;bindTarget(r);}
function bindSafety(r){r.safetyProfileDigest=C.digestValue('safety-profile',r.safetyProfile).sha256;}
const operation=C.operationContracts['painter/v3'].find(op=>op.operation==='ValidateBuildProposal');
ok('one explicit new operation with no alternate model clarification output',()=>{assert(operation);assert.equal(operation.alternateResult,undefined);assert.equal(Painter.operations.filter(x=>x.operation==='ValidateBuildProposal').length,1);});
ok('current producer feature capability',()=>assert.equal(C.checkBuildProposalHandshake(C.contractHandshake).result,'HANDSHAKE_OPERATION_MATCH'));
reject('old package does not advertise new operation',()=>C.checkBuildProposalHandshake({...C.contractHandshake,contracts:'hanaworlds-contracts@0.3.9'}),'UNSUPPORTED_VERSION');
reject('absent Painter wire',()=>C.checkBuildProposalHandshake({...C.contractHandshake,wireVersions:C.contractHandshake.wireVersions.filter(w=>w!=='painter/v3')}),'UNSUPPORTED_VERSION');
reject('absent region facts profile',()=>C.checkBuildProposalHandshake({...C.contractHandshake,factProfiles:['target-facts/v2']}),'UNSUPPORTED_VERSION');
ok('pure text decoded/raw/bound request and public binding',()=>{
 assert.equal(request.referenceBrief.media.length,0);
 for(const admitted of [validate(),C.validateBoundRequest('painter/v3','ValidateBuildProposal',request),Painter.validate('ValidateBuildProposal',request),Painter.admit('ValidateBuildProposal',bytes(request))])assert.deepEqual(clone(admitted),request);
 assert.ok(Object.isFrozen(validate().proposal.boxes));
});
ok('current original INSPECT with exact source/current context',()=>assert.deepEqual(clone(current()),request));
ok('BUILD response exact proposal/current facts/digest',()=>{assert.deepEqual(clone(output()),response);assert.deepEqual(clone(Painter.response('ValidateBuildProposal',response)),response);});
for(const [type,input] of [['BuildProposal',request.proposal],['BuildProposalBox',request.proposal.boxes[0]],['ValidateBuildProposalRequest',request],['BuildProposalContext',facts.sourceContext],['BuildProposalProviderFacts',facts],['ValidateBuildProposalResponse',response]]) {
 for(const field of Object.keys(input)){const x=clone(input);delete x[field];reject(type+' missing '+field,()=>C.validateType(type,x),'SCHEMA_INVALID');}
 reject(type+' unknown',()=>C.validateType(type,{...input,unknown:true}),'UNKNOWN_REQUIRED_FIELD');
}
for(const field of ['actorRef','sessionRef','authorizationRef','worldRef','transactionId','frame','evidence','confirmed','safetyProfile','allowedActions'])
 badRequest('model proposal cannot self-assert '+field,r=>r.proposal[field]='forged','UNKNOWN_REQUIRED_FIELD');
for(const [path,field] of [['proposal.materials.stone','callback'],['proposal.boxes.0','worldRef'],['intent','grant'],['referenceBrief','confirmed'],['targetFacts','authorizationRef'],['regionInspection','scope']])
 badRequest('nested unknown '+path,r=>path.split('.').reduce((x,k)=>x[k],r)[field]=true,'UNKNOWN_REQUIRED_FIELD');
reject('raw duplicate proposal key',()=>Painter.admit('ValidateBuildProposal',new TextEncoder().encode('{"proposal":{},"proposal":{}}')),'NON_CANONICAL_AMBIGUITY');
badRequest('no CLARIFY/model-planning input',r=>r.proposal.decision='CLARIFY','SCHEMA_INVALID');
badRequest('empty boxes',r=>r.proposal.boxes=[],'SCHEMA_INVALID');
badRequest('empty materials',r=>r.proposal.materials={},'SCHEMA_INVALID');
for(const value of [256,-1,1.5,'0'])badRequest('invalid param2 '+JSON.stringify(value),r=>r.proposal.materials.stone.param2=value,'SCHEMA_INVALID');
for(const value of [-1,0.5,Number.MAX_SAFE_INTEGER+1])badRequest('invalid local coordinate '+value,r=>r.proposal.boxes[0].min[0]=value,'SCHEMA_INVALID');
badRequest('reversed local box',r=>r.proposal.boxes[0].max[1]=-1,'SCHEMA_INVALID');
badRequest('model huge box outside fixed scope',r=>r.proposal.boxes[0].max[0]=Number.MAX_SAFE_INTEGER,'BUILD_INVALID');
badRequest('unknown material ref',r=>r.proposal.boxes[0].materialRef='missing','UNSUPPORTED_MATERIAL');
badRequest('unregistered node',r=>r.proposal.materials.stone.nodeName='missing:node','CATALOGUE_MISMATCH');
badRequest('unsupported param2 member',r=>r.proposal.materials.stone.param2=255,'UNSUPPORTED_MUTATION_SEMANTICS');
badRequest('occupied support is not a target',r=>{r.proposal.boxes[0].min[1]=0;r.proposal.boxes[0].max[1]=0;},'BUILD_INVALID');
// Remove a sampled empty cell coherently: it is unknown, never inferred empty.
badRequest('unknown/unobserved target cell',r=>{const pos=r.targetFacts.knownEmptyCells[0];r.targetFacts.knownEmptyCells=r.targetFacts.knownEmptyCells.slice(1);r.targetFacts.unknownCells=[{position:pos,reason:'UNLOADED'}];r.targetFacts.usableVolume=null;bindTarget(r);},'TARGET_FACTS_INCOMPLETE');
badRequest('protected cell refuses plan',r=>r.regionInspection.protectedPositions=[clone(response.result.build.operations[0].min)],'PERMISSION_DENIED');
badRequest('body occupied cell refuses plan',r=>r.regionInspection.bodyOccupiedPositions=[clone(response.result.build.operations[0].min)],'BUILD_INVALID');
badRequest('stateful material refuses plan',r=>{r.catalogue.nodes['fixture:stone'].hasPersistentState=true;bindCatalogue(r);},'UNSUPPORTED_MUTATION_SEMANTICS');
badRequest('hazard policy refuses damage',r=>{r.catalogue.nodes['fixture:stone'].damagePerSecond=10;bindCatalogue(r);},'SAFETY_INVARIANT_FAILED');
for(const flag of ['requireProtectedClearance','requireBodyClearance'])badRequest('no weakened '+flag,r=>{r.safetyProfile[flag]=false;bindSafety(r);},'CAPABILITY_UNAVAILABLE');
badRequest('required entrance without confirmed portal',r=>{r.safetyProfile.requireEntranceConnectivity=true;bindSafety(r);},'INTENT_UNCONFIRMED');
for(const field of ['intentDigest','referenceBriefDigest','targetFactsDigest','safetyProfileDigest'])badRequest('changed digest '+field,r=>r[field]='f'.repeat(64),field==='referenceBriefDigest'?'MEDIA_DIGEST_MISMATCH':'NON_CANONICAL_AMBIGUITY');
badRequest('wrong brief Session after self-rehash',r=>{r.referenceBrief.sessionRef='other';bindBrief(r);},'INTENT_UNCONFIRMED');
badRequest('wrong brief turn after self-rehash',r=>{r.referenceBrief.turnRevision='other';bindBrief(r);},'INTENT_UNCONFIRMED');
badRequest('wrong confirmed intent revision',r=>{r.intent.confirmedIntent.confirmedTurnRevision='other';r.intentDigest=C.digestValue('intent',r.intent).sha256;},'INTENT_UNCONFIRMED');
badRequest('cross-world intent',r=>{r.intent.intendedWorldRef='other';r.intentDigest=C.digestValue('intent',r.intent).sha256;},'INTENT_UNCONFIRMED');
badRequest('no cross-object expansion',r=>{r.intent.orderedTargetRefs=['other-object'];r.intentDigest=C.digestValue('intent',r.intent).sha256;},'INTENT_UNCONFIRMED');
badRequest('blank confirmed text',r=>{r.referenceBrief.text='  ';bindBrief(r);},'INTENT_UNCONFIRMED');
badRequest('no interior expansion',r=>r.painterId='interior','SCHEMA_INVALID');
badRequest('required provider inspection',r=>r.regionInspection=null,'SCHEMA_INVALID');
badRequest('catalogue changed without target binding',r=>r.catalogue.nodes['fixture:stone'].definitionRevision='other','TARGET_FACTS_STALE');
badRequest('region facts drift',r=>r.regionInspection.targetFacts.worldRevision='other','SCHEMA_INVALID');
badRequest('frame drift',r=>r.regionInspection.frame.frameId='other','NON_CANONICAL_AMBIGUITY');
badRequest('inspection evidence wrong world',r=>r.regionInspection.evidence.worldRef='other','SCHEMA_INVALID');
badRequest('inspection evidence old revision',r=>r.regionInspection.evidence.worldRevision='other','SCHEMA_INVALID');
for(const status of ['REVOKED','EXPIRED','UNKNOWN'])badFacts('current grant '+status,f=>f.grantStatus=status,status==='UNKNOWN'?'CAPABILITY_UNAVAILABLE':'AUTHORIZATION_REVOKED');
for(const status of ['ENDED','CANCELLED','SESSION_REPLACED'])badFacts('live invocation '+status,f=>f.invocationStatus=status,'PERMISSION_DENIED');
for(const status of ['UNCONFIRMED','SUPERSEDED'])badFacts('turn '+status,f=>f.turnStatus=status,'INTENT_UNCONFIRMED');
for(const field of ['callerServiceRef','expectedCallerServiceRef','liveSessionIncarnationRef'])badFacts('wrong service/incarnation '+field,f=>f[field]='other','PERMISSION_DENIED');
badFacts('delegation is operation-specific',f=>f.authorizedOperation='CreateBuildPlan','SCHEMA_INVALID');
for(const field of Object.keys(facts.originalBinding))badFacts('regrant/original identity drift '+field,f=>f.currentBinding[field]=field==='allowedActions'?['READ']:'other','PERMISSION_DENIED');
badFacts('READ cannot become planning INSPECT',f=>{f.originalBinding.allowedActions=['READ'];f.currentBinding.allowedActions=['READ'];},'PERMISSION_DENIED');
for(const context of ['sourceContext','currentContext']) for(const field of ['worldRef','turnRevision','invocationId','intentDigest','referenceBriefDigest','targetFactsDigest','safetyProfileDigest'])badFacts(context+' changed '+field,f=>f[context][field]=field.endsWith('Digest')?'f'.repeat(64):'other','TARGET_FACTS_STALE');
badFacts('cannot rebind changed brief control',f=>f.sourceContext.referenceBrief.controls.styleText='new-style','TARGET_FACTS_STALE');
badFacts('cannot rebind placement inspection identity',f=>f.sourceContext.regionInspection.inspectionId='other','TARGET_FACTS_STALE');
const retry={...facts,replay:'EXACT_REPLAY',priorRequest:request};
ok('exact entire-request replay',()=>assert.deepEqual(clone(current(request,retry)),request));
badFacts('conflicting replay',f=>f.replay='CONFLICT','REPLAY_MISMATCH');
badFacts('missing original replay payload',f=>f.replay='EXACT_REPLAY','REPLAY_MISMATCH');
badFacts('new request cannot overwrite prior',f=>f.priorRequest=request,'REPLAY_MISMATCH');
reject('proposal participates in replay identity',()=>current(request,changed(retry,f=>f.priorRequest.proposal.boxes.push(clone(f.priorRequest.proposal.boxes[0])))),'REPLAY_MISMATCH');
reject('requestId participates in replay identity',()=>current({...request,requestId:'other'},retry),'REPLAY_MISMATCH');
reject('replay rechecks revocation',()=>current(request,{...retry,grantStatus:'REVOKED'}),'AUTHORIZATION_REVOKED');
reject('late output rechecks cancelled invocation',()=>current(request,{...facts,invocationStatus:'CANCELLED'}),'PERMISSION_DENIED');
// Strict output correspondence, not just a well-shaped BUILD from another request.
for(const field of ['requestId'])reject('wrong response '+field,()=>output(request,{...response,[field]:'other'}),'PERMISSION_DENIED');
reject('wrong invocation result',()=>output(request,changed(response,s=>s.result.invocationId='other')),'PERMISSION_DENIED');
reject('wrong build digest',()=>output(request,changed(response,s=>s.result.buildDigest='f'.repeat(64))),'NON_CANONICAL_AMBIGUITY');
function changedBuild(mutate){return changed(response,s=>{mutate(s.result.build);s.result.buildDigest=C.digestValue('build',s.result.build).sha256;});}
reject('BUILD rehashed with another context',()=>output(request,changedBuild(b=>b.targetFactsDigest='f'.repeat(64))),'TARGET_FACTS_STALE');
reject('BUILD rehashed with another frame',()=>output(request,changedBuild(b=>b.coordinateFrame.frameId='other')),'TARGET_FACTS_STALE');
reject('BUILD cannot add unused proposal materials',()=>output(request,changedBuild(b=>b.materials.other=clone(b.materials.stone))),'BUILD_INVALID');
reject('BUILD cannot change ordered proposal operations',()=>output(request,changedBuild(b=>b.operations.push(clone(b.operations[0])))),'BUILD_INVALID');
reject('BUILD cannot invent witness evidence',()=>output(request,changedBuild(b=>b.witnesses.find(w=>w.predicate==='PROTECTION').facts.evidence.providerRef='model')),'PERMISSION_DENIED');
reject('BUILD cannot omit safety witness',()=>output(request,changedBuild(b=>b.witnesses=b.witnesses.filter(w=>w.predicate!=='PROTECTION'))),'SAFETY_INVARIANT_FAILED');
const error=code=>({contractVersion:'painter/v3',requestId:request.requestId,result:null,error:{code,phase:'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason:'REQUIRED_FACT_UNKNOWN'}});
for(const code of operation.failureCodes)ok('honest typed failure '+code,()=>assert.equal(output(request,error(code)).error.code,code));
reject('no model invocation error contract',()=>Painter.response('ValidateBuildProposal',error('MODEL_REQUEST_FAILED')),'SCHEMA_INVALID');
reject('error cannot claim partial mutation',()=>Painter.response('ValidateBuildProposal',changed(error('BUILD_INVALID'),s=>s.error.mutationState='PARTIAL')),'SCHEMA_INVALID');
reject('error cannot claim transaction',()=>Painter.response('ValidateBuildProposal',changed(error('BUILD_INVALID'),s=>s.error.transactionRef='forged')),'SCHEMA_INVALID');
// Text-only media and large geometry are new boundary checks, not old route tests.
badRequest('valid image binding is still outside pure-text operation',r=>{r.referenceBrief.media=fixture.outOfScopeMedia;bindBrief(r);},'SCHEMA_INVALID');
function coverage(r){const positions=[...r.targetFacts.occupiedCells.map(c=>c.position),...r.targetFacts.knownEmptyCells,...r.targetFacts.unknownCells.map(c=>c.position)].sort(C.comparePosition);r.targetFacts.coverageDigest=C.digestValue('coverage',{profileVersion:'coverage/v2',sampledBounds:r.targetFacts.sampledBounds,sampledPositions:positions}).sha256;bindTarget(r);}
badRequest('huge in-bounds box with sparse facts rejects without cell enumeration',r=>{r.targetFacts.sampledBounds.max=[Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER];coverage(r);r.proposal.boxes[0].max=r.targetFacts.sampledBounds.min.map(x=>Number.MAX_SAFE_INTEGER-x);},'TARGET_FACTS_INCOMPLETE');
badRequest('translation overflow rejects before number rounding',r=>{const offset=Number.MAX_SAFE_INTEGER-1;r.targetFacts.sampledBounds.min[0]+=offset;r.targetFacts.sampledBounds.max[0]+=offset;for(const p of r.targetFacts.knownEmptyCells)p[0]+=offset;for(const c of r.targetFacts.occupiedCells)c.position[0]+=offset;coverage(r);r.proposal.boxes[0].min[0]=2;r.proposal.boxes[0].max[0]=2;},'BUILD_INVALID');
ok('overlap retains ordered boxes and exact union coverage',()=>{const r=clone(request);r.proposal.boxes.push(clone(r.proposal.boxes[0]));validate(r);const s=clone(response);s.result.build.operations.push(clone(s.result.build.operations[0]));s.result.buildDigest=C.digestValue('build',s.result.build).sha256;output(r,s);});
assert.deepEqual(failures,[],failures.join('\n'));
console.log(JSON.stringify({result:'PASS_BUILD_PROPOSAL_CONFORMANCE',evidence:'SOURCE/FIXTURE',cases,modelCalls:0,worldWrites:0,providerAuthentication:'NOT_RUN',painterRuntime:'NOT_RUN',realUI:'NOT_RUN'}));

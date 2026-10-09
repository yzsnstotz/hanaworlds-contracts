// confirmed-placement/v1 conformance (SOURCE/FIXTURE). A placement shown before confirmation is a
// structured PlacementProposal from a real inspection, bound by the human confirmation (brief/intent
// digests), matched by Painter against the final effect set and rechecked by Canvas before any write.
// Every refusal is named; nothing is defaulted, re-based or truncated. Providers and consumers run
// this against the installed package.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const load=async n=>JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/'+n))));
const fx=await load('confirmed-placement'),main=await load('main');
const clone=v=>JSON.parse(JSON.stringify(v)),D=(k,v)=>a.digestValue(k,v).sha256;
let passed=0;function test(name,fn){fn();console.log('ok',++passed,name)}
const rejects=(fn,error,title)=>assert.throws(fn,e=>{for(const [k,v] of Object.entries(error))assert.equal(e[k],v,`${title}: ${k}`);return true;},title);
const ins=n=>fx.inspections[n];

test('contract surface: profile, placement types, wires and named failures',()=>{
 assert.equal(fx.profileVersion,'confirmed-placement-fixture/v1');assert.equal(a.contractsCompatibility.major,2);
 assert.equal(a.confirmedPlacement.id,'confirmed-placement/v1');
 for(const t of ['Controls','ConfirmedIntent'])assert.ok(a.schemaBundle.definitions[t].required.includes('placement'),t);
 assert.ok(a.schemaBundle.definitions.RegionApplyBinding.required.includes('confirmedPlacement'));
 assert.equal(a.digestProfile.projectionTypes['placement-proposal'],'PlacementProposal');
 for(const w of ['session/v5','painter/v6','ReferenceBrief/v5','painter-region/v3','canvas/v7','world-adapter/v7','BUILD/V4','region-build/v1','world-adapter-region/v2','canvas-region/v2','interaction-surface/v4'])assert.ok(a.wireVersions.includes(w),w);
 for(const w of ['session/v4','painter/v5','ReferenceBrief/v4','painter-region/v2','canvas/v6'])assert.ok(!a.wireVersions.includes(w),w);
 const names=a.confirmedPlacement.namedFailures.map(f=>f.failure),pairs=a.confirmedPlacement.namedFailures.map(f=>f.code+'/'+f.reason);
 assert.equal(new Set(names).size,names.length);assert.equal(new Set(pairs).size,pairs.length,'each named failure has its own public code/reason');
 for(const f of a.confirmedPlacement.namedFailures){assert.equal(f.phase,'validate');a.validateType('ErrorCode',f.code);a.validateType('ErrorReason',f.reason);}
 assert.ok(a.placementInvariants.some(i=>i.id==='CONFIRMED-PLACEMENT'&&i.switchable===false));
});
test('decode: placement is required (no default), closed, versioned and canonically ordered',()=>{
 const controls=clone(main.request.referenceBrief.controls);a.validateType('Controls',controls);
 const missing=clone(controls);delete missing.placement;rejects(()=>a.validateType('Controls',missing),{code:'SCHEMA_INVALID'},'missing placement');
 rejects(()=>a.validateType('ConfirmedIntent',{...clone(main.request.intent.confirmedIntent),confirmedPositions:[[0,1,3]]}),{code:'UNKNOWN_REQUIRED_FIELD'},'prose-era extra field');
 const p=clone(fx.placements.A);a.validateType('PlacementProposal',p);
 rejects(()=>a.validateType('PlacementProposal',{...p,profileVersion:'placement-proposal/v0'}),{code:'UNSUPPORTED_VERSION'},'version');
 rejects(()=>a.validateType('PlacementProposal',{...p,target:{kind:'EXACT_CELLS',cells:[]}}),{code:'SCHEMA_INVALID'},'empty cells');
 rejects(()=>a.validateType('PlacementProposal',{...p,target:{kind:'EXACT_CELLS',cells:[[1,1,3],[0,1,3]]}}),{code:'SCHEMA_INVALID'},'unordered cells');
 rejects(()=>a.validateType('PlacementProposal',{...p,target:{kind:'EXACT_CELLS',cells:[[0,1,3],[0,1,3]]}}),{code:'SCHEMA_INVALID'},'duplicate cells');
 rejects(()=>a.validateType('PlacementProposal',{...p,target:{kind:'CURRENT_VIEW'}}),{code:'SCHEMA_INVALID'},'unknown target kind');
 rejects(()=>a.validateType('PlacementProposal',{...p,source:{...p.source,yaw:90}}),{code:'UNKNOWN_REQUIRED_FIELD'},'no player pose');
 assert.match(a.digestValue('placement-proposal',p).preimageUtf8,/^HanaWorlds\|placement-proposal\/v1\|placement-proposal\|/);
});
test('a placement is made only from a real inspection; its target stays inside what was sampled',()=>{
 for(const c of fx.proposal.accept)assert.equal(a.canonicalJSON(a.createPlacementProposal(ins(c.inspection),c.target)),a.canonicalJSON(c.placement),c.title);
 for(const c of fx.proposal.reject)rejects(()=>a.createPlacementProposal(ins(c.inspection),c.target),c.error,c.title);
 for(const c of fx.source.reject)rejects(()=>a.requirePlacementSource(fx.placements[c.placement],ins(c.inspection),c.worldRef),c.error,c.title);
 a.requirePlacementSource(fx.placements.A,ins('view1'),main.request.worldRef);
 a.requirePlacementTarget(fx.placements.A,[[0,1,3],[1,1,3],[2,1,3]]);
 rejects(()=>a.requirePlacementTarget(fx.placements.A,[[3,1,3],[4,1,3],[5,1,3]]),{placementFailure:'PLACEMENT_TARGET_MISMATCH'},'A vs B');
});
test('Painter (painter/v6): confirmed A writes A; extent, a new proposal with a new confirmation and no placement pass',()=>{
 for(const c of fx.perCell.accept){a.validateBuildProposalRequest(c.request);a.validateBuildProposalResponse(c.request,c.response);}
});
test('Painter (painter/v6): B under A, partial, outside extent, new view, stale, frame, binding, old confirmation and occupied are refused by name',()=>{
 for(const c of fx.perCell.reject){rejects(()=>a.validateBuildProposalRequest(c.request),c.error,c.title);
  if(c.error.placementFailure){const f=a.confirmedPlacement.namedFailures.find(x=>x.failure===c.error.placementFailure);assert.equal(f.code,c.error.code);assert.equal(f.reason,c.error.reason);}}
});
test('Painter model path (painter/v6 CreateBuildPlan): the plan honours the confirmed placement or is refused by name',()=>{
 for(const c of fx.createBuildPlan.accept){a.validateCreateBuildPlanRequest(c.request);a.validateCreateBuildPlanResponse(c.request,c.response);}
 for(const c of fx.createBuildPlan.reject)rejects(()=>c.at==='request'?a.validateCreateBuildPlanRequest(c.request):a.validateCreateBuildPlanResponse(c.request,c.response),c.error,c.title);
 const [ok]=fx.createBuildPlan.accept;
 rejects(()=>a.validateCreateBuildPlanResponse(ok.request,{...clone(ok.response),requestId:'another'}),{code:'TRANSACTION_CONFLICT'},'response for another request');
 rejects(()=>a.validateCreateBuildPlanResponse(ok.request,{...clone(fx.createBuildPlan.accept[4].response),invocationId:'another'}),{code:'TRANSACTION_CONFLICT'},'clarification for another invocation');
});
test('Painter response: a response for another request (A confirmed, B built) is refused before release',()=>{
 const [okA]=fx.perCell.accept,b=fx.perCell.reject[0];
 rejects(()=>a.validateBuildProposalResponse(b.request,{...clone(okA.response),requestId:b.request.requestId}),{code:'INTENT_UNCONFIRMED',placementFailure:'PLACEMENT_TARGET_MISMATCH'},'B request never validates');
});
test('replay: a completed request returns the stored outcome; the same requestId with B is a conflict',()=>{
 const [okA]=fx.perCell.accept,b=fx.perCell.reject[0].request;
 const facts={...clone(main.facts.requestFacts),currentTurnRevision:okA.request.turnRevision,currentBriefDigest:okA.request.referenceBriefDigest};
 const first=a.validateCurrentRequest('painter/v6','ValidateBuildProposal',okA.request,facts);assert.equal(first.disposition,'EXECUTE');
 const done={...facts,requestState:'COMPLETED',replay:'EXACT_REPLAY',priorRequestDigest:first.requestDigest};
 assert.equal(a.validateCurrentRequest('painter/v6','ValidateBuildProposal',okA.request,done).disposition,'RETURN_STORED');
 rejects(()=>a.validateCurrentRequest('painter/v6','ValidateBuildProposal',{...b,requestId:okA.request.requestId},done),{code:'TRANSACTION_CONFLICT'},'changed payload under the same requestId');
});
test('Workshop context: a re-read on a new view is not the retained context of the confirmed placement',()=>{
 const [okA]=fx.perCell.accept,moved=fx.perCell.reject[3].request,keys=Object.keys(a.schemaBundle.definitions.BuildProposalContext.properties);
 const ctx=r=>Object.fromEntries(keys.map(k=>[k,clone(r[k])]));
 const requestFacts={...clone(main.facts.requestFacts),currentTurnRevision:okA.request.turnRevision,currentBriefDigest:okA.request.referenceBriefDigest};
 a.validateBuildProposalContext(okA.request,{sourceContext:ctx(okA.request),currentContext:ctx(okA.request),requestFacts});
 rejects(()=>a.validateBuildProposalContext(okA.request,{sourceContext:ctx(okA.request),currentContext:ctx(moved),requestFacts}),{code:'TARGET_FACTS_STALE'},'current context moved');
});
test('Canvas (canvas/v7) and Workshop submission: the confirmed binding is carried and rechecked before any write',()=>{
 for(const c of fx.canvas.accept){a.validateCurrentBuildSubmission(c.submission,c.requestFacts);
  const checked=a.checkConfirmedPlacementApply(c.submission.apply,ins(c.recordedInspection),c.currentWorldRevision);
  const sent=c.submission.apply.regionInspectionBinding.confirmedPlacement;
  if(sent===null)assert.equal(checked,null,c.title);else{assert.equal(checked.placementDigest,D('placement-proposal',sent.placement));assert.equal(checked.intentDigest,D('intent',c.submission.intent));}}
 for(const c of fx.canvas.reject){
  const run=c.at==='canvas'?()=>a.checkConfirmedPlacementApply(c.submission.apply,ins(c.recordedInspection),c.currentWorldRevision)
   :c.at==='apply'?()=>a.validateBoundRequest('canvas/v7','ApplyRecoverableCommit',c.submission.apply):()=>a.validateCurrentBuildSubmission(c.submission,c.requestFacts);
  rejects(run,c.error,c.title);
 }
});
test('Canvas binding needs its intent: confirmedPlacementBinding is null without a confirmed placement',()=>{
 const [okA,,,none]=fx.perCell.accept;
 assert.equal(a.confirmedPlacementBinding(none.request.intent),null);
 const b=a.confirmedPlacementBinding(okA.request.intent);assert.equal(b.intentDigest,okA.request.intentDigest);assert.equal(b.placementDigest,D('placement-proposal',fx.placements.A));
 assert.equal(a.canonicalJSON(a.confirmedPlacementOf(okA.request.intent,okA.request.referenceBrief)),a.canonicalJSON(fx.placements.A));
});
test('region (painter-region/v3): specified world cells match the confirmed target',()=>{
 for(const c of fx.region.accept)a.validateRegionProposalRequest(c.request);
 for(const c of fx.region.reject)rejects(()=>a.validateRegionProposalRequest(c.request),c.error,c.title);
});
test('no placement type carries player geometry, pose or a second confirmation authority',()=>{
 for(const t of ['PlacementProposal','PlacementSource','PlacementTarget','PlacementCells','ConfirmedPlacementBinding']){
  const s=JSON.stringify(a.schemaBundle.definitions[t]);assert.doesNotMatch(s,/avatar|body|yaw|pitch|pose|playerPosition|authorization|grant|"default"/,t);}
});
console.log(JSON.stringify({evidence:'SOURCE/FIXTURE',suite:'confirmed-placement',checks:passed,modelCalls:0,worldWrites:0,realRuntime:'NOT_RUN',realUI:'NOT_RUN'}));

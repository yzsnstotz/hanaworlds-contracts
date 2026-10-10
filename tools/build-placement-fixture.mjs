// Regenerates spec/local-world/fixtures/confirmed-placement.json (confirmed-placement/v1) from the
// published main and region fixtures. Every inspection, placement, digest, BUILD witness and Canvas
// apply binding is computed with the package's own public functions; the expected refusals are
// recorded as data so producers and consumers run the same cases. Run after `npm run build`, then
// build again to publish fixtures/local.
import {readFile,writeFile} from 'node:fs/promises';
import * as a from '../dist/local/index.mjs';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const main=await json('spec/local-world/fixtures/main.json'),regionFx=await json('spec/local-world/fixtures/region.json');
const D=(k,v)=>a.digestValue(k,v).sha256,clone=v=>JSON.parse(JSON.stringify(v)),r0=main.request;
// Optional fields (1.1): a null value here means the field is absent.
const setOpt=(o,k,v)=>{if(v===null||v===undefined)delete o[k];else o[k]=clone(v);};
const range=(x0,x1,f)=>Array.from({length:x1-x0+1},(_,i)=>f(x0+i));
const failure=name=>{const f=a.confirmedPlacement.namedFailures.find(x=>x.failure===name);return {code:f.code,reason:f.reason,placementFailure:name};};
const expectError=fn=>{try{fn();}catch(e){return e;}throw Error('expected a refusal');};

// --- Inspections: one row of known-empty cells above stone, as an Adapter CURRENT_VIEW would report.
function inspection({id,x0,x1,z=3,worldRef=r0.worldRef,worldRevision='fixture-world-10',transformRevision='fixture-adapter-exec-1',cells=null,bounds=null}){
 const frame={...clone(r0.regionInspection.frame),transformRevision};
 const sampledBounds=bounds??{min:[x0,0,z],max:[x1,1,z]};
 const occupiedCells=cells?[]:range(x0,x1,x=>({position:[x,0,z],nodeName:'fixture:stone',param2:0}));
 const knownEmptyCells=cells??range(x0,x1,x=>[x,1,z]);
 const sampledPositions=[...occupiedCells.map(c=>c.position),...knownEmptyCells].sort(a.comparePosition);
 const evidence={...clone(r0.regionInspection.evidence),worldRef,worldRevision,sourceRevision:transformRevision};
 const targetFacts={...clone(r0.targetFacts),worldRef,worldRevision,frameDigest:D('frame',frame),sampledBounds,
  coverageDigest:D('coverage',{profileVersion:'coverage/v2',sampledBounds,sampledPositions}),occupiedCells,knownEmptyCells,
  usableVolume:{...clone(r0.targetFacts.usableVolume),emptyCellCount:knownEmptyCells.length}};
 return a.validateRegionInspection({...clone(r0.regionInspection),inspectionId:id,targetFacts,targetFactsDigest:D('target-facts',targetFacts),frame,evidence});
}
const inspections={
 view1:inspection({id:'canvas-inspection-view-1',x0:0,x1:5}),
 // The player turned after confirming: the next CURRENT_VIEW samples x3..5 instead.
 view2:inspection({id:'canvas-inspection-view-2',x0:3,x1:5}),
 view1Later:inspection({id:'canvas-inspection-view-1-later',x0:0,x1:5,worldRevision:'fixture-world-11'}),
 view1OtherFrame:inspection({id:'canvas-inspection-frame-2',x0:0,x1:5,transformRevision:'fixture-adapter-exec-2'}),
 otherWorld:inspection({id:'canvas-inspection-world-b',x0:0,x1:5,worldRef:'fixture-world-b'}),
};
const row=(x0,x1)=>range(x0,x1,x=>[x,1,3]);
const exact=cells=>({kind:'EXACT_CELLS',cells});
const placements={
 A:a.createPlacementProposal(inspections.view1,exact(row(0,2))),
 B:a.createPlacementProposal(inspections.view1,exact(row(3,5))),
 extentA:a.createPlacementProposal(inspections.view1,{kind:'ANCHORED_EXTENT',bounds:{min:[0,1,3],max:[2,1,3]}}),
 newB:a.createPlacementProposal(inspections.view2,exact(row(3,5))),
 occupied:a.createPlacementProposal(inspections.view1,exact([[0,0,3]])),
};

// --- painter/v5 requests: same Session, materials and dimensions; only what the case names differs.
function perCell({inspection:ins,brief,intent=brief,boxes,turn='fixture-turn-4',confirmedTurn=turn}){
 const r=clone(r0),dims={width:3,height:1,depth:1,unit:'node'};
 Object.assign(r,{turnRevision:turn,regionInspection:clone(ins),targetFacts:clone(ins.targetFacts),targetFactsDigest:ins.targetFactsDigest});
 Object.assign(r.referenceBrief,{turnRevision:turn,briefRevision:'fixture-brief-'+turn.split('-').at(-1)});
 Object.assign(r.referenceBrief.controls,{dimensions:dims});setOpt(r.referenceBrief.controls,'placement',brief);
 r.referenceBriefDigest=D('reference-brief',r.referenceBrief);
 r.intent.referenceBriefDigest=r.referenceBriefDigest;
 Object.assign(r.intent.confirmedIntent,{dimensions:dims,confirmedTurnRevision:confirmedTurn});setOpt(r.intent.confirmedIntent,'placement',intent);
 r.intentDigest=D('intent',r.intent);
 r.proposal.boxes=boxes.map(([min,max])=>({min,max,materialRef:'stone'}));
 return r;
}
function respond(r){
 const resp=clone(main.response),b=resp.result.build,tf=r.targetFacts,o=tf.sampledBounds.min;
 b.operations=r.proposal.boxes.map(x=>({op:'set_box',min:x.min.map((v,i)=>v+o[i]),max:x.max.map((v,i)=>v+o[i]),materialRef:x.materialRef}));
 const positions=tf.knownEmptyCells.filter(p=>b.operations.some(op=>p.every((v,i)=>v>=op.min[i]&&v<=op.max[i]))).sort(a.comparePosition);
 const effects=positions.map(position=>({position,...b.materials.stone}));
 const finalEffectsDigest=D('final-effects',{profileVersion:'final-effects/v2',frameDigest:tf.frameDigest,catalogueDigest:b.catalogueDigest,effects});
 Object.assign(b,{coordinateFrame:clone(r.regionInspection.frame),targetFactsDigest:r.targetFactsDigest,
  declaredBounds:{min:[0,1,2].map(i=>Math.min(...b.operations.map(op=>op.min[i]))),max:[0,1,2].map(i=>Math.max(...b.operations.map(op=>op.max[i])))}});
 for(const w of b.witnesses)Object.assign(w,{finalEffectsDigest,targetFactsDigest:r.targetFactsDigest,facts:{...w.facts,evidence:clone(r.regionInspection.evidence),positions}});
 resp.result.buildDigest=D('build',b);
 return {response:resp,effects};
}
const A=placements.A,local=(x0,x1)=>[[x0,1,0],[x1,1,0]];
const accepted=[
 {title:'confirmed A, built from its own inspection: A is written',request:perCell({inspection:inspections.view1,brief:A,boxes:[local(0,2)]})},
 {title:'confirmed extent: any effect set inside it on the same inspection (no per-cell confirmation)',request:perCell({inspection:inspections.view1,brief:placements.extentA,boxes:[local(0,1)]})},
 {title:'normal new proposal B (new view) and a new human confirmation: B is written',request:perCell({inspection:inspections.view2,brief:placements.newB,boxes:[local(0,2)],turn:'fixture-turn-5'})},
 {title:'no structured placement confirmed: normal CURRENT_VIEW behaviour is unchanged',request:perCell({inspection:inspections.view1,brief:null,boxes:[local(0,2)]})},
].map(c=>{const {response}=respond(c.request);a.validateBuildProposalRequest(c.request);a.validateBuildProposalResponse(c.request,response);return {...c,response};});
const rejected=[
 ['confirmed A; same Session, turn, materials and dimensions, but the boxes write B',{inspection:inspections.view1,brief:A,boxes:[local(3,5)]},'PLACEMENT_TARGET_MISMATCH'],
 ['confirmed A; only part of the confirmed exact cells is written',{inspection:inspections.view1,brief:A,boxes:[local(0,1)]},'PLACEMENT_TARGET_MISMATCH'],
 ['confirmed extent; the effect set leaves it',{inspection:inspections.view1,brief:placements.extentA,boxes:[local(0,3)]},'PLACEMENT_TARGET_MISMATCH'],
 ['confirmed A; a new CURRENT_VIEW inspection re-interprets the old local geometry (the 2026-10-10 real failure shape)',{inspection:inspections.view2,brief:A,boxes:[local(0,2)]},'PLACEMENT_INSPECTION_CHANGED'],
 ['confirmed A; the world revision moved after the proposal',{inspection:inspections.view1Later,brief:A,boxes:[local(0,2)]},'PLACEMENT_REVISION_STALE'],
 ['confirmed A; the coordinate frame changed',{inspection:inspections.view1OtherFrame,brief:A,boxes:[local(0,2)]},'PLACEMENT_FRAME_CHANGED'],
 ['binding missing: shown A in the brief, confirmed intent carries none',{inspection:inspections.view1,brief:A,intent:null,boxes:[local(0,2)]},'PLACEMENT_BINDING_CHANGED'],
 ['binding changed: shown A, confirmed intent carries B',{inspection:inspections.view1,brief:A,intent:placements.B,boxes:[local(3,5)]},'PLACEMENT_BINDING_CHANGED'],
].map(([title,input,name])=>({title,request:perCell(input),error:failure(name)}));
rejected.push({title:'an old confirmation (earlier turn) is not this turn\'s confirmation',request:perCell({inspection:inspections.view1,brief:A,boxes:[local(0,2)],turn:'fixture-turn-5',confirmedTurn:'fixture-turn-4'}),error:{code:'INTENT_UNCONFIRMED',reason:'REQUIRED_FACT_UNKNOWN'}});
rejected.push({title:'known-empty is unchanged: a confirmed occupied cell is still refused by geometry',request:perCell({inspection:inspections.view1,brief:placements.occupied,boxes:[[[0,0,0],[0,0,0]]]}),error:{code:'BUILD_INVALID',reason:'INVALID_GEOMETRY'}});
for(const c of rejected){const e=expectError(()=>a.validateBuildProposalRequest(c.request));for(const [k,v] of Object.entries(c.error))if(e[k]!==v)throw Error(`${c.title}: ${k}=${e[k]}`);}

// --- Proposal creation and function-level source checks.
const proposal={accept:[{title:'exact cells inside the sampled bounds',inspection:'view1',target:exact(row(0,2)),placement:A}],
 reject:[{title:'a target outside the sampled inspection',inspection:'view2',target:exact(row(0,2)),error:failure('PLACEMENT_OUTSIDE_INSPECTION')},
  {title:'an extent reaching outside the sampled inspection',inspection:'view2',target:{kind:'ANCHORED_EXTENT',bounds:{min:[2,1,3],max:[4,1,3]}},error:failure('PLACEMENT_OUTSIDE_INSPECTION')}]};
for(const c of proposal.reject)expectError(()=>a.createPlacementProposal(inspections[c.inspection],c.target));
const source={reject:[{title:'another World',placement:'A',inspection:'otherWorld',worldRef:'fixture-world-b',error:failure('PLACEMENT_WORLD_CHANGED')}]};
for(const c of source.reject)expectError(()=>a.requirePlacementSource(placements[c.placement],inspections[c.inspection],c.worldRef));

// --- Workshop submission and Canvas canvas/v6 apply (Canvas rechecks before any write).
const config={profileVersion:'compilation-config/v2',backendProfileId:'static-local',worldeditRevision:'static-1',nodeWriteSemantics:'explicit-nodeName-param2-static-v2',overlapRule:'last-writer-wins',effectOrder:'numeric-x-y-z',compressionRule:'exact-final-effects-only'};
function submission(r,{binding='confirmed',bindingIntent=r.intent}={}){
 const {response,effects}=respond(r),b=response.result.build,tf=r.targetFacts;
 const operations={contractVersion:'operations/v3',buildDigest:response.result.buildDigest,compilerRevision:'brush-1',compilationConfigDigest:D('compilation-config',config),worldRef:r.worldRef,frameDigest:tf.frameDigest,catalogueDigest:b.catalogueDigest,targetFactsDigest:r.targetFactsDigest,effects};
 const operationDigest=D('operations',operations);
 const analysis={contractVersion:'canvas/v6',worldRef:r.worldRef,worldRevision:tf.worldRevision,registryRevision:'registry-1',selectionRevision:'selection-1',operationDigest,orderedSelectedRefs:[],affectedObjectRefs:[]};
 const confirmedPlacement=binding==='confirmed'?a.confirmedPlacementBinding(bindingIntent):binding;
 const envelope=(wire,requestId,fields)=>({contractVersion:wire,sessionRef:r.sessionRef,requestId,worldRef:r.worldRef,...fields,localContext:clone(r.localContext)});
 const apply=envelope('canvas/v6','apply',{transactionId:'transaction-1',operations,operationDigest,analysisDigest:D('affected-analysis',analysis),decisionRevision:null,expectedWorldRevision:tf.worldRevision,expectedObjectRevisions:{},guarantee:'RECOVERABLE_VERIFIED',regionInspectionBinding:{inspectionId:r.regionInspection.inspectionId,build:b}});setOpt(apply.regionInspectionBinding,'confirmedPlacement',confirmedPlacement);
 const advance=envelope('session/v4','advance',{expectedTurnRevision:r.turnRevision});
 return {submission:{parentRequest:advance,turnRef:'turn-1',confirmationInputId:'confirmation-1',intent:r.intent,analysis,apply},
  requestFacts:{...clone(main.facts.requestFacts),currentTurnRevision:r.turnRevision,currentBriefDigest:r.referenceBriefDigest}};
}
const [okA]=accepted,reqB=rejected[0].request,reqView2=rejected[3].request;
const canvas={
 accept:[{title:'Workshop sends the confirmed A binding; Canvas finds its recorded source inspection and the current revision unchanged',...submission(okA.request),recordedInspection:'view1',currentWorldRevision:'fixture-world-10'},
  {title:'no placement confirmed and none sent',...submission(accepted[3].request,{binding:null}),recordedInspection:'view1',currentWorldRevision:'fixture-world-10'}],
 reject:[
  {title:'Canvas: binding A but the compiled effects are B (Painter skipped or wrong)',...submission(reqB,{bindingIntent:okA.request.intent}),at:'apply',error:failure('PLACEMENT_TARGET_MISMATCH')},
  {title:'Canvas: binding A but the build came from a new CURRENT_VIEW inspection',...submission(reqView2),at:'apply',error:failure('PLACEMENT_INSPECTION_CHANGED')},
  {title:'Canvas: the world revision moved after the proposal (recorded inspection current revision)',...submission(okA.request),recordedInspection:'view1',currentWorldRevision:'fixture-world-11',at:'canvas',error:failure('PLACEMENT_REVISION_STALE')},
  {title:'Workshop: confirmed A but the apply carries no binding',...submission(okA.request,{binding:null}),at:'submission',error:failure('PLACEMENT_BINDING_CHANGED')},
  {title:'Workshop: no placement confirmed but the apply invents one',...submission(accepted[3].request,{bindingIntent:okA.request.intent}),at:'submission',error:failure('PLACEMENT_BINDING_CHANGED')},
  {title:'Workshop: the binding replays an earlier confirmation of the same placement (earlier intent)',...submission(okA.request,{bindingIntent:perCell({inspection:inspections.view1,brief:A,boxes:[local(0,2)],turn:'fixture-turn-3'}).intent}),at:'submission',error:failure('PLACEMENT_BINDING_CHANGED')},
 ]};
// The digest tamper is a binding change regardless of what else matches.
{const c=submission(okA.request);c.submission.apply.regionInspectionBinding.confirmedPlacement.placementDigest='0'.repeat(64);canvas.reject.push({title:'Canvas: placement digest does not match the bound placement',...c,at:'apply',error:failure('PLACEMENT_BINDING_CHANGED')});}
{const c=submission(okA.request);c.submission.apply.regionInspectionBinding.confirmedPlacement.intentDigest=okA.request.intentDigest.replace(/^./,x=>x==='0'?'1':'0');canvas.reject.push({title:'Workshop: intent digest in the binding is not the confirmed intent',...c,at:'submission',error:failure('PLACEMENT_BINDING_CHANGED')});}
for(const c of canvas.accept){a.validateCurrentBuildSubmission(c.submission,c.requestFacts);a.checkConfirmedPlacementApply(c.submission.apply,inspections[c.recordedInspection],c.currentWorldRevision);}
for(const c of canvas.reject)expectError(()=>c.at==='canvas'?a.checkConfirmedPlacementApply(c.submission.apply,inspections[c.recordedInspection],c.currentWorldRevision):c.at==='apply'?a.validateBoundRequest('canvas/v6','ApplyRecoverableCommit',c.submission.apply):a.validateCurrentBuildSubmission(c.submission,c.requestFacts));

// --- painter-region/v2: the region block is in world coordinates; its specified cells are the target.
const pr=regionFx.proposalRequest,block=a.expandRegionBlock(pr.proposal.block);
const specified=[];for(let i=0;i<block.indices.length;i++)if(block.indices[i]!==-1){const [sx,sy]=[0,1].map(k=>block.box.max[k]-block.box.min[k]+1);specified.push([block.box.min[0]+i%sx,block.box.min[1]+Math.floor(i/sx)%sy,block.box.min[2]+Math.floor(i/(sx*sy))]);}
specified.sort(a.comparePosition);
const regionView=inspection({id:'canvas-inspection-region',x0:0,x1:0,cells:specified,bounds:block.box});
inspections.regionView=regionView;
function region(brief,intent=brief,origin=null){
 const q=clone(pr);if(origin){q.proposal.block.origin=origin;}
 setOpt(q.referenceBrief.controls,'placement',brief);q.referenceBriefDigest=D('reference-brief',q.referenceBrief);
 q.intent.referenceBriefDigest=q.referenceBriefDigest;setOpt(q.intent.confirmedIntent,'placement',intent);q.intentDigest=D('intent',q.intent);
 return q;
}
placements.regionExact=a.createPlacementProposal(regionView,exact(specified));
placements.regionExtent=a.createPlacementProposal(regionView,{kind:'ANCHORED_EXTENT',bounds:block.box});
placements.regionExtentShort=a.createPlacementProposal(regionView,{kind:'ANCHORED_EXTENT',bounds:{min:block.box.min,max:[block.box.max[0]-1,block.box.max[1],block.box.max[2]]}});
const shifted=[pr.proposal.block.origin[0]+1,...pr.proposal.block.origin.slice(1)];
const regionCases={accept:[{title:'region: specified cells are exactly the confirmed cells',request:region(placements.regionExact)},{title:'region: block inside the confirmed extent',request:region(placements.regionExtent)}],
 reject:[{title:'region: the same block one cell east of the confirmed cells',request:region(placements.regionExact,placements.regionExact,shifted),error:failure('PLACEMENT_TARGET_MISMATCH')},
  {title:'region: specified cells leave the confirmed extent',request:region(placements.regionExtentShort),error:failure('PLACEMENT_TARGET_MISMATCH')},
  {title:'region: brief and confirmed intent placements differ',request:region(placements.regionExact,null),error:failure('PLACEMENT_BINDING_CHANGED')}]};
for(const c of regionCases.accept)a.validateRegionProposalRequest(c.request);
for(const c of regionCases.reject)expectError(()=>a.validateRegionProposalRequest(c.request));

// --- canvas-region/v2 ApplyRegionCommit: Canvas checks before any snapshot or Adapter WriteRegion.
// Brush compilation here is the public expand/encode split per mapblock (as the region fixture does).
function compileRegion(blockInput){
 const e=a.expandRegionBlock(blockInput),{min}=e.box,[sx,sy]=[0,1].map(k=>e.box.max[k]-min[k]+1);
 return a.regionChunksOfBox(e.box).map(({chunkPos,box})=>{const size=[0,1,2].map(k=>box.max[k]-box.min[k]+1),indices=[];
  for(let z=box.min[2];z<=box.max[2];z++)for(let y=box.min[1];y<=box.max[1];y++)for(let x=box.min[0];x<=box.max[0];x++)indices.push(e.indices[(x-min[0])+sx*((y-min[1])+sy*(z-min[2]))]);
  return indices.some(v=>v!==-1)?{chunkPos,block:a.encodeRegionBlock({origin:box.min,size,palette:e.palette,indices})}:null;}).filter(Boolean);
}
function commit(blockInput,binding){const c=clone(regionFx.commitRequest);c.operations.chunks=compileRegion(blockInput);c.operationDigest=D('region-operations',c.operations);setOpt(c,'confirmedPlacement',binding);return c;}
const regionA=regionCases.accept[0].request,regionExtent=regionCases.accept[1].request,regionNone=region(null);
const bindA=a.confirmedPlacementBinding(regionA.intent),bindExtent=a.confirmedPlacementBinding(regionExtent.intent),bindShort=a.confirmedPlacementBinding(region(placements.regionExtentShort).intent);
const blockA=pr.proposal.block,blockB={...clone(blockA),origin:shifted};
const blockFewer=(()=>{const e=a.expandRegionBlock(blockA);const idx=Array.from(e.indices);idx[idx.findIndex(v=>v!==-1)]=-1;return a.encodeRegionBlock({origin:blockA.origin,size:blockA.size,palette:e.palette,indices:idx});})();
inspections.regionViewB=inspection({id:'canvas-inspection-region-b',x0:0,x1:0,cells:specified,bounds:block.box,worldRef:'fixture-world-b'});
placements.regionExactWorldB=a.createPlacementProposal(inspections.regionViewB,exact(specified));
const bindWorldB=(()=>{const q=region(placements.regionExactWorldB);return a.confirmedPlacementBinding(q.intent);})();
const canvasRegion={
 accept:[
  {title:'canvas-region: confirmed A, commit writes exactly A on the recorded source inspection at the current revision',intent:regionA.intent,brief:regionA.referenceBrief,commit:commit(blockA,bindA),recordedInspection:'regionView',currentWorldRevision:'fixture-world-10'},
  {title:'canvas-region: confirmed extent, commit inside it',intent:regionExtent.intent,brief:regionExtent.referenceBrief,commit:commit(blockA,bindExtent),recordedInspection:'regionView',currentWorldRevision:'fixture-world-10'},
  {title:'canvas-region: no placement confirmed and none sent (normal region behaviour unchanged)',intent:regionNone.intent,brief:regionNone.referenceBrief,commit:commit(blockA,null),recordedInspection:'regionView',currentWorldRevision:'fixture-world-10'}],
 reject:[
  {title:'canvas-region: confirmed A (112 cells), the same block one cell east (B) reaches Canvas (CR-REGION-CONFIRMED-PLACEMENT-01)',intent:regionA.intent,brief:regionA.referenceBrief,commit:commit(blockB,bindA),at:'admission',error:failure('PLACEMENT_TARGET_MISMATCH')},
  {title:'canvas-region: confirmed A, one confirmed cell left out',intent:regionA.intent,brief:regionA.referenceBrief,commit:commit(blockFewer,bindA),at:'admission',error:failure('PLACEMENT_TARGET_MISMATCH')},
  {title:'canvas-region: confirmed extent, the commit leaves it',intent:regionA.intent,brief:regionA.referenceBrief,commit:commit(blockA,bindShort),at:'admission',error:failure('PLACEMENT_TARGET_MISMATCH')},
  {title:'canvas-region: binding placement of another World',intent:regionA.intent,brief:regionA.referenceBrief,commit:commit(blockA,bindWorldB),at:'admission',error:failure('PLACEMENT_WORLD_CHANGED')},
  {title:'canvas-region: placement digest does not match the bound placement',intent:regionA.intent,brief:regionA.referenceBrief,commit:(()=>{const c=commit(blockA,bindA);c.confirmedPlacement.placementDigest='0'.repeat(64);return c;})(),at:'admission',error:failure('PLACEMENT_BINDING_CHANGED')},
  {title:'canvas-region: Canvas has another recorded inspection under that id (source changed)',intent:regionA.intent,brief:regionA.referenceBrief,commit:commit(blockA,bindA),recordedInspection:'view1',currentWorldRevision:'fixture-world-10',at:'canvas',error:failure('PLACEMENT_INSPECTION_CHANGED')},
  {title:'canvas-region: the world revision moved after the proposal',intent:regionA.intent,brief:regionA.referenceBrief,commit:commit(blockA,bindA),recordedInspection:'regionView',currentWorldRevision:'fixture-world-11',at:'canvas',error:failure('PLACEMENT_REVISION_STALE')},
  {title:'Workshop region submission: confirmed A but the commit carries no binding',intent:regionA.intent,brief:regionA.referenceBrief,commit:commit(blockA,null),at:'submission',error:failure('PLACEMENT_BINDING_CHANGED')},
  {title:'Workshop region submission: no placement confirmed but the commit invents one',intent:regionNone.intent,brief:regionNone.referenceBrief,commit:commit(blockA,bindA),at:'submission',error:failure('PLACEMENT_BINDING_CHANGED')}]};
const runRegion=c=>c.at==='admission'?a.validateRegionCommitRequest(c.commit):c.at==='canvas'?a.checkConfirmedRegionPlacementCommit(c.commit,inspections[c.recordedInspection],c.currentWorldRevision):a.validateRegionCommitSubmission(c.intent,c.brief,c.commit);
for(const c of canvasRegion.accept){a.validateRegionCommitSubmission(c.intent,c.brief,c.commit);a.checkConfirmedRegionPlacementCommit(c.commit,inspections[c.recordedInspection],c.currentWorldRevision);}
for(const c of canvasRegion.reject){const e=expectError(()=>runRegion(c));for(const [k,v] of Object.entries(c.error))if(e[k]!==v)throw Error(`${c.title}: ${k}=${e[k]}`);}

// --- painter/v5 CreateBuildPlan (model path): the same binding without a model-supplied proposal.
function plan(r){const q=clone(r);delete q.proposal;q.painterId='picture-blocks';return q;}
function planned(r,boxes){const withBoxes=clone(r);withBoxes.proposal.boxes=boxes.map(([min,max])=>({min,max,materialRef:'stone'}));
 const {response}=respond(withBoxes);return {contractVersion:'painter/v5',requestId:r.requestId,result:response.result,error:null};}
const inspectedOnly=(()=>{const q=plan(perCell({inspection:inspections.view1,brief:A,boxes:[local(0,2)]}));
 Object.assign(q.targetFacts,{source:'INSPECTED',objectRef:'object-1',objectRevision:'object-revision-1'});q.targetFactsDigest=D('target-facts',q.targetFacts);q.regionInspection=null;return q;})();
const createBuildPlan={
 accept:[
  {title:'model plan for confirmed A writes A',request:plan(okA.request),response:planned(okA.request,[local(0,2)])},
  {title:'model plan inside the confirmed extent',request:plan(accepted[1].request),response:planned(accepted[1].request,[local(0,1)])},
  {title:'new proposal B and a new confirmation: the plan writes B',request:plan(accepted[2].request),response:planned(accepted[2].request,[local(0,2)])},
  {title:'no structured placement confirmed: any plan on the current view is unchanged',request:plan(accepted[3].request),response:planned(accepted[3].request,[local(0,1)])},
  {title:'a clarification answering this request',request:plan(okA.request),response:{sessionRef:okA.request.sessionRef,turnRevision:okA.request.turnRevision,invocationId:okA.request.invocationId,clarificationId:'clarification-1',code:'AMBIGUOUS_INTENT',question:'Which side should the door face?'}}],
 reject:[
  {title:'confirmed A; the model plans B',request:plan(okA.request),response:planned(okA.request,[local(3,5)]),at:'response',error:failure('PLACEMENT_TARGET_MISMATCH')},
  {title:'confirmed A; the model plans only part of it',request:plan(okA.request),response:planned(okA.request,[local(0,1)]),at:'response',error:failure('PLACEMENT_TARGET_MISMATCH')},
  {title:'confirmed A; the model plans more than it (A plus a neighbour)',request:plan(okA.request),response:planned(okA.request,[local(0,3)]),at:'response',error:failure('PLACEMENT_TARGET_MISMATCH')},
  {title:'confirmed extent; the plan leaves it',request:plan(accepted[1].request),response:planned(accepted[1].request,[local(0,3)]),at:'response',error:failure('PLACEMENT_TARGET_MISMATCH')},
  {title:'confirmed A; the plan request is made on a new CURRENT_VIEW inspection (before any model call)',request:plan(rejected[3].request),at:'request',error:failure('PLACEMENT_INSPECTION_CHANGED')},
  {title:'confirmed A; the world revision moved',request:plan(rejected[4].request),at:'request',error:failure('PLACEMENT_REVISION_STALE')},
  {title:'confirmed A; the frame changed',request:plan(rejected[5].request),at:'request',error:failure('PLACEMENT_FRAME_CHANGED')},
  {title:'binding missing: brief shows A, the confirmed intent has none',request:plan(rejected[6].request),at:'request',error:failure('PLACEMENT_BINDING_CHANGED')},
  {title:'confirmed A but no region inspection to plan on (object-inspected facts)',request:inspectedOnly,at:'request',error:failure('PLACEMENT_INSPECTION_CHANGED')}]};
for(const c of createBuildPlan.accept)a.validateCreateBuildPlanResponse(c.request,c.response);
for(const c of createBuildPlan.reject){const e=expectError(()=>c.at==='request'?a.validateCreateBuildPlanRequest(c.request):a.validateCreateBuildPlanResponse(c.request,c.response));for(const [k,v] of Object.entries(c.error))if(e[k]!==v)throw Error(`${c.title}: ${k}=${e[k]}`);}

const fixture={profileVersion:'confirmed-placement-fixture/v1',
 evidence:'FIXTURE · confirmed-placement/v1 (hanaworlds-contracts 1.1). Public cases for a structured placement shown before confirmation and bound to the final world effect set. Generated by tools/build-placement-fixture.mjs from the published main/region fixtures; run test/confirmed-placement.mjs against the installed package. SOURCE/FIXTURE only: no model, World, GUI or provider implementation.',
 inspections,placements,proposal,source,perCell:{accept:accepted,reject:rejected},createBuildPlan,canvas,region:regionCases,canvasRegion};
await writeFile('spec/local-world/fixtures/confirmed-placement.json',JSON.stringify(fixture,null,1)+'\n');
console.log('Wrote spec/local-world/fixtures/confirmed-placement.json',canvasRegion.accept.length+canvasRegion.reject.length+createBuildPlan.accept.length+createBuildPlan.reject.length+accepted.length+rejected.length+canvas.accept.length+canvas.reject.length+regionCases.accept.length+regionCases.reject.length,'cases');

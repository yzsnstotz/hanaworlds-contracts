// skill-site-rules/v1 conformance (SOURCE/FIXTURE). SiteRules are skill-proposed and player-confirmed;
// the SafetyProfile is derived only from the confirmed intent; no player geometry is representable;
// unavailable checks are refused by capability name, never ignored. Rule values are test inputs only.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const load=async n=>JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/'+n))));
const fx=await load('skill-site-rules'),main=await load('main'),region=await load('region');
const D=(k,v)=>a.digestValue(k,v).sha256,clone=v=>JSON.parse(JSON.stringify(v)),same=(x,y,m)=>assert.equal(a.canonicalJSON(x),a.canonicalJSON(y),m);
let passed=0;function test(name,fn){fn();console.log('ok',++passed,name)}
const rejects=(fn,error,title)=>assert.throws(fn,e=>{for(const [k,v] of Object.entries(error))assert.equal(e[k],v,`${title}: ${k}`);return true;},title);
const at=(o,path)=>path.split('.').reduce((x,k)=>x[k],o);
// Per-cell request/response with the given confirmed rules, every digest rebound.
function perCell(rules,{entrancePortalRefs=[],tamper=null}={}){
 const r=clone(main.request),resp=clone(main.response);
 r.referenceBrief.controls.siteRules=clone(rules);r.referenceBrief.controls.entrancePortalRefs=entrancePortalRefs;
 r.referenceBriefDigest=D('reference-brief',r.referenceBrief);
 r.intent.referenceBriefDigest=r.referenceBriefDigest;r.intent.confirmedIntent.siteRules=clone(rules);r.intent.confirmedIntent.entrancePortalRefs=entrancePortalRefs;
 r.intentDigest=D('intent',r.intent);
 r.safetyProfile={...clone(a.safetyProfileFromConfirmedIntent(r.intent)),...(tamper??{})};
 r.safetyProfileDigest=D('safety-profile',r.safetyProfile);
 const b=resp.result.build;b.safetyProfileDigest=r.safetyProfileDigest;
 for(const w of b.witnesses){w.safetyProfileDigest=r.safetyProfileDigest;if(w.predicate==='HAZARD')Object.assign(w.facts,{forbidLiquid:r.safetyProfile.hazardPolicy.forbidLiquid,maximumDamagePerSecond:r.safetyProfile.hazardPolicy.maximumDamagePerSecond});}
 if(rules.requireEntranceConnectivity&&rules.entranceClearance){
  const body=b.witnesses.find(w=>w.predicate==='BODY_CLEARANCE');
  b.witnesses.push({witnessId:'w5-doorway',predicate:'ENTRANCE_CONNECTIVITY',finalEffectsDigest:body.finalEffectsDigest,targetFactsDigest:body.targetFactsDigest,safetyProfileDigest:r.safetyProfileDigest,
   facts:{evidence:body.facts.evidence,portalRef:null,usablePositions:body.facts.positions,path:[body.facts.positions[0]],clearance:clone(rules.entranceClearance)}});
  b.witnesses.sort((x,y)=>a.compareUTF16(x.witnessId,y.witnessId));
 }
 resp.result.buildDigest=D('build',b);
 return {r,resp};
}
const rebuild=(r,resp)=>{resp.result.buildDigest=D('build',resp.result.build);return resp;};
test('fixture profile and every rule set decode as SiteRules (open values, no default)',()=>{
 assert.equal(fx.profileVersion,'skill-site-rules/v1');
 for(const rules of Object.values(fx.ruleSets))a.validateType('SiteRules',rules);
 assert.deepEqual(a.schemaBundle.definitions.SiteRules.required,['requireEntranceConnectivity','entranceClearance','hazardPolicy','optionalLightRule']);
 for(const t of ['SiteRules','ClearanceCells','HazardPolicy','LightRule','SafetyProfile']){const s=JSON.stringify(a.schemaBundle.definitions[t]);assert.doesNotMatch(s,/"default"|"enum"/,t);}
});
test('SafetyProfile is derived only from the confirmed intent: invariants fixed, rules copied',()=>{
 for(const name of fx.perCell.accept){const {r}=perCell(fx.ruleSets[name]);const s=a.safetyProfileFromConfirmedIntent(r.intent);
  assert.equal(s.profileVersion,'safety-profile/v4');assert.equal(s.connectivity,6);assert.equal(s.requireBodyClearance,true);
  for(const k of ['requireEntranceConnectivity','hazardPolicy','optionalLightRule'])same(s[k],fx.ruleSets[name][k],name+'.'+k);}
});
test('per-cell: confirmed rule sets pass request and response validation (incl. open hazard and doorway entrance)',()=>{
 for(const name of fx.perCell.accept){const {r,resp}=perCell(fx.ruleSets[name]);a.validateBuildProposalRequest(r);a.validateBuildProposalResponse(r,resp);}
 const {resp}=perCell(fx.ruleSets.entrance);const w=resp.result.build.witnesses.find(x=>x.predicate==='ENTRANCE_CONNECTIVITY');
 assert.equal(w.facts.portalRef,null);same(w.facts.clearance,fx.ruleSets.entrance.entranceClearance);
});
test('per-cell: mismatching, post-confirmation, unsupported or unsatisfiable rules are refused by name',()=>{
 for(const c of fx.perCell.reject){
  let {r}=perCell(fx.ruleSets[c.rules],{entrancePortalRefs:c.entrancePortalRefs??[],tamper:c.tamper});
  if(c.changeAfterConfirmation){Object.assign(r.intent.confirmedIntent.siteRules,c.changeAfterConfirmation);r.safetyProfile=clone(a.safetyProfileFromConfirmedIntent(r.intent));r.safetyProfileDigest=D('safety-profile',r.safetyProfile);}
  rejects(()=>a.validateBuildProposalRequest(r),c.error,c.title);
  if(c.capability){const cap=a.safetyCapabilities.find(x=>x.id===c.capability);assert.ok(cap,c.capability);assert.equal(cap.whenAbsent.code,c.error.code);assert.equal(cap.whenAbsent.reason,c.error.reason);}
 }
});
test('per-cell: stated light rule is refused by witness coherence too (Brush recheck)',()=>{
 const {r,resp}=perCell(fx.ruleSets.light);const b=resp.result.build;
 rejects(()=>a.validateWitnessCoherence({build:b,finalEffects:{profileVersion:'final-effects/v2',frameDigest:r.targetFacts.frameDigest,catalogueDigest:b.catalogueDigest,effects:r.targetFacts.knownEmptyCells.map(position=>({position,...b.materials.stone}))},targetFacts:r.targetFacts,safetyProfile:r.safetyProfile,catalogue:r.catalogue}),{code:'CAPABILITY_UNAVAILABLE',reason:'REQUIRED_FACT_UNKNOWN'},'light at coherence');
});
test('decode: missing or extended SiteRules and any player geometry are rejected',()=>{
 for(const c of fx.perCell.decodeReject){
  const {r}=perCell(fx.ruleSets.strict);const target=at(r,c.path);
  if(c.remove)delete target[c.remove];if(c.set)Object.assign(target,c.set);
  rejects(()=>a.validateBoundRequest('painter/v5','ValidateBuildProposal',r),c.error,c.title);
 }
});
test('witnesses: entrance clearance/portal must match the confirmation; body witness carries no geometry',()=>{
 for(const c of fx.perCell.witnessReject){
  const {r,resp}=perCell(fx.ruleSets[c.rules]);const ws=resp.result.build.witnesses;
  if(c.clearance)ws.find(w=>w.predicate==='ENTRANCE_CONNECTIVITY').facts.clearance=c.clearance;
  if(c.portalRef)ws.find(w=>w.predicate==='ENTRANCE_CONNECTIVITY').facts.portalRef=c.portalRef;
  if(c.bodyExtra)Object.assign(ws.find(w=>w.predicate==='BODY_CLEARANCE').facts,c.bodyExtra);
  rejects(()=>a.validateBuildProposalResponse(r,rebuild(r,resp)),c.error,c.title);
 }
});
test('no contracts type can carry player geometry',()=>{
 const walk=(s,path)=>{if(s&&typeof s==='object'){for(const [k,v] of Object.entries(s.properties??{}))assert.ok(!['avatarDimensions','bodyOccupiedPositions','collisionBox','yaw'].includes(k),path+'.'+k);for(const v of Object.values(s))if(v&&typeof v==='object')walk(v,path);}};
 for(const [n,s] of Object.entries(a.schemaBundle.definitions))walk(s,n);
 assert.ok(!Object.hasOwn(a.schemaBundle.definitions,'AvatarDimensions'));
 assert.match(a.schemaBundle.definitions.ClearanceCells.description,/not a measured/i);
 const av=a.configEngineFacts.avatarDimensions;assert.equal(av.publicSource,'NONE');
});
// Region request with the given confirmed rules (and optionally a damaging palette node), digests rebound.
function regionCase(rules,damage=null){
 const q=clone(region.proposalRequest);q.intent.confirmedIntent.siteRules=clone(rules);q.intentDigest=D('intent',q.intent);
 if(damage!==null){const name=q.proposal.block.palette.find(e=>e.nodeName!=='air').nodeName;q.catalogue.nodes[name].damagePerSecond=damage;q.catalogueDigest=D('catalogue',q.catalogue);}
 return q;
}
test('region: confirmed rules apply; entrance/light refused by name; hazard checked per palette node with open limits',()=>{
 for(const name of fx.region.accept)a.validateRegionProposalRequest(regionCase(fx.ruleSets[name]));
 for(const c of fx.region.reject)rejects(()=>a.validateRegionProposalRequest(regionCase(fx.ruleSets[c.rules],c.damagingPaletteNode??null)),c.error,c.title);
 a.validateRegionProposalRequest(regionCase(fx.ruleSets[fx.region.acceptDamaging.rules],fx.region.acceptDamaging.damagingPaletteNode));
});
const peer=caps=>({profileVersion:'protocol-handshake/v1',component:'fixture-painter',protocols:[{protocol:'painter',major:5,minor:0},{protocol:'painter-region',major:2,minor:0}],capabilities:caps,provenance:{packageName:'fixture-painter',packageVersion:'1.0.0',sourceRevision:null,artifactDigest:null}});
test('site-rule capabilities: light and region entrance are declared once on a current wire with a named absent error',()=>{
 assert.deepEqual(a.safetyCapabilities.map(c=>c.id),fx.capabilities.ids);
 const wires=[...a.contractHandshake.wireVersions,'region-voxels/v1'];
 for(const c of a.safetyCapabilities){assert.ok(wires.includes(c.id.split(':')[0]),c.id);same(c.whenAbsent,fx.capabilities.absentError,c.id);assert.ok(c.cause.length>0);}
 assert.deepEqual(a.unmetSafetyCapabilities(peer([]),fx.capabilities.ids).map(u=>u.id),fx.capabilities.ids);
 rejects(()=>a.requireSafetyCapabilities(peer([]),['painter/v5:light-rule']),{code:'CAPABILITY_UNAVAILABLE',reason:'REQUIRED_FACT_UNKNOWN'},'light absent');
});
const G=fx.engineGuards;
test('engine guards: the declaration states per-stage coverage; partial coverage is never "available"',()=>{
 a.validateType('EngineGuardDeclaration',G.declaration);
 const caps={providerRef:'adapter',capabilityRevision:'cap-1',worldRef:'w',engineBounds:null,limits:[],recoveryGuarantee:null,stateProfile:null,sessionDeleteSupported:false,imageMediaTypes:[],model:null,engineGuards:G.declaration};
 a.validateType('PublicCapabilities',caps);a.validateType('PublicCapabilities',{...caps,engineGuards:null});
 assert.deepEqual([...a.unmetEngineGuards(G.declaration,G.covered)],[]);
 a.requireEngineGuards(G.declaration,G.covered);
 const unmet=a.unmetEngineGuards(G.declaration,G.uncovered);
 same(unmet,G.uncovered.map(({guard,stage})=>({guard,stage,finding:'GUARD_UNAVAILABLE'})),'uncovered named');
 for(const r of G.uncovered)rejects(()=>a.requireEngineGuards(G.declaration,[r]),{code:'CAPABILITY_UNAVAILABLE',phase:'validate',reason:'REQUIRED_FACT_UNKNOWN'},r.guard+'@'+r.stage);
 assert.equal(a.unmetEngineGuards(null,G.covered).length,G.covered.length);
 assert.match(a.schemaBundle.definitions.ProtectionPrincipal.description,/not acting-principal protection/);
 assert.deepEqual(a.engineGuards.stages.map(s=>s.stage),a.schemaBundle.definitions.EngineGuardStage.enum);
 for(const s of a.engineGuards.stages)assert.ok(a.operationContracts[s.wire].some(o=>o.operation===s.operation),s.stage);
});
test('engine guards: malformed or dishonest declarations are rejected',()=>{
 for(const c of G.declarationReject){const d=clone(G.declaration);
  if(c.coverage)d.coverage=c.coverage.map(i=>clone(G.declaration.coverage[i]));
  if(c.patch){const {index,...rest}=c.patch;Object.assign(d.coverage[index],rest);}
  assert.throws(()=>a.validateType('EngineGuardDeclaration',d),{code:'SCHEMA_INVALID'},c.title);}
});
test('engine guards: BODY_OCCUPIED, PROTECTED_CELL, PLAYER_ENCLOSED and RESTORE_GUARD_UNAVAILABLE are distinct public refusals with exact errors',()=>{
 const keys=new Set();
 for(const n of G.named){a.validateType('GuardRefusal',n.refusal);same(a.guardRefusalError(n.refusal,{cause:n.cause??null}),{...n.error,transactionRef:null},n.name);keys.add(a.canonicalJSON(n.refusal));}
 assert.equal(keys.size,G.named.length);
 same(a.guardRefusalError({guard:'PLAYER_ENCLOSURE',stage:'REGION_APPLY',finding:'GUARD_UNAVAILABLE'},{preflight:true}),{...G.preflightError,transactionRef:null},'preflight');
 same(a.guardRefusalError({guard:'BODY_CLEARANCE',stage:'RESTORE',finding:'BODY_OCCUPIED'}),{code:'SAFETY_INVARIANT_FAILED',phase:'restore',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason:'INVALID_GEOMETRY'},'restore without cause = engine form');
 for(const c of G.refusalReject)assert.throws(()=>a.validateType('GuardRefusal',c.refusal),{code:'SCHEMA_INVALID'},c.title);
});
const envelope=(type,wire,refusal,error)=>({contractVersion:wire,requestId:'r-1',result:null,error,guardRefusal:refusal,...(type.endsWith('RegionCommitResponse')?{applyFailure:null}:{})});
test('engine guards: a guard refusal travels beside the error it explains, on every guarded response',()=>{
 const named=Object.fromEntries(G.named.map(n=>[n.name,n]));
 const cases=[['ScopedApplyResponse','world-adapter/v7','BODY_OCCUPIED'],['ScopedPrepareResponse','world-adapter/v7','PLAYER_ENCLOSED'],['WriteRegionResponse','world-adapter-region/v2','PROTECTED_CELL'],
  ['RestoreTransactionResponse','world-adapter/v7','RESTORE_GUARD_UNAVAILABLE'],['ApplyRegionCommitResponse','canvas-region/v2','PROTECTED_CELL']];
 for(const [type,wire,name] of cases){const n=named[name],err={...n.error,transactionRef:null};
  a.validateType(type,envelope(type,wire,n.refusal,err));
  assert.throws(()=>a.validateType(type,envelope(type,wire,n.refusal,null)),{code:'SCHEMA_INVALID'},type+' refusal without error');
  assert.throws(()=>a.validateType(type,envelope(type,wire,n.refusal,{...err,reason:'PAYLOAD_CHANGED'})),{code:'SCHEMA_INVALID'},type+' error not matching refusal');}
 const pre={guard:'PLAYER_ENCLOSURE',stage:'REGION_APPLY',finding:'GUARD_UNAVAILABLE'};
 a.validateType('WriteRegionResponse',envelope('WriteRegionResponse','world-adapter-region/v2',pre,{...G.preflightError,transactionRef:null}));
 a.validateType('ScopedApplyResponse',envelope('ScopedApplyResponse','world-adapter/v7',null,{...G.preflightError,transactionRef:null}));
});
function restoreFailedReceipt(){
 const R=G.restoreFailedReceipt,applyError=a.guardRefusalError(R.applyRefusal,{transactionRef:'transaction-1'});
 return {contractVersion:'canvas/v6',transactionId:'transaction-1',operationDigest:'1'.repeat(64),transactionPayloadDigest:'2'.repeat(64),status:'RESTORE_FAILED',previousWorldRevision:'world-1',observedWorldRevision:null,readbackDigest:null,restoreStatus:R.restoreStatus,
  error:clone(a.guardRefusalError(R.restoreRefusal,{transactionRef:'transaction-1',cause:applyError.code})),localContext:main.request.localContext,guardRefusal:clone(R.restoreRefusal),applyFailure:{error:clone(applyError),guardRefusal:clone(R.applyRefusal)}};
}
test('G1: a refused restore keeps both causes and stays pending manual recovery',()=>{
 const receipt=restoreFailedReceipt();a.validateType('ReceiptProjection',receipt);
 assert.equal(receipt.applyFailure.guardRefusal.finding,'PLAYER_ENCLOSED');assert.equal(receipt.guardRefusal.finding,'BODY_OCCUPIED');assert.equal(receipt.error.causeCode,receipt.applyFailure.error.code);
 for(const c of G.restoreFailedReceiptReject){const bad=restoreFailedReceipt();
  if(c.drop)bad[c.drop]=null;if(c.causeCode)bad.error.causeCode=c.causeCode;if(c.restoreStatus)bad.restoreStatus=c.restoreStatus;if(c.retryability)bad.error.retryability=c.retryability;
  if(c.status){bad.status=c.status;bad.restoreStatus='VERIFIED_RESTORED';bad.readbackDigest='3'.repeat(64);bad.observedWorldRevision='world-2';}
  assert.throws(()=>a.validateType('ReceiptProjection',bad),{code:'SCHEMA_INVALID'},c.title);}
});
test('region: a refused region restore keeps the causing failure in applyFailure',()=>{
 const applyRefusal={guard:'CELL_PROTECTION',stage:'REGION_APPLY',finding:'PROTECTED_CELL'},restoreRefusal={guard:'BODY_CLEARANCE',stage:'REGION_RESTORE',finding:'BODY_OCCUPIED'};
 const applyError=clone(a.guardRefusalError(applyRefusal));
 const res={contractVersion:'canvas-region/v2',requestId:'r-1',result:null,error:clone(a.guardRefusalError(restoreRefusal,{cause:applyError.code})),guardRefusal:restoreRefusal,applyFailure:{error:applyError,guardRefusal:applyRefusal}};
 a.validateType('ApplyRegionCommitResponse',res);
 assert.throws(()=>a.validateType('ApplyRegionCommitResponse',{...res,applyFailure:{...res.applyFailure,error:{...applyError,code:'READBACK_MISMATCH'}}}),{code:'SCHEMA_INVALID'},'applyFailure must match its refusal and the causeCode');
});
test('REGION_RESTORE: the engine reports a refused restore without a cause; Canvas turns a rollback into a pending RESTORE_FAILED and passes an Undo refusal through',()=>{
 const R=G.regionRestore;
 for(const c of R.engine){same(a.guardRefusalError(c.refusal),{...c.error,transactionRef:null},c.name);
  a.validateType('WriteRegionResponse',envelope('WriteRegionResponse','world-adapter-region/v2',c.refusal,{...c.error,transactionRef:null}));
  a.validateType('UndoRegionCommitResponse',envelope('UndoRegionCommitResponse','canvas-region/v2',c.refusal,{...c.error,transactionRef:null}));}
 for(const c of R.reject){const bad={...R.engine[0].error,transactionRef:null,...Object.fromEntries(['mutationState','retryability','reason'].filter(k=>c[k]).map(k=>[k,c[k]]))};
  assert.throws(()=>a.validateType('WriteRegionResponse',envelope('WriteRegionResponse','world-adapter-region/v2',R.engine[0].refusal,bad)),{code:'SCHEMA_INVALID'},c.title);}
 // Rollback after a refused region apply: Canvas wraps the engine refusal into the transaction form.
 const applyError=clone(a.guardRefusalError(R.rollbackApplyRefusal)),restoreRefusal=R.engine[0].refusal;
 const rollback={contractVersion:'canvas-region/v2',requestId:'r-1',result:null,error:clone(a.guardRefusalError(restoreRefusal,{cause:applyError.code})),guardRefusal:restoreRefusal,applyFailure:{error:applyError,guardRefusal:R.rollbackApplyRefusal}};
 a.validateType('ApplyRegionCommitResponse',rollback);
 assert.throws(()=>a.validateType('ApplyRegionCommitResponse',{...rollback,error:{...R.engine[0].error,transactionRef:null}}),{code:'SCHEMA_INVALID'},'a rollback with applyFailure must use the pending transaction form');
 // A per-cell RESTORE_FAILED receipt never carries the engine form.
 const receipt=restoreFailedReceipt();receipt.error={...a.guardRefusalError(receipt.guardRefusal),transactionRef:'transaction-1'};
 assert.throws(()=>a.validateType('ReceiptProjection',receipt),{code:'SCHEMA_INVALID'},'receipt with engine-form restore error');
});
test('relay closure: exactly the declared public responses carry guardRefusal, and each relays a refusal with its exact error',()=>{
 const R=G.relay,declared=new Set(R.responses.map(([,,type])=>type));
 const actual=new Set();for(const [wire,ops] of Object.entries(a.operationContracts))for(const o of ops){const t=a.schemaBundle.definitions[o.response];if(t.properties?.guardRefusal)actual.add(o.response);}
 assert.deepEqual([...actual].sort(),[...declared].sort(),'guarded response closure');
 for(const [wire,op,type] of R.responses){assert.ok(a.operationContracts[wire].some(o=>o.operation===op&&o.response===type),wire+' '+op);
  assert.deepEqual(a.schemaBundle.definitions[type].properties.guardRefusal,{anyOf:[{$ref:'#/definitions/GuardRefusal'},{type:'null'}]},type);}
 for(const [wire,,type] of R.responses){const base={contractVersion:wire,requestId:'r-1',result:null,...(type.endsWith('RegionCommitResponse')?{applyFailure:null}:{}),...(type==='PlacementRegionInspection'?{unavailableSettings:null}:{})};
  for(const c of R.cases){const err={...a.guardRefusalError(c.refusal,{preflight:c.preflight}),transactionRef:null};
   a.validateType(type,{...base,error:err,guardRefusal:c.refusal});
   assert.throws(()=>a.validateType(type,{...base,error:null,guardRefusal:c.refusal}),{code:'SCHEMA_INVALID'},type+': refusal without error');
   assert.throws(()=>a.validateType(type,{...base,error:{...err,reason:'PAYLOAD_CHANGED'},guardRefusal:c.refusal}),{code:'SCHEMA_INVALID'},type+': error not explained by the refusal');}
  a.validateType(type,{...base,error:{code:'TRANSACTION_CONFLICT',phase:'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason:'PAYLOAD_CHANGED'},guardRefusal:null});
  assert.throws(()=>a.validateType(type,{...base,error:null}),{code:'SCHEMA_INVALID'},type+': guardRefusal is a required key');
 }
});
test('0.x peers are not compatible with this major (no migration)',()=>{
 for(const v of ['0.5.6','0.5.5-rc.1'])rejects(()=>a.checkContractHandshake({...a.contractHandshake,contracts:'hanaworlds-contracts@'+v}),{code:'UNSUPPORTED_VERSION',reason:'VERSION_UNSUPPORTED'},v);
});
console.log(JSON.stringify({evidence:'SOURCE/FIXTURE',checks:passed,worldWrites:0,realRuntime:'NOT_RUN',realUI:'NOT_RUN'}));

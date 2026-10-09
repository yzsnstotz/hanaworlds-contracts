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
const peer=caps=>({profileVersion:'protocol-handshake/v1',component:'fixture-adapter',protocols:[{protocol:'world-adapter',major:7,minor:0},{protocol:'world-adapter-region',major:1,minor:1}],capabilities:caps,provenance:{packageName:'fixture-adapter',packageVersion:'1.0.0',sourceRevision:null,artifactDigest:null}});
test('capabilities: every id is declared once, scoped to a current wire, with a named absent error',()=>{
 assert.deepEqual(a.safetyCapabilities.map(c=>c.id),fx.capabilities.ids);
 const wires=[...a.contractHandshake.wireVersions,'region-voxels/v1'];
 for(const c of a.safetyCapabilities){assert.ok(wires.includes(c.id.split(':')[0]),c.id);same(c.whenAbsent,fx.capabilities.absentError,c.id);assert.ok(c.cause.length>0);
  a.validateType('ErrorCode',c.whenAbsent.code);a.validateType('ErrorReason',c.whenAbsent.reason);}
});
test('G1-G3: missing engine capabilities are named; present ones pass',()=>{
 const unmet=a.unmetSafetyCapabilities(peer([]),fx.capabilities.engineIds);
 assert.deepEqual(unmet.map(u=>u.id),fx.capabilities.engineIds);for(const u of unmet)assert.ok(['RESTORE_BODY_RECHECK_UNAVAILABLE','CELL_PROTECTION_UNCHECKED','BODY_ENCLOSURE_UNCHECKED'].includes(u.cause),u.id);
 rejects(()=>a.requireSafetyCapabilities(peer(['world-adapter/v7:restore-body-recheck']),fx.capabilities.engineIds),{code:'CAPABILITY_UNAVAILABLE',reason:'REQUIRED_FACT_UNKNOWN'},'partial');
 assert.deepEqual([...a.requireSafetyCapabilities(peer([...fx.capabilities.engineIds].sort(a.compareUTF16)),fx.capabilities.engineIds)],fx.capabilities.engineIds);
 assert.throws(()=>a.unmetSafetyCapabilities(peer([]),['world-adapter/v7:unknown']),/unknown safety capability/);
});
test('G1-G3: failed engine checks have exact public errors; a body-blocked restore stays pending manual recovery',()=>{
 for(const [id,e] of Object.entries(fx.capabilities.failures))same(a.safetyCheckFailure(id,'tx-1'),{...e,transactionRef:'tx-1'},id);
 const error=a.safetyCheckFailure('world-adapter/v7:restore-body-recheck','transaction-1');
 const receipt={contractVersion:'canvas/v6',transactionId:'transaction-1',operationDigest:'1'.repeat(64),transactionPayloadDigest:'2'.repeat(64),status:fx.capabilities.restoreBlockedReceipt.status,previousWorldRevision:'world-1',observedWorldRevision:null,readbackDigest:null,restoreStatus:fx.capabilities.restoreBlockedReceipt.restoreStatus,error,localContext:main.request.localContext};
 a.validateType('ReceiptProjection',receipt);
 for(const c of fx.capabilities.restoreBlockedReceiptReject){const bad=clone(receipt);if(c.restoreStatus)bad.restoreStatus=c.restoreStatus;if(c.retryability)bad.error={...bad.error,retryability:c.retryability};assert.throws(()=>a.validateType('ReceiptProjection',bad),{code:'SCHEMA_INVALID'},c.title);}
});
test('0.x peers are not compatible with this major (no migration)',()=>{
 for(const v of ['0.5.6','0.5.5-rc.1'])rejects(()=>a.checkContractHandshake({...a.contractHandshake,contracts:'hanaworlds-contracts@'+v}),{code:'UNSUPPORTED_VERSION',reason:'VERSION_UNSUPPORTED'},v);
});
console.log(JSON.stringify({evidence:'SOURCE/FIXTURE',checks:passed,worldWrites:0,realRuntime:'NOT_RUN',realUI:'NOT_RUN'}));

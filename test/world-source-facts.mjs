// world-source-facts/v1 conformance (SOURCE/FIXTURE). Both sides run this against the exact installed package:
// the world source and host bridge for what they may answer, Canvas/Workshop/bridge for what they must refuse.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const fx=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/world-source-facts'))));
const main=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/main'))));
const profile=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/profile'))));
const catalogue=main.request.catalogue,connection=fx.connection;
let passed=0;function test(name,fn){fn();console.log('ok',++passed,name)}
const rejects=(fn,want,title)=>assert.throws(fn,e=>{assert.deepEqual({code:e.code,reason:e.reason},want,title);return true;},title);
const run={
 validateCatalogueFacts:v=>a.validateCatalogueFacts(v,connection),
 validateMaterialSourceFacts:v=>a.validateMaterialSourceFacts(v,catalogue,connection),
 validateEngineFacts:v=>a.validateEngineFacts(v,connection),
 validateWriteProfile:v=>a.validateWriteProfile(v,catalogue,connection),
 validateWorldSourceCapabilities:v=>a.validateWorldSourceCapabilities(v,catalogue,connection),
 requireWriteProfileConfig:v=>a.requireWriteProfileConfig(v),
 requireDeclaredAvatarEnvelope:v=>a.requireDeclaredAvatarEnvelope(v)
};
const resultCheck={CatalogueFacts:'validateCatalogueFacts',MaterialSourceFacts:'validateMaterialSourceFacts',EngineFacts:'validateEngineFacts',WriteProfile:'validateWriteProfile',WorldSourceCapabilities:'validateWorldSourceCapabilities'};
const ops=fx.exchanges.map(x=>x.wire+' '+x.operation);
test('named operations exist on their wires with the baseline errors (C-world-facts, C-world-adapter, C-world-inspection)',()=>{
 const names=w=>a.operationContracts[w].map(o=>o.operation);
 assert.deepEqual(names('world-facts/v1'),['ReadCatalogue','ReadMaterialSources','ReadEngineFacts','ReadWriteProfile']);
 assert.deepEqual(names('world-inspection/v1'),['ReadInspectionContext']);
 assert.equal(names('world-adapter/v8').at(-1),'ReadWorldSourceCapabilities');
 const expected={ReadCatalogue:['ADAPTER_UNAVAILABLE','WORLD_NOT_BOUND'],ReadMaterialSources:['CAPABILITY_UNAVAILABLE'],ReadEngineFacts:['ADAPTER_UNAVAILABLE'],ReadWriteProfile:['ADAPTER_UNAVAILABLE','CAPABILITY_UNAVAILABLE'],ReadWorldSourceCapabilities:['ADAPTER_UNAVAILABLE'],ReadInspectionContext:['WORLD_NOT_BOUND','SESSION_NOT_FOUND']};
 assert.deepEqual(Object.fromEntries(a.worldSourceFacts.operations.map(o=>[o.operation,o.errors])),expected);
 for(const o of a.worldSourceFacts.operations){for(const c of o.errors)a.validateType('ErrorCode',c);assert.ok(a.operationContracts[o.wire].some(x=>x.operation===o.operation&&x.response===o.operation+'Response'));}
 for(const op of Object.keys(expected))assert.ok(ops.some(x=>x.endsWith(' '+op)),'example for '+op);
});
test('additive minor: protocol minors, ownership and the 2.0 handshake stay accepted',()=>{
 assert.match(a.version,/^2\./);assert.equal(a.contractsCompatibility.major,2);
 const minor=p=>a.contractProtocols.find(x=>x.protocol===p);
 assert.ok(minor('world-adapter').minor>=1);assert.deepEqual([minor('world-facts').major,minor('world-inspection').major],[1,1]);
 assert.deepEqual({...a.minorWires},{'world-facts/v1':'2.1.0','world-inspection/v1':'2.1.0'});
 for(const w of Object.keys(a.minorWires))assert.ok(a.contractHandshake.wireVersions.includes(w));
 // A 2.0.0 peer advertises neither added wire: still the same major, still accepted by default.
 const peer20={...a.contractHandshake,contracts:'hanaworlds-contracts@2.0.0',wireVersions:a.contractHandshake.wireVersions.filter(w=>!Object.hasOwn(a.minorWires,w))};
 assert.equal(a.checkContractHandshake(peer20).result,'HANDSHAKE_VERSION_MATCH');
 // A caller that relies on an added wire requires it explicitly.
 rejects(()=>a.checkContractHandshake(peer20,{wires:['world-facts/v1'],factProfiles:['target-facts/v5']}),{code:'UNSUPPORTED_VERSION',reason:'VERSION_UNSUPPORTED'});
 assert.equal(a.checkContractHandshake(a.contractHandshake,{wires:['world-facts/v1','world-inspection/v1'],factProfiles:['target-facts/v5']}).result,'HANDSHAKE_VERSION_MATCH');
 assert.equal(a.ownership['world-facts/v1'].mutationCaller,'none');assert.equal(a.ownership['world-inspection/v1'].mutationCaller,'none');
 assert.equal(profile.worldSourceFacts.id,'world-source-facts/v1');
 const peer={profileVersion:'protocol-handshake/v1',component:'fixture-world-source',protocols:a.contractProtocols,capabilities:[],provenance:{packageName:'fixture-world-source',packageVersion:'2.1.0',sourceRevision:'fixture-revision',artifactDigest:'0'.repeat(64)}};
 const required=['world-facts/v1','world-inspection/v1'].map(w=>a.protocolRequirement(w));
 required.push(a.protocolRequirement('world-adapter/v8',[],1));
 required.sort((x,y)=>a.compareUTF16(x.protocol,y.protocol));
 assert.equal(a.checkProtocolCompatibility(peer,required).result,'PROTOCOL_COMPATIBLE');
 rejects(()=>a.checkProtocolCompatibility({...peer,protocols:peer.protocols.map(p=>p.protocol==='world-adapter'?{...p,minor:0}:p)},required),{code:'UNSUPPORTED_VERSION',reason:'VERSION_UNSUPPORTED'});
});
test('replaced shapes stay unchanged in this major (config-engine-facts/v2, Catalogue)',()=>{
 const d=a.schemaBundle.definitions;
 assert.deepEqual(Object.keys(d.ConfigEngineFacts.properties),['profileVersion','connection','catalogueDigest','avatarEnvelope','writeBackend','sourceRevision']);
 assert.equal(a.canonicalJSON(d.AvatarEnvelopeFact.properties),a.canonicalJSON({availability:{const:'UNAVAILABLE'},reason:{const:'NO_PUBLIC_SOURCE'}}));
 assert.equal(a.configEngineFacts.id,'config-engine-facts/v2');
 assert.deepEqual(d.SafetyProfile.required,['profileVersion','connectivity','requireBodyClearance','requireEntranceConnectivity','hazardPolicy','optionalLightRule']);
});
test('every example exchange decodes, binds to its request and passes its consumer check',()=>{
 for(const x of fx.exchanges){
  const r=a.validateBoundResponse(x.wire,x.operation,x.request,x.response);
  assert.ok(Object.isFrozen(r),x.title);
  if(r.result===null)continue;
  const resultType=a.schemaBundle.definitions[x.operation+'Response'].properties.result.anyOf[0].$ref.split('/').at(-1);
  if(resultType==='InspectionContext')a.validateInspectionContextResponse(x.request,x.response);
  else run[resultCheck[resultType]](r.result);
 }
});
test('no engine vocabulary, no player pose or identity in the added types',()=>{
 const d=a.schemaBundle.definitions,added=['SrgbColor','MaterialPresentation','OrientationDescriptor','WriteMethods','EngineFrame','AvatarSize','KnownAvatarEnvelope','AvatarEnvelope','SideEffectConclusion','WritePathConclusions','CatalogueFacts','MaterialSourceFacts','EngineFacts','WriteProfile','WorldSourceCapabilities','InspectionContext'];
 for(const t of added){const s=JSON.stringify(d[t]);assert.ok(s,t);
  assert.doesNotMatch(s,/nodeName|param[12]|worldedit|luanti|mapblock|voxelmanip|after_place_node|on_construct|on_timer/i,t);
  assert.doesNotMatch(JSON.stringify(d[t].properties??{}),/position|yaw|posture|player|collision/i,t);
  if(d[t].type==='object'&&d[t].properties)assert.equal(d[t].additionalProperties,false,t);}
 assert.deepEqual(Object.keys(d.KnownAvatarEnvelope.properties),['availability','basis','size']);
 assert.deepEqual(Object.keys(d.WorldSourceCapabilities.properties),['profileVersion','owner','connection','capabilityRevision','catalogueDigest','worldGeometry','engineBounds','stateProfile','writeBackend','compilationConfig','writeMethods','writePath','engineGuards','avatarEnvelope']);
 assert.equal(d.WorldSourceCapabilities.properties.owner.const,'world-source');
});
test('provider: every inconsistent or leaking value is refused by its type',()=>{
 for(const c of fx.provider.invalid)rejects(()=>a.validateType(c.type,c.value),c.expect,c.title);
});
test('consumer: facts of another connection or Catalogue, and unclean placeable materials, are refused by name',()=>{
 for(const c of fx.consumer.bind)rejects(()=>run[c.check](c.value),c.expect,c.title);
});
test('consumer: configuration and body envelope are forwarded unchanged or refused, never defaulted',()=>{
 for(const c of fx.consumer.require){
  if(Object.hasOwn(c.expect,'code'))rejects(()=>run[c.check](c.value),c.expect,c.title);
  else assert.equal(a.canonicalJSON(run[c.check](c.value)),a.canonicalJSON(c.expect),c.title);
 }
});
test('inspection context answers only for the session and World asked',()=>{
 for(const c of fx.consumer.inspection)rejects(()=>a.validateInspectionContextResponse(c.request,c.response),c.expect,c.title);
});
console.log(JSON.stringify({evidence:'SOURCE/FIXTURE',suite:'world-source-facts',checks:passed,worldWrites:0,providerImplementations:'NOT_RUN',realRuntime:'NOT_RUN'}));

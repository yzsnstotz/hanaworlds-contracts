// config-engine-facts/v1 conformance (SOURCE/FIXTURE). Both sides run this against the exact installed
// package: the Adapter for what it may emit, Canvas for what it may assemble. Not provider behaviour.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const fx=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/config-engine-facts'))));
const main=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/main'))));
const profile=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/profile'))));
const catalogue=main.request.catalogue;
let passed=0;function test(name,fn){fn();console.log('ok',++passed,name)}
const code=e=>({code:e.code,reason:e.reason});
test('exact candidate package; facts are an in-process port, not a wire or a changed type',()=>{
 assert.equal(a.version,'0.5.5-rc.1');a.checkContractHandshake(a.contractHandshake);
 assert.equal(a.configEngineFacts.id,'config-engine-facts/v1');
 assert.equal(profile.configEngineFacts.id,'config-engine-facts/v1');
 for(const ops of Object.values(a.operationContracts))for(const o of ops)assert.ok(!/ConfigEngineFacts/.test(o.operation));
 assert.deepEqual(a.schemaBundle.definitions.SafetyProfile.required,['profileVersion','avatarDimensions','connectivity','requireBodyClearance','requireEntranceConnectivity','hazardPolicy','optionalLightRule']);
 assert.equal(a.schemaBundle.definitions.CompilationConfig.properties.backendProfileId.$ref,'#/definitions/Ref');
 assert.equal(a.digestProfile.domainPrefixByKind['config-engine-facts'],'HanaWorlds|config-engine-facts/v1|');
});
test('size-only envelope: the schema admits no position, yaw, raw box, offset or identity',()=>{
 const d=a.schemaBundle.definitions;
 assert.deepEqual(Object.keys(d.KnownAvatarEnvelope.properties),['availability','basis','dimensions']);
 assert.deepEqual(Object.keys(d.AvatarDimensions.properties),['width','height','depth','unit']);
 assert.deepEqual(Object.keys(d.ConfigEngineFacts.properties),['profileVersion','connection','catalogueDigest','avatarEnvelope','writeBackend','sourceRevision']);
 for(const t of ['KnownAvatarEnvelope','UnavailableAvatarEnvelope','KnownWriteBackend','UnavailableWriteBackend','ConfigEngineFacts'])assert.equal(d[t].additionalProperties,false,t);
});
test('provider: valid facts bind fresh Catalogue and current connection',()=>{
 for(const c of fx.provider.valid){const v=a.validateConfigEngineFacts(c.facts,catalogue,fx.connection);assert.ok(Object.isFrozen(v),c.title);assert.equal(v.sourceRevision,c.facts.sourceRevision);}
});
test('provider: every leak or inconsistency is rejected with its named error',()=>{
 for(const c of fx.provider.invalid)assert.throws(()=>a.validateConfigEngineFacts(c.facts,catalogue,fx.connection),e=>{assert.deepEqual(code(e),c.expect,c.title);return true;});
});
test('consumer: KNOWN assembles, UNAVAILABLE refuses without a value',()=>{
 for(const c of fx.consumer.assemble){
  for(const [field,fn] of [['avatarDimensions',a.requireKnownAvatarEnvelope],['backendProfileId',a.requireKnownWriteBackend]]){
   const want=c[field];
   if(typeof want==='object'&&'code' in want)assert.throws(()=>fn(c.facts),e=>{assert.deepEqual(code(e),want,c.title);return true;});
   else assert.equal(a.canonicalJSON(fn(c.facts)),a.canonicalJSON(want),c.title);
  }
 }
});
test('consumer: assembled values satisfy the unchanged SafetyProfile and CompilationConfig shapes',()=>{
 const known=fx.consumer.assemble[0];
 const safety={...main.request.safetyProfile,avatarDimensions:a.requireKnownAvatarEnvelope(known.facts)};
 a.validateType('SafetyProfile',safety);
 const config={profileVersion:'compilation-config/v2',backendProfileId:a.requireKnownWriteBackend(known.facts),worldeditRevision:'fixture-worldedit-revision',nodeWriteSemantics:known.facts.writeBackend.nodeWriteSemantics,overlapRule:'last-writer-wins',effectOrder:'numeric-x-y-z',compressionRule:'exact-final-effects-only'};
 a.validateType('CompilationConfig',config);
});
test('lifecycle: changed envelope invalidates, reconnect rejects the previous incarnation facts',()=>{
 for(const c of fx.consumer.lifecycle){
  const cur=a.validateConfigEngineFacts(c.current,catalogue,c.currentConnection);
  if('previousStillCurrent' in c)assert.equal(cur.sourceRevision===c.previous.sourceRevision,c.previousStillCurrent,c.title);
  if(c.previousRejected)assert.throws(()=>a.validateConfigEngineFacts(c.previous,catalogue,c.currentConnection),e=>{assert.deepEqual(code(e),c.previousRejected,c.title);return true;});
 }
});

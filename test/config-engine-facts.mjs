// config-engine-facts/v1 conformance (SOURCE/FIXTURE). Both sides run this against the exact installed
// package: the Adapter for what it may emit, Canvas for what it may assemble or must refuse.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const fx=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/config-engine-facts'))));
const main=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/main'))));
const profile=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/profile'))));
const catalogue=main.request.catalogue;
let passed=0;function test(name,fn){fn();console.log('ok',++passed,name)}
const code=e=>({code:e.code,reason:e.reason});
test('same-major package; facts are an in-process port, not a wire or a changed type',()=>{
 a.checkContractsVersion(a.contractHandshake.contracts);assert.equal(a.contractHandshake.contracts,'hanaworlds-contracts@'+a.version);a.checkContractHandshake(a.contractHandshake);
 assert.equal(a.configEngineFacts.id,'config-engine-facts/v1');
 assert.equal(profile.configEngineFacts.id,'config-engine-facts/v1');
 for(const ops of Object.values(a.operationContracts))for(const o of ops)assert.ok(!/EngineFacts/.test(o.operation));
 assert.equal(a.schemaBundle.definitions.CompilationConfig.properties.backendProfileId.$ref,'#/definitions/Ref');
 assert.deepEqual(a.schemaBundle.definitions.SafetyProfile.required,['profileVersion','avatarDimensions','connectivity','requireBodyClearance','requireEntranceConnectivity','hazardPolicy','optionalLightRule']);
 assert.equal(a.digestProfile.domainPrefixByKind['config-engine-facts'],'HanaWorlds|config-engine-facts/v1|');
});
test('no player geometry leaves the Adapter: avatarEnvelope has only the fixed UNAVAILABLE form',()=>{
 const d=a.schemaBundle.definitions;
 assert.equal(a.canonicalJSON(d.AvatarEnvelopeFact.properties),a.canonicalJSON({availability:{const:'UNAVAILABLE'},reason:{const:'NO_PUBLIC_SOURCE'}}));
 for(const t of ['AvatarEnvelopeFact','KnownWriteBackend','UnavailableWriteBackend','WriteBackendFact','ConfigEngineFactsProjection','ConfigEngineFacts']){
  const s=JSON.stringify(d[t]);assert.ok(!/AvatarDimensions|CollisionBox|Position|yaw|player/i.test(s),t);
  if(d[t].type==='object')assert.equal(d[t].additionalProperties,false,t);
 }
 assert.deepEqual(Object.keys(d.ConfigEngineFacts.properties),['profileVersion','connection','catalogueDigest','avatarEnvelope','writeBackend','sourceRevision']);
});
test('avatarDimensions: no public source; cause and refusal use existing typed error values',()=>{
 const av=a.configEngineFacts.avatarDimensions;
 assert.equal(av.publicSource,'NONE');assert.equal(av.cause,fx.consumer.avatarDimensions.cause);
 assert.equal(a.canonicalJSON(av.refusal),a.canonicalJSON(fx.consumer.avatarDimensions.refusal));
 a.validateType('ErrorCode',av.refusal.code);a.validateType('ErrorReason',av.refusal.reason);
 for(const c of fx.provider.valid)assert.throws(()=>a.requireKnownAvatarEnvelope(c.facts),e=>{assert.deepEqual({code:e.code,phase:e.phase,reason:e.reason},{...av.refusal},c.title);return true;});
});
test('provider: valid facts bind fresh Catalogue and current connection',()=>{
 for(const c of fx.provider.valid){const v=a.validateConfigEngineFacts(c.facts,catalogue,fx.connection);assert.ok(Object.isFrozen(v),c.title);assert.equal(v.sourceRevision,c.facts.sourceRevision);}
});
test('provider: every leak or inconsistency is rejected with its named error',()=>{
 for(const c of fx.provider.invalid)assert.throws(()=>a.validateConfigEngineFacts(c.facts,catalogue,fx.connection),e=>{assert.deepEqual(code(e),c.expect,c.title);return true;});
});
test('consumer: KNOWN backend assembles an unchanged CompilationConfig, UNAVAILABLE refuses without a value',()=>{
 for(const c of fx.consumer.assemble){
  const want=c.backendProfileId;
  if(typeof want==='object')assert.throws(()=>a.requireKnownWriteBackend(c.facts),e=>{assert.deepEqual(code(e),want,c.title);return true;});
  else{
   assert.equal(a.requireKnownWriteBackend(c.facts),want,c.title);
   a.validateType('CompilationConfig',{profileVersion:'compilation-config/v2',backendProfileId:want,worldeditRevision:'fixture-worldedit-revision',nodeWriteSemantics:c.facts.writeBackend.nodeWriteSemantics,overlapRule:'last-writer-wins',effectOrder:'numeric-x-y-z',compressionRule:'exact-final-effects-only'});
  }
 }
});
test('lifecycle: changed declaration invalidates, reconnect rejects the previous incarnation facts',()=>{
 for(const c of fx.consumer.lifecycle){
  const cur=a.validateConfigEngineFacts(c.current,catalogue,c.currentConnection);
  if('previousStillCurrent' in c)assert.equal(cur.sourceRevision===c.previous.sourceRevision,c.previousStillCurrent,c.title);
  if(c.previousRejected)assert.throws(()=>a.validateConfigEngineFacts(c.previous,catalogue,c.currentConnection),e=>{assert.deepEqual(code(e),c.previousRejected,c.title);return true;});
 }
});

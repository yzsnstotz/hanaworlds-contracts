// compiler-backend-facts/v1 conformance (SOURCE/FIXTURE). Both sides run this against the exact installed
// package: the Adapter for what it may emit, Canvas for what it may assemble or must refuse.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const fx=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/compiler-backend-facts'))));
const profile=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/profile'))));
let passed=0;function test(name,fn){fn();console.log('ok',++passed,name)}
const code=e=>({code:e.code,reason:e.reason});
test('exact candidate package; backend facts are an in-process port, not a wire or a changed type',()=>{
 assert.equal(a.version,'0.5.5-rc.1');a.checkContractHandshake(a.contractHandshake);
 assert.equal(a.compilerBackendFacts.id,'compiler-backend-facts/v1');
 assert.equal(profile.compilerBackendFacts.id,'compiler-backend-facts/v1');
 for(const ops of Object.values(a.operationContracts))for(const o of ops)assert.ok(!/BackendFacts/.test(o.operation));
 assert.equal(a.schemaBundle.definitions.CompilationConfig.properties.backendProfileId.$ref,'#/definitions/Ref');
 assert.equal(a.digestProfile.domainPrefixByKind['compiler-backend-facts'],'HanaWorlds|compiler-backend-facts/v1|');
});
test('no player geometry leaves the Adapter: no new type carries dimensions, box, position, yaw or identity',()=>{
 const d=a.schemaBundle.definitions;
 const added=['KnownWriteBackend','UnavailableWriteBackend','WriteBackendFact','CompilerBackendFactsProjection','CompilerBackendFacts'];
 for(const t of added){const s=JSON.stringify(d[t]);assert.ok(!/AvatarDimensions|CollisionBox|Position|avatar|yaw|player/i.test(s),t);}
 assert.deepEqual(Object.keys(d.CompilerBackendFacts.properties),['profileVersion','connection','writeBackend','sourceRevision']);
 for(const t of ['KnownWriteBackend','UnavailableWriteBackend','CompilerBackendFacts'])assert.equal(d[t].additionalProperties,false,t);
 assert.ok(!a.schemaInventory.some(t=>/AvatarEnvelope|ConfigEngineFacts/.test(t)));
});
test('avatarDimensions has no public source; the declared refusal is the existing typed error',()=>{
 const av=a.compilerBackendFacts.avatarDimensions;
 assert.equal(av.publicSource,'NONE');
 assert.deepEqual({...av.refusal},fx.consumer.avatarDimensions.refusal);
 a.validateType('ErrorCode',av.refusal.code);a.validateType('ErrorReason',av.refusal.reason);
 assert.deepEqual(a.schemaBundle.definitions.SafetyProfile.required,['profileVersion','avatarDimensions','connectivity','requireBodyClearance','requireEntranceConnectivity','hazardPolicy','optionalLightRule']);
});
test('provider: valid facts bind the current connection',()=>{
 for(const c of fx.provider.valid){const v=a.validateCompilerBackendFacts(c.facts,fx.connection);assert.ok(Object.isFrozen(v),c.title);assert.equal(v.sourceRevision,c.facts.sourceRevision);}
});
test('provider: every leak or inconsistency is rejected with its named error',()=>{
 for(const c of fx.provider.invalid)assert.throws(()=>a.validateCompilerBackendFacts(c.facts,fx.connection),e=>{assert.deepEqual(code(e),c.expect,c.title);return true;});
});
test('consumer: KNOWN assembles an unchanged CompilationConfig, UNAVAILABLE refuses without a value',()=>{
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
  const cur=a.validateCompilerBackendFacts(c.current,c.currentConnection);
  if('previousStillCurrent' in c)assert.equal(cur.sourceRevision===c.previous.sourceRevision,c.previousStillCurrent,c.title);
  if(c.previousRejected)assert.throws(()=>a.validateCompilerBackendFacts(c.previous,c.currentConnection),e=>{assert.deepEqual(code(e),c.previousRejected,c.title);return true;});
 }
});

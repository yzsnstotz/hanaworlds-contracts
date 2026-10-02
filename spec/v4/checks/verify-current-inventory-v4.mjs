// SOURCE/FIXTURE only: public Canvas inventory result -> Workshop/UI selection chain.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const get=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const profile=await get('CONTRACT_SCHEMA_PROFILE.json');
const closure=await get('CONTRACT_SEMANTIC_CLOSURE.json');
const chain=await get('fixtures/candidate/current-inventory-chain-v4.json');
assert(profile.wireVersions.includes('canvas/v4'));
assert(!profile.wireVersions.includes('canvas/v3'));
assert.equal(profile.types.ListObjectsRequest.fields.expectedRevision,'Revision|null');
assert.equal(profile.types.SetObjectSelectionRequest.fields.contractVersion,'=canvas/v4');
assert.equal(profile.types.ObjectList.fields.contractVersion,'=canvas/v4');
function check(value,kind,path='$'){
  if(kind.includes('|')){const kinds=kind.split('|');if(value===null&&kinds.includes('null'))return;for(const k of kinds.filter(x=>x!=='null'))try{return check(value,k,path)}catch{}throw Error(`${path}: no union variant`)}
  if(kind.startsWith('=')){assert.equal(value,kind.slice(1),path);return}
  const t=profile.types[kind];assert(t,`${path}: missing type ${kind}`);
  if(t.type==='string'){assert.equal(typeof value,'string',path);assert(value.isWellFormed(),path);if(t.minLength)assert(value.length>=t.minLength,path);return}
  if(t.type==='integer'){assert(Number.isSafeInteger(value)&&value>=0,path);return}
  if(t.type==='enum'){assert(t.values.includes(value),path);return}
  if(t.type==='array'){assert(Array.isArray(value),path);if(t.minItems)assert(value.length>=t.minItems,path);for(let i=0;i<value.length;i++)check(value[i],t.items,`${path}[${i}]`);return}
  if(t.type==='object'){assert(value&&typeof value==='object'&&!Array.isArray(value),path);assert.deepEqual(Object.keys(value).sort(),Object.keys(t.fields).sort(),`${path}: exact fields`);for(const [k,v] of Object.entries(t.fields))check(value[k],v,`${path}.${k}`);return}
  throw Error(`${path}: unsupported fixture type ${t.type}`);
}
const valid=chain.validCases.find(x=>x.id==='INVENTORY-RESTART-MISSED-EVENTS');assert(valid);
const x=valid.materializedChain;
check(x.listRequest,'ListObjectsRequest');check(x.listResponse,'ObjectList');check(x.selectionRequest,'SetObjectSelectionRequest');
assert.equal(x.listRequest.expectedRevision,null);
assert.equal(x.listRequest.worldRef,x.listResponse.result.worldRef);
assert.equal(x.selectionRequest.worldRef,x.listResponse.result.worldRef);
assert.equal(x.selectionRequest.authorizationRef,x.listRequest.authorizationRef);
assert.deepEqual(x.visibleChoices,x.listResponse.result.objects.map(o=>o.displayName));
const selected=x.listResponse.result.objects.find(o=>o.displayName===x.chosenVisibleName);assert(selected);
assert.deepEqual(x.selectionRequest.objectRefs,[selected.objectRef]);
assert.equal(valid.expected.readOnlyQueryWorldWrites,0);
assert.equal(valid.expected.registryWrites,0);
assert.equal(valid.expected.eventReplayRequired,false);
assert.equal(valid.expected.sessionImageRetentionRequired,false);
const row=closure.rows.find(r=>r.id==='CAV4-CURRENT-INVENTORY');assert(row);
assert.equal(row.protocol,'canvas/v4');
assert.equal(row.fieldLineage.producerResultPaths[0],'ObjectList.result.objects[].objectRef');
assert.equal(row.fieldLineage.consumerRequestPath,'SetObjectSelectionRequest.objectRefs[]');
assert.equal(row.fieldLineage.executedChecker.path,'checks/verify-current-inventory-v4.mjs');
assert.equal(row.validFixture.caseId,valid.id);
const bad=new Map(chain.invalidCases.map(y=>[y.id,y]));
for(const id of ['INVENTORY-REVOKED-BEFORE-READ','INVENTORY-REVOKED-BEFORE-RELEASE','INVENTORY-STALE-STRICT-V3-MODE','INVENTORY-OTHER-WORLD','INVENTORY-MISSING-AUTH','INVENTORY-RACE-MIXED-REVISION','INVENTORY-CHANGED-REF-BEFORE-SELECTION'])assert(bad.has(id),id);
for(const id of ['INVENTORY-REVOKED-BEFORE-READ','INVENTORY-REVOKED-BEFORE-RELEASE']){const e=bad.get(id).expected;assert.equal(e.code,'AUTHORIZATION_REVOKED');assert.equal(e.result,null);assert.equal(e.inventoryDisclosed,false);assert.equal(e.writes,0)}
assert.equal(bad.get('INVENTORY-STALE-STRICT-V3-MODE').expected.code,'STALE_REVISION');
assert.equal(bad.get('INVENTORY-MISSING-AUTH').expected.code,'SCHEMA_INVALID');
const changed=bad.get('INVENTORY-CHANGED-REF-BEFORE-SELECTION');
const mutation=changed.materializedMutation;
assert.equal(row.invalidFixture.caseId,changed.id);
assert.equal(row.fieldLineage.chainedInvalidFixture,'fixtures/candidate/current-inventory-chain-v4.json#'+changed.id);
assert.equal(mutation.originalProducedValue,x.listResponse.result.objects[1].objectRef);
assert.equal(mutation.consumerRequestPath,'SetObjectSelectionRequest.objectRefs[0]');
assert.equal(mutation.mutatedValue,mutation.selectionRequest.objectRefs[0]);
assert.notEqual(mutation.mutatedValue,mutation.originalProducedValue);
assert(!x.listResponse.result.objects.some(o=>o.objectRef===mutation.mutatedValue));
check(mutation.selectionRequest,'SetObjectSelectionRequest');
assert.deepEqual({...mutation.selectionRequest,objectRefs:x.selectionRequest.objectRefs},x.selectionRequest);
assert(profile.operations['canvas/v4'].find(o=>o.operation==='SetObjectSelection').failureCodes.includes('OBJECT_NOT_FOUND'));
assert.equal(changed.expected.code,'OBJECT_NOT_FOUND');
assert.equal(changed.expected.selectionWrites,0);
assert.equal(changed.expected.registryWrites,0);
assert.equal(changed.expected.worldWrites,0);
const race=chain.raceCases;assert.equal(race.length,3);
assert(race[0].valid&&race[1].valid&&!race[2].valid);
assert.deepEqual(race[0].objectRefs,x.listResponse.result.objects.map(o=>o.objectRef));
assert.equal(race[2].registryRevision,race[0].registryRevision);
assert.deepEqual(race[2].objectRefs,race[1].objectRefs);
const missing={...x.listRequest};delete missing.authorizationRef;assert.throws(()=>check(missing,'ListObjectsRequest'));
const stale={...x.listRequest,expectedRevision:'fixture-registry-6'};check(stale,'ListObjectsRequest');
console.log(JSON.stringify({status:'PASS',evidence:'SOURCE/FIXTURE',runtime:'NOT_RUN',validChain:1,invalidCases:bad.size,raceCases:race.length,publicConsumer:'Workshop/UI via SetObjectSelectionRequest'}));

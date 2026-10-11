// SOURCE/FIXTURE: business binding of the new named reads; never queries a world.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as a from 'hanaworlds-contracts';
const fx=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/world-source-facts'))));
const main=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/main'))));
const cat=main.request.catalogue;
const source=fx.exchanges.find(x=>x.operation==='ReadMaterialSources').response.result;
const rejects=(fn,code,reason)=>assert.throws(fn,e=>e.code===code&&e.reason===reason);
function changed(edit){const v=structuredClone(source);edit(v.snapshot);const {sourceRevision,...p}=v.snapshot;v.snapshot.sourceRevision=a.digestValue('material-sources',p).sha256;return v;}
for(const x of fx.exchanges.filter(x=>x.response.result!==null&&x.operation!=='ReadInspectionContext')){
 test(x.operation+' binds the nested result World to the request',()=>{
  rejects(()=>a.validateBoundResponse(x.wire,x.operation,{...x.request,worldRef:'other-world'},x.response),'CURRENT_WORLD_MISMATCH','REVISION_CHANGED');
 });
}
test('material definitionRevision must match fresh Catalogue even after rehash',()=>{
 rejects(()=>a.validateMaterialSourceFacts(changed(s=>{s.materials[1].definitionRevision='other-definition';}),cat,fx.connection),'CATALOGUE_MISMATCH','INVALID_SHAPE');
});
test('material orientation must be declared by the Catalogue',()=>{
 rejects(()=>a.validateMaterialSourceFacts(changed(s=>{s.materials[1].orientation=1;}),cat,fx.connection),'UNSUPPORTED_MUTATION_SEMANTICS','INVALID_SHAPE');
});
test('material rows must be sorted and unique',()=>{
 for(const v of [changed(s=>{s.materials.reverse();}),changed(s=>{s.materials.push(s.materials[1]);})])
  rejects(()=>a.validateMaterialSourceFacts(v,cat,fx.connection),'SCHEMA_INVALID','INVALID_SHAPE');
});
test('UNKNOWN_ORIENTATION cannot describe a known orientation',()=>{
 rejects(()=>a.validateMaterialSourceFacts(changed(s=>{s.materials[0].reason='UNKNOWN_ORIENTATION';}),cat,fx.connection),'SCHEMA_INVALID','INVALID_SHAPE');
});
test('UNKNOWN_DEFINITION cannot describe a known definition',()=>{
 rejects(()=>a.validateMaterialSourceFacts(changed(s=>{s.materials[0].reason='UNKNOWN_DEFINITION';}),cat,fx.connection),'SCHEMA_INVALID','INVALID_SHAPE');
});
test('avatar envelope admission never invokes an accessor or proxy trap',()=>{
 let reads=0;
 const accessor=Object.defineProperty({},'profileVersion',{enumerable:true,get(){reads++;return 'write-profile/v1';}});
 const proxy=new Proxy({},{get(){reads++;return 'write-profile/v1';}});
 for(const input of [accessor,proxy])rejects(()=>a.requireDeclaredAvatarEnvelope(input),'SCHEMA_INVALID','INVALID_SHAPE');
 assert.equal(reads,0);
});
for(const [operation,type] of [['ReadWriteProfile','WriteProfile'],['ReadWorldSourceCapabilities','WorldSourceCapabilities']]){
 test(type+' treats opaque backend object key order as irrelevant',()=>{
  const input=structuredClone(fx.exchanges.find(x=>x.operation===operation&&x.response.result?.compilationConfig!==null).response.result);
  const {profileId,revision}=input.compilationConfig.writeBackend;
  input.compilationConfig.writeBackend={revision,profileId};
  a.validateType(type,input);
 });
}

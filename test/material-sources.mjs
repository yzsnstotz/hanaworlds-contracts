import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const base=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/main'))));
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWOo2HKnYssdBggFADdeCCGxfcWRAAAAAElFTkSuQmCC','base64');
const bytesDigest=createHash('sha256').update(bytes).digest('hex');
const catalogue=base.request.catalogue;
const {worldRef,connectionRef,connectionIncarnationRef}=base.request.localContext;
const connection={worldRef,connectionRef,connectionIncarnationRef};
const D=(k,v)=>a.digestValue(k,v).sha256;
function response(cat=catalogue){
 const projection={profileVersion:'material-sources/v1',connection,catalogueDigest:D('catalogue',cat),gameId:cat.gameId,gameRevision:cat.gameRevision,sourceBasis:'SERVER_ASSET_ONLY',materials:[
  {availability:'UNKNOWN',nodeName:'air',param2:0,definitionRevision:cat.nodes.air.definitionRevision,texture:null,reason:'UNSUPPORTED_APPEARANCE'},
  {availability:'KNOWN',nodeName:'fixture:stone',param2:0,definitionRevision:cat.nodes['fixture:stone'].definitionRevision,texture:{textureName:'fixture_stone.png',sourceKind:'MOD',sourceRef:'fixture-mod/textures/fixture_stone.png',interpretation:'SIMPLE_UNIFORM_NODE_TILES',mediaType:'image/png',bytesDigest,byteLength:bytes.length}}
 ]};
 return {snapshot:{...projection,sourceRevision:D('material-sources',projection)},textures:[{bytesDigest,bytes:new Uint8Array(bytes)}]};
}
function resign(r){const {sourceRevision,...p}=r.snapshot;r.snapshot.sourceRevision=D('material-sources',p);return r;}
let checks=0;function test(name,run){run();console.log('ok',++checks,name);}
test('public readonly material source validator exists',()=>assert.equal(typeof a.validateMaterialSources,'function'));
test('actual bytes, Catalogue, definition and fresh connection bind with owned byte copies',()=>{
 const raw=response();const valid=a.validateMaterialSources(raw,catalogue,connection);
 assert.equal(valid.snapshot.sourceRevision,raw.snapshot.sourceRevision);
 assert.equal(valid.snapshot.materials[1].texture.bytesDigest,bytesDigest);
 assert.ok(valid.textures[0].bytes instanceof Uint8Array);
 assert.ok(Object.isFrozen(valid.snapshot));assert.ok(Object.isFrozen(valid.textures));
 raw.textures[0].bytes[0]=0;assert.equal(valid.textures[0].bytes[0],137);
 a.validateStaticMaterials({stone:{nodeName:'fixture:stone',param2:0}},catalogue);
 const {sourceRevision,...p}=valid.snapshot;
 assert.match(a.digestValue('material-sources',p).preimageUtf8,/^HanaWorlds\|contracts@0\.4\.2\|material-sources\|/);
});
test('UNKNOWN texture source carries no pretend bytes; unknown param2 and definition stay null',()=>{
 const cat=structuredClone(catalogue);Object.assign(cat.nodes['fixture:stone'],{allowedParam2:null,definitionRevision:null,unknownFields:['allowedParam2','definitionRevision']});
 const raw=response();raw.snapshot.catalogueDigest=D('catalogue',cat);raw.snapshot.materials[1]={availability:'UNKNOWN',nodeName:'fixture:stone',param2:null,definitionRevision:null,texture:null,reason:'UNKNOWN_PARAM2'};raw.textures=[];
 assert.equal(a.validateMaterialSources(resign(raw),cat,connection).snapshot.materials[1].param2,null);
});
test('current world/incarnation, Catalogue and definition cannot be borrowed',()=>{
 const raw=response();
 assert.throws(()=>a.validateMaterialSources(raw,catalogue,{...connection,worldRef:'other-world'}),{code:'CURRENT_WORLD_MISMATCH'});
 assert.throws(()=>a.validateMaterialSources(raw,catalogue,{...connection,connectionIncarnationRef:'new-incarnation'}),{code:'CURRENT_WORLD_MISMATCH'});
 const changed=structuredClone(catalogue);changed.gameRevision='changed';assert.throws(()=>a.validateMaterialSources(raw,changed,connection),{code:'CATALOGUE_MISMATCH'});
 const wrong=response();wrong.snapshot.materials[1].definitionRevision='other-def';assert.throws(()=>a.validateMaterialSources(resign(wrong),catalogue,connection),{code:'CATALOGUE_MISMATCH'});
});
test('source revision and actual bytes are checked independently of registry revision',()=>{
 const changed=response();changed.textures[0].bytes[0]=0;assert.throws(()=>a.validateMaterialSources(changed,catalogue,connection),{code:'NON_CANONICAL_AMBIGUITY'});
 const altered=response();altered.snapshot.materials[1].texture.sourceRef='different/source.png';assert.throws(()=>a.validateMaterialSources(altered,catalogue,connection),{code:'NON_CANONICAL_AMBIGUITY'});
 const edited=response();edited.textures[0].bytes[0]=0;const next=createHash('sha256').update(edited.textures[0].bytes).digest('hex');edited.textures[0].bytesDigest=next;edited.snapshot.materials[1].texture.bytesDigest=next;resign(edited);
 assert.notEqual(edited.snapshot.sourceRevision,response().snapshot.sourceRevision);assert.equal(edited.snapshot.catalogueDigest,response().snapshot.catalogueDigest);
});
test('KNOWN texture cannot fill unknown legal param2 or authorize unknown static capabilities',()=>{
 const unknown=structuredClone(catalogue);unknown.nodes['fixture:stone'].allowedParam2=null;unknown.nodes['fixture:stone'].unknownFields=['allowedParam2'];
 assert.throws(()=>a.validateMaterialSources(response(unknown),unknown,connection),{code:'UNSUPPORTED_MUTATION_SEMANTICS'});
 const illegal=response();illegal.snapshot.materials[1].param2=1;assert.throws(()=>a.validateMaterialSources(resign(illegal),catalogue,connection),{code:'UNSUPPORTED_MUTATION_SEMANTICS'});
 const staticUnknown=structuredClone(catalogue);staticUnknown.nodes['fixture:stone'].hasCallbacks=null;staticUnknown.nodes['fixture:stone'].unknownFields=['hasCallbacks'];
 a.validateMaterialSources(response(staticUnknown),staticUnknown,connection);
 assert.throws(()=>a.validateStaticMaterials({stone:{nodeName:'fixture:stone',param2:0}},staticUnknown),{code:'UNSUPPORTED_MUTATION_SEMANTICS'});
});
test('typed byte channel is not JSON; byte inventory is exact and node keys unique',()=>{
 assert.throws(()=>a.validateMaterialSources(JSON.parse(JSON.stringify(response())),catalogue,connection),{code:'SCHEMA_INVALID'});
 const missing=response();missing.textures=[];assert.throws(()=>a.validateMaterialSources(missing,catalogue,connection),{code:'SCHEMA_INVALID'});
 const dup=response();dup.snapshot.materials.push(dup.snapshot.materials[1]);assert.throws(()=>a.validateMaterialSources(resign(dup),catalogue,connection),{code:'SCHEMA_INVALID'});
 const raw=response();a.admitType('MaterialSourcesSnapshot',Buffer.from(JSON.stringify(raw.snapshot)));
});
test('new package handshake and unchanged normal proposal keep prior media allowance',()=>{
 assert.equal(a.version,'0.5.2');a.checkBuildProposalHandshake(a.contractHandshake);
 a.validateBuildProposalContext(base.request,base.facts);
 const image=structuredClone(base.request);image.referenceBrief.media=[{attachmentRef:'sha256:'+bytesDigest,storedBytesDigest:bytesDigest,projectionVariantId:null,projectionBytesDigest:null,mediaType:'image/png',bytes:bytes.length,width:2,height:2}];
 image.referenceBriefDigest=D('reference-brief',image.referenceBrief);image.intent.referenceBriefDigest=image.referenceBriefDigest;image.intentDigest=D('intent',image.intent);
 const context=Object.fromEntries(Object.keys(a.schemaBundle.definitions.BuildProposalContext.properties).map(k=>[k,image[k]]));
 a.validateBuildProposalContext(image,{sourceContext:context,currentContext:context,requestFacts:{...base.facts.requestFacts,currentBriefDigest:image.referenceBriefDigest}});
});
console.log(JSON.stringify({evidence:'SOURCE/FIXTURE',checks,textureBytes:bytes.length,bytesDigest,modelCalls:0,worldWrites:0,realRuntime:'NOT_RUN',realUI:'NOT_RUN'}));

// SOURCE/FIXTURE only: no Brush, Canvas, Adapter or live world is exercised.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const fixture = async name => JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/'+name))));
const region = await fixture('region'), main = await fixture('main');
const clone = structuredClone, r = main.request, ctx = r.localContext;
const request = {contractVersion:'canvas/v7',sessionRef:r.sessionRef,requestId:'inspect-placement-profile',worldRef:r.worldRef,
 anchor:{kind:'CURRENT_VIEW',invocationId:r.invocationId},footprint:{widthCells:1,depthCells:1,heightCells:2,geometryProfile:'voxel-grid/v1'},localContext:ctx};
const connection = {connectionRef:ctx.connectionRef,connectionIncarnationRef:ctx.connectionIncarnationRef,worldRef:r.worldRef,
 payloadVersion:'fixture/v1',payloadDigest:'1'.repeat(64),capabilities:{providerRef:'fixture-world-source',capabilityRevision:'fixture-cap-1',worldRef:r.worldRef,
 engineBounds:r.targetFacts.sampledBounds,worldGeometry:{profileVersion:'world-geometry/v1',geometryProfiles:['voxel-grid/v1'],partition:{edge:[16,16,16]},postWriteLighting:'REQUIRED'},
 limits:[],recoveryGuarantee:'RECOVERABLE_VERIFIED',stateProfile:{profileVersion:'state-profile/v3',derivedFields:['param1'],preservedFields:[],clearedFields:['inventory','metadata','timer']},
 sessionDeleteSupported:true,imageMediaTypes:[],model:null,engineGuards:{profileVersion:'engine-guards/v1',coverage:[
 {guard:'BODY_CLEARANCE',stages:[],protectionPrincipal:null},{guard:'CELL_PROTECTION',stages:[],protectionPrincipal:null},{guard:'PLAYER_ENCLOSURE',stages:[],protectionPrincipal:null}]}}};
const response = {contractVersion:'canvas/v7',requestId:request.requestId,result:{outcome:'REGION_INSPECTED',inspection:r.regionInspection},error:null,unavailableSettings:null,guardRefusal:null};
const reject = (fn,code,reason) => assert.throws(fn,{code,reason});
function compiled() {
 const v = clone(region.compileResponse);
 for(const c of v.result.projection.chunks)c.blockDigest=a.digestValue('region-block',c.block).sha256;
 v.result.operationDigest=a.digestValue('region-operations',v.result.projection).sha256;
 return v;
}
test('every chunk across partition boundaries has its own canonical region-block digest',()=>{
 const res=compiled(); assert.ok(res.result.projection.chunks.length>1);
 a.validateCompiledRegionSet(region.compileRequest,res);
 for(const c of res.result.projection.chunks){a.validateType('RegionChunk',c);assert.equal(c.blockDigest,a.digestValue('region-block',c.block).sha256);}
});
test('a valid-shaped but tampered per-block digest is refused at standalone and nested SDK admission',()=>{
 const res=compiled();res.result.projection.chunks[1].blockDigest='0'.repeat(64);
 // Outer rehash cannot be used to legitimize the mismatched inner digest.
 for(const [type,value] of [['RegionChunk',res.result.projection.chunks[1]],['CompileRegionBuildResponse',res],['RegionOperationsProjection',res.result.projection]])
  reject(()=>a.validateType(type,value),'NON_CANONICAL_AMBIGUITY','PAYLOAD_CHANGED');
 reject(()=>a.validateCompiledRegionSet(region.compileRequest,res),'NON_CANONICAL_AMBIGUITY','PAYLOAD_CHANGED');
});
test('changed block with unchanged blockDigest is refused',()=>{
 const c=clone(region.compileResponse.result.projection.chunks[0]); c.blockDigest=a.digestValue('region-block',c.block).sha256;c.block.origin[0]++;
 reject(()=>a.validateType('RegionChunk',c),'NON_CANONICAL_AMBIGUITY','PAYLOAD_CHANGED');
});
test('old compiled input without blockDigest retains decoding, digest and compilation validity',()=>{
 const res=clone(region.compileResponse);for(const c of res.result.projection.chunks)delete c.blockDigest;
 res.result.operationDigest=a.digestValue('region-operations',res.result.projection).sha256;
 a.validateCompiledRegionSet(region.compileRequest,res);
});
test('explicit voxel profile is decoded, admitted and bound to the current world declaration',()=>{
 a.validateRequest('canvas/v7','InspectPlacementRegion',request);
 a.validatePlacementRegionRequest(request,connection);
 a.validatePlacementRegionResponse(request,response,connection);
 a.validateBoundResponse('canvas/v7','InspectPlacementRegion',request,response);
});
test('other profiles decode as Ref and are capability gaps, including profiles declared by a world but unsupported by this Canvas shape',()=>{
 const q=clone(request);q.footprint.geometryProfile='mesh/v1';
 a.admitRequest('canvas/v7','InspectPlacementRegion',Buffer.from(JSON.stringify(q)));
 reject(()=>a.validatePlacementRegionRequest(q,connection),'CAPABILITY_GAP','GEOMETRY_PROFILE_UNSUPPORTED');
 const c=clone(connection);c.capabilities.worldGeometry={profileVersion:'world-geometry/v1',geometryProfiles:['mesh/v1'],partition:null,postWriteLighting:'NONE'};
 reject(()=>a.validatePlacementRegionRequest(q,c),'CAPABILITY_GAP','GEOMETRY_PROFILE_UNSUPPORTED');
 reject(()=>a.requireGeometryProfile(connection.capabilities.worldGeometry,'mesh/v1'),'CAPABILITY_GAP','GEOMETRY_PROFILE_UNSUPPORTED');
});
test('missing optional profile remains old legal decoding but provider admission fails closed',()=>{
 const q=clone(request);delete q.footprint.geometryProfile;
 a.admitRequest('canvas/v7','InspectPlacementRegion',Buffer.from(JSON.stringify(q)));a.validateBoundResponse('canvas/v7','InspectPlacementRegion',q,response);
 reject(()=>a.validatePlacementRegionRequest(q,connection),'CAPABILITY_UNAVAILABLE','REQUIRED_FACT_UNKNOWN');
 reject(()=>a.validatePlacementRegionResponse(q,response,connection),'CAPABILITY_UNAVAILABLE','REQUIRED_FACT_UNKNOWN');
});
test('missing world declaration or one excluding voxel cannot admit explicit voxel',()=>{
 for(const geometry of [null,{profileVersion:'world-geometry/v1',geometryProfiles:['mesh/v1'],partition:null,postWriteLighting:'NONE'}]){
  const c=clone(connection);c.capabilities.worldGeometry=geometry;
  reject(()=>a.validatePlacementRegionRequest(request,c),'CAPABILITY_GAP','GEOMETRY_PROFILE_UNSUPPORTED');
 }
});
test('current world, capability world and connection incarnation must all match the request',()=>{
 for(const edit of [c=>c.worldRef='other',c=>c.capabilities.worldRef='other',c=>c.connectionRef='other',c=>c.connectionIncarnationRef='other']){
  const c=clone(connection);edit(c);reject(()=>a.validatePlacementRegionRequest(request,c),'CURRENT_WORLD_MISMATCH','REVISION_CHANGED');
 }
});
test('successful response binds inspection world, anchor and request geometry profile',()=>{
 const world=clone(response);world.result.inspection.targetFacts.worldRef='other';world.result.inspection.evidence.worldRef='other';world.result.inspection.targetFactsDigest=a.digestValue('target-facts',world.result.inspection.targetFacts).sha256;
 reject(()=>a.validatePlacementRegionResponse(request,world,connection),'CURRENT_WORLD_MISMATCH','REVISION_CHANGED');
 reject(()=>a.validateBoundResponse('canvas/v7','InspectPlacementRegion',request,world),'CURRENT_WORLD_MISMATCH','REVISION_CHANGED');
 const q=clone(request);q.footprint.geometryProfile='mesh/v1';
 reject(()=>a.validateBoundResponse('canvas/v7','InspectPlacementRegion',q,response),'CAPABILITY_GAP','GEOMETRY_PROFILE_UNSUPPORTED');
 const anchor=clone(response);anchor.result.inspection.anchorKind='PICKED_POINT';
 reject(()=>a.validatePlacementRegionResponse(request,anchor,connection),'TRANSACTION_CONFLICT','PAYLOAD_CHANGED');
});
test('shared PlacementFootprint accepts the optional field on Adapter InspectRegion while old footprints still decode',()=>{
 const q={...clone(request),contractVersion:'world-adapter/v8',expectedWorldRevision:r.targetFacts.worldRevision,inspectionId:r.regionInspection.inspectionId,placementSettings:r.regionInspection.placementSettings};
 a.validateRequest('world-adapter/v8','InspectRegion',q);
 delete q.footprint.geometryProfile;a.validateRequest('world-adapter/v8','InspectRegion',q);
});

test('published fixture peers return per-block digests and explicit capability refusals',async()=>{
 const fx=await fixture('brush-placement');
 const {createFixtureBrush,createFixtureCanvas}=await import('../consumer/brush-placement/mock.mjs');
 const output=createFixtureBrush(fx).compile(fx.region.compileRequest);
 assert.ok(output.result.projection.chunks.every(c=>c.blockDigest===a.digestValue('region-block',c.block).sha256));
 const canvas=createFixtureCanvas(fx);canvas.inspect(fx.canvas.request);
 for(const [profile,code,reason] of [[undefined,'CAPABILITY_UNAVAILABLE','REQUIRED_FACT_UNKNOWN'],['mesh/v1','CAPABILITY_GAP','GEOMETRY_PROFILE_UNSUPPORTED']]){
  const q=clone(fx.canvas.request);if(profile===undefined)delete q.footprint.geometryProfile;else q.footprint.geometryProfile=profile;
  const response=canvas.inspect(q);assert.equal(response.result,null);assert.equal(response.error.code,code);assert.equal(response.error.reason,reason);assert.equal(response.error.phase,'validate');assert.equal(response.error.mutationState,'NONE');
  a.validateBoundResponse('canvas/v7','InspectPlacementRegion',q,response);
 }
});

import {readFile,writeFile} from 'node:fs/promises';
import * as a from '../dist/local/index.mjs';
const region=JSON.parse(await readFile('spec/local-world/fixtures/region.json','utf8'));
const main=JSON.parse(await readFile('spec/local-world/fixtures/main.json','utf8'));
const r=main.request,ctx=r.localContext;
const request = {contractVersion:'canvas/v7',sessionRef:r.sessionRef,requestId:'inspect-placement-profile',worldRef:r.worldRef,
 anchor:{kind:'CURRENT_VIEW',invocationId:r.invocationId},footprint:{widthCells:1,depthCells:1,heightCells:2,geometryProfile:'voxel-grid/v1'},localContext:ctx};
const connection = {connectionRef:ctx.connectionRef,connectionIncarnationRef:ctx.connectionIncarnationRef,worldRef:r.worldRef,
 payloadVersion:'fixture/v1',payloadDigest:'1'.repeat(64),capabilities:{providerRef:'fixture-world-source',capabilityRevision:'fixture-cap-1',worldRef:r.worldRef,
 engineBounds:r.targetFacts.sampledBounds,worldGeometry:{profileVersion:'world-geometry/v1',geometryProfiles:['voxel-grid/v1'],partition:{edge:[16,16,16]},postWriteLighting:'REQUIRED'},
 limits:[],recoveryGuarantee:'RECOVERABLE_VERIFIED',stateProfile:{profileVersion:'state-profile/v3',derivedFields:['param1'],preservedFields:[],clearedFields:['inventory','metadata','timer']},
 sessionDeleteSupported:true,imageMediaTypes:[],model:null,engineGuards:{profileVersion:'engine-guards/v1',coverage:[
 {guard:'BODY_CLEARANCE',stages:[],protectionPrincipal:null},{guard:'CELL_PROTECTION',stages:[],protectionPrincipal:null},{guard:'PLAYER_ENCLOSURE',stages:[],protectionPrincipal:null}]}}};
const response = {contractVersion:'canvas/v7',requestId:request.requestId,result:{outcome:'REGION_INSPECTED',inspection:r.regionInspection},error:null,unavailableSettings:null,guardRefusal:null};

const compileResponse=structuredClone(region.compileResponse);
for(const chunk of compileResponse.result.projection.chunks)chunk.blockDigest=a.digestValue('region-block',chunk.block).sha256;
compileResponse.result.operationDigest=a.digestValue('region-operations',compileResponse.result.projection).sha256;
a.validateCompiledRegionSet(region.compileRequest,compileResponse);
a.validatePlacementRegionResponse(request,response,connection);
const fixture={evidence:'SOURCE/FIXTURE: 2.2.0 per-block digests and explicit neutral Canvas geometry admission. No real provider or world ran.',region:{compileRequest:region.compileRequest,compileResponse},canvas:{request,response,connection}};
await writeFile('spec/local-world/fixtures/brush-placement.json',JSON.stringify(fixture,null,2)+'\n');
console.log('Wrote brush-placement fixture',compileResponse.result.projection.chunks.length,'chunks');

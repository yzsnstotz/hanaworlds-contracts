import {encodeRegionBlock,expandRegionBlock,validateRegionRead,requireKnownRegion,validateRegionWrite,expectedRegionState,
 checkProtocolCompatibility,protocolRequirement,digestValue,regionChunksOfBox,chunkOf,requireGeometryProfile,validateCompiledRegionSet,regionInvariants} from 'hanaworlds-contracts';
import type {RegionVoxelBlock,RegionState,ReadRegionRequest,WriteRegionRequest,RegionCommitResult,ProtocolHandshake,WriteMethodDescriptor,
 RegionRun,CompileRegionBuildRequest,RegionUndoResult,TypeMap,WorldGeometry,PostWriteLighting} from 'hanaworlds-contracts';
const air={materialRef:'fixture:empty',orientation:0} as const;
export const carve:RegionVoxelBlock=encodeRegionBlock({origin:[0,0,0],size:[2,1,1],palette:[air],indices:[0,-1]});
const run:RegionRun=carve.runs[1];const unspecified:number|null=run[1];void unspecified;
const indices:Int32Array=expandRegionBlock(carve).indices;void indices;
export function plan(request:ReadRegionRequest,response:unknown,before:RegionState,ops:RegionVoxelBlock):string{
 const read=validateRegionRead(request,response);
 if(read.result){const known=requireKnownRegion(read.result);void known;}
 for(const c of regionChunksOfBox(request.box,request.partition)){const p:readonly number[]=c.chunkPos;void p;}
 const own:readonly number[]=chunkOf(request.box.min,request.partition);void own;
 return digestValue('region-state',expectedRegionState(before,ops)).sha256;
}
export function write(request:WriteRegionRequest,response:unknown):boolean{
 const facts=validateRegionWrite(request,response);const never:false=facts.committed;void never;return facts.allWritten;
}
export function compiled(req:CompileRegionBuildRequest,res:unknown):number{return validateCompiledRegionSet(req,res).result?.projection.chunks.length??0;}
export function verified(r:RegionCommitResult,u:RegionUndoResult):boolean{return r.status==='VERIFIED'&&u.originTransactionId===r.transactionId;}
// Lighting exists only when the world source declares a light pass.
export function lit(r:RegionCommitResult):boolean{const d:PostWriteLighting=r.postWriteLighting;return d==='NONE'||r.lighting?.status==='COMPLETE';}
export function voxel(g:WorldGeometry|null):WorldGeometry{return requireGeometryProfile(g,'voxel-grid/v1');}
export function compatible(peer:ProtocolHandshake):string{
 return checkProtocolCompatibility(peer,[protocolRequirement('canvas-region/v3',['canvas-region/v3:whole-region-undo'])]).matched[0].protocol;
}
export const tool:WriteMethodDescriptor={method:'REGION',toolName:'write_region',purpose:'large fill or carve',inputType:'RegionProposal',
 typicalScale:'hundreds to millions of cells',scaleUnit:'cells',requiredCapabilities:[],unavailableReason:null};
const invariants:readonly string[]=regionInvariants.map(i=>i.id);void invariants;
// @ts-expect-error tool self-description has no threshold field.
export const capped:WriteMethodDescriptor={...tool,maxCells:4096};
// @ts-expect-error a run is a [count, index|null] pair, not a material reference.
export const bad:RegionRun=[1,'fixture:empty'];
type Ops=TypeMap['RegionOperationsProjection'];export type Edge=Ops['partition']['edge'];const edge:Edge=[16,8,32];void edge;
// @ts-expect-error the chunk edge is the world source's declared partition, not a constant.
export type Gone=Ops['chunkEdge'];
// @ts-expect-error this major defines only the voxel-grid/v1 geometry profile.
export const props:TypeMap['GeometryProfile']='props/v1';
import {writePathStateFacts,validateCatalogueWritePathFacts,writePathStateScope} from 'hanaworlds-contracts';
import type {WritePathEvidence,Catalogue,WritePathMaterialFacts} from 'hanaworlds-contracts';
export function scoped(cat:Catalogue,ev:WritePathEvidence):readonly string[]{
 const f:Readonly<Record<string,WritePathMaterialFacts>>=writePathStateFacts(ev);
 const p:boolean|null|undefined=f[cat.emptyMaterialRef]?.placeable;void p;
 const scope:'write-path-init/v1'=writePathStateScope.id;void scope;
 return validateCatalogueWritePathFacts(cat,ev).verified;
}
// @ts-expect-error placeable is a tri-state fact, never a callback list.
export const notAList:WritePathMaterialFacts['placeable']=['on_construct'];

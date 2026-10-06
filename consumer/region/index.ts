import {encodeRegionBlock,expandRegionBlock,validateRegionRead,requireKnownRegion,validateRegionWrite,expectedRegionState,
 checkProtocolCompatibility,protocolRequirement,digestValue,regionChunksOfBox,validateCompiledRegionSet,regionInvariants} from 'hanaworlds-contracts';
import type {RegionVoxelBlock,RegionState,ReadRegionRequest,WriteRegionRequest,RegionCommitResult,ProtocolHandshake,WriteMethodDescriptor,
 RegionRun,CompileRegionBuildRequest,RegionUndoResult,TypeMap} from 'hanaworlds-contracts';
const air={nodeName:'air',param2:0} as const;
export const carve:RegionVoxelBlock=encodeRegionBlock({origin:[0,0,0],size:[2,1,1],palette:[air],indices:[0,-1]});
const run:RegionRun=carve.runs[1];const unspecified:number|null=run[1];void unspecified;
const indices:Int32Array=expandRegionBlock(carve).indices;void indices;
export function plan(request:ReadRegionRequest,response:unknown,before:RegionState,ops:RegionVoxelBlock):string{
 const read=validateRegionRead(request,response);
 if(read.result){const known=requireKnownRegion(read.result);void known;}
 for(const c of regionChunksOfBox(request.box)){const p:readonly number[]=c.chunkPos;void p;}
 return digestValue('region-state',expectedRegionState(before,ops)).sha256;
}
export function write(request:WriteRegionRequest,response:unknown):boolean{
 const facts=validateRegionWrite(request,response);const never:false=facts.committed;void never;return facts.allWritten;
}
export function compiled(req:CompileRegionBuildRequest,res:unknown):number{return validateCompiledRegionSet(req,res).result?.projection.chunks.length??0;}
export function verified(r:RegionCommitResult,u:RegionUndoResult):boolean{return r.status==='VERIFIED'&&u.originTransactionId===r.transactionId;}
export function compatible(peer:ProtocolHandshake):string{
 return checkProtocolCompatibility(peer,[protocolRequirement('canvas-region/v1',['canvas-region/v1:whole-region-undo'])]).matched[0].protocol;
}
export const tool:WriteMethodDescriptor={method:'REGION',toolName:'write_region',purpose:'large fill or carve',inputType:'RegionProposal',
 typicalScale:'hundreds to millions of cells',scaleUnit:'cells',requiredCapabilities:[],unavailableReason:null};
const invariants:readonly string[]=regionInvariants.map(i=>i.id);void invariants;
// @ts-expect-error tool self-description has no threshold field.
export const capped:WriteMethodDescriptor={...tool,maxCells:4096};
// @ts-expect-error a run is a [count, index|null] pair, not a node name.
export const bad:RegionRun=[1,'air'];
type Ops=TypeMap['RegionOperationsProjection'];export type Edge=Ops['chunkEdge'];const edge:Edge=16;void edge;

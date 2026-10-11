import {digestValue,validateType,validateCompiledRegionSet,validatePlacementRegionRequest,validatePlacementRegionResponse,requireGeometryProfile} from 'hanaworlds-contracts';
import type {RegionChunk,Digest,PlacementFootprint,InspectPlacementRegionRequest,LocalConnectionReadback,CompileRegionBuildRequest,CompileRegionBuildResponse,PlacementRegionInspection,WorldGeometry} from 'hanaworlds-contracts';
export function perBlock(chunk:RegionChunk):Digest|undefined {
 if(chunk.blockDigest!==undefined)validateType('RegionChunk',chunk);
 return chunk.blockDigest;
}
export function provideChunk(chunk:RegionChunk):RegionChunk {
 return {...chunk,blockDigest:digestValue('region-block',chunk.block).sha256};
}
export function compiled(req:CompileRegionBuildRequest,res:unknown):CompileRegionBuildResponse {
 return validateCompiledRegionSet(req,res);
}
export const voxel:PlacementFootprint={widthCells:1,depthCells:1,heightCells:2,geometryProfile:'voxel-grid/v1'};
export const other:PlacementFootprint={...voxel,geometryProfile:'mesh/v1'}; // decodes; neutral Canvas returns a capability gap.
export const legacy:PlacementFootprint={widthCells:1,depthCells:1,heightCells:2}; // decodes; neutral Canvas fails closed.
export function admit(req:InspectPlacementRegionRequest,connection:LocalConnectionReadback):InspectPlacementRegionRequest {
 return validatePlacementRegionRequest(req,connection);
}
export function inspect(req:InspectPlacementRegionRequest,res:unknown,connection:LocalConnectionReadback):PlacementRegionInspection {
 return validatePlacementRegionResponse(req,res,connection);
}
export function declared(geometry:WorldGeometry|null):WorldGeometry{return requireGeometryProfile(geometry,'mesh/v1');}
// @ts-expect-error absence is the old meaning; null is not a profile.
export const nullable:PlacementFootprint={...legacy,geometryProfile:null};
// @ts-expect-error Digest is a sha256 string, not the diagnostic object from digestValue.
export function wrongDigest(chunk:RegionChunk):RegionChunk{return {...chunk,blockDigest:digestValue('region-block',chunk.block)};}

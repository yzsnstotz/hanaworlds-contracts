import {type RegionUndoOriginEvidence,type UndoScopedRegionCommitRequest,type UndoScopedRegionCommitResponse,deriveConfirmedRegionUndoScope,validateScopedRegionUndo,composeScopedRegionUndoTarget,createScopedRegionUndoMock,scopedRegionUndo} from 'hanaworlds-contracts';
export function consume(q:UndoScopedRegionCommitRequest,r:UndoScopedRegionCommitResponse,o:RegionUndoOriginEvidence){
 const scope=deriveConfirmedRegionUndoScope(o);
 const receipt=validateScopedRegionUndo(q,r,o);
 if(receipt.result)composeScopedRegionUndoTarget(o,receipt.result.preUndoContent);
 createScopedRegionUndoMock({origin:o,response:r}).call(scopedRegionUndo.operation,q);
 return scope;
}

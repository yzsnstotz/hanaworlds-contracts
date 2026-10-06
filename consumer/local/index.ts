import {validateType,validateCurrentRequest,validateBuildProposalContext,validateBuildProposalResponse,validateCurrentBuildSubmission,validateBoundRequest,validateCommitReadback,checkContractHandshake,contractHandshake,validateWorldSelection,validateResponse} from 'hanaworlds-contracts';
import type {LocalWorldContext,LocalRequestFacts,AdvanceCurrentBuildRequest,ValidateBuildProposalRequest,BuildProposalProviderFacts,ApplyRecoverableCommitRequest,ScopedPrepareRequest,UndoCurrentBuildRequest} from 'hanaworlds-contracts';
const context:LocalWorldContext={connectionRef:'c',connectionIncarnationRef:'i',worldRef:'w',selectionRevision:'s'};
const facts:LocalRequestFacts={currentContext:context,sessionRef:'s',currentTurnRevision:'t',currentBriefDigest:null,requestState:'ACTIVE',replay:'NEW',priorRequestDigest:null};
const request:AdvanceCurrentBuildRequest={contractVersion:'session/v3',requestId:'r',sessionRef:'s',worldRef:'w',expectedTurnRevision:'t',localContext:context};
const admission=validateCurrentRequest('session/v3','AdvanceCurrentBuild',request,facts);
const disposition:'EXECUTE'|'RETURN_STORED'=admission.disposition;
checkContractHandshake(contractHandshake);
const painter=(q:ValidateBuildProposalRequest,f:BuildProposalProviderFacts,response:unknown)=>validateBuildProposalResponse(validateBuildProposalContext(q,f),response);
const canvas=(q:ApplyRecoverableCommitRequest)=>validateBoundRequest('canvas/v5','ApplyRecoverableCommit',q);
const adapter=(q:ScopedPrepareRequest)=>validateBoundRequest('world-adapter/v6','PrepareRecoverableTransaction',q);
const undo=(q:UndoCurrentBuildRequest)=>validateBoundRequest('session/v3','UndoCurrentBuild',q);
const selection=(q:unknown,f:LocalRequestFacts,c:unknown)=>validateWorldSelection(q,f,c);
const receipt=(q:unknown)=>validateResponse('canvas/v5','Readback',q);
// @ts-expect-error permission fields are not members of the current request
request.authorizationRef='fake';
// @ts-expect-error old wire is not an admitted operation map member
validateBoundRequest('canvas/v4','ApplyRecoverableCommit',{});
void [disposition,painter,canvas,adapter,undo,selection,receipt,validateCommitReadback,validateType,validateCurrentBuildSubmission];

import {comparePosition,compareUTF16,boxCellCount,unionCellCount,publicError,snapshotJSON} from 'hanaworlds-contracts';
const compare:number=comparePosition([0,0,0],[1,0,0]);
void [compare,compareUTF16,boxCellCount,unionCellCount,publicError,snapshotJSON];

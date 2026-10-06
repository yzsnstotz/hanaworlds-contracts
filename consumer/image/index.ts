import {validateType,validateBuildProposalContext,validateBuildProposalResponse,checkBuildProposalHandshake,contractHandshake} from 'hanaworlds-contracts';
import type {MediaBinding,BuildProposalContext,ValidateBuildProposalRequest,BuildProposalProviderFacts} from 'hanaworlds-contracts';
const media:MediaBinding={attachmentRef:'stored-ref',storedBytesDigest:'a'.repeat(64),projectionVariantId:null,projectionBytesDigest:null,mediaType:'image/png',bytes:96,width:2,height:2};
const validate=(request:ValidateBuildProposalRequest,facts:BuildProposalProviderFacts,response:unknown)=>{
 const context:BuildProposalContext=facts.sourceContext;
 const retained:ReadonlyArray<MediaBinding>=context.referenceBrief.media;
 const admitted=validateBuildProposalContext(request,facts);
 const binding:MediaBinding=admitted.referenceBrief.media[0];
 return {retained,binding,result:validateBuildProposalResponse(admitted,response)};
};
validateType('MediaBinding',media);
checkBuildProposalHandshake(contractHandshake);
void validate;

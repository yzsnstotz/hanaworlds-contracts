import {
 ContractError,publicError,validateBoundResponse,createWorldErrorMock,targetWorldRef,worldUnavailableError,worldErrorContext,
 type Error as PublicError,type WorldConnectionSelectedReceipt,type SelectWorldConnectionRequest
} from 'hanaworlds-contracts';
const request:SelectWorldConnectionRequest={contractVersion:'canvas/v7',sessionRef:'s',requestId:'r',worldRef:'w',connectionRef:'c',expectedRevision:'e',expectedContext:null,connectionIncarnationRef:'i'};
const old:PublicError={code:'CAPABILITY_UNAVAILABLE',phase:'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason:'REQUIRED_FACT_UNKNOWN'};
const named:PublicError={...old,worldRef:'w'};
const response:WorldConnectionSelectedReceipt={contractVersion:'canvas/v7',requestId:'r',result:null,error:named};
validateBoundResponse('canvas/v7','SelectWorldConnection',request,response);
const target:string|undefined=targetWorldRef(request,{s:'w'});
const built:PublicError=worldUnavailableError(request,old,new Map([['s','w']]));
const carried:string|undefined=new ContractError('CAPABILITY_UNAVAILABLE','validate','REQUIRED_FACT_UNKNOWN',{worldRef:'w'}).worldRef;
const mock=createWorldErrorMock({exchanges:[]});
const mocked:WorldConnectionSelectedReceipt=mock('canvas/v7','SelectWorldConnection',request);
const field:'worldRef'=worldErrorContext.field;
// @ts-expect-error worldRef has no null form.
const nulled:PublicError={...old,worldRef:null};
// @ts-expect-error no free message on the public Error.
const messaged:PublicError={...old,message:'world w unavailable'};
// @ts-expect-error a template must not already name a world.
worldUnavailableError(request,{...old,worldRef:'w'});
void [target,built,carried,mocked,field,nulled,messaged,publicError];

import {
 describeSourceWorld,createLocalWorldSourceMock,validateBoundResponse,
 type LocalWorldsPort,type LocalWorldsDescribeSourceRequest,
 type LocalWorldsDescribeSourceResponse,type LocalWorldsSourceDescription
} from 'hanaworlds-contracts';
const request:LocalWorldsDescribeSourceRequest={contractVersion:'local-worlds/v2',requestId:'consumer-source',worldRef:'world-a'};
// An unchanged pre-extension provider still implements the complete old port.
const oldProvider:LocalWorldsPort={
 async discover(q){return {contractVersion:q.contractVersion,requestId:q.requestId,result:{worlds:[]},error:null};},
 async createWorld(q){return {contractVersion:q.contractVersion,requestId:q.requestId,result:{worldRef:'w',templateId:q.templateId,displayName:q.displayName,creationFacts:{unchanged:true}},error:null};},
 async pair(){throw Error('fixture-only unused method');},
 async deleteWorld(q){return {contractVersion:q.contractVersion,requestId:q.requestId,result:{worldRef:q.worldRef,confirmationName:q.confirmationName,deleted:true},error:null};}
};
const result:LocalWorldsSourceDescription={worldRef:'world-a',sourceLocator:{sourceOwned:{arbitrary:true}}};
const response:LocalWorldsDescribeSourceResponse={contractVersion:request.contractVersion,requestId:request.requestId,result,error:null};
validateBoundResponse('local-worlds/v2','describeSourceWorld',request,response);
const provider:LocalWorldsPort={...oldProvider,async describeSourceWorld(q){return {...response,requestId:q.requestId};}};
async function read(){
 // Public consumer helper explicitly reports CAPABILITY_UNAVAILABLE on oldProvider.
 const missing:Promise<LocalWorldsDescribeSourceResponse>=describeSourceWorld(oldProvider,request);
 const current=await describeSourceWorld(provider,request);
 const opaque:unknown=current.result?.sourceLocator;
 return [missing,opaque];
}
// @ts-expect-error Optional method must be checked before direct use.
oldProvider.describeSourceWorld(request);
// @ts-expect-error OpaqueValue cannot be interpreted as a host engine structure.
result.sourceLocator.worldPath;
// @ts-expect-error sourceLocator is not a host lifecycle field.
const host:import('hanaworlds-contracts').WorldLifecycleCreated={worldId:'w',worldRef:'w',templateId:'t',displayName:'World',creationFacts:null,sourceLocator:{}};
const mock=createLocalWorldSourceMock({exchanges:[]});
const mocked:LocalWorldsDescribeSourceResponse=mock(request);
void [read,host,mocked];

const withStartup:LocalWorldsSourceDescription={...result,sourceStartupFacts:{worldSourceOwned:true}};
const opaqueStartup:unknown=withStartup.sourceStartupFacts;
// @ts-expect-error Non-world-source clients cannot interpret engine authorization fields.
withStartup.sourceStartupFacts.httpMods;
void opaqueStartup;

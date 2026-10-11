import {
 validateRequest, validateResponse, validateBoundResponse, createWorldLifecycleMock,
 worldLifecycle, version, requestDigest,
 type WorldLifecyclePort, type EngineRuntimePort, type LocalWorldsPort,
 type WorldLifecycleCreateRequest, type EngineRuntimeStartRequest,
 type LocalWorldsPairResponse, type OperationMap
} from 'hanaworlds-contracts';
const release:string=version;
const create:WorldLifecycleCreateRequest={contractVersion:'world-lifecycle/v2',requestId:'create',templateId:'provider-template',displayName:'World'};
const q=validateRequest('world-lifecycle/v2','create',create);
const hash:string=requestDigest('world-lifecycle/v2','create',q);
const r=validateResponse('world-lifecycle/v2','create',{contractVersion:q.contractVersion,requestId:q.requestId,result:{worldId:'world',worldRef:'source-world',templateId:q.templateId,displayName:q.displayName,creationFacts:{providerOwned:[true,1]}},error:null});
const opaque:unknown=r.result?.creationFacts;
validateBoundResponse('world-lifecycle/v2','create',q,r);
const runtime:EngineRuntimeStartRequest={contractVersion:'engine-runtime/v2',requestId:'start',worldRef:'source-world',engineProfile:{opaque:true}};
validateRequest('engine-runtime/v2','StartWorldRuntime',runtime);
const fixture:unknown={exchanges:[]};
const mock=createWorldLifecycleMock(fixture);
const described=mock('world-lifecycle/v2','describe',{contractVersion:'world-lifecycle/v2',requestId:'describe'});
const canPlay:boolean|undefined=described.result?.canPlay;
const paired:LocalWorldsPairResponse=mock('local-worlds/v2','pair',{contractVersion:'local-worlds/v2',requestId:'pair',worldRef:'source-world'});
const connection:string|undefined=paired.result?.connectionIncarnationRef;
const wire:keyof OperationMap=worldLifecycle.contracts[0]!.wire;
// @ts-expect-error creationFacts is opaque, not a host-readable engine structure
r.result?.creationFacts.flatMap;
// @ts-expect-error major-1 does not implement this contract
const bad:WorldLifecycleCreateRequest={...create,contractVersion:'world-lifecycle/v1'};
// @ts-expect-error create accepts a templateId, never host-defined engine settings
const old:WorldLifecycleCreateRequest={contractVersion:'world-lifecycle/v2',requestId:'create',displayName:'World',flatMap:true};
// @ts-expect-error unknown operation is not a public port
validateRequest('engine-runtime/v2','RestartRuntime',runtime);
async function ports(w:WorldLifecyclePort,e:EngineRuntimePort,l:LocalWorldsPort){
 await w.describe({contractVersion:'world-lifecycle/v2',requestId:'d'});
 await w.list({contractVersion:'world-lifecycle/v2',requestId:'l'});
 await w.create(create);
 await w.describeDelete({contractVersion:'world-lifecycle/v2',requestId:'dd',worldId:'w'});
 await w.delete({contractVersion:'world-lifecycle/v2',requestId:'del',worldId:'w',confirmationName:'World'});
 await w.launch({contractVersion:'world-lifecycle/v2',requestId:'launch',worldId:'w'});
 await w.stop({contractVersion:'world-lifecycle/v2',requestId:'stop',connectionRef:'c'});
 await w.play({contractVersion:'world-lifecycle/v2',requestId:'play',worldId:'w'});
 await e.StartWorldRuntime(runtime);
 await e.StopWorldRuntime({contractVersion:'engine-runtime/v2',requestId:'stop',connectionRef:'c'});
 await e.ReadRuntimeStatus({contractVersion:'engine-runtime/v2',requestId:'status',connectionRef:'c'});
 await l.discover({contractVersion:'local-worlds/v2',requestId:'discover',worldRoot:'root'});
 await l.createWorld({contractVersion:'local-worlds/v2',requestId:'create',templateId:'t',displayName:'World'});
 await l.pair({contractVersion:'local-worlds/v2',requestId:'pair',worldRef:'w'});
 await l.deleteWorld({contractVersion:'local-worlds/v2',requestId:'delete',worldRef:'w',confirmationName:'World'});
}
void [release,hash,opaque,canPlay,connection,wire,bad,old,ports];

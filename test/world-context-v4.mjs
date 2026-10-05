import assert from 'node:assert/strict';
import * as C from 'hanaworlds-contracts/v4';
const plain=x=>JSON.parse(JSON.stringify(x));
const reject=(fn,code)=>assert.throws(fn,e=>e.publicError?.code===code);
const parent={contractVersion:'session/v2',actorRef:'actor',sessionRef:'session',requestId:'parent',authorizationRef:'auth',expectedRevision:'workshop-9',worldRef:'target',selectionRevision:'workshop-selection-2'};
const read={contractVersion:'canvas/v4',actorRef:'actor',sessionRef:'session',requestId:'child-read',authorizationRef:'auth',worldRef:'target'};
const binding={sessionRef:'session',sessionIncarnationRef:'inc',hostIssuerRef:'host',worldRef:'target',engineActorName:'player',expectedGrantRef:'grant',authorizationRef:'auth',actorRef:'actor',bindingRef:'b',grantEpoch:'epoch',allowedActions:['READ','SELECT']};
const context={actorRef:'actor',sessionRef:'session',authorizationRef:'auth',worldRef:'target',inventory:{capabilityRevision:'actual-cap',connections:[{adapterId:'adapter',connectionRef:'connection',worldRef:'target',displayName:'world',capabilityRevision:'actual-cap',payloadVersion:'0.2.0',readiness:'READY'}]},selection:{status:'UNBOUND',sessionRef:'session',sessionRevision:'actual-empty-cas'}};
const response={contractVersion:'canvas/v4',requestId:read.requestId,result:context,error:null};
const facts=(operation,request,ctx=context)=>({parentRequest:parent,child:{operation,request},originalBinding:binding,currentBinding:binding,liveSessionIncarnationRef:'inc',grantStatus:'CURRENT',invocationStatus:'ACTIVE',context:ctx});
const error=code=>({code,phase:'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason:'REQUIRED_FACT_UNKNOWN'});
// Existing public Switch rejects truthful failure; this must become a versioned capability.
assert.equal(typeof C.validateWorldSelectionContextResponse,'function','missing current Canvas facts operation');
assert.deepEqual(plain(C.validateWorldSelectionContextResponse(read,response)),response);
assert.deepEqual(plain(C.validateWorldContextDelegation(parent,'ReadWorldSelectionContext',read,facts('ReadWorldSelectionContext',read,null))),read);
const select={...read,requestId:'select',connectionRef:'connection',expectedRevision:'actual-empty-cas'};
assert.deepEqual(plain(C.validateWorldContextDelegation(parent,'SelectWorldConnection',select,facts('SelectWorldConnection',select))),select);
const bound=plain(context);bound.selection={status:'BOUND',connectionRef:'old-connection',context:{currentSession:'session',activeWorldRef:'old-world',orderedSelectedObjectRefs:[],sessionRevision:'canvas-42',selectionRevision:'canvas-selection-5'}};
const sw={...read,requestId:'switch',worldRef:'old-world',fromWorldRef:'old-world',toWorldRef:'target',toConnectionRef:'connection',expectedRevision:'canvas-42'};
assert.deepEqual(plain(C.validateWorldContextDelegation(parent,'SwitchWorldConnection',sw,facts('SwitchWorldConnection',sw,bound))),sw);
for(const status of ['CANCELLED','ENDED','SESSION_REPLACED']) {
 const f=facts('SelectWorldConnection',select);f.invocationStatus=status;
 reject(()=>C.validateWorldContextDelegation(parent,'SelectWorldConnection',select,f),'PERMISSION_DENIED');
}
for(const grantStatus of ['UNKNOWN','REVOKED']) {
 const f=facts('SelectWorldConnection',select);f.grantStatus=grantStatus;
 reject(()=>C.validateWorldContextDelegation(parent,'SelectWorldConnection',select,f),'AUTHORIZATION_REVOKED');
}
for(const field of Object.keys(binding)) {
 const f=facts('SelectWorldConnection',select);f.currentBinding={...binding,[field]:field==='allowedActions'?['READ']:'other'};
 reject(()=>C.validateWorldContextDelegation(parent,'SelectWorldConnection',select,f),'PERMISSION_DENIED');
}
const readonly=facts('SelectWorldConnection',select);readonly.originalBinding=readonly.currentBinding={...binding,allowedActions:['READ']};
reject(()=>C.validateWorldContextDelegation(parent,'SelectWorldConnection',select,readonly),'PERMISSION_DENIED');
for(const field of ['actorRef','sessionRef','authorizationRef','worldRef','requestId','expectedRevision']) {
 const changed={...select,[field]:'wrong'};
 reject(()=>C.validateWorldContextDelegation(parent,'SelectWorldConnection',changed,facts('SelectWorldConnection',select)),'PERMISSION_DENIED');
}
const wrongCas={...select,expectedRevision:parent.expectedRevision};
reject(()=>C.validateWorldContextDelegation(parent,'SelectWorldConnection',wrongCas,facts('SelectWorldConnection',wrongCas)),'STALE_REVISION');
const badTarget=plain(response);badTarget.result.inventory.connections[0].worldRef='other';
reject(()=>C.validateWorldSelectionContextResponse(read,badTarget),'SCHEMA_INVALID');
const badSession=plain(response);badSession.result.selection.sessionRef='other';
reject(()=>C.validateWorldSelectionContextResponse(read,badSession),'SCHEMA_INVALID');
for(const code of ['WORLD_NOT_BOUND','CAPABILITY_UNAVAILABLE','SESSION_NOT_FOUND','ADAPTER_UNAVAILABLE','TRANSACTION_CONFLICT','RECOVERY_PENDING'])
 assert.equal(C.sessionV2.response('SwitchWorldContext',{contractVersion:'session/v2',requestId:'parent',result:null,error:error(code)}).error.code,code);
reject(()=>C.sessionV2.response('SwitchWorldContext',{contractVersion:'session/v2',requestId:'parent',result:null,error:error('MODEL_UNAVAILABLE')}),'SCHEMA_INVALID');
assert.equal(C.checkWorldContextHandshake(C.contractHandshake).result,'HANDSHAKE_OPERATION_MATCH');
reject(()=>C.checkWorldContextHandshake({...C.contractHandshake,contracts:'hanaworlds-contracts@0.3.7'}),'UNSUPPORTED_VERSION');
console.log('world context SOURCE/FIXTURE: current unbound/bound facts, exact SELECT delegation, failure and capability checks passed');
// Same-world confirmed state and recovery reads use current Canvas facts, not Workshop revisions.
const same=plain(context);same.selection={status:'BOUND',connectionRef:'connection',context:{currentSession:'session',activeWorldRef:'target',orderedSelectedObjectRefs:[],sessionRevision:'canvas-after-commit',selectionRevision:'canvas-selected'}};
assert.equal(C.validateWorldSelectionContextResponse(read,{...response,result:same}).result.selection.context.sessionRevision,'canvas-after-commit');
const list={...read,requestId:'objects',expectedRevision:null};
assert.deepEqual(plain(C.validateWorldContextDelegation(parent,'ListObjects',list,facts('ListObjects',list,same))),list);
reject(()=>C.validateWorldContextDelegation(parent,'ListObjects',list,facts('ListObjects',list,context)),'WORLD_NOT_BOUND');
const connections={...read,requestId:'connections',expectedCapabilityRevision:'actual-cap'};
assert.deepEqual(plain(C.validateWorldContextDelegation(parent,'ListWorldConnections',connections,facts('ListWorldConnections',connections))),connections);
const staleConnections={...connections,expectedCapabilityRevision:'workshop-capabilities'};
reject(()=>C.validateWorldContextDelegation(parent,'ListWorldConnections',staleConnections,facts('ListWorldConnections',staleConnections)),'STALE_REVISION');
const oldInc=facts('ReadWorldSelectionContext',read,null);oldInc.liveSessionIncarnationRef='replaced';
reject(()=>C.validateWorldContextDelegation(parent,'ReadWorldSelectionContext',read,oldInc),'PERMISSION_DENIED');
const unavailable=plain(context);unavailable.inventory.connections[0].readiness='CONNECTION_UNAUTHORIZED';
reject(()=>C.validateWorldContextDelegation(parent,'SelectWorldConnection',select,facts('SelectWorldConnection',select,unavailable)),'CONNECTION_UNAUTHORIZED');
const noConnection={...select,connectionRef:'guessed'};
reject(()=>C.validateWorldContextDelegation(parent,'SelectWorldConnection',noConnection,facts('SelectWorldConnection',noConnection)),'CONNECTION_NOT_FOUND');
reject(()=>C.validateWorldContextDelegation(parent,'SelectWorldConnection',select,facts('SelectWorldConnection',select,null)),'CAPABILITY_UNAVAILABLE');
const nullBound=plain(response);nullBound.result=plain(same);nullBound.result.selection.context.activeWorldRef=null;
reject(()=>C.validateWorldSelectionContextResponse(read,nullBound),'SCHEMA_INVALID');
assert.deepEqual(plain(C.canvasV4.admit('ReadWorldSelectionContext',new TextEncoder().encode(JSON.stringify(read)))),read);
for(const code of ['CAPABILITY_UNAVAILABLE','SESSION_NOT_FOUND','ADAPTER_UNAVAILABLE']) {
 const failure={...response,result:null,error:error(code)};
 assert.equal(C.validateWorldSelectionContextResponse(read,failure).error.code,code);
 reject(()=>C.validateWorldSelectionContextResponse(read,{...failure,result:context}),'SCHEMA_INVALID');
}
reject(()=>C.validateWorldSelectionContextResponse(read,{...response,requestId:'late-other-request'}),'PERMISSION_DENIED');

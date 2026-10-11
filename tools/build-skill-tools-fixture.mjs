import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=async name=>JSON.parse(await readFile(`spec/local-world/fixtures/${name}.json`,'utf8'));
const profile=JSON.parse(await readFile('spec/local-world/profile.json','utf8'));
const main=await read('main'),region=await read('region'),facts=await read('world-source-facts');
const fact=name=>structuredClone(facts.exchanges.find(x=>x.operation===name&&x.response.result).response.result);
const hostContext={sessionRef:main.request.sessionRef,turnRef:'turn-1',turnRevision:main.request.turnRevision,localContext:main.request.localContext};
const engineFacts=fact('ReadEngineFacts'),catalogueFacts=fact('ReadCatalogue');
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
const image={mediaType:'image/png',bytesBase64:bytes.toString('base64'),bytesDigest:createHash('sha256').update(bytes).digest('hex'),byteLength:bytes.length};
const receipt={contractVersion:'canvas/v7',transactionId:'build-1',operationDigest:'1'.repeat(64),transactionPayloadDigest:'2'.repeat(64),status:'VERIFIED',previousWorldRevision:'world-1',observedWorldRevision:'world-2',readbackDigest:'3'.repeat(64),restoreStatus:'NOT_REQUIRED',error:null,localContext:hostContext.localContext,guardRefusal:null,applyFailure:null};
const undoStatus={sessionRef:hostContext.sessionRef,worldRef:hostContext.localContext.worldRef,turnRef:hostContext.turnRef,turnRevision:hostContext.turnRevision,availability:'AVAILABLE',head:{historyRevision:'history-1',headTransactionId:'build-1'}};
const undo={sessionRef:hostContext.sessionRef,worldRef:hostContext.localContext.worldRef,turnRef:hostContext.turnRef,turnRevision:hostContext.turnRevision,status:'VERIFIED',beforeHead:undoStatus.head,afterHead:{historyRevision:'history-2',headTransactionId:null}};
const legal=Object.entries(catalogueFacts.catalogue.materials).find(([ref,tags])=>ref!==catalogueFacts.catalogue.emptyMaterialRef&&tags.placeable===true&&catalogueFacts.presentation[ref]?.color);
const materialRef=legal[0],color=catalogueFacts.presentation[materialRef].color;
const data={
 hanaworlds_context:{read:[{action:'read'},{action:'read',localContext:hostContext.localContext,selectedObjectRefs:[],placementTarget:{kind:'ANCHORED_EXTENT',bounds:{min:[0,0,0],max:[0,0,0]}},engineFacts,catalogueFacts}]},
 hanaworlds_proposal:{validate:[{action:'validate',proposal:main.request.proposal},{action:'validate',proposalRef:'pending-cell-1',confirmed:false,plan:main.response.result}]},
 hanaworlds_region_proposal:{validate:[{action:'validate',proposal:region.proposalRequest.proposal},{action:'validate',proposalRef:'pending-region-1',confirmed:false,plan:region.proposalResponse.result}]},
 hanaworlds_build:{
  apply:[{action:'apply',confirmedProposalRef:'confirmed-cell-1'},{action:'apply',outcome:{sessionRef:hostContext.sessionRef,worldRef:hostContext.localContext.worldRef,turnRevision:hostContext.turnRevision,stage:'COMPLETE',outcome:'VERIFIED',receipt}}],
  inspect:[{action:'inspect'},{action:'inspect',undoStatus,receipt}],
  undo:[{action:'undo'},{action:'undo',outcome:undo}],
  redo:[{action:'redo'},{action:'redo',receipt:{...receipt,transactionId:'redo-1'}}]},
 hanaworlds_write_methods:{read:[{action:'read'},{action:'read',engineFacts,catalogueFacts}]},
 hanaworlds_download_image:{download:[{action:'download',url:'https://example.invalid/fixture.png'},{action:'download',attachmentRef:'image-1',image}]},
 hanaworlds_image_material:{match:[{action:'match',image},{action:'match',matches:[{color,materialRef,materialColor:color,deltaE:0}],algorithm:'CIEDE2000',modelCalls:0,worldWrites:0}]}
};
const error=code=>({code,phase:code==='APPLY_FAILED'?'apply':'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason:code==='APPLY_FAILED'?'APPLY_ERROR':code==='OTHER_OBJECTS_AFFECTED'?'SCOPE_DENIED':'REQUIRED_FACT_UNKNOWN'});
const exchanges=[];
for(const t of profile.toolManifest.tools)for(const a of t.actions){
 const [input,result]=data[t.name][a.action];
 const request={contractVersion:t.wire,requestId:`${t.name}-${a.action}`,hostContext,input};
 if(t.name==='hanaworlds_image_material')request.catalogueFacts=catalogueFacts;
 const guard=t.name==='hanaworlds_build'?{guardRefusal:null}:{};
 exchanges.push({wire:t.wire,operation:t.name,request,response:{contractVersion:t.wire,requestId:request.requestId,result,error:null,...guard}});
 for(const code of a.errors)exchanges.push({wire:t.wire,operation:t.name,request,response:{contractVersion:t.wire,requestId:request.requestId,result:null,error:error(code),...guard}});
}
const redoRequest={contractVersion:'session/v5',sessionRef:hostContext.sessionRef,requestId:'session-redo',worldRef:hostContext.localContext.worldRef,expectedTurnRevision:hostContext.turnRevision,expectedHistoryRevision:'history-2',localContext:hostContext.localContext};
const redoResponse={contractVersion:'session/v5',requestId:redoRequest.requestId,result:data.hanaworlds_build.redo[1].receipt,error:null,guardRefusal:null};
const canvasRedoRequest={contractVersion:'canvas/v7',sessionRef:hostContext.sessionRef,requestId:'canvas-redo',worldRef:hostContext.localContext.worldRef,objectRef:'object-1',transactionId:'redo-1',historyTransactionId:'redo-1',expectedHistoryRevision:'history-2',expectedWorldRevision:'world-2',expectedObjectRevisions:{'object-1':'object-revision-1'},intentDigest:'4'.repeat(64),surfaceActionDigest:'5'.repeat(64),localContext:hostContext.localContext};
const calls=[{wire:'session/v5',operation:'RedoCurrentBuild',request:redoRequest,response:redoResponse},{wire:'canvas/v7',operation:'Redo',request:canvasRedoRequest,response:{...redoResponse,contractVersion:'canvas/v7',requestId:canvasRedoRequest.requestId}}];
const media=[{attachmentRef:'image-1',storedBytesDigest:image.bytesDigest,projectionVariantId:null,projectionBytesDigest:null,mediaType:image.mediaType,bytes:image.byteLength,width:1,height:1}];
for(const result of [{kind:'clarification',question:'Which size?'},{kind:'proposal',proposal:{kind:'per_cell',value:main.request.proposal}},{kind:'proposal',proposal:{kind:'region',value:region.proposalRequest.proposal}},{kind:'tool_call',call:{tool:'hanaworlds_context',input:{action:'read'}}}])calls.push({wire:'skill/v1',operation:'hanaworlds-building',request:{contractVersion:'skill/v1',requestId:'skill-turn',hostContext,turn:{text:'Build from this image',media}},response:{contractVersion:'skill/v1',requestId:'skill-turn',result,error:null}});
for(const code of profile.buildingSkill.errors){const x=structuredClone(calls.at(-1));x.response.result=null;x.response.error=error(code);calls.push(x);}
await writeFile('spec/local-world/fixtures/skill-tools.json',JSON.stringify({evidence:'SOURCE/FIXTURE only. Supplied examples; no download, model call, image matching computation, world read/write, durable history or product acceptance.',exchanges,calls},null,2)+'\n');
console.log('Built skill-tools fixtures:',exchanges.length,'tool exchanges,',calls.length,'skill/Redo calls');

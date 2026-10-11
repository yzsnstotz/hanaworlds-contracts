import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import canonicalize from 'canonicalize';
const read=n=>readFile(`spec/local-world/fixtures/${n}.json`,'utf8').then(JSON.parse);
const [old,main,profile]=await Promise.all([read('skill-tools'),read('main'),readFile('spec/local-world/profile.json','utf8').then(JSON.parse)]);
const apply=old.exchanges.find(x=>x.operation==='hanaworlds_build'&&x.request.input.action==='apply'&&x.response.result);
const declaration=profile.toolManifest.tools.find(t=>t.name==='hanaworlds_build').actions.find(a=>a.action==='build');
const sha=v=>createHash('sha256').update(canonicalize(v),'utf8').digest('hex');
const exchanges=[],calls=[];
for(const operation of ['hanaworlds_proposal','hanaworlds_region_proposal']){
 const proposal=old.exchanges.find(x=>x.operation===operation&&x.response.result).request.input.proposal;
 const hostContext=structuredClone(apply.request.hostContext);
 const currentUserRequest={messageRef:`direct-${proposal.decision}`,text:'Build the requested structure in this current world',media:[]};
 const intentAuthorization={...hostContext,messageRef:currentUserRequest.messageRef,messageDigest:sha(currentUserRequest),intent:main.request.intent.confirmedIntent,proposalDigest:sha(proposal)};
 const request={...apply.request,requestId:`direct-${proposal.decision}`,input:{action:'build',proposal},intentAuthorization};
 const hostFacts={...hostContext,currentUserRequest,intentAuthorization};
 const response={...apply.response,requestId:request.requestId,result:{...apply.response.result,action:'build'}};
 exchanges.push({wire:'session/v5',operation:'hanaworlds_build',request,hostFacts,response});
 for(const code of declaration.errors){
  const error={code,phase:code==='APPLY_FAILED'?'apply':'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason:code==='OTHER_OBJECTS_AFFECTED'?'SCOPE_DENIED':code==='APPLY_FAILED'?'APPLY_ERROR':'REQUIRED_FACT_UNKNOWN'};
  exchanges.push({wire:'session/v5',operation:'hanaworlds_build',request,hostFacts,response:{...response,result:null,error}});
 }
 calls.push({wire:'skill/v1',operation:'hanaworlds-building',request:{contractVersion:'skill/v1',requestId:`skill-direct-${proposal.decision}`,hostContext,turn:{text:currentUserRequest.text,media:[]}},response:{contractVersion:'skill/v1',requestId:`skill-direct-${proposal.decision}`,result:{kind:'tool_call',call:{tool:'hanaworlds_build',input:request.input}},error:null}});
}
await writeFile('spec/local-world/fixtures/direct-build.json',JSON.stringify({evidence:'SOURCE/FIXTURE only: independently supplied mock hostFacts. No real user read, authorization authentication, Painter execution, world reads/writes or owner acceptance.',exchanges,calls},null,2)+'\n');
console.log('Built direct-build fixture',exchanges.length,'exchanges and',calls.length,'skill calls');

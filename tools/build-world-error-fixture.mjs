import {readFile,writeFile} from 'node:fs/promises';
const read=n=>readFile(`spec/local-world/fixtures/${n}.json`,'utf8').then(JSON.parse);
const [seam,tools]=await Promise.all([read('session-world'),read('skill-tools')]);
const base={phase:'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null};
const unavailable={code:'CAPABILITY_UNAVAILABLE',...base,reason:'REQUIRED_FACT_UNKNOWN'};
const adapter={code:'ADAPTER_UNAVAILABLE',...base,reason:'REQUIRED_FACT_UNKNOWN'};
const failed=(x,error)=>({...x.response,result:null,error});
const select=seam.ownerAScenario.find(x=>x.operation==='SelectWorldConnection'&&x.response.result);
const context=tools.exchanges.find(x=>x.operation==='hanaworlds_context'&&x.response.error?.code==='CAPABILITY_UNAVAILABLE');
const resume=(sessionRef,requestId)=>({contractVersion:'session/v5',sessionRef,requestId,expectedRevision:null});
const envelope=q=>({contractVersion:q.contractVersion,requestId:q.requestId,result:null});
const exchanges=[
 {title:'success is unchanged',wire:select.wire,operation:select.operation,request:select.request,response:select.response},
 {title:'request worldRef names the target world',wire:select.wire,operation:select.operation,request:select.request,response:failed(select,{...unavailable,worldRef:select.request.worldRef})},
 {title:'host-injected current world names the tool target',wire:context.wire,operation:context.operation,request:context.request,response:{...context.response,error:{...context.response.error,worldRef:context.request.hostContext.localContext.worldRef}}},
 {title:'no selector: provider resolves the trusted Session binding',wire:'session/v5',operation:'StartOrResumeSession',request:resume('fixture-session-S1','resume-bound'),response:{...envelope(resume('fixture-session-S1','resume-bound')),error:{...adapter,worldRef:'fixture-world-A'}}},
 {title:'no selector and no binding: no world context',wire:'session/v5',operation:'StartOrResumeSession',request:resume('fixture-session-unbound','resume-unbound'),response:{...envelope(resume('fixture-session-unbound','resume-unbound')),error:adapter}}
];
const legacy=[
 {title:'pre-2.7 error without worldRef stays valid',wire:select.wire,operation:select.operation,request:select.request,response:failed(select,unavailable)},
 {title:'mutationState and transactionRef are preserved beside worldRef',wire:select.wire,operation:select.operation,request:select.request,response:failed(select,{code:'READBACK_FAILED',phase:'readback',retryability:'AFTER_NEW_FACTS',mutationState:'UNKNOWN',transactionRef:'fixture-transaction-1',causeCode:null,reason:'READBACK_ERROR',worldRef:select.request.worldRef})}
];
const named=exchanges[1],e=named.response.error;
const reject=[
 {title:'another world than the request selected',code:'CURRENT_WORLD_MISMATCH',from:1,error:{...e,worldRef:'fixture-world-B'}},
 {title:'another world than the host-injected context',code:'CURRENT_WORLD_MISMATCH',from:2,error:{...exchanges[2].response.error,worldRef:'fixture-world-B'}},
 {title:'empty reference',code:'SCHEMA_INVALID',from:1,error:{...e,worldRef:''}},
 {title:'null is not a form of absence',code:'SCHEMA_INVALID',from:1,error:{...e,worldRef:null}},
 {title:'non-string reference',code:'SCHEMA_INVALID',from:1,error:{...e,worldRef:7}},
 {title:'world reference smuggled into reason',code:'SCHEMA_INVALID',from:1,error:{...unavailable,reason:'fixture-world-A'}},
 {title:'free message',code:'UNKNOWN_REQUIRED_FIELD',from:1,error:{...e,message:'world fixture-world-A is unavailable'}},
 {title:'file path',code:'UNKNOWN_REQUIRED_FIELD',from:1,error:{...e,worldPath:'/worlds/fixture-world-A'}},
 {title:'stack',code:'UNKNOWN_REQUIRED_FIELD',from:1,error:{...e,stack:'Error: at x'}},
 {title:'credential',code:'UNKNOWN_REQUIRED_FIELD',from:1,error:{...e,credential:'secret'}}
].map(({from,error,...c})=>({...c,wire:exchanges[from].wire,operation:exchanges[from].operation,request:exchanges[from].request,response:{...exchanges[from].response,error}}));
await writeFile('spec/local-world/fixtures/world-error.json',JSON.stringify({evidence:'SOURCE/FIXTURE only: no real world, Canvas, Session store or Adapter was read.',trustedSessionWorlds:{'fixture-session-S1':'fixture-world-A'},exchanges,legacy,reject},null,2)+'\n');
console.log('Built world-error fixture',exchanges.length,'exchanges',legacy.length,'legacy',reject.length,'rejections');

// Regenerates spec/local-world/fixtures/plugin-roles.json (2.9.0 world-inspection/v1 ReadPluginRoles).
// Host registrations use the service names the current plugins actually provide (hanaworlds-* src at the
// time of 2.9.0) and the skill name the C-skill buildingSkill publishes. Expected results are computed by
// derivePluginRoles, not written by hand. SOURCE/FIXTURE only. Run after `npm run build`.
import {writeFile} from 'node:fs/promises';
import * as a from '../src/local/index.mjs';
const S=(name,moduleName)=>({name,moduleName}),K=(name,provider)=>({name,provider});
const assembly={services:[
 S('hanaworldsShellUi','hanaworlds-shell-ui'),
 S('hanaworldsWorldAdapterV6','hanaworlds-adapter-luanti'),S('hanaworldsWorldAdapterRegionV1','hanaworlds-adapter-luanti'),S('hanaworldsLuantiNativeFacts','hanaworlds-adapter-luanti'),
 S('hanaworldsCanvasV5','hanaworlds-canvas'),S('hanaworldsCanvasRegionV1','hanaworlds-canvas'),S('hanaworldsCanvasDisplay','hanaworlds-canvas'),
 S('hanaworldsBrushV3','hanaworlds-brush'),
 S('hanaworldsPainterV2PictureBlocks','hanaworlds-building-exterior-painter'),
 S('hanaworldsWorkshop','hanaworlds-workshop'),S('hanaworldsWorkshopV3','hanaworlds-workshop'),
 S('hanaworldsDesktopBridge','hanaworlds-desktop-bridge'),S('hanaworldsWorldInspectionContext','hanaworlds-desktop-bridge'),S('hanaworldsPainterRegionV1','hanaworlds-desktop-bridge'),
 S('hanaworldsWorldLifecycle','hanaworlds-local-runtime'),S('hanaworldsEngineRuntime','hanaworlds-local-runtime')],
 skills:[K('hanaworlds-building','hanaworlds-skills'),K('pdf','filesystem')]};
const without=(...roles)=>{const drop=new Set(roles.flatMap(r=>a.pluginRoles.evidence[r].map(e=>e.name)));
 return {services:assembly.services.filter(s=>!drop.has(s.name)),skills:assembly.skills.filter(s=>!drop.has(s.name))};};
const hosts=[
 {title:'current assembly: every role filled',host:assembly},
 {title:'renamed world source: the role follows the registered service, not the package name',
  host:{...assembly,services:assembly.services.map(s=>s.moduleName==='hanaworlds-adapter-luanti'?{...s,moduleName:'acme-voxel-world-source'}:s)}},
 {title:'several skill providers publish the contracted skill',host:{...assembly,skills:[...assembly.skills,K('hanaworlds-building','studio-skills')]}},
 {title:'missing roles are named',host:without('brush','painter')},
 {title:'one plugin fills several roles',host:{...without('brush'),services:[...without('brush').services,S('hanaworldsBrushV3','hanaworlds-canvas')]}},
 {title:'package names and unrelated services never fill a role',host:{services:[S('hanaworldsUnrelated','hanaworlds-brush'),S('hanaworldsLuantiLocalWorlds','hanaworlds-adapter-luanti')],skills:[K('pdf','hanaworlds-skills')]}},
 {title:'nothing registered',host:{services:[],skills:[]}},
 {title:'host registrations could not be read',host:{unreadable:true}}
];
const W='world-inspection/v1',O='ReadPluginRoles';
const exchanges=hosts.map((h,i)=>{const request={contractVersion:W,requestId:`plugin-roles-${i+1}`};
 return {wire:W,operation:O,title:h.title,host:h.host,request,response:a.createPluginRolesMock(h.host)(W,O,request)};});
const ok=exchanges[0],partial=exchanges[3],failed=exchanges.at(-1);
const withResult=(x,result)=>({...x.response,result});
const reject=[
 {title:'status that does not follow from providers',code:'SCHEMA_INVALID',request:partial.request,response:withResult(partial,{...partial.response.result,status:'COMPLETE'})},
 {title:'missingRoles that omits a role without providers',code:'SCHEMA_INVALID',request:partial.request,response:withResult(partial,{...partial.response.result,missingRoles:['brush']})},
 {title:'missingRoles naming a provided role',code:'SCHEMA_INVALID',request:ok.request,response:withResult(ok,{...ok.response.result,status:'PARTIAL',missingRoles:['canvas']})},
 {title:'providers not sorted',code:'NON_CANONICAL_AMBIGUITY',request:exchanges[2].request,response:withResult(exchanges[2],{...exchanges[2].response.result,providers:{...exchanges[2].response.result.providers,skills:['studio-skills','hanaworlds-skills']}})},
 {title:'duplicate provider',code:'NON_CANONICAL_AMBIGUITY',request:ok.request,response:withResult(ok,{...ok.response.result,providers:{...ok.response.result.providers,canvas:['hanaworlds-canvas','hanaworlds-canvas']}})},
 {title:'a role key is absent',code:'SCHEMA_INVALID',request:ok.request,response:withResult(ok,{...ok.response.result,providers:Object.fromEntries(Object.entries(ok.response.result.providers).filter(([k])=>k!=='skills'))})},
 {title:'an undeclared role',code:'UNKNOWN_REQUIRED_FIELD',request:ok.request,response:withResult(ok,{...ok.response.result,providers:{...ok.response.result.providers,'model':['x']}})},
 {title:'a version is not part of the answer',code:'UNKNOWN_REQUIRED_FIELD',request:ok.request,response:withResult(ok,{...ok.response.result,versions:{}})},
 {title:'a failed read answered as empty providers',code:'SCHEMA_INVALID',request:failed.request,response:{...failed.response,result:exchanges[6].response.result}},
 {title:'neither result nor error',code:'SCHEMA_INVALID',request:failed.request,response:{...failed.response,error:null}},
 {title:'an error the operation does not declare',code:'SCHEMA_INVALID',request:failed.request,response:{...failed.response,error:new a.ContractError('WORLD_NOT_BOUND','validate','REQUIRED_FACT_UNKNOWN').publicError}},
 {title:'another request',code:'TRANSACTION_CONFLICT',request:ok.request,response:{...ok.response,requestId:'other'}}
].map(x=>({wire:W,operation:O,...x}));
for(const x of exchanges)a.validateBoundResponse(x.wire,x.operation,x.request,x.response);
for(const x of reject){try{a.validateBoundResponse(x.wire,x.operation,x.request,x.response);}catch(e){if(e.code===x.code)continue;throw new Error(`${x.title}: ${e.code}`);}throw new Error(`${x.title}: accepted`);}
await writeFile('spec/local-world/fixtures/plugin-roles.json',JSON.stringify({evidence:'SOURCE/FIXTURE only: service names are those the current plugins register; no host, loader or plugin ran.',exchanges,reject},null,2)+'\n');
console.log('Built plugin-roles fixture',exchanges.length,'exchanges',reject.length,'rejections');

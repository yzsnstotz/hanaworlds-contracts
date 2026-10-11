import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const reject=(fn,code)=>assert.throws(fn,e=>e instanceof a.ContractError&&e.code===code);
const load=async()=>JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/plugin-roles')),'utf8'));
const W='world-inspection/v1',O='ReadPluginRoles';
const ROLES=['shell-ui','world-source','canvas','brush','painter','workshop','skills','desktop-bridge','local-runtime'];
const byTitle=(f,t)=>f.exchanges.find(x=>x.title.startsWith(t));

test('ReadPluginRoles is a new world-inspection/v1 operation with new types only',()=>{
 assert.deepEqual(a.operationContracts[W].map(o=>o.operation),['ReadInspectionContext','ReadPluginRoles']);
 assert.equal(a.contractProtocols.find(p=>p.protocol==='world-inspection').minor,1);
 assert.deepEqual(a.schemaBundle.definitions.PluginRole.enum,ROLES);
 assert.deepEqual(a.schemaBundle.definitions.PluginRolesStatus.enum,['COMPLETE','PARTIAL','UNAVAILABLE']);
 assert.deepEqual(a.schemaBundle.definitions.PluginRoleProviders.required,ROLES);
 assert.deepEqual(Object.keys(a.schemaBundle.definitions.PluginRoles.properties),['status','providers','missingRoles']);
 assert.deepEqual([a.pluginRoles.provider,a.pluginRoles.consumers,a.pluginRoles.roles,a.pluginRoles.requiredRoles],['desktop-bridge',['shell-ui'],ROLES,ROLES]);
 assert.deepEqual(Object.keys(a.pluginRoles.evidence),ROLES);
 for(const role of ROLES)assert.ok(a.pluginRoles.evidence[role].length>0,role);
 const names=Object.values(a.pluginRoles.evidence).flat().map(e=>e.kind+':'+e.name);
 assert.equal(new Set(names).size,names.length,'one evidence fills exactly one role');
 assert.ok(names.every(n=>!/luanti|minetest|voxelibre/iu.test(n)),'evidence names are engine neutral');
 assert.deepEqual(a.pluginRoles.evidence.skills,[{kind:'skill',name:a.buildingSkill.name}]);
 a.validateType('ErrorCode',a.pluginRoles.errors[0]);
 assert.ok(!JSON.stringify(a.schemaBundle.definitions.PluginRoles).includes('version'));
});
test('published fixture exchanges validate and are what the mock answers',async()=>{
 const f=await load(),before=a.canonicalJSON(f);
 for(const x of f.exchanges){
  a.validateBoundResponse(x.wire,x.operation,x.request,x.response);
  assert.equal(a.canonicalJSON(a.createPluginRolesMock(x.host)(W,O,x.request)),a.canonicalJSON(x.response));
 }
 for(const x of f.reject)reject(()=>a.validateBoundResponse(x.wire,x.operation,x.request,x.response),x.code);
 assert.equal(a.canonicalJSON(f),before);
});
test('renamed world source, several skills, missing roles and one plugin with several roles',async()=>{
 const f=await load();
 const full=byTitle(f,'current assembly').response.result;
 assert.equal(full.status,'COMPLETE');assert.deepEqual(full.missingRoles,[]);
 for(const role of ROLES)assert.equal(full.providers[role].length,1,role);
 assert.deepEqual(byTitle(f,'renamed world source').response.result.providers['world-source'],['acme-voxel-world-source']);
 assert.deepEqual(byTitle(f,'several skill providers').response.result.providers.skills,['hanaworlds-skills','studio-skills']);
 const missing=byTitle(f,'missing roles').response.result;
 assert.deepEqual([missing.status,missing.missingRoles,missing.providers.brush,missing.providers.painter],['PARTIAL',['brush','painter'],[],[]]);
 const multi=byTitle(f,'one plugin fills several roles').response.result;
 assert.deepEqual([multi.providers.canvas,multi.providers.brush],[['hanaworlds-canvas'],['hanaworlds-canvas']]);
 const none=byTitle(f,'package names and unrelated').response.result;
 assert.deepEqual([none.status,none.missingRoles],['UNAVAILABLE',ROLES]);
 const failed=byTitle(f,'host registrations could not be read').response;
 assert.deepEqual([failed.result,failed.error.code,failed.error.reason],[null,'CAPABILITY_UNAVAILABLE','REQUIRED_FACT_UNKNOWN']);
});
test('derivePluginRoles reads only the evidence table and refuses unnamed registrations',()=>{
 const r=a.derivePluginRoles({services:[{name:'hanaworldsCanvasV5',moduleName:'b'},{name:'hanaworldsCanvasRegionV1',moduleName:'a'},{name:'hanaworldsCanvasV5',moduleName:'b'}]});
 assert.deepEqual(r.providers.canvas,['a','b']);
 assert.equal(r.status,'PARTIAL');assert.equal(r.missingRoles.length,ROLES.length-1);
 assert.ok(Object.isFrozen(r));
 assert.throws(()=>a.derivePluginRoles({services:[{name:'hanaworldsCanvasV5'}]}),TypeError);
 assert.throws(()=>a.derivePluginRoles({skills:[{name:'hanaworlds-building',provider:''}]}),TypeError);
 const request={contractVersion:W,requestId:'r'};
 assert.equal(a.pluginRolesResponse(request,r).result.status,'PARTIAL');
 reject(()=>a.pluginRolesResponse(request,{...r,status:'COMPLETE'}),'SCHEMA_INVALID');
 const u=a.pluginRolesUnavailable(request);
 assert.deepEqual([u.result,u.error.code],[null,'CAPABILITY_UNAVAILABLE']);
 assert.throws(()=>a.createPluginRolesMock({})('canvas/v7','SelectWorldConnection',request),TypeError);
});
test('an older SDK has no ReadPluginRoles; consuming it requires world-inspection minor 1',()=>{
 assert.match(a.pluginRoles.compatibility,/minor 0 -> 1/u);
 assert.equal(a.canonicalJSON(a.protocolRequirement(W,[],1)),a.canonicalJSON({protocol:'world-inspection',major:1,minMinor:1,capabilities:[]}));
 reject(()=>a.validateRequest(W,'ReadPluginRolesV2',{contractVersion:W,requestId:'r'}),'UNSUPPORTED_OPERATION');
});

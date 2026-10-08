// session-world-seam/v1 conformance (SOURCE/FIXTURE). Consumers run this against the exact
// installed package; it proves payload shapes and pure checks, not provider behaviour.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const fx=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/session-world'))));
const v053=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/profile'))));
let passed=0;function test(name,fn){fn();console.log('ok',++passed,name)}
const SD='session/v3',CS='canvas/v5';
test('exact candidate package; seam operations are appended minors of existing wires',()=>{
 assert.equal(a.version,'0.5.4-rc.1');a.checkContractHandshake(a.contractHandshake);
 assert.ok(!a.wireVersions.some(w=>/session-directory|canvas-session-world/.test(w)));
 assert.deepEqual(a.operationContracts[SD].slice(13).map(o=>o.operation),['ReadSessionIdentity','ListSessions']);
 assert.deepEqual(a.operationContracts[CS].slice(20).map(o=>o.operation),['UnselectWorldConnection','RetireSessionSelection','ListWorldSelections','ReserveWorldRetirement','ReleaseWorldRetirement']);
 assert.deepEqual(a.ownership[SD],{domainOwner:'Workshop',mutationCaller:'none'});
 assert.deepEqual(a.ownership[CS],{domainOwner:'Canvas',mutationCaller:'Canvas only'});
 assert.equal(a.sessionWorldSeam.id,'session-world-seam/v1');
 assert.ok(a.contractProtocols.some(p=>p.protocol==='session'&&p.major===3&&p.minor===1));
 assert.ok(a.contractProtocols.some(p=>p.protocol==='canvas'&&p.major===5&&p.minor===1));
 assert.equal(v053.version,'0.5.4-rc.1');
});
test('no Adapter-owned binding authority and no breaking Readiness value',()=>{
 for(const ops of Object.values(a.operationContracts))for(const o of ops)assert.ok(!['ReadSessionWorldBinding','BindSessionWorld','UnbindSessionWorld'].includes(o.operation));
 assert.deepEqual(a.schemaBundle.definitions.Readiness.enum,['READY','ADAPTER_UNAVAILABLE','PAYLOAD_VERSION_MISMATCH','CAPABILITY_UNAVAILABLE']);
 assert.throws(()=>a.validateType('Readiness','STOPPED'),{code:'SCHEMA_INVALID'});
 assert.equal(a.ownership['world-adapter/v6'].domainOwner,'Adapter transport');
});
test('G-S Workshop session directory: read, list and named unknown Session',()=>{
 const {list,read,unknown}=fx.sessionDirectory;
 a.validateBoundResponse(SD,'ListSessions',list.request,list.response);
 a.validateBoundResponse(SD,'ReadSessionIdentity',read.request,read.response);
 assert.equal(a.validateBoundResponse(SD,'ReadSessionIdentity',unknown.request,unknown.response).error.code,'SESSION_NOT_FOUND');
 assert.throws(()=>a.validateBoundResponse(SD,'ReadSessionIdentity',{...read.request,sessionRef:'other'},read.response));
 const shuffled=structuredClone(list.response);shuffled.result.sessions.reverse();
 assert.throws(()=>a.validateResponse(SD,'ListSessions',shuffled),{code:'SCHEMA_INVALID'});
 const dup=structuredClone(list.response);dup.result.sessions[1].sessionRef=dup.result.sessions[0].sessionRef;
 assert.throws(()=>a.validateResponse(SD,'ListSessions',dup),{code:'SCHEMA_INVALID'});
 assert.throws(()=>a.validateRequest(SD,'ReadSessionIdentity',{...read.request,providerToken:'x'}),{code:'UNKNOWN_REQUIRED_FIELD'});
});
test('owner A scenario: every step is a valid bound request/response pair',()=>{
 for(const s of fx.ownerAScenario){const r=a.validateBoundResponse(s.wire,s.operation,s.request,s.response);assert.ok((r.result===null)!==(r.error===null),s.title);}
});
const step=n=>fx.ownerAScenario.find(s=>s.title.startsWith(n+' '));
test('one current World per Session; S1/S2 share A; S1 A->B->A keeps S2 on A',()=>{
 assert.equal(step(1).response.result.selection.status,'UNBOUND');
 assert.equal(step(2).response.result.activeWorldRef,'fixture-world-A');
 assert.equal(step(3).response.result.activeWorldRef,'fixture-world-A');
 assert.deepEqual(step(4).response.result.sessionRefs,['fixture-session-S1','fixture-session-S2']);
 assert.equal(step(5).response.result.activeWorldRef,'fixture-world-B');
 assert.deepEqual(step(6).response.result.sessionRefs,['fixture-session-S2']);
 assert.equal(step(7).response.result.activeWorldRef,'fixture-world-A');
 const two=structuredClone(step(4).response);two.result.sessionRefs=['fixture-session-S2','fixture-session-S1'];
 assert.throws(()=>a.validateResponse(CS,'ListWorldSelections',two),{code:'SCHEMA_INVALID'});
});
test('G-U unbind returns UNBOUND-shaped CurrentContext and rejects a mismatched context',()=>{
 const s=step(9);
 const bad=structuredClone(s.response);bad.result.activeWorldRef='fixture-world-A';bad.result.localContext=s.request.expectedContext;
 assert.throws(()=>a.validateBoundResponse(CS,'UnselectWorldConnection',s.request,bad));
 assert.throws(()=>a.validateRequest(CS,'UnselectWorldConnection',{...s.request,worldRef:'fixture-world-B'}),{code:'SCHEMA_INVALID'});
 const other=structuredClone(s.response);other.result.currentSession='fixture-session-S2';
 assert.throws(()=>a.validateBoundResponse(CS,'UnselectWorldConnection',s.request,other));
});
test('G-L Session retirement releases its world and the deleted Session is unknown',()=>{
 assert.equal(step(10).response.result.releasedWorldRef,'fixture-world-A');
 assert.equal(step(15).response.error.code,'SESSION_NOT_FOUND');
 assert.throws(()=>a.validateBoundResponse(CS,'RetireSessionSelection',{...step(10).request,sessionRef:'fixture-session-S1'},step(10).response));
});
test('G-D bound world cannot be retired; reservation serializes selection; release is exact',()=>{
 assert.throws(()=>a.requireWorldRetirable(step(4).response.result),{code:'TRANSACTION_CONFLICT'});
 assert.throws(()=>a.requireWorldRetirable({...step(11).response.result,retirementReservationRef:'other'}),{code:'TRANSACTION_CONFLICT'});
 a.requireWorldRetirable(step(11).response.result);
 assert.equal(step(8).response.error.code,'TRANSACTION_CONFLICT');
 assert.equal(step(13).response.error.code,'TRANSACTION_CONFLICT');
 assert.throws(()=>a.validateBoundResponse(CS,'ReserveWorldRetirement',{...step(12).request,expectedInventoryRevision:'stale'},step(12).response));
 assert.throws(()=>a.validateBoundResponse(CS,'ReleaseWorldRetirement',{...step(14).request,outcome:'ABORTED'},step(14).response));
 assert.throws(()=>a.validateRequest(CS,'ReleaseWorldRetirement',{...step(14).request,outcome:'DELETED'}),{code:'SCHEMA_INVALID'});
});
test('C2/C3 connection state is derived, never upgraded from a stale incarnation',()=>{
 const {boundS2A,unboundS1}=fx.connectionState,inv=fx.adapterInventory;
 assert.equal(a.describeSelectionConnection(unboundS1,inv.A).status,'UNBOUND');
 assert.equal(a.describeSelectionConnection(boundS2A,inv.A).status,'CONNECTED');
 assert.equal(a.describeSelectionConnection(boundS2A,inv.AReopened).status,'SELECTED_NOT_CONNECTED');
 assert.equal(a.describeSelectionConnection(boundS2A,inv.AStopped).status,'SELECTED_NOT_CONNECTED');
 const notReady=structuredClone(inv.A);notReady.connections[0].readiness='ADAPTER_UNAVAILABLE';
 assert.equal(a.describeSelectionConnection(boundS2A,notReady).status,'SELECTED_NOT_CONNECTED');
 const nullLocal=structuredClone(boundS2A);nullLocal.context.localContext=null;
 assert.throws(()=>a.validateType('CanvasWorldSelection',nullLocal),{code:'SCHEMA_INVALID'});
});
test('G-L: no persistent delete capability means named refusal and no Canvas retirement',()=>{
 const d=fx.sessionDeletion;
 assert.throws(()=>a.requireSessionDeleteSupported(d.unsupportedCapabilities),{code:'SESSION_DELETE_UNSUPPORTED',reason:'DELETE_SEAM_ABSENT'});
 a.requireSessionDeleteSupported(d.supportedCapabilities);
 const u=a.validateBoundResponse(SD,'DeleteSession',d.unsupported.request,d.unsupported.response);
 assert.equal(u.error.code,'SESSION_DELETE_UNSUPPORTED');assert.equal(d.unsupported.retireCalled,false);
 const ok=a.validateBoundResponse(SD,'DeleteSession',d.deleted.request,d.deleted.response);
 assert.equal(ok.result.deleted,true);assert.equal(step(d.deleted.afterRetireStep).response.result.sessionRef,ok.result.sessionRef);
 assert.match(a.sessionWorldSeam.sequences.deleteSession,/not deletion/);
});
test('existing v0.5.3 operations keep their order and still validate',()=>{
 const before={'session/v3':13,'canvas/v5':20,'world-adapter/v6':16};
 for(const n of ['ReadWorldSelectionContext','SelectWorldConnection','SwitchWorldConnection'])assert.ok(a.operationContracts['canvas/v5'].slice(0,20).some(o=>o.operation===n));
 assert.equal(a.operationContracts['session/v3'][0].operation,'StartOrResumeSession');assert.equal(a.operationContracts['canvas/v5'][19].operation,'ReadWorldSelectionContext');
 assert.equal(a.operationContracts['world-adapter/v6'].length,before['world-adapter/v6']);
});
console.log(JSON.stringify({evidence:'SOURCE/FIXTURE',seam:'session-world-seam/v1',checks:passed,providerImplementations:'NOT_RUN',realRuntime:'NOT_RUN'}));

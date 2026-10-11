import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const reject=(fn,code)=>assert.throws(fn,e=>e instanceof a.ContractError&&e.code===code);
const load=async()=>JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/history-receipt')),'utf8'));
const W='world-adapter/v8',O='QueryTransaction';

test('QueryTransactionResponse gains exactly the optional non-null pair; ReceiptProjection is untouched',()=>{
 const r=a.schemaBundle.definitions.QueryTransactionResponse;
 assert.deepEqual(r.required,['contractVersion','requestId','result','error']);
 assert.deepEqual(Object.keys(r.properties),['contractVersion','requestId','result','error','currentLocalContext','receiptDigest']);
 assert.deepEqual(r.properties.currentLocalContext,{$ref:'#/definitions/LocalWorldContext'});
 assert.deepEqual(r.properties.receiptDigest,{$ref:'#/definitions/Digest'});
 assert.equal(r.additionalProperties,false);
 assert.deepEqual(r.properties.result,{anyOf:[{$ref:'#/definitions/ReceiptProjection'},{type:'null'}]});
 assert.equal(a.historicalReceipt.introducedIn,'2.8.0');
 assert.deepEqual([a.historicalReceipt.wire,a.historicalReceipt.operation],[W,O]);
 assert.equal(a.historicalReceipt.fixture,'hanaworlds-contracts/fixtures/history-receipt');
 assert.ok(a.contractProtocols.find(p=>p.protocol==='world-adapter').minor>=3);
});
test('same instance and same world after reconnect pass; the written context stays readable',async()=>{
 const f=await load();
 for(const x of f.exchanges){
  a.admitType(a.operationContracts[x.wire].find(o=>o.operation===x.operation).response,Buffer.from(JSON.stringify(x.response)));
  assert.equal(a.canonicalJSON(a.validateBoundResponse(x.wire,x.operation,x.request,x.response)),a.canonicalJSON(x.response),x.title);
 }
 const [plain,same,again]=f.exchanges;
 const r0=a.readHistoricalReceipt(plain.request,plain.response);
 assert.deepEqual([r0.historical,r0.sameIncarnation,r0.receiptDigest],[false,true,f.durable[0].receiptDigest]);
 const r1=a.readHistoricalReceipt(same.request,same.response);
 assert.deepEqual([r1.historical,r1.sameIncarnation,r1.sameSelectionRevision],[true,true,true]);
 const r=a.readHistoricalReceipt(again.request,again.response);
 assert.deepEqual([r.historical,r.sameConnection,r.sameIncarnation,r.sameSelectionRevision],[true,true,false,false]);
 assert.equal(a.canonicalJSON(r.writtenContext),a.canonicalJSON(f.durable[0].receipt.localContext),'never re-bound');
 assert.equal(a.canonicalJSON(r.currentContext),a.canonicalJSON(again.request.localContext));
 assert.equal(r.receiptDigest,f.durable[0].receiptDigest);
 assert.equal(a.digestValue('receipt',r.receipt).sha256,r.receiptDigest,'equals HistoryEntry.receiptDigest');
 assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.writtenContext));
});
test('another world, stale envelope, re-binding, tampering and malformed pairs reject',async()=>{
 const f=await load();
 assert.ok(f.reject.length>=13);
 for(const c of f.reject)reject(()=>a.validateBoundResponse(c.wire,c.operation,c.request,c.response),c.code);
 const repro=f.reject[0];
 assert.notEqual(repro.response.result.localContext.connectionIncarnationRef,repro.request.localContext.connectionIncarnationRef);
 assert.ok(!Object.hasOwn(repro.response,'currentLocalContext'),'the pre-2.8 full-equality rule is unchanged');
});
test('other operations refuse the pair and keep full localContext equality',async()=>{
 const f=await load(),pair=f.exchanges[2].response;
 const seam=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/session-world')),'utf8'));
 const select=seam.ownerAScenario.find(x=>x.operation==='SelectWorldConnection'&&x.response.result);
 reject(()=>a.validateBoundResponse(select.wire,select.operation,select.request,{...select.response,currentLocalContext:pair.currentLocalContext,receiptDigest:pair.receiptDigest}),'UNKNOWN_REQUIRED_FIELD');
 reject(()=>a.validateType('QueryTransactionResponse',{...pair,currentLocalContext:{...pair.currentLocalContext,extra:'x'}}),'UNKNOWN_REQUIRED_FIELD');
});
test('provider builder and published mock answer as written, refuse another world and tampered storage',async()=>{
 const f=await load(),before=a.canonicalJSON(f),stored=f.durable[0],again=f.exchanges[2];
 const built=a.historicalReceiptResponse(again.request,stored.receipt,stored.receiptDigest);
 assert.equal(a.canonicalJSON(built),a.canonicalJSON(again.response));
 reject(()=>a.historicalReceiptResponse(again.request,stored.receipt,'f'.repeat(64)),'NON_CANONICAL_AMBIGUITY');
 const mock=a.createHistoricalReceiptMock(f);
 const fresh={...again.request,requestId:'fresh',localContext:{...again.request.localContext,connectionIncarnationRef:'fixture-incarnation-9'}};
 const m=mock(W,O,fresh);
 assert.deepEqual([m.requestId,m.currentLocalContext.connectionIncarnationRef,m.result.localContext.connectionIncarnationRef,m.receiptDigest],['fresh','fixture-incarnation-9','fixture-incarnation-1',stored.receiptDigest]);
 assert.ok(Object.isFrozen(m));
 const other=f.reject.find(c=>c.title==='receipt of another world').request;
 const refused=mock(W,O,other);
 assert.deepEqual([refused.result,refused.error.code,refused.error.worldRef,refused.error.mutationState],[null,'CURRENT_WORLD_MISMATCH',other.worldRef,'NONE']);
 assert.throws(()=>mock(W,O,{...fresh,transactionId:'unknown'}),TypeError);
 assert.throws(()=>mock('canvas/v7','SelectWorldConnection',{}),e=>e instanceof a.ContractError||e instanceof TypeError);
 const bad=structuredClone(f);bad.durable[0].receipt.status='ROLLED_BACK';
 assert.throws(()=>a.createHistoricalReceiptMock(bad),a.ContractError);
 assert.equal(a.canonicalJSON(f),before);
});
test('a pre-2.8 closed decoder shape refuses the pair; consuming it requires the new SDK',async()=>{
 const f=await load(),r=f.exchanges[2].response;
 const old=structuredClone(a.schemaBundle.definitions.QueryTransactionResponse);
 delete old.properties.currentLocalContext;delete old.properties.receiptDigest;
 assert.equal(old.additionalProperties,false);
 assert.ok(Object.keys(r).some(k=>!Object.hasOwn(old.properties,k)));
 assert.match(a.historicalReceipt.compatibility,/UNKNOWN_REQUIRED_FIELD/u);
 assert.match(a.historicalReceipt.compatibility,/minor 2 -> 3/u);
});

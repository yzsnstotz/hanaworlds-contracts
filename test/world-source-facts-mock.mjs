// SOURCE/FIXTURE only: reusable provider double, no engine, host or persistence.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const fx=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/world-source-facts'))));
let createMock;
try { ({createWorldSourceFactsMock:createMock}=await import('../consumer/world-source-facts/mock.mjs')); }
catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
test('fixture provider implements all six named operations with fresh request correlation',()=>{
 assert.equal(typeof createMock,'function');
 const provider=createMock(fx);
 for(const o of a.worldSourceFacts.operations){
  const exchange=fx.exchanges.find(x=>x.operation===o.operation&&x.response.result!==null);
  const request={...exchange.request,requestId:'mock-'+o.operation};
  const response=provider(o.wire,o.operation,request);
  assert.equal(response.requestId,request.requestId);
  assert.equal(a.canonicalJSON(response.result),a.canonicalJSON(exchange.response.result));
  a.validateBoundResponse(o.wire,o.operation,request,response);
 }
});
test('fixture provider refuses unknown World or inspection Session by name',()=>{
 assert.equal(typeof createMock,'function');
 const provider=createMock(fx);
 for(const operation of ['ReadCatalogue','ReadInspectionContext']){
  const x=fx.exchanges.find(x=>x.operation===operation);
  assert.equal(provider(x.wire,operation,{...x.request,worldRef:'unbound'}).error.code,'WORLD_NOT_BOUND');
 }
 const x=fx.exchanges.find(x=>x.operation==='ReadInspectionContext');
 assert.equal(provider(x.wire,x.operation,{...x.request,sessionRef:'unknown'}).error.code,'SESSION_NOT_FOUND');
});
test('fixture provider supports every declared operation error and strict admission',()=>{
 assert.equal(typeof createMock,'function');
 for(const o of a.worldSourceFacts.operations){
  const x=fx.exchanges.find(x=>x.operation===o.operation);
  for(const code of o.errors){
   const response=createMock(fx,{[o.operation]:code})(o.wire,o.operation,x.request);
   assert.equal(response.result,null);assert.equal(response.error.code,code);
   a.validateBoundResponse(o.wire,o.operation,x.request,response);
  }
 }
 const x=fx.exchanges[0];
 assert.throws(()=>createMock(fx)(x.wire,x.operation,{...x.request,extra:'not allowed'}),e=>e.code==='UNKNOWN_REQUIRED_FIELD');
 const response=createMock(fx)(x.wire,x.operation,x.request);
 assert.ok(Object.isFrozen(response));assert.ok(Object.isFrozen(response.result));
});

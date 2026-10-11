import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as old from 'old-contracts';
import * as current from 'hanaworlds-contracts';
const f=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/history-receipt')),'utf8'));
assert.equal(old.version,'2.7.0');assert.equal(current.version,'2.8.0');
let oldAccepted=0,oldRefused=0,sameRefusal=0;
const paired=x=>Object.hasOwn(x.response,'currentLocalContext')||Object.hasOwn(x.response,'receiptDigest');
// Responses from an unchanged 2.7.0 provider (no pair) decide identically in both SDKs.
for(const x of f.exchanges.filter(x=>!paired(x))){
 assert.equal(current.canonicalJSON(old.validateBoundResponse(x.wire,x.operation,x.request,x.response)),current.canonicalJSON(current.validateBoundResponse(x.wire,x.operation,x.request,x.response)));
 oldAccepted++;
}
for(const x of f.reject.filter(x=>!paired(x))){
 assert.throws(()=>old.validateBoundResponse(x.wire,x.operation,x.request,x.response),e=>e.code===x.code);
 assert.throws(()=>current.validateBoundResponse(x.wire,x.operation,x.request,x.response),e=>e.code===x.code);
 sameRefusal++;
}
// The 2.7.0 closed decoder refuses the pair; it is never silently ignored.
for(const x of f.exchanges.filter(paired)){
 assert.throws(()=>old.validateBoundResponse(x.wire,x.operation,x.request,x.response),e=>e.code==='UNKNOWN_REQUIRED_FIELD');
 current.validateBoundResponse(x.wire,x.operation,x.request,x.response);
 oldRefused++;
}
assert.equal(old.checkContractsVersion(current.contractHandshake.contracts).result,'CONTRACTS_MAJOR_MATCH');
assert.equal(current.checkContractsVersion(old.contractHandshake.contracts).result,'CONTRACTS_MAJOR_MATCH');
console.log(JSON.stringify({oldAccepted,oldRefused,sameRefusal}));

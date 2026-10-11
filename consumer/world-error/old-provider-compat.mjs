import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as old from 'old-contracts';
import * as current from 'hanaworlds-contracts';
const f=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/world-error')),'utf8'));
assert.equal(old.version,'2.6.0');assert.equal(current.version,'2.7.0');
let oldAccepted=0,oldRefused=0;
// Errors from an unchanged 2.6.0 provider (no worldRef) are accepted unchanged by the 2.7.0 consumer.
for(const x of [...f.exchanges,...f.legacy].filter(x=>x.response.error===null||!Object.hasOwn(x.response.error,'worldRef'))){
 const e=x.response.error;
 if(e)assert.equal(current.canonicalJSON(new old.ContractError(e.code,e.phase,e.reason,e).publicError),current.canonicalJSON(e));
 assert.equal(current.canonicalJSON(current.validateBoundResponse(x.wire,x.operation,x.request,x.response)),current.canonicalJSON(x.response));
 old.validateBoundResponse(x.wire,x.operation,x.request,x.response);
 oldAccepted++;
}
// The 2.6.0 closed decoder refuses an error naming its world; it is never silently ignored.
for(const x of [...f.exchanges,...f.legacy].filter(x=>x.response.error&&Object.hasOwn(x.response.error,'worldRef'))){
 assert.throws(()=>old.validateType('Error',x.response.error),e=>e.code==='UNKNOWN_REQUIRED_FIELD');
 assert.throws(()=>old.validateBoundResponse(x.wire,x.operation,x.request,x.response),e=>e.code==='UNKNOWN_REQUIRED_FIELD');
 current.validateBoundResponse(x.wire,x.operation,x.request,x.response);
 oldRefused++;
}
// Same package major: the old SDK admits the new package version and handshake.
assert.equal(old.checkContractsVersion(current.contractHandshake.contracts).result,'CONTRACTS_MAJOR_MATCH');
assert.equal(current.checkContractsVersion(old.contractHandshake.contracts).result,'CONTRACTS_MAJOR_MATCH');
console.log(JSON.stringify({oldAccepted,oldRefused}));

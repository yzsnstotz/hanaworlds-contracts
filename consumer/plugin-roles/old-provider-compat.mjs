import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as old from 'old-contracts';
import * as current from 'hanaworlds-contracts';
const f=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/plugin-roles')),'utf8'));
assert.equal(old.version,'2.8.0');assert.equal(current.version,'2.9.0');
let oldRefused=0,currentAccepted=0;
// The 2.8.0 SDK has no ReadPluginRoles: it refuses the operation, it never answers an empty role map.
for(const x of f.exchanges){
 assert.throws(()=>old.validateRequest(x.wire,x.operation,x.request),e=>e.code==='UNSUPPORTED_OPERATION');
 current.validateBoundResponse(x.wire,x.operation,x.request,x.response);
 oldRefused++;currentAccepted++;
}
// Every operation the 2.8.0 SDK knows is unchanged in 2.9.0.
for(const [wire,ops] of Object.entries(old.operationContracts))for(const o of ops)
 assert.deepEqual({...current.operationContracts[wire].find(c=>c.operation===o.operation)},{...o});
assert.equal(old.checkContractsVersion(current.contractHandshake.contracts).result,'CONTRACTS_MAJOR_MATCH');
assert.equal(current.checkContractsVersion(old.contractHandshake.contracts).result,'CONTRACTS_MAJOR_MATCH');
console.log(JSON.stringify({oldRefused,currentAccepted}));

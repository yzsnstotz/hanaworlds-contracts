import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as old from 'old-contracts';
import * as current from 'hanaworlds-contracts';
const f=JSON.parse(await readFile(new URL(import.meta.resolve('old-contracts/fixtures/skill-tools')),'utf8'));
assert.equal(old.version,'2.5.0');assert.equal(current.version,'2.6.0');
let count=0;
for(const x of f.exchanges){
 const oldProvider=old.createSkillToolsMock(f,{[`${x.operation}:${x.request.input.action}`]:x.response.error?.code});
 const q=current.validateToolRequest(x.operation,{...x.request,requestId:'old-implementation'},x.request.hostContext);
 const result=oldProvider(x.operation,q,q.hostContext);
 current.validateToolResponse(x.operation,q,result);
 assert.equal(result.requestId,'old-implementation');
 assert.equal(current.canonicalJSON(result),current.canonicalJSON({...x.response,requestId:'old-implementation'}));
 count++;
}
console.log('Independent published 2.5.0 provider => 2.6.0 consumer:',count,'old exchanges compatible');
console.log(import.meta.resolve('hanaworlds-contracts'));
console.log(import.meta.resolve('old-contracts'));

import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const get=async path=>readFile(new URL(import.meta.resolve('hanaworlds-contracts/'+path)));
const inventory=JSON.parse(await get('schema-inventory'));
const bundle=JSON.parse(await get('schema'));
assert.equal(Object.keys(bundle.definitions).length,243);assert.equal(inventory.types.length,243);
const files=[];
for(const name of inventory.types){const bytes=await get('schema/'+name);const schema=JSON.parse(bytes);assert.equal(schema.$ref,'#/definitions/'+name);assert.equal(Object.keys(schema.definitions).length,243);files.push({path:'node_modules/hanaworlds-contracts/schemas/'+name+'.schema.json',sha256:createHash('sha256').update(bytes).digest('hex')});}
await writeFile('schema-files.json',JSON.stringify({evidence:'FIXTURE',mode:'public-exports-artifact-extraction-diagnostic',files},null,2)+'\n');
console.log(JSON.stringify({result:'PASS',publicSchemaDocuments:files.length+1,definitionCount:243,providerRuntime:'NOT_RUN',npmInstalled:false}));

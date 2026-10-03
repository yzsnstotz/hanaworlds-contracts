/** Copy this file outside the repository before execution. Only public package
 * exports are used. Diagnostic source-loader executions must be labelled FIXTURE. */
import * as C from 'hanaworlds-contracts';
import * as F from 'hanaworlds-contracts/fixture';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=async name=>JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/'+name)),'utf8'));
const vectors=(await read('production-goldens')).vectors,wires=(await read('wire-inputs')).requests,events=(await read('canvas-events')).cases;
const result={evidence:process.env.DIAGNOSTIC_SOURCE_LOADER==='1'?'FIXTURE':'PACKAGE_REAL_RUNTIME',mode:process.env.DIAGNOSTIC_SOURCE_LOADER==='1'?'manually-extracted-artifact-with-explicit-upstream-source-loader':'installed-package-public-exports',version:C.version,providerRuntime:'NOT_RUN',worldWrites:0,providerQueries:0,goldens:[],requests:[],events:[],exports:[],loadedFiles:[]};
const pkg=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/package.json')),'utf8'));
assert.equal(C.version,pkg.version);assert.equal(C.schemaInventory.length,243);
for(const g of vectors){const d=C.digestValue(g.kind,g.payload);for(const field of ['canonicalUtf8','preimageUtf8','preimageHex','sha256'])assert.equal(d[field],g.expected[field]);assert.deepEqual(JSON.parse(JSON.stringify(d.projection)),g.payload);result.goldens.push({id:g.id,sha256:d.sha256,status:'PASS'});}
for(const q of wires){const binding=await import('hanaworlds-contracts/'+q.wire);const actual=binding.admit(q.operation,new TextEncoder().encode(JSON.stringify(q.request)));assert.deepEqual(JSON.parse(JSON.stringify(actual)),q.request);result.requests.push({id:q.id,status:'PASS'});}
for(const [name,target]of Object.entries(pkg.exports)){
 if(typeof target==='object'&&target.import){const specifier=name==='.'?pkg.name:pkg.name+'/'+name.slice(2);const mod=await import(specifier);const url=new URL(import.meta.resolve(specifier));result.exports.push({specifier,names:Object.keys(mod).sort()});result.loadedFiles.push({path:'node_modules/hanaworlds-contracts/'+target.import.slice(2),sha256:createHash('sha256').update(await readFile(url)).digest('hex')});}
}
const eventNames=new Set();for(const c of events){const a=F.evaluateCanvasEventFixture(c.eventType,c.input);for(const[k,v]of Object.entries(c.expected))assert.deepEqual(a[k],v,c.id+'.'+k);result.events.push({id:c.id,status:'PASS'});eventNames.add(c.eventType);}
assert.equal(eventNames.size,14);
let error;try{C.admitType('Text',new TextEncoder().encode('{"a":1,"\\u0061":2}'));}catch(e){error=e.publicError;}
assert.equal(error?.code,'NON_CANONICAL_AMBIGUITY');assert.equal(error?.phase,'decode');assert.equal(error?.reason,'DUPLICATE_DECODED_KEY');assert.equal(error?.mutationState,'NONE');
result.strictDuplicateAdmission='PASS';result.compatibility=C.runtimeCompatibility();result.uninstallOrInstallClaimed=false;
await writeFile('consumer-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({result:'PASS',evidence:result.evidence,mode:result.mode,goldens:result.goldens.length,requests:result.requests.length,events:result.events.length,exports:result.exports.length,strictDuplicateAdmission:result.strictDuplicateAdmission,compatible:result.compatibility.compatible,providerRuntime:'NOT_RUN'}));

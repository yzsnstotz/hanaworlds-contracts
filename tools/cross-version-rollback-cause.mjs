// Cross-version check for the 1.2 region rollback cause (qualified optional field, protocolPolicy.minor):
// run with two installed package directories, the previous minor (old, 1.1.0) and the candidate (new).
// SOURCE/PACK/FIXTURE only.
//   node tools/cross-version-rollback-cause.mjs <old package dir> <new package dir>
// Asserts: every old fixture file is byte-identical in the new package; old region commit/undo values are
// accepted by the new package with unchanged digests; handshakes accept each other with the same wires;
// a result carrying a rollback cause is refused by the old strict decoder (fail-closed) and a rollback
// without one is accepted by both, the new package reading it as UNKNOWN; the new package still refuses
// every malformed cause.
import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const [oldDir,newDir]=process.argv.slice(2);
const o=await import(pathToFileURL(oldDir+'/dist/local/index.mjs')),n=await import(pathToFileURL(newDir+'/dist/local/index.mjs'));
const fx=async(dir,name)=>JSON.parse(await readFile(`${dir}/fixtures/local/${name}.json`,'utf8'));
const rows=[];const check=(id,what,fn)=>{fn();rows.push({id,what,result:'PASS'});};
const refused=(fn,code)=>{try{fn();}catch(e){assert.equal(e.code,code);return e;}assert.fail('accepted');};
const oldFixtures=(await readdir(oldDir+'/fixtures/local')).sort();
for(const f of oldFixtures)assert.ok((await readFile(`${oldDir}/fixtures/local/${f}`)).equals(await readFile(`${newDir}/fixtures/local/${f}`)),f);
rows.push({id:'Y1',what:'old fixture files byte-identical in the new package',result:'PASS',files:oldFixtures});
const r=await fx(oldDir,'region'),rc=await fx(newDir,'region-rollback-cause');
check('Y2','old region commit and undo accepted by new',()=>{n.validateRegionCommit(r.commitRequest,r.commitResponse);n.validateRegionUndo(r.undoRequest,r.undoResponse,r.commitResponse.result);});
check('Y3','digests of old region values unchanged',()=>{for(const [k,v] of [['region-operations',r.commitRequest.operations],['region-summary',r.commitResponse.result.beforeSummary],['region-summary',r.commitResponse.result.actualSummary]])assert.equal(o.digestValue(k,v).sha256,n.digestValue(k,v).sha256,k);});
check('Y4','handshakes accept each other (same major, same wires)',()=>{o.checkContractHandshake(n.contractHandshake);n.checkContractHandshake(o.contractHandshake);assert.deepEqual([...o.wireVersions],[...n.wireVersions]);
 assert.deepEqual(JSON.parse(JSON.stringify(o.contractProtocols)),JSON.parse(JSON.stringify(n.contractProtocols)));});
check('Y5','a rollback carrying a cause is refused by the old decoder (fail-closed)',()=>{
 for(const c of rc.accept.filter(c=>c.read.cause==='REPORTED'))refused(()=>o.validateRegionCommit(c.request,c.response),'UNKNOWN_REQUIRED_FIELD');});
check('Y6','a rollback without a cause is accepted by both; the new package reads it as UNKNOWN',()=>{
 const c=rc.accept.find(c=>c.read.cause==='UNKNOWN');o.validateRegionCommit(c.request,c.response);
 assert.equal(n.regionRollbackCauseOf(c.request,c.response).cause,'UNKNOWN');});
check('Y7','the new package still refuses every malformed cause',()=>{for(const c of rc.reject)refused(()=>n.regionRollbackCauseOf(c.request,c.response),c.error.code);});
check('Y8','only the new package advertises the rollback-cause capability',()=>{
 assert.ok(!o.regionCapabilities.some(c=>c.id==='canvas-region/v2:rollback-cause'));assert.ok(n.regionCapabilities.some(c=>c.id==='canvas-region/v2:rollback-cause'));
 assert.deepEqual(o.regionCapabilities.map(c=>c.id),n.regionCapabilities.map(c=>c.id).filter(id=>id!=='canvas-region/v2:rollback-cause'));});
console.log(JSON.stringify({old:o.version,new:n.version,checks:rows},null,1));

// SOURCE/FIXTURE comparison of real git-tag checkouts, not provider/runtime acceptance.
// node tools/cross-version-brush-placement.mjs <old package directory> <current package directory>
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const [oldDir,newDir]=process.argv.slice(2);
const old=await import(pathToFileURL(oldDir+'/dist/local/index.mjs')),current=await import(pathToFileURL(newDir+'/dist/local/index.mjs'));
const fixture=async(dir,name)=>JSON.parse(await readFile(dir+'/fixtures/local/'+name+'.json','utf8'));
const checks=[];const check=(name,fn)=>{fn();checks.push({name,result:'PASS'});};
for(const name of await readdir(oldDir+'/fixtures/local'))assert.deepEqual(await readFile(oldDir+'/fixtures/local/'+name),await readFile(newDir+'/fixtures/local/'+name),'old public fixture changed: '+name);
checks.push({name:'all old public fixtures byte-identical',result:'PASS'});
const region=await fixture(oldDir,'region'),main=await fixture(oldDir,'main'),added=await fixture(newDir,'brush-placement');
check('old region compile, proposal, reads, writes, commit and undo still validate',()=>{
 current.validateCompiledRegionSet(region.compileRequest,region.compileResponse);
 current.validateRegionProposalResponse(region.proposalRequest,region.proposalResponse);
 current.validateRegionRead(region.readRequest,region.readResponse);current.validateRegionWrite(region.writeRequest,region.writeResponse);
 current.validateRegionCommit(region.commitRequest,region.commitResponse);current.validateRegionUndo(region.undoRequest,region.undoResponse,region.commitResponse.result);
});
check('old BUILD request and response remain valid',()=>current.validateBuildProposalResponse(main.request,main.response));
check('old region blocks and operations have unchanged digests',()=>{
 for(const [kind,value] of [['region-build',region.compileRequest.build],['region-operations',region.compileResponse.result.projection],...region.compileResponse.result.projection.chunks.map(c=>['region-block',c.block])])
  assert.equal(old.digestValue(kind,value).sha256,current.digestValue(kind,value).sha256);
});
check('both package handshakes accept the other same major',()=>{old.checkContractHandshake(current.contractHandshake);current.checkContractHandshake(old.contractHandshake);});
check('old decoder refuses new blockDigest and geometryProfile fields',()=>{
 assert.throws(()=>old.validateResponse('region-build/v2','CompileRegionBuild',added.region.compileResponse),{code:'UNKNOWN_REQUIRED_FIELD'});
 assert.throws(()=>old.validateRequest('canvas/v7','InspectPlacementRegion',added.canvas.request),{code:'UNKNOWN_REQUIRED_FIELD'});
});
check('old footprint decodes unchanged in both packages and neutral Canvas fails closed',()=>{
 const request=structuredClone(added.canvas.request);delete request.footprint.geometryProfile;
 const bytes=Buffer.from(JSON.stringify(request));old.admitRequest('canvas/v7','InspectPlacementRegion',bytes);current.admitRequest('canvas/v7','InspectPlacementRegion',bytes);
 assert.throws(()=>current.validatePlacementRegionRequest(request,added.canvas.connection),{code:'CAPABILITY_UNAVAILABLE',reason:'REQUIRED_FACT_UNKNOWN'});
});
console.log(JSON.stringify({evidence:'SOURCE/FIXTURE',old:old.version,current:current.version,checks},null,2));

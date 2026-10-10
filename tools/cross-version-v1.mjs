// Cross-version check for a qualified additive minor (protocolPolicy.minor): run with two installed
// package directories, the previous minor (old) and the candidate (new). SOURCE/PACK/FIXTURE only.
//   node tools/cross-version-v1.mjs <old package dir> <new package dir>
// Asserts: every old fixture file is byte-identical in the new package and every old request, response,
// context and region commit is accepted by the new package with unchanged digests; both handshakes accept
// each other; a new value carrying a confirmed placement is refused by the old strict decoder (fail-closed);
// a new value without one is accepted by the old package.
import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const [oldDir,newDir]=process.argv.slice(2);
const o=await import(pathToFileURL(oldDir+'/dist/local/index.mjs')),n=await import(pathToFileURL(newDir+'/dist/local/index.mjs'));
const fx=async(dir,name)=>JSON.parse(await readFile(`${dir}/fixtures/local/${name}.json`,'utf8'));
const rows=[];const check=(id,what,fn)=>{fn();rows.push({id,what,result:'PASS'});};
const refused=(fn,code)=>{try{fn();}catch(e){assert.equal(e.code,code);return e;}assert.fail('accepted');};
const oldFixtures=(await readdir(oldDir+'/fixtures/local')).sort();
for(const f of oldFixtures)assert.ok((await readFile(`${oldDir}/fixtures/local/${f}`)).equals(await readFile(`${newDir}/fixtures/local/${f}`)),f);
rows.push({id:'X1',what:'old fixture files byte-identical in the new package',result:'PASS',files:oldFixtures});
const m=await fx(oldDir,'main'),r=await fx(oldDir,'region'),cp=await fx(newDir,'confirmed-placement');
check('X2','old painter request/response/context accepted by new',()=>{n.validateBuildProposalRequest(m.request);n.validateBuildProposalResponse(m.request,m.response);n.validateBuildProposalContext(m.request,m.facts);});
check('X3','old region proposal and commit accepted by new',()=>{n.validateRegionProposalRequest(r.proposalRequest);n.validateRegionProposalResponse(r.proposalRequest,r.proposalResponse);n.validateRegionCommit(r.commitRequest,r.commitResponse);});
check('X4','digests of old objects unchanged',()=>{for(const [k,f] of [['intent','intent'],['reference-brief','referenceBrief'],['target-facts','targetFacts'],['safety-profile','safetyProfile'],['catalogue','catalogue']])assert.equal(o.digestValue(k,m.request[f]).sha256,n.digestValue(k,m.request[f]).sha256,k);
 assert.equal(o.digestValue('build',m.response.result.build).sha256,n.digestValue('build',m.response.result.build).sha256);
 assert.equal(o.digestValue('region-operations',r.commitRequest.operations).sha256,n.digestValue('region-operations',r.commitRequest.operations).sha256);});
check('X5','handshakes accept each other (same major, same wires)',()=>{o.checkContractHandshake(n.contractHandshake);n.checkContractHandshake(o.contractHandshake);n.checkBuildProposalHandshake(o.contractHandshake);o.checkBuildProposalHandshake(n.contractHandshake);
 assert.deepEqual([...o.wireVersions],[...n.wireVersions]);});
check('X6','new values with a confirmed placement are refused by the old decoder (fail-closed)',()=>{
 refused(()=>o.validateBuildProposalRequest(cp.perCell.accept[0].request),'UNKNOWN_REQUIRED_FIELD');
 refused(()=>o.validateRequest('painter/v5','CreateBuildPlan',cp.createBuildPlan.accept[0].request),'UNKNOWN_REQUIRED_FIELD');
 refused(()=>o.validateRequest('painter-region/v2','ValidateRegionProposal',cp.region.accept[0].request),'UNKNOWN_REQUIRED_FIELD');
 refused(()=>o.validateBoundRequest('canvas/v6','ApplyRecoverableCommit',cp.canvas.accept[0].submission.apply),'UNKNOWN_REQUIRED_FIELD');
 refused(()=>o.validateRequest('canvas-region/v2','ApplyRegionCommit',cp.canvasRegion.accept[0].commit),'UNKNOWN_REQUIRED_FIELD');});
check('X7','new values without a placement are accepted by the old package',()=>{
 o.validateBuildProposalRequest(cp.perCell.accept[3].request);o.validateBoundRequest('canvas/v6','ApplyRecoverableCommit',cp.canvas.accept[1].submission.apply);
 o.validateRequest('canvas-region/v2','ApplyRegionCommit',cp.canvasRegion.accept[2].commit);});
check('X8','the new package still refuses every named placement case before writing',()=>{
 for(const c of cp.perCell.reject)refused(()=>n.validateBuildProposalRequest(c.request),c.error.code);
 for(const c of cp.canvasRegion.reject.filter(c=>c.at==='admission'))refused(()=>n.validateRegionCommitRequest(c.commit),c.error.code);});
console.log(JSON.stringify({old:o.version,new:n.version,checks:rows},null,1));

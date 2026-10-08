import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const base=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/main'))));
// Exact public PNG fixture used by Workshop 0.2.1's real attachment-store gate.
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWOo2HKnYssdBggFADdeCCGxfcWRAAAAAElFTkSuQmCC','base64');
const storedBytesDigest=createHash('sha256').update(bytes).digest('hex');
assert.equal(storedBytesDigest,'ff9f970de8b6a6c692eb9703a7ae2d37db2a0e3bd59fdd260d496cc7924aa6b3');
const media={attachmentRef:'sha256:'+storedBytesDigest,storedBytesDigest,projectionVariantId:null,projectionBytesDigest:null,mediaType:'image/png',bytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
const D=(kind,value)=>a.digestValue(kind,value).sha256;
function hashes(request){request.referenceBriefDigest=D('reference-brief',request.referenceBrief);request.intent.referenceBriefDigest=request.referenceBriefDigest;request.intentDigest=D('intent',request.intent);return request;}
function context(request){return Object.fromEntries(Object.keys(a.schemaBundle.definitions.BuildProposalContext.properties).map(k=>[k,request[k]]));}
function bind(request){const c=context(request);return {sourceContext:structuredClone(c),currentContext:structuredClone(c),requestFacts:{...base.facts.requestFacts,currentBriefDigest:request.referenceBriefDigest}};}
const image=hashes(structuredClone(base.request));image.referenceBrief.media=[media];hashes(image);const facts=bind(image);
let checks=0;function test(name,run){run();console.log('ok',++checks,name);}
test('affected normal text proposal remains exact',()=>{const admitted=a.validateBuildProposalContext(base.request,base.facts);assert.deepEqual(admitted.referenceBrief.media,[]);a.validateBuildProposalResponse(admitted,base.response);});
test('same-Session stored image survives context, raw request and geometry response',()=>{
 a.validateType('BuildProposalContext',context(image));
 const decoded=a.admitRequest('painter/v4','ValidateBuildProposal',Buffer.from(JSON.stringify(image)));
 const admitted=a.validateBuildProposalContext(decoded,facts);
 assert.equal(a.canonicalJSON(admitted.referenceBrief.media),a.canonicalJSON([media]));assert.equal(admitted.referenceBrief.media[0].storedBytesDigest,storedBytesDigest);
 assert.equal(a.validateBuildProposalResponse(admitted,base.response).result.buildDigest,base.response.result.buildDigest);
 assert.deepEqual(image.referenceBrief.media,[media]);
});
test('stored digest remains bound to brief and current provider media',()=>{
 const altered=structuredClone(image);altered.referenceBrief.media[0].storedBytesDigest='0'.repeat(64);
 assert.throws(()=>a.validateBuildProposalContext(altered,facts),{code:'MEDIA_DIGEST_MISMATCH'});
 hashes(altered);assert.throws(()=>a.validateBuildProposalContext(altered,facts),{code:'TRANSACTION_CONFLICT'});
 const forged=bind(altered);forged.sourceContext=facts.sourceContext;assert.throws(()=>a.validateBuildProposalContext(altered,forged),{code:'TARGET_FACTS_STALE'});
});
test('image cannot borrow another Session or current world',()=>{
 const wrongBrief=structuredClone(image);wrongBrief.referenceBrief.sessionRef='other-session';hashes(wrongBrief);
 assert.throws(()=>a.validateBuildProposalContext(wrongBrief,bind(wrongBrief)),{code:'INTENT_UNCONFIRMED'});
 assert.throws(()=>a.validateBuildProposalContext(image,{...facts,requestFacts:{...facts.requestFacts,sessionRef:'other-session'}}),{code:'TRANSACTION_CONFLICT'});
 assert.throws(()=>a.validateBuildProposalContext(image,{...facts,requestFacts:{...facts.requestFacts,currentContext:{...image.localContext,worldRef:'other-world'}}}),{code:'CURRENT_WORLD_MISMATCH'});
});
test('projection variant and projected-byte digest stay paired and retained',()=>{
 const projected=structuredClone(image);projected.referenceBrief.media[0].projectionVariantId='host-image-variant';
 assert.throws(()=>a.validateBuildProposalContext(projected,facts),{code:'SCHEMA_INVALID'});
 projected.referenceBrief.media[0].projectionBytesDigest='1'.repeat(64);hashes(projected);
 assert.equal(a.canonicalJSON(a.validateBuildProposalContext(projected,bind(projected)).referenceBrief.media),a.canonicalJSON(projected.referenceBrief.media));
});
test('image package has an exact new handshake with no old-peer fallback',()=>{
 assert.equal(a.version,'0.5.4');a.checkBuildProposalHandshake(a.contractHandshake);
 assert.throws(()=>a.checkBuildProposalHandshake({...a.contractHandshake,contracts:'hanaworlds-contracts@0.4.0'}),{code:'UNSUPPORTED_VERSION'});
});
console.log(JSON.stringify({evidence:'SOURCE/FIXTURE',checks,mediaBytes:bytes.length,storedBytesDigest,modelCalls:0,worldWrites:0,realRuntime:'NOT_RUN',realUI:'NOT_RUN'}));

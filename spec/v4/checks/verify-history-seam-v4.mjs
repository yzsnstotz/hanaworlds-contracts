// SOURCE/FIXTURE only. Validates the new public producer -> Canvas -> history chain.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import canonicalize from '../context/supplement/sources/canonicalize/lib/canonicalize.js';
const get=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const profile=await get('CONTRACT_SCHEMA_PROFILE.json');
const chain=await get('fixtures/candidate/history-seam-chain-v4.json');
const wire=await get('fixtures/candidate/wire-inputs-v4.json');
const oracles=await get('fixtures/candidate/contract-v4-oracles.json');
const closure=await get('CONTRACT_SEMANTIC_CLOSURE.json');
const sha=x=>createHash('sha256').update(x).digest('hex');
function validate(value,kind,path='$'){
  if(kind.includes('|')){
    const options=kind.split('|');if(value===null&&options.includes('null'))return;
    for(const option of options.filter(x=>x!=='null'))try{validate(value,option,path);return;}catch{}
    throw Error(path+': no union variant '+kind);
  }
  if(kind.startsWith('=')){let x=kind.slice(1);try{x=JSON.parse(x);}catch{}assert.deepEqual(value,x,path);return;}
  const t=profile.types[kind];assert(t,`unknown ${kind} at ${path}`);
  if(t.type==='string'){assert.equal(typeof value,'string',path);assert(value.isWellFormed(),path);if(t.minLength)assert(value.length>=t.minLength,path);if(t.pattern)assert(new RegExp(t.pattern).test(value),path);}
  else if(t.type==='integer'||t.type==='number'){assert.equal(typeof value,'number',path);assert(Number.isFinite(value),path);if(t.type==='integer')assert(Number.isSafeInteger(value),path);}
  else if(t.type==='boolean')assert.equal(typeof value,'boolean',path);
  else if(t.type==='enum')assert(t.values.includes(value),path);
  else if(t.type==='tuple'){assert(Array.isArray(value),path);assert.equal(value.length,t.items.length,path);t.items.forEach((x,i)=>validate(value[i],x,`${path}[${i}]`));}
  else if(t.type==='array'){assert(Array.isArray(value),path);if(t.minItems)assert(value.length>=t.minItems,path);value.forEach((x,i)=>validate(x,t.items,`${path}[${i}]`));if(t.unique)assert.equal(new Set(value.map(canonicalize)).size,value.length,path);if(t.order==='UTF16 ascending')assert.deepEqual(value,[...value].sort(),path);}
  else if(t.type==='map'){assert(value&&typeof value==='object'&&!Array.isArray(value),path);if(t.minEntries)assert(Object.keys(value).length>=t.minEntries,path);for(const [k,v]of Object.entries(value)){validate(k,t.keyType,path+' key');validate(v,t.values,path+'.'+k);}}
  else if(t.type==='object'||t.type==='discriminated-object'){assert(value&&typeof value==='object'&&!Array.isArray(value),path);const fields=t.type==='object'?t.fields:{...t.common,...t.variants[value[t.discriminator]]};assert(fields,path);assert.deepEqual(Object.keys(value).sort(),Object.keys(fields).sort(),path+' exact fields');for(const [k,v]of Object.entries(fields))validate(value[k],v,path+'.'+k);}
  else throw Error(`unsupported type ${t.type}`);
}
assert.equal(profile.package,'hanaworlds-contracts@0.3.0');
assert(profile.wireVersions.includes('world-adapter/v4'));
assert.equal(profile.types.PrepareRecoverableTransactionResponse.fields.result,'PreparedTransactionResult|null');
assert.equal(profile.types.QueryPreparedTransactionResponse.fields.result,'PreparedTransactionResult|null');
assert.equal(profile.types.ApplyCompiledTransactionRequest.fields.preparedTransaction,'PreparedTransaction');
const originalFields=Object.keys(profile.types.PreparedTransaction.fields);
assert.equal(originalFields.length,7);
assert.equal(Object.keys(profile.types.PreparedTransactionResult.fields).length,8);
const material=chain.validCases.find(x=>x.id==='SEAM-A-PREPARE-QUERY-BIND-UNDO').materializedChain;
assert(material);
validate(material.prepareResponse,'PrepareRecoverableTransactionResponse');
validate(material.queryPreparedResponse,'QueryPreparedTransactionResponse');
validate(material.applyRequest,'ApplyCompiledTransactionRequest');
validate(material.historyRequest,'PrepareHistoryTransactionRequest');
const produced=material.prepareResponse.result.beforeStateReadbackDigest;
const seam=closure.rows.find(x=>x.id==='WAV4-SEAM-A');assert(seam);
assert.equal(seam.fieldLineage.producerResultPaths[0],'PrepareRecoverableTransactionResponse.result.beforeStateReadbackDigest');
assert.equal(seam.fieldLineage.producerResultPaths[1],'QueryPreparedTransactionResponse.result.beforeStateReadbackDigest');
assert.equal(seam.fieldLineage.consumerRequestPath,'PrepareHistoryTransactionRequest.originBeforeStateReadbackDigest');
assert.equal(seam.fieldLineage.executedChecker.path,'checks/verify-history-seam-v4.mjs');
assert.equal(produced,material.queryPreparedResponse.result.beforeStateReadbackDigest);
assert.deepEqual(material.prepareResponse.result,material.queryPreparedResponse.result);
assert.deepEqual(material.applyRequest.preparedTransaction,Object.fromEntries(originalFields.map(k=>[k,material.prepareResponse.result[k]])));
assert.equal(material.historyRequest.originBeforeStateReadbackDigest,produced);
assert.equal(material.historyRequest.targetStateDigest,produced);
assert.equal(produced,chain.digestGolden.beforeStateReadbackDigest);
assert.notEqual(produced,chain.digestGolden.beforeImageDigest);
assert.equal(sha('HanaWorlds|contracts@0.1.0|before-image\n'+canonicalize(chain.savedBeforeImage)),chain.digestGolden.beforeImageDigest);
assert.equal(sha('HanaWorlds|contracts@0.1.0|readback\n'+canonicalize(chain.digestGolden.beforeStateReadbackProjection)),produced);
assert.equal(sha('HanaWorlds|contracts@0.1.0|readback\n'+canonicalize(chain.digestGolden.beforeStateReadbackProjection)),sha(chain.digestGolden.readbackDigestPreimageUtf8));
const historyProjection=Object.fromEntries(Object.keys(profile.types.HistoryOperationProjection.fields).map(k=>[k,material.historyRequest[k]]));
assert.equal(sha('HanaWorlds|contracts@0.2.0|history-operation\n'+canonicalize(historyProjection)),material.historyRequest.historyOperationDigest);
assert.equal(material.historyRequest.historyOperationDigest,chain.digestGolden.historyOperationDigestAfterV4Migration);
for(const x of wire.requests){assert.equal(x.request.contractVersion,x.wire);const op=profile.operations[x.wire].find(y=>y.operation===x.operation);assert(op,x.id);validate(x.request,x.requestType);}
const byId=new Map(oracles.cases.map(x=>[x.id,x]));assert.equal(byId.size,18);
for(const x of oracles.cases){if(x.id==='B-INVALID-LEGACY-PREPARED-FIELD')assert.throws(()=>validate(x.request,x.type));else validate(x.request,x.type);}
const migrated=await get('fixtures/candidate/closure-oracles-v4.json');assert.equal(migrated.cases.length,142);assert.equal(migrated.requestInventory,'wire-inputs-v4.json');
const witnesses=new Map(migrated.cases.map(x=>[x.id,x]));assert.equal(witnesses.size,142);
for(const row of closure.rows){for(const field of ['validFixture','invalidFixture']){
  const ref=row[field];if(ref.path.endsWith('closure-oracles-v4.json')){const f=witnesses.get(ref.caseId);assert(f,row.id);assert.equal(f.wire,row.protocol,row.id);assert.deepEqual(f.expected,row.expectedOutcomes[field==='validFixture'?'valid':'invalid'],row.id);}
  if(ref.path.endsWith('contract-v4-oracles.json'))assert(byId.has(ref.caseId),row.id);
}}
const missing={...material.prepareResponse.result};delete missing.beforeStateReadbackDigest;
assert.throws(()=>validate({...material.prepareResponse,result:missing},'PrepareRecoverableTransactionResponse'));
const forged={...material.historyRequest,originBeforeStateReadbackDigest:chain.digestGolden.beforeImageDigest};
assert.notEqual(forged.originBeforeStateReadbackDigest,produced);
assert(chain.invalidCases.some(x=>x.id==='SEAM-A-SUBSTITUTE-BEFORE-IMAGE-DIGEST'&&x.expected.historyWrites===0));
assert(chain.invalidCases.some(x=>x.id==='SEAM-A-OLD-V3-CONSUMER'&&x.expected.silentFallback===false));
assert(chain.invalidCases.some(x=>x.id==='SEAM-A-REVOKED'&&x.expected.digestDisclosed===false));
console.log(JSON.stringify({status:'PASS',evidence:'SOURCE/FIXTURE',providerRuntime:'NOT_RUN',producerConsumerHistoryChain:'PASS',typedResponses:2,typedRequests:2,legacyWireRequests:wire.requests.length,portedClosureCases:migrated.cases.length,portedContractCases:oracles.cases.length,negativeCases:chain.invalidCases.length}));

// contracts-major-compat/v1 conformance (SOURCE/FIXTURE). Providers and consumers run this against the
// installed package: package version decides by major only; structure, wires, capabilities and trust still reject.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
const fx=JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/contracts-major-compat'))));
let passed=0;function test(name,fn){fn();console.log('ok',++passed,name)}
const rejects=(fn,error,title)=>assert.throws(fn,e=>{assert.deepEqual({code:e.code,phase:e.phase,reason:e.reason},{phase:'decode',...error},title);return true;},title);
const handshake=c=>{const h={...a.contractHandshake,...c.patch};if(c.dropWire)h.wireVersions=h.wireVersions.filter(w=>w!==c.dropWire);return h;};
test('the installed package declares one same-major rule in runtime, schema and handshake',()=>{
 assert.equal(fx.profileVersion,'contracts-major-compat/v1');
 assert.deepEqual({...a.contractsCompatibility},{package:'hanaworlds-contracts',major:fx.major,rule:'same-major'});
 assert.deepEqual({...a.schemaBundle['x-contractsCompatibility']},{...a.contractsCompatibility});
 assert.equal(a.contractHandshake.contracts,'hanaworlds-contracts@'+a.version);
 assert.equal(a.checkContractsVersion(a.contractHandshake.contracts).major,fx.major);
 assert.equal(a.checkSchemaCompatibility(a.schemaBundle,['ContractHandshake']).version,a.version);
});
test('contracts version: same major passes whatever the minor, patch or prerelease',()=>{
 for(const ref of fx.contractsVersion.accept)assert.deepEqual({...a.checkContractsVersion(ref)},{result:'CONTRACTS_MAJOR_MATCH',major:fx.major,advertised:ref},ref);
});
test('contracts version: another major, another package or a malformed ref is rejected',()=>{
 for(const c of fx.contractsVersion.reject)rejects(()=>a.checkContractsVersion(c.ref),{code:fx.contractsVersion.rejection.code,reason:fx.contractsVersion.rejection.reason},c.title);
});
test('contract handshake: same major across minors/patches passes',()=>{
 for(const c of fx.contractHandshake.accept)assert.equal(a.checkContractHandshake(handshake(c)).result,c.expect,c.title);
});
test('contract handshake: major, structure, wire, fact profile and trust negatives still reject',()=>{
 for(const c of fx.contractHandshake.reject)rejects(()=>a.checkContractHandshake(handshake(c)),c.error,c.title);
});
test('build proposal handshake uses the same predicate',()=>{
 for(const p of fx.buildProposalHandshake.accept)assert.equal(a.checkBuildProposalHandshake({...a.contractHandshake,...p}).result,'HANDSHAKE_OPERATION_MATCH');
 for(const c of fx.buildProposalHandshake.reject)rejects(()=>a.checkBuildProposalHandshake(handshake(c)),c.error,c.title);
});
test('schema entry: same-major bundle or profile passes; another major, no version, absent type reject',()=>{
 for(const c of fx.schema.accept){const r=a.checkSchemaCompatibility(c.input,c.requiredTypes);assert.equal(r.result,'SCHEMA_MAJOR_MATCH',c.title);assert.equal(r.version,c.version,c.title);assert.equal(r.major,fx.major,c.title);}
 for(const c of fx.schema.reject)rejects(()=>a.checkSchemaCompatibility(c.input,c.requiredTypes),c.error,c.title);
});
test('protocol handshake: any minor and any package version of the required major passes',()=>{
 const p=fx.protocol,req=[a.protocolRequirement(p.requirement.wire,p.requirement.capabilities)];
 for(const minor of p.acceptMinors)assert.equal(a.checkProtocolCompatibility({...p.peer,protocols:[{...p.peer.protocols[0],minor}]},req).result,'PROTOCOL_COMPATIBLE',String(minor));
 for(const v of p.acceptPackageVersions)assert.equal(a.checkProtocolCompatibility({...p.peer,provenance:{...p.peer.provenance,packageVersion:v}},req).result,'PROTOCOL_COMPATIBLE',v);
});
test('protocol handshake: other major, absent protocol, missing capability, widened trust reject',()=>{
 const p=fx.protocol,req=[a.protocolRequirement(p.requirement.wire,p.requirement.capabilities)];
 for(const c of p.reject){const peer={...p.peer,...(c.protocols?{protocols:c.protocols}:{}),...(c.capabilities?{capabilities:c.capabilities}:{}),...(c.extra??{})};rejects(()=>a.checkProtocolCompatibility(peer,req),c.error,c.title);}
});
console.log(`${passed} contracts-major-compat conformance checks passed`);

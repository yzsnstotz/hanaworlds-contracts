// Exact-package handshake matrix across real packs: each extracted pack checks every pack handshake.
//   node tools/handshake-matrix.mjs <extracted-pack-dir>... (each dir contains package/; first is the checker for the protocol check)
const roots=process.argv.slice(2);const pk=[];
for(const r of roots)pk.push({root:r,api:await import(r+'/package/dist/local/index.mjs')});
const out=[];
for(const a of pk)for(const b of pk){
  const row={checker:a.api.version,peer:b.api.version,peerContracts:b.api.contractHandshake.contracts};
  for(const fn of ['checkContractHandshake','checkBuildProposalHandshake']){
    try{a.api[fn](b.api.contractHandshake);row[fn]='ACCEPT';}catch(e){row[fn]=`REJECT ${e.code??''} ${e.reason??''}`.trim();}}
  out.push(row);}
// cross-patch protocol compatibility is independent of package version
const rc=pk[0].api,other=pk[1].api;
const req=[rc.protocolRequirement('BUILD/V3',['BUILD/V3:per-cell-compile'])];
const adv={profileVersion:'protocol-handshake/v1',component:'fixture-peer',protocols:[{protocol:'BUILD',major:3,minor:0}],capabilities:['BUILD/V3:per-cell-compile'],provenance:{packageName:'hanaworlds-contracts',packageVersion:other.version,sourceRevision:null,artifactDigest:null}};
let pc;try{pc=rc.checkProtocolCompatibility(adv,req).result}catch(e){pc='REJECT '+e.code}
console.log(JSON.stringify({matrix:out,protocolCompatibility:{checker:rc.version,peerPackageVersion:other.version,result:pc,note:'FIXTURE peer advertisement'}},null,1));

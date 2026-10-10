#!/usr/bin/env bash
# 1.2 region rollback-cause gate (C-REGION-CAUSE-SUPPLY-01): exact commit -> clean archive -> lock install ->
# committed generation is deterministic -> every pre-existing v1.1.0 test, consumer typecheck and fixture
# source file is unchanged -> compare-major against v1.1.0 (qualified additive: identifiers kept) -> every
# source self-test -> npm pack -> per-file pack report against the v1.1.0 pack -> independent install of that
# tar -> all conformance tests (including test:rollback-cause) and the ten consumer typechecks against it ->
# cross-version checks v1.1.0 -> this pack (rollback cause) and v1.0.0 -> this pack (placement checks still
# hold). SOURCE/PACK/FIXTURE only.
set -euo pipefail
source_sha=${1:?full source SHA required}
evidence_dir=${2:?absolute evidence directory required}
base_sha=5177522d311074a74f66ba82e2e909081cde5fad # v1.1.0
v100_sha=767086de8ea5a659d4103ca23d49df9d790a0ab5 # v1.0.0
[[ "$source_sha" =~ ^[0-9a-f]{40}$ && "$evidence_dir" = /* ]]
export PATH=/Users/yzliu/.local/share/fnm/node-versions/v24.13.1/installation/bin:$PATH
repo=$(git rev-parse --show-toplevel)
rm -rf "$evidence_dir"; mkdir -p "$evidence_dir"
build_dir=$(mktemp -d "${evidence_dir%/*}/gate-rollback-cause-v1.2.XXXXXX")
export npm_config_cache="${HANAWORLDS_NPM_CACHE:-$build_dir/npm-cache}"
cleanup(){ rm -rf "$build_dir"; }
trap cleanup EXIT
mkdir "$build_dir/source" "$build_dir/source-base" "$build_dir/source-v100" "$build_dir/consumer" "$build_dir/x-base" "$build_dir/x-new"
git -C "$repo" archive "$source_sha" | tar -x -C "$build_dir/source"
git -C "$repo" archive "$base_sha" | tar -x -C "$build_dir/source-base"
git -C "$repo" archive "$v100_sha" | tar -x -C "$build_dir/source-v100"
git -C "$repo" show "$base_sha:spec/local-world/profile.json" > "$build_dir/profile-base.json"
printf '%s\n' "$source_sha" > "$evidence_dir/source-sha.txt"
{ node --version; npm --version; } > "$evidence_dir/runtime.txt"
cd "$build_dir/source"
npm ci --ignore-scripts --no-audit --no-fund > "$evidence_dir/npm-ci.log" 2>&1
node --input-type=module <<'JS' > "$evidence_dir/generated.json"
import {readdir,readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const out={};async function walk(p){for(const e of await readdir(p,{withFileTypes:true})){const n=p+'/'+e.name;if(e.isDirectory())await walk(n);else out[n]=createHash('sha256').update(await readFile(n)).digest('hex');}}
for(const p of ['dist/local','schemas/local','types/local','fixtures/local','src/local/generated','spec/local-world/fixtures','inspector/lib'])await walk(p);console.log(JSON.stringify(out,null,2));
JS
{ npm run build; npm run build:main-fixture; npm run build; npm run build:region-fixture; npm run build; npm run build:inspector; python3 -I tools/build-session-world-fixture.py spec/local-world/fixtures/session-world.json; npm run build; npm run build:config-facts-fixture; npm run build; npm run build:placement-fixture; npm run build; npm run build:rollback-cause-fixture; npm run build; } > "$evidence_dir/build.log" 2>&1
node --input-type=module - "$evidence_dir/generated.json" <<'JS' > "$evidence_dir/determinism.log"
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const expected=JSON.parse(await readFile(process.argv[2]));for(const [p,h] of Object.entries(expected))assert.equal(createHash('sha256').update(await readFile(p)).digest('hex'),h,p);console.log('COMMITTED_GENERATION_MATCH_AND_DETERMINISTIC',Object.keys(expected).length,'generated files');
JS
git -C "$repo" diff --name-status "$base_sha" "$source_sha" -- test consumer spec/local-world/fixtures > "$evidence_dir/v11-files-changed.txt"
grep -v $'^A\t' "$evidence_dir/v11-files-changed.txt" > "$evidence_dir/v11-files-modified.txt" || true
[ ! -s "$evidence_dir/v11-files-modified.txt" ]
node tools/compare-major.mjs "$build_dir/profile-base.json" spec/local-world/profile.json > "$evidence_dir/compat-vs-110.json" 2>&1
npm run verify:source > "$evidence_dir/source-verification.log" 2>&1
mkdir -p inspector/node_modules && ln -s ../.. inspector/node_modules/hanaworlds-contracts
for s in test test:image test:materials test:region test:g3 test:seam test:config-facts test:major-compat test:site-rules test:placement test:rollback-cause test:inspector typecheck typecheck:image typecheck:materials typecheck:region typecheck:seam typecheck:config-facts typecheck:major-compat typecheck:site-rules typecheck:placement typecheck:rollback-cause; do
  printf '== %s\n' "$s"; npm run -s "$s"; done > "$evidence_dir/self-test.log" 2>&1
npm pack --ignore-scripts --json --pack-destination "$evidence_dir" > "$evidence_dir/pack.json"
tar_new=$(ls "$evidence_dir"/hanaworlds-contracts-*.tgz)
(cd "$build_dir/source-base" && npm pack --ignore-scripts --json --pack-destination "$build_dir" > "$evidence_dir/pack-base.json")
tar -xzf "$tar_new" -C "$build_dir/x-new"; tar -xzf "$build_dir/hanaworlds-contracts-1.1.0.tgz" -C "$build_dir/x-base"
shasum -a 256 "$build_dir/hanaworlds-contracts-1.1.0.tgz" | sed "s#$build_dir/##" > "$evidence_dir/pack-base.sha256"
node --input-type=module - "$build_dir/x-base/package" "$build_dir/x-new/package" <<'JS' > "$evidence_dir/pack-diff-vs-110.json"
import {readdir,readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const [o,n]=process.argv.slice(2);const sha=x=>createHash('sha256').update(x).digest('hex');
async function list(r,p=''){const out=[];for(const e of await readdir(r+'/'+p,{withFileTypes:true})){const q=p?p+'/'+e.name:e.name;if(e.isDirectory())out.push(...await list(r,q));else out.push(q);}return out.sort();}
const a=await list(o),b=await list(n);const changed=[];
for(const f of a.filter(f=>b.includes(f))){const x=await readFile(o+'/'+f),y=await readFile(n+'/'+f);if(!x.equals(y))changed.push({file:f,oldSha256:sha(x),newSha256:sha(y)});}
console.log(JSON.stringify({files:b.length,added:b.filter(f=>!a.includes(f)),removed:a.filter(f=>!b.includes(f)),identical:a.filter(f=>b.includes(f)).length-changed.length,changed},null,1));
JS
cp test/local-world.mjs test/image-proposal.mjs test/material-sources.mjs test/region-v1.mjs test/region-fixture.mjs test/write-path-g3.mjs test/session-world-seam.mjs test/config-engine-facts.mjs test/contracts-major-compat.mjs test/skill-site-rules.mjs test/confirmed-placement.mjs test/region-rollback-cause.mjs "$build_dir/consumer/"
for d in local region image material-sources session-world config-engine-facts contracts-major-compat skill-site-rules confirmed-placement region-rollback-cause; do mkdir "$build_dir/consumer/types-$d"; cp consumer/$d/index.ts consumer/$d/tsconfig.json "$build_dir/consumer/types-$d/"; done
cd "$build_dir/consumer"
printf '{"name":"independent-contracts-consumer","private":true,"type":"module"}\n' > package.json
npm install --ignore-scripts --no-audit --no-fund --save-exact "$tar_new" typescript@5.8.3 > "$evidence_dir/consumer-install.log" 2>&1
for t in local-world image-proposal material-sources region-v1 write-path-g3 session-world-seam config-engine-facts contracts-major-compat skill-site-rules confirmed-placement region-rollback-cause; do printf '== %s\n' "$t"; node --test "$t.mjs"; done > "$evidence_dir/consumer-conformance.log" 2>&1
for d in local region image material-sources session-world config-engine-facts contracts-major-compat skill-site-rules confirmed-placement region-rollback-cause; do printf '== %s\n' "$d"; ./node_modules/.bin/tsc --project "types-$d/tsconfig.json"; done > "$evidence_dir/consumer-types.log" 2>&1
node --input-type=module <<'JS' > "$evidence_dir/consumer-identity.log"
import * as a from 'hanaworlds-contracts';console.log(import.meta.resolve('hanaworlds-contracts'));console.log(a.version);console.log(JSON.stringify(a.contractHandshake.contracts));console.log(a.configEngineFacts.id);console.log(JSON.stringify(a.contractsCompatibility));console.log(JSON.stringify(a.checkContractHandshake({...a.contractHandshake,contracts:'hanaworlds-contracts@1.0.0'}).result));for(const v of ['2.0.0-rc.3','0.5.6']){try{a.checkContractHandshake({...a.contractHandshake,contracts:'hanaworlds-contracts@'+v});console.log(v+' ACCEPTED (unexpected)');process.exit(1)}catch(e){console.log(v,e.code)}}console.log(a.safetyCapabilities.map(c=>c.id).join(','));console.log(a.confirmedPlacement.id,a.wireVersions.join(','));console.log(a.regionRollbackCause.id,a.regionRollbackCause.capability);
JS
mkdir "$build_dir/crossver" && cd "$build_dir/crossver" && printf '{"name":"cross-version","private":true,"type":"module"}\n' > package.json
(cd "$build_dir/source-v100" && npm pack --ignore-scripts --json --pack-destination "$build_dir" > "$evidence_dir/pack-v100.json")
npm install --ignore-scripts --no-audit --no-fund "old@file:$build_dir/hanaworlds-contracts-1.1.0.tgz" "v100@file:$build_dir/hanaworlds-contracts-1.0.0.tgz" "new@file:$tar_new" > "$evidence_dir/crossver-install.log" 2>&1
node "$build_dir/source/tools/cross-version-rollback-cause.mjs" "$build_dir/crossver/node_modules/old" "$build_dir/crossver/node_modules/new" > "$evidence_dir/cross-version-110.json"
node "$build_dir/source/tools/cross-version-v1.mjs" "$build_dir/crossver/node_modules/v100" "$build_dir/crossver/node_modules/new" > "$evidence_dir/cross-version-100.json"
shasum -a 256 "$tar_new" > "$evidence_dir/tar.sha256"
printf 'SOURCE/PACK/FIXTURE COMPLETE; peer implementations and real runtime/UI NOT_RUN\n'

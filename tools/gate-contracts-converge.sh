#!/usr/bin/env bash
# Convergence gate (C-CONTRACTS-CONVERGE-01): exact commit -> clean archive -> lock install ->
# committed generation is deterministic -> additive against 0.5.0 and 0.5.2 -> every source
# self-test -> npm pack -> normalized byte diff against the 0.5.2 pack (only version and dev
# scripts may differ; optionally also against an earlier candidate) -> independent install of that tar -> all conformance tests and the four
# consumer typecheck fixtures against the installed tar.
set -euo pipefail
source_sha=${1:?full source SHA required}
evidence_dir=${2:?absolute evidence directory required}
pack_052_sha=6185622e977ef5136e9ef12219e0ba89dbba29db
# Optional third argument: an earlier candidate commit whose pack is diffed per file as well.
baseline_sha=${3:-}
region_050_sha=c006a839a6e6c2c63d57a14b72e4e6b26fa717f1
[[ "$source_sha" =~ ^[0-9a-f]{40}$ && "$evidence_dir" = /* ]]
export PATH=/Users/yzliu/.local/share/fnm/node-versions/v24.13.1/installation/bin:$PATH
repo=$(git rev-parse --show-toplevel)
rm -rf "$evidence_dir"; mkdir -p "$evidence_dir"
build_dir=$(mktemp -d "${evidence_dir%/*}/gate-converge.XXXXXX")
export npm_config_cache="$build_dir/npm-cache"
cleanup(){ rm -rf "$build_dir"; }
trap cleanup EXIT
mkdir "$build_dir/source" "$build_dir/source-052" "$build_dir/consumer" "$build_dir/x-052" "$build_dir/x-new"
git -C "$repo" archive "$source_sha" | tar -x -C "$build_dir/source"
git -C "$repo" archive "$pack_052_sha" | tar -x -C "$build_dir/source-052"
for c in "$pack_052_sha" "$region_050_sha"; do git -C "$repo" show "$c:spec/local-world/profile.json" > "$build_dir/profile-${c:0:8}.json"; done
printf '%s\n' "$source_sha" > "$evidence_dir/source-sha.txt"
{ node --version; npm --version; } > "$evidence_dir/runtime.txt"

cd "$build_dir/source"
npm ci --ignore-scripts --no-audit --no-fund > "$evidence_dir/npm-ci.log" 2>&1
node --input-type=module <<'JS' > "$evidence_dir/generated.json"
import {readdir,readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const out={};async function walk(p){for(const e of await readdir(p,{withFileTypes:true})){const n=p+'/'+e.name;if(e.isDirectory())await walk(n);else out[n]=createHash('sha256').update(await readFile(n)).digest('hex');}}
for(const p of ['dist/local','schemas/local','types/local','fixtures/local','src/local/generated','spec/local-world/fixtures','inspector/lib'])await walk(p);console.log(JSON.stringify(out,null,2));
JS
{ npm run build; npm run build:region-fixture; npm run build; npm run build:inspector; } > "$evidence_dir/build.log" 2>&1
node --input-type=module - "$evidence_dir/generated.json" <<'JS' > "$evidence_dir/determinism.log"
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const expected=JSON.parse(await readFile(process.argv[2]));for(const [p,h] of Object.entries(expected))assert.equal(createHash('sha256').update(await readFile(p)).digest('hex'),h,p);console.log('COMMITTED_GENERATION_MATCH_AND_DETERMINISTIC',Object.keys(expected).length,'generated files');
JS
{ node tools/compare-baseline.mjs "$build_dir/profile-${pack_052_sha:0:8}.json" spec/local-world/profile.json
  node tools/compare-baseline.mjs "$build_dir/profile-${region_050_sha:0:8}.json" spec/local-world/profile.json; } > "$evidence_dir/baseline-additive.log" 2>&1
npm run verify:source > "$evidence_dir/source-verification.log" 2>&1
# The inspector dev page resolves the package through a dev self-link (untracked node_modules).
mkdir -p inspector/node_modules && ln -s ../.. inspector/node_modules/hanaworlds-contracts
for s in test test:image test:materials test:region test:g3 test:inspector typecheck typecheck:image typecheck:materials typecheck:region; do
  printf '== %s\n' "$s"; npm run -s "$s"; done > "$evidence_dir/self-test.log" 2>&1
npm pack --ignore-scripts --json --pack-destination "$evidence_dir" > "$evidence_dir/pack.json"
tar_new=$(ls "$evidence_dir"/hanaworlds-contracts-*.tgz)
(cd "$build_dir/source-052" && npm pack --ignore-scripts --json --pack-destination "$build_dir" > "$evidence_dir/pack-052.json")
tar -xzf "$tar_new" -C "$build_dir/x-new"; tar -xzf "$build_dir/hanaworlds-contracts-0.5.2.tgz" -C "$build_dir/x-052"
if [[ -n "$baseline_sha" ]]; then
  mkdir "$build_dir/source-base" "$build_dir/pack-base" "$build_dir/x-base"
  git -C "$repo" archive "$baseline_sha" | tar -x -C "$build_dir/source-base"
  (cd "$build_dir/source-base" && npm pack --ignore-scripts --json --pack-destination "$build_dir/pack-base" > "$evidence_dir/pack-baseline.json")
  tar -xzf "$build_dir"/pack-base/*.tgz -C "$build_dir/x-base"; shasum -a 256 "$build_dir"/pack-base/*.tgz | sed "s#$build_dir/pack-base/##" > "$evidence_dir/pack-baseline.sha256"
fi
node tools/compare-pack.mjs "$build_dir/x-052/package" "$build_dir/x-new/package" > "$evidence_dir/pack-diff-vs-052.json"
[[ -z "$baseline_sha" ]] || node tools/compare-pack.mjs "$build_dir/x-base/package" "$build_dir/x-new/package" > "$evidence_dir/pack-diff-vs-baseline.json"
cp test/local-world.mjs test/image-proposal.mjs test/material-sources.mjs test/region-v1.mjs test/region-fixture.mjs test/write-path-g3.mjs "$build_dir/consumer/"
for d in local region image material-sources; do mkdir "$build_dir/consumer/types-$d"; cp consumer/$d/index.ts consumer/$d/tsconfig.json "$build_dir/consumer/types-$d/"; done
cd "$build_dir/consumer"
printf '{"name":"independent-contracts-consumer","private":true,"type":"module"}\n' > package.json
npm install --ignore-scripts --no-audit --no-fund --save-exact "$tar_new" typescript@5.8.3 > "$evidence_dir/consumer-install.log" 2>&1
for t in local-world image-proposal material-sources region-v1 write-path-g3; do printf '== %s\n' "$t"; node --test "$t.mjs"; done > "$evidence_dir/consumer-conformance.log" 2>&1
for d in local region image material-sources; do printf '== %s\n' "$d"; ./node_modules/.bin/tsc --project "types-$d/tsconfig.json"; done > "$evidence_dir/consumer-types.log" 2>&1
node --input-type=module <<'JS' > "$evidence_dir/consumer-identity.log"
import * as a from 'hanaworlds-contracts';console.log(import.meta.resolve('hanaworlds-contracts'));console.log(a.version);console.log(JSON.stringify(a.contractHandshake.contracts));console.log(JSON.stringify(a.contractProtocols));
JS
shasum -a 256 "$tar_new" > "$evidence_dir/tar.sha256"
printf 'SOURCE/PACK/FIXTURE COMPLETE; real runtime/UI NOT_RUN\n'

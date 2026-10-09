#!/usr/bin/env bash
# Region v1 component gate: exact commit -> clean archive -> lock install ->
# deterministic generation -> source checks -> region conformance + regressions ->
# npm pack -> independent install of that tar -> same conformance and types.
set -euo pipefail
source_sha=${1:?full source SHA required}
evidence_dir=${2:?absolute evidence directory required}
baseline_sha=aad7c0ea2a4a9a93dfb13555c46cd98b9b5da777
[[ "$source_sha" =~ ^[0-9a-f]{40}$ && "$evidence_dir" = /* ]]
export PATH=/Users/yzliu/.local/share/fnm/node-versions/v24.13.1/installation/bin:$PATH
repo=$(git rev-parse --show-toplevel)
mkdir -p "$evidence_dir"
build_dir=$(mktemp -d "${evidence_dir%/*}/gate-region.XXXXXX")
export npm_config_cache="$build_dir/npm-cache"
cleanup(){ rm -rf "$build_dir"; }
trap cleanup EXIT
mkdir "$build_dir/source" "$build_dir/consumer"
git -C "$repo" archive "$source_sha" | tar -x -C "$build_dir/source"
git -C "$repo" show "$baseline_sha:spec/local-world/profile.json" > "$build_dir/baseline-profile.json"
printf '%s\n' "$source_sha" > "$evidence_dir/source-sha.txt"
{ node --version; npm --version; } > "$evidence_dir/runtime.txt"
cd "$build_dir/source"
npm ci --ignore-scripts --no-audit --no-fund > "$evidence_dir/npm-ci.log" 2>&1
node --input-type=module <<'JS' > "$evidence_dir/generated.json"
import {readdir,readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const out={};async function walk(p){for(const e of await readdir(p,{withFileTypes:true})){const n=p+'/'+e.name;if(e.isDirectory())await walk(n);else out[n]=createHash('sha256').update(await readFile(n)).digest('hex');}}
for(const p of ['dist/local','schemas/local','types/local','fixtures/local','src/local/generated','spec/local-world/fixtures'])await walk(p);console.log(JSON.stringify(out,null,2));
JS
{ npm run build; npm run build:region-fixture; npm run build; } > "$evidence_dir/build.log" 2>&1
node --input-type=module - "$evidence_dir/generated.json" <<'JS' > "$evidence_dir/determinism.log"
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const expected=JSON.parse(await readFile(process.argv[2]));for(const [p,h] of Object.entries(expected))assert.equal(createHash('sha256').update(await readFile(p)).digest('hex'),h,p);console.log('COMMITTED_GENERATION_MATCH_AND_DETERMINISTIC',Object.keys(expected).length,'generated files incl. region fixture');
JS
git -C "$repo" show c006a839a6e6c2c63d57a14b72e4e6b26fa717f1:spec/local-world/profile.json > "$build_dir/region-050-profile.json"
{ node tools/compare-baseline.mjs "$build_dir/baseline-profile.json" spec/local-world/profile.json; node tools/compare-baseline.mjs "$build_dir/region-050-profile.json" spec/local-world/profile.json; } > "$evidence_dir/baseline-additive.log" 2>&1
npm run verify:source > "$evidence_dir/source-verification.log" 2>&1
{ npm run -s test:region; npm run -s test:g3; } > "$evidence_dir/conformance.log" 2>&1
npm run typecheck:region > "$evidence_dir/typecheck.log" 2>&1
{ npm run -s test; npm run -s test:image; npm run -s test:materials; npm run -s typecheck && npm run -s typecheck:image && npm run -s typecheck:materials && echo 'existing typechecks exit 0'; } > "$evidence_dir/regression.log" 2>&1
npm pack --ignore-scripts --json --pack-destination "$evidence_dir" > "$evidence_dir/pack.json"
cp test/region-v1.mjs test/region-fixture.mjs test/write-path-g3.mjs "$build_dir/consumer/"
cp consumer/region/index.ts consumer/region/tsconfig.json "$build_dir/consumer/"
cd "$build_dir/consumer"
printf '{"name":"independent-region-consumer","private":true,"type":"module"}\n' > package.json
npm install --ignore-scripts --no-audit --no-fund --save-exact "$evidence_dir/hanaworlds-contracts-0.5.5-rc.1.tgz" typescript@5.8.3 > "$evidence_dir/consumer-install.log" 2>&1
{ node region-v1.mjs; node write-path-g3.mjs; } > "$evidence_dir/consumer-conformance.log" 2>&1
./node_modules/.bin/tsc --project tsconfig.json > "$evidence_dir/consumer-types.log" 2>&1
node --input-type=module <<'JS' > "$evidence_dir/consumer-identity.log"
import * as a from 'hanaworlds-contracts';console.log(import.meta.resolve('hanaworlds-contracts'));console.log(a.version);console.log(JSON.stringify(a.contractProtocols));
JS
shasum -a 256 "$evidence_dir/hanaworlds-contracts-0.5.5-rc.1.tgz" > "$evidence_dir/tar.sha256"
printf 'SOURCE/FIXTURE COMPLETE; real runtime/UI NOT_RUN\n'

#!/usr/bin/env bash
set -euo pipefail
source_sha=${1:?full source SHA required}
evidence_dir=${2:?absolute evidence directory required}
[[ "$source_sha" =~ ^[0-9a-f]{40}$ && "$evidence_dir" = /* ]]
export PATH=/Users/yzliu/.local/share/fnm/node-versions/v24.13.1/installation/bin:$PATH
mkdir -p "$evidence_dir"
build_dir=$(mktemp -d "${evidence_dir%/*}/gate-image.XXXXXX")
export npm_config_cache="$build_dir/npm-cache"
cleanup(){ rm -rf "$build_dir"; }
trap cleanup EXIT
mkdir "$build_dir/source" "$build_dir/consumer"
git archive "$source_sha" | tar -x -C "$build_dir/source"
printf '%s\n' "$source_sha" > "$evidence_dir/source-sha.txt"
{ node --version; npm --version; } > "$evidence_dir/runtime.txt"
cd "$build_dir/source"
npm ci --ignore-scripts --no-audit --no-fund > "$evidence_dir/npm-ci.log" 2>&1
npm run build > "$evidence_dir/build.log" 2>&1
node --input-type=module <<'JS' > "$evidence_dir/generated.json"
import {readdir,readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const out={};async function walk(p){for(const e of await readdir(p,{withFileTypes:true})){const n=p+'/'+e.name;if(e.isDirectory())await walk(n);else out[n]=createHash('sha256').update(await readFile(n)).digest('hex');}}
for(const p of ['dist/local','schemas/local','types/local','fixtures/local','src/local/generated'])await walk(p);console.log(JSON.stringify(out,null,2));
JS
npm run build >> "$evidence_dir/build.log" 2>&1
node --input-type=module - "$evidence_dir/generated.json" <<'JS' > "$evidence_dir/determinism.log"
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const expected=JSON.parse(await readFile(process.argv[2]));for(const [p,h] of Object.entries(expected))assert.equal(createHash('sha256').update(await readFile(p)).digest('hex'),h,p);console.log('DETERMINISTIC',Object.keys(expected).length,'generated files');
JS
npm run verify:source > "$evidence_dir/source-verification.log" 2>&1
npm run test:image > "$evidence_dir/conformance.log" 2>&1
npm run typecheck:image > "$evidence_dir/typecheck.log" 2>&1
npm pack --ignore-scripts --json --pack-destination "$evidence_dir" > "$evidence_dir/pack.json"
cp test/image-proposal.mjs "$build_dir/consumer/test.mjs"
cp consumer/image/index.ts consumer/image/tsconfig.json "$build_dir/consumer/"
cd "$build_dir/consumer"
printf '{"name":"independent-local-consumer","private":true,"type":"module"}\n' > package.json
npm install --ignore-scripts --no-audit --no-fund --save-exact "$evidence_dir/hanaworlds-contracts-0.4.1.tgz" typescript@5.8.3 > "$evidence_dir/consumer-install.log" 2>&1
node test.mjs > "$evidence_dir/consumer-conformance.log" 2>&1
./node_modules/.bin/tsc --project tsconfig.json > "$evidence_dir/consumer-types.log" 2>&1
node --input-type=module <<'JS' > "$evidence_dir/consumer-identity.log"
import * as a from 'hanaworlds-contracts';console.log(import.meta.resolve('hanaworlds-contracts'));console.log(a.contractHandshake);
JS
shasum -a 256 "$evidence_dir/hanaworlds-contracts-0.4.1.tgz" > "$evidence_dir/tar.sha256"
printf 'SOURCE/FIXTURE COMPLETE; real runtime/UI NOT_RUN\n'

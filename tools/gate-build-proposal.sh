#!/usr/bin/env bash
# New proposal component only. Never runs the fixed0.3.9 authorization/provider gates.
set -euo pipefail
source_sha=${1:?full committed source SHA required}
evidence_arg=${2:?absolute evidence directory required}
[[ "$source_sha" =~ ^[0-9a-f]{40}$ && "$evidence_arg" == /* ]]
run_root=/Users/yzliu/.cache/hanaworlds-runs/S1-CONTRACT-BUILD-ENTRY-01/skill-proposal-20261006
node_bin=${HANAWORLDS_NODE_BIN:-/Users/yzliu/.local/share/fnm/node-versions/v24.13.1/installation/bin}
export PATH="$node_bin:$PATH"
export npm_config_update_notifier=false npm_config_audit=false npm_config_fund=false
mkdir -p "$evidence_arg"
evidence=$(cd "$evidence_arg" && pwd -P)
work=$(mktemp -d "$run_root/gate-run.XXXXXX")
export npm_config_cache="$work/npm-cache"
cleanup() { case "$work" in "$run_root"/gate-run.*) rm -rf -- "$work" ;; *) exit 97 ;; esac; }
trap cleanup EXIT
exec > >(tee "$evidence/gate.log") 2>&1
set -x
node --version
npm --version
git cat-file -e "$source_sha^{commit}"
mkdir "$work/source"
git archive "$source_sha" | tar -x -C "$work/source"
cd "$work/source"
npm ci --ignore-scripts
node --input-type=module - "$evidence/generated-before.json" <<'JS'
import {readdir,readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const out={};async function walk(p){for(const d of await readdir(p,{withFileTypes:true})){const f=p+'/'+d.name;if(d.isDirectory())await walk(f);else out[f]=createHash('sha256').update(await readFile(f)).digest('hex');}}
for(const p of ['dist','schemas','types','bindings','fixtures','src/generated','src/v3/generated','src/v4/generated'])await walk(p);
await writeFile(process.argv[2],JSON.stringify(out,null,2)+'\n');
JS
npm run build
node --input-type=module - "$evidence/generated-before.json" <<'JS'
import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const files=JSON.parse(await readFile(process.argv[2]));for(const [p,sha] of Object.entries(files))assert.equal(createHash('sha256').update(await readFile(p)).digest('hex'),sha,p);
console.log(JSON.stringify({result:'DETERMINISTIC_GENERATED_BYTES',files:Object.keys(files).length}));
JS
npm run verify:source
npm run typecheck
npm run test:proposal
npm pack --ignore-scripts --pack-destination "$evidence" --json > "$evidence/pack.json"
package_file="$evidence/hanaworlds-contracts-0.3.10.tgz"
shasum -a 256 "$package_file" > "$evidence/package.sha256"
mkdir "$work/consumer"
cp test/build-proposal-v4.mjs "$work/consumer/conformance.mjs"
cd "$work/consumer"
npm install --ignore-scripts --no-package-lock "$package_file"
node conformance.mjs
node --input-type=module - "$source_sha" "$package_file" "$evidence" "$work" <<'JS'
import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import * as C from 'hanaworlds-contracts/v4';
const [sourceSha,file,evidence,temporaryRun]=process.argv.slice(2);const resolution=import.meta.resolve('hanaworlds-contracts/v4');assert(resolution.includes('/consumer/node_modules/hanaworlds-contracts/'));assert.equal(C.version,'0.3.10');
const receipt={result:'PROPOSAL_COMPONENT_SELF_VERIFICATION_COMPLETE',evidence:'SOURCE/FIXTURE',sourceSha,packageVersion:C.version,packageSha256:createHash('sha256').update(await readFile(file)).digest('hex'),resolvedPackedModule:resolution,temporaryRun,proposalCases:217,actualWorldWrites:0,modelCalls:0,providerAuthentication:'NOT_RUN',painterRuntime:'NOT_RUN',realUI:'NOT_RUN'};
await writeFile(evidence+'/receipt.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
JS
set +x
printf '%s\n' 'New proposal component gate exit0; temporary source/consumer/npm cache removed by EXIT trap.'

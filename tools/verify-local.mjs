import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import * as api from '../dist/local/index.mjs';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const profile=await json('spec/local-world/profile.json');
assert.deepEqual(profile,await json('schemas/local/profile.json'));
assert.deepEqual(profile.definitions,api.schemaBundle.definitions);
assert.equal(api.version,'0.5.4');
assert.doesNotMatch(JSON.stringify(profile),/authorizationRef|grantEpoch|requireProtectedClearance|protectedPositions|AuthProjection|OriginalSessionBinding|allowedActions/);
const pkg=await json('package.json');
assert.deepEqual(Object.keys(pkg.exports),['.','./schema','./profile','./fixtures/*','./package.json']);
const refs=[];JSON.stringify(profile.definitions,(k,v)=>{if(k==='$ref')refs.push(v);return v;});for(const r of refs)assert.ok(profile.definitions[r.split('/').at(-1)],r);
for(const name of await readdir('src/local'))if(name.endsWith('.mjs')){const source=await readFile('src/local/'+name,'utf8');assert.doesNotMatch(source,/node:(fs|child_process|http|https|net)|\bfetch\s*\(|\.\.\/v[234]\//,name);assert.equal(source,await readFile('dist/local/'+name,'utf8'));}
for(const [wire,ops] of Object.entries(api.operationContracts))for(const op of ops){assert.ok(profile.definitions[op.request]);assert.ok(profile.definitions[op.response]);assert.equal(profile.definitions[op.request].properties.contractVersion.const,wire);}
console.log('SOURCE VERIFIED: generated profile and runtime, closed references, pure local API, exact version, no old exports');
const declarations=await readFile('types/local/index.d.ts','utf8');
for(const [name,value] of Object.entries(api)){assert.notEqual(value,undefined,'undefined public export '+name);assert.ok(new RegExp('\\b'+name+'\\b').test(declarations),'undeclared public export '+name);}
console.log('Complete root runtime export declaration coverage');

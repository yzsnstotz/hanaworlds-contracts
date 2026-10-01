import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const pkg=await read('package.json'),lock=await read('package-lock.json'),profile=await read('spec/CONTRACT_SCHEMA_PROFILE.json'),inventory=await read('schemas/inventory.json');
assert.equal(pkg.name,'hanaworlds-contracts');assert.match(pkg.version,/^\d+\.\d+\.\d+$/);assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);assert.equal(pkg.dependencies.canonicalize,'5.1.0');
const runtime=await import('../dist/runtime.mjs');assert.equal(runtime.version,pkg.version);assert.equal(runtime.schemaBundle.$id,`https://hanaworlds.invalid/contracts/${pkg.version}/schema.json`);
assert((await readFile('types/index.d.ts','utf8')).includes(`export declare const version: '${pkg.version}';`));
assert.equal(runtime.digestProfile.domainPrefix,'HanaWorlds|contracts@0.1.0|');assert.deepEqual(runtime.wireVersions,profile.wireVersions);assert.equal(runtime.compiledOperationsVersion,profile.compiledOperationsVersion);
assert.equal(lock.packages['node_modules/canonicalize'].version,'5.1.0');assert.equal(lock.packages['node_modules/canonicalize'].integrity,'sha512-bab9+WefZljqQ8jT0qRwVmTyzAUU63K97QIQD3agynIBrb6sa5M2eAy8Hv8K3p4V9+ONVYZKtGYl4Dg+/5Gumw==');
assert.equal(lock.packages['node_modules/typescript'].version,'5.8.3');assert.equal(lock.packages['node_modules/typescript'].integrity,'sha512-p1diW6TqL9L07nNxvRMM7hMMw4c5XOo/1ibL4aAIGmSAt9slTE1Xgw5KWuof2uTOvCg9BY7ZRi+GaF+7sfgPeQ==');
for(const set of [pkg.dependencies,pkg.devDependencies])for(const v of Object.values(set))assert(!/^(?:file:|link:|workspace:|git|https?:)/.test(v));
assert.deepEqual(inventory.types,Object.keys(profile.types));assert.equal(inventory.types.length,243);assert.equal(inventory.bindings.length,8);assert.equal(Object.keys(inventory.projections).length,19);
for(const binding of inventory.bindings){assert(Object.hasOwn(pkg.exports,'./'+binding.wire));await stat(binding.javascript);await stat(binding.declarations);}
for(const path of inventory.schemas)await stat(path);
const sourceImports=[];
async function inspect(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+item.name;if(item.isDirectory())await inspect(path);else if(path.endsWith('.mjs')){const text=await readFile(path,'utf8');for(const m of text.matchAll(/(?:from\s+|import\s*\()(['"])(.*?)\1/g)){const specifier=m[2];sourceImports.push({path,specifier});assert(specifier.startsWith('.')||specifier.startsWith('node:')||specifier==='canonicalize','undeclared runtime dependency '+specifier);}assert(!/\b(?:fetch|connect|createServer|listen|spawn|writeFile|appendFile|mkdir|unlink|rm|registerGadget)\s*\(/.test(text),'runtime side-effect API in '+path);}}}
await inspect('src');
const specFixtures=await readdir('spec/fixtures/candidate');for(const f of specFixtures){const a=await readFile('spec/fixtures/candidate/'+f),b=await readFile('fixtures/candidate/'+f);assert(a.equals(b),'approved fixture changed '+f);}
console.log(JSON.stringify({result:'PASS',evidence:'SOURCE',package:pkg.name,version:pkg.version,types:inventory.types.length,schemas:inventory.schemas.length,bindings:inventory.bindings.length,projections:Object.keys(inventory.projections).length,sourceImports,providerRuntime:'NOT_RUN',actualWorldWrites:0,registryInstallClaimed:false,typescriptIntegrityPresent:!!lock.packages['node_modules/typescript'].integrity}));

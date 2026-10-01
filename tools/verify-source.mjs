import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const pkg=await read('package.json'),lock=await read('package-lock.json'),profile=await read('spec/CONTRACT_SCHEMA_PROFILE.json'),inventory=await read('schemas/inventory.json');
assert.equal(pkg.name,'hanaworlds-contracts');assert.match(pkg.version,/^\d+\.\d+\.\d+$/);assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);assert.equal(pkg.dependencies.canonicalize,'5.1.0');
const runtime=await import('../dist/runtime.mjs');assert.equal(runtime.version,pkg.version);assert.equal(runtime.schemaBundle.$id,'https://hanaworlds.invalid/contracts/0.1.1/schema.json');
assert((await readFile('types/index.d.ts','utf8')).includes(`export declare const version: '${pkg.version}';`));
assert.equal(runtime.digestProfile.domainPrefix,'HanaWorlds|contracts@0.1.0|');assert.deepEqual(runtime.wireVersions,profile.wireVersions);assert.equal(runtime.compiledOperationsVersion,profile.compiledOperationsVersion);
assert.equal(lock.packages['node_modules/canonicalize'].version,'5.1.0');assert.equal(lock.packages['node_modules/canonicalize'].integrity,'sha512-bab9+WefZljqQ8jT0qRwVmTyzAUU63K97QIQD3agynIBrb6sa5M2eAy8Hv8K3p4V9+ONVYZKtGYl4Dg+/5Gumw==');
assert.equal(lock.packages['node_modules/typescript'].version,'5.8.3');assert.equal(lock.packages['node_modules/typescript'].integrity,'sha512-p1diW6TqL9L07nNxvRMM7hMMw4c5XOo/1ibL4aAIGmSAt9slTE1Xgw5KWuof2uTOvCg9BY7ZRi+GaF+7sfgPeQ==');
for(const set of [pkg.dependencies,pkg.devDependencies])for(const v of Object.values(set))assert(!/^(?:file:|link:|workspace:|git|https?:)/.test(v));
assert.deepEqual(inventory.types,Object.keys(profile.types));assert.equal(inventory.types.length,243);assert.equal(inventory.bindings.length,8);assert.equal(Object.keys(inventory.projections).length,19);
for(const binding of inventory.bindings){assert(Object.hasOwn(pkg.exports,'./'+binding.wire));await stat(binding.javascript);await stat(binding.declarations);}
for(const path of inventory.schemas)await stat(path);
const v3Profile=await read('spec/v3/CONTRACT_SCHEMA_PROFILE.json'),v3Closure=await read('spec/v3/CONTRACT_SEMANTIC_CLOSURE.json'),v3Inventory=await read('schemas/v3/inventory.json');
const v3=await import('../dist/v3/runtime.mjs');
assert.equal(v3.version,'0.2.0');
assert.equal(v3.schemaBundle.$id,'https://hanaworlds.invalid/contracts/0.2.0/v3/schema.json');
assert.deepEqual(v3.wireVersions,v3Profile.wireVersions);
assert.deepEqual(v3Inventory.types,Object.keys(v3Profile.types));
assert.equal(v3Inventory.types.length,258);
assert.equal(v3Inventory.bindings.length,2);
assert.equal(Object.keys(v3Inventory.projections).length,20);
assert.equal(v3Closure.rows.length,76);
assert.equal(v3Closure.openUserDecisions.length,0);
for(const binding of v3Inventory.bindings){assert(Object.hasOwn(pkg.exports,'./'+binding.wire));await stat(binding.javascript);await stat(binding.declarations);}
for(const path of v3Inventory.schemas)await stat(path);
for(const path of await readdir('spec/v3/fixtures/candidate')){
  const source=await readFile('spec/v3/fixtures/candidate/'+path),packaged=await readFile('fixtures/v3/candidate/'+path);
  assert(source.equals(packaged),'v3 fixture drift '+path);
}
const sourceImports=[];
async function inspect(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+item.name;if(item.isDirectory())await inspect(path);else if(path.endsWith('.mjs')){const text=await readFile(path,'utf8');for(const m of text.matchAll(/(?:from\s+|import\s*\()(['"])(.*?)\1/g)){const specifier=m[2];sourceImports.push({path,specifier});assert(specifier.startsWith('.')||specifier.startsWith('node:')||specifier==='canonicalize','undeclared runtime dependency '+specifier);}assert(!/\b(?:fetch|connect|createServer|listen|spawn|writeFile|appendFile|mkdir|unlink|rm|registerGadget)\s*\(/.test(text),'runtime side-effect API in '+path);}}}
await inspect('src');
const specFixtures=await readdir('spec/fixtures/candidate');for(const f of specFixtures){const a=await readFile('spec/fixtures/candidate/'+f),b=await readFile('fixtures/candidate/'+f);assert(a.equals(b),'approved fixture changed '+f);}
console.log(JSON.stringify({result:'PASS_SOURCE_INVENTORY_ONLY',evidence:'SOURCE',package:pkg.name,version:pkg.version,
  v2:{types:inventory.types.length,schemas:inventory.schemas.length,bindings:inventory.bindings.length,projections:Object.keys(inventory.projections).length},
  v3:{types:v3Inventory.types.length,schemas:v3Inventory.schemas.length,bindings:v3Inventory.bindings.length,projections:Object.keys(v3Inventory.projections).length,semanticRows:v3Closure.rows.length},
  sourceImportCount:sourceImports.length,providerRuntime:'NOT_RUN',actualWorldWrites:0,registryInstallClaimed:false,typescriptIntegrityPresent:!!lock.packages['node_modules/typescript'].integrity}));

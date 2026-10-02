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
const approvedInput=await read('spec/v3/APPROVED_INPUT.json');
assert.equal(approvedInput.candidateDigest,'8bc7f14de26fb1323ffc882d95118dbbc06023497b59b637c3f65d87468422f1');
assert.equal(approvedInput.manifestCoreDigest,'091ccbe31ec564f5ba2c46c1899f60e573ad04cd6b56794933fd7860796b10e6');
assert.equal(approvedInput.approvedZipSha256,'63dcbb85b48f23fb0ae513c1c686a504e003704b1df1534b8690e05fbb94469f');
assert.equal(Object.keys(approvedInput.filesSha256).length,13);
for(const [path,digest] of Object.entries(approvedInput.filesSha256))
  assert.equal(createHash('sha256').update(await readFile('spec/v3/'+path)).digest('hex'),digest,'approved input drift: '+path);
const v3=await import('../dist/v3/runtime.mjs');
assert.equal(v3.version,pkg.version);
assert.equal(v3Profile.package,'hanaworlds-contracts@0.2.1');
assert.equal(v3.schemaBundle.$id,'https://hanaworlds.invalid/contracts/0.2.1/v3/schema.json');
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
const v4Profile=await read('spec/v4/CONTRACT_SCHEMA_PROFILE.json'),v4Closure=await read('spec/v4/CONTRACT_SEMANTIC_CLOSURE.json'),v4Inventory=await read('schemas/v4/inventory.json');
const v4Input=await read('spec/v4/APPROVED_INPUT.json');
assert.equal(v4Input.bluemapVersion,'3.0.0-rc.8');
assert.equal(v4Input.candidateDigest,'38687f19ff64b6fbff9da549015f2505eeff397a6d37c8e358f36a7b3764b41a');
assert.equal(v4Input.manifestCoreDigest,'ae95aca6f7a5aa143fb7be3056ba29027a02fa94a6c13ad1a638ad2c72656173');
assert.equal(v4Input.contractSemanticClosureSha256,'595209a4bdd78d8a188ec41ba7a9b8bf6aedfb38982a43c813b0189d10731747');
assert.equal(Object.keys(v4Input.filesSha256).length,28);
for(const [path,digest] of Object.entries(v4Input.filesSha256))
  assert.equal(createHash('sha256').update(await readFile('spec/v4/'+path)).digest('hex'),digest,'approved v4 input drift: '+path);
assert.equal(v4Input.filesSha256['CONTRACT_SEMANTIC_CLOSURE.json'],v4Input.contractSemanticClosureSha256);
const v4=await import('../dist/v4/runtime.mjs');
assert.equal(v4.version,pkg.version);assert.equal(v4Profile.package,pkg.name+'@'+pkg.version);
assert.equal(v4.schemaBundle.$id,'https://hanaworlds.invalid/contracts/'+pkg.version+'/v4/schema.json');
assert.deepEqual(v4.wireVersions,v4Profile.wireVersions);assert.deepEqual(v4Inventory.types,Object.keys(v4Profile.types));
assert.equal(v4Inventory.types.length,283);assert.equal(v4Inventory.bindings.length,8);assert.equal(Object.keys(v4Inventory.projections).length,20);
assert.equal(v4Closure.rows.length,93);assert.equal(v4Closure.openUserDecisions.length,0);assert.equal(v4Inventory.approvedClosureSha256,v4Input.contractSemanticClosureSha256);
for(const binding of v4Inventory.bindings){assert(Object.hasOwn(pkg.exports,binding.specifier.replace('hanaworlds-contracts/','./')),binding.specifier);await stat(binding.javascript);await stat(binding.declarations);}
for(const path of v4Inventory.schemas)await stat(path);
for(const path of await readdir('spec/v4/fixtures/candidate')){
  const source=await readFile('spec/v4/fixtures/candidate/'+path),packaged=await readFile('fixtures/v4/candidate/'+path);
  assert(source.equals(packaged),'v4 fixture drift '+path);
}
for(const path of ['CONTRACT_SCHEMA_PROFILE.json','CONTRACT_SEMANTIC_CLOSURE.json','SETTINGS_AND_INVARIANTS.json'])
  assert((await readFile('spec/v4/'+path)).equals(await readFile('schemas/v4/profile/'+path)),'v4 profile drift '+path);
const sourceImports=[];
async function inspect(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+item.name;if(item.isDirectory())await inspect(path);else if(path.endsWith('.mjs')){const text=await readFile(path,'utf8');for(const m of text.matchAll(/(?:from\s+|import\s*\()(['"])(.*?)\1/g)){const specifier=m[2];sourceImports.push({path,specifier});assert(specifier.startsWith('.')||specifier.startsWith('node:')||specifier==='canonicalize','undeclared runtime dependency '+specifier);}assert(!/\b(?:fetch|connect|createServer|listen|spawn|writeFile|appendFile|mkdir|unlink|rm|registerGadget)\s*\(/.test(text),'runtime side-effect API in '+path);}}}
await inspect('src');
const specFixtures=await readdir('spec/fixtures/candidate');for(const f of specFixtures){const a=await readFile('spec/fixtures/candidate/'+f),b=await readFile('fixtures/candidate/'+f);assert(a.equals(b),'approved fixture changed '+f);}
console.log(JSON.stringify({result:'PASS_SOURCE_INVENTORY_ONLY',evidence:'SOURCE',package:pkg.name,version:pkg.version,
  v2:{types:inventory.types.length,schemas:inventory.schemas.length,bindings:inventory.bindings.length,projections:Object.keys(inventory.projections).length},
  v3:{types:v3Inventory.types.length,schemas:v3Inventory.schemas.length,bindings:v3Inventory.bindings.length,projections:Object.keys(v3Inventory.projections).length,semanticRows:v3Closure.rows.length,approvedInputFiles:Object.keys(approvedInput.filesSha256).length},
  v4:{types:v4Inventory.types.length,schemas:v4Inventory.schemas.length,bindings:v4Inventory.bindings.length,projections:Object.keys(v4Inventory.projections).length,semanticRows:v4Closure.rows.length,approvedInputFiles:Object.keys(v4Input.filesSha256).length},
  sourceImportCount:sourceImports.length,providerRuntime:'NOT_RUN',actualWorldWrites:0,registryInstallClaimed:false,typescriptIntegrityPresent:!!lock.packages['node_modules/typescript'].integrity}));

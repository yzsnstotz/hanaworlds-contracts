// Additive-only check: every baseline type, operation, ownership row, digest kind,
// setting and invariant is unchanged; prints exactly what was added.
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const [basePath,newPath]=process.argv.slice(2);
const b=JSON.parse(await readFile(basePath,'utf8')),n=JSON.parse(await readFile(newPath,'utf8'));
for(const [k,v] of Object.entries(b.definitions))assert.deepEqual(n.definitions[k],v,'changed type '+k);
for(const [w,ops] of Object.entries(b.operations))assert.deepEqual(n.operations[w],ops,'changed wire '+w);
for(const [w,o] of Object.entries(b.ownership))assert.deepEqual(n.ownership[w],o,'changed ownership '+w);
for(const [k,t] of Object.entries(b.digest.projectionTypes))assert.equal(n.digest.projectionTypes[k],t);
assert.equal(n.digest.domainPrefix,b.digest.domainPrefix);assert.equal(n.digest.domainPrefixByKind['material-sources'],b.digest.domainPrefixByKind['material-sources']);
for(const k of ['placementSettings','placementInvariants','settingsSurface','canvasEventRules','compiledOperationsVersion'])assert.deepEqual(n[k],b[k],k);
assert.ok(b.wireVersions.every(w=>n.wireVersions.includes(w)));
console.log(JSON.stringify({baseline:b.version,current:n.version,unchangedTypes:Object.keys(b.definitions).length,
 addedTypes:Object.keys(n.definitions).filter(k=>!(k in b.definitions)).length,addedWires:n.wireVersions.filter(w=>!b.wireVersions.includes(w)),
 addedOperations:Object.values(n.operations).flat().length-Object.values(b.operations).flat().length,
 addedDigestKinds:Object.keys(n.digest.projectionTypes).filter(k=>!(k in b.digest.projectionTypes)),settingsAdded:n.placementSettings.length-b.placementSettings.length}));

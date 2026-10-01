import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as V3 from 'hanaworlds-contracts/v3';
import * as Canvas from 'hanaworlds-contracts/canvas/v3';
import * as Adapter from 'hanaworlds-contracts/world-adapter/v3';
import * as F from 'hanaworlds-contracts/v3/fixture';

const read = async name => JSON.parse(await readFile(new URL(import.meta.resolve(`hanaworlds-contracts/v3/fixtures/${name}`)), 'utf8'));
const oracle = await read('contract-v3-oracles');
const goldens = (await read('production-goldens')).vectors;
const wires = (await read('wire-inputs-v3')).requests;
const pkg = JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/package.json')), 'utf8'));
assert.equal(pkg.version, '0.2.0');
assert.equal(V3.version, pkg.version);
assert.equal(Canvas.contractVersion, 'canvas/v3');
assert.equal(Adapter.contractVersion, 'world-adapter/v3');
assert.equal(V3.schemaInventory.length, 258);
assert.equal(Object.keys(V3.digestProfile.projectionTypes).length, 20);
assert.equal(V3.digestValue('history-operation', oracle.historyOperationGolden.projection).sha256,
  oracle.historyOperationGolden.expectedDigest);
assert.equal(V3.digestValue('authorization-binding', oracle.historyAuthorizationBindingGolden.projection).sha256,
  oracle.historyAuthorizationBindingGolden.expectedDigest);
for (const value of goldens) assert.equal(V3.digestValue(value.kind, value.payload).sha256, value.expected.sha256, value.id);
for (const value of wires) {
  const admitted = V3.admitRequest(value.wire, value.operation, new TextEncoder().encode(JSON.stringify(value.request)));
  assert.deepEqual(JSON.parse(JSON.stringify(admitted)), value.request, value.id);
}
for (const value of oracle.cases) {
  const actual = F.evaluateV3Fixture(value.type, value.request, value.context);
  for (const [key, expected] of Object.entries(value.expected)) assert.deepEqual(actual[key], expected, `${value.id}.${key}`);
}
const loaded = [];
for (const name of ['v3', 'world-adapter/v3', 'canvas/v3', 'v3/fixture', 'v3/schemas']) {
  const specifier = `hanaworlds-contracts/${name}`;
  await import(specifier);
  const path = new URL(import.meta.resolve(specifier));
  loaded.push({ specifier, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
}
const result = { evidence: 'PACKAGE_REAL_RUNTIME', version: pkg.version, providerRuntime: 'NOT_RUN',
  historicalGoldens: goldens.length, v3WireRequests: wires.length, v3Oracles: oracle.cases.length,
  loaded, specificationStatus: 'PARTIAL_SPEC_CONFLICT' };
await writeFile('consumer-result-v3.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));

/** Copy this file outside the repository and run it against an installed tarball.
 * Only public package exports are used; results are PACKAGE_REAL_RUNTIME for the
 * contract code itself, never provider or world evidence. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as V4 from 'hanaworlds-contracts/v4';
import * as F from 'hanaworlds-contracts/v4/fixture';

const read = async name => JSON.parse(await readFile(new URL(import.meta.resolve(`hanaworlds-contracts/v4/fixtures/${name}`)), 'utf8'));
const pkg = JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/package.json')), 'utf8'));
const oracle = await read('contract-v4-oracles');
const goldens = (await read('production-goldens')).vectors;
const wires = (await read('wire-inputs-v4')).requests;
const closures = (await read('closure-oracles-v4')).cases;
const events = (await read('canvas-events-v4')).cases;
const placement = await read('placement-region-chain-v4');
const seam = (await read('history-seam-chain-v4')).validCases[0].materializedChain;
assert.equal(pkg.version, '0.3.2');
assert.equal(V4.version, pkg.version);
assert.equal(V4.schemaInventory.length, 283);
assert.equal(Object.keys(V4.digestProfile.projectionTypes).length, 20);
for (const value of goldens) assert.equal(V4.digestValue(value.kind, value.payload).sha256, value.expected.sha256, value.id);
const bindings = { 'interaction-surface/v3': 'interaction-surface/v3', 'world-adapter/v4': 'world-adapter/v4', 'canvas/v4': 'canvas/v4', 'painter/v3': 'painter/v3',
  'session/v2': 'v4/session/v2', 'ReferenceBrief/v2': 'v4/ReferenceBrief/v2', 'BUILD/V2': 'v4/BUILD/V2' };
for (const value of wires) {
  const binding = await import('hanaworlds-contracts/' + bindings[value.wire]);
  assert.equal(binding.contractVersion, value.wire);
  const admitted = binding.admit(value.operation, new TextEncoder().encode(JSON.stringify(value.request)));
  assert.deepEqual(JSON.parse(JSON.stringify(admitted)), value.request, value.id);
}
for (const value of oracle.cases) {
  const actual = F.evaluateV4Fixture(value.type, value.request, value.context);
  for (const [key, expected] of Object.entries(value.expected)) assert.deepEqual(actual[key], expected, `${value.id}.${key}`);
}
const assets = { requests: wires, goldens: goldens.map(({ id, kind, payload }) => ({ id, kind, payload })) };
let closureCount = 0;
for (const value of closures.filter(x => V4.wireVersions.includes(x.wire))) {
  const actual = F.evaluateClosureFixture(value.wire, value.dimension, value.input, assets);
  for (const [key, expected] of Object.entries(value.expected)) assert.deepEqual(actual[key], expected, `${value.id}.${key}`);
  closureCount++;
}
for (const value of events) {
  const actual = F.evaluateCanvasEventFixture(value.eventType, value.input);
  for (const [key, expected] of Object.entries(value.expected)) assert.deepEqual(actual[key], expected, `${value.id}.${key}`);
}
for (const c of placement.compatibilityCases) {
  let outcome = 'HANDSHAKE_VERSION_MATCH';
  try { V4.checkContractHandshake(c.advertised, c.required); } catch (error) { outcome = error.publicError.code; }
  assert.equal(outcome, c.expected.result === 'HANDSHAKE_VERSION_MATCH' ? 'HANDSHAKE_VERSION_MATCH' : c.expected.code, c.id);
}
const m = placement.validCases.find(x => x.id === 'PLACE-LUANTI-INITIATOR-CHAIN').materializedChain;
V4.validateRegionInspection(m.adapterInspectResponse.result.inspection);
V4.validateBoundRequest('painter/v3', 'CreateBuildPlan', m.painterRequest);
V4.validateBoundRequest('canvas/v4', 'ApplyRecoverableCommit', m.applyRequest);
assert.deepEqual(JSON.parse(JSON.stringify(V4.projectPreparedTransaction(seam.prepareResponse.result))), seam.applyRequest.preparedTransaction);
const loaded = [];
for (const name of ['v4', 'v4/fixture', 'v4/schemas', ...Object.values(bindings), 'v4/operations/v2']) {
  const specifier = `hanaworlds-contracts/${name}`;
  await import(specifier);
  loaded.push({ specifier, sha256: createHash('sha256').update(await readFile(new URL(import.meta.resolve(specifier)))).digest('hex') });
}
for (const [name, relative] of [['v4-runtime', './runtime.mjs'], ['v4-generated-profile', './generated/contracts.mjs']])
  loaded.push({ specifier: name, sha256: createHash('sha256').update(await readFile(new URL(relative, import.meta.resolve('hanaworlds-contracts/v4')))).digest('hex') });
const result = { evidence: 'PACKAGE_REAL_RUNTIME', version: pkg.version, providerRuntime: 'NOT_RUN', goldens: goldens.length, wireRequests: wires.length,
  closureCases: closureCount, eventCases: events.length, v4Oracles: oracle.cases.length, handshakeCases: placement.compatibilityCases.length,
  contractHandshake: V4.contractHandshake, loaded, specificationStatus: 'FIXTURE_PASS_INDEPENDENT_REVIEW_NOT_RUN' };
await writeFile('consumer-result-v4.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ ...result, loaded: loaded.length }));

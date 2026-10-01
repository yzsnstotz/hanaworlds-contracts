import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let V3;
let canvas;
let adapter;
let fixtures;
try {
  [V3, canvas, adapter, fixtures] = await Promise.all([
    import('hanaworlds-contracts/v3'),
    import('hanaworlds-contracts/canvas/v3'),
    import('hanaworlds-contracts/world-adapter/v3'),
    import('hanaworlds-contracts/v3/fixture'),
  ]);
} catch (error) {
  assert.fail(`The public v3 contract exports must resolve: ${error.code ?? error.message}`);
}

const read = async name => JSON.parse(await readFile(new URL(`../spec/v3/fixtures/candidate/${name}.json`, import.meta.url), 'utf8'));
const profile = JSON.parse(await readFile(new URL('../spec/v3/CONTRACT_SCHEMA_PROFILE.json', import.meta.url), 'utf8'));
const closure = JSON.parse(await readFile(new URL('../spec/v3/CONTRACT_SEMANTIC_CLOSURE.json', import.meta.url), 'utf8'));
const v3 = await read('contract-v3-oracles');
const wires = (await read('wire-inputs-v3')).requests;
const closures = (await read('closure-oracles-v3')).cases;
const events = (await read('canvas-events-v3')).cases;
const goldens = (await read('production-goldens')).vectors;
const utf8 = value => new TextEncoder().encode(JSON.stringify(value));
const plain = value => JSON.parse(JSON.stringify(value));

assert.equal(V3.version, '0.2.0');
assert.deepEqual(V3.wireVersions, profile.wireVersions);
assert.equal(V3.schemaInventory.length, 258);
assert.equal(Object.keys(V3.digestProfile.projectionTypes).length, 20);
assert.equal(canvas.contractVersion, 'canvas/v3');
assert.equal(adapter.contractVersion, 'world-adapter/v3');
assert.equal(V3.operationContracts['canvas/v3'].length, 16);
assert.equal(V3.operationContracts['world-adapter/v3'].length, 15);
assert.equal(closure.rows.length, 76);

for (const vector of goldens) {
  const actual = V3.digestValue(vector.kind, vector.payload);
  for (const key of ['canonicalUtf8', 'preimageUtf8', 'preimageHex', 'sha256']) assert.equal(actual[key], vector.expected[key], `${vector.id}.${key}`);
}
const history = V3.digestValue('history-operation', v3.historyOperationGolden.projection);
assert.equal(history.sha256, v3.historyOperationGolden.expectedDigest);
assert.equal(history.preimageUtf8.startsWith('HanaWorlds|contracts@0.2.0|history-operation\n'), true);
assert.equal(V3.digestValue('authorization-binding', v3.historyAuthorizationBindingGolden.projection).sha256,
  v3.historyAuthorizationBindingGolden.expectedDigest);

for (const wire of wires) {
  assert.deepEqual(plain(V3.validateRequest(wire.wire, wire.operation, wire.request)), wire.request, wire.id);
  assert.deepEqual(plain(V3.admitRequest(wire.wire, wire.operation, utf8(wire.request))), wire.request, `${wire.id}.raw`);
  const binding = await import(`hanaworlds-contracts/${wire.wire}`);
  assert.deepEqual(plain(binding.admit(wire.operation, utf8(wire.request))), wire.request, `${wire.id}.binding`);
}

const assets = { requests: wires, goldens: goldens.map(({ id, kind, payload }) => ({ id, kind, payload })) };
const specConflicts = [];
for (const fixture of closures) {
  const actual = fixtures.evaluateClosureFixture(fixture.wire, fixture.dimension, fixture.input, assets);
  if (['WA-09-VALID', 'CA-09-VALID'].includes(fixture.id)) {
    assert.equal(actual.code, 'UNSUPPORTED_VERSION');
    specConflicts.push(fixture.id);
    continue;
  }
  for (const [key, value] of Object.entries(fixture.expected)) assert.deepEqual(actual[key], value, `${fixture.id}.${key}`);
}
const wa09 = closures.find(value => value.id === 'WA-09-VALID');
assert.equal(fixtures.evaluateClosureFixture(wa09.wire, wa09.dimension,
  { ...wa09.input, consumerWire: 'world-adapter/v3', providerWire: 'world-adapter/v3' }, assets).result, 'HANDSHAKE_VERSION_MATCH');
assert.equal(fixtures.evaluateClosureFixture(wa09.wire, wa09.dimension,
  { ...wa09.input, consumerWire: 'world-adapter/v3', providerWire: 'world-adapter/v2' }, assets).code, 'UNSUPPORTED_VERSION');
for (const fixture of events) {
  const actual = fixtures.evaluateCanvasEventFixture(fixture.eventType, fixture.input);
  if (['ObjectNameChanged', 'HistoryPositionChanged'].includes(fixture.eventType)) {
    assert.equal(actual.result, 'REJECT_EVENT_INPUT');
    assert.equal(actual.worldWrites, 0);
    specConflicts.push(fixture.id);
    continue;
  }
  for (const [key, value] of Object.entries(fixture.expected)) assert.deepEqual(actual[key], value, `${fixture.id}.${key}`);
}
for (const fixture of v3.cases) {
  const actual = fixtures.evaluateV3Fixture(fixture.type, fixture.request, fixture.context);
  for (const [key, value] of Object.entries(fixture.expected)) assert.deepEqual(actual[key], value, `${fixture.id}.${key}`);
}

const apply = v3.cases.find(value => value.id === 'B-VALID-CANVAS-PREPARE').request;
assert.equal(Object.hasOwn(apply, 'preparedTransaction'), false);
assert.equal(V3.validateRequest('canvas/v3', 'ApplyRecoverableCommit', apply).transactionId, apply.transactionId);
assert.equal(V3.validateBoundRequest('canvas/v3', 'ApplyRecoverableCommit', apply).transactionId, apply.transactionId);
assert.throws(() => V3.admitRequest('canvas/v3', 'ApplyRecoverableCommit', utf8({ ...apply, preparedTransaction: {} })),
  error => error.publicError?.code === 'UNKNOWN_REQUIRED_FIELD');
assert.throws(() => V3.admitRequest('canvas/v3', 'ApplyRecoverableCommit', new TextEncoder().encode('{"a":1,"\\u0061":2}')),
  error => error.publicError?.reason === 'DUPLICATE_DECODED_KEY');
assert.throws(() => V3.validateRequest('canvas/v2', 'ApplyRecoverableCommit', apply),
  error => error.publicError?.code === 'UNSUPPORTED_VERSION');

console.log(JSON.stringify({ result: 'PARTIAL_SPEC_CONFLICT', evidence: 'SOURCE/FIXTURE', version: V3.version, wires: wires.length,
  closureCases: closures.length, eventCases: events.length, v3Cases: v3.cases.length, goldens: goldens.length,
  types: V3.schemaInventory.length, projections: Object.keys(V3.digestProfile.projectionTypes).length,
  specConflicts, providerRuntime: 'NOT_RUN' }));

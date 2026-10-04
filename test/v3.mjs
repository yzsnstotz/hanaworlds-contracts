import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as V2 from 'hanaworlds-contracts';

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
const historyResponses = await read('history-allowlist-response-oracles');
const digestResponses = await read('digest-allowlist-precedence-oracles');
const wires = (await read('wire-inputs-v3')).requests;
const closures = (await read('closure-oracles-v3')).cases;
const events = (await read('canvas-events-v3')).cases;
const goldens = (await read('production-goldens')).vectors;
const utf8 = value => new TextEncoder().encode(JSON.stringify(value));
const plain = value => JSON.parse(JSON.stringify(value));

// Re-versioned for contracts@0.3.1: the v3 lane reports the package version; its schema identity stays at 0.2.1.
assert.equal(V3.version, '0.3.1');
assert.equal(V3.schemaBundle.$id, 'https://hanaworlds.invalid/contracts/0.2.1/v3/schema.json');
assert.deepEqual(V3.wireVersions, profile.wireVersions);
assert.equal(V3.schemaInventory.length, 258);
assert.equal(Object.keys(V3.digestProfile.projectionTypes).length, 20);
assert.equal(canvas.contractVersion, 'canvas/v3');
assert.equal(adapter.contractVersion, 'world-adapter/v3');
assert.equal(V3.operationContracts['canvas/v3'].length, 16);
assert.equal(V3.operationContracts['world-adapter/v3'].length, 15);
assert.equal(closure.rows.length, 76);
for (const name of ['AffectedProjection', 'AuthProjection', 'TxProjection', 'ReceiptProjection'])
  assert.deepEqual(V3.schemaBundle.definitions[name], V2.schemaBundle.definitions[name], `${name} v2 projection unchanged`);
for (const prefix of ['WA', 'CA']) {
  const row = closure.rows.find(value => value.id === `${prefix}-09`);
  assert.ok(row.rule.includes('v3') && !row.rule.includes('seven v2'), `${prefix}-09 closure must describe current wire`);
}

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
for (const fixture of closures) {
  const actual = fixtures.evaluateClosureFixture(fixture.wire, fixture.dimension, fixture.input, assets);
  for (const [key, value] of Object.entries(fixture.expected)) assert.deepEqual(actual[key], value, `${fixture.id}.${key}`);
}
for (const prefix of ['WA', 'CA']) {
  const valid = closures.find(value => value.id === `${prefix}-09-VALID`);
  const mixed = closures.find(value => value.id === `${prefix}-09-MIXED-INVALID`);
  assert.ok(valid && mixed, `${prefix} approved v3 positive and mixed negative must both exist`);
  assert.equal(valid.input.consumerWire, valid.wire);
  assert.equal(valid.input.providerWire, valid.wire);
  assert.equal(mixed.input.consumerWire, valid.wire);
  assert.notEqual(mixed.input.providerWire, valid.wire);
  const rejected = fixtures.evaluateClosureFixture(mixed.wire, mixed.dimension, mixed.input, assets);
  assert.equal(rejected.code, 'UNSUPPORTED_VERSION');
  assert.equal(rejected.worldWrites, 0);
}
for (const fixture of events) {
  const actual = fixtures.evaluateCanvasEventFixture(fixture.eventType, fixture.input);
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

// A full history projection can be recomputed at admission. Later operations
// carry only the previously bound digest or a prepared transaction reference.
const historyPrepare = v3.cases.find(value => value.id === 'A-VALID-AUTHOR-LINKED-UNDO').request;
const historyQuery = v3.cases.find(value => value.id === 'A-VALID-RESTART-QUERY').request;
const historyApply = v3.cases.find(value => value.id === 'A-AMBIGUOUS-AFTER-WRITE').request;
const historyAbort = { ...historyQuery, serviceRecoveryRef: 'FIXTURE-service-recovery' };
delete historyAbort.direction;
for (const [operation, request] of [
  ['PrepareHistoryTransaction', historyPrepare],
  ['QueryPreparedHistoryTransaction', historyQuery],
  ['ApplyHistoryTransaction', historyApply],
  ['AbortPreparedHistoryTransaction', historyAbort],
]) assert.deepEqual(plain(V3.validateBoundRequest('world-adapter/v3', operation, request)), request, operation);
assert.throws(() => V3.validateBoundRequest('world-adapter/v3', 'PrepareHistoryTransaction',
  { ...historyPrepare, historyOperationDigest: '0'.repeat(64) }),
  error => error.publicError?.code === 'NON_CANONICAL_AMBIGUITY');
assert.throws(() => V3.validateBoundRequest('world-adapter/v3', 'PrepareHistoryTransaction',
  { ...historyPrepare, expectedHistoryRevision: 'tampered-history-revision' }),
  error => error.publicError?.code === 'NON_CANONICAL_AMBIGUITY');
assert.throws(() => V3.validateBoundRequest('world-adapter/v3', 'QueryPreparedHistoryTransaction',
  { ...historyQuery, historyOperationDigest: 'bad' }),
  error => error.publicError?.code === 'SCHEMA_INVALID');
assert.throws(() => V3.validateBoundRequest('world-adapter/v3', 'ApplyHistoryTransaction',
  { ...historyApply, preparedHistoryTransaction: { ...historyApply.preparedHistoryTransaction, historyOperationDigest: '0'.repeat(64) } }),
  error => error.publicError?.code === 'NON_CANONICAL_AMBIGUITY');
assert.throws(() => V3.validateBoundRequest('world-adapter/v3', 'AbortPreparedHistoryTransaction',
  { ...historyAbort, historyOperationDigest: 'bad' }),
  error => error.publicError?.code === 'SCHEMA_INVALID');

assert.equal(historyResponses.cases.length, 13);
assert.equal(historyResponses.packageIdentity, 'hanaworlds-contracts@0.2.1');
assert.equal(historyResponses.historyOperationDigestDomain, 'HanaWorlds|contracts@0.2.0|history-operation\n');
for (const fixture of historyResponses.cases) {
  assert.deepEqual(plain(V3.validateType(fixture.responseType, fixture.response)), fixture.response, `${fixture.id}.schema`);
  if (fixture.kind === 'valid')
    assert.deepEqual(plain(V3.validateResponse('world-adapter/v3', fixture.operation, fixture.response)), fixture.response, fixture.id);
  else
    assert.throws(() => V3.validateResponse('world-adapter/v3', fixture.operation, fixture.response),
      error => error.publicError?.code === 'SCHEMA_INVALID', fixture.id);
}

assert.equal(digestResponses.cases.length, 8);
assert.equal(digestResponses.packageIdentity, 'hanaworlds-contracts@0.2.1');
for (const fixture of digestResponses.cases) {
  assert.equal(fixture.facts.sourceCaseId, 'WA-02-INVALID');
  assert.deepEqual(plain(V3.validateType(fixture.responseType, fixture.response)), fixture.response, `${fixture.id}.schema`);
  assert.deepEqual(plain(V3.validateResponse('world-adapter/v3', fixture.operation, fixture.response)), fixture.response, fixture.id);
  assert.equal(fixture.response.error.phase, fixture.expected.phase, `${fixture.id}.phase`);
  assert.equal(fixture.response.error.mutationState, fixture.expected.mutationState, `${fixture.id}.mutationState`);
  if (fixture.kind === 'precedence-negative') {
    assert.equal(fixture.facts.authorization, 'REVOKED');
    assert.notEqual(fixture.response.error.code, fixture.forbiddenCode, `${fixture.id}.authorized-precedence`);
  } else assert.equal(fixture.facts.authorization, 'VALID');
}
const ambiguityOps = V3.operationContracts['world-adapter/v3']
  .filter(value => value.failureCodes.includes('NON_CANONICAL_AMBIGUITY')).map(value => value.operation).sort();
assert.deepEqual(ambiguityOps, ['ApplyCompiledTransaction', 'ApplyHistoryTransaction', 'PrepareHistoryTransaction', 'PrepareRecoverableTransaction']);
const ambiguityResponse = digestResponses.cases[0].response;
for (const operation of ['QueryPreparedHistoryTransaction', 'AbortPreparedHistoryTransaction', 'QueryTransaction'])
  assert.throws(() => V3.validateResponse('world-adapter/v3', operation, ambiguityResponse),
    error => error.publicError?.code === 'SCHEMA_INVALID', `${operation}.does-not-admit-digest-response`);

console.log(JSON.stringify({ result: 'PASS_FIXTURE', evidence: 'SOURCE/FIXTURE', version: V3.version, wires: wires.length,
  closureCases: closures.length, eventCases: events.length, v3Cases: v3.cases.length, historyResponseCases: historyResponses.cases.length, digestResponseCases: digestResponses.cases.length, goldens: goldens.length,
  types: V3.schemaInventory.length, projections: Object.keys(V3.digestProfile.projectionTypes).length,
  providerRuntime: 'NOT_RUN' }));

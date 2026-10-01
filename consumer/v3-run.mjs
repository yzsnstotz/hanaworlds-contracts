import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as V3 from 'hanaworlds-contracts/v3';
import * as Canvas from 'hanaworlds-contracts/canvas/v3';
import * as Adapter from 'hanaworlds-contracts/world-adapter/v3';
import * as F from 'hanaworlds-contracts/v3/fixture';

const read = async name => JSON.parse(await readFile(new URL(import.meta.resolve(`hanaworlds-contracts/v3/fixtures/${name}`)), 'utf8'));
const oracle = await read('contract-v3-oracles');
const historyResponses = await read('history-allowlist-response-oracles');
const digestResponses = await read('digest-allowlist-precedence-oracles');
const goldens = (await read('production-goldens')).vectors;
const wires = (await read('wire-inputs-v3')).requests;
const closures = (await read('closure-oracles-v3')).cases;
const events = (await read('canvas-events-v3')).cases;
const pkg = JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/package.json')), 'utf8'));
assert.equal(pkg.version, '0.2.1');
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
assert.equal(historyResponses.cases.length, 13);
for (const fixture of historyResponses.cases) {
  assert.deepEqual(JSON.parse(JSON.stringify(V3.validateType(fixture.responseType, fixture.response))), fixture.response, `${fixture.id}.schema`);
  if (fixture.kind === 'valid')
    assert.deepEqual(JSON.parse(JSON.stringify(V3.validateResponse('world-adapter/v3', fixture.operation, fixture.response))), fixture.response, fixture.id);
  else
    assert.throws(() => V3.validateResponse('world-adapter/v3', fixture.operation, fixture.response),
      error => error.publicError?.code === 'SCHEMA_INVALID', fixture.id);
}
assert.equal(digestResponses.cases.length, 8);
for (const fixture of digestResponses.cases) {
  assert.deepEqual(JSON.parse(JSON.stringify(V3.validateType(fixture.responseType, fixture.response))), fixture.response, `${fixture.id}.schema`);
  assert.deepEqual(JSON.parse(JSON.stringify(V3.validateResponse('world-adapter/v3', fixture.operation, fixture.response))), fixture.response, fixture.id);
  assert.equal(fixture.response.error.phase, fixture.expected.phase, fixture.id);
  if (fixture.kind === 'precedence-negative') assert.notEqual(fixture.response.error.code, fixture.forbiddenCode, fixture.id);
}
assert.deepEqual(V3.operationContracts['world-adapter/v3']
  .filter(value => value.failureCodes.includes('NON_CANONICAL_AMBIGUITY')).map(value => value.operation).sort(),
  ['ApplyCompiledTransaction', 'ApplyHistoryTransaction', 'PrepareHistoryTransaction', 'PrepareRecoverableTransaction']);
const historyPrepare = oracle.cases.find(value => value.id === 'A-VALID-AUTHOR-LINKED-UNDO').request;
const historyQuery = oracle.cases.find(value => value.id === 'A-VALID-RESTART-QUERY').request;
const historyApply = oracle.cases.find(value => value.id === 'A-AMBIGUOUS-AFTER-WRITE').request;
const historyAbort = { ...historyQuery, serviceRecoveryRef: 'FIXTURE-service-recovery' };
delete historyAbort.direction;
for (const [operation, request] of [
  ['PrepareHistoryTransaction', historyPrepare], ['QueryPreparedHistoryTransaction', historyQuery],
  ['ApplyHistoryTransaction', historyApply], ['AbortPreparedHistoryTransaction', historyAbort],
]) assert.deepEqual(JSON.parse(JSON.stringify(V3.validateBoundRequest('world-adapter/v3', operation, request))), request, operation);
assert.throws(() => V3.validateBoundRequest('world-adapter/v3', 'PrepareHistoryTransaction',
  { ...historyPrepare, historyOperationDigest: '0'.repeat(64) }),
  error => error.publicError?.code === 'NON_CANONICAL_AMBIGUITY');
assert.throws(() => V3.validateBoundRequest('world-adapter/v3', 'ApplyHistoryTransaction',
  { ...historyApply, preparedHistoryTransaction: { ...historyApply.preparedHistoryTransaction, historyOperationDigest: '0'.repeat(64) } }),
  error => error.publicError?.code === 'NON_CANONICAL_AMBIGUITY');
const assets = { requests: wires, goldens: goldens.map(({ id, kind, payload }) => ({ id, kind, payload })) };
for (const value of closures) {
  const actual = F.evaluateClosureFixture(value.wire, value.dimension, value.input, assets);
  for (const [key, expected] of Object.entries(value.expected)) assert.deepEqual(actual[key], expected, `${value.id}.${key}`);
}
for (const value of events) {
  const actual = F.evaluateCanvasEventFixture(value.eventType, value.input);
  for (const [key, expected] of Object.entries(value.expected)) assert.deepEqual(actual[key], expected, `${value.id}.${key}`);
}
const loaded = [];
for (const name of ['v3', 'world-adapter/v3', 'canvas/v3', 'v3/fixture', 'v3/schemas']) {
  const specifier = `hanaworlds-contracts/${name}`;
  await import(specifier);
  const path = new URL(import.meta.resolve(specifier));
  loaded.push({ specifier, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
}
for (const [name, relative] of [['v3-runtime', './runtime.mjs'], ['v3-generated-profile', './generated/contracts.mjs']]) {
  const path = new URL(relative, import.meta.resolve('hanaworlds-contracts/v3'));
  loaded.push({ specifier: name, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
}
const result = { evidence: 'PACKAGE_REAL_RUNTIME', version: pkg.version, providerRuntime: 'NOT_RUN',
  historicalGoldens: goldens.length, v3WireRequests: wires.length, closureCases: closures.length,
  eventCases: events.length, v3Oracles: oracle.cases.length, historyResponseCases: historyResponses.cases.length, digestResponseCases: digestResponses.cases.length,
  loaded, specificationStatus: 'FIXTURE_PASS_INDEPENDENT_REVIEW_NOT_RUN' };
await writeFile('consumer-result-v3.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));

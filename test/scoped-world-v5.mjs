import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as C from 'hanaworlds-contracts/v4';
import * as Adapter from 'hanaworlds-contracts/world-adapter/v5';
import * as OldAdapter from 'hanaworlds-contracts/world-adapter/v4';

const plain = value => JSON.parse(JSON.stringify(value));
const code = expected => error => error.publicError?.code === expected;
const fixtures = JSON.parse(await readFile(new URL('../spec/v4/fixtures/candidate/wire-inputs-v4.json', import.meta.url), 'utf8'));
const old = fixtures.requests.find(x => x.wire === 'world-adapter/v4' && x.operation === 'ApplyCompiledTransaction').request;
const hex = char => char.repeat(64);
const publicSchema = JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/v4/schema/ScopedPrepareRequest')), 'utf8'));
assert.equal(publicSchema.$ref, '#/definitions/ScopedPrepareRequest');
assert.ok(publicSchema.definitions.ScopedPrepareRequest.properties.scope);
const stateProfile = old.preparedTransaction.stateProfile;
const authDigest = C.digestValue('authorization-binding', old.authorizationBinding).sha256;
const scope = {
  transactionId: old.transactionId, worldRef: old.worldRef,
  operationDigest: old.operationDigest, authorizationBindingDigest: authDigest,
  stateProfile, checkedPositions: [[0, 0, 0]],
  objects: [{ objectRef: 'fixture-object', worldRef: old.worldRef, footprintRevision: 'registry-1',
    provenance: 'CANVAS_REGISTERED', positions: [[1, 0, 0]] }],
  cells: [
    { position: [0, 0, 0], availability: 'KNOWN', stateDigest: hex('a') },
    { position: [1, 0, 0], availability: 'KNOWN', stateDigest: hex('b') },
  ],
};
const scopedDigest = value => C.digestValue('scoped-world', value).sha256;
const prepare = {
  contractVersion: 'world-adapter/v5', actorRef: 'canvas-service', sessionRef: old.sessionRef,
  requestId: 'prepare-1', authorizationRef: old.authorizationRef, worldRef: old.worldRef,
  transactionId: old.transactionId, operationDigest: old.operationDigest,
  operations: old.operations, authorizationBinding: old.authorizationBinding,
  scope, scopeDigest: scopedDigest(scope), guarantee: old.guarantee,
};
const payload = {
  contractVersion: 'world-adapter/v5', transactionId: old.transactionId, worldRef: old.worldRef,
  operationDigest: old.operationDigest, authorizationBindingDigest: authDigest,
  scopeDigest: prepare.scopeDigest, beforeImageDigest: hex('c'),
};
const prepared = {
  payload, transactionPayloadDigest: C.digestValue('scoped-transaction-payload', payload).sha256,
  beforeImageDigest: payload.beforeImageDigest, scopeDigest: prepare.scopeDigest,
  guarantee: 'RECOVERABLE_VERIFIED', stateProfile, protectedPositions: [[0, 0, 0]],
  adapterExecutionRevision: 'adapter-1',
};
const apply = { ...prepare, requestId: 'apply-1', preparedTransaction: prepared };

assert.equal(Adapter.contractVersion, 'world-adapter/v5');
assert.equal(Adapter.operations.length, 3);
assert.ok(Adapter.operations.find(op => op.operation === 'ApplyCompiledTransaction').validationOrder
  .some(step => step.includes('re-read the same cells')));
assert.equal(Adapter.operations.some(op => op.validationOrder.includes('revision')), false);
assert.equal(C.checkScopedWorldHandshake(C.contractHandshake).result, 'HANDSHAKE_OPERATION_MATCH');
for (const advertised of [
  { ...C.contractHandshake, contracts: 'hanaworlds-contracts@0.3.2',
    wireVersions: C.contractHandshake.wireVersions.filter(wire => wire !== 'world-adapter/v5') },
  { ...C.contractHandshake, contracts: 'hanaworlds-contracts@0.3.2' },
]) assert.throws(() => C.checkScopedWorldHandshake(advertised), code('UNSUPPORTED_VERSION'));
assert.throws(() => OldAdapter.validate('PrepareRecoverableTransaction', prepare), code('UNKNOWN_REQUIRED_FIELD'));

assert.deepEqual(plain(Adapter.validate('PrepareRecoverableTransaction', prepare)), prepare);
assert.deepEqual(plain(Adapter.admit('PrepareRecoverableTransaction', new TextEncoder().encode(JSON.stringify(prepare)))), prepare);
assert.deepEqual(plain(Adapter.validate('ApplyCompiledTransaction', apply)), apply);
assert.deepEqual(plain(C.validateBoundRequest('world-adapter/v5', 'PrepareRecoverableTransaction', prepare)), prepare);
assert.deepEqual(plain(C.validateBoundRequest('world-adapter/v5', 'ApplyCompiledTransaction', apply)), apply);
assert.deepEqual(plain(C.validateScopedTransition(prepare, apply)), { prepare, apply });
const result = { ...prepared, beforeStateReadbackDigest: hex('d') };
assert.deepEqual(plain(C.projectScopedPreparedTransaction(result)), prepared);
assert.deepEqual(plain(Adapter.response('PrepareRecoverableTransaction', {
  contractVersion: 'world-adapter/v5', requestId: prepare.requestId, result, error: null,
})).result, result);
assert.deepEqual(plain(Adapter.response('QueryPreparedTransaction', {
  contractVersion: 'world-adapter/v5', requestId: 'query-1', result, error: null,
})).result, result);
const query = { contractVersion: 'world-adapter/v5', actorRef: old.actorRef, sessionRef: old.sessionRef,
  requestId: 'query-1', authorizationRef: old.authorizationRef, worldRef: old.worldRef,
  transactionId: old.transactionId, operationDigest: old.operationDigest,
  authorizationBindingDigest: authDigest, scopeDigest: prepare.scopeDigest };
assert.deepEqual(plain(Adapter.validate('QueryPreparedTransaction', query)), query);
const revoked = { code: 'AUTHORIZATION_REVOKED', phase: 'authorize', retryability: 'AFTER_NEW_AUTH',
  mutationState: 'NONE', transactionRef: null, causeCode: null, reason: 'GRANT_REVOKED' };
for (const operation of ['PrepareRecoverableTransaction', 'ApplyCompiledTransaction', 'QueryPreparedTransaction'])
  assert.equal(Adapter.response(operation, { contractVersion: 'world-adapter/v5', requestId: 'denied-1',
    result: null, error: revoked }).error.code, 'AUTHORIZATION_REVOKED');

// A world edit outside the declared cells does not alter this exact wire snapshot.
const outsideEdit = { position: [90, 0, 0], stateDigest: hex('f') };
const world = new Map(scope.cells.map(cell => [JSON.stringify(cell.position), cell.stateDigest]));
const projectRead = () => ({ ...scope, cells: scope.cells.map(cell => ({ ...cell,
  stateDigest: world.get(JSON.stringify(cell.position)) })) });
assert.equal(scopedDigest(projectRead()), prepare.scopeDigest);
world.set(JSON.stringify(outsideEdit.position), outsideEdit.stateDigest);
const afterOutsideEdit = projectRead();
assert.equal(scopedDigest(afterOutsideEdit), prepare.scopeDigest);
assert.deepEqual(plain(C.validateScopedTransition(prepare, { ...apply, scope: afterOutsideEdit })), { prepare, apply });

const withScope = changed => ({ ...prepare, scope: changed, scopeDigest: scopedDigest(changed) });
const changedCell = { ...scope, cells: [{ ...scope.cells[0], stateDigest: hex('e') }, scope.cells[1]] };
const changedFootprint = { ...scope, objects: [{ ...scope.objects[0], footprintRevision: 'registry-2' }] };
for (const changed of [changedCell, changedFootprint]) {
  const next = withScope(changed);
  assert.throws(() => C.validateScopedTransition(prepare, { ...apply, scope: next.scope, scopeDigest: next.scopeDigest }), code('STALE_REVISION'));
}
assert.throws(() => Adapter.validate('ApplyCompiledTransaction', { ...apply, scope: changedCell }), code('NON_CANONICAL_AMBIGUITY'));
assert.throws(() => Adapter.validate('ApplyCompiledTransaction', { ...apply, scopeDigest: hex('f') }), code('NON_CANONICAL_AMBIGUITY'));
assert.throws(() => Adapter.validate('ApplyCompiledTransaction', { ...apply,
  preparedTransaction: { ...prepared, scopeDigest: hex('f') } }), code('SCHEMA_INVALID'));
assert.throws(() => C.validateScopedTransition(prepare, { ...apply, transactionId: 'other-tx' }), code('SCHEMA_INVALID'));

for (const [changed, expected] of [
  [{ ...scope, cells: [scope.cells[0]] }, 'TARGET_FACTS_INCOMPLETE'],
  [{ ...scope, checkedPositions: [], objects: [] }, 'TARGET_FACTS_INCOMPLETE'],
  [{ ...scope, cells: [{ ...scope.cells[0], availability: 'UNKNOWN', stateDigest: null }, scope.cells[1]] }, 'TARGET_FACTS_INCOMPLETE'],
  [{ ...scope, cells: [{ ...scope.cells[0], availability: 'UNLOADED', stateDigest: null }, scope.cells[1]] }, 'TARGET_FACTS_INCOMPLETE'],
  [{ ...scope, objects: [{ ...scope.objects[0], positions: [] }] }, 'TARGET_FACTS_INCOMPLETE'],
  [{ ...scope, objects: [{ ...scope.objects[0], provenance: 'CALLER_SUPPLIED' }] }, 'TARGET_FACTS_INCOMPLETE'],
  [{ ...scope, objects: [{ ...scope.objects[0], worldRef: 'other-world' }] }, 'OBJECT_SCOPE_MISMATCH'],
  [{ ...scope, objects: [scope.objects[0], scope.objects[0]] }, 'SCHEMA_INVALID'],
]) assert.throws(() => Adapter.validate('PrepareRecoverableTransaction', withScope(changed)), code(expected), expected);

const noScope = { ...prepare }; delete noScope.scope;
assert.throws(() => Adapter.validate('PrepareRecoverableTransaction', noScope), code('SCHEMA_INVALID'));
assert.throws(() => Adapter.validate('PrepareRecoverableTransaction', { ...prepare,
  operations: { ...prepare.operations, effects: [{ position: [2, 0, 0], nodeName: 'fixture:stone', param2: 0 }] } }),
  code('TARGET_FACTS_INCOMPLETE'));
assert.throws(() => Adapter.validate('ApplyCompiledTransaction', { ...apply,
  authorizationBinding: { ...old.authorizationBinding, grantEpoch: 'revoked-epoch' } }), code('NON_CANONICAL_AMBIGUITY'));
assert.throws(() => Adapter.validate('QueryPreparedTransaction', { ...query, scopeDigest: undefined }), code('SCHEMA_INVALID'));

console.log('world-adapter/v5 scoped-world SOURCE/FIXTURE positive and negative conformance PASS');

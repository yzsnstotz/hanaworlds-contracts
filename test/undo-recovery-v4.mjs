import assert from 'node:assert/strict';
import * as V4 from 'hanaworlds-contracts/v4';
import * as Session from 'hanaworlds-contracts/v4/session/v2';
import * as Canvas from 'hanaworlds-contracts/canvas/v4';

const plain = value => JSON.parse(JSON.stringify(value));
const bytes = value => new TextEncoder().encode(JSON.stringify(value));
const code = expected => error => error.publicError?.code === expected;
const common = { actorRef: 'actor-1', sessionRef: 'session-1', requestId: 'recovery-1',
  authorizationRef: 'original-auth-1', worldRef: 'world-1', serviceRecoveryRef: 'trusted-service-1' };
const workshop = { ...common, contractVersion: 'session/v2' };
const canvas = { ...common, contractVersion: 'canvas/v4', originalUndoRequestId: 'undo-1' };
const receipt = { contractVersion: 'canvas/v2', transactionId: 'internal-undo-1',
  operationDigest: '0'.repeat(64), transactionPayloadDigest: '1'.repeat(64), status: 'VERIFIED',
  previousWorldRevision: 'world-1', observedWorldRevision: 'world-2',
  readbackDigest: '2'.repeat(64), restoreStatus: 'NOT_REQUIRED', error: null };
const verified = { sessionRef: 'session-1', worldRef: 'world-1', originalUndoRequestId: 'undo-1',
  status: 'VERIFIED', receipt };
const pending = { ...verified, status: 'RECOVERY_PENDING', receipt: null };
const denied = { code: 'PERMISSION_DENIED', phase: 'authorize', retryability: 'AFTER_NEW_FACTS',
  mutationState: 'NONE', transactionRef: null, causeCode: null, reason: 'IDENTITY_UNVERIFIED' };

assert.equal(V4.version, '0.3.4');
assert.equal(V4.checkUndoRecoveryHandshake(V4.contractHandshake).result, 'HANDSHAKE_OPERATION_MATCH');
for (const old of ['0.3.1', '0.3.2', '0.3.3'])
  assert.throws(() => V4.checkUndoRecoveryHandshake({ ...V4.contractHandshake,
    contracts: `hanaworlds-contracts@${old}` }), code('UNSUPPORTED_VERSION'));
assert.throws(() => V4.checkUndoRecoveryHandshake({ ...V4.contractHandshake,
  wireVersions: V4.contractHandshake.wireVersions.filter(w => w !== 'canvas/v4') }), code('UNSUPPORTED_VERSION'));

for (const [binding, request, op] of [[Session, workshop, 'RecoverPendingUndo'],
  [Canvas, canvas, 'RecoverPendingUndo'], [Canvas, canvas, 'ReadPendingUndoResult']]) {
  assert.deepEqual(plain(binding.validate(op, request)), request);
  assert.deepEqual(plain(binding.admit(op, bytes(request))), request);
  for (const field of ['actorRef', 'sessionRef', 'authorizationRef', 'worldRef', 'serviceRecoveryRef']) {
    const missing = { ...request }; delete missing[field];
    assert.throws(() => binding.validate(op, missing), code('SCHEMA_INVALID'));
  }
  for (const field of ['transactionId', 'objectRef', 'historyTransactionId', 'grant'])
    assert.throws(() => binding.validate(op, { ...request, [field]: 'forged' }), code('UNKNOWN_REQUIRED_FIELD'));
  assert.throws(() => binding.validate(op, { ...request, serviceRecoveryRef: null }), code('SCHEMA_INVALID'));
}
assert.throws(() => Session.validate('RecoverPendingUndo', { ...workshop,
  originalUndoRequestId: 'forged' }), code('UNKNOWN_REQUIRED_FIELD'));
assert.throws(() => Canvas.validate('RecoverPendingUndo', { ...canvas,
  originalUndoRequestId: null }), code('SCHEMA_INVALID'));

for (const [binding, op] of [[Session, 'RecoverPendingUndo'],
  [Canvas, 'RecoverPendingUndo'], [Canvas, 'ReadPendingUndoResult']]) {
  for (const result of [verified, { ...verified, status: 'ROLLED_BACK', receipt: null },
    pending, { ...verified, status: 'UNKNOWN', receipt: null }])
    assert.deepEqual(plain(binding.response(op, { contractVersion: binding.contractVersion,
      requestId: 'recovery-1', result, error: null })).result, result);
  assert.deepEqual(plain(binding.response(op, { contractVersion: binding.contractVersion,
    requestId: 'recovery-1', result: null, error: denied })).error, denied);
  assert.throws(() => binding.response(op, { contractVersion: binding.contractVersion,
    requestId: 'recovery-1', result: { ...pending, receipt }, error: null }), code('SCHEMA_INVALID'));
  assert.throws(() => binding.response(op, { contractVersion: binding.contractVersion,
    requestId: 'recovery-1', result: { ...verified, receipt: null }, error: null }), code('SCHEMA_INVALID'));
  assert.throws(() => binding.response(op, { contractVersion: binding.contractVersion,
    requestId: 'recovery-1', result: { ...verified, status: 'SUCCESS' }, error: null }), code('SCHEMA_INVALID'));
  assert.throws(() => binding.response(op, { contractVersion: binding.contractVersion,
    requestId: 'recovery-1', result: verified, error: denied }), code('SCHEMA_INVALID'));
}
const record = { actorRef: 'actor-1', sessionRef: 'session-1', worldRef: 'world-1',
  authorizationRef: 'original-auth-1', originalUndoRequestId: 'undo-1', direction: 'UNDO',
  status: 'RECOVERY_PENDING' };
assert.deepEqual(plain(V4.validateUndoRecoveryRecord(canvas, record)), record);
for (const field of ['actorRef', 'sessionRef', 'worldRef', 'authorizationRef', 'originalUndoRequestId'])
  assert.throws(() => V4.validateUndoRecoveryRecord(canvas, { ...record, [field]: 'other' }), code('PERMISSION_DENIED'));
assert.throws(() => V4.validateUndoRecoveryRecord(canvas, null), code('TRANSACTION_CONFLICT'));
assert.throws(() => V4.validateUndoRecoveryRecord(canvas, { ...record, direction: 'APPLY' }), code('SCHEMA_INVALID'));
assert.throws(() => V4.validateUndoRecoveryRecord(canvas, { ...record, status: 'VERIFIED' }), code('TRANSACTION_CONFLICT'));
assert.throws(() => V4.validateUndoRecoveryRecord(canvas, { ...record, status: 'ROLLED_BACK' }), code('TRANSACTION_CONFLICT'));
assert.throws(() => V4.validateUndoRecoveryRecord(canvas, { ...record, status: 'RESERVED' }), code('TRANSACTION_CONFLICT'));
assert.deepEqual(plain(V4.validateUndoRecoveryRecord(canvas, { ...record, status: 'VERIFIED' },
  'ReadPendingUndoResult')), { ...record, status: 'VERIFIED' });
assert.deepEqual(plain(V4.validateUndoRecoveryRecord(canvas, { ...record, status: 'ROLLED_BACK' },
  'ReadPendingUndoResult')), { ...record, status: 'ROLLED_BACK' });
assert.throws(() => V4.validateUndoRecoveryRecord(canvas, null, 'ReadPendingUndoResult'), code('TRANSACTION_CONFLICT'));
assert.throws(() => V4.validateUndoRecoveryRecord(canvas, { ...record, status: 'RESERVED' },
  'ReadPendingUndoResult'), code('TRANSACTION_CONFLICT'));
for (const [wire, request, op] of [['session/v2', workshop, 'RecoverPendingUndo'],
  ['canvas/v4', canvas, 'ReadPendingUndoResult']]) {
  const response = { contractVersion: wire, requestId: 'recovery-1', result: verified, error: null };
  assert.deepEqual(plain(V4.validateUndoRecoveryResponse(wire, op, request, response)), response);
  assert.throws(() => V4.validateUndoRecoveryResponse(wire, op, request,
    { ...response, requestId: 'other' }), code('SCHEMA_INVALID'));
  for (const field of ['sessionRef', 'worldRef'])
    assert.throws(() => V4.validateUndoRecoveryResponse(wire, op, request,
      { ...response, result: { ...verified, [field]: 'other' } }), code('PERMISSION_DENIED'));
  if (wire === 'canvas/v4')
    assert.throws(() => V4.validateUndoRecoveryResponse(wire, op, request,
      { ...response, result: { ...verified, originalUndoRequestId: 'forged' } }), code('PERMISSION_DENIED'));
}
assert.equal(V4.operationContracts['session/v2'].find(op => op.operation === 'UndoCurrentBuild').request,
  'UndoCurrentBuildRequest');
console.log('undo recovery contract positive and negative conformance PASS');

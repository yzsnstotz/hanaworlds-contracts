import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as V4 from 'hanaworlds-contracts/v4';
import * as Canvas from 'hanaworlds-contracts/canvas/v4';
import * as Session from 'hanaworlds-contracts/v4/session/v2';

const plain = value => JSON.parse(JSON.stringify(value));
const bytes = value => new TextEncoder().encode(JSON.stringify(value));
const code = expected => error => error.publicError?.code === expected;
const base = JSON.parse(await readFile(new URL('../spec/v4/CONTRACT_SCHEMA_PROFILE.json', import.meta.url), 'utf8'));
const priorReadback = JSON.parse(await readFile(new URL('../spec/v4/SESSION_READBACK_EXTENSION.json', import.meta.url), 'utf8'));
const history = {
  contractVersion: 'canvas/v4', actorRef: 'actor-1', sessionRef: 'session-1',
  requestId: 'history-1', authorizationRef: 'trusted-binding-1',
  worldRef: 'world-1', objectRef: 'object-derived-by-workshop', expectedHistoryRevision: 'history-7',
};
const statusRequest = {
  contractVersion: 'session/v2', actorRef: 'actor-1', sessionRef: 'session-1',
  requestId: 'status-1', authorizationRef: 'trusted-binding-1', worldRef: 'world-1',
};
const head = { historyRevision: 'history-7', headTransactionId: 'canvas-transaction-7' };
const available = {
  contractVersion: 'session/v2', requestId: 'status-1', error: null,
  result: { sessionRef: 'session-1', worldRef: 'world-1', turnRef: 'turn-1',
    turnRevision: 'turn-revision-1', availability: 'AVAILABLE', head },
};
const undoRequest = {
  ...statusRequest, requestId: 'undo-1',
  expectedTurnRevision: 'turn-revision-1', expectedHistoryRevision: 'history-7',
};
const undone = {
  contractVersion: 'session/v2', requestId: 'undo-1', error: null,
  result: { sessionRef: 'session-1', worldRef: 'world-1', turnRef: 'turn-1',
    turnRevision: 'turn-revision-1', status: 'VERIFIED', beforeHead: head,
    afterHead: { historyRevision: 'history-8', headTransactionId: null } },
};
const denied = {
  contractVersion: 'session/v2', requestId: 'undo-1', result: null,
  error: { code: 'AUTHORIZATION_REVOKED', phase: 'authorize', retryability: 'AFTER_NEW_AUTH',
    mutationState: 'NONE', transactionRef: null, causeCode: null, reason: 'GRANT_REVOKED' },
};

assert.equal(V4.version, '0.3.4');
assert.equal(V4.checkSessionUndoHandshake(V4.contractHandshake).result, 'HANDSHAKE_OPERATION_MATCH');
assert.throws(() => V4.checkSessionUndoHandshake({ ...V4.contractHandshake, contracts: 'hanaworlds-contracts@0.3.1' }), code('UNSUPPORTED_VERSION'));
assert.throws(() => V4.checkSessionUndoHandshake({ ...V4.contractHandshake,
  wireVersions: V4.contractHandshake.wireVersions.filter(wire => wire !== 'canvas/v4') }), code('UNSUPPORTED_VERSION'));
assert.equal(V4.checkSessionReadbackHandshake(V4.contractHandshake).result, 'HANDSHAKE_OPERATION_MATCH');
assert.throws(() => V4.checkSessionReadbackHandshake({ ...V4.contractHandshake, contracts: 'hanaworlds-contracts@0.3.0' }), code('UNSUPPORTED_VERSION'));

assert.deepEqual(plain(Canvas.validate('HistoryQuery', history)), history, 'existing exact-CAS HistoryQuery stays valid');
assert.deepEqual(plain(Canvas.admit('HistoryQuery', bytes({ ...history, expectedHistoryRevision: null }))),
  { ...history, expectedHistoryRevision: null }, 'null reads the current authorized durable snapshot');
assert.throws(() => Canvas.validate('HistoryQuery', { ...history, expectedHistoryRevision: undefined }), code('SCHEMA_INVALID'));
assert.throws(() => Canvas.validate('HistoryQuery', { ...history, expectedHistoryRevision: 7 }), code('SCHEMA_INVALID'));
assert.throws(() => Canvas.validate('HistoryQuery', { ...history, currentSnapshot: true }), code('UNKNOWN_REQUIRED_FIELD'));

assert.deepEqual(plain(Session.operations.slice(0, -4)), base.operations['session/v2'], 'old session operations unchanged');
assert.deepEqual(plain(Session.operations.at(-4)), priorReadback.operation, 'readback operation unchanged');
assert.deepEqual(Session.operations.slice(-3, -1).map(op => op.operation), ['ReadCurrentUndoStatus', 'UndoCurrentBuild']);
assert.deepEqual(plain(Session.validate('ReadCurrentUndoStatus', statusRequest)), statusRequest);
assert.deepEqual(plain(Session.admit('ReadCurrentUndoStatus', bytes(statusRequest))), statusRequest);
assert.deepEqual(plain(Session.response('ReadCurrentUndoStatus', available)), available);
assert.deepEqual(plain(Session.response('ReadCurrentUndoStatus', {
  ...available, result: { ...available.result, turnRef: null, turnRevision: null,
    availability: 'NO_VERIFIED_BUILD', head: null },
})).result.availability, 'NO_VERIFIED_BUILD');
assert.deepEqual(plain(Session.response('ReadCurrentUndoStatus', {
  ...available, result: { ...available.result, availability: 'NO_UNDO_AT_HEAD' },
})).result.availability, 'NO_UNDO_AT_HEAD');
assert.deepEqual(plain(Session.validate('UndoCurrentBuild', undoRequest)), undoRequest);
assert.deepEqual(plain(Session.admit('UndoCurrentBuild', bytes(undoRequest))), undoRequest);
assert.deepEqual(plain(Session.response('UndoCurrentBuild', undone)), undone);
assert.deepEqual(plain(Session.response('UndoCurrentBuild', denied)), denied);
assert.deepEqual(plain(Session.response('ReadCurrentUndoStatus', { ...denied, requestId: 'status-1' })).error.code, 'AUTHORIZATION_REVOKED');

for (const [operation, req] of [['ReadCurrentUndoStatus', statusRequest], ['UndoCurrentBuild', undoRequest]]) {
  for (const field of ['actorRef', 'sessionRef', 'authorizationRef', 'worldRef']) {
    const absent = { ...req }; delete absent[field];
    assert.throws(() => Session.validate(operation, absent), code('SCHEMA_INVALID'), `${operation} missing ${field}`);
  }
  assert.throws(() => Session.validate(operation, { ...req, objectRef: 'caller-internal-id' }), code('UNKNOWN_REQUIRED_FIELD'));
  assert.throws(() => Session.validate(operation, { ...req, transactionId: 'caller-internal-id' }), code('UNKNOWN_REQUIRED_FIELD'));
  assert.throws(() => Session.validate(operation, { ...req, contractVersion: 'session/v1' }), code('UNSUPPORTED_VERSION'));
}
for (const field of ['expectedTurnRevision', 'expectedHistoryRevision']) {
  const absent = { ...undoRequest }; delete absent[field];
  assert.throws(() => Session.validate('UndoCurrentBuild', absent), code('SCHEMA_INVALID'), `missing ${field}`);
  assert.throws(() => Session.validate('UndoCurrentBuild', { ...undoRequest, [field]: null }), code('SCHEMA_INVALID'), `null ${field}`);
}
assert.throws(() => Session.response('ReadCurrentUndoStatus', { ...available,
  result: { ...available.result, availability: 'AVAILABLE', head: null } }), code('SCHEMA_INVALID'));
assert.throws(() => Session.response('ReadCurrentUndoStatus', { ...available,
  result: { ...available.result, availability: 'NO_VERIFIED_BUILD' } }), code('SCHEMA_INVALID'));
assert.throws(() => Session.response('UndoCurrentBuild', { ...undone,
  result: { ...undone.result, afterHead: head } }), code('SCHEMA_INVALID'), 'head must move after VERIFIED');
assert.throws(() => Session.response('UndoCurrentBuild', { ...undone,
  result: { ...undone.result, status: 'PENDING' } }), code('SCHEMA_INVALID'), 'pending is not success');
assert.throws(() => Session.response('UndoCurrentBuild', { ...undone, error: denied.error }), code('SCHEMA_INVALID'));
assert.throws(() => Session.response('UndoCurrentBuild', { ...denied, error: { ...denied.error, code: 'MODEL_UNAVAILABLE' } }), code('SCHEMA_INVALID'));
assert.throws(() => Session.response('ReadCurrentUndoStatus', { ...denied, requestId: 'status-1', error: { ...denied.error, code: 'MODEL_UNAVAILABLE' } }), code('SCHEMA_INVALID'));
assert.throws(() => Session.response('UndoCurrentBuild', { ...undone, result: { ...undone.result, receiptOnly: true } }), code('UNKNOWN_REQUIRED_FIELD'));

console.log('session/v2 undo and canvas/v4 nullable HistoryQuery: positive and negative conformance PASS');

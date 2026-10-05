import assert from 'node:assert/strict';
import * as V4 from 'hanaworlds-contracts/v4';
import * as Session from 'hanaworlds-contracts/v4/session/v2';

const plain = value => JSON.parse(JSON.stringify(value));
const bytes = value => new TextEncoder().encode(JSON.stringify(value));
const code = expected => error => error.publicError?.code === expected;
const request = { contractVersion: 'session/v2', actorRef: 'player-1', sessionRef: 'session-1',
  requestId: 'build-action-1', authorizationRef: 'grant-1', worldRef: 'world-1',
  expectedTurnRevision: 'turn-revision-1' };
const facts = { actorRef: 'player-1', sessionRef: 'session-1', authorizationRef: 'grant-1',
  worldRef: 'world-1', currentTurnRevision: 'turn-revision-1',
  turnStatus: 'CURRENT_CONFIRMED', stage: 'PLACEMENT', grantStatus: 'CURRENT', replay: 'NEW' };
const envelope = result => ({ contractVersion: 'session/v2', requestId: request.requestId,
  result, error: null });
const base = { sessionRef: 'session-1', worldRef: 'world-1', turnRevision: 'turn-revision-1' };
const pending = { ...base, outcome: 'PENDING', stage: 'PLAN' };
const frame = { sessionRef: 'session-1', turnRevision: 'turn-revision-1',
  frameRef: 'frame-1', frameRevision: 'frame-rev-1', content: '请选择位置', actions: [] };
const choice = { ...base, outcome: 'CHOICE_REQUIRED', stage: 'PLACEMENT', frame };
const receipt = { contractVersion: 'canvas/v2', transactionId: 'canvas-internal-1',
  operationDigest: '0'.repeat(64), transactionPayloadDigest: '1'.repeat(64),
  status: 'VERIFIED', previousWorldRevision: 'world-rev-1',
  observedWorldRevision: 'world-rev-2', readbackDigest: '2'.repeat(64),
  restoreStatus: 'NOT_REQUIRED', error: null };
const verified = { ...base, outcome: 'VERIFIED', stage: 'COMPLETE', receipt };
const denied = { code: 'AUTHORIZATION_REVOKED', phase: 'authorize',
  retryability: 'AFTER_NEW_FACTS', mutationState: 'NONE', transactionRef: null,
  causeCode: null, reason: 'GRANT_REVOKED' };

assert.equal(V4.version, '0.3.7');
assert.equal(V4.checkBuildEntryHandshake(V4.contractHandshake).result, 'HANDSHAKE_OPERATION_MATCH');
for (const old of ['0.3.0', '0.3.1', '0.3.2', '0.3.3', '0.3.4'])
  assert.throws(() => V4.checkBuildEntryHandshake({ ...V4.contractHandshake,
    contracts: `hanaworlds-contracts@${old}` }), code('UNSUPPORTED_VERSION'));
assert.deepEqual(plain(Session.validate('AdvanceCurrentBuild', request)), request);
assert.deepEqual(plain(Session.admit('AdvanceCurrentBuild', bytes(request))), request);
assert.deepEqual(plain(V4.validateBuildEntryContext(request, facts)),
  { request, replay: 'NEW', stage: 'PLACEMENT' });
assert.deepEqual(plain(V4.validateBuildEntryContext(request, { ...facts, replay: 'EXACT_REPLAY' })),
  { request, replay: 'EXACT_REPLAY', stage: 'PLACEMENT' });

for (const field of Object.keys(request)) {
  const missing = { ...request }; delete missing[field];
  assert.throws(() => Session.validate('AdvanceCurrentBuild', missing), code('SCHEMA_INVALID'), field);
}
for (const field of ['turnRef', 'transactionId', 'objectRef', 'invocationId', 'grant', 'unknown'])
  assert.throws(() => Session.validate('AdvanceCurrentBuild', { ...request, [field]: 'forged' }),
    code('UNKNOWN_REQUIRED_FIELD'), field);
assert.throws(() => Session.validate('AdvanceCurrentBuild', { ...request,
  contractVersion: 'session/v1' }), code('UNSUPPORTED_VERSION'));
assert.throws(() => Session.admit('AdvanceCurrentBuild',
  bytes({ ...request, unexpected: true })), code('UNKNOWN_REQUIRED_FIELD'));
assert.throws(() => Session.admit('AdvanceCurrentBuild',
  new TextEncoder().encode('{"requestId":"a","requestId":"b"}')),
  error => error.publicError?.reason === 'DUPLICATE_DECODED_KEY');
for (const field of ['actorRef', 'sessionRef', 'worldRef', 'authorizationRef'])
  assert.throws(() => V4.validateBuildEntryContext(request, { ...facts, [field]: 'other' }),
    code('PERMISSION_DENIED'), field);
assert.throws(() => V4.validateBuildEntryContext(request,
  { ...facts, grantStatus: 'REVOKED' }), code('AUTHORIZATION_REVOKED'));
assert.throws(() => V4.validateBuildEntryContext(request,
  { ...facts, currentTurnRevision: 'old-revision' }), code('TURN_REVISION_MISMATCH'));
assert.throws(() => V4.validateBuildEntryContext(request,
  { ...facts, turnStatus: 'UNCONFIRMED' }), code('INTENT_UNCONFIRMED'));
assert.throws(() => V4.validateBuildEntryContext(request,
  { ...facts, turnStatus: 'SUPERSEDED' }), code('TURN_REVISION_MISMATCH'));
assert.throws(() => V4.validateBuildEntryContext(request,
  { ...facts, replay: 'CONFLICT' }), code('TRANSACTION_CONFLICT'));

for (const result of [pending, choice, verified]) {
  assert.deepEqual(plain(Session.response('AdvanceCurrentBuild', envelope(result))), envelope(result));
  assert.deepEqual(plain(V4.validateBuildEntryResponse(request, envelope(result))), envelope(result));
}
assert.deepEqual(plain(Session.response('AdvanceCurrentBuild', { ...envelope(null), error: denied }).error), denied);
for (const field of ['sessionRef', 'worldRef', 'turnRevision'])
  assert.throws(() => V4.validateBuildEntryResponse(request,
    envelope({ ...pending, [field]: 'other' })), code('PERMISSION_DENIED'), field);
assert.throws(() => V4.validateBuildEntryResponse(request,
  { ...envelope(pending), requestId: 'other' }), code('SCHEMA_INVALID'));
assert.throws(() => Session.response('AdvanceCurrentBuild', envelope({ ...choice,
  frame: { ...frame, sessionRef: 'other' } })), code('SCHEMA_INVALID'));
assert.throws(() => Session.response('AdvanceCurrentBuild', envelope({ ...verified,
  receipt: { ...receipt, status: 'RECOVERY_PENDING', readbackDigest: null,
    observedWorldRevision: null } })), code('SCHEMA_INVALID'));
assert.throws(() => Session.response('AdvanceCurrentBuild', envelope({ ...pending,
  transactionId: 'forged' })), code('UNKNOWN_REQUIRED_FIELD'));
console.log('current build entry positive and negative conformance PASS');

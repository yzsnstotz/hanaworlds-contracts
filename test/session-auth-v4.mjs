import assert from 'node:assert/strict';
import * as V4 from 'hanaworlds-contracts/v4';
import * as Auth from 'hanaworlds-contracts/v4/session-authorization/v1';

const plain = value => JSON.parse(JSON.stringify(value));
const code = expected => error => error.publicError?.code === expected;
const wire = 'session-authorization/v1';
const binding = {
  sessionRef: 'core-session-1', sessionIncarnationRef: 'live-generation-1', hostIssuerRef: 'desktop-host-1',
  worldRef: 'world-1', engineActorName: 'luanti-player-1', expectedGrantRef: 'original-grant-1',
  authorizationRef: 'host-auth-1', actorRef: 'actor-1', bindingRef: 'binding-1',
  grantEpoch: 'epoch-1', allowedActions: ['APPLY_RECOVERABLE', 'READ', 'UNDO'],
};
const read = { contractVersion: wire, requestId: 'read-1', sessionRef: binding.sessionRef };
const verify = { contractVersion: wire, requestId: 'verify-1', binding };
const hostResult = result => ({ contractVersion: wire, requestId: read.requestId, result });
const gameResult = result => ({ contractVersion: wire, requestId: verify.requestId, result });

assert.equal(Auth.contractVersion, wire);
assert.equal(V4.version, '0.3.7');
assert.equal(V4.checkSessionAuthorizationHandshake(V4.contractHandshake).result, 'HANDSHAKE_OPERATION_MATCH');
assert.throws(() => V4.checkSessionAuthorizationHandshake({ ...V4.contractHandshake,
  contracts: 'hanaworlds-contracts@0.3.5' }), code('UNSUPPORTED_VERSION'));
assert.throws(() => V4.checkSessionAuthorizationHandshake({ ...V4.contractHandshake,
  wireVersions: V4.contractHandshake.wireVersions.filter(value => value !== wire) }), code('UNSUPPORTED_VERSION'));
assert.deepEqual(plain(Auth.validate('ReadOriginalBinding', read)), read);
assert.deepEqual(plain(Auth.validate('VerifyCurrentGrant', verify)), verify);
assert.deepEqual(plain(Auth.admit('ReadOriginalBinding', new TextEncoder().encode(JSON.stringify(read)))), read);
assert.deepEqual(plain(V4.validateOriginalBindingResponse(read,
  hostResult({ status: 'CURRENT', sessionRef: read.sessionRef, binding }))),
  hostResult({ status: 'CURRENT', sessionRef: read.sessionRef, binding }));
assert.deepEqual(plain(V4.validateCurrentGrantResponse(verify,
  gameResult({ status: 'CURRENT', sessionRef: read.sessionRef, binding }))),
  gameResult({ status: 'CURRENT', sessionRef: read.sessionRef, binding }));

for (const status of ['UNKNOWN', 'REVOKED', 'SESSION_REPLACED']) {
  assert.equal(Auth.response('ReadOriginalBinding', hostResult({ status, sessionRef: read.sessionRef })).result.status, status);
  assert.throws(() => Auth.response('ReadOriginalBinding', hostResult({ status, sessionRef: read.sessionRef, binding })),
    code('UNKNOWN_REQUIRED_FIELD'));
}
for (const status of ['UNKNOWN', 'REVOKED', 'MISMATCH']) {
  assert.equal(Auth.response('VerifyCurrentGrant', gameResult({ status, sessionRef: read.sessionRef })).result.status, status);
  assert.throws(() => Auth.response('VerifyCurrentGrant', gameResult({ status, sessionRef: read.sessionRef, binding })),
    code('UNKNOWN_REQUIRED_FIELD'));
}
for (const field of Object.keys(binding)) {
  const missing = { ...binding }; delete missing[field];
  assert.throws(() => Auth.validate('VerifyCurrentGrant', { ...verify, binding: missing }), code('SCHEMA_INVALID'), field);
}
for (const [field, value] of [['worldRef', 'other-world'], ['engineActorName', 'other-player'],
  ['expectedGrantRef', 'new-grant'], ['grantEpoch', 'new-epoch'], ['allowedActions', ['READ']],
  ['bindingRef', 'other-binding'], ['sessionIncarnationRef', 'replacement']])
  assert.throws(() => V4.validateCurrentGrantResponse(verify,
    gameResult({ status: 'CURRENT', sessionRef: read.sessionRef, binding: { ...binding, [field]: value } })),
  code('PERMISSION_DENIED'), field);
assert.throws(() => Auth.validate('VerifyCurrentGrant', { ...verify,
  binding: { ...binding, allowedActions: [] } }), code('SCHEMA_INVALID'));
assert.throws(() => Auth.validate('VerifyCurrentGrant', { ...verify,
  binding: { ...binding, allowedActions: ['READ', 'READ'] } }), code('SCHEMA_INVALID'));
assert.throws(() => Auth.validate('ReadOriginalBinding', { ...read, contractVersion: 'session/v2' }),
  code('UNSUPPORTED_VERSION'));
assert.throws(() => Auth.validate('ReadOriginalBinding', { ...read, actorRef: 'forged' }),
  code('UNKNOWN_REQUIRED_FIELD'));
assert.throws(() => V4.validateOriginalBindingResponse(read,
  hostResult({ status: 'CURRENT', sessionRef: 'other-session', binding })), code('SCHEMA_INVALID'));
assert.throws(() => V4.validateOriginalBindingResponse(read,
  hostResult({ status: 'UNKNOWN', sessionRef: 'other-session' })), code('PERMISSION_DENIED'));
assert.throws(() => V4.validateCurrentGrantResponse(verify,
  gameResult({ status: 'CURRENT', sessionRef: 'other-session', binding })), code('SCHEMA_INVALID'));
assert.throws(() => V4.validateCurrentGrantResponse(verify,
  { ...gameResult({ status: 'UNKNOWN', sessionRef: read.sessionRef }), requestId: 'other-request' }),
  code('PERMISSION_DENIED'));
assert.deepEqual(V4.operationContracts['session/v2'].map(op => op.operation).slice(-1), ['AdvanceCurrentBuild']);
assert.deepEqual(V4.operationContracts['world-adapter/v5'].map(op => op.operation),
  ['PrepareRecoverableTransaction', 'ApplyCompiledTransaction', 'QueryPreparedTransaction']);
console.log('session authorization host and Adapter shape SOURCE/FIXTURE conformance PASS');

import assert from 'node:assert/strict';
import * as V4 from 'hanaworlds-contracts/v4';
const wire = 'session-operation-authorization/v1';
const oldWire = 'session-authorization/v1';
const binding = { sessionRef: 's', sessionIncarnationRef: 'inc', hostIssuerRef: 'host',
  worldRef: 'world', engineActorName: 'player', expectedGrantRef: 'grant',
  authorizationRef: 'auth', actorRef: 'actor', bindingRef: 'binding', grantEpoch: 'epoch',
  allowedActions: ['READ'] };
const read = { contractVersion: wire, requestId: 'read', sessionRef: 's' };
const host = { contractVersion: wire, requestId: 'read', result: { status: 'CURRENT',
  sessionRef: 's', authority: { binding, sessionActions: ['APPEND'] } } };
const verify = { contractVersion: oldWire, requestId: 'verify', binding };
const game = { contractVersion: oldWire, requestId: 'verify', result: { status: 'CURRENT', sessionRef: 's', binding } };
const clone = x => JSON.parse(JSON.stringify(x));
const rejected = fn => assert.throws(fn, e => Boolean(e.publicError));
// Reproduce the original cross-domain mismatch. APPEND must remain illegal here.
rejected(() => V4.sessionAuthorizationV1.validate('VerifyCurrentGrant', { ...verify,
  binding: { ...binding, allowedActions: ['APPEND', 'READ'] } }));
assert.equal(typeof V4.projectSessionAuthorityProof, 'function', 'missing public separate Session authority projection');
const project = (h = host, g = game, r = read, v = verify) => V4.projectSessionAuthorityProof(r, h, v, g);
assert.deepEqual(JSON.parse(JSON.stringify(project())), { current: true, sessionRef: 's',
  actorRef: 'actor', authorizationRef: 'auth', worldRef: 'world', allowedActions: ['APPEND', 'READ'] });
assert.deepEqual(binding.allowedActions, ['READ']);
assert.ok(Object.isFrozen(project()));
const noAppend = clone(host); noAppend.result.authority.sessionActions = [];
assert.deepEqual(project(noAppend).allowedActions, ['READ']);
for (const actions of [['APPLY_RECOVERABLE'], ['READ'], ['APPEND', 'APPEND'], ['FORGED']]) {
  const h = clone(host); h.result.authority.sessionActions = actions; rejected(() => project(h));
}
for (const status of ['UNKNOWN', 'REVOKED', 'SESSION_REPLACED']) {
  const h = { ...host, result: { status, sessionRef: 's' } };
  assert.equal(V4.validateOriginalSessionAuthorityResponse(read, h).result.status, status);
  rejected(() => project(h));
  rejected(() => project({ ...h, result: { ...h.result, authority: host.result.authority } }));
}
for (const status of ['UNKNOWN', 'REVOKED', 'MISMATCH'])
  rejected(() => project(host, { ...game, result: { status, sessionRef: 's' } }));
for (const key of Object.keys(binding)) {
  const h = clone(host);
  h.result.authority.binding[key] = key === 'allowedActions' ? ['READ', 'UNDO'] : 'different';
  rejected(() => project(h));
  const g = clone(game); g.result.binding[key] = h.result.authority.binding[key];
  rejected(() => project(host, g));
}
for (const key of ['binding', 'sessionActions']) {
  const h = clone(host); delete h.result.authority[key]; rejected(() => project(h));
}
rejected(() => project({ ...host, requestId: 'wrong' }));
rejected(() => project(host, { ...game, requestId: 'wrong' }));
rejected(() => project(host, game, { ...read, sessionRef: 'wrong' }));
assert.equal(V4.checkSessionOperationAuthorizationHandshake(V4.contractHandshake).result, 'HANDSHAKE_OPERATION_MATCH');
rejected(() => V4.checkSessionOperationAuthorizationHandshake({ ...V4.contractHandshake, contracts: 'hanaworlds-contracts@0.3.6' }));
rejected(() => V4.checkSessionOperationAuthorizationHandshake({ ...V4.contractHandshake, wireVersions: V4.contractHandshake.wireVersions.filter(x => x !== wire) }));
rejected(() => V4.checkSessionAuthorizationHandshake({ ...V4.contractHandshake, contracts: 'hanaworlds-contracts@0.3.6', wireVersions: V4.contractHandshake.wireVersions.filter(x => x !== wire) }));
console.log('Session actions SOURCE/FIXTURE: separate issuance, append, read-only, illegal actions, revocation, regrant and exact correlation checks passed');
assert.equal(V4.sessionOperationAuthorizationV1.contractVersion, wire);
assert.deepEqual(clone(V4.sessionOperationAuthorizationV1.validate('ReadOriginalSessionAuthority', read)), read);
assert.deepEqual(clone(V4.sessionOperationAuthorizationV1.admit('ReadOriginalSessionAuthority', new TextEncoder().encode(JSON.stringify(read)))), read);
assert.throws(() => V4.checkSessionOperationAuthorizationHandshake({ ...V4.contractHandshake,
  wireVersions: V4.contractHandshake.wireVersions.filter(x => x !== wire) }),
  e => e.publicError?.code === 'UNSUPPORTED_VERSION');
assert.throws(() => project({ ...host, result: { status: 'REVOKED', sessionRef: 's' } }),
  e => e.publicError?.code === 'AUTHORIZATION_REVOKED');
assert.throws(() => project({ ...host, requestId: 'other' }),
  e => e.publicError?.code === 'PERMISSION_DENIED');

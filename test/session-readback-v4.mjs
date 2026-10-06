import assert from 'node:assert/strict';
import * as V4 from 'hanaworlds-contracts/v4';
import * as Session from 'hanaworlds-contracts/v4/session/v2';
import { readFile } from 'node:fs/promises';

const plain = value => JSON.parse(JSON.stringify(value));
const bytes = value => new TextEncoder().encode(JSON.stringify(value));
const errorCode = expected => error => error.publicError?.code === expected;
const pinnedProfile = JSON.parse(await readFile(new URL('../spec/v4/CONTRACT_SCHEMA_PROFILE.json', import.meta.url), 'utf8'));
const request = {
  contractVersion: 'session/v2', actorRef: 'actor-1', sessionRef: 'session-1',
  requestId: 'read-1', authorizationRef: 'trusted-current-binding-1',
};
const brief = {
  contractVersion: 'ReferenceBrief/v2', sessionRef: 'session-1',
  turnRevision: 'turn-revision-1', briefRevision: 'brief-revision-1',
  media: [], text: '原始建造请求',
  controls: { purpose: null, dimensions: null, entrancePortalRefs: [], styleText: null },
};
const success = {
  contractVersion: 'session/v2', requestId: 'read-1', error: null,
  result: {
    sessionRef: 'session-1', sessionRevision: 'session-revision-2',
    turns: [
      { turnRef: 'turn-1', turnRevision: 'turn-revision-1', userText: '原始建造请求', resultText: '完整的第一轮回复，包含后续细节。', confirmedBrief: brief },
      { turnRef: 'turn-2', turnRevision: 'turn-revision-2', userText: '继续', resultText: '完整的第二轮回复。', confirmedBrief: null },
    ],
  },
};

assert.ok(Session.operations.some(op => op.operation === 'ReadSessionTurnDetails'));
// 0.3.8 explicitly revises only SwitchWorldContext semantics/failures; shapes stay pinned.
const worldContext = JSON.parse(await readFile(new URL('../spec/v4/WORLD_CONTEXT_EXTENSION.json', import.meta.url), 'utf8'));
const { additionalFailureCodes, ...worldSwitchMetadata } = worldContext.operationUpdates['session/v2'].SwitchWorldContext;
const originalSwitch = pinnedProfile.operations['session/v2'].find(op => op.operation === 'SwitchWorldContext');
Object.assign(originalSwitch, worldSwitchMetadata, { failureCodes: [...new Set([...originalSwitch.failureCodes, ...additionalFailureCodes])] });
assert.deepEqual(plain(Session.operations.slice(0, pinnedProfile.operations['session/v2'].length)), pinnedProfile.operations['session/v2'], 'old metadata unchanged except declared 0.3.8 SwitchWorldContext update');
assert.deepEqual(plain(V4.schemaBundle.definitions.StartOrResumeSessionRequest.properties), {
  contractVersion: { const: 'session/v2' }, actorRef: { $ref: '#/definitions/Ref' },
  sessionRef: { $ref: '#/definitions/Ref' }, requestId: { $ref: '#/definitions/Ref' },
  authorizationRef: { $ref: '#/definitions/Ref' }, expectedRevision: { anyOf: [{ $ref: '#/definitions/Revision' }, { type: 'null' }] },
});
assert.equal(V4.version, '0.3.9');
assert.equal(V4.checkSessionReadbackHandshake(V4.contractHandshake).result, 'HANDSHAKE_OPERATION_MATCH');
assert.throws(() => V4.checkSessionReadbackHandshake({ ...V4.contractHandshake, contracts: 'hanaworlds-contracts@0.3.1' }), errorCode('UNSUPPORTED_VERSION'));
assert.throws(() => V4.checkSessionReadbackHandshake({ ...V4.contractHandshake, contracts: 'hanaworlds-contracts@0.3.0' }), errorCode('UNSUPPORTED_VERSION'));
assert.throws(() => V4.checkSessionReadbackHandshake({ ...V4.contractHandshake, wireVersions: V4.contractHandshake.wireVersions.filter(w => w !== 'session/v2') }), errorCode('UNSUPPORTED_VERSION'));
assert.deepEqual(plain(Session.validate('ReadSessionTurnDetails', request)), request);
assert.deepEqual(plain(Session.admit('ReadSessionTurnDetails', bytes(request))), request);
assert.deepEqual(plain(Session.response('ReadSessionTurnDetails', success)), success);
assert.deepEqual(plain(Session.response('ReadSessionTurnDetails', { ...success, result: { ...success.result, turns: [] } })).result.turns, []);
assert.deepEqual(plain(V4.validateRequest('session/v2', 'ReadSessionTurnDetails', request)), request);
assert.deepEqual(plain(V4.validateResponse('session/v2', 'ReadSessionTurnDetails', success)), success);

for (const key of ['actorRef', 'sessionRef', 'requestId', 'authorizationRef']) {
  const missing = { ...request }; delete missing[key];
  assert.throws(() => Session.validate('ReadSessionTurnDetails', missing), errorCode('SCHEMA_INVALID'), `missing ${key}`);
  assert.throws(() => Session.validate('ReadSessionTurnDetails', { ...request, [key]: null }), errorCode('SCHEMA_INVALID'), `null ${key}`);
}
assert.throws(() => Session.validate('ReadSessionTurnDetails', { ...request, callerSaysAuthorized: true }), errorCode('UNKNOWN_REQUIRED_FIELD'));
assert.throws(() => Session.validate('ReadSessionTurnDetails', { ...request, contractVersion: 'session/v1' }), errorCode('UNSUPPORTED_VERSION'));
assert.throws(() => Session.admit('ReadSessionTurnDetails', new TextEncoder().encode('{"actorRef":"a","actorRef":"b"}')),
  error => error.publicError?.reason === 'DUPLICATE_DECODED_KEY');

for (const [name, result] of [
  ['digest in place of full result', { ...success.result, turns: [{ ...success.result.turns[0], resultText: undefined }] }],
  ['missing explicit brief null', { ...success.result, turns: [{ ...success.result.turns[1], confirmedBrief: undefined }] }],
  ['wrong result text type', { ...success.result, turns: [{ ...success.result.turns[0], resultText: { digest: 'x' } }] }],
  ['wrong brief type', { ...success.result, turns: [{ ...success.result.turns[0], confirmedBrief: 'brief-id' }] }],
  ['cross-session brief', { ...success.result, turns: [{ ...success.result.turns[0], confirmedBrief: { ...brief, sessionRef: 'other-session' } }] }],
  ['cross-turn brief', { ...success.result, turns: [{ ...success.result.turns[0], confirmedBrief: { ...brief, turnRevision: 'other-revision' } }] }],
  ['duplicate turn', { ...success.result, turns: [success.result.turns[0], success.result.turns[0]] }],
  ['extra turn field', { ...success.result, turns: [{ ...success.result.turns[0], summary: 'not complete' }] }],
]) assert.throws(() => Session.response('ReadSessionTurnDetails', { ...success, result }),
  error => ['SCHEMA_INVALID', 'UNKNOWN_REQUIRED_FIELD'].includes(error.publicError?.code), name);

const denied = {
  contractVersion: 'session/v2', requestId: 'read-1', result: null,
  error: { code: 'PERMISSION_DENIED', phase: 'authorize', retryability: 'AFTER_NEW_AUTH', mutationState: 'NONE', transactionRef: null, causeCode: null, reason: 'SCOPE_DENIED' },
};
assert.deepEqual(plain(Session.response('ReadSessionTurnDetails', denied)), denied);
for (const code of ['AUTHORIZATION_REVOKED', 'SESSION_NOT_FOUND', 'READBACK_FAILED']) {
  assert.deepEqual(plain(Session.response('ReadSessionTurnDetails', { ...denied, error: { ...denied.error, code } })).error.code, code);
}
assert.throws(() => Session.response('ReadSessionTurnDetails', { ...denied, error: { ...denied.error, code: 'MODEL_UNAVAILABLE' } }), errorCode('SCHEMA_INVALID'));
assert.throws(() => Session.response('ReadSessionTurnDetails', { ...denied, result: success.result }), errorCode('SCHEMA_INVALID'));
assert.throws(() => Session.response('ReadSessionTurnDetails', { ...success, result: null }), errorCode('SCHEMA_INVALID'));
assert.throws(() => Session.response('ReadSessionTurnDetails', { ...success, leakedField: 'x' }), errorCode('UNKNOWN_REQUIRED_FIELD'));

console.log('session/v2 readback: positive, strict negative, scoped brief, typed denial PASS');

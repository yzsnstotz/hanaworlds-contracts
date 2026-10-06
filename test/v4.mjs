import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as V2 from 'hanaworlds-contracts';
import * as V3 from 'hanaworlds-contracts/v3';

let V4, canvas, adapter, painter, surface, build, fixtures;
try {
  [V4, canvas, adapter, painter, surface, build, fixtures] = await Promise.all([
    import('hanaworlds-contracts/v4'),
    import('hanaworlds-contracts/canvas/v4'),
    import('hanaworlds-contracts/world-adapter/v4'),
    import('hanaworlds-contracts/painter/v3'),
    import('hanaworlds-contracts/interaction-surface/v3'),
    import('hanaworlds-contracts/v4/BUILD/V2'),
    import('hanaworlds-contracts/v4/fixture'),
  ]);
} catch (error) {
  assert.fail(`The public v4 contract exports must resolve: ${error.code ?? error.message}`);
}

// Fixtures and the approved profile are read through the package's own exports.
const exported = async specifier => JSON.parse(await readFile(new URL(import.meta.resolve(specifier)), 'utf8'));
const read = name => exported(`hanaworlds-contracts/v4/fixtures/${name}`);
const profile = await exported('hanaworlds-contracts/v4/profile/CONTRACT_SCHEMA_PROFILE');
const scoped = await exported('hanaworlds-contracts/v4/profile/SCOPED_WORLD_EXTENSION');
const recovery = await exported('hanaworlds-contracts/v4/profile/UNDO_RECOVERY_EXTENSION');
const buildEntry = await exported('hanaworlds-contracts/v4/profile/CURRENT_BUILD_ENTRY_EXTENSION');
const closure = await exported('hanaworlds-contracts/v4/profile/CONTRACT_SEMANTIC_CLOSURE');
const v4 = await read('contract-v4-oracles');
const historyResponses = await read('history-allowlist-response-oracles');
const digestResponses = await read('digest-allowlist-precedence-oracles');
const wires = (await read('wire-inputs-v4')).requests;
const closureFile = await read('closure-oracles-v4');
const legacyClosures = new Map((await read('closure-oracles')).cases.map(x => [x.id, x]));
const events = (await read('canvas-events-v4')).cases;
const goldens = (await read('production-goldens')).vectors;
const utf8 = value => new TextEncoder().encode(JSON.stringify(value));
const plain = value => JSON.parse(JSON.stringify(value));
const code = expected => error => error.publicError?.code === expected;
const counts = {};
const tally = key => { counts[key] = (counts[key] ?? 0) + 1; };

// ---------------------------------------------------------------- identity and inventory
assert.equal(V4.version, '0.3.9');
assert.equal(V4.schemaBundle.$id, 'https://hanaworlds.invalid/contracts/0.3.9/v4/schema.json');
assert.equal(profile.package, 'hanaworlds-contracts@0.3.0');
assert.deepEqual(V4.wireVersions, [...profile.wireVersions, scoped.wire, 'session-authorization/v1', 'session-operation-authorization/v1']);
assert.deepEqual(V4.wireVersions, ['interaction-surface/v3', 'world-adapter/v4', 'canvas/v4', 'session/v2', 'painter/v3', 'ReferenceBrief/v2', 'BUILD/V2', 'world-adapter/v5', 'session-authorization/v1', 'session-operation-authorization/v1']);
assert.equal(V4.schemaInventory.length, 362);
assert.deepEqual([...V4.schemaInventory].slice(0, Object.keys(profile.types).length), Object.keys(profile.types));
assert.deepEqual([...V4.schemaInventory].slice(Object.keys(profile.types).length),
  ['SessionTurnDetail', 'SessionTurnDetailsList', 'SessionTurnDetails', 'ReadSessionTurnDetailsRequest', 'ReadSessionTurnDetailsResponse',
    'UndoHistoryHead', 'UndoAvailability', 'CurrentUndoStatus', 'ReadCurrentUndoStatusRequest', 'ReadCurrentUndoStatusResponse',
    'UndoCurrentBuildRequest', 'CurrentBuildUndoResult', 'UndoCurrentBuildResponse', ...Object.keys(scoped.types), ...Object.keys(recovery.types), ...Object.keys(buildEntry.types), ...Object.keys((await exported('hanaworlds-contracts/v4/profile/SESSION_AUTH_EXTENSION')).types), ...Object.keys((await exported('hanaworlds-contracts/v4/profile/SESSION_OPERATION_AUTH_EXTENSION')).types), ...Object.keys((await exported('hanaworlds-contracts/v4/profile/WORLD_CONTEXT_EXTENSION')).types), ...Object.keys((await exported('hanaworlds-contracts/v4/profile/CURRENT_BUILD_AUTHORIZATION_EXTENSION')).types)]);
assert.equal(Object.keys(V4.digestProfile.projectionTypes).length, 23);
for (const [kind, type] of Object.entries(V3.digestProfile.projectionTypes))
  assert.equal(V4.digestProfile.projectionTypes[kind], type, `old digest projection unchanged: ${kind}`);
assert.equal(V4.digestProfile.domainPrefix, V3.digestProfile.domainPrefix);
assert.equal(canvas.contractVersion, 'canvas/v4');
assert.equal(adapter.contractVersion, 'world-adapter/v4');
assert.equal(painter.contractVersion, 'painter/v3');
assert.equal(surface.contractVersion, 'interaction-surface/v3');
assert.equal(build.contractVersion, 'BUILD/V2');
assert.equal(V4.operationContracts['canvas/v4'].length, 20);
assert.equal(V4.operationContracts['world-adapter/v4'].length, 16);
assert.deepEqual(V4.operationContracts['canvas/v4'].map(x => x.operation).filter(x => !V3.operationContracts['canvas/v3'].some(y => y.operation === x)), ['InspectPlacementRegion', 'RecoverPendingUndo', 'ReadPendingUndoResult', 'ReadWorldSelectionContext']);
assert.deepEqual(V4.operationContracts['world-adapter/v4'].map(x => x.operation).filter(x => !V3.operationContracts['world-adapter/v3'].some(y => y.operation === x)), ['InspectRegion']);
assert.equal(closure.rows.length, 94);
assert.deepEqual(closure.openUserDecisions, []);
for (const name of ['AffectedProjection', 'AuthProjection', 'TxProjection', 'ReceiptProjection', 'ActionProjection', 'IntentProjection', 'BuildProjection', 'Frame', 'Coverage'])
  assert.deepEqual(V4.schemaBundle.definitions[name], V2.schemaBundle.definitions[name], `${name} v2 projection unchanged`);
assert.deepEqual(Object.keys(V4.schemaBundle.definitions.TargetFacts.properties), Object.keys(V3.schemaBundle.definitions.TargetFacts.properties), 'TargetFacts field set unchanged');
assert.deepEqual(V4.contractHandshake, { contracts: 'hanaworlds-contracts@0.3.9',
  wireVersions: ['BUILD/V2', 'ReferenceBrief/v2', 'canvas/v4', 'interaction-surface/v3', 'painter/v3', 'session-authorization/v1', 'session-operation-authorization/v1', 'session/v2', 'world-adapter/v4', 'world-adapter/v5'],
  compiledOperationsVersion: 'operations/v2', factProfiles: ['target-facts/v2', 'target-facts/v3'] });
assert.deepEqual(plain(V4.validateType('ContractHandshake', V4.contractHandshake)), plain(V4.contractHandshake));
assert.deepEqual(Object.keys(V4.ownership).sort(), [...V4.wireVersions].sort(), 'every v4 wire has an approved owner');
assert.deepEqual(V4.placementSettingDescriptors.map(x => [x.name, x.default, x.owner, x.editable]), [
  ['placement.frontGapCells', 2, 'hanaworlds-canvas', true], ['placement.forwardSearchCells', 16, 'hanaworlds-canvas', true],
  ['placement.lateralSearchCells', 8, 'hanaworlds-canvas', true], ['placement.verticalSearchCells', 4, 'hanaworlds-canvas', true]]);
assert.ok(V4.placementInvariants.length === 9 && V4.placementInvariants.every(x => x.switchable === false));
tally('identity');

// ---------------------------------------------------------------- unchanged digests
for (const vector of goldens) {
  const actual = V4.digestValue(vector.kind, vector.payload);
  for (const key of ['canonicalUtf8', 'preimageUtf8', 'preimageHex', 'sha256']) assert.equal(actual[key], vector.expected[key], `${vector.id}.${key}`);
  tally('golden');
}
const history = V4.digestValue('history-operation', v4.historyOperationGolden.projection);
assert.equal(history.sha256, v4.historyOperationGolden.expectedDigest);
assert.equal(history.preimageUtf8.startsWith('HanaWorlds|contracts@0.2.0|history-operation\n'), true);
assert.equal(V4.digestValue('authorization-binding', v4.historyAuthorizationBindingGolden.projection).sha256, v4.historyAuthorizationBindingGolden.expectedDigest);
tally('history-golden');

// ---------------------------------------------------------------- wire requests: strict admission and bindings
const bindingFor = wire => import(['interaction-surface/v3', 'world-adapter/v4', 'canvas/v4', 'painter/v3'].includes(wire) ? `hanaworlds-contracts/${wire}` : `hanaworlds-contracts/v4/${wire}`);
for (const wire of wires) {
  assert.deepEqual(plain(V4.validateRequest(wire.wire, wire.operation, wire.request)), wire.request, wire.id);
  assert.deepEqual(plain(V4.admitRequest(wire.wire, wire.operation, utf8(wire.request))), wire.request, `${wire.id}.raw`);
  assert.deepEqual(plain(V4.validateBoundRequest(wire.wire, wire.operation, wire.request)), wire.request, `${wire.id}.bound`);
  const binding = await bindingFor(wire.wire);
  assert.deepEqual(plain(binding.admit(wire.operation, utf8(wire.request))), wire.request, `${wire.id}.binding`);
  assert.throws(() => binding.validate(wire.operation, { ...wire.request, unapprovedExtension: true }), code('UNKNOWN_REQUIRED_FIELD'), `${wire.id}.unknown-field`);
  tally('wire');
}
// Retired majors are not admitted by the v4 lane, and v4 envelopes are not admitted by the v2/v3 lanes.
for (const [oldWire, newWire] of Object.entries(V4.legacyWireSuccessors)) {
  const request = wires.find(x => x.wire === newWire);
  if (request) {
    assert.throws(() => V4.validateRequest(oldWire, request.operation, request.request), code('UNSUPPORTED_VERSION'), `${oldWire} retired`);
    const lane = oldWire === 'canvas/v3' || oldWire === 'world-adapter/v3' ? V3 : V2;
    // An older decoder rejects the newer envelope at decode: a new field is unknown, or the contractVersion is.
    assert.throws(() => lane.validateRequest(oldWire, request.operation, request.request),
      error => error.publicError?.phase === 'decode' && ['UNSUPPORTED_VERSION', 'UNKNOWN_REQUIRED_FIELD'].includes(error.publicError.code), `${oldWire} lane rejects ${newWire} envelope`);
    tally('retired-major');
  }
}

// ---------------------------------------------------------------- closure oracles (142)
assert.equal(closureFile.cases.length, 142);
assert.equal(closureFile.requestInventory, 'wire-inputs-v4.json');
const assets = { requests: wires, goldens: goldens.map(({ id, kind, payload }) => ({ id, kind, payload })) };
// Inherited cases keep their retired wire labels (closure rc7EnvelopeNote); their successor replay maps only the
// labels, never nested digest-projection constants.
const successor = wire => V4.legacyWireSuccessors[wire] ?? wire;
function successorInput(input) {
  const value = structuredClone(input);
  for (const key of ['consumerWire', 'providerWire']) if (typeof value[key] === 'string') value[key] = successor(value[key]);
  return value;
}
for (const fixture of closureFile.cases) {
  const current = V4.wireVersions.includes(fixture.wire);
  if (!current) {
    assert.deepEqual(fixture, legacyClosures.get(fixture.id), `${fixture.id} is the unchanged legacy case`);
    tally('closure-legacy-label');
  }
  const actual = fixtures.evaluateClosureFixture(successor(fixture.wire), fixture.dimension, current ? fixture.input : successorInput(fixture.input), assets);
  for (const [key, value] of Object.entries(fixture.expected)) assert.deepEqual(actual[key], value, `${fixture.id}.${key}`);
  tally(current ? 'closure-v4' : 'closure-successor-replay');
}
for (const prefix of ['WA', 'CA']) {
  const valid = closureFile.cases.find(value => value.id === `${prefix}-09-VALID`);
  const mixed = closureFile.cases.find(value => value.id === `${prefix}-09-MIXED-INVALID`);
  assert.ok(valid && mixed, `${prefix} v4 positive and mixed negative must both exist`);
  assert.equal(valid.input.consumerWire, valid.wire);
  assert.equal(valid.input.providerWire, valid.wire);
  assert.notEqual(mixed.input.providerWire, valid.wire);
  const rejected = fixtures.evaluateClosureFixture(mixed.wire, mixed.dimension, mixed.input, assets);
  assert.equal(rejected.code, 'UNSUPPORTED_VERSION');
  assert.equal(rejected.worldWrites, 0);
}

// ---------------------------------------------------------------- Canvas events (30)
assert.equal(events.length, 30);
for (const fixture of events) {
  const actual = fixtures.evaluateCanvasEventFixture(fixture.eventType, fixture.input);
  for (const [key, value] of Object.entries(fixture.expected)) assert.deepEqual(actual[key], value, `${fixture.id}.${key}`);
  tally('event');
}
assert.deepEqual(V4.canvasEventRules, V3.canvasEventRules, 'event rules unchanged; only envelopes move to canvas/v4');

// ---------------------------------------------------------------- A/B/C contract oracles (18)
assert.equal(v4.cases.length, 18);
for (const fixture of v4.cases) {
  const actual = fixtures.evaluateV4Fixture(fixture.type, fixture.request, fixture.context);
  for (const [key, value] of Object.entries(fixture.expected)) assert.deepEqual(actual[key], value, `${fixture.id}.${key}`);
  tally('contract-v4');
}
const apply = v4.cases.find(value => value.id === 'B-VALID-CANVAS-PREPARE').request;
assert.equal(Object.hasOwn(apply, 'preparedTransaction'), false);
assert.equal(apply.regionInspectionBinding, null);
assert.equal(V4.validateBoundRequest('canvas/v4', 'ApplyRecoverableCommit', apply).transactionId, apply.transactionId);
assert.throws(() => V4.admitRequest('canvas/v4', 'ApplyRecoverableCommit', utf8({ ...apply, preparedTransaction: {} })), code('UNKNOWN_REQUIRED_FIELD'));
const withoutBinding = { ...apply }; delete withoutBinding.regionInspectionBinding;
assert.throws(() => V4.validateRequest('canvas/v4', 'ApplyRecoverableCommit', withoutBinding), code('SCHEMA_INVALID'), 'regionInspectionBinding is required (nullable), never defaulted');
assert.throws(() => V4.admitRequest('canvas/v4', 'ApplyRecoverableCommit', new TextEncoder().encode('{"a":1,"\\u0061":2}')),
  error => error.publicError?.reason === 'DUPLICATE_DECODED_KEY');
assert.throws(() => V4.validateRequest('canvas/v3', 'ApplyRecoverableCommit', apply), code('UNSUPPORTED_VERSION'));
assert.throws(() => V3.validateRequest('canvas/v3', 'ApplyRecoverableCommit', { ...apply, contractVersion: 'canvas/v3' }), code('UNKNOWN_REQUIRED_FIELD'),
  'a 0.2.1 Canvas consumer does not silently accept the v4 region field');

const historyPrepare = v4.cases.find(value => value.id === 'A-VALID-AUTHOR-LINKED-UNDO').request;
const historyQuery = v4.cases.find(value => value.id === 'A-VALID-RESTART-QUERY').request;
const historyApply = v4.cases.find(value => value.id === 'A-AMBIGUOUS-AFTER-WRITE').request;
const historyAbort = { ...historyQuery, serviceRecoveryRef: 'FIXTURE-service-recovery' };
delete historyAbort.direction;
for (const [operation, request] of [
  ['PrepareHistoryTransaction', historyPrepare], ['QueryPreparedHistoryTransaction', historyQuery],
  ['ApplyHistoryTransaction', historyApply], ['AbortPreparedHistoryTransaction', historyAbort],
]) { assert.deepEqual(plain(V4.validateBoundRequest('world-adapter/v4', operation, request)), request, operation); tally('history-bound'); }
assert.throws(() => V4.validateBoundRequest('world-adapter/v4', 'PrepareHistoryTransaction', { ...historyPrepare, historyOperationDigest: '0'.repeat(64) }), code('NON_CANONICAL_AMBIGUITY'));
assert.throws(() => V4.validateBoundRequest('world-adapter/v4', 'PrepareHistoryTransaction', { ...historyPrepare, originBeforeStateReadbackDigest: '0'.repeat(64) }), code('NON_CANONICAL_AMBIGUITY'),
  'the carried before-state readback digest is bound by the history-operation digest');

// ---------------------------------------------------------------- response allowlists (re-enveloped from the rc.4/rc.5 oracles)
// The approved rc.4/rc.5 response oracles are world-adapter/v3 envelopes; v4 keeps the same allowlists for these
// operations (Prepare additionally admits SAFETY_INVARIANT_FAILED), so each is replayed with only contractVersion moved.
const reenvelope = response => ({ ...response, contractVersion: 'world-adapter/v4' });
for (const fixture of historyResponses.cases) {
  const response = reenvelope(fixture.response);
  if (fixture.kind === 'valid') assert.deepEqual(plain(V4.validateResponse('world-adapter/v4', fixture.operation, response)), response, fixture.id);
  else assert.throws(() => V4.validateResponse('world-adapter/v4', fixture.operation, response), code('SCHEMA_INVALID'), fixture.id);
  tally('history-response');
}
for (const fixture of digestResponses.cases) {
  const response = reenvelope(fixture.response);
  assert.deepEqual(plain(V4.validateResponse('world-adapter/v4', fixture.operation, response)), response, fixture.id);
  tally('digest-response');
}
const ambiguityOps = V4.operationContracts['world-adapter/v4'].filter(value => value.failureCodes.includes('NON_CANONICAL_AMBIGUITY')).map(value => value.operation).sort();
assert.deepEqual(ambiguityOps, ['ApplyCompiledTransaction', 'ApplyHistoryTransaction', 'PrepareHistoryTransaction', 'PrepareRecoverableTransaction']);
for (const operation of ['QueryPreparedHistoryTransaction', 'AbortPreparedHistoryTransaction', 'QueryTransaction', 'InspectRegion'])
  assert.throws(() => V4.validateResponse('world-adapter/v4', operation, reenvelope(digestResponses.cases[0].response)), code('SCHEMA_INVALID'), `${operation}.does-not-admit-digest-response`);
const bodyRecheck = { ...reenvelope(digestResponses.cases[0].response), error: { ...digestResponses.cases[0].response.error, code: 'SAFETY_INVARIANT_FAILED', phase: 'validate', reason: 'SCOPE_DENIED' } };
assert.deepEqual(plain(V4.validateResponse('world-adapter/v4', 'PrepareRecoverableTransaction', bodyRecheck)), bodyRecheck, 'Prepare body recheck code admitted');
assert.throws(() => V3.validateResponse('world-adapter/v3', 'PrepareRecoverableTransaction', { ...bodyRecheck, contractVersion: 'world-adapter/v3' }), code('SCHEMA_INVALID'), 'v3 Prepare did not admit it');
tally('allowlist-delta');

console.log(JSON.stringify({ result: 'PASS_FIXTURE', evidence: 'SOURCE/FIXTURE', version: V4.version, counts,
  types: V4.schemaInventory.length, projections: Object.keys(V4.digestProfile.projectionTypes).length, closureRows: closure.rows.length, providerRuntime: 'NOT_RUN' }));

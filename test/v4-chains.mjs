/** Package-API conformance for the rc.8 v4 chains (history seam A, current inventory,
 * first-building placement) and the per-closure-row pass table for all 93 approved rows.
 * Every message is admitted through the package's exported validators. Cases whose
 * outcome needs provider state (a Canvas record, an Adapter engine/pick record, a grant)
 * are checked here only for their typed payload and allowed code; their approved reference
 * oracle runs unmodified in test/v4-approved-checks.mjs, whose result is consumed below. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as V2 from 'hanaworlds-contracts';
import * as F2 from 'hanaworlds-contracts/fixture';
import * as V3 from 'hanaworlds-contracts/v3';
import * as V4 from 'hanaworlds-contracts/v4';
import * as F4 from 'hanaworlds-contracts/v4/fixture';
import { harness, captureError, json } from './harness.mjs';

const { check, finish } = harness('v4-chains');
const exported = async specifier => JSON.parse(await readFile(new URL(import.meta.resolve(specifier)), 'utf8'));
const fixture = name => exported(`hanaworlds-contracts/v4/fixtures/${name}`);
const closure = await exported('hanaworlds-contracts/v4/profile/CONTRACT_SEMANTIC_CLOSURE');
const registry = await exported('hanaworlds-contracts/v4/profile/SETTINGS_AND_INVARIANTS');
const round3 = JSON.parse(await readFile(new URL('../spec/v4/authority/USER_DECISION_FIRST_PLACEMENT_ROUND3_2026-10-02.json', import.meta.url), 'utf8'));
let approvedChecks = null;
try { approvedChecks = JSON.parse(await readFile(new URL('../evidence/v4-approved-checks.json', import.meta.url), 'utf8')); } catch {}
const seam = await fixture('history-seam-chain-v4');
const inventory = await fixture('current-inventory-chain-v4');
const placement = await fixture('placement-region-chain-v4');
const contractV4 = await fixture('contract-v4-oracles');
const closureV4 = (await fixture('closure-oracles-v4')).cases;
const legacyClosure = (await exported('hanaworlds-contracts/fixtures/closure-oracles')).cases;
const wiresV4 = (await fixture('wire-inputs-v4')).requests;
const wiresV2 = (await exported('hanaworlds-contracts/fixtures/wire-inputs')).requests;
const goldens = (await fixture('production-goldens')).vectors.map(({ id, kind, payload }) => ({ id, kind, payload }));

const executions = new Map(); // "<fixture path>#<caseId>" -> [{ by, status }]
const record = (path, caseId, by) => async (id, category, execute) => {
  await check(id, category, execute, { fixture: path + '#' + caseId, executedBy: by });
};
const PLACEMENT = 'fixtures/candidate/placement-region-chain-v4.json';
const SEAM = 'fixtures/candidate/history-seam-chain-v4.json';
const INVENTORY = 'fixtures/candidate/current-inventory-chain-v4.json';
const err = e => e && { code: e.code, phase: e.phase, reason: e.reason, mutationState: e.mutationState };
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o[k]]));
const D = (kind, value) => V4.digestValue(kind, value).sha256;
const opOf = (wire, operation) => V4.operationContracts[wire].find(x => x.operation === operation);
const approvedStatus = name => approvedChecks?.results?.[name]?.status ?? 'NOT_RUN';

// ---------------------------------------------------------------- history seam A (world-adapter/v4)
{
  const m = seam.validCases.find(x => x.id === 'SEAM-A-PREPARE-QUERY-BIND-UNDO').materializedChain;
  await record(SEAM, 'SEAM-A-PREPARE-QUERY-BIND-UNDO', 'package:world-adapter/v4')('SEAM-A-PREPARE-QUERY-BIND-UNDO', 'history-seam', ({ same }) => {
    same(V4.validateResponse('world-adapter/v4', 'PrepareRecoverableTransaction', m.prepareResponse), m.prepareResponse);
    same(V4.validateResponse('world-adapter/v4', 'QueryPreparedTransaction', m.queryPreparedResponse), m.queryPreparedResponse);
    same(V4.validateBoundRequest('world-adapter/v4', 'ApplyCompiledTransaction', m.applyRequest), m.applyRequest);
    same(V4.validateBoundRequest('world-adapter/v4', 'PrepareHistoryTransaction', m.historyRequest), m.historyRequest);
    const produced = m.prepareResponse.result.beforeStateReadbackDigest;
    same(m.queryPreparedResponse.result, m.prepareResponse.result, '$.queryReturnsSavedResult');
    same(V4.projectPreparedTransaction(m.prepareResponse.result), m.applyRequest.preparedTransaction, '$.applyCarriesSevenFields');
    same(m.historyRequest.originBeforeStateReadbackDigest, produced, '$.canvasBindsProducedDigest');
    same(D('readback', seam.digestGolden.beforeStateReadbackProjection), produced, '$.readbackDigestGolden');
    same(D('before-image', seam.savedBeforeImage), seam.digestGolden.beforeImageDigest, '$.beforeImageDigestGolden');
    same(produced === seam.digestGolden.beforeImageDigest, false, '$.distinctFromBeforeImageDigest');
    same(m.historyRequest.historyOperationDigest, seam.digestGolden.historyOperationDigestAfterV4Migration, '$.historyOperationDigest');
  });
  const invalid = Object.fromEntries(seam.invalidCases.map(x => [x.id, x]));
  await record(SEAM, 'SEAM-A-MISSING-RESPONSE-FIELD', 'package:world-adapter/v4')('SEAM-A-MISSING-RESPONSE-FIELD', 'history-seam', ({ same }) => {
    const result = { ...m.prepareResponse.result }; delete result.beforeStateReadbackDigest;
    const actual = captureError(() => V4.validateResponse('world-adapter/v4', 'PrepareRecoverableTransaction', { ...m.prepareResponse, result }));
    same(pick(actual, ['code', 'phase']), pick(invalid['SEAM-A-MISSING-RESPONSE-FIELD'].expected, ['code', 'phase']));
    same(V4.projectPreparedTransaction(m.prepareResponse.result).beforeImageDigest, m.prepareResponse.result.beforeImageDigest);
  });
  await record(SEAM, 'SEAM-A-SUBSTITUTE-BEFORE-IMAGE-DIGEST', 'package:history-operation digest + provider:Adapter saved digest (reference oracle)')('SEAM-A-SUBSTITUTE-BEFORE-IMAGE-DIGEST', 'history-seam', ({ same }) => {
    const forged = { ...m.historyRequest, originBeforeStateReadbackDigest: seam.digestGolden.beforeImageDigest };
    // Without recomputation the bound history-operation digest already rejects the substitution.
    same(err(captureError(() => V4.validateBoundRequest('world-adapter/v4', 'PrepareHistoryTransaction', forged))).code, 'NON_CANONICAL_AMBIGUITY');
    // Recomputed so the source-value comparison is reached: the contract admits it; only the Adapter's saved
    // digest can reject it (REPLAY_MISMATCH, zero history writes) — an approved reference-oracle expectation.
    const fields = Object.keys(V4.schemaBundle.definitions.HistoryOperationProjection.properties);
    const recomputed = { ...forged, historyOperationDigest: D('history-operation', pick(forged, fields)) };
    same(V4.validateBoundRequest('world-adapter/v4', 'PrepareHistoryTransaction', recomputed), recomputed);
    same(opOf('world-adapter/v4', 'PrepareHistoryTransaction').failureCodes.includes(invalid['SEAM-A-SUBSTITUTE-BEFORE-IMAGE-DIGEST'].expected.code), true);
    same(approvedStatus('verify-history-seam-v4'), 'PASS', '$.approvedReferenceOracle');
  });
  await record(SEAM, 'SEAM-A-OLD-V3-CONSUMER', 'package:v3 and v4 lanes')('SEAM-A-OLD-V3-CONSUMER', 'history-seam', ({ same }) => {
    same(err(captureError(() => V3.validateResponse('world-adapter/v3', 'PrepareRecoverableTransaction', m.prepareResponse))).code, invalid['SEAM-A-OLD-V3-CONSUMER'].expected.code);
    same(err(captureError(() => V4.validateResponse('world-adapter/v4', 'PrepareRecoverableTransaction', { ...m.prepareResponse, contractVersion: 'world-adapter/v3' }))).code, invalid['SEAM-A-OLD-V3-CONSUMER'].expected.code);
    const v3Result = V4.projectPreparedTransaction(m.prepareResponse.result);
    same(err(captureError(() => V4.validateResponse('world-adapter/v4', 'PrepareRecoverableTransaction', { ...m.prepareResponse, result: v3Result }))).code, 'SCHEMA_INVALID', '$.sevenFieldResultNotAcceptedByV4');
  });
  for (const id of ['SEAM-A-QUERY-DRIFT-AFTER-RESTART', 'SEAM-A-REVOKED'])
    await record(SEAM, id, 'provider:Adapter saved state/grant (approved reference oracle)')(id, 'history-seam', ({ same }) => {
      same(V4.validateResponse('world-adapter/v4', 'QueryPreparedTransaction', m.queryPreparedResponse), m.queryPreparedResponse);
      same(approvedStatus('verify-history-seam-v4'), 'PASS', '$.approvedReferenceOracle');
    });
}

// ---------------------------------------------------------------- current inventory (canvas/v4)
{
  const valid = inventory.validCases.find(x => x.id === 'INVENTORY-RESTART-MISSED-EVENTS');
  const x = valid.materializedChain;
  await record(INVENTORY, valid.id, 'package:canvas/v4')(valid.id, 'current-inventory', ({ same }) => {
    same(V4.validateBoundRequest('canvas/v4', 'ListObjects', x.listRequest), x.listRequest);
    same(x.listRequest.expectedRevision, null);
    same(V4.validateResponse('canvas/v4', 'ListObjects', x.listResponse), x.listResponse);
    same(V4.validateBoundRequest('canvas/v4', 'SetObjectSelection', x.selectionRequest), x.selectionRequest);
    const selected = x.listResponse.result.objects.find(o => o.displayName === x.chosenVisibleName);
    same(x.selectionRequest.objectRefs, [selected.objectRef], '$.selectionUsesReturnedRef');
    same(V4.validateRequest('canvas/v4', 'ListObjects', { ...x.listRequest, expectedRevision: 'fixture-registry-6' }).expectedRevision, 'fixture-registry-6', '$.strictModeKept');
    same(err(captureError(() => V3.validateRequest('canvas/v3', 'ListObjects', { ...x.listRequest, contractVersion: 'canvas/v3' }))).code, 'SCHEMA_INVALID', '$.v3NeverHadNullMode');
  });
  for (const c of inventory.invalidCases) {
    const decidable = c.id === 'INVENTORY-MISSING-AUTH';
    await record(INVENTORY, c.id, decidable ? 'package:canvas/v4' : 'provider:Canvas registry/grant (approved reference oracle)')(c.id, 'current-inventory', ({ same }) => {
      if (decidable) {
        const missing = { ...x.listRequest }; delete missing.authorizationRef;
        same(err(captureError(() => V4.admitRequest('canvas/v4', 'ListObjects', new TextEncoder().encode(JSON.stringify(missing))))).code, c.expected.code);
      } else {
        if (c.expected.code) same(opOf('canvas/v4', c.id === 'INVENTORY-CHANGED-REF-BEFORE-SELECTION' ? 'SetObjectSelection' : 'ListObjects').failureCodes.includes(c.expected.code), true);
        if (c.materializedMutation) same(V4.validateBoundRequest('canvas/v4', 'SetObjectSelection', c.materializedMutation.selectionRequest), c.materializedMutation.selectionRequest);
        same(approvedStatus('verify-current-inventory-v4'), 'PASS', '$.approvedReferenceOracle');
      }
    });
  }
}

// ---------------------------------------------------------------- first-building placement
const REQUEST_OPS = { InspectPlacementRegionRequest: ['canvas/v4', 'InspectPlacementRegion'], InspectRegionRequest: ['world-adapter/v4', 'InspectRegion'],
  CreateBuildPlanRequest: ['painter/v3', 'CreateBuildPlan'], BuildDocumentRequest: ['BUILD/V2', 'BuildDocument'], ApplyRecoverableCommitRequest: ['canvas/v4', 'ApplyRecoverableCommit'],
  PrepareRecoverableTransactionRequest: ['world-adapter/v4', 'PrepareRecoverableTransaction'], InspectObjectRequest: ['canvas/v4', 'InspectObject'], InvokeActionRequest: ['interaction-surface/v3', 'InvokeAction'] };
const RESPONSE_OPS = { InspectRegionResponse: ['world-adapter/v4', 'InspectRegion'], PlacementRegionInspection: ['canvas/v4', 'InspectPlacementRegion'],
  CreateBuildPlanResponse: ['painter/v3', 'CreateBuildPlan'], BuildDocumentResponse: ['BUILD/V2', 'BuildDocument'] };
function admitMessage(type, message) {
  if (REQUEST_OPS[type]) return V4.validateBoundRequest(...REQUEST_OPS[type], message);
  if (RESPONSE_OPS[type]) {
    const response = V4.validateResponse(...RESPONSE_OPS[type], message);
    if (response.result?.outcome === 'REGION_INSPECTED') V4.validateRegionInspection(response.result.inspection);
    return response;
  }
  return V4.validateType(type, message);
}
const TYPES = { canvasInspectRequest: 'InspectPlacementRegionRequest', adapterInspectRequest: 'InspectRegionRequest', adapterInspectResponse: 'InspectRegionResponse',
  canvasInspectResponse: 'PlacementRegionInspection', painterRequest: 'CreateBuildPlanRequest', painterResponse: 'CreateBuildPlanResponse', brushRequest: 'BuildDocumentRequest',
  brushResponse: 'BuildDocumentResponse', applyRequest: 'ApplyRecoverableCommitRequest', prepareRequest: 'PrepareRecoverableTransactionRequest', invokeAction: 'InvokeActionRequest', interactionFrame: 'InteractionFrame' };
const main = placement.validCases.find(x => x.id === 'PLACE-LUANTI-INITIATOR-CHAIN');
const m = main.materializedChain;
const inspection = m.adapterInspectResponse.result.inspection;
await record(PLACEMENT, main.id, 'package:all v4 wires')(main.id, 'placement-valid', ({ same }) => {
  for (const [key, type] of Object.entries(TYPES)) if (m[key]) same(admitMessage(type, m[key]), m[key], '$.' + key);
  same(V4.validateRegionInspection(inspection), inspection, '$.adapterComputedDigests');
  same(V4.admitPlacementSettings(m.canvasSettingsRecord.stored, m.canvasSettingsRecord.settingsRevision), m.adapterInspectRequest.placementSettings, '$.settingsAdmitted');
  same(m.canvasInspectResponse.result, m.adapterInspectResponse.result, '$.canvasRelaysUnchanged');
  same(m.painterRequest.regionInspection, inspection, '$.painterCopiesInspection');
  const build = m.painterResponse.result.build;
  same(build.coordinateFrame, inspection.frame, '$.buildUsesAdapterFrame');
  same(m.applyRequest.regionInspectionBinding, { inspectionId: inspection.inspectionId, build }, '$.applyBinding');
  same(m.applyRequest.operations.targetFactsDigest, inspection.targetFactsDigest, '$.applyFactsDigest');
  same(D('build', build), m.applyRequest.operations.buildDigest, '$.applyBuildDigest');
  same(m.prepareRequest.operations, m.applyRequest.operations, '$.prepareCarriesOperations');
});
for (const c of placement.validCases.filter(x => x !== main))
  await record(PLACEMENT, c.id, 'package:all v4 wires')(c.id, 'placement-valid', ({ same }) => {
    for (const [key, type] of Object.entries(TYPES)) if (c[key]) same(admitMessage(type, c[key]), c[key], '$.' + key);
    if (c.interactionFrame) same(V4.validateChoiceSelection(c.interactionFrame, c.invokeAction), c.invokeAction, '$.selectChoiceListed');
    if (c.invokeAction?.input.kind === 'SELECT_CHOICE') same(c.canvasInspectRequest.anchor, { kind: 'NAMED_PLAYER', engineActorName: c.invokeAction.input.value }, '$.namedAnchor');
    if (c.invokeAction?.input.kind === 'PICK_WORLD_POINT') same(c.canvasInspectRequest.anchor, { kind: 'PICKED_POINT', pickRef: c.invokeAction.input.pickRef }, '$.pickedAnchor');
    same(approvedStatus('verify-placement-region-v4'), 'PASS', '$.approvedSearchOracle');
  });
for (const c of placement.askCases)
  await record(PLACEMENT, c.id, 'package:canvas/v4 PlacementChoiceRequired + approved search oracle')(c.id, 'placement-ask', ({ same }) => {
    same(admitMessage('PlacementRegionInspection', c.canvasInspectResponse), c.canvasInspectResponse);
    const choice = c.canvasInspectResponse.result.choice;
    same(choice.reasons, c.expected.reasons);
    same(choice.placementSettings, c.settings);
    same(approvedStatus('verify-placement-region-v4'), 'PASS', '$.approvedSearchOracle');
  });
await check('PLACEMENT-CHOICE-DOMAIN-NEGATIVES', 'placement-ask', ({ same }) => {
  const multiple = placement.askCases.find(x => x.id === 'ASK-SHELL-MULTIPLE').canvasInspectResponse;
  const none = placement.askCases.find(x => x.id === 'ASK-SHELL-NONE').canvasInspectResponse;
  const set = (response, patch) => ({ ...response, result: { ...response.result, choice: { ...response.result.choice, ...patch } } });
  same(err(captureError(() => V4.validateResponse('canvas/v4', 'InspectPlacementRegion', set(multiple, { candidatePlayerNames: null })))).code, 'SCHEMA_INVALID', '$.multipleWithoutNames');
  same(err(captureError(() => V4.validateResponse('canvas/v4', 'InspectPlacementRegion', set(none, { candidatePlayerNames: ['alice'] })))).code, 'SCHEMA_INVALID', '$.namesWithoutMultiple');
  same(err(captureError(() => V4.validateResponse('canvas/v4', 'InspectPlacementRegion', set(none, { options: ['NAME_PLAYER', 'PICK_WORLD_POINT'] })))).code, 'SCHEMA_INVALID', '$.noPlayerOffersOnlyPick');
  same(err(captureError(() => V4.validateResponse('canvas/v4', 'InspectPlacementRegion', set(multiple, { options: ['PICK_WORLD_POINT', 'NAME_PLAYER'] })))).code, 'SCHEMA_INVALID', '$.fixedOptionOrder');
  same(err(captureError(() => V4.validateResponse('canvas/v4', 'InspectPlacementRegion', set(multiple, { options: ['PICK_WORLD_POINT'] })))).code, 'SCHEMA_INVALID', '$.multipleOffersNamePlayer');
  for (const id of ['ASK-PLAYER-OFFLINE', 'ASK-FRONT-BLOCKED', 'ASK-FACING-TIE']) {
    const ask = placement.askCases.find(x => x.id === id).canvasInspectResponse;
    same(ask.result.choice.options, ['PICK_WORLD_POINT'], '$.' + id + '.pickOnly');
    same(err(captureError(() => V4.validateResponse('canvas/v4', 'InspectPlacementRegion', set(ask, { options: ['NAME_PLAYER', 'PICK_WORLD_POINT'] })))).code, 'SCHEMA_INVALID', '$.' + id + '.noNamePlayer');
  }
  same(err(captureError(() => V4.validateResponse('canvas/v4', 'InspectPlacementRegion', set(multiple, { candidatePlayerNames: ['bob', 'alice'] })))).code, 'SCHEMA_INVALID', '$.namesUTF16Sorted');
  same(err(captureError(() => V4.validateResponse('canvas/v4', 'InspectPlacementRegion', { ...multiple, unavailableSettings: ['placement.frontGapCells'] }))).code, 'SCHEMA_INVALID', '$.unavailableOnlyOnPolicyError');
  const unset = placement.invalidCases.find(x => x.id === 'INV-SETTING-UNSET').materialized.message;
  same(err(captureError(() => V4.validateResponse('canvas/v4', 'InspectPlacementRegion', { ...unset, unavailableSettings: null }))).code, 'SCHEMA_INVALID', '$.policyErrorNamesSettings');
  const withPose = { ...multiple, result: { ...multiple.result, choice: { ...multiple.result.choice, position: [0, 1, 0] } } };
  same(err(captureError(() => V4.validateResponse('canvas/v4', 'InspectPlacementRegion', withPose))).code, 'UNKNOWN_REQUIRED_FIELD', '$.noPoseField');
  const region = { ...inspection, targetFacts: { ...inspection.targetFacts, source: 'INSPECTED', profileVersion: 'target-facts/v2' } };
  same(err(captureError(() => V4.validateType('RegionInspection', region))).code, 'SCHEMA_INVALID', '$.regionInspectionNeedsRegionFacts');
  same(err(captureError(() => V4.validateRegionInspection({ ...inspection, targetFactsDigest: '0'.repeat(64) }))).code, 'NON_CANONICAL_AMBIGUITY', '$.factsDigestRecomputed');
  same(err(captureError(() => V4.validateRegionInspection({ ...inspection, frame: { ...inspection.frame, frameId: 'consumer-frame' } }))).code, 'NON_CANONICAL_AMBIGUITY', '$.frameDigestRecomputed');
  same(err(captureError(() => V4.validateType('RegionInspection', { ...inspection, evidence: { ...inspection.evidence, worldRevision: 'other' } }))).code, 'SCHEMA_INVALID', '$.evidenceBindsInspectedWorld');
  same(err(captureError(() => V4.validateType('RegionInspection', { ...inspection, protectedPositions: [[999, 999, 999]] }))).reason, 'INVALID_GEOMETRY', '$.protectedInsideBounds');
});

// Invalid cases: exact package decision where the payload decides; reference oracle where provider state decides.
const frameOf = id => placement.validCases.find(v => v.id === id).interactionFrame;
const PACKAGE_DECIDED = {
  'INV-REGION-SOURCE-WITH-OBJECTREF': c => V4.validateType('TargetFacts', c.materialized.message),
  'INV-INTERIOR-ON-REGION': c => V4.validateBoundRequest('painter/v3', 'CreateBuildPlan', c.materialized.message),
  'INV-PAINTER-REGION-MISMATCH': c => V4.validateBoundRequest('painter/v3', 'CreateBuildPlan', c.materialized.message),
  'INV-INVENTED-FRAME': c => V4.validateBoundRequest('BUILD/V2', 'BuildDocument', c.materialized.message),
  'INV-SETTING-UNSET': c => V4.admitPlacementSettings(c.canvasSettingsRecord.stored, c.canvasSettingsRecord.settingsRevision),
  'INV-SETTING-INVALID': c => V4.admitPlacementSettings(c.canvasSettingsRecord.stored, c.canvasSettingsRecord.settingsRevision),
  'INV-UNLISTED-CHOICE': c => V4.validateChoiceSelection(frameOf(c.frameCaseId), c.materialized.message),
  'INV-CHOICE-ON-NON-CHOICE-ACTION': c => V4.validateChoiceSelection(frameOf(c.frameCaseId), c.materialized.message),
};
// Provider-owned decisions; the bracketed owner is the provider state the approved reference oracle models.
const PROVIDER_DECIDED = {
  'INV-UNISSUED-INSPECTION-AT-APPLY': 'Canvas durable inspection record', 'INV-MISSING-BINDING-AT-APPLY': 'Canvas durable inspection record (Q1 condition)',
  'INV-STALE-AT-APPLY': 'Canvas record vs current world revision', 'INV-PROTECTED-AT-PREPARE': 'Adapter engine is_protected at Prepare',
  'INV-BODY-AT-PREPARE': 'Adapter engine collision boxes at Prepare', 'INV-FICTITIOUS-OBJECT': 'Canvas object registry',
  'INV-INITIAL-PLANNED': 'painter preceding-plan record', 'INV-NAMES-UNAUTHORIZED': 'Canvas INSPECT grant', 'INV-NAMES-REVOKED-BEFORE-RELEASE': 'Canvas grant revocation',
  'INV-SHELL-FORGED-PICKREF': 'Adapter pick record', 'INV-INWORLD-SELECT-CHOICE': 'Luanti in-world renderer capability (rc.9 Q3)', 'INV-FORGED-EVIDENCE-AT-APPLY': 'Canvas durable inspection record',
};
const deviations = [];
for (const c of placement.invalidCases) {
  const expected = c.expected.error;
  if (PACKAGE_DECIDED[c.id]) {
    await record(PLACEMENT, c.id, 'package:exact')(c.id, 'placement-invalid', ({ same }) => {
      let caught = null;
      try { PACKAGE_DECIDED[c.id](c); } catch (error) { caught = error; }
      same(caught?.publicError ?? 'ACCEPTED', expected);
      if (c.expected.unavailableSettings) same(caught.unavailableSettings, c.expected.unavailableSettings, '$.unavailableSettings');
      if (c.materialized.type === 'PlacementRegionInspection') same(admitMessage(c.materialized.type, c.materialized.message), c.materialized.message, '$.typedErrorResponse');
    });
  } else if (c.id === 'INV-V021-CONSUMER-REGION-SOURCE') {
    await record(PLACEMENT, c.id, 'package:v3 lane (the contracts@0.2.1 decoder)')(c.id, 'placement-invalid', ({ same }) => {
      const actual = captureError(() => V3.validateType('TargetFacts', c.materialized.message));
      // rc.10 (V4-03): the expected error is the sealed admitted 0.2.1 decoder's own answer.
      same(actual, expected, '$.rejectedAtDecodeExactly');
      same(V4.validateType('TargetFacts', c.materialized.message), c.materialized.message, '$.v4Admits');
    });
  } else {
    await record(PLACEMENT, c.id, `provider:${PROVIDER_DECIDED[c.id]} (approved reference oracle)`)(c.id, 'placement-invalid', ({ same }) => {
      const [wire, operation] = c.operation ? [c.operation.wire, c.operation.operation] : [];
      same(V4.validateType('Error', expected), expected, '$.typedError');
      same(opOf(wire, operation).failureCodes.includes(expected.code), true, '$.codeAllowedByOperation');
      if (c.id === 'INV-FORGED-EVIDENCE-AT-APPLY') {
        // rc.10 (V4-04): the forged request binds its own operation digest, so every payload check passes
        // and only the Canvas record match can reject it.
        same(V4.validateBoundRequest(wire, operation, c.materialized.message), c.materialized.message, '$.payloadCoherentWithoutRecord');
      } else if (c.materialized.type === 'PlacementRegionInspection') {
        same(admitMessage(c.materialized.type, c.materialized.message), c.materialized.message, '$.typedErrorResponse');
        same(c.materialized.message.error, expected, '$.carriesExpectedError');
      } else same(admitMessage(c.materialized.type, c.materialized.message), c.materialized.message, '$.payloadAdmitted');
      if (c.response) {
        // rc.9 Q3: the renderer answers with the typed InvokeAction error; nothing is relayed to Workshop.
        same(V4.validateResponse(wire, operation, c.response), c.response, '$.typedRendererResponse');
        same(c.response.error, expected, '$.carriesExpectedError');
      }
      same(approvedStatus('verify-placement-region-v4'), 'PASS', '$.approvedReferenceOracle');
    });
  }
}
for (const c of placement.schemaRejectCases)
  await record(PLACEMENT, c.id, 'package:interaction-surface/v3')(c.id, 'placement-schema-reject', ({ same }) => {
    const actual = captureError(() => V4.validateType(c.type, c.message));
    same(pick(actual, ['code', 'phase', 'reason']), pick(c.expected, ['code', 'phase', 'reason']));
  });
await check('PLACEMENT-CHOICE-INPUT-KIND', 'placement-choice-scope', ({ same }) => {
  // CONTRACT_RULES.md:154 and the approved choice oracle: only SELECT_CHOICE values are checked against the list.
  // Another input kind on a choice-only action is not an INVALID_SELECTION (here PICK_WORLD_POINT).
  const valid = placement.validCases.find(x => x.id === 'PLACE-SHELL-NAMED-AFTER-ASK');
  const request = { ...valid.invokeAction, input: { kind: 'PICK_WORLD_POINT', pickRef: 'adapter-pick-1' } };
  same(V4.validateChoiceSelection(valid.interactionFrame, request), request);
});
const v021Advertisement = { contracts: 'hanaworlds-contracts@0.2.1', wireVersions: [...V3.wireVersions].sort(), compiledOperationsVersion: V3.compiledOperationsVersion, factProfiles: ['target-facts/v2'] };
for (const c of placement.compatibilityCases)
  await record(PLACEMENT, c.id, 'package:ContractHandshake')(c.id, 'handshake', ({ same }) => {
    const actual = captureError(() => V4.checkContractHandshake(c.advertised, c.required));
    if (c.expected.result === 'HANDSHAKE_VERSION_MATCH') {
      same(actual, { accepted: true });
      same(c.advertised, V4.contractHandshake, '$.packageAdvertisesExactlyThis');
    } else {
      same(actual, { code: c.expected.code, phase: c.expected.phase, retryability: 'NEVER', mutationState: c.expected.mutationState, transactionRef: null, causeCode: null, reason: c.expected.reason });
      same(c.advertised, v021Advertisement, '$.matchesThe021Lane');
      same(captureError(() => V4.checkContractHandshake(V4.contractHandshake, c.required)), { accepted: true }, '$.a030PeerSatisfiesIt');
    }
  });
await check('HANDSHAKE-EVERY-MIXED-PAIR', 'handshake', ({ same }) => {
  // Every v4-lane wire or target-facts/v3 requirement fails against the 0.2.1 advertisement, before any request.
  for (const wire of V4.wireVersions.filter(w => !V3.wireVersions.includes(w)))
    same(captureError(() => V4.checkContractHandshake(v021Advertisement, { wires: [wire], factProfiles: [] })).code, 'UNSUPPORTED_VERSION', '$.' + wire);
  same(captureError(() => V4.checkContractHandshake(v021Advertisement, { wires: ['BUILD/V2'], factProfiles: ['target-facts/v3'] })).code, 'UNSUPPORTED_VERSION', '$.factProfile');
  for (const wire of V3.wireVersions.filter(w => !V4.wireVersions.includes(w)))
    same(captureError(() => V4.checkContractHandshake(V4.contractHandshake, { wires: [wire], factProfiles: [] })).code, 'UNSUPPORTED_VERSION', '$.reverse.' + wire);
  same(captureError(() => V4.checkContractHandshake({ ...V4.contractHandshake, compiledOperationsVersion: 'operations/v1' }, { wires: [], factProfiles: [] })).phase, 'decode', '$.operationsVersion');
});
await check('PLACEMENT-PRIVACY-SCHEMA', 'privacy', ({ same }) => {
  const forbidden = new Set(placement.privacy.forbiddenKeys); const seen = new Set(); const leaks = [];
  const walk = name => { if (seen.has(name)) return; seen.add(name); const s = V4.schemaBundle.definitions[name];
    const visit = n => { if (!n) return; if (n.$ref) walk(n.$ref.slice(14)); (n.anyOf ?? []).forEach(visit); (n.oneOf ?? []).forEach(visit);
      if (n.properties) for (const [k, v] of Object.entries(n.properties)) { if (forbidden.has(k)) leaks.push(name + '.' + k); visit(v); }
      if (n.items) (Array.isArray(n.items) ? n.items : [n.items]).forEach(visit); if (n.additionalProperties && typeof n.additionalProperties === 'object') visit(n.additionalProperties); };
    visit(s); };
  for (const root of ['InspectRegionRequest', 'InspectRegionResponse', 'InspectPlacementRegionRequest', 'PlacementRegionInspection', 'InteractionFrame', 'InvokeActionRequest', 'CreateBuildPlanRequest', 'ApplyRecoverableCommitRequest']) walk(root);
  same(leaks, []);
});
await check('PLACEMENT-SETTINGS-REGISTRY', 'settings', ({ same }) => {
  same(V4.placementSettingDescriptors.map(s => s.name), registry.settings.map(s => s.name));
  same(Object.fromEntries(V4.placementSettingDescriptors.map(s => [s.name, s.default])), round3.decidedBehavior.settingDefaults, '$.userDecidedDefaults');
  same(V4.placementInvariants.map(i => i.id), registry.invariants.map(i => i.id));
  same(V4.schemaInventory.includes('PlacementSettings') && V4.schemaInventory.includes('PlacementSettingName'), true);
  const valid = { 'placement.frontGapCells': 0, 'placement.forwardSearchCells': 0, 'placement.lateralSearchCells': 0, 'placement.verticalSearchCells': 0 };
  same(V4.admitPlacementSettings(valid, 'r-0'), { frontGapCells: 0, forwardSearchCells: 0, lateralSearchCells: 0, verticalSearchCells: 0, settingsRevision: 'r-0' }, '$.zeroAllowed');
  const everyUnset = captureError(() => V4.admitPlacementSettings({}, 'r-0'));
  same(pick(everyUnset, ['code', 'phase', 'reason']), { code: 'CAPABILITY_UNAVAILABLE', phase: 'validate', reason: 'POLICY_UNAVAILABLE' });
  let names; try { V4.admitPlacementSettings({ ...valid, 'placement.frontGapCells': '2' }, 'r-0'); } catch (e) { names = e.unavailableSettings; }
  same(names, ['placement.frontGapCells'], '$.stringNotCoerced');
});

// ---------------------------------------------------------------- closure rows whose oracle lives in the closure/contract fixture files
const assetsV4 = { requests: wiresV4, goldens };
const assetsV2 = { requests: wiresV2, goldens };
const successor = wire => V4.legacyWireSuccessors[wire] ?? wire;
const byId = list => new Map(list.map(x => [x.id, x]));
const legacyById = byId(legacyClosure), v4ById = byId(closureV4), contractById = byId(contractV4.cases);
for (const row of closure.rows) for (const side of ['validFixture', 'invalidFixture']) {
  const ref = row[side];
  if (ref.path === 'fixtures/candidate/closure-oracles.json') {
    const c = legacyById.get(ref.caseId);
    await record(ref.path, ref.caseId, 'package:v2 lane (legacy fixture)')(row.id + ':' + ref.caseId + ':legacy', 'closure-legacy', ({ expectedSubset }) =>
      expectedSubset(F2.evaluateClosureFixture(c.wire, c.dimension, c.input, assetsV2), c.expected));
    const input = structuredClone(c.input);
    for (const k of ['consumerWire', 'providerWire']) if (typeof input[k] === 'string') input[k] = successor(input[k]);
    await record(ref.path, ref.caseId, `package:v4 lane (${row.protocol} successor replay)`)(row.id + ':' + ref.caseId + ':v4', 'closure-successor', ({ expectedSubset, same }) => {
      same(successor(c.wire), row.protocol, '$.rowProtocol');
      expectedSubset(F4.evaluateClosureFixture(row.protocol, c.dimension, input, assetsV4), c.expected);
    });
  } else if (ref.path === 'fixtures/candidate/closure-oracles-v4.json') {
    const c = v4ById.get(ref.caseId);
    await record(ref.path, ref.caseId, 'package:v4 lane')(row.id + ':' + ref.caseId, 'closure-v4', ({ expectedSubset, same }) => {
      same(c.wire, row.protocol, '$.rowProtocol');
      expectedSubset(F4.evaluateClosureFixture(c.wire, c.dimension, c.input, assetsV4), c.expected);
      expectedSubset(c.expected, row.expectedOutcomes[side === 'validFixture' ? 'valid' : 'invalid'], '$.rowExpectation');
    });
  } else if (ref.path === 'fixtures/candidate/contract-v4-oracles.json') {
    const c = contractById.get(ref.caseId);
    await record(ref.path, ref.caseId, 'package:v4 lane A/B/C model')(row.id + ':' + ref.caseId, 'contract-v4', ({ expectedSubset }) =>
      expectedSubset(F4.evaluateV4Fixture(c.type, c.request, c.context), c.expected));
  }
}

// ---------------------------------------------------------------- per-row table
const report = await finish();
const byFixture = new Map();
for (const r of report.results) if (r.fixture) byFixture.set(r.fixture, [...(byFixture.get(r.fixture) ?? []), { check: r.id, executedBy: r.executedBy, status: r.status }]);
const side = ref => {
  const runs = byFixture.get(ref.path + '#' + ref.caseId) ?? [];
  return { fixture: ref.path + '#' + ref.caseId, executions: runs, status: runs.length && runs.every(x => x.status === 'PASS') ? 'PASS' : runs.length ? 'FAIL' : 'NOT_RUN' };
};
const rows = closure.rows.map(row => ({ id: row.id, protocol: row.protocol, dimension: row.dimension, valid: side(row.validFixture), invalid: side(row.invalidFixture) }));
const summary = { rows: rows.length, bothPass: rows.filter(r => r.valid.status === 'PASS' && r.invalid.status === 'PASS').length,
  notRun: rows.filter(r => r.valid.status === 'NOT_RUN' || r.invalid.status === 'NOT_RUN').map(r => r.id),
  failed: rows.filter(r => r.valid.status === 'FAIL' || r.invalid.status === 'FAIL').map(r => r.id) };
await mkdir('evidence', { recursive: true });
await writeFile('evidence/closure-coverage-v4.json', JSON.stringify({ evidence: 'SOURCE/FIXTURE', providerRuntime: 'NOT_RUN',
  approvedChecks: approvedChecks ? Object.fromEntries(Object.entries(approvedChecks.results).map(([k, v]) => [k, v.status])) : 'NOT_RUN',
  summary, deviations, rows }, null, 2) + '\n');
console.log(JSON.stringify({ closureRowTable: summary, deviations: deviations.map(d => d.caseId + '→' + d.gap) }));
// QR-I1: rc.10 resolved V4-02/03/04, so the known-deviation set is pinned to empty; any new mismatch fails.
if (summary.bothPass !== closure.rows.length || deviations.length !== 0) process.exitCode = 1;

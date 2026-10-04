import {
  validateRequest, validateBoundRequest, admitRequest, digestValue, checkContractHandshake, validateChoiceSelection,
  admitPlacementSettings, validateRegionInspection, projectPreparedTransaction, contractHandshake, placementSettingDescriptors,
  checkSessionReadbackHandshake, checkSessionUndoHandshake, checkScopedWorldHandshake,
  validateScopedTransition, projectScopedPreparedTransaction,
  type TypeMap, type OperationMap, type WireVersion, type FactProfile,
} from 'hanaworlds-contracts/v4';
import * as Canvas from 'hanaworlds-contracts/canvas/v4';
import * as Adapter from 'hanaworlds-contracts/world-adapter/v4';
import * as ScopedAdapter from 'hanaworlds-contracts/world-adapter/v5';
import * as Painter from 'hanaworlds-contracts/painter/v3';
import * as Surface from 'hanaworlds-contracts/interaction-surface/v3';
import * as Build from 'hanaworlds-contracts/v4/BUILD/V2';
import * as Session from 'hanaworlds-contracts/v4/session/v2';
import { evaluateV4Fixture } from 'hanaworlds-contracts/v4/fixture';
import { schemaInventory } from 'hanaworlds-contracts/v4/schemas';

const raw: unknown = {};
const apply: TypeMap['ApplyRecoverableCommitRequest'] = validateRequest('canvas/v4', 'ApplyRecoverableCommit', raw);
const binding: TypeMap['RegionApplyBinding'] | null = apply.regionInspectionBinding;
const bound: TypeMap['ApplyRecoverableCommitRequest'] = validateBoundRequest('canvas/v4', 'ApplyRecoverableCommit', raw);
const listed: TypeMap['ListObjectsRequest'] = admitRequest('canvas/v4', 'ListObjects', new Uint8Array());
const expected: string | null = listed.expectedRevision;
const region: TypeMap['InspectPlacementRegionRequest'] = Canvas.validate('InspectPlacementRegion', raw);
const inspect: TypeMap['InspectRegionRequest'] = Adapter.validate('InspectRegion', raw);
const prepared: TypeMap['PrepareRecoverableTransactionResponse'] = Adapter.response('PrepareRecoverableTransaction', raw);
const plan: TypeMap['CreateBuildPlanRequest'] = Painter.validate('CreateBuildPlan', raw);
const inspection: TypeMap['RegionInspection'] | null = plan.regionInspection;
const invoke: TypeMap['InvokeActionRequest'] = Surface.validate('InvokeAction', raw);
const document: TypeMap['BuildDocumentRequest'] = Build.validate('BuildDocument', raw);
const handshake: TypeMap['ContractHandshake'] = checkContractHandshake(raw, { wires: ['painter/v3'], factProfiles: ['target-facts/v3'] }).advertised;
const selected: TypeMap['InvokeActionRequest'] = validateChoiceSelection(raw, raw);
const settings: TypeMap['PlacementSettings'] = admitPlacementSettings({}, 'r');
const checked: TypeMap['RegionInspection'] = validateRegionInspection(raw);
const seven: TypeMap['PreparedTransaction'] = projectPreparedTransaction(raw);
const profile: FactProfile = 'target-facts/v3';
const advertised: ReadonlyArray<string> = contractHandshake.wireVersions;
const firstDefault: number | undefined = placementSettingDescriptors[0]?.default;
const wire: WireVersion = 'painter/v3';
const request: OperationMap['world-adapter/v4']['InspectRegion']['request'] = inspect;
const readbackRequest: OperationMap['session/v2']['ReadSessionTurnDetails']['request'] = Session.validate('ReadSessionTurnDetails', raw);
const readbackResponse: TypeMap['ReadSessionTurnDetailsResponse'] = Session.response('ReadSessionTurnDetails', raw);
const readbackPeer: string = checkSessionReadbackHandshake(contractHandshake).advertised.contracts;
const readbackText: string | undefined = readbackResponse.result?.turns[0]?.resultText;
const readbackBrief: TypeMap['BriefProjection'] | null | undefined = readbackResponse.result?.turns[0]?.confirmedBrief;
const historyQuery: TypeMap['HistoryQuery'] = Canvas.validate('HistoryQuery', raw);
const nullableHistoryRevision: string | null = historyQuery.expectedHistoryRevision;
const undoStatusRequest: OperationMap['session/v2']['ReadCurrentUndoStatus']['request'] = Session.validate('ReadCurrentUndoStatus', raw);
const undoStatusResponse: TypeMap['ReadCurrentUndoStatusResponse'] = Session.response('ReadCurrentUndoStatus', raw);
const undoRequest: OperationMap['session/v2']['UndoCurrentBuild']['request'] = Session.validate('UndoCurrentBuild', raw);
const undoResponse: TypeMap['UndoCurrentBuildResponse'] = Session.response('UndoCurrentBuild', raw);
const undoHead: TypeMap['UndoHistoryHead'] | null | undefined = undoStatusResponse.result?.head;
const undoPeer: string = checkSessionUndoHandshake(contractHandshake).advertised.contracts;
const scopedPeer: string = checkScopedWorldHandshake(contractHandshake).advertised.contracts;
const scopedPrepare: OperationMap['world-adapter/v5']['PrepareRecoverableTransaction']['request'] = ScopedAdapter.validate('PrepareRecoverableTransaction', raw);
const scopedApply: TypeMap['ScopedApplyRequest'] = validateScopedTransition(raw, raw).apply;
const scopedPrepared: TypeMap['ScopedPreparedTransaction'] = projectScopedPreparedTransaction(raw);
const typeName: keyof TypeMap = schemaInventory[0]!;
const fixtureOutcome = evaluateV4Fixture('CreateObjectRequest', raw, { trustedCanvasDomain: false });
const digest: string = digestValue('target-facts', raw).sha256;

// @ts-expect-error retired majors are never admitted by the v4 lane
validateRequest('painter/v2', 'CreateBuildPlan', raw);
// @ts-expect-error canvas/v3 is replaced by canvas/v4
validateRequest('canvas/v3', 'ApplyRecoverableCommit', raw);
// @ts-expect-error no new digest kind in rc.8
digestValue('region-inspection', raw);
// @ts-expect-error InspectRegion is an Adapter operation, not a Canvas one
Canvas.validate('InspectRegion', raw);

void [binding, bound, expected, region, prepared, inspection, invoke, document, handshake, selected, settings, checked, seven, profile, advertised, firstDefault, wire, request, readbackRequest, readbackResponse, readbackPeer, readbackText, readbackBrief, historyQuery, nullableHistoryRevision, undoStatusRequest, undoStatusResponse, undoRequest, undoResponse, undoHead, undoPeer, scopedPeer, scopedPrepare, scopedApply, scopedPrepared, typeName, fixtureOutcome, digest];

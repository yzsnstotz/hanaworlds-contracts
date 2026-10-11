import { createPlacementSettingsMock, readPlacementSettings, placementSettingsRead,
  placementSettingDescriptors, placementInvariants, safetyProfileFromConfirmedIntent,
  requireDeclaredAvatarEnvelope, type ReadPlacementSettingsRequest,
  type ReadPlacementSettingsResponse, type PlacementSettingsReadback,
  type SafetyProfile, type AvatarEnvelope } from 'hanaworlds-contracts';
const request: ReadPlacementSettingsRequest = { contractVersion: 'canvas/v7', requestId: 'read',
  sessionRef: 'session', worldRef: 'world', localContext: { connectionRef: 'connection',
    connectionIncarnationRef: 'open', worldRef: 'world', selectionRevision: 'selection' } };
const state: PlacementSettingsReadback = { sessionRef: 'session', worldRef: 'world',
  localContext: request.localContext!, placementSettings: { frontGapCells: 0,
    forwardSearchCells: 3, lateralSearchCells: 1, verticalSearchCells: 0, settingsRevision: 'settings-7' } };
const response: ReadPlacementSettingsResponse = await createPlacementSettingsMock(state).call('ReadPlacementSettings', request);
const current: PlacementSettingsReadback = readPlacementSettings(request, response);
const revision: string = current.placementSettings.settingsRevision;
const minor: 2 = placementSettingsRead.minor;
void [revision, minor, placementSettingDescriptors, placementInvariants,
  safetyProfileFromConfirmedIntent, requireDeclaredAvatarEnvelope];
// Public types already describe these surfaces; this consumer never supplies defaults.
const declaredOnly = (safety: SafetyProfile, envelope: AvatarEnvelope) => [safety, envelope];
void declaredOnly;

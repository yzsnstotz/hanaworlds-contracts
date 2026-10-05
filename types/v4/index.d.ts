import type * as T from './contracts.js';
export * from './contracts.js';
export type JSONValue = null | boolean | number | string | ReadonlyArray<JSONValue> | { readonly [key: string]: JSONValue };
export interface DigestResult<P> { readonly kind: T.DigestKind; readonly projection: P; readonly canonicalUtf8: string; readonly preimageUtf8: string; readonly preimageHex: string; readonly sha256: T.Digest; }
export interface OperationContract { readonly operation: string; readonly request: T.TypeName; readonly response: T.TypeName; readonly alternateResult?: T.TypeName; readonly event?: string; readonly validationOrder: ReadonlyArray<string>; readonly failureCodes: ReadonlyArray<T.ErrorCode>; readonly successSemantics: string; readonly idempotency: string; readonly scope?: string; readonly requestName?: string; readonly responseName?: string; readonly baselineOperation?: string; }
export declare class ContractError extends Error { constructor(code: T.ErrorCode, phase: T.Phase, reason: T.ErrorReason, details?: Partial<T.Error>); readonly publicError: T.Error; readonly code: T.ErrorCode; readonly phase: T.Phase; readonly reason: T.ErrorReason; readonly mutationState: T.MutationState; readonly retryability: T.Retryability; }
export declare function publicError(error: unknown): T.Error;
export declare const version: '0.3.7';
export declare const wireVersions: ReadonlyArray<T.WireVersion>;
export declare const compiledOperationsVersion: 'operations/v2';
export declare const operationContracts: { readonly [W in T.WireVersion]: ReadonlyArray<OperationContract> };
export declare const canvasEventRules: Readonly<Record<'WorldConnectionInventoryChanged' | 'WorldConnectionSelectionChanged' | 'ActiveWorldChanged' | 'ObjectInventoryChanged' | 'ObjectCreated' | 'ObjectNameChanged' | 'ActiveObjectSelectionReplaced' | 'ObjectInspectionInvalidated' | 'AffectedObjectAnalysisReady' | 'AffectedObjectNotificationRequired' | 'TransactionAppliedPendingReadback' | 'TransactionVerified' | 'HistoryPositionChanged' | 'HistoryInventoryChanged', JSONValue>>;
export declare const errorPrecedence: JSONValue;
export declare const ownership: Readonly<Record<T.WireVersion, { readonly domainOwner: string; readonly mutationCaller: string | null }>>;
export declare const digestProfile: JSONValue;
export declare const schemaInventory: ReadonlyArray<T.TypeName>;
export declare const schemaBundle: { readonly $schema: string; readonly $id: string; readonly definitions: Readonly<Record<T.TypeName, JSONValue>> };
export declare const providerGates: JSONValue;
export declare function decodeRawJSON(bytes: Uint8Array): JSONValue;
export declare function snapshotJSON(value: unknown): JSONValue;
export declare function assertPureJSON(value: unknown): void;
export declare function deepFreeze<V>(value: V): Readonly<V>;
export declare function validateType<N extends T.TypeName>(typeName: N, value: unknown): T.TypeMap[N];
export declare function assertType<N extends T.TypeName>(typeName: N, value: unknown): asserts value is T.TypeMap[N];
export declare function admitType<N extends T.TypeName>(typeName: N, bytes: Uint8Array): T.TypeMap[N];
export declare function validateCanvasEvent<N extends keyof typeof canvasEventRules>(typeName: N, value: unknown): T.TypeMap[N];
export declare function validateRequest<W extends T.WireVersion, O extends keyof T.OperationMap[W]>(wire: W, operation: O, value: unknown): T.OperationMap[W][O] extends { readonly request: infer Q } ? Q : never;
export declare function admitRequest<W extends T.WireVersion, O extends keyof T.OperationMap[W]>(wire: W, operation: O, bytes: Uint8Array): T.OperationMap[W][O] extends { readonly request: infer Q } ? Q : never;
export declare function validateResponse<W extends T.WireVersion, O extends keyof T.OperationMap[W]>(wire: W, operation: O, value: unknown): T.OperationMap[W][O] extends { readonly response: infer Q } ? Q : never;
export declare const validateBoundRequest: typeof validateRequest;
export declare function canonicalJSON(value: unknown): string;
export declare function project<K extends T.DigestKind>(kind: K, payload: unknown): T.ProjectionMap[K];
export declare function digestValue<K extends T.DigestKind>(kind: K, payload: unknown): DigestResult<T.ProjectionMap[K]>;
export declare function digestRaw<K extends T.DigestKind>(kind: K, bytes: Uint8Array): DigestResult<T.ProjectionMap[K]>;
export declare function projectField<K extends T.DigestKind, N extends T.TypeName>(kind: K, sourceType: N, source: unknown, field: keyof T.TypeMap[N]): T.ProjectionMap[K];
export declare function validateDigestBinding<K extends T.DigestKind>(kind: K, payload: unknown, providedDigest: T.Digest): DigestResult<T.ProjectionMap[K]>;
export interface RuntimeCompatibility { readonly compatible: boolean; readonly node: string; readonly icu: string; readonly unicode: string; readonly requiredUnicode: '17.0'; readonly persistentNameKeysAllowed: boolean; readonly [key: string]: JSONValue; }
export declare function runtimeCompatibility(): RuntimeCompatibility;
export declare function requireUnicode17(): RuntimeCompatibility;
export declare function validateNameSyntax(value: unknown): string;
export declare function normalizeName(value: unknown): { readonly displayName: string; readonly comparisonKey: string };
export declare function compareUTF16(a: string, b: string): number;
export declare function comparePosition(a: T.Position, b: T.Position): number;
export declare function boxCellCount(box: T.Box): bigint;
export declare function unionCellCount(boxes: ReadonlyArray<T.Box>): bigint;
export declare function validateExactEffects(operations: T.BuildOps, materials: T.MaterialMap, effects: T.Effects): void;
export declare function validateFactsCoverage(facts: unknown, coverage: unknown): T.TargetFacts;
export declare function validateStaticMaterials(materials: unknown, catalogue: unknown): T.MaterialMap;
export declare function validateWitnessCoherence(input: { readonly build: unknown; readonly finalEffects: unknown; readonly targetFacts: unknown; readonly safetyProfile: unknown; readonly catalogue: unknown; readonly witnesses: unknown }): { readonly coherent: true; readonly authenticityVerified: false; readonly providerAuthorization: 'NOT_RUN'; readonly worldWrites: 0 };









export type PlacementSettingField = 'frontGapCells' | 'forwardSearchCells' | 'lateralSearchCells' | 'verticalSearchCells';
export interface PlacementSettingDescriptor { readonly name: T.PlacementSettingName; readonly field: PlacementSettingField; readonly owner: string; readonly type: 'NonNegativeInt'; readonly scope: string; readonly editable: boolean; readonly default: number; readonly defaultAuthority: JSONValue; readonly nameAuthority: string; readonly meaning: string; readonly consequence: string; readonly whenUnsetOrInvalid: string; }
export interface PlacementInvariantDescriptor { readonly id: string; readonly owner: string; readonly switchable: false; readonly authority: JSONValue; readonly text: string; readonly whyNotSwitchable: string; readonly consequence: string; }
export interface HandshakeRequirement { readonly wires: ReadonlyArray<string>; readonly factProfiles: ReadonlyArray<string>; }
/** Exactly what this package advertises in ContractHandshake. */
export declare const contractHandshake: T.ContractHandshake;
export declare const legacyWireSuccessors: Readonly<Record<string, T.WireVersion>>;
/** Display/registry metadata only; a default is never applied by this package. */
export declare const placementSettingDescriptors: ReadonlyArray<PlacementSettingDescriptor>;
export declare const placementInvariants: ReadonlyArray<PlacementInvariantDescriptor>;
export declare function checkContractHandshake(advertised: unknown, required: HandshakeRequirement): { readonly result: 'HANDSHAKE_VERSION_MATCH'; readonly advertised: T.ContractHandshake };
/** Requires a peer that advertises the 0.3.1 package containing ReadSessionTurnDetails. */
export declare function checkSessionReadbackHandshake(advertised: unknown): { readonly result: 'HANDSHAKE_OPERATION_MATCH'; readonly advertised: T.ContractHandshake };
/** Requires a peer that advertises the 0.3.2 package containing the two current-build undo operations. */
export declare function checkSessionUndoHandshake(advertised: unknown): { readonly result: 'HANDSHAKE_OPERATION_MATCH'; readonly advertised: T.ContractHandshake };
/** Requires the 0.3.4 service recovery extension on both peers. */
export declare function checkUndoRecoveryHandshake(advertised: unknown): { readonly result: 'HANDSHAKE_OPERATION_MATCH'; readonly advertised: T.ContractHandshake };
/** Requires the 0.3.5 current-build entry operation on the session/v2 peer. */
export declare function checkBuildEntryHandshake(advertised: unknown): { readonly result: 'HANDSHAKE_OPERATION_MATCH'; readonly advertised: T.ContractHandshake };
/** Requires the exact session-authorization/v1 peer and package capability. */
export declare function checkSessionAuthorizationHandshake(advertised: unknown): { readonly result: 'HANDSHAKE_OPERATION_MATCH'; readonly advertised: T.ContractHandshake };
/** Fixture coherence only; Host authenticates the caller and reads its own durable issuance. */
export declare function validateOriginalBindingResponse(request: unknown, response: unknown): T.ReadOriginalBindingResponse;
/** Fixture coherence only; Adapter authenticates caller and queries the paired game. */
export declare function validateCurrentGrantResponse(request: unknown, response: unknown): T.VerifyCurrentGrantResponse;
/** Requires the separate original Session action issuance capability. */
export declare function checkSessionOperationAuthorizationHandshake(advertised: unknown): { readonly result: 'HANDSHAKE_OPERATION_MATCH'; readonly advertised: T.ContractHandshake };
/** Shape and correlation only; not authentication or freshness. */
export declare function validateOriginalSessionAuthorityResponse(request: unknown, response: unknown): T.ReadOriginalSessionAuthorityResponse;
/** Trusted inputs only: project separately issued Session actions after exact current grant correlation. */
export declare function projectSessionAuthorityProof(hostRequest: unknown, hostResponse: unknown, grantRequest: unknown, grantResponse: unknown): T.SessionAuthorityProof;
/** Pure fixture check using host-verified and Workshop-owned durable facts, never caller facts. */
export declare function validateBuildEntryContext(request: unknown, providerFacts: unknown): { readonly request: T.AdvanceCurrentBuildRequest; readonly replay: T.BuildEntryReplay; readonly stage: T.BuildEntryStage };
/** Correlates a typed build result to its request; provider authenticity remains external. */
export declare function validateBuildEntryResponse(request: unknown, response: unknown): T.AdvanceCurrentBuildResponse;
/** Pure fixture coherence check against a provider-owned durable pending Undo projection; not authentication. */
export declare function validateUndoRecoveryRecord(request: unknown, durableRecord: unknown, operation?: 'RecoverPendingUndo' | 'ReadPendingUndoResult'): T.UndoRecoveryRecord;
/** Pure request/response correlation; providers still authenticate service and durable state. */
export declare function validateUndoRecoveryResponse(wire: 'session/v2' | 'canvas/v4', operation: 'RecoverPendingUndo' | 'ReadPendingUndoResult', request: unknown, response: unknown): T.SessionRecoverPendingUndoResponse | T.CanvasUndoRecoveryResponse;
/** Requires world-adapter/v5; matching v4 peers fail before Prepare. */
export declare function checkScopedWorldHandshake(advertised: unknown): { readonly result: 'HANDSHAKE_OPERATION_MATCH'; readonly advertised: T.ContractHandshake };
export declare function validateScopedTransition(prepare: unknown, apply: unknown): { readonly prepare: T.ScopedPrepareRequest; readonly apply: T.ScopedApplyRequest };
export declare function projectScopedPreparedTransaction(result: unknown): T.ScopedPreparedTransaction;
export declare function admitPlacementSettings(stored: Readonly<Record<string, unknown>>, settingsRevision: unknown): T.PlacementSettings;
export declare function validateChoiceSelection(frame: unknown, request: unknown): T.InvokeActionRequest;
export declare function validateRegionInspection(inspection: unknown): T.RegionInspection;
export declare function projectPreparedTransaction(result: unknown): T.PreparedTransaction;
export * as interactionSurfaceV3 from '../../bindings/v4/interaction-surface-v3.js';
export * as worldAdapterV4 from '../../bindings/v4/world-adapter-v4.js';
export * as canvasV4 from '../../bindings/v4/canvas-v4.js';
export * as sessionV2 from '../../bindings/v4/session-v2.js';
export * as painterV3 from '../../bindings/v4/painter-v3.js';
export * as referenceBriefV2 from '../../bindings/v4/ReferenceBrief-v2.js';
export * as buildV2 from '../../bindings/v4/BUILD-V2.js';
export * as worldAdapterV5 from '../../bindings/v4/world-adapter-v5.js';
export * as sessionAuthorizationV1 from '../../bindings/v4/session-authorization-v1.js';
export * as sessionOperationAuthorizationV1 from '../../bindings/v4/session-operation-authorization-v1.js';
export * as operationsV2 from '../../bindings/v4/operations-v2.js';

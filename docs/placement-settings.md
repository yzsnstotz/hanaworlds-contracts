# C-canvas read-only placement settings (2.10.0)

`canvas/v7` minor 2 adds `ReadPlacementSettings`. Existing operations and fields are unchanged.
Import `ReadPlacementSettingsRequest`, `ReadPlacementSettingsResponse`, `PlacementSettingsReadback`,
`placementSettingsRead`, `readPlacementSettings`, and `createPlacementSettingsMock` from the package root.
The public fixture is `hanaworlds-contracts/fixtures/placement-settings`.

Send `contractVersion`, `requestId`, the current `sessionRef`, `worldRef` and exact `localContext`
obtained from the existing selection context. `localContext: null` permits an unbound read request,
but can never succeed. A successful `result` carries that Session/world/context and `placementSettings`:
`frontGapCells`, `forwardSearchCells`, `lateralSearchCells`, `verticalSearchCells`, `settingsRevision`.
`readPlacementSettings(request, response)` verifies consumer correlation and throws a named error on failure.

Current values come from the world's existing placementSettings synchronized to the currently effective
Canvas Config, not descriptor defaults. Plugin Config applies to all bound worlds; saving and reloading
activates it through the existing startup synchronization. This read never synchronizes or repairs policy.
Missing, malformed or unsynchronized settings fail with `CAPABILITY_UNAVAILABLE / POLICY_UNAVAILABLE`.
Unknown Session fails `SESSION_NOT_FOUND`; known unbound Session fails `WORLD_NOT_BOUND`; stale or
cross-Session/world/context/connection fails `CURRENT_WORLD_MISMATCH`; a settings change during the
read fails `STALE_REVISION`. Unreachable connection errors are `ADAPTER_UNAVAILABLE`,
`CONNECTION_NOT_FOUND`, `PAYLOAD_VERSION_MISMATCH`, or `READBACK_FAILED` for failed/malformed reads.
Full declared errors are in `placementSettingsRead.errors`. Failures carry `result: null`,
`mutationState: NONE`, `transactionRef: null`; empty objects or empty success are forbidden.
The provider checks Session identity before and after asynchronous reads and rejects changes to
Session revision, world, selection, connection or settings. Repeated requests read fresh state.
Zero world writes, zero inspections, zero history creation, zero persistent changes. No session
creation, world selection, configuration mutation or expanded startup synchronization.

## Existing settings-page explanations

- `placementSettingDescriptors` already publishes name, owner, default, scope, meaning and consequence.
  Show `result.placementSettings` as current values, and the descriptor default separately.
- `placementInvariants` already publishes non-switchable rules and consequences. Show them read-only;
  zero search distance never disables engine protection, body safety or recoverable transactions.
- `SafetyProfile` / `safetyProfileFromConfirmedIntent` uses the player's confirmed intent/site rules;
  it has no body size. This read does not provide a safety profile or alter its source or semantics.
- `AvatarEnvelope` already distinguishes a world source's declared body size from `UNAVAILABLE`.
  It is not a connected player's position, yaw, posture or measurements. Existing WriteProfile and
  WorldSourceCapabilities carry it; unknown stays unknown. This operation does not fetch or fabricate
  it and leaves the world-source provider unchanged.

`placementSettingsRead.surface` publishes these explanations for consumers. The new documentation
and read operation close only C-canvas's missing current-value supply. Fixture/component verification
does not establish real UI operation or owner acceptance.

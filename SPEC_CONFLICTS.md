# Contracts v3 frozen input conflicts

Status: `SOURCE/FIXTURE · SPEC_CONFLICT / NOT_PROVEN`. This is a worker diagnosis for the PM. It does not modify or approve the immutable Stage 1 `2.0.0-rc.2` BlueMap.

## Handshake oracles

In approved `fixtures/candidate/closure-oracles-v3.json`, `WA-09-VALID` belongs to `world-adapter/v3` but its input is `consumerWire=providerWire=world-adapter/v2`. `CA-09-VALID` has the equivalent `canvas/v2` pair under a `canvas/v3` row. The v3 profile lists `world-adapter/v3` and `canvas/v3`, and the approved delta forbids silent v2 mutation fallback. The source validator therefore rejects these v3 row inputs with `UNSUPPORTED_VERSION`. The old v2/v2 positive case remains valid only through the separately exported v2 lane.

Minimum proposed planning correction: set each v3 positive input's consumer and provider wire to the matching v3 wire. Add or retain an explicit v3/v2 mixed pair negative case expecting `UNSUPPORTED_VERSION/NONE`. Update the two closure row descriptions that say “seven v2” to the current seven wire versions. Recompute every affected fixture, closure, candidate and manifest digest in a newly approved immutable BlueMap. The Adapter-v3 and Canvas-v3 handshake consumers are affected.

## Canvas event outer versions

Approved `CONTRACT_SCHEMA_PROFILE.json` keeps `ObjectNameChanged.common.contractVersion` and `HistoryPositionChanged.common.contractVersion` at `=canvas/v2`, while the six matching approved `canvas-events-v3.json` cases have `canvas/v3` outer envelopes and nested v3 receipt envelopes. Four are marked valid and fail strict schema admission; the two invalid cases can fail at the old version check instead of their intended cause.

Minimum proposed planning correction: change only these two **outer event** constants to `=canvas/v3`; preserve the four explicitly versioned v2 digest projection types (`AffectedProjection`, `AuthProjection`, `TxProjection`, `ReceiptProjection`) and their nineteen old digest values. Recompute the profile, fixture, closure, candidate and manifest digests under a new approval. Canvas-v3 event emitters and subscribed Shell/Luanti renderers are affected.

All eight cases remain `SPEC_CONFLICT/NOT_PROVEN` in `npm run test:v3`; this test exit code does not mean complete specification compliance. Do not admit the component or start dependent implementation from this candidate until the PM reconciles the frozen inputs.

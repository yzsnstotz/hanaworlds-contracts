# Named world source facts — 2.1.0

This minor only adds operations and types. Every 2.0.0 type, existing operation,
ownership row and digest rule is unchanged. New consumers use these named reads;
the existing Catalogue and ConfigEngineFacts in-process ports remain available.

| Contract | Wire | Operation | Result | Declared operation errors |
| --- | --- | --- | --- | --- |
| C-world-facts | world-facts/v1 | ReadCatalogue | CatalogueFacts | ADAPTER_UNAVAILABLE, WORLD_NOT_BOUND |
| C-world-facts | world-facts/v1 | ReadMaterialSources | MaterialSourceFacts | CAPABILITY_UNAVAILABLE |
| C-world-facts | world-facts/v1 | ReadEngineFacts | EngineFacts | ADAPTER_UNAVAILABLE |
| C-world-facts | world-facts/v1 | ReadWriteProfile | WriteProfile | ADAPTER_UNAVAILABLE, CAPABILITY_UNAVAILABLE |
| C-world-adapter | world-adapter/v8, minor 1 | ReadWorldSourceCapabilities | WorldSourceCapabilities | ADAPTER_UNAVAILABLE |
| C-world-inspection | world-inspection/v1 | ReadInspectionContext | InspectionContext | WORLD_NOT_BOUND, SESSION_NOT_FOUND |

The world source provides the first five; the host bridge provides inspection
context for the requested Session and World. Responses retain the strict
requestId/result-XOR-error envelope. Decode and currency errors also apply:
SCHEMA_INVALID, UNKNOWN_REQUIRED_FIELD, UNSUPPORTED_VERSION,
CURRENT_WORLD_MISMATCH, CATALOGUE_MISMATCH. Unknown facts never become defaults.

CatalogueFacts adds display names, nullable sRGB colours and a neutral orientation
index outside the unchanged Catalogue. MaterialSourceFacts carries the existing
material-sources/v2 snapshot and matching presentation. Texture bytes stay on the
in-process byte port. validateMaterialSourceFacts verifies the current connection,
Catalogue digest, engine revisions, source digest, row order/uniqueness, definition
revision and legal orientation; validateMaterialSources additionally verifies bytes.

EngineFacts declares WorldGeometry (geometry profiles, partition and
postWriteLighting), bounds, frame, supported write methods and write backend.
WorldSourceCapabilities adds StateProfile, the full configuration, write path
conclusions, guard coverage and avatar envelope, with owner = world-source.

StateProfile rules remain state-profile/v3: derivedFields are recomputed after a
write and use the readback value; preservedFields retain the before value;
clearedFields are absent after writing. The three sets are disjoint. A field in
none of the sets is not expected after writing. No engine field names are inferred.
postWriteLighting remains a declaration (REQUIRED or NOT_REQUIRED), never guessed.

writeBackend is an opaque {profileId, revision} selected by the source. Consumers
forward it unchanged. CompilationConfig is present exactly when the backend is
KNOWN, and carries that same backend. requireWriteProfileConfig refuses an
unavailable backend with CAPABILITY_UNAVAILABLE/validate/REQUIRED_FACT_UNKNOWN.
WriteMethods lists PER_CELL and/or REGION in enum order; omission means unsupported.

AvatarEnvelope declares one source-owned fixed size in grid units, or
UNAVAILABLE/NO_PUBLIC_SOURCE. The KNOWN form has only availability, basis and size;
no position, yaw, posture or player identity is representable. It is a declaration,
not a live player measurement. requireDeclaredAvatarEnvelope refuses an unavailable
size by name. The old ConfigEngineFacts avatar record stays fixed UNAVAILABLE.

WritePathConclusions contains path-level and per-material hasSideEffects and
hasPersistentState. Each is true, false or null (unknown). These are source-owned
conclusions about writing/restoring, not conclusions inferred from engine callbacks.
A placeable=true Catalogue material requires both conclusions false for the path
and that material; missing/unknown/dirty conclusions are refused. Other materials
may be non-placeable or unknown without a fabricated conclusion.

Re-read the current connection and Catalogue before each use. All facts bind to
worldRef, connectionRef and connectionIncarnationRef; catalogue-bearing facts
also bind to the current digest. The named response is bound to the request World.
No serialized value proves provider authenticity or live currentness.

The default ContractHandshake remains compatible with a 2.0.0 peer that lacks the
new wires. Consumers needing these reads must explicitly require world-facts/v1,
world-inspection/v1 or world-adapter major 8 minor >= 1 via the existing protocol
compatibility check. Package minor/version alone is insufficient evidence.

Examples: hanaworlds-contracts/fixtures/world-source-facts. Reusable fixture-only
provider: consumer/world-source-facts/mock.mjs (createWorldSourceFactsMock), with
all six reads and injectable declared errors. npm test runs both provider and
consumer conformance. npm run typecheck:world-facts checks a typed consumer.
Evidence is SOURCE/FIXTURE; actual world, host, persistence and UI are NOT_RUN.

Open-source base: canonicalize · 5.1.0 · Apache-2.0 ·
https://github.com/erdtman/canonicalize · unchanged registry dependency for RFC 8785
canonical JSON/digests. Its vendored 5.1.0 snapshot at
spec/context/supplement/sources/canonicalize remains test-fixture-only (D-6).
No dependency or upstream usage changes in this card.

## 2.14.0 resource declarations and failure origins

C-world-adapter and C-world-facts add optional `transportPolicy: WorldSourceTransportPolicy`
to ReadWorldSourceCapabilities, ReadEngineFacts and ReadWriteProfile. Old operations and
responses without this field remain valid. World-source owns values and enforcement; clients
must display supplied names, units, defaults, inclusive ranges, current values, meaning,
tradeoff and validation. Consumers must not invent a setting when the declaration is absent.
The existing settings surface consumes these declarations; UI implementation belongs to its owner.

ResourceBudgetDeclaration is closed. An uneditable descriptor has a fixed range and value.
Duplicate names and inconsistent ranges/current/default values are refused.
A result-wait budget expires into uncertainty, never cancellation or proof of no write.
A complete serialized JSON body budget applies to both directions. A batching estimate
reserve is not an envelope maximum. Metadata is not bounded by cells: exact serialization
must still be checked before dispatch and before returning results. Polling is not command retry.

Public Error gains optional FailureSource (owner world-source, operation, logical resource,
kind, nativeCode), with no paths, secrets, content, stack or exception text.
Absence, corruption, permission and IO differ. Missing diagnostics are unknown, never proof
of NOT_FOUND. Existing code, phase, mutationState and recovery semantics remain authoritative.
`fixtures/local/resource-policy.json` captures Adapter declarations and refusals from fresh
loopback/engine boundaries. Packed runtime/type consumers validate it with old fixtures.

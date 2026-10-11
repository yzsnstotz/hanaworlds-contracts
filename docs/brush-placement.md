# 2.2.0: region block digests and explicit placement geometry

This qualified additive minor follows the released 2.1.0 main (contracts-03).
It adds no operation, contract, wire major, geometry success variant or digest
kind. All old 2.0.0/2.1.0 legal decoded values retain their meaning and digests.
Old strict decoders reject values carrying either new field with
`UNKNOWN_REQUIRED_FIELD`; repin providers and consumers before sending them.

`RegionChunk.blockDigest?: Digest` binds precisely the canonical SDK block:

```js
const chunk = {chunkPos, block,
  blockDigest: digestValue('region-block', block).sha256};
```

`Digest` is the SHA-256 string; `digestValue` also returns diagnostic canonical
JSON and preimage fields, so store its `.sha256`, not the diagnostic object.
The preimage is `HanaWorlds|region-voxels/v2|region-block|` plus RFC 8785 canonical
JSON for the validated `RegionVoxelBlock`. Do not hash the chunk wrapper, a
compressed block or an engine's private serialization. Brush must return the
field on **every** CompileRegionBuild output chunk. SDK `validateType`, raw
admission, `validateResponse`, `validateCompiledRegionSet`, and enclosing
operations/commit validation verify it whenever present, rejecting mismatch as
`NON_CANONICAL_AMBIGUITY/validate/PAYLOAD_CHANGED` (retryability `NEVER`). An outer
operations digest never overrides this check. Absence preserves the old meaning;
the consumer does not invent a digest assertion. The existing region-operations
digest includes present optional fields. This field also travels when those
chunks are carried into Canvas region commits; ReadRegion/WriteRegion chunk
shapes are unchanged.

`PlacementFootprint.geometryProfile?: Ref` is an open, non-null profile name.
Both `canvas/v7 InspectPlacementRegion` and `world-adapter/v8 InspectRegion`
reference this shared type and can decode the field in 2.2.0. Existing width,
depth and height cell fields and the voxel TargetFacts success shape are
unchanged; a named non-voxel profile is expressible for refusal, not a newly
implemented geometry variant.

Neutral Canvas calls `validatePlacementRegionRequest(request, connection)`
before provider access, passing a fresh, verified **ReadLocalConnection** result.
It requires an explicit profile, checks the request World, connection reference,
connection incarnation and capabilities World, then checks supported success
geometry and `connection.capabilities.worldGeometry`:

- Missing request profile: `CAPABILITY_UNAVAILABLE/validate/REQUIRED_FACT_UNKNOWN`.
- Explicit unsupported profile, including an unknown Ref or a world-declared
  profile without a supported Canvas success shape:
  `CAPABILITY_GAP/validate/GEOMETRY_PROFILE_UNSUPPORTED`.
- Explicit voxel profile absent from worldGeometry (including null declaration):
  the same capability gap.
- Another World, capability World or connection incarnation:
  `CURRENT_WORLD_MISMATCH/validate/REVISION_CHANGED`.

These are preflight errors with mutationState `NONE`. Strict decoding remains
legal when the field is absent; **provider admission** fails closed and never
supplies a default voxel profile. `requireGeometryProfile` accepts an open Ref
and returns the capability gap for undeclared names rather than an enum decode
error; `GeometryProfile` for existing voxel data remains unchanged.

For success, call `validatePlacementRegionResponse(request, response, connection)`.
A REGION_INSPECTED outcome binds `inspection.targetFacts.geometryProfile` to the
request and the current world declaration, its World to the request, its anchor
to the request, and validates the inspection's existing frame/facts/evidence
bindings. Generic `validateBoundResponse` checks the same inspection correlation
when a profile is present; it continues to accept old legal missing-field inputs.

A Canvas consuming an **older published Adapter** must construct its exact
InspectRegion request from validated inputs using that published schema's
`widthCells`, `depthCells`, `heightCells`. It checks geometry through the Adapter's
implemented `ReadLocalConnection.capabilities.worldGeometry`. Do not add
geometryProfile to an older closed wire, reinterpret dimensions, or treat the
2.1.0 named world-facts/world-inspection operations as implemented Adapter ports.
This package defines protocol and pure SDK checks; it does not implement those
peers.

The impacted protocol minors are canvas 1, world-adapter 2, region-build 1 and
canvas-region 1. All protocol majors and existing capability ids are unchanged.
Consumers needing these fields require the corresponding minor explicitly.

Public `fixtures/brush-placement` contains a six-chunk compile output and an
explicit voxel placement request, current connection declaration and inspection.
`consumer/brush-placement/mock.mjs` provides fixture-only Brush/Canvas peers;
`consumer/brush-placement/index.ts` demonstrates type-safe consumer admission.
The older `fixtures/region` is retained unchanged as a compatibility oracle.

Validation: `npm test`, `npm run typecheck:brush-placement`,
`npm run verify:source`, and `tools/cross-version-brush-placement.mjs` with real
old-tag checkouts. All evidence is SOURCE/FIXTURE/PACK: brush-01 and canvas-01
must implement and validate against the formal `v2.2.0` tag separately. No real
world, GUI, provider acceptance or owner ACCEPTED is implied.

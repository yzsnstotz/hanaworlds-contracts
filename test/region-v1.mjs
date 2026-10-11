import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as a from 'hanaworlds-contracts';
import { buildRegionScenario } from './region-fixture.mjs';
const json = async spec => JSON.parse(await readFile(new URL(import.meta.resolve(spec))));
const base = await json('hanaworlds-contracts/fixtures/main');
const published = await json('hanaworlds-contracts/fixtures/region');
// JSON round trip: no shared references between summaries in mutated copies.
const S = () => JSON.parse(JSON.stringify(buildRegionScenario(a, base)));
const D = (k, v) => a.digestValue(k, v).sha256;
const code = c => ({ code: c });
// Validators return frozen null-prototype snapshots; compare JSON content.
const plain = x => JSON.parse(JSON.stringify(x, (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v));
const eq = (x, y) => assert.deepEqual(plain(x), plain(y));
const stone = { materialRef: 'fixture:stone', orientation: 0 }, air = { materialRef: base.request.catalogue.emptyMaterialRef, orientation: 0 };
const block = (runs, palette = [stone], size = [4, 1, 1], origin = [0, 0, 0]) => ({ profileVersion: 'region-voxels/v2', geometryProfile: 'voxel-grid/v1', origin, size, indexOrder: 'X_FASTEST_THEN_Y_THEN_Z', palette, runs });
let checks = 0; function test(name, run) { run(); console.log('ok', ++checks, name); }

test('same-major package and region fixture preserves content across gzip implementations', () => {
  a.checkContractsVersion(a.contractHandshake.contracts);
  const normalise = input => {
    const scenario = plain(input);
    const bytes = Buffer.from(scenario.snapshotGzipBase64, 'base64');
    const snapshot = scenario.commitResponse.result.snapshot;
    assert.equal(bytes.length, snapshot.compressedByteLength);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), snapshot.compressedSha256);
    assert.equal(gunzipSync(bytes).toString('utf8'), a.canonicalJSON(scenario.snapshotContent));
    a.validateRegionSnapshotContent(scenario.snapshotContent, snapshot, scenario.commitResponse.result.beforeSummary);
    // gzip has multiple valid encodings of the same content; contracts identify each by its own digest.
    delete scenario.snapshotGzipBase64;
    delete snapshot.compressedByteLength;
    delete snapshot.compressedSha256;
    return scenario;
  };
  eq(normalise(S()), normalise(published));
  assert.match(published.evidence, /^SOURCE\/FIXTURE/);
});
test('fill: block+palette decodes, expands in VoxelArea order (x, then y, then z) and encodes canonically', () => {
  const b = a.encodeRegionBlock({ origin: [-2, 0, -2], size: [20, 2, 3], palette: [stone, stone], indices: new Array(120).fill(1) });
  eq(b.runs, [[120, 0]]); eq(b.palette, [stone]);
  eq(a.regionBlockBox(b), { min: [-2, 0, -2], max: [17, 1, 0] });
  const s = S(); const e = a.expandRegionBlock(s.compileRequest.build.block);
  // index = x + sx*(y + sy*z): cell (x=6,y=1,z=0) is the first carved air cell.
  eq(e.palette[e.indices[6 + 20 * (1 + 2 * 0)]], air);
  assert.equal(a.encodeRegionBlock({ origin: [-2, 0, -2], size: [20, 2, 3], palette: e.palette, indices: e.indices }).runs.length, s.compileRequest.build.block.runs.length);
  assert.equal(D('region-block', b), D('region-block', a.encodeRegionBlock({ origin: [-2, 0, -2], size: [20, 2, 3], palette: [air, stone], indices: new Array(120).fill(1) })));
  a.validateRegionPalette(s.compileRequest.build.block, s.catalogue);
});
test('carve: the explicit empty material is distinct from UNSPECIFIED; unspecified cells and their extras are kept', () => {
  const before = { profileVersion: 'region-state/v2', worldRef: 'w', block: block([[4, 0]]), stateProfile: { profileVersion: 'state-profile/v3', derivedFields: ['param1'], preservedFields: [], clearedFields: ['inventory', 'metadata', 'timer'] },
    extras: [{ position: [1, 0, 0], state: { metadata: { k: 'v' } } }, { position: [2, 0, 0], state: { metadata: { k: 'v' } } }] };
  const carve = block([[1, 0], [1, null], [1, 0], [1, null]], [air]);
  const after = a.expectedRegionState(before, carve);
  eq(after.block.palette, [air, stone]);
  eq(after.block.runs, [[1, 0], [1, 1], [1, 0], [1, 1]]);
  eq(after.extras.map(x => x.position), [[1, 0, 0]]);
  assert.notEqual(D('region-block', carve), D('region-block', block([[4, 0]], [air])));
  assert.throws(() => a.validateType('RegionVoxelBlock', block([[4, null]])), code('SCHEMA_INVALID'));
  // A block names no material specially: palette legality, the empty material's orientation included,
  // is read from the world source's Catalogue.
  const cat = base.request.catalogue, odd = block([[4, 0]], [{ materialRef: 'ignore', orientation: 0 }]);
  a.validateType('RegionVoxelBlock', odd);
  assert.throws(() => a.validateRegionPalette(odd, cat), code('CATALOGUE_MISMATCH'));
  assert.ok(!cat.materials[cat.emptyMaterialRef].orientations.includes(1));
  assert.throws(() => a.validateRegionPalette(block([[4, 0]], [{ ...air, orientation: 1 }]), cat), code('UNSUPPORTED_MUTATION_SEMANTICS'));
  assert.throws(() => a.validateType('RegionState', { ...before, block: carve }), code('SCHEMA_INVALID'));
});
test('strict canonical decoding rejects ambiguous or malformed blocks', () => {
  for (const bad of [block([[3, 0]]), block([[2, 0], [2, 0]]), block([[4, 1]]), block([[2, 0], [2, 1]], [stone, air]),
    block([[4, 0]], [stone, air]), block([[1, 0]], [stone], [9007199254740991, 2, 1]), block([[2, 0]], [stone], [2, 1, 1], [9007199254740991, 0, 0])])
    assert.throws(() => a.validateType('RegionVoxelBlock', bad), code('SCHEMA_INVALID'));
  assert.throws(() => a.validateType('RegionVoxelBlock', { ...block([[4, 0]]), extra: 1 }), code('UNKNOWN_REQUIRED_FIELD'));
  assert.throws(() => a.validateType('RegionVoxelBlock', { ...block([[4, 0]]), profileVersion: 'region-voxels/v3' }), code('UNSUPPORTED_VERSION'));
  assert.throws(() => a.validateType('RegionVoxelBlock', { ...block([[4, 0]]), indexOrder: 'Z_FASTEST' }), code('SCHEMA_INVALID'));
  assert.throws(() => a.admitType('RegionVoxelBlock', '{"profileVersion":"region-voxels/v2","profileVersion":"region-voxels/v2"}'), code('SCHEMA_INVALID'));
});
test('catalogue legality: unknown node, illegal orientation and unknown static capability are rejected before any write', () => {
  const s = S(); const cat = s.catalogue;
  assert.throws(() => a.validateRegionPalette(block([[4, 0]], [{ materialRef: 'fixture:unknown', orientation: 0 }]), cat), code('CATALOGUE_MISMATCH'));
  assert.throws(() => a.validateRegionPalette(block([[4, 0]], [{ materialRef: 'fixture:stone', orientation: 3 }]), cat), code('UNSUPPORTED_MUTATION_SEMANTICS'));
  const unknown = structuredClone(cat); unknown.materials['fixture:stone'].placeable = null; unknown.materials['fixture:stone'].unknownFields = ['placeable'];
  assert.throws(() => a.validateRegionPalette(block([[4, 0]]), unknown), code('UNSUPPORTED_MUTATION_SEMANTICS'));
});
test('per-cell BUILD/V5 is retained unchanged beside region v1', () => {
  assert.ok(a.wireVersions.includes('BUILD/V5')); assert.equal(a.compiledOperationsVersion, 'operations/v4');
  eq(a.operationContracts['BUILD/V5'].map(o => o.operation), ['BuildDocument']);
  a.validateBuildProposalRequest(base.request);
  assert.equal(a.validateType('BuildProposal', base.request.proposal).decision, 'BUILD');
  assert.ok(a.protocolRequirement('BUILD/V5', ['BUILD/V5:per-cell-compile']).major === 5);
});
test('Painter region proposal keeps the same Session/brief/world and returns the block unchanged', () => {
  const s = S(); a.validateRegionProposalResponse(s.proposalRequest, s.proposalResponse);
  const altered = S(); altered.proposalResponse.result.build.block = a.encodeRegionBlock({ origin: [-2, 0, -2], size: [20, 2, 3], palette: [stone], indices: new Array(120).fill(0) });
  altered.proposalResponse.result.build.declaredBounds = a.regionBlockBox(altered.proposalResponse.result.build.block);
  altered.proposalResponse.result.buildDigest = D('region-build', altered.proposalResponse.result.build);
  assert.throws(() => a.validateRegionProposalResponse(altered.proposalRequest, altered.proposalResponse), code('TRANSACTION_CONFLICT'));
  const wrong = S(); wrong.proposalRequest.localContext = { ...wrong.proposalRequest.localContext, worldRef: 'other-world' };
  assert.throws(() => a.validateRegionProposalRequest(wrong.proposalRequest), code('CURRENT_WORLD_MISMATCH'));
  const brief = S(); brief.proposalRequest.referenceBriefDigest = '0'.repeat(64);
  assert.throws(() => a.validateRegionProposalRequest(brief.proposalRequest), e => ['MEDIA_DIGEST_MISMATCH', 'SCHEMA_INVALID'].includes(e.code));
  const refused = S(); refused.proposalResponse.result = null;
  refused.proposalResponse.error = { code: 'BUILD_INVALID', phase: 'validate', retryability: 'AFTER_NEW_FACTS', mutationState: 'NONE', transactionRef: null, causeCode: null, reason: 'INVALID_GEOMETRY' };
  a.validateRegionProposalResponse(refused.proposalRequest, refused.proposalResponse);
});
test('Brush compile: partition chunks equal the build exactly; UNSPECIFIED never becomes the empty material; cross-chunk', () => {
  const s = S(); a.validateCompiledRegionSet(s.compileRequest, s.compileResponse);
  assert.equal(s.compileResponse.result.projection.chunks.length, 6);
  const resign = x => { x.compileResponse.result.operationDigest = D('region-operations', x.compileResponse.result.projection); return x; };
  const carved = S(); const c = carved.compileResponse.result.projection.chunks[2];
  const e = a.expandRegionBlock(c.block); const idx = Array.from(e.indices); idx[idx.lastIndexOf(-1)] = e.palette.findIndex(p => p.materialRef === air.materialRef);
  c.block = a.encodeRegionBlock({ origin: c.block.origin, size: c.block.size, palette: e.palette, indices: idx });
  assert.throws(() => a.validateCompiledRegionSet(carved.compileRequest, resign(carved).compileResponse), code('BUILD_INVALID'));
  const dropped = S(); dropped.compileResponse.result.projection.chunks.pop();
  assert.throws(() => a.validateCompiledRegionSet(dropped.compileRequest, resign(dropped).compileResponse), e => ['BUILD_INVALID', 'SCHEMA_INVALID'].includes(e.code));
  const outside = S(); outside.compileResponse.result.projection.chunks[0].chunkPos = [5, 5, 5];
  assert.throws(() => a.validateCompiledRegionSet(outside.compileRequest, resign(outside).compileResponse), code('SCHEMA_INVALID'));
  const rev = S(); rev.compileResponse.result.projection.compilerRevision = 'other';
  assert.throws(() => a.validateCompiledRegionSet(rev.compileRequest, resign(rev).compileResponse), code('TRANSACTION_CONFLICT'));
  const digest = S(); digest.compileResponse.result.operationDigest = '0'.repeat(64);
  assert.throws(() => a.validateCompiledRegionSet(digest.compileRequest, digest.compileResponse), code('NON_CANONICAL_AMBIGUITY'));
});
test('Adapter read: loaded-then-known chunks bind digests; still UNKNOWN rejects the write', () => {
  const s = S(); a.validateRegionRead(s.readRequest, s.readResponse); a.requireKnownRegion(s.readResponse.result);
  assert.ok(s.readResponse.result.chunks.some(c => c.loadMethod === 'LOADED_ON_DEMAND'));
  const unknown = S(); Object.assign(unknown.readResponse.result.chunks[3], { availability: 'UNKNOWN', loadMethod: null, unknownReason: 'LOAD_FAILED', state: null, stateDigest: null });
  a.validateRegionRead(unknown.readRequest, unknown.readResponse);
  assert.throws(() => a.requireKnownRegion(unknown.readResponse.result), code('TARGET_FACTS_INCOMPLETE'));
  const noLoad = S(); noLoad.readResponse.result.chunks[0].loadMethod = null;
  assert.throws(() => a.validateRegionRead(noLoad.readRequest, noLoad.readResponse), code('SCHEMA_INVALID'));
  const missing = S(); missing.readResponse.result.chunks.pop();
  assert.throws(() => a.validateRegionRead(missing.readRequest, missing.readResponse), code('SCHEMA_INVALID'));
  const digest = S(); digest.readResponse.result.chunks[0].stateDigest = '0'.repeat(64);
  assert.throws(() => a.validateRegionRead(digest.readRequest, digest.readResponse), code('NON_CANONICAL_AMBIGUITY'));
  const world = S(); world.readResponse.result.localContext = { ...world.readResponse.result.localContext, connectionIncarnationRef: 'reopened' };
  assert.throws(() => a.validateRegionRead(world.readRequest, world.readResponse), code('CURRENT_WORLD_MISMATCH'));
});
test('Adapter write: per-chunk facts and lighting completion; partial success is never a commit', () => {
  const s = S(); const ok = a.validateRegionWrite(s.writeRequest, s.writeResponse);
  assert.equal(ok.allWritten, true); assert.equal(ok.committed, false);
  const partial = S(); Object.assign(partial.writeResponse.result.chunks[4], { status: 'NOT_WRITTEN', readbackDigest: null });
  assert.equal(a.validateRegionWrite(partial.writeRequest, partial.writeResponse).allWritten, false);
  const dark = S(); dark.writeResponse.result.lighting.status = 'NOT_COMPLETE';
  assert.equal(a.validateRegionWrite(dark.writeRequest, dark.writeResponse).allWritten, false);
  const bare = S(); bare.writeResponse.result.chunks[0].readbackDigest = null;
  assert.throws(() => a.validateRegionWrite(bare.writeRequest, bare.writeResponse), code('SCHEMA_INVALID'));
  const mixed = S(); mixed.writeRequest.purpose = 'RESTORE';
  assert.throws(() => a.validateRegionWrite(mixed.writeRequest, mixed.writeResponse), code('SCHEMA_INVALID'));
});
test('partition is the world source declaration carried by every region payload; any edge works, a mismatch is refused', () => {
  // A non-cubic, non-16 partition: the same scenario compiles, reads, writes and commits end to end.
  const odd = JSON.parse(JSON.stringify(buildRegionScenario(a, base, { partition: { edge: [8, 1, 2] } })));
  a.validateCompiledRegionSet(odd.compileRequest, odd.compileResponse);
  assert.ok(odd.compileResponse.result.projection.chunks.length > S().compileResponse.result.projection.chunks.length);
  a.validateRegionRead(odd.readRequest, odd.readResponse); a.validateRegionWrite(odd.writeRequest, odd.writeResponse);
  a.validateRegionCommit(odd.commitRequest, odd.commitResponse);
  const content = JSON.parse(gunzipSync(Buffer.from(odd.snapshotGzipBase64, 'base64')).toString('utf8'));
  eq(a.expectedRegionSummary(content, odd.commitRequest.operations), odd.commitResponse.result.expectedAfterSummary);
  // Brush must cut along the partition the request carries.
  const relabelled = S().compileResponse.result.projection; relabelled.partition = { edge: [8, 1, 2] };
  assert.throws(() => D('region-operations', relabelled), code('SCHEMA_INVALID'));
  const other = S(); other.compileResponse = odd.compileResponse;
  assert.throws(() => a.validateCompiledRegionSet(other.compileRequest, other.compileResponse), code('TRANSACTION_CONFLICT'));
  // The world source reads with the partition it was asked for, or the read is refused.
  const read = S(); read.readRequest.partition = { edge: [32, 32, 32] };
  assert.throws(() => a.validateRegionRead(read.readRequest, read.readResponse), code('TRANSACTION_CONFLICT'));
  // A write chunk outside its partition chunk is a geometry error.
  const write = S(); write.writeRequest.partition = { edge: [4, 4, 4] };
  assert.throws(() => a.validateRegionWrite(write.writeRequest, write.writeResponse), code('SCHEMA_INVALID'));
  assert.throws(() => a.validateType('Partition', { edge: [16, 0, 16] }), code('SCHEMA_INVALID'));
});
test('post-write lighting is checked only when the world source declares it', () => {
  const none = JSON.parse(JSON.stringify(buildRegionScenario(a, base, { postWriteLighting: 'NONE' })));
  assert.equal(a.validateRegionWrite(none.writeRequest, none.writeResponse).allWritten, true);
  a.validateRegionCommit(none.commitRequest, none.commitResponse);
  a.validateType('RegionUndoResult', none.undoResponse.result);
  // NONE carries no lighting fact; REQUIRED always carries one.
  const invented = S(); invented.writeResponse.result.postWriteLighting = 'NONE';
  assert.throws(() => a.validateRegionWrite(invented.writeRequest, invented.writeResponse), code('SCHEMA_INVALID'));
  const missing = S(); missing.commitResponse.result.lighting = null;
  assert.throws(() => a.validateRegionCommit(missing.commitRequest, missing.commitResponse), code('SCHEMA_INVALID'));
});
test('Canvas commit: one logical transaction, full readback summary equality, whole rollback, compressed snapshot', () => {
  const s = S(); const r = s.commitResponse.result;
  a.validateRegionCommit(s.commitRequest, s.commitResponse);
  const content = JSON.parse(gunzipSync(Buffer.from(s.snapshotGzipBase64, 'base64')).toString('utf8'));
  a.validateRegionSnapshotContent(content, r.snapshot, r.beforeSummary);
  eq(a.expectedRegionSummary(content, s.commitRequest.operations), a.validateType('RegionSummary', r.expectedAfterSummary));
  const mismatch = S(); mismatch.commitResponse.result.actualSummary.chunks[0].stateDigest = '0'.repeat(64);
  assert.throws(() => a.validateRegionCommit(mismatch.commitRequest, mismatch.commitResponse), code('SCHEMA_INVALID'));
  const rolled = S(); Object.assign(rolled.commitResponse.result, { status: 'ROLLED_BACK', actualSummary: rolled.commitResponse.result.beforeSummary });
  a.validateRegionCommit(rolled.commitRequest, rolled.commitResponse);
  const residue = S(); const after = residue.commitResponse.result.expectedAfterSummary;
  Object.assign(residue.commitResponse.result, { status: 'ROLLED_BACK', actualSummary: { ...residue.commitResponse.result.beforeSummary, chunks: residue.commitResponse.result.beforeSummary.chunks.map((c, i) => i === 0 ? after.chunks[0] : c) } });
  assert.throws(() => a.validateRegionCommit(residue.commitRequest, residue.commitResponse), code('SCHEMA_INVALID'));
  const unlit = S(); unlit.commitResponse.result.lighting.status = 'NOT_COMPLETE';
  assert.throws(() => a.validateRegionCommit(unlit.commitRequest, unlit.commitResponse), code('SCHEMA_INVALID'));
  const tampered = structuredClone(content); tampered.chunks[0].state.extras = [];
  assert.throws(() => a.validateRegionSnapshotContent(tampered, r.snapshot, r.beforeSummary), code('NON_CANONICAL_AMBIGUITY'));
  const world = S(); world.commitRequest.operations.worldRef = 'other-world';
  assert.throws(() => a.validateRegionCommit(world.commitRequest, world.commitResponse), code('CURRENT_WORLD_MISMATCH'));
});
test('Canvas whole-region Undo: same transaction, external edit conflict, verified restore of the before summary', () => {
  const s = S(); a.validateRegionUndo(s.undoRequest, s.undoResponse, s.commitResponse.result);
  const edited = S(); edited.undoResponse.result.preUndoSummary.chunks[0].stateDigest = '1'.repeat(64);
  assert.throws(() => a.validateRegionUndo(edited.undoRequest, edited.undoResponse, edited.commitResponse.result), code('UNDO_CONFLICT'));
  const notRestored = S(); notRestored.undoResponse.result.actualSummary = notRestored.commitResponse.result.actualSummary;
  assert.throws(() => a.validateRegionUndo(notRestored.undoRequest, notRestored.undoResponse, notRestored.commitResponse.result), code('READBACK_MISMATCH'));
  const rolled = S(); rolled.commitResponse.result.status = 'ROLLED_BACK'; rolled.commitResponse.result.actualSummary = rolled.commitResponse.result.beforeSummary;
  assert.throws(() => a.validateRegionUndo(rolled.undoRequest, rolled.undoResponse, rolled.commitResponse.result), code('UNDO_CONFLICT'));
  const same = S(); same.undoRequest.undoTransactionId = 'region-tx-1';
  assert.throws(() => a.validateRegionUndo(same.undoRequest, same.undoResponse, same.commitResponse.result), code('SCHEMA_INVALID'));
});
test('published fixture peer handshake satisfies the same package G3 declaration (regression)', async () => {
  const published = JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/region')), 'utf8')).peerHandshake;
  const declared = a.contractProtocols.find(p => p.protocol === 'world-adapter-region');
  const declaredCaps = a.regionCapabilities.map(c => c.id).filter(id => id.startsWith('world-adapter-region/v3:')).sort();
  assert.ok(declaredCaps.includes('world-adapter-region/v3:callback-free-write'));
  assert.deepEqual(published.protocols, [{ protocol: 'world-adapter-region', major: declared.major, minor: declared.minor }]);
  assert.deepEqual([...published.capabilities].sort(), declaredCaps);
  assert.equal(a.checkProtocolCompatibility(published, [a.protocolRequirement('world-adapter-region/v3', declaredCaps, declared.minor)]).result, 'PROTOCOL_COMPATIBLE');
});
test('protocol major + capability: same major consumable across patch/hash; wrong major or missing capability rejected', () => {
  const s = S(); const req = [a.protocolRequirement('world-adapter-region/v3', ['world-adapter-region/v3:load-then-know', 'world-adapter-region/v3:chunked-write'])];
  const first = a.checkProtocolCompatibility(s.peerHandshake, req);
  const patched = { ...s.peerHandshake, protocols: [{ protocol: 'world-adapter-region', major: 3, minor: 2 }], provenance: { packageName: 'fixture-adapter', packageVersion: '0.4.9', sourceRevision: 'f'.repeat(40), artifactDigest: 'a'.repeat(64) } };
  assert.equal(a.checkProtocolCompatibility(patched, req).result, first.result);
  assert.throws(() => a.checkProtocolCompatibility({ ...s.peerHandshake, protocols: [{ protocol: 'world-adapter-region', major: 4, minor: 0 }] }, req), code('UNSUPPORTED_VERSION'));
  assert.throws(() => a.checkProtocolCompatibility(s.peerHandshake, [a.protocolRequirement('world-adapter-region/v3', [], s.peerHandshake.protocols[0].minor + 1)]), code('UNSUPPORTED_VERSION'));
  assert.throws(() => a.checkProtocolCompatibility({ ...s.peerHandshake, capabilities: ['world-adapter-region/v3:chunked-read'] }, req), code('CAPABILITY_UNAVAILABLE'));
  assert.throws(() => a.checkProtocolCompatibility(s.peerHandshake, [a.protocolRequirement('canvas-region/v3')]), code('UNSUPPORTED_VERSION'));
  assert.throws(() => a.checkProtocolCompatibility(a.contractHandshake, req), code('UNSUPPORTED_VERSION'));
  assert.throws(() => a.checkProtocolCompatibility({ ...s.peerHandshake, protocols: [{ protocol: 'world-adapter-region', major: 0, minor: 9 }] }, [{ protocol: 'world-adapter-region', major: 0, minMinor: 0, capabilities: [] }]), code('SCHEMA_INVALID'));
  assert.throws(() => a.validateRequest('world-adapter-region/v3', 'ReadRegion', { ...s.readRequest, contractVersion: 'world-adapter-region/v4' }), code('UNSUPPORTED_VERSION'));
  assert.ok(a.contractProtocols.some(p => p.protocol === 'region-voxels' && p.major === 2));
  assert.match(a.digestValue('region-state', s.readResponse.result.chunks[0].state).preimageUtf8, /^HanaWorlds\|region-voxels\/v2\|region-state\|/);
  assert.match(a.protocolPolicy.rule, /provenance only/);
});
test('write-method self-description carries purpose, typical scale and prerequisites without thresholds', () => {
  const s = S(); for (const w of s.writeMethods) a.validateType('WriteMethodDescriptor', w);
  assert.throws(() => a.validateType('WriteMethodDescriptor', { ...s.writeMethods[1], maxCells: 4096 }), code('UNKNOWN_REQUIRED_FIELD'));
  assert.equal(a.placementSettingDescriptors.length, 4);
  const known = new Set(a.regionCapabilities.map(c => c.id));
  for (const w of s.writeMethods) for (const c of w.requiredCapabilities) assert.ok(known.has(c), c);
  assert.ok(a.regionInvariants.every(i => i.switchable === false));
  assert.ok(a.regionInvariants.some(i => i.id === 'REGION-UNSPECIFIED-IS-KEEP'));
});
console.log(`REGION V1 CONFORMANCE ${checks}/${checks} (SOURCE/FIXTURE; modelCalls=0 worldWrites=0)`);

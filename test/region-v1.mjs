import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
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
const stone = { nodeName: 'fixture:stone', param2: 0 }, air = { nodeName: 'air', param2: 0 };
const block = (runs, palette = [stone], size = [4, 1, 1], origin = [0, 0, 0]) => ({ profileVersion: 'region-voxels/v1', origin, size, indexOrder: 'X_FASTEST_THEN_Y_THEN_Z', palette, runs });
let checks = 0; function test(name, run) { run(); console.log('ok', ++checks, name); }

test('exact 0.5.4-rc.1 package and published region fixture equals the regenerated scenario', () => {
  assert.equal(a.version, '0.5.4-rc.1');
  eq(JSON.parse(JSON.stringify(S())), published);
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
test('carve: explicit air is distinct from UNSPECIFIED; unspecified cells and their extras are kept', () => {
  const before = { profileVersion: 'region-state/v1', worldRef: 'w', block: block([[4, 0]]), derivedLightMode: 'recompute-with-readback',
    extras: [{ position: [1, 0, 0], metadata: { k: 'v' }, inventory: {}, timer: null }, { position: [2, 0, 0], metadata: { k: 'v' }, inventory: {}, timer: null }] };
  const carve = block([[1, 0], [1, null], [1, 0], [1, null]], [air]);
  const after = a.expectedRegionState(before, carve);
  eq(after.block.palette, [air, stone]);
  eq(after.block.runs, [[1, 0], [1, 1], [1, 0], [1, 1]]);
  eq(after.extras.map(x => x.position), [[1, 0, 0]]);
  assert.notEqual(D('region-block', carve), D('region-block', block([[4, 0]], [air])));
  assert.throws(() => a.validateType('RegionVoxelBlock', block([[4, null]])), code('SCHEMA_INVALID'));
  assert.throws(() => a.validateType('RegionVoxelBlock', block([[4, 0]], [{ nodeName: 'ignore', param2: 0 }])), code('SCHEMA_INVALID'));
  assert.throws(() => a.validateType('RegionVoxelBlock', block([[4, 0]], [{ nodeName: 'air', param2: 1 }])), code('SCHEMA_INVALID'));
  assert.throws(() => a.validateType('RegionState', { ...before, block: carve }), code('SCHEMA_INVALID'));
});
test('strict canonical decoding rejects ambiguous or malformed blocks', () => {
  for (const bad of [block([[3, 0]]), block([[2, 0], [2, 0]]), block([[4, 1]]), block([[2, 0], [2, 1]], [stone, air]),
    block([[4, 0]], [stone, air]), block([[1, 0]], [stone], [9007199254740991, 2, 1]), block([[2, 0]], [stone], [2, 1, 1], [9007199254740991, 0, 0])])
    assert.throws(() => a.validateType('RegionVoxelBlock', bad), code('SCHEMA_INVALID'));
  assert.throws(() => a.validateType('RegionVoxelBlock', { ...block([[4, 0]]), extra: 1 }), code('UNKNOWN_REQUIRED_FIELD'));
  assert.throws(() => a.validateType('RegionVoxelBlock', { ...block([[4, 0]]), profileVersion: 'region-voxels/v2' }), code('UNSUPPORTED_VERSION'));
  assert.throws(() => a.validateType('RegionVoxelBlock', { ...block([[4, 0]]), indexOrder: 'Z_FASTEST' }), code('SCHEMA_INVALID'));
  assert.throws(() => a.admitType('RegionVoxelBlock', '{"profileVersion":"region-voxels/v1","profileVersion":"region-voxels/v1"}'), code('SCHEMA_INVALID'));
});
test('catalogue legality: unknown node, illegal param2 and unknown static capability are rejected before any write', () => {
  const s = S(); const cat = s.catalogue;
  assert.throws(() => a.validateRegionPalette(block([[4, 0]], [{ nodeName: 'fixture:unknown', param2: 0 }]), cat), code('CATALOGUE_MISMATCH'));
  assert.throws(() => a.validateRegionPalette(block([[4, 0]], [{ nodeName: 'fixture:stone', param2: 3 }]), cat), code('UNSUPPORTED_MUTATION_SEMANTICS'));
  const unknown = structuredClone(cat); unknown.nodes['fixture:stone'].hasCallbacks = null; unknown.nodes['fixture:stone'].unknownFields = ['hasCallbacks'];
  assert.throws(() => a.validateRegionPalette(block([[4, 0]]), unknown), code('UNSUPPORTED_MUTATION_SEMANTICS'));
});
test('per-cell BUILD/V3 is retained unchanged beside region v1', () => {
  assert.ok(a.wireVersions.includes('BUILD/V3')); assert.equal(a.compiledOperationsVersion, 'operations/v3');
  eq(a.operationContracts['BUILD/V3'].map(o => o.operation), ['BuildDocument']);
  a.validateBuildProposalRequest(base.request);
  assert.equal(a.validateType('BuildProposal', base.request.proposal).decision, 'BUILD');
  assert.ok(a.protocolRequirement('BUILD/V3', ['BUILD/V3:per-cell-compile']).major === 3);
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
test('Brush compile: mapblock chunks equal the build exactly; UNSPECIFIED never becomes air; cross-chunk', () => {
  const s = S(); a.validateCompiledRegionSet(s.compileRequest, s.compileResponse);
  assert.equal(s.compileResponse.result.projection.chunks.length, 6);
  const resign = x => { x.compileResponse.result.operationDigest = D('region-operations', x.compileResponse.result.projection); return x; };
  const carved = S(); const c = carved.compileResponse.result.projection.chunks[2];
  const e = a.expandRegionBlock(c.block); const idx = Array.from(e.indices); idx[idx.lastIndexOf(-1)] = e.palette.findIndex(p => p.nodeName === 'air');
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
  assert.ok(s.readResponse.result.chunks.some(c => c.loadMethod === 'LOADED_BY_EMERGE'));
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
  const declaredCaps = a.regionCapabilities.map(c => c.id).filter(id => id.startsWith('world-adapter-region/v1:')).sort();
  assert.ok(declaredCaps.includes('world-adapter-region/v1:callback-free-write'));
  assert.deepEqual(published.protocols, [{ protocol: 'world-adapter-region', major: declared.major, minor: declared.minor }]);
  assert.deepEqual([...published.capabilities].sort(), declaredCaps);
  assert.equal(a.checkProtocolCompatibility(published, [a.protocolRequirement('world-adapter-region/v1', declaredCaps, declared.minor)]).result, 'PROTOCOL_COMPATIBLE');
});
test('protocol major + capability: same major consumable across patch/hash; wrong major or missing capability rejected', () => {
  const s = S(); const req = [a.protocolRequirement('world-adapter-region/v1', ['world-adapter-region/v1:load-then-know', 'world-adapter-region/v1:chunked-write'])];
  const first = a.checkProtocolCompatibility(s.peerHandshake, req);
  const patched = { ...s.peerHandshake, protocols: [{ protocol: 'world-adapter-region', major: 1, minor: 2 }], provenance: { packageName: 'fixture-adapter', packageVersion: '0.4.9', sourceRevision: 'f'.repeat(40), artifactDigest: 'a'.repeat(64) } };
  assert.equal(a.checkProtocolCompatibility(patched, req).result, first.result);
  assert.throws(() => a.checkProtocolCompatibility({ ...s.peerHandshake, protocols: [{ protocol: 'world-adapter-region', major: 2, minor: 0 }] }, req), code('UNSUPPORTED_VERSION'));
  assert.throws(() => a.checkProtocolCompatibility(s.peerHandshake, [a.protocolRequirement('world-adapter-region/v1', [], s.peerHandshake.protocols[0].minor + 1)]), code('UNSUPPORTED_VERSION'));
  assert.throws(() => a.checkProtocolCompatibility({ ...s.peerHandshake, capabilities: ['world-adapter-region/v1:chunked-read'] }, req), code('CAPABILITY_UNAVAILABLE'));
  assert.throws(() => a.checkProtocolCompatibility(s.peerHandshake, [a.protocolRequirement('canvas-region/v1')]), code('UNSUPPORTED_VERSION'));
  assert.throws(() => a.checkProtocolCompatibility(a.contractHandshake, req), code('UNSUPPORTED_VERSION'));
  assert.throws(() => a.checkProtocolCompatibility({ ...s.peerHandshake, protocols: [{ protocol: 'world-adapter-region', major: 0, minor: 9 }] }, [{ protocol: 'world-adapter-region', major: 0, minMinor: 0, capabilities: [] }]), code('SCHEMA_INVALID'));
  assert.throws(() => a.validateRequest('world-adapter-region/v1', 'ReadRegion', { ...s.readRequest, contractVersion: 'world-adapter-region/v2' }), code('UNSUPPORTED_VERSION'));
  assert.ok(a.contractProtocols.some(p => p.protocol === 'region-voxels' && p.major === 1));
  assert.match(a.digestValue('region-state', s.readResponse.result.chunks[0].state).preimageUtf8, /^HanaWorlds\|region-voxels\/v1\|region-state\|/);
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

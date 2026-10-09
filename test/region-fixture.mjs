// Explicit public FIXTURE scenario for region-voxels/v1. Every peer value here
// (Painter result, Brush chunks, Adapter reads/writes, Canvas receipts) is a
// hand-built fixture, not output of a real peer, world or compressor run.
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
export function buildRegionScenario(a, base) {
  const D = (k, v) => a.digestValue(k, v).sha256;
  const r = base.request;
  const catalogue = structuredClone(r.catalogue);
  catalogue.nodes['fixture:dirt'] = { ...catalogue.nodes['fixture:stone'], definitionRevision: 'fixture-def-1' };
  const catalogueDigest = D('catalogue', catalogue);
  const localContext = r.localContext, worldRef = r.worldRef, sessionRef = r.sessionRef;
  const stone = { nodeName: 'fixture:stone', param2: 0 }, dirt = { nodeName: 'fixture:dirt', param2: 0 }, air = { nodeName: 'air', param2: 0 };
  // Build box x -2..17, y 0..1, z -2..0 crosses mapblocks x=-1,0,1 and z=-1,0.
  const origin = [-2, 0, -2], size = [20, 2, 3];
  const n = size[0] * size[1] * size[2];
  const indices = Array.from({ length: n }, (_, i) => {
    const x = i % size[0], y = Math.floor(i / size[0]) % size[1], z = Math.floor(i / (size[0] * size[1]));
    if (y === 1 && x >= 6 && x <= 9) return 2;      // explicit air carve
    if (y === 1 && z === 1 && x >= 12) return -1;    // UNSPECIFIED: keep the world
    return y === 0 ? 0 : 1;                          // stone floor, dirt top
  });
  const block = a.encodeRegionBlock({ origin, size, palette: [stone, dirt, air], indices });
  const build = { contractVersion: 'region-build/v1', documentId: 'region-doc-1', coordinateSpace: 'WORLD_NODE', worldRef, catalogueDigest, block, declaredBounds: a.regionBlockBox(block) };
  const proposalRequest = { contractVersion: 'painter-region/v2', sessionRef, requestId: 'painter-region-1', worldRef, turnRevision: r.turnRevision,
    invocationId: r.invocationId, intent: r.intent, intentDigest: r.intentDigest, referenceBrief: r.referenceBrief, referenceBriefDigest: r.referenceBriefDigest,
    catalogue, catalogueDigest, proposal: { decision: 'REGION', block }, localContext };
  const proposalResponse = { contractVersion: 'painter-region/v2', requestId: 'painter-region-1', result: { invocationId: r.invocationId, build, buildDigest: D('region-build', build) }, error: null };
  const compileRequest = { contractVersion: 'region-build/v1', sessionRef, requestId: 'compile-region-1', worldRef, build, buildDigest: D('region-build', build), catalogue, catalogueDigest, compilerRevision: 'fixture-brush-region-1', localContext };
  // Reference mapblock split standing in for Brush output (FIXTURE).
  const expanded = a.expandRegionBlock(block);
  const cut = box => {
    const [sx, sy, sz] = [0, 1, 2].map(k => box.max[k] - box.min[k] + 1); const out = [];
    for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) {
      const p = [x + box.min[0], y + box.min[1], z + box.min[2]];
      out.push(expanded.indices[(p[0] - origin[0]) + size[0] * ((p[1] - origin[1]) + size[1] * (p[2] - origin[2]))]);
    }
    return { size: [sx, sy, sz], indices: out };
  };
  const chunks = a.regionChunksOfBox(build.declaredBounds).map(({ chunkPos, box }) => {
    const c = cut(box);
    return c.indices.some(v => v !== -1) ? { chunkPos, block: a.encodeRegionBlock({ origin: box.min, size: c.size, palette: expanded.palette, indices: c.indices }) } : null;
  }).filter(Boolean);
  const projection = { contractVersion: 'region-operations/v1', buildDigest: compileRequest.buildDigest, compilerRevision: compileRequest.compilerRevision, worldRef, catalogueDigest, chunkEdge: 16, chunks };
  const boxes = chunks.map(c => a.regionBlockBox(c.block));
  const writeBounds = { min: [0, 1, 2].map(k => Math.min(...boxes.map(b => b.min[k]))), max: [0, 1, 2].map(k => Math.max(...boxes.map(b => b.max[k]))) };
  const compileResponse = { contractVersion: 'region-build/v1', requestId: 'compile-region-1', result: { projection, operationDigest: D('region-operations', projection), writeBounds }, error: null };
  // Adapter read before writing: each chunk loaded (or emerged) and known. One
  // grass-like cell carries metadata so restore needs more than node/param2.
  const stateOf = (box, withExtra) => ({ profileVersion: 'region-state/v1', worldRef,
    block: a.encodeRegionBlock({ origin: box.min, size: [0, 1, 2].map(k => box.max[k] - box.min[k] + 1), palette: [stone], indices: new Array((box.max[0] - box.min[0] + 1) * (box.max[1] - box.min[1] + 1) * (box.max[2] - box.min[2] + 1)).fill(0) }),
    extras: withExtra ? [{ position: [...box.min], metadata: { infotext: 'fixture sign' }, inventory: {}, timer: null }] : [], derivedLightMode: 'recompute-with-readback' });
  const readRequest = { contractVersion: 'world-adapter-region/v1', sessionRef, requestId: 'read-region-1', worldRef, box: writeBounds, purpose: 'BEFORE_IMAGE', localContext };
  const reads = a.regionChunksOfBox(writeBounds).map(({ chunkPos, box }, i) => {
    const state = stateOf(box, i === 0);
    return { chunkPos, box, availability: 'KNOWN', loadMethod: i === 1 ? 'LOADED_BY_EMERGE' : 'ALREADY_LOADED', unknownReason: null, state, stateDigest: D('region-state', state) };
  });
  const readResponse = { contractVersion: 'world-adapter-region/v1', requestId: 'read-region-1', result: { worldRef, box: writeBounds, chunks: reads, localContext }, error: null };
  const beforeByChunk = new Map(reads.map(c => [JSON.stringify(c.chunkPos), c.state]));
  const beforeStates = chunks.map(c => ({ chunkPos: c.chunkPos, state: (() => {
    const s = beforeByChunk.get(JSON.stringify(c.chunkPos)); const box = a.regionBlockBox(c.block);
    // Narrow the read state to the compiled chunk box (Canvas does the same).
    const e = a.expandRegionBlock(s.block); const [sx, sy] = [0, 1].map(k => e.box.max[k] - e.box.min[k] + 1); const idx = [];
    for (let z = box.min[2]; z <= box.max[2]; z++) for (let y = box.min[1]; y <= box.max[1]; y++) for (let x = box.min[0]; x <= box.max[0]; x++)
      idx.push(e.indices[(x - e.box.min[0]) + sx * ((y - e.box.min[1]) + sy * (z - e.box.min[2]))]);
    return { ...s, block: a.encodeRegionBlock({ origin: box.min, size: [0, 1, 2].map(k => box.max[k] - box.min[k] + 1), palette: e.palette, indices: idx }),
      extras: s.extras.filter(x => x.position.every((v, k) => v >= box.min[k] && v <= box.max[k])) };
  })() }));
  const afterStates = beforeStates.map((b, i) => ({ chunkPos: b.chunkPos, state: a.expectedRegionState(b.state, chunks[i].block) }));
  const writeRequest = { contractVersion: 'world-adapter-region/v1', sessionRef, requestId: 'write-region-1', worldRef, transactionId: 'region-tx-1', purpose: 'APPLY',
    writes: chunks.map((c, i) => ({ chunkPos: c.chunkPos, expectedCurrentDigest: D('region-state', beforeStates[i].state), ops: c.block, state: null })), localContext };
  const lighting = { status: 'COMPLETE', box: writeBounds, method: 'fixture:voxelmanip.calc_lighting+write_to_map' };
  const writeResponse = { contractVersion: 'world-adapter-region/v1', requestId: 'write-region-1', result: { transactionId: 'region-tx-1', worldRef, purpose: 'APPLY',
    chunks: afterStates.map(s => ({ chunkPos: s.chunkPos, status: 'WRITTEN', readbackDigest: D('region-state', s.state) })), lighting, localContext }, error: null };
  const snapshotContent = { profileVersion: 'region-snapshot-content/v1', worldRef, chunks: beforeStates.map(s => ({ chunkPos: s.chunkPos, state: s.state, stateDigest: D('region-state', s.state) })) };
  const beforeSummary = a.summarizeRegionStates(worldRef, beforeStates);
  const afterSummary = a.summarizeRegionStates(worldRef, afterStates);
  const compressed = gzipSync(Buffer.from(a.canonicalJSON(snapshotContent)), { level: 9, mtime: 0 });
  const snapshot = { profileVersion: 'region-snapshot/v1', contentDigest: D('region-snapshot-content', snapshotContent), beforeSummaryDigest: D('region-summary', beforeSummary),
    compression: 'gzip', compressedSha256: createHash('sha256').update(compressed).digest('hex'), compressedByteLength: compressed.length };
  const commitRequest = { contractVersion: 'canvas-region/v1', sessionRef, requestId: 'commit-region-1', worldRef, transactionId: 'region-tx-1', operations: projection,
    operationDigest: D('region-operations', projection), guarantee: 'RECOVERABLE_VERIFIED', localContext };
  const commitResult = { transactionId: 'region-tx-1', worldRef, status: 'VERIFIED', operationDigest: commitRequest.operationDigest, beforeSummary, expectedAfterSummary: afterSummary,
    actualSummary: afterSummary, snapshot, historyRevision: 'history-2', lighting, affectedObjectRefs: [], localContext };
  const commitResponse = { contractVersion: 'canvas-region/v1', requestId: 'commit-region-1', result: commitResult, error: null };
  const undoRequest = { contractVersion: 'canvas-region/v1', sessionRef, requestId: 'undo-region-1', worldRef, originTransactionId: 'region-tx-1', undoTransactionId: 'region-undo-1', expectedHistoryRevision: 'history-2', localContext };
  const undoResponse = { contractVersion: 'canvas-region/v1', requestId: 'undo-region-1', result: { originTransactionId: 'region-tx-1', undoTransactionId: 'region-undo-1', worldRef, status: 'VERIFIED',
    originBeforeSummaryDigest: D('region-summary', beforeSummary), originAfterSummaryDigest: D('region-summary', afterSummary), preUndoSummary: afterSummary, actualSummary: beforeSummary,
    historyRevision: 'history-3', lighting, localContext }, error: null };
  // FIXTURE Adapter peer advertising the package's own current world-adapter-region declaration
  // (minor and every world-adapter-region/v1 capability, incl. the G3 callback-free-write), so a
  // consumer that builds its peer from this fixture passes the package's G3 requirement. A per-cell
  // port additionally needs world-adapter/v7 with callback-free-write and write-path-state-facts.
  const regionAdapter = a.contractProtocols.find(p => p.protocol === 'world-adapter-region');
  const peerHandshake = { profileVersion: 'protocol-handshake/v1', component: 'fixture-adapter', protocols: [{ protocol: 'world-adapter-region', major: regionAdapter.major, minor: regionAdapter.minor }],
    capabilities: a.regionCapabilities.map(c => c.id).filter(id => id.startsWith('world-adapter-region/v1:')).sort(),
    provenance: { packageName: 'fixture-adapter', packageVersion: '0.4.0', sourceRevision: null, artifactDigest: null } };
  const writeMethods = [
    { method: 'PER_CELL', toolName: 'fixture_place_cells', purpose: 'Fine adjustment of individual cells through the existing per-cell BUILD path.', inputType: 'BuildProposal',
      typicalScale: 'A single cell up to a few hundred cells, e.g. a door, a window or touching up an edge.', scaleUnit: 'cells', requiredCapabilities: ['BUILD/V4:per-cell-compile'], unavailableReason: null },
    { method: 'REGION', toolName: 'fixture_write_region', purpose: 'Large fills and carves (terrain, flattening, digging) as one region block with explicit air for carving.', inputType: 'RegionProposal',
      typicalScale: 'Hundreds to millions of cells, e.g. levelling a plot or digging a valley; written per mapblock as one Canvas transaction.', scaleUnit: 'cells',
      requiredCapabilities: ['canvas-region/v1:single-logical-transaction', 'canvas-region/v1:whole-region-undo', 'region-build/v1:compile-mapblock-chunks', 'world-adapter-region/v1:load-then-know'], unavailableReason: null }
  ];
  return { evidence: 'SOURCE/FIXTURE: hand-built region-voxels/v1 scenario; no real Painter, Brush, Adapter, Canvas, Luanti world or durable store ran.',
    catalogue, proposalRequest, proposalResponse, compileRequest, compileResponse, readRequest, readResponse, writeRequest, writeResponse,
    snapshotContent, snapshotGzipBase64: compressed.toString('base64'), commitRequest, commitResponse, undoRequest, undoResponse, peerHandshake, writeMethods };
}

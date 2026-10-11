// G3: fact scope of the Catalogue placeable tag on the declared write path.
// SOURCE/FIXTURE: callback inventories below are explicit fixtures shaped after the
// Adapter's public G3 report (VoxeLibre air/stone); no registry or world ran here.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as a from 'hanaworlds-contracts';
import { buildRegionScenario } from './region-fixture.mjs';
const base = JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/main'))));
const D = (k, v) => a.digestValue(k, v).sha256;
const code = c => ({ code: c });
let checks = 0; function test(name, run) { run(); console.log('ok', ++checks, name); }
const HOOKS = {
  air: ['on_dig', 'on_punch'],                                   // pointable=false; player hooks only
  'fixture:stone': ['after_dig_node', 'on_dig', 'on_punch'],     // player hooks only (VoxeLibre-like)
  'fixture:chest': ['on_construct', 'on_destruct', 'on_metadata_inventory_put'],
  'fixture:sign': ['on_receive_fields'],
  'fixture:furnace': ['on_timer'],
};
function world({ global = [], hooks = HOOKS, publish } = {}) {
  const catalogue = structuredClone(base.request.catalogue);
  for (const n of Object.keys(hooks)) catalogue.materials[n] ??= { ...catalogue.materials['fixture:stone'] };
  const evidence = cat => ({ profileVersion: 'write-path-evidence/v2', scope: 'write-path-init/v1', writePath: 'CALLBACK_FREE_WRITE',
    catalogueDigest: D('catalogue', cat), globalWriteCallbacks: global,
    materials: Object.keys(hooks).sort().map(n => ({ materialRef: n, definitionRevision: cat.materials[n].definitionRevision, definedCallbacks: hooks[n] })) });
  // Adapter-side projection: publish exactly the derived facts (or a supplied override).
  const facts = a.writePathStateFacts(evidence(catalogue));
  for (const [n, f] of Object.entries(facts)) {
    const cap = catalogue.materials[n]; cap.placeable = f.placeable;
    cap.unknownFields = Object.keys(cap).filter(k => k !== 'unknownFields' && cap[k] === null).sort();
  }
  publish?.(catalogue);
  return { catalogue, evidence: evidence(catalogue), facts };
}
const stone = { materialRef: 'fixture:stone', orientation: 0 }, air = { materialRef: 'air', orientation: 0 };
const fillAndCarve = (palette = [stone, air]) => a.encodeRegionBlock({ origin: [0, 0, 0], size: [4, 1, 1], palette, indices: [0, 0, palette.length - 1, -1] });

test('scope is published: callback-free write path, callback classes, out-of-scope list and capabilities', () => {
  a.checkContractsVersion(a.contractHandshake.contracts);
  assert.equal(a.writePathStateScope.id, 'write-path-init/v1'); assert.equal(a.writePathStateScope.writePath, 'CALLBACK_FREE_WRITE');
  assert.ok(a.writePathStateScope.initializationCallbacks.includes('on_construct'));
  assert.ok(a.writePathStateScope.outOfScope.some(t => /ABM/.test(t)) && /UNDO_CONFLICT/.test(a.writePathStateScope.guards));
  const ids = new Set(a.regionCapabilities.map(c => c.id));
  for (const id of ['world-adapter/v8:callback-free-write', 'world-adapter-region/v3:callback-free-write', 'world-adapter/v8:write-path-state-facts']) assert.ok(ids.has(id), id);
  assert.ok(a.regionInvariants.some(i => i.id === 'MATERIAL-FACT-SCOPE' && i.switchable === false));
});
test('derivation: player-only hooks are out of scope; initialization/state callbacks or unknown inventories are never placeable', () => {
  const { facts } = world();
  assert.equal(facts.air.placeable, true);
  assert.equal(facts['fixture:stone'].placeable, true);
  assert.equal(facts['fixture:chest'].placeable, false);
  assert.equal(facts['fixture:sign'].placeable, null);
  assert.equal(facts['fixture:furnace'].placeable, false);
  const unknown = world({ hooks: { ...HOOKS, 'fixture:stone': null } }).facts['fixture:stone'];
  assert.equal(unknown.placeable, null);
  for (const global of [['register_on_mapblocks_changed'], null]) {
    const f = world({ global }).facts;
    assert.ok(Object.values(f).every(x => x.placeable === null));
  }
});
test('normal air+stone region fill/explicit carve and per-cell stone are admitted on verified facts', () => {
  const { catalogue, evidence } = world();
  const v = a.validateCatalogueWritePathFacts(catalogue, evidence);
  assert.deepEqual([...v.verified].sort(), ['air', 'fixture:stone']);
  const block = a.validateRegionPalette(fillAndCarve(), catalogue);
  a.validateStaticMaterials({ wall: stone }, catalogue);
  const before = { profileVersion: 'region-state/v2', worldRef: 'w', block: a.encodeRegionBlock({ origin: [0, 0, 0], size: [4, 1, 1], palette: [stone], indices: [0, 0, 0, 0] }), extras: [], stateProfile: { profileVersion: 'state-profile/v3', derivedFields: ['param1'], preservedFields: [], clearedFields: ['inventory', 'metadata', 'timer'] } };
  const after = a.expectedRegionState(before, block);
  assert.deepEqual(a.expandRegionBlock(after.block).palette.map(p => p.materialRef), ['air', 'fixture:stone']);
});
test('unknown or side-effecting initialization rejects before any write; UNKNOWN is not defaulted to false', () => {
  const { catalogue } = world();
  assert.throws(() => a.validateRegionPalette(fillAndCarve([{ materialRef: 'fixture:chest', orientation: 0 }, air]), catalogue), code('UNSUPPORTED_MUTATION_SEMANTICS'));
  assert.throws(() => a.validateStaticMaterials({ s: { materialRef: 'fixture:sign', orientation: 0 } }, catalogue), code('UNSUPPORTED_MUTATION_SEMANTICS'));
  const unknown = world({ hooks: { ...HOOKS, 'fixture:stone': null } }).catalogue;
  assert.equal(unknown.materials['fixture:stone'].placeable, null);
  assert.throws(() => a.validateRegionPalette(fillAndCarve(), unknown), code('UNSUPPORTED_MUTATION_SEMANTICS'));
  const global = world({ global: ['register_on_mapblocks_changed'] }).catalogue;
  assert.throws(() => a.validateRegionPalette(fillAndCarve([air]), global), code('UNSUPPORTED_MUTATION_SEMANTICS'));
});
test('a Catalogue looser than its inventory, off-revision or for another Catalogue is refused', () => {
  const looser = world({ publish: c => { c.materials['fixture:chest'].placeable = true; c.materials['fixture:chest'].unknownFields = []; } });
  const ev = { ...looser.evidence, catalogueDigest: D('catalogue', looser.catalogue) };
  assert.throws(() => a.validateCatalogueWritePathFacts(looser.catalogue, ev), code('CATALOGUE_MISMATCH'));
  const uncovered = world(); const ev2 = { ...uncovered.evidence, materials: uncovered.evidence.materials.filter(n => n.materialRef !== 'fixture:stone') };
  assert.throws(() => a.validateCatalogueWritePathFacts(uncovered.catalogue, ev2), code('CATALOGUE_MISMATCH'));
  const rev = world(); const ev3 = structuredClone(rev.evidence); ev3.materials.find(n => n.materialRef === 'air').definitionRevision = 'other-def';
  assert.throws(() => a.validateCatalogueWritePathFacts(rev.catalogue, ev3), code('CATALOGUE_MISMATCH'));
  const other = world(); assert.throws(() => a.validateCatalogueWritePathFacts(other.catalogue, { ...other.evidence, catalogueDigest: '0'.repeat(64) }), code('NON_CANONICAL_AMBIGUITY'));
  const strict = world({ publish: c => { c.materials['fixture:stone'].placeable = null; c.materials['fixture:stone'].unknownFields = ['placeable']; } });
  const ev4 = { ...strict.evidence, catalogueDigest: D('catalogue', strict.catalogue) };
  assert.deepEqual([...a.validateCatalogueWritePathFacts(strict.catalogue, ev4).stricter], ['fixture:stone']);
});
test('the write path and fact scope are required capabilities; missing capability or wrong major rejects', () => {
  const caps = ['world-adapter-region/v3:callback-free-write', 'world-adapter/v8:callback-free-write', 'world-adapter/v8:write-path-state-facts'];
  const peer = { profileVersion: 'protocol-handshake/v1', component: 'fixture-adapter', protocols: [{ protocol: 'world-adapter', major: 8, minor: 0 }, { protocol: 'world-adapter-region', major: 3, minor: 0 }],
    capabilities: caps, provenance: { packageName: 'fixture-adapter', packageVersion: '0.6.2', sourceRevision: null, artifactDigest: null } };
  // ProtocolRequirements are ordered by protocol name (UTF-16).
  const req = [a.protocolRequirement('world-adapter/v8', ['world-adapter/v8:callback-free-write', 'world-adapter/v8:write-path-state-facts']), a.protocolRequirement('world-adapter-region/v3', ['world-adapter-region/v3:callback-free-write'])];
  assert.equal(a.checkProtocolCompatibility(peer, req).result, 'PROTOCOL_COMPATIBLE');
  assert.throws(() => a.checkProtocolCompatibility({ ...peer, capabilities: caps.slice(0, 2) }, req), code('CAPABILITY_UNAVAILABLE'));
  assert.throws(() => a.checkProtocolCompatibility({ ...peer, protocols: [{ protocol: 'world-adapter', major: 9, minor: 0 }, peer.protocols[1]] }, req), code('UNSUPPORTED_VERSION'));
  assert.ok(a.contractProtocols.some(p => p.protocol === 'world-adapter-region' && p.major === 3 && p.minor === 0));
});
test('later independent changes are not claimed absent: full-state readback differs and same-transaction Undo conflicts', () => {
  const s = JSON.parse(JSON.stringify(buildRegionScenario(a, base)));
  const commit = s.commitResponse.result; const chunk = s.snapshotContent.chunks[0];
  const after = a.expectedRegionState(chunk.state, s.commitRequest.operations.chunks[0].block);
  // An out-of-scope engine process or player later attaches state to a written cell.
  const changed = { ...after, extras: [{ position: after.block.origin, state: { metadata: { owner: 'abm' } } }] };
  assert.notEqual(D('region-state', changed), D('region-state', after));
  s.undoResponse.result.preUndoSummary.chunks[0].stateDigest = D('region-state', changed);
  assert.throws(() => a.validateRegionUndo(s.undoRequest, s.undoResponse, commit), code('UNDO_CONFLICT'));
});
test('ContractHandshake is same-major; protocol interop across patches is decided only by protocol major + capabilities', () => {
  const at = v => ({ ...a.contractHandshake, contracts: 'hanaworlds-contracts@' + v });
  a.checkContractHandshake(a.contractHandshake); a.checkBuildProposalHandshake(a.contractHandshake);
  for (const v of ['2.0.0-dev.1', '2.0.0', '2.0.1', '2.6.0']) {
    assert.equal(a.checkContractHandshake(at(v)).result, 'HANDSHAKE_VERSION_MATCH', v);
    assert.equal(a.checkBuildProposalHandshake(at(v)).result, 'HANDSHAKE_OPERATION_MATCH', v);
  }
  for (const v of ['0.5.6', '1.2.0', '3.0.0', '3.0.0-rc.1']) {
    assert.throws(() => a.checkContractHandshake(at(v)), code('UNSUPPORTED_VERSION'), v);
    assert.throws(() => a.checkBuildProposalHandshake(at(v)), code('UNSUPPORTED_VERSION'), v);
  }
  assert.equal(a.sameContractLine, undefined);
  // A Brush on another package patch is consumable iff it advertises BUILD major 4 and the required capability.
  const brush = patch => ({ profileVersion: 'protocol-handshake/v1', component: 'fixture-brush', protocols: [{ protocol: 'BUILD', major: 5, minor: 0 }, { protocol: 'region-build', major: 2, minor: 0 }],
    capabilities: ['BUILD/V5:per-cell-compile', 'region-build/v2:compile-mapblock-chunks'], provenance: { packageName: 'hanaworlds-contracts', packageVersion: patch, sourceRevision: null, artifactDigest: null } });
  const req = [a.protocolRequirement('BUILD/V5', ['BUILD/V5:per-cell-compile'])];
  for (const v of ['0.5.0', '0.5.1', '0.5.2']) assert.equal(a.checkProtocolCompatibility(brush(v), req).result, 'PROTOCOL_COMPATIBLE');
  assert.throws(() => a.checkProtocolCompatibility({ ...brush('0.5.2'), capabilities: ['region-build/v2:compile-mapblock-chunks'] }, req), code('CAPABILITY_UNAVAILABLE'));
  assert.throws(() => a.checkProtocolCompatibility({ ...brush('0.5.2'), protocols: [{ protocol: 'BUILD', major: 6, minor: 0 }] }, req), code('UNSUPPORTED_VERSION'));
});
console.log(JSON.stringify({ evidence: 'SOURCE/FIXTURE', suite: 'write-path-g3', checks, modelCalls: 0, worldWrites: 0, realRuntime: 'NOT_RUN', realUI: 'NOT_RUN' }));

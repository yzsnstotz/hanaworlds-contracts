// SOURCE/FIXTURE only. rc.6 first-building region chain:
// rc.8: Interior migrated to painter/v3 (R1). rc.7: painter/v3, interaction-surface/v3, target-facts/v3 value set, ContractHandshake, typed SELECT_CHOICE.
// placement -> Adapter InspectRegion -> Canvas record -> Workshop/Exterior -> Brush -> Canvas Apply/Adapter Prepare recheck.
// Reference oracles below re-derive every expected outcome from the frozen rules; they are not provider code.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import canonicalize from '../context/supplement/sources/canonicalize/lib/canonicalize.js';

const get = async p => JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));
const profile = await get('CONTRACT_SCHEMA_PROFILE.json');
const closure = await get('CONTRACT_SEMANTIC_CLOSURE.json');
const fx = await get('fixtures/candidate/placement-region-chain-v4.json');
const registry = await get('SETTINGS_AND_INVARIANTS.json');
const round3 = await get('authority/USER_DECISION_FIRST_PLACEMENT_ROUND3_2026-10-02.json');
const sha = x => createHash('sha256').update(x).digest('hex');
const D = (kind, value) => sha('HanaWorlds|contracts@0.1.0|' + kind + '\n' + canonicalize(value));
const clone = x => structuredClone(x);
const eq = (a, b) => canonicalize(a) === canonicalize(b);

// ------------------------------------------------------------ strict schema (same DSL semantics as rc.5 checkers)
function validate(value, kind, path = '$') {
  if (kind.includes('|')) {
    const options = kind.split('|'); if (value === null && options.includes('null')) return;
    for (const option of options.filter(x => x !== 'null')) try { validate(value, option, path); return; } catch {}
    throw Error(path + ': no union variant ' + kind);
  }
  if (kind.startsWith('=')) { let x = kind.slice(1); try { x = JSON.parse(x); } catch {} assert.deepEqual(value, x, path); return; }
  const t = profile.types[kind]; assert(t, `unknown ${kind} at ${path}`);
  if (t.type === 'string') { assert.equal(typeof value, 'string', path); assert(value.isWellFormed(), path); if (t.minLength) assert(value.length >= t.minLength, path); if (t.pattern) assert(new RegExp(t.pattern).test(value), path); }
  else if (t.type === 'integer' || t.type === 'number') { assert.equal(typeof value, 'number', path); assert(Number.isFinite(value), path); if (t.type === 'integer') assert(Number.isSafeInteger(value), path); if (t.minimum !== undefined) assert(value >= t.minimum, path); if (t.exclusiveMinimum !== undefined) assert(value > t.exclusiveMinimum, path); }
  else if (t.type === 'boolean') assert.equal(typeof value, 'boolean', path);
  else if (t.type === 'enum') assert(t.values.includes(value), path + ' enum ' + value);
  else if (t.type === 'tuple') { assert(Array.isArray(value), path); assert.equal(value.length, t.items.length, path); t.items.forEach((x, i) => validate(value[i], x, `${path}[${i}]`)); }
  else if (t.type === 'array') { assert(Array.isArray(value), path); if (t.minItems) assert(value.length >= t.minItems, path); value.forEach((x, i) => validate(x, t.items, `${path}[${i}]`)); if (t.unique) assert.equal(new Set(value.map(canonicalize)).size, value.length, path); if (t.order === 'UTF16 ascending') assert.deepEqual(value, [...value].sort(), path); }
  else if (t.type === 'map') { assert(value && typeof value === 'object' && !Array.isArray(value), path); if (t.minEntries) assert(Object.keys(value).length >= t.minEntries, path); for (const [k, v] of Object.entries(value)) { validate(k, t.keyType, path + ' key'); validate(v, t.values, path + '.' + k); } }
  else if (t.type === 'object' || t.type === 'discriminated-object') { assert(value && typeof value === 'object' && !Array.isArray(value), path); const fields = t.type === 'object' ? t.fields : {...t.common, ...t.variants[value[t.discriminator]]}; assert(fields, path); assert.deepEqual(Object.keys(value).sort(), Object.keys(fields).sort(), path + ' exact fields'); for (const [k, v] of Object.entries(fields)) validate(value[k], v, path + '.' + k); }
  else throw Error(`unsupported type ${t.type}`);
}
function factsDomain(tf) {
  const n = x => x === null;
  if (tf.source === 'INSPECTED') return !n(tf.worldRef) && !n(tf.objectRef) && !n(tf.worldRevision) && !n(tf.objectRevision) && n(tf.buildDigest) && n(tf.planRevision);
  if (tf.source === 'PLANNED') return n(tf.worldRef) && n(tf.objectRef) && n(tf.worldRevision) && n(tf.objectRevision) && !n(tf.buildDigest) && !n(tf.planRevision);
  if ((tf.source === 'REGION_INSPECTED') !== (tf.profileVersion === 'target-facts/v3')) return false;
  if (tf.source === 'REGION_INSPECTED') return !n(tf.worldRef) && !n(tf.worldRevision) && n(tf.objectRef) && n(tf.objectRevision) && n(tf.buildDigest) && n(tf.planRevision);
  return false;
}
const ERR = (code, phase, reason) => ({code, phase, reason});
const opOf = (wire, operation) => { const o = profile.operations[wire].find(x => x.operation === operation); assert(o, wire + ' ' + operation); return o; };

// ------------------------------------------------------------ profile shape (C3 public values present)
assert.equal(profile.candidate, '3.0.0-rc.8');
{ const st = await get('PRODUCT_STRUCTURE.json'), ip = st.developmentCards.find(x => x.id === 'building-interior-painter');
  assert(ip.contributions.every(c => c.publicContractRef.startsWith('painter/v3')), 'Interior on painter/v3 (rc.8 R1)');
  assert(/building-interior-painter/.test(profile.compatibility.rc7.migration), 'Interior in the migration set (rc.8 R1)');
  assert.deepEqual(closure.currentProtocolVersions, profile.wireVersions); }
for (const w of ['interaction-surface/v3', 'painter/v3', 'world-adapter/v4', 'canvas/v4', 'BUILD/V2']) assert(profile.wireVersions.includes(w), w);
for (const w of ['interaction-surface/v2', 'painter/v2']) assert(!profile.wireVersions.includes(w) && !profile.operations[w], w + ' retired from the current wire set');
assert.equal(profile.types.CreateBuildPlanRequest.fields.contractVersion, '=painter/v3');
assert.equal(profile.types.InvokeActionRequest.fields.contractVersion, '=interaction-surface/v3');
assert.equal(profile.types.ActionProjection.fields.contractVersion, '=interaction-surface/v2', 'surface-action digest projection unchanged');
assert.equal(profile.types.TargetFacts.fields.profileVersion, '=target-facts/v2|=target-facts/v3');
assert.equal(profile.types.ActionDescriptor.fields.choices, 'ActionChoices|null');
assert.deepEqual(profile.types.ActionInput.variants.SELECT_CHOICE, {value: 'Ref'});
assert(profile.types.ContractHandshake && !profile.compatibility.rc6 && profile.compatibility.rc7 && !/brief/i.test(profile.compatibility.rc7.rule), 'rc.7 compatibility rule, not attributed to the brief');
assert(opOf('interaction-surface/v3', 'InvokeAction').failureCodes.includes('INVALID_SELECTION'));
assert.equal(profile.package, 'hanaworlds-contracts@0.3.0');
assert(profile.types.FactsSource.values.includes('REGION_INSPECTED'));
assert(profile.types.ActionInputKind.values.includes('PICK_WORLD_POINT'));
assert.deepEqual(profile.types.ActionInput.variants.PICK_WORLD_POINT, {pickRef: 'Ref'});
assert.equal(profile.types.CreateBuildPlanRequest.fields.regionInspection, 'RegionInspection|null');
assert.equal(profile.types.ApplyRecoverableCommitRequest.fields.regionInspectionBinding, 'RegionApplyBinding|null');
assert.deepEqual(Object.keys(profile.types.TargetFacts.fields).length, 17, 'TargetFacts fields unchanged');
for (const k of ['InspectRegionRequest', 'InspectRegionResponse', 'InspectPlacementRegionRequest', 'PlacementRegionInspection', 'RegionInspection', 'PlacementChoiceRequired', 'PlacementSettings', 'PlacementAnchor', 'PlacementFootprint', 'RegionApplyBinding']) assert(profile.types[k], k);
assert.equal(opOf('world-adapter/v4', 'InspectRegion').request, 'InspectRegionRequest');
assert.equal(opOf('canvas/v4', 'InspectPlacementRegion').request, 'InspectPlacementRegionRequest');
assert(opOf('world-adapter/v4', 'PrepareRecoverableTransaction').failureCodes.includes('SAFETY_INVARIANT_FAILED'));
assert(opOf('world-adapter/v4', 'PrepareRecoverableTransaction').validationOrder.some(x => x.includes('body recheck')));
assert(opOf('canvas/v4', 'ApplyRecoverableCommit').validationOrder.some(x => x.includes('region inspection binding')));
assert.deepEqual(Object.keys(profile.digest.projectionTypes).length, 20, 'no new digest kind');
assert.deepEqual(profile.types.PlacementSettingName.values, registry.settings.map(s => s.name).sort());

// ------------------------------------------------------------ unchanged rc.5 identities (pinned from rc.5 bytes)
const PIN = {'WAV4-SEAM-A': '2c6ae9b097ac2f35addcf08474ff978c1f2cb78a915e04981214b2f935e55635', 'CAV4-CURRENT-INVENTORY': '23ae21f22455868af6997563cc32026e012528eb6f327ba44d73029faad72f04'};
for (const [id, h] of Object.entries(PIN)) assert.equal(sha(canonicalize(closure.rows.find(r => r.id === id))), h, id + ' unchanged');
assert.equal(sha(await readFile(new URL('../fixtures/candidate/production-goldens.json', import.meta.url))), 'aec60187352ca8b1caabfa62e681dbbe49efef13fd734770a09c1fbe035299c0', 'nineteen production goldens unchanged');

// ------------------------------------------------------------ reference engine oracle (frozen search rules)
const AX = {'+X': [1, 0, 0], '-X': [-1, 0, 0], '+Y': [0, 1, 0], '-Y': [0, -1, 0], '+Z': [0, 0, 1], '-Z': [0, 0, -1]};
const FWD = ['+Z', '-X', '-Z', '+X'], RIGHT = ['+X', '+Z', '-X', '-Z'], ENTR = ['-Z', '+X', '+Z', '-X'];
function facing(yaw) {
  const TWO = 2 * Math.PI, y = yaw - TWO * Math.floor(yaw / TWO), q = y / (Math.PI / 2);
  if (q - Math.floor(q) === 0.5) return null;
  return ((Math.floor(q + 0.5) % 4) + 4) % 4;
}
const feet = p => p.map(v => Math.floor(v + 0.5));
const add = (...vs) => vs.reduce((a, b) => a.map((x, i) => x + b[i]));
const mul = (k, v) => v.map(x => k * x);
const inBox = (p, b) => p.every((x, i) => b.min[i] <= x && x <= b.max[i]);
const world = c => ({...fx.enginePrivate, ...(c.enginePrivateOverride ?? {})});
const catalogue = fx.validCases[0].materializedChain.painterRequest.catalogue;
function cellState(w, p) {
  let s = p[1] <= 0 ? {kind: 'OCCUPIED', nodeName: 'fixture:stone'} : {kind: 'AIR'};
  for (const o of w.overrides ?? []) if (inBox(p, o)) s = o.state;
  return s;
}
const isProtected = (w, p, principal) => (w.protected ?? []).some(b => b.principal === principal && inBox(p, b));
const bodyAt = (players, p) => players.some(pl => [0, 1, 2].every(i => p[i] - 0.5 < pl.pos[i] + pl.collisionbox[i + 3] && pl.pos[i] + pl.collisionbox[i] < p[i] + 0.5));
const seq = n => { const out = [0]; for (let i = 1; i <= n; i++) out.push(i, -i); return out; };
const seqV = n => { const out = [0]; for (let i = 1; i <= n; i++) out.push(-i, i); return out; };
function search({w, anchorCell, k, fp, settings, picked, principal, online}) {
  const f = AX[FWD[k]], r = AX[RIGHT[k]], Y = [0, 1, 0];
  const bLo = -Math.floor((fp.widthCells - 1) / 2), bHi = fp.widthCells - 1 + bLo;
  const aLo = picked ? 0 : settings.frontGapCells + 1, aHi = aLo + fp.depthCells - 1;
  const players = w.players.filter(p => online.includes(p.name));
  const reasons = new Set();
  for (let s = 0; s <= (picked ? 0 : settings.forwardSearchCells); s++) for (const t of seq(picked ? 0 : settings.lateralSearchCells)) for (const v of seqV(picked ? 0 : settings.verticalSearchCells)) {
    const cells = [], support = [], bad = new Set();
    for (let a = aLo; a <= aHi; a++) for (let b = bLo; b <= bHi; b++) {
      for (let c = 0; c < fp.heightCells; c++) cells.push(add(anchorCell, mul(a + s, f), mul(b + t, r), mul(c + v, Y)));
      support.push(add(anchorCell, mul(a + s, f), mul(b + t, r), mul(v - 1, Y)));
    }
    for (const p of cells) { const st = cellState(w, p); if (st.kind === 'UNKNOWN') bad.add('FRONT_AREA_UNKNOWN'); if (st.kind === 'OCCUPIED') bad.add('FRONT_AREA_OCCUPIED'); if (isProtected(w, p, principal)) bad.add('FRONT_AREA_PROTECTED'); if (bodyAt(players, p)) bad.add('FRONT_AREA_BODY_OCCUPIED'); }
    for (const p of support) { const st = cellState(w, p); if (st.kind === 'UNKNOWN') bad.add('FRONT_AREA_UNKNOWN'); else if (st.kind === 'AIR') bad.add('FRONT_AREA_NO_GROUND'); else { const wk = catalogue.nodes[st.nodeName]?.walkable; if (wk === null || wk === undefined) bad.add('FRONT_AREA_UNKNOWN'); else if (wk === false) bad.add('FRONT_AREA_NO_GROUND'); } }
    if (!bad.size) return {cells, support, entranceFacing: ENTR[k]};
    bad.forEach(x => reasons.add(x));
  }
  return {reasons: [...reasons].sort()};
}
const bbox = ps => ({min: [0, 1, 2].map(i => Math.min(...ps.map(p => p[i]))), max: [0, 1, 2].map(i => Math.max(...ps.map(p => p[i])))});
function adapterInspect({c, anchor, settings, fp, principal, online, sessionRef = 'fixture-session', worldRef = 'fixture-world'}) {
  const w = world(c);
  if (anchor.kind === 'PICKED_POINT') {
    const pick = (w.picks ?? []).find(p => p.pickRef === anchor.pickRef && p.sessionRef === sessionRef && p.worldRef === worldRef);
    if (!pick) return {error: ERR('PERMISSION_DENIED', 'authorize', 'IDENTITY_UNVERIFIED')};
    const k = facing(pick.pickerYaw); if (k === null) return {reasons: ['FACING_AMBIGUOUS']};
    return {...search({w, anchorCell: add(pick.node, [0, 1, 0]), k, fp, settings, picked: true, principal, online}), anchorPlayer: null, k};
  }
  let player;
  if (anchor.kind === 'NAMED_PLAYER') { if (!online.includes(anchor.engineActorName)) return {reasons: ['PLAYER_OFFLINE']}; player = anchor.engineActorName; }
  else {
    const rec = (w.relayRecords ?? []).find(r => r.invocationId === anchor.invocationId && r.sessionRef === sessionRef && r.worldRef === worldRef);
    if (rec) { if (!online.includes(rec.engineActorName)) return {reasons: ['PLAYER_OFFLINE']}; player = rec.engineActorName; }
    else if (online.length === 0) return {reasons: ['NO_ONLINE_PLAYER']};
    else if (online.length > 1) return {reasons: ['MULTIPLE_ONLINE_PLAYERS'], names: [...online].sort()};
    else player = online[0];
  }
  const pl = w.players.find(p => p.name === player); assert(pl, player);
  const k = facing(pl.yaw); if (k === null) return {reasons: ['FACING_AMBIGUOUS']};
  return {...search({w, anchorCell: feet(pl.pos), k, fp, settings, picked: false, principal, online}), anchorPlayer: player, feetCell: feet(pl.pos), k};
}
function checkRegionAgainstOracle(insp, o, expectedSearch) {
  assert(o.cells, 'oracle found a usable candidate');
  const sup = bbox(o.support), foot = bbox(o.cells);
  assert.deepEqual(foot, expectedSearch.chosenFootprint); assert.deepEqual(sup, expectedSearch.supportLayer);
  assert.equal(FWD[o.k], expectedSearch.forwardAxis); assert.equal(o.entranceFacing, expectedSearch.entranceFacing);
  if (expectedSearch.feetCell) assert.deepEqual(o.feetCell, expectedSearch.feetCell);
  assert.equal(o.anchorPlayer ?? null, expectedSearch.anchorPlayer ?? null);
  if (!insp) return;
  assert.deepEqual(insp.targetFacts.sampledBounds, bbox([...o.cells, ...o.support]));
  assert.equal(insp.entranceFacing, o.entranceFacing);
  assert.equal(insp.targetFacts.source, 'REGION_INSPECTED'); assert(factsDomain(insp.targetFacts));
  const sortP = ps => [...ps].sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  assert.deepEqual(sortP(insp.targetFacts.knownEmptyCells), sortP(o.cells));
  assert.deepEqual(sortP(insp.targetFacts.occupiedCells.map(x => x.position)), sortP(o.support));
  assert.equal(insp.targetFactsDigest, D('target-facts', insp.targetFacts));
  assert.equal(insp.targetFacts.frameDigest, D('frame', insp.frame));
  const cov = {profileVersion: 'coverage/v2', sampledBounds: insp.targetFacts.sampledBounds, sampledPositions: sortP([...o.cells, ...o.support])};
  assert.equal(insp.targetFacts.coverageDigest, D('coverage', cov));
}

// ------------------------------------------------------------ settings oracle (Canvas)
const SETTING_KEYS = {frontGapCells: 'placement.frontGapCells', forwardSearchCells: 'placement.forwardSearchCells', lateralSearchCells: 'placement.lateralSearchCells', verticalSearchCells: 'placement.verticalSearchCells'};
function canvasSettings(record) {
  const bad = [], out = {};
  for (const [field, name] of Object.entries(SETTING_KEYS)) { const v = record.stored[name]; if (!Number.isSafeInteger(v) || v < 0) bad.push(name); else out[field] = v; }
  if (bad.length) return {error: ERR('CAPABILITY_UNAVAILABLE', 'validate', 'POLICY_UNAVAILABLE'), unavailableSettings: bad.sort()};
  return {settings: {...out, settingsRevision: record.settingsRevision}};
}

// ------------------------------------------------------------ painter / brush / canvas apply / prepare oracles
function painterOracle(req, precedingPlanExists = true) {
  const tf = req.targetFacts;
  if (!factsDomain(tf)) return ERR('SCHEMA_INVALID', 'decode', 'INVALID_SHAPE');
  if (tf.source === 'REGION_INSPECTED') {
    if (req.painterId !== 'picture-blocks') return ERR('TARGET_REQUIRED', 'validate', 'SCOPE_DENIED');
    const ri = req.regionInspection; if (!ri) return ERR('TARGET_FACTS_INCOMPLETE', 'validate', 'REQUIRED_FACT_UNKNOWN');
    if (!eq(ri.targetFacts, tf) || ri.targetFactsDigest !== req.targetFactsDigest || D('target-facts', tf) !== req.targetFactsDigest || D('frame', ri.frame) !== tf.frameDigest || tf.worldRef !== req.worldRef) return ERR('TARGET_FACTS_STALE', 'validate', 'REVISION_CHANGED');
    return null;
  }
  if (req.regionInspection !== null) return ERR('SCHEMA_INVALID', 'decode', 'INVALID_SHAPE');
  if (tf.source === 'PLANNED' && !precedingPlanExists) return ERR('TARGET_REQUIRED', 'validate', 'REQUIRED_FACT_UNKNOWN');
  return null;
}
const decode021 = tf => ['INSPECTED', 'PLANNED'].includes(tf.source) && tf.profileVersion === 'target-facts/v2' ? null : ERR('SCHEMA_INVALID', 'decode', 'INVALID_SHAPE');
function brushOracle(req) {
  const tf = req.targetFacts;
  if (D('frame', req.build.coordinateFrame) !== tf.frameDigest) return ERR('NON_CANONICAL_AMBIGUITY', 'validate', 'PAYLOAD_CHANGED');
  if ((tf.source === 'INSPECTED' || tf.source === 'REGION_INSPECTED') && tf.worldRef !== req.worldRef) return ERR('TARGET_FACTS_STALE', 'validate', 'REVISION_CHANGED');
  return null;
}
const intersect = (a, b) => a.filter(p => b.some(q => eq(p, q)));
function canvasApplyOracle(req, records, currentWorldRevision) {
  const regionRecs = records.filter(r => r.outcome.outcome === 'REGION_INSPECTED');
  const b = req.regionInspectionBinding;
  if (!b) return regionRecs.some(r => r.outcome.inspection.targetFactsDigest === req.operations.targetFactsDigest) ? ERR('PERMISSION_DENIED', 'authorize', 'IDENTITY_UNVERIFIED') : null;
  const rec = regionRecs.find(r => r.inspectionId === b.inspectionId && r.worldRef === req.worldRef && r.sessionRef === req.sessionRef && r.actorRef === req.actorRef);
  if (!rec) return ERR('PERMISSION_DENIED', 'authorize', 'IDENTITY_UNVERIFIED');
  const insp = rec.outcome.inspection;
  const ok = D('build', b.build) === req.operations.buildDigest && b.build.targetFactsDigest === insp.targetFactsDigest && req.operations.targetFactsDigest === insp.targetFactsDigest && D('frame', b.build.coordinateFrame) === req.operations.frameDigest && D('frame', insp.frame) === req.operations.frameDigest &&
    b.build.witnesses.filter(w => w.predicate === 'PROTECTION' || w.predicate === 'BODY_CLEARANCE').every(w => eq(w.facts.evidence, insp.evidence) && (w.predicate === 'PROTECTION' ? eq(w.facts.protectedPositions, intersect(insp.protectedPositions, w.facts.positions)) : eq(w.facts.bodyOccupiedPositions, intersect(insp.bodyOccupiedPositions, w.facts.positions))));
  if (!ok) return ERR('PERMISSION_DENIED', 'authorize', 'IDENTITY_UNVERIFIED');
  if (insp.targetFacts.worldRevision !== currentWorldRevision || req.expectedWorldRevision !== currentWorldRevision) return ERR('STALE_REVISION', 'validate', 'REVISION_CHANGED');
  return null;
}
function prepareOracle(req, enginePrivateAtPrepare, principal, online) {
  const w = {...fx.enginePrivate, ...(enginePrivateAtPrepare ?? {})};
  const cells = req.operations.effects.map(e => e.position);
  if (cells.some(p => isProtected(w, p, principal))) return ERR('PERMISSION_DENIED', 'authorize', 'SCOPE_DENIED');
  const players = enginePrivateAtPrepare?.players ?? w.players.filter(p => online.includes(p.name));
  if (cells.some(p => bodyAt(players, p))) return ERR('SAFETY_INVARIANT_FAILED', 'validate', 'SCOPE_DENIED');
  return null;
}
function releaseOracle(c) {
  if (c.principalAllowedActions && !c.principalAllowedActions.includes('INSPECT')) return ERR('PERMISSION_DENIED', 'authorize', 'SCOPE_DENIED');
  if (/REVOKED-BEFORE-RELEASE/.test(c.id)) return ERR('AUTHORIZATION_REVOKED', 'authorize', 'GRANT_REVOKED');
  return null;
}
function placementResponseRule(resp) {
  validate(resp, 'PlacementRegionInspection');
  assert.equal((resp.result === null) + (resp.error === null), 1, 'exactly one of result/error');
  const named = resp.error && resp.error.code === 'CAPABILITY_UNAVAILABLE' && resp.error.reason === 'POLICY_UNAVAILABLE';
  assert.equal(resp.unavailableSettings !== null, Boolean(named), 'unavailableSettings iff POLICY_UNAVAILABLE');
  const ch = resp.result?.outcome === 'PLACEMENT_CHOICE_REQUIRED' ? resp.result.choice : null;
  if (ch) { assert.equal(ch.candidatePlayerNames !== null, ch.reasons.includes('MULTIPLE_ONLINE_PLAYERS')); assert.deepEqual(ch.options, ch.reasons.includes('NO_ONLINE_PLAYER') ? ['PICK_WORLD_POINT'] : ['NAME_PLAYER', 'PICK_WORLD_POINT']); }
}

// ------------------------------------------------------------ typed choice (F3) and handshake (F1) oracles
function frameDomain(frame) {
  for (const a of frame.actions) if ((a.choices !== null) !== a.inputKinds.includes('SELECT_CHOICE')) return ERR('SCHEMA_INVALID', 'decode', 'INVALID_SHAPE');
  return null;
}
function choiceOracle(frame, req) {
  if (req.frameRef !== frame.frameRef || req.frameRevision !== frame.frameRevision) return ERR('INVALID_FRAME', 'validate', 'REVISION_CHANGED');
  const a = frame.actions.find(x => x.actionId === req.actionId); if (!a) return ERR('UNKNOWN_ACTION', 'validate', 'SCOPE_DENIED');
  if (req.input.kind !== 'SELECT_CHOICE') return null;
  if (!a.choices || !a.choices.some(ch => ch.value === req.input.value)) return ERR('INVALID_SELECTION', 'validate', 'SCOPE_DENIED');
  return null;
}
function handshake(advertised, required) {
  const okW = required.wires.every(w => advertised.wireVersions.includes(w));
  const okF = required.factProfiles.every(f => advertised.factProfiles.includes(f));
  return okW && okF ? null : ERR('UNSUPPORTED_VERSION', 'decode', 'VERSION_UNSUPPORTED');
}
assert.deepEqual([...fx.compatibilityCases.find(c => c.id === 'HS-V030-PAIR-MATCH').advertised.wireVersions].sort(), [...profile.wireVersions].sort(), 'advertised 0.3.0 set equals the profile wire set');
for (const c of fx.compatibilityCases) {
  validate(c.advertised, 'ContractHandshake', c.id);
  const got = handshake(c.advertised, c.required);
  if (c.expected.result === 'HANDSHAKE_VERSION_MATCH') assert.equal(got, null, c.id);
  else { assert.deepEqual(got, {code: c.expected.code, phase: c.expected.phase, reason: c.expected.reason}, c.id); assert.equal(c.expected.requestsSent, 0); assert.equal(c.expected.fallback, false); }
}
for (const c of fx.schemaRejectCases) {
  let rejected = false; try { validate(c.message, c.type, c.id); rejected = frameDomain(c.message) !== null; } catch { rejected = true; }
  assert(rejected, c.id + ' must be rejected at decode');
}

// ------------------------------------------------------------ valid chain
const main = fx.validCases.find(x => x.id === 'PLACE-LUANTI-INITIATOR-CHAIN'); assert(main);
const m = main.materializedChain;
const types = {canvasInspectRequest: 'InspectPlacementRegionRequest', adapterInspectRequest: 'InspectRegionRequest', adapterInspectResponse: 'InspectRegionResponse', canvasInspectResponse: 'PlacementRegionInspection', painterRequest: 'CreateBuildPlanRequest', painterResponse: 'CreateBuildPlanResponse', brushRequest: 'BuildDocumentRequest', brushResponse: 'BuildDocumentResponse', applyRequest: 'ApplyRecoverableCommitRequest', prepareRequest: 'PrepareRecoverableTransactionRequest'};
for (const [k, ty] of Object.entries(types)) validate(m[k], ty, k);
placementResponseRule(m.canvasInspectResponse);
// settings: Canvas store -> Adapter request (user-decided defaults)
const st = canvasSettings(m.canvasSettingsRecord); assert(st.settings);
assert.deepEqual(m.adapterInspectRequest.placementSettings, st.settings);
assert.deepEqual(round3.decidedBehavior.settingDefaults, {'placement.frontGapCells': st.settings.frontGapCells, 'placement.forwardSearchCells': st.settings.forwardSearchCells, 'placement.lateralSearchCells': st.settings.lateralSearchCells, 'placement.verticalSearchCells': st.settings.verticalSearchCells});
// Workshop -> Canvas -> Adapter
assert.deepEqual(m.adapterInspectRequest.anchor, m.canvasInspectRequest.anchor);
assert.deepEqual(m.adapterInspectRequest.footprint, m.canvasInspectRequest.footprint);
const dims = m.painterRequest.intent.confirmedIntent.dimensions; assert.equal(dims.unit, 'node');
assert.deepEqual(m.canvasInspectRequest.footprint, {widthCells: dims.width, depthCells: dims.depth, heightCells: dims.height});
assert.equal(m.adapterInspectRequest.worldRef, m.canvasInspectRequest.worldRef);
// Adapter outcome recomputed by the reference engine oracle
const o = adapterInspect({c: main, anchor: m.adapterInspectRequest.anchor, settings: m.adapterInspectRequest.placementSettings, fp: m.adapterInspectRequest.footprint, principal: main.actingPrincipal, online: main.onlinePlayers});
const insp = m.adapterInspectResponse.result.inspection;
assert.equal(m.adapterInspectResponse.result.outcome, 'REGION_INSPECTED');
assert.equal(insp.inspectionId, m.adapterInspectRequest.inspectionId);
checkRegionAgainstOracle(insp, o, main.expectedSearch);
assert.deepEqual(insp.placementSettings, m.adapterInspectRequest.placementSettings);
assert.equal(insp.evidence.worldRef, insp.targetFacts.worldRef); assert.equal(insp.evidence.worldRevision, insp.targetFacts.worldRevision);
assert.equal(insp.evidence.sourceRevision, insp.frame.transformRevision);
// Canvas durable record and unchanged relay
assert.deepEqual(m.canvasDurableRecord.outcome, m.adapterInspectResponse.result);
assert.deepEqual(m.canvasInspectResponse.result, m.adapterInspectResponse.result);
assert.equal(m.canvasDurableRecord.inspectionId, insp.inspectionId);
// Workshop -> painter
assert.deepEqual(m.painterRequest.regionInspection, insp);
assert.deepEqual(m.painterRequest.targetFacts, insp.targetFacts);
assert.equal(m.painterRequest.targetFactsDigest, insp.targetFactsDigest);
assert.equal(painterOracle(m.painterRequest), null);
assert.equal(m.painterRequest.intentDigest, D('intent', m.painterRequest.intent));
assert.equal(m.painterRequest.referenceBriefDigest, D('reference-brief', m.painterRequest.referenceBrief));
assert.equal(m.painterRequest.catalogue && D('catalogue', m.painterRequest.catalogue), insp.targetFacts.catalogueDigest);
assert.deepEqual(m.painterRequest.intent.orderedTargetRefs, [], 'first building has no target object');
// painter -> BUILD
const build = m.painterResponse.result.build;
assert.equal(m.painterResponse.result.buildDigest, D('build', build));
assert.deepEqual(build.coordinateFrame, insp.frame);
assert.equal(build.targetFactsDigest, insp.targetFactsDigest);
for (const w of build.witnesses) { assert.equal(w.targetFactsDigest, insp.targetFactsDigest); if (w.predicate === 'PROTECTION' || w.predicate === 'BODY_CLEARANCE') assert.deepEqual(w.facts.evidence, insp.evidence); }
assert.deepEqual(build.witnesses.map(w => w.predicate).sort(), ['BODY_CLEARANCE', 'COVERAGE', 'HAZARD', 'PROTECTION']);
// BUILD -> Brush
assert.deepEqual(m.brushRequest.build, build); assert.equal(m.brushRequest.buildDigest, m.painterResponse.result.buildDigest);
assert.deepEqual(m.brushRequest.targetFacts, insp.targetFacts); assert.equal(m.brushRequest.targetFactsDigest, insp.targetFactsDigest);
assert.equal(brushOracle(m.brushRequest), null);
const proj = m.brushResponse.result.projection;
const effects = [];
for (const op of build.operations) for (let x = op.min[0]; x <= op.max[0]; x++) for (let y = op.min[1]; y <= op.max[1]; y++) for (let z = op.min[2]; z <= op.max[2]; z++) effects.push({position: [x, y, z], ...build.materials[op.materialRef]});
assert.deepEqual(proj.effects, effects);
assert.equal(proj.buildDigest, D('build', build)); assert.equal(proj.targetFactsDigest, insp.targetFactsDigest); assert.equal(proj.frameDigest, insp.targetFacts.frameDigest); assert.equal(proj.worldRef, insp.targetFacts.worldRef);
assert.equal(m.brushResponse.result.operationDigest, D('operations', proj));
const fe = D('final-effects', {profileVersion: 'final-effects/v2', frameDigest: proj.frameDigest, catalogueDigest: proj.catalogueDigest, effects});
for (const w of build.witnesses) assert.equal(w.finalEffectsDigest, fe);
// Brush -> Canvas Apply -> Adapter Prepare
assert.deepEqual(m.applyRequest.operations, proj); assert.equal(m.applyRequest.operationDigest, m.brushResponse.result.operationDigest);
assert.equal(m.applyRequest.regionInspectionBinding.inspectionId, insp.inspectionId);
assert.deepEqual(m.applyRequest.regionInspectionBinding.build, build);
assert.deepEqual(m.applyRequest.expectedObjectRevisions, {});
assert.equal(m.applyRequest.expectedWorldRevision, insp.targetFacts.worldRevision);
assert.equal(m.applyRequest.authorizationBindingDigest, D('authorization-binding', m.applyRequest.authorizationBinding));
assert.equal(m.applyRequest.authorizationBinding.operationDigest, m.applyRequest.operationDigest);
const records = [m.canvasDurableRecord];
assert.equal(canvasApplyOracle(m.applyRequest, records, insp.targetFacts.worldRevision), null);
assert.deepEqual(m.prepareRequest.operations, m.applyRequest.operations); assert.equal(m.prepareRequest.operationDigest, m.applyRequest.operationDigest);
assert.equal(prepareOracle(m.prepareRequest, null, main.actingPrincipal, main.onlinePlayers), null);
assert.equal(main.expected.objectRefSource, 'Canvas-generated after VERIFIED (CV3-C-IDENTITY)');

// other valid cases
for (const c of fx.validCases.filter(x => x !== main)) {
  for (const k of ['canvasInspectRequest', 'adapterInspectRequest', 'adapterInspectResponse']) if (c[k]) validate(c[k], types[k], c.id + '.' + k);
  if (c.invokeAction) { validate(c.invokeAction, 'InvokeActionRequest', c.id); assert.equal(c.invokeAction.surfaceActionDigest, D('surface-action', c.invokeAction.surfaceAction)); }
  const anchor = (c.adapterInspectRequest ?? c.canvasInspectRequest).anchor;
  const settings = c.adapterInspectRequest?.placementSettings ?? m.adapterInspectRequest.placementSettings;
  const oc = adapterInspect({c, anchor, settings, fp: (c.adapterInspectRequest ?? c.canvasInspectRequest).footprint, principal: c.actingPrincipal, online: c.onlinePlayers});
  checkRegionAgainstOracle(c.adapterInspectResponse?.result.inspection ?? null, oc, c.expectedSearch);
  if (c.id === 'PLACE-SHELL-NAMED-AFTER-ASK') {
    const ask = fx.askCases.find(a => a.id === c.previousChoiceCaseId);
    validate(c.interactionFrame, 'InteractionFrame', c.id + '.frame'); assert.equal(frameDomain(c.interactionFrame), null);
    for (const a of c.interactionFrame.actions) assert.equal(a.surfaceActionDigest, D('surface-action', {...c.invokeAction.surfaceAction, actionId: a.actionId}));
    const listed = c.interactionFrame.actions.find(a => a.actionId === c.invokeAction.actionId);
    assert.deepEqual(listed.choices.map(ch => ch.value), ask.canvasInspectResponse.result.choice.candidatePlayerNames, 'choices are exactly the Canvas-released names');
    assert(listed.choices.every(ch => ch.label === ch.value));
    assert.equal(c.invokeAction.input.kind, 'SELECT_CHOICE');
    assert.equal(choiceOracle(c.interactionFrame, c.invokeAction), null);
    assert.deepEqual(c.canvasInspectRequest.anchor, {kind: 'NAMED_PLAYER', engineActorName: c.invokeAction.input.value});
  }
  if (c.id === 'PLACE-PICKED-POINT') {
    assert.equal(c.invokeAction.input.kind, 'PICK_WORLD_POINT');
    assert.deepEqual(c.canvasInspectRequest.anchor, {kind: 'PICKED_POINT', pickRef: c.invokeAction.input.pickRef});
  }
}

// ------------------------------------------------------------ ask cases (typed outcome, no relocation, no guess)
for (const c of fx.askCases) {
  placementResponseRule(c.canvasInspectResponse);
  const ch = c.canvasInspectResponse.result.choice;
  const oc = adapterInspect({c, anchor: c.anchor, settings: c.settings, fp: {widthCells: 1, depthCells: 1, heightCells: 1}, principal: c.actingPrincipal, online: c.onlinePlayers});
  assert.deepEqual(oc.reasons, c.expected.reasons, c.id);
  assert.deepEqual(ch.reasons, oc.reasons, c.id);
  assert.deepEqual(ch.candidatePlayerNames, oc.names ?? null, c.id);
  assert.deepEqual(ch.placementSettings, c.settings, c.id);
  assert.equal(ch.anchorKind, c.anchor.kind);
  if (c.freeCandidateOutsideWindow) {
    const w = world(c), p = c.freeCandidateOutsideWindow.min;
    assert.equal(cellState(w, p).kind, 'AIR'); assert.equal(cellState(w, add(p, [0, -1, 0])).kind, 'OCCUPIED');
    assert(!isProtected(w, p, c.actingPrincipal) && !bodyAt(w.players.filter(x => c.onlinePlayers.includes(x.name)), p), 'free space exists outside the window');
    assert.equal(c.expected.silentRelocation, false);
  }
}

// ------------------------------------------------------------ invalid cases (typed reject, zero mutation)
const caseOracle = {
  'INV-FORGED-EVIDENCE-AT-APPLY': c => canvasApplyOracle(c.materialized.message, records, insp.targetFacts.worldRevision),
  'INV-UNISSUED-INSPECTION-AT-APPLY': c => canvasApplyOracle(c.materialized.message, records, insp.targetFacts.worldRevision),
  'INV-MISSING-BINDING-AT-APPLY': c => canvasApplyOracle(c.materialized.message, records, insp.targetFacts.worldRevision),
  'INV-STALE-AT-APPLY': c => canvasApplyOracle(c.materialized.message, records, c.currentWorldRevision),
  'INV-PROTECTED-AT-PREPARE': c => prepareOracle(c.materialized.message, c.enginePrivateAtPrepare, main.actingPrincipal, main.onlinePlayers),
  'INV-BODY-AT-PREPARE': c => prepareOracle(c.materialized.message, c.enginePrivateAtPrepare, main.actingPrincipal, main.onlinePlayers),
  'INV-FICTITIOUS-OBJECT': c => ([].some(r => r === c.materialized.message.objectRef) ? null : ERR('OBJECT_NOT_FOUND', 'validate', 'SCOPE_DENIED')),
  'INV-INITIAL-PLANNED': c => painterOracle(c.materialized.message, c.materialized.precedingPlanExists),
  'INV-REGION-SOURCE-WITH-OBJECTREF': c => (factsDomain(c.materialized.message) ? null : ERR('SCHEMA_INVALID', 'decode', 'INVALID_SHAPE')),
  'INV-INTERIOR-ON-REGION': c => painterOracle(c.materialized.message),
  'INV-PAINTER-REGION-MISMATCH': c => painterOracle(c.materialized.message),
  'INV-INVENTED-FRAME': c => brushOracle(c.materialized.message),
  'INV-SETTING-UNSET': c => canvasSettings(c.canvasSettingsRecord).error ?? null,
  'INV-SETTING-INVALID': c => canvasSettings(c.canvasSettingsRecord).error ?? null,
  'INV-NAMES-UNAUTHORIZED': c => releaseOracle(c),
  'INV-NAMES-REVOKED-BEFORE-RELEASE': c => releaseOracle(c),
  'INV-SHELL-FORGED-PICKREF': c => adapterInspect({c, anchor: c.materialized.message.anchor, settings: c.materialized.message.placementSettings, fp: c.materialized.message.footprint, principal: 'alice', online: ['alice']}).error ?? null,
  'INV-V021-CONSUMER-REGION-SOURCE': c => decode021(c.materialized.message),
  'INV-UNLISTED-CHOICE': c => choiceOracle(fx.validCases.find(v => v.id === c.frameCaseId).interactionFrame, c.materialized.message),
  'INV-CHOICE-ON-NON-CHOICE-ACTION': c => choiceOracle(fx.validCases.find(v => v.id === c.frameCaseId).interactionFrame, c.materialized.message)
};
assert.deepEqual(Object.keys(caseOracle).sort(), fx.invalidCases.map(c => c.id).sort(), 'every invalid case has an oracle');
for (const c of fx.invalidCases) {
  validate(c.materialized.message, c.materialized.type, c.id);
  const got = caseOracle[c.id](c);
  assert(got, c.id + ': oracle must reject');
  assert.deepEqual(got, {code: c.expected.error.code, phase: c.expected.error.phase, reason: c.expected.error.reason}, c.id);
  assert.equal(c.expected.error.mutationState, 'NONE', c.id);
  if (c.operation.wire !== 'painter/v3' || c.expected.error.code !== 'SCHEMA_INVALID') assert(opOf(c.operation.wire, c.operation.operation).failureCodes.includes(c.expected.error.code), c.id + ' code allowed by operation');
  assert.notDeepEqual(c.mutation.mutatedValue, c.mutation.originalProducedValue, c.id + ' mutation changes the produced value');
  for (const k of ['worldWrites', 'registryWrites']) if (k in c.expected) assert.equal(c.expected[k], 0, c.id);
  if (c.materialized.type === 'PlacementRegionInspection') {
    placementResponseRule(c.materialized.message);
    assert.deepEqual(c.materialized.message.error, c.expected.error);
    if (c.expected.unavailableSettings) assert.deepEqual(c.materialized.message.unavailableSettings, canvasSettings(c.canvasSettingsRecord).unavailableSettings);
  }
}
// forged evidence really differs from the Canvas record, and the forged BUILD is internally consistent (so only the record match catches it)
const forged = fx.invalidCases.find(c => c.id === 'INV-FORGED-EVIDENCE-AT-APPLY').materialized.message;
assert.equal(forged.operations.buildDigest, D('build', forged.regionInspectionBinding.build));
assert.equal(forged.operationDigest, D('operations', forged.operations));
assert.notDeepEqual(forged.regionInspectionBinding.build.witnesses[1].facts.evidence, insp.evidence);

// ------------------------------------------------------------ C9 privacy
const forbiddenKeys = new Set(fx.privacy.forbiddenKeys);
const playerNumbers = new Set(); const names = ['alice', 'bob', 'carol'];
const allPlayers = [...fx.enginePrivate.players, ...[...fx.validCases, ...fx.askCases].flatMap(c => c.enginePrivateOverride?.players ?? []), ...fx.invalidCases.flatMap(c => c.enginePrivateAtPrepare?.players ?? [])];
for (const p of allPlayers) for (const v of [p.pos[0], p.pos[2], p.yaw]) if (!Number.isInteger(v)) playerNumbers.add(v);
function scan(v, label, allowNames) {
  if (Array.isArray(v)) return v.forEach((x, i) => scan(x, label + '[' + i + ']', allowNames));
  if (v && typeof v === 'object') return Object.entries(v).forEach(([k, x]) => { assert(!forbiddenKeys.has(k), label + ': forbidden key ' + k); scan(x, label + '.' + k, allowNames); });
  if (typeof v === 'number') assert(!playerNumbers.has(v), label + ': raw pose number ' + v);
  if (typeof v === 'string' && !allowNames) assert(!names.includes(v), label + ': player name ' + v);
}
const publicOf = c => ['canvasInspectRequest', 'adapterInspectRequest', 'adapterInspectResponse', 'canvasInspectResponse', 'invokeAction', 'interactionFrame'].filter(k => c[k]).map(k => [k, c[k]]);
for (const [k, v] of Object.entries(m)) if (!['canvasSettingsRecord', 'canvasDurableRecord'].includes(k)) scan(v, 'main.' + k, false);
for (const c of [...fx.validCases.filter(x => x !== main), ...fx.askCases]) for (const [k, v] of publicOf(c)) scan(v, c.id + '.' + k, c.id === 'ASK-SHELL-MULTIPLE' || c.id === 'PLACE-SHELL-NAMED-AFTER-ASK');
for (const c of fx.invalidCases) scan(c.materialized.message, c.id, c.rowIds.includes('IS-SELECT-CHOICE'));
for (const c of fx.askCases) assert(!('inspection' in c.canvasInspectResponse.result), c.id + ': no bounds on choice');

// ------------------------------------------------------------ C8 settings/invariants registry
const raw3 = round3.rawAnswers.find(a => a.question.includes('默认值')).rawAnswer;
assert.equal(raw3, '适中（推荐）');
for (const s of registry.settings) {
  assert.equal(s.default, round3.decidedBehavior.settingDefaults[s.name], s.name);
  assert.equal(s.defaultAuthority.kind, 'USER_DIRECTIVE'); assert.equal(s.defaultAuthority.rawAnswer, raw3);
  assert.equal(s.owner, 'hanaworlds-canvas'); assert.equal(s.editable, true);
  for (const k of ['meaning', 'consequence', 'whenUnsetOrInvalid', 'scope', 'nameAuthority']) assert(typeof s[k] === 'string' && s[k], s.name + ' ' + k);
}
for (const i of registry.invariants) { assert.equal(i.switchable, false, i.id); for (const k of ['owner', 'text', 'whyNotSwitchable', 'consequence']) assert(i[k], i.id + ' ' + k); assert(['USER_DIRECTIVE', 'PROJECT_RULE', 'ENGINEERING_JUDGMENT'].includes(i.authority.kind), i.id); }
assert.equal(registry.surface.where.includes('Shell'), true);

// ------------------------------------------------------------ closure rows bind this chain
const caseIds = new Set([...fx.validCases, ...fx.askCases, ...fx.invalidCases, ...fx.compatibilityCases, ...fx.schemaRejectCases].map(c => c.id));
const newRows = closure.rows.filter(r => r.rc6Added || r.rc7Added);
assert.equal(newRows.length, 15);
for (const id of ['IS-09', 'PA-09', 'BU-09']) { const r = closure.rows.find(x => x.id === id); assert(r.rc7Amendment && caseIds.has(r.validFixture.caseId) && caseIds.has(r.invalidFixture.caseId), id); assert.equal(r.expectedOutcomes.invalid.code, 'UNSUPPORTED_VERSION'); }
assert(!/unchanged;/.test(closure.rows.find(x => x.id === 'BU-01').rc6Amendment.split('.')[0]) && closure.rows.find(x => x.id === 'BU-01').rc6Amendment.includes('target-facts/v3'));
assert.equal(closure.rowCount, closure.rows.length);
assert.deepEqual(closure.openUserDecisions, []);
assert(!closure.rows.some(r => r.status === 'OPEN_USER_DECISION'));
for (const r of newRows) {
  assert.equal(r.status, 'FROZEN', r.id);
  for (const f of ['validFixture', 'invalidFixture']) { assert.equal(r[f].path, 'fixtures/candidate/placement-region-chain-v4.json', r.id); assert(caseIds.has(r[f].caseId), r.id + ' ' + r[f].caseId); }
  const ex = r.fieldLineage?.executedChecker ?? r.executedChecker; assert.equal(ex.path, 'checks/verify-placement-region-v4.mjs', r.id);
  if (r.fieldLineage) for (const k of ['chainedValidFixture', 'chainedInvalidFixture']) assert(caseIds.has(r.fieldLineage[k].split('#')[1]), r.id + ' ' + k);
  assert(r.authorityRefs.every(a => ['USER_DIRECTIVE', 'PROJECT_RULE', 'ENGINEERING_JUDGMENT', 'RETURN_CLAIM', 'SOURCE_VERIFIED_FACT'].includes(a.kind)), r.id);
}
for (const id of ['WA-01', 'CA-01', 'PA-01', 'IS-01', 'BU-01']) assert(closure.rows.find(r => r.id === id).rc6Amendment, id);

console.log(JSON.stringify({status: 'PASS', evidence: 'SOURCE/FIXTURE', providerRuntime: 'NOT_RUN', chain: 'placement->InspectRegion->Canvas record->Workshop/Exterior->Brush->Canvas Apply->Adapter Prepare', validCases: fx.validCases.length, askCases: fx.askCases.length, invalidCases: fx.invalidCases.length, compatibilityCases: fx.compatibilityCases.length, schemaRejectCases: fx.schemaRejectCases.length, newClosureRows: newRows.length, privacyScan: 'PASS', settingsRegistry: registry.settings.length + ' settings/' + registry.invariants.length + ' invariants'}));

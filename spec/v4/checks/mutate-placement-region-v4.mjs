// Falsifiability harness for verify-placement-region-v4.mjs. Copies this candidate to a temporary
// directory, applies one mutation per run, and expects the checker to FAIL each time. Never writes here.
import {readFile, writeFile, rm, cp, mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import canonicalize from '../context/supplement/sources/canonicalize/lib/canonicalize.js';
const D = (k, v) => createHash('sha256').update('HanaWorlds|contracts@0.1.0|' + k + '\n' + canonicalize(v)).digest('hex');
const SRC = fileURLToPath(new URL('..', import.meta.url));
const F = 'fixtures/candidate/placement-region-chain-v4.json';
const muts = {
  'painter-evidence-changed': [F, d => { d.validCases[0].materializedChain.painterRequest.regionInspection.evidence.providerRef = 'x'; }],
  'front-window-gap': [F, d => { d.askCases.find(c => c.id === 'ASK-FRONT-BLOCKED').enginePrivateOverride.overrides[0].max[2] = 18; }],
  'forged-equals-record': [F, d => { d.invalidCases.find(c => c.id === 'INV-FORGED-EVIDENCE-AT-APPLY').materialized.message = structuredClone(d.validCases[0].materializedChain.applyRequest); }],
  'yaw-changed': [F, d => { d.validCases.find(c => c.id === 'PLACE-YAW-WEST').enginePrivateOverride.players[0].yaw = 0.5; }],
  'setting-unset-restored': [F, d => { d.invalidCases.find(c => c.id === 'INV-SETTING-UNSET').canvasSettingsRecord.stored['placement.frontGapCells'] = 2; }],
  'pose-key-leak': [F, d => { d.validCases[0].materializedChain.canvasInspectResponse.yaw = 0.1; }],
  'raw-pose-number-leak-schema-valid': [F, d => { const i = d.validCases.find(c => c.id === 'PLACE-SHELL-SOLE-PLAYER').adapterInspectResponse.result.inspection; i.targetFacts.usableVolume.physicalVolume = 0.2; i.targetFactsDigest = D('target-facts', i.targetFacts); }],
  'mixed-pair-advertises-v3': [F, d => { const c = d.compatibilityCases.find(x => x.id === 'HS-MIXED-PAINTER-V2'); c.advertised.wireVersions = [...c.advertised.wireVersions, 'painter/v3'].sort(); }],
  'brush-v021-claims-tf-v3': [F, d => { const c = d.compatibilityCases.find(x => x.id === 'HS-MIXED-BRUSH-FACTS-V2'); c.advertised.factProfiles = ['target-facts/v2', 'target-facts/v3']; }],
  'unlisted-choice-made-listed': [F, d => { d.validCases.find(c => c.id === 'PLACE-SHELL-NAMED-AFTER-ASK').interactionFrame.actions[0].choices.push({value: 'mallory', label: 'mallory'}); }],
  'choice-list-dropped': [F, d => { d.validCases.find(c => c.id === 'PLACE-SHELL-NAMED-AFTER-ASK').interactionFrame.actions[0].choices = null; }],
  'region-facts-left-at-v2': [F, d => { const i = d.validCases.find(c => c.id === 'PLACE-SHELL-SOLE-PLAYER').adapterInspectResponse.result.inspection; i.targetFacts.profileVersion = 'target-facts/v2'; i.targetFactsDigest = D('target-facts', i.targetFacts); }],
  'painter-wire-back-to-v2': ['CONTRACT_SCHEMA_PROFILE.json', d => { d.wireVersions = d.wireVersions.map(w => w === 'painter/v3' ? 'painter/v2' : w); }],
  'name-player-on-non-multiple-ask': [F, d => { d.askCases.find(c => c.id === 'ASK-FRONT-BLOCKED').canvasInspectResponse.result.choice.options = ['NAME_PLAYER', 'PICK_WORLD_POINT']; }],
  'inworld-renders-select-choice': [F, d => { d.rendererCapabilities.LUANTI_IN_WORLD = [...d.rendererCapabilities.LUANTI_IN_WORLD, 'SELECT_CHOICE'].sort(); }],
  'v021-code-reverted': [F, d => { const c = d.invalidCases.find(x => x.id === 'INV-V021-CONSUMER-REGION-SOURCE'); c.expected.error.code = 'SCHEMA_INVALID'; c.expected.error.reason = 'INVALID_SHAPE'; }],
  'schema-choice-code-reverted': [F, d => { d.schemaRejectCases.find(x => x.id === 'SCHEMA-CHOICE-WITH-POSITION').expected.code = 'SCHEMA_INVALID'; }],
  'forged-auth-binding-stale': [F, d => { d.invalidCases.find(x => x.id === 'INV-FORGED-EVIDENCE-AT-APPLY').materialized.message.authorizationBinding.operationDigest = d.validCases[0].materializedChain.applyRequest.operationDigest; }],
  'name-leak-main': [F, d => { d.validCases[0].materializedChain.painterRequest.referenceBrief.text = 'alice'; }],
  'gap-ignored': [F, d => { d.validCases[0].materializedChain.adapterInspectRequest.placementSettings.frontGapCells = 1; }],
  'multiple-names-dropped': [F, d => { d.askCases.find(c => c.id === 'ASK-SHELL-MULTIPLE').canvasInspectResponse.result.choice.candidatePlayerNames = null; }],
  'body-at-prepare-moved-away': [F, d => { d.invalidCases.find(c => c.id === 'INV-BODY-AT-PREPARE').enginePrivateAtPrepare.players[0].pos = [0.1, 0.5, 4.6]; }],
  'region-with-objectref': [F, d => { d.validCases[0].materializedChain.adapterInspectResponse.result.inspection.targetFacts.objectRef = 'obj'; }],
  'registry-default-changed': ['SETTINGS_AND_INVARIANTS.json', d => { d.settings[0].default = 3; }],
  'invariant-made-switchable': ['SETTINGS_AND_INVARIANTS.json', d => { d.invariants[0].switchable = true; }],
  'prepare-code-removed': ['CONTRACT_SCHEMA_PROFILE.json', d => { const o = d.operations['world-adapter/v4'].find(x => x.operation === 'PrepareRecoverableTransaction'); o.failureCodes = o.failureCodes.filter(c => c !== 'SAFETY_INVARIANT_FAILED'); }],
  'seam-a-row-touched': ['CONTRACT_SEMANTIC_CLOSURE.json', d => { d.rows.find(r => r.id === 'WAV4-SEAM-A').rule += ' '; }]
};
const res = {};
for (const [name, [file, fn]] of Object.entries(muts)) {
  const dst = await mkdtemp(join(tmpdir(), 'rc6-mut-'));
  try {
    await cp(SRC, dst, {recursive: true});
    const p = join(dst, file), d = JSON.parse(await readFile(p, 'utf8')); fn(d); await writeFile(p, JSON.stringify(d, null, 2) + '\n');
    const r = spawnSync(process.execPath, [join(dst, 'checks/verify-placement-region-v4.mjs')], {encoding: 'utf8'});
    res[name] = r.status === 0 ? 'NOT_CAUGHT' : 'CAUGHT';
  } finally { await rm(dst, {recursive: true, force: true}); }
}
const ok = Object.values(res).every(x => x === 'CAUGHT');
console.log(JSON.stringify({status: ok ? 'PASS' : 'FAIL', mutations: Object.keys(res).length, results: res}));
process.exit(ok ? 0 : 1);

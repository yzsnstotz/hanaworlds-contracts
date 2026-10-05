import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as C from 'hanaworlds-contracts';
import * as F from 'hanaworlds-contracts/fixture';
import { harness, captureError } from './harness.mjs';
const { check, finish } = harness('local-repair');
const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const pkg = await read('package.json');
const fixtures = await read('fixtures/candidate/closure-oracles.json');
const baseline = await read('spec/fixtures/candidate/closure-oracles.json');
const goldens = (await read('fixtures/candidate/production-goldens.json')).vectors;
const row = fixtures.cases.find(x => x.id === 'CA-02-INVALID');
const assets = { requests: [], goldens };
await check('CA-02-corrected-oracle-reaches-payload-validation', 'semantic-regression', ({ same }) => {
  same(Object.keys(row.input.projectionPatch), ['orderedSelectedRefs']);
  const actual = F.evaluateClosureFixture(row.wire, row.dimension, row.input, assets);
  for (const [key, value] of Object.entries(row.expected)) same(actual[key], value, '$.' + key);
  same(baseline.cases.find(x => x.id === row.id), row);
});
await check('CA-02-original-wrong-key-rejected-before-digest-binding', 'semantic-regression', ({ same }) => {
  const wrongInput = { ...row.input, projectionPatch: { orderedTargetRefs: ['fixture-object', 'fixture-other'] } };
  const actual = F.evaluateClosureFixture(row.wire, row.dimension, wrongInput, assets);
  for (const [key, value] of Object.entries({ result: 'REJECT', code: 'UNKNOWN_REQUIRED_FIELD', phase: 'decode',
    reason: 'UNKNOWN_FIELD', mutationState: 'NONE', worldWrites: 0 })) same(actual[key], value, '$.' + key);
});
await check('CA-02-corrected-projection-is-shape-valid-before-digest-check', 'semantic-regression', ({ same }) => {
  const golden = goldens.find(x => x.id === row.input.goldenRef);
  const projection = { ...golden.payload, orderedSelectedRefs: ['fixture-object', 'fixture-other'] };
  same(C.validateType('AffectedProjection', projection), projection);
  const actual = captureError(() => C.validateDigestBinding(golden.kind, projection, row.input.providedDigest));
  same(actual.code, 'NON_CANONICAL_AMBIGUITY'); same(actual.phase, 'validate'); same(actual.reason, 'PAYLOAD_CHANGED');
});
await check('V2-identity-consistent-with-stable-protocols', 'artifact-identity', async ({ same }) => {
  same(pkg.version, '0.3.5'); same(C.version, pkg.version);
  const lock = await read('package-lock.json');
  same(lock.version, pkg.version); same(lock.packages[''].version, pkg.version);
  const declarations = await readFile(new URL('../types/index.d.ts', import.meta.url), 'utf8');
  assert(declarations.includes(`export declare const version: '${pkg.version}';`));
  same(C.schemaBundle.$id, 'https://hanaworlds.invalid/contracts/0.1.1/schema.json');
  same(C.digestProfile.domainPrefix, 'HanaWorlds|contracts@0.1.0|');
  same(C.wireVersions, ['interaction-surface/v2', 'world-adapter/v2', 'canvas/v2', 'session/v2', 'painter/v2', 'ReferenceBrief/v2', 'BUILD/V2']);
  same(C.compiledOperationsVersion, 'operations/v2');
});
await finish();

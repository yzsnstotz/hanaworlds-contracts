import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

const moduleURL = new URL('../inspector/src/inspection.mjs', import.meta.url);
test('the inspector exists as a separate read-only public-capability consumer', async () => {
  assert.ok(existsSync(moduleURL), 'missing contract inspector implementation');
  const { describeInspector, inspectJSON } = await import(moduleURL);
  const description = describeInspector();
  assert.equal(description.contractsVersion, '0.5.3-rc.1');
  assert.ok(description.protocols.some(p => p.protocol === 'BUILD' && p.major === 3));
  assert.ok(description.capabilities.includes('region-build/v1:compile-mapblock-chunks'));
  for (const id of ['building', 'region-fill', 'region-air']) {
    const sample = description.samples.find(s => s.id === id);
    assert.ok(sample.fixture);
    const text = JSON.stringify(sample.input);
    const result = inspectJSON(sample.kind, text);
    assert.equal(result.accepted, true, `${id}: ${JSON.stringify(result)}`);
    assert.equal(JSON.stringify(sample.input), text, 'inspection must not mutate input');
    assert.equal(result.execution, 'Host / hanaworlds-contracts public pure functions');
  }
  const invalid = description.samples.find(s => s.id === 'invalid-region');
  const rejected = inspectJSON(invalid.kind, JSON.stringify(invalid.input));
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.error.code, 'SCHEMA_INVALID');
  assert.ok(rejected.fields.includes('$.origin'));
  const repaired = structuredClone(invalid.input); repaired.origin = [0, 0, 0];
  assert.equal(inspectJSON(invalid.kind, JSON.stringify(repaired)).accepted, true);
  assert.equal(inspectJSON('region', '{"origin": [0,0,0], "origin": [1,0,0]}').accepted, false,
    'strict Contracts decoder must reject duplicate JSON keys');
  assert.equal(inspectJSON('region', '{').accepted, false);
  for (const [id, code] of [['protocol-major', 'UNSUPPORTED_VERSION'], ['protocol-capability', 'CAPABILITY_UNAVAILABLE']]) {
    const sample = description.samples.find(s => s.id === id);
    const result = inspectJSON(sample.kind, JSON.stringify(sample.input));
    assert.equal(result.accepted, false);
    assert.equal(result.error.code, code);
    assert.ok(result.fixtureDemo);
    assert.ok(result.fields.includes(code === 'UNSUPPORTED_VERSION' ? '$.advertised.protocols' : '$.advertised.capabilities'));
  }
  assert.throws(() => inspectJSON('not-a-type', '{}'), /Unknown inspection kind/);
});

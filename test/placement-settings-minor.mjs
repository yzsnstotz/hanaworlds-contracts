import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as api from 'hanaworlds-contracts';

test('C-canvas publishes a scoped read with current values and consumer binding checks', async () => {
  assert.ok(api.operationContracts['canvas/v7'].some(row => row.operation === 'ReadPlacementSettings'));
  const fixture = JSON.parse(await readFile(new URL(import.meta.resolve('hanaworlds-contracts/fixtures/placement-settings')), 'utf8'));
  for (const exchange of fixture.exchanges)
    api.validateBoundResponse('canvas/v7', 'ReadPlacementSettings', exchange.request, exchange.response);
  const success = fixture.exchanges[0];
  for (const descriptor of api.placementSettingDescriptors)
    assert.notEqual(success.response.result.placementSettings[descriptor.name.split('.').at(-1)], descriptor.default);
  for (const field of ['sessionRef', 'worldRef', 'localContext']) {
    const bad = structuredClone(success.response);
    bad.result[field] = field === 'localContext' ? { ...bad.result[field], selectionRevision: 'expired' } : 'another';
    assert.throws(() => api.validateBoundResponse('canvas/v7', 'ReadPlacementSettings', success.request, bad));
  }
  const empty = { ...success.response, result: null };
  assert.throws(() => api.validateBoundResponse('canvas/v7', 'ReadPlacementSettings', success.request, empty));
  const mock = api.createPlacementSettingsMock(fixture.state);
  assert.equal(api.canonicalJSON(await mock.call('ReadPlacementSettings', success.request)), api.canonicalJSON(success.response));
  assert.deepEqual(mock.effects, { worldWrites: 0, inspections: 0, historyCreates: 0, persistentChanges: 0 });
});

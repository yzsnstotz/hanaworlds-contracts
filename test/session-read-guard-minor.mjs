import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as C from '../dist/local/index.mjs';
test('host-local guard publishes concrete unavailability without a wire operation', async () => {
 const f=JSON.parse(await readFile('fixtures/local/session-read-guard.json'));
 assert.equal(C.sessionReadGuard.protocol,f.protocol);
 const p=C.createUnavailableSessionReadGuardFixture(f.capture.missing);
 assert.deepEqual(p.captureSessionReadGuard({sessionRef:'s1'}),f.capture);
 assert.equal(p.captureSessionReadGuard({sessionRef:'s1'}).then,undefined);
 for(const g of [null,{},f.capture,JSON.parse(JSON.stringify(f.capture))])assert.equal(p.isSessionReadGuardCurrent(g,{sessionRef:'s1'}),false);
 assert.throws(()=>C.createUnavailableSessionReadGuardFixture([]));
 assert.ok(!Object.values(C.operationContracts).flat().some(o=>/SessionReadGuard/.test(o.operation)));
});

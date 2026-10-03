/** Runs the four approved rc.8 checkers, byte-for-byte, against this package's EXPORTED
 * profile, closure, settings registry and fixtures (resolved through package exports).
 * The checkers read their inputs relative to their own location, so they execute in a
 * temporary directory assembled from those exported bytes; nothing is copied from a BlueMap.
 * Inputs the package does not export (the product structure and the round-3 user decision
 * record used for provenance assertions) come from the pinned spec/v4 snapshot. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const approved = JSON.parse(await readFile(join(root, 'spec/v4/APPROVED_INPUT.json'), 'utf8'));
const exportedPath = specifier => fileURLToPath(import.meta.resolve(specifier));
const canonicalizePath = createRequire(import.meta.url).resolve('canonicalize');

const layout = await mkdtemp(join(tmpdir(), 'hanaworlds-contracts-v4-checks-'));
const sources = [];
async function place(target, from, expected) {
  const bytes = await readFile(from);
  if (expected !== undefined) assert.equal(sha(bytes), expected, `approved input drift: ${target}`);
  await mkdir(dirname(join(layout, target)), { recursive: true });
  await writeFile(join(layout, target), bytes);
  sources.push({ target, from: from.startsWith(root) ? from.slice(root.length) : from, sha256: sha(bytes) });
}
const results = {};
try {
  for (const name of ['CONTRACT_SCHEMA_PROFILE', 'CONTRACT_SEMANTIC_CLOSURE', 'SETTINGS_AND_INVARIANTS'])
    await place(name + '.json', exportedPath(`hanaworlds-contracts/v4/profile/${name}`), approved.filesSha256[name + '.json']);
  const fixtureNames = (await readdir(join(root, 'spec/v4/fixtures/candidate'))).filter(x => x.endsWith('.json'));
  assert.equal(fixtureNames.length, 18);
  for (const file of fixtureNames)
    await place('fixtures/candidate/' + file, exportedPath(`hanaworlds-contracts/v4/fixtures/${file.slice(0, -5)}`), approved.filesSha256['fixtures/candidate/' + file]);
  for (const file of ['PRODUCT_STRUCTURE.json', 'authority/USER_DECISION_FIRST_PLACEMENT_ROUND3_2026-10-02.json'])
    await place(file, join(root, 'spec/v4', file), approved.filesSha256[file]);
  // The checkers import the approved canonicalize@5.1.0 source path; the installed dependency supplies those bytes.
  await place('context/supplement/sources/canonicalize/lib/canonicalize.js', canonicalizePath,
    sha(await readFile(join(root, 'spec/context/supplement/sources/canonicalize/lib/canonicalize.js'))));
  for (const file of ['verify-placement-region-v4.mjs', 'mutate-placement-region-v4.mjs', 'verify-history-seam-v4.mjs', 'verify-current-inventory-v4.mjs'])
    await place('checks/' + file, join(root, 'spec/v4/checks', file), approved.filesSha256['checks/' + file]);
  for (const checker of ['verify-placement-region-v4', 'verify-history-seam-v4', 'verify-current-inventory-v4', 'mutate-placement-region-v4']) {
    const run = spawnSync(process.execPath, [join(layout, 'checks', checker + '.mjs')], { encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
    const line = run.stdout.trim().split('\n').at(-1) ?? '';
    let output = null; try { output = JSON.parse(line); } catch {}
    results[checker] = { exitCode: run.status, status: run.status === 0 && output?.status === 'PASS' ? 'PASS' : 'FAIL', output, stderrTail: run.status === 0 ? '' : run.stderr.split('\n').slice(-12).join('\n') };
  }
} finally {
  await rm(layout, { recursive: true, force: true });
}
const report = { format: 'APPROVED_CHECKERS_AGAINST_PACKAGE_EXPORTS/1', evidence: 'SOURCE/FIXTURE', providerRuntime: 'NOT_RUN',
  rule: 'approved checker bytes unchanged; profile/closure/settings/fixtures resolved through hanaworlds-contracts/v4 exports', sources, results };
await mkdir(join(root, 'evidence'), { recursive: true });
await writeFile(join(root, 'evidence/v4-approved-checks.json'), JSON.stringify(report, null, 2) + '\n');
const failed = Object.entries(results).filter(([, r]) => r.status !== 'PASS');
console.log(JSON.stringify({ suite: 'v4-approved-checks', checkers: Object.keys(results).length, pass: Object.keys(results).length - failed.length,
  summaries: Object.fromEntries(Object.entries(results).map(([k, r]) => [k, r.status])) }));
for (const [name, r] of failed) console.log(JSON.stringify({ name, exitCode: r.exitCode, stderrTail: r.stderrTail }));
if (failed.length) process.exitCode = 1;

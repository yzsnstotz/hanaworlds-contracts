import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
export const json = value => JSON.parse(JSON.stringify(value));
export class Blocked extends Error { constructor(reason, observed) { super(reason); this.observed = observed; } }
export function harness(label) {
  const cases = []; let fields = 0;
  async function check(id, category, execute, metadata = {}) {
    const comparisons = [];
    function same(actual, expected, path = '$') {
      fields++; comparisons.push({ path, expected: json(expected), actual: actual === undefined ? '<MISSING>' : json(actual) });
      assert.deepStrictEqual(actual === undefined ? actual : json(actual), json(expected), path);
    }
    function expectedSubset(actual, expected, path = '$') {
      const errors = [];
      function walk(a, e, p) {
        if (e !== null && typeof e === 'object' && !Array.isArray(e)) {
          for (const [key, value] of Object.entries(e)) walk(a?.[key], value, p + '.' + key);
        } else { try { same(a, e, p); } catch (error) { errors.push(error.message); } }
      }
      walk(actual, expected, path);
      if (errors.length) { const error = new Error(errors.join('\n')); error.actualOutcome = actual; error.expectedOutcome = expected; throw error; }
    }
    try { const details = await execute({ same, expectedSubset }); cases.push({ id, category, ...metadata, status: 'PASS', comparisons, ...(details ? { details } : {}) }); }
    catch (error) { cases.push({ id, category, ...metadata, status: error instanceof Blocked ? 'BLOCKED' : 'FAIL', comparisons,
      error: { name: error.name, message: error.message, ...(error.publicError ? { publicError: error.publicError } : {}), ...(error.observed ? { observed: error.observed } : {}), ...(error.actualOutcome ? { actualOutcome: error.actualOutcome, expectedOutcome: error.expectedOutcome } : {}) } }); }
  }
  async function finish() {
    const counts = Object.fromEntries(['PASS','FAIL','BLOCKED'].map(status => [status, cases.filter(x => x.status === status).length]));
    const report = { format: 'EXECUTED_CONFORMANCE/1', suite: label, evidence: 'FIXTURE', productionProviderRuntime: 'NOT_RUN', actualProviderQueries: 0, actualWorldWrites: 0,
      clarification: 'Oracle worldWrites and providerQueries are modelled counters. No world/provider/store/transport exists in this package. Explicit test-only source loader, when used, is not registry installation proof.',
      cases: cases.length, comparedExpectedFields: fields, counts, results: cases };
    await mkdir('evidence', { recursive: true }); await writeFile('evidence/' + label + '.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ suite: label, cases: cases.length, comparedExpectedFields: fields, counts }));
    for (const c of cases.filter(x => x.status !== 'PASS')) console.log(JSON.stringify({ id: c.id, status: c.status, error: c.error }));
    if (counts.FAIL || counts.BLOCKED) process.exitCode = 1;
    return report;
  }
  return { check, finish };
}
export function captureError(fn) { try { fn(); return { accepted: true }; } catch (e) { return e.publicError ?? { unexpectedException: e.name, message: e.message }; } }

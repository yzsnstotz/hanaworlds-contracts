/** Explicit opt-in SOURCE/FIXTURE loader. This is NOT npm installation evidence.
 * The unchanged approved upstream source snapshot is used only to execute fixture
 * checks when the public registry is unreachable. Production has no fallback. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const upstream = new URL('../spec/context/supplement/sources/canonicalize/lib/canonicalize.js', import.meta.url);
let announced = false;
export async function resolve(specifier, context, nextResolve) {
  if (specifier !== 'canonicalize') return nextResolve(specifier, context);
  if (!announced) {
    console.error(JSON.stringify({ evidence: 'SOURCE/FIXTURE', fixtureOnlyDependency: 'canonicalize@5.1.0', sha256: createHash('sha256').update(await readFile(upstream)).digest('hex'), registryInstalled: false, providerRuntime: 'NOT_RUN' }));
    announced = true;
  }
  return { url: upstream.href, shortCircuit: true };
}

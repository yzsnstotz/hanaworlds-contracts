// Regenerates the published explicit region FIXTURE from the shared scenario.
import {readFile,writeFile} from 'node:fs/promises';
import * as a from '../dist/local/index.mjs';
import {buildRegionScenario} from '../test/region-fixture.mjs';
const base=JSON.parse(await readFile('spec/local-world/fixtures/main.json','utf8'));
await writeFile('spec/local-world/fixtures/region.json',JSON.stringify(buildRegionScenario(a,base),null,2)+'\n');
console.log('Wrote spec/local-world/fixtures/region.json');

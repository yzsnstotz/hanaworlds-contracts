import {readFile} from 'node:fs/promises';
import {digestValue,publicError} from 'hanaworlds-contracts';
const fixtures=JSON.parse(await readFile('fixtures/candidate/closure-oracles.json','utf8'));
const c=fixtures.cases.find(x=>x.id==='CA-02-INVALID');
const goldens=JSON.parse(await readFile('fixtures/candidate/production-goldens.json','utf8'));
const g=goldens.vectors.find(x=>x.id===c.input.goldenRef);
let actual;
try { actual=digestValue(g.kind,{...g.payload,...c.input.projectionPatch}); } catch(e) { actual=publicError(e); }
console.log(JSON.stringify({caseId:c.id,projection:'AffectedProjection',patchedField:Object.keys(c.input.projectionPatch),expected:c.expected,actual,providerQueries:0,worldWrites:0,authorityUnchanged:true},null,2));
if(actual.code!==c.expected.code||actual.phase!==c.expected.phase||actual.reason!==c.expected.reason)process.exitCode=1;

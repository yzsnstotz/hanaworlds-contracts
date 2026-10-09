// Rebinds spec/local-world/fixtures/main.json from its own content (idempotent): the SafetyProfile is
// derived only from the confirmed intent, and every digest, witness binding and provider-facts
// context copy is recomputed. Run after `npm run build`; then build again to publish fixtures/local.
import {readFile,writeFile} from 'node:fs/promises';
import * as a from '../dist/local/index.mjs';
const path='spec/local-world/fixtures/main.json';
const f=JSON.parse(await readFile(path,'utf8'));
const r=f.request,D=(k,v)=>a.digestValue(k,v).sha256;
r.referenceBriefDigest=D('reference-brief',r.referenceBrief);
r.intent.referenceBriefDigest=r.referenceBriefDigest;
r.intentDigest=D('intent',r.intent);
r.safetyProfile=structuredClone(a.safetyProfileFromConfirmedIntent(r.intent));
r.safetyProfileDigest=D('safety-profile',r.safetyProfile);
const b=f.response.result.build;
b.safetyProfileDigest=r.safetyProfileDigest;
for(const w of b.witnesses)w.safetyProfileDigest=r.safetyProfileDigest;
f.response.result.buildDigest=D('build',b);
const keys=Object.keys(a.schemaBundle.definitions.BuildProposalContext.properties);
const context=Object.fromEntries(keys.map(k=>[k,structuredClone(r[k])]));
f.facts.sourceContext=context;f.facts.currentContext=structuredClone(context);
f.facts.requestFacts.currentBriefDigest=r.referenceBriefDigest;
await writeFile(path,JSON.stringify(f,null,2)+'\n');
console.log('Rebound',path);

// Per-file comparison of two extracted npm packs. The new pack's own version string is normalized
// to the old pack's version; every file must then be byte-identical, except README.md (change note)
// and package.json, where only `version` may change and `scripts` may only gain entries.
//   node tools/compare-pack.mjs <old package dir> <new package dir>
import {readdir,readFile} from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const [oldRoot,newRoot]=process.argv.slice(2);
async function list(r,p=''){const out=[];for(const e of await readdir(r+'/'+p,{withFileTypes:true})){const n=p?p+'/'+e.name:e.name;if(e.isDirectory())out.push(...await list(r,n));else out.push(n);}return out.sort();}
const a=await list(oldRoot),b=await list(newRoot);assert.deepEqual(b,a,'packed file set changed');
const vOld=JSON.parse(await readFile(oldRoot+'/package.json','utf8')).version,vNew=JSON.parse(await readFile(newRoot+'/package.json','utf8')).version;
const diff=[];const sha=x=>createHash('sha256').update(x).digest('hex');
for(const f of a){const o=await readFile(oldRoot+'/'+f);const n=await readFile(newRoot+'/'+f);
  if(o.equals(n))continue;const norm=Buffer.from(n.toString('utf8').replaceAll(vNew,vOld));
  if(norm.equals(o)){diff.push({file:f,kind:'version-string-only',occurrences:n.toString('utf8').split(vNew).length-1});continue;}
  if(f==='README.md'){diff.push({file:f,kind:'change-note',oldSha256:sha(o),newSha256:sha(n)});continue;}
  if(f==='package.json'){const po=JSON.parse(o),pn=JSON.parse(n);const added=Object.keys(pn.scripts).filter(k=>!(k in po.scripts));
    for(const [k,x] of Object.entries(po.scripts))assert.equal(pn.scripts[k],x,'changed script '+k);
    delete po.scripts;delete pn.scripts;po.version=pn.version;assert.deepEqual(pn,po,'package.json changed beyond version/scripts');
    diff.push({file:f,kind:added.length?'version-and-added-dev-scripts':'version-only',addedScripts:added});continue;}
  throw new Error('packed content changed beyond version: '+f);}
console.log(JSON.stringify({oldVersion:vOld,newVersion:vNew,files:a.length,identicalFiles:a.length-diff.length,differences:diff},null,1));

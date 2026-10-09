// Major-change check: for every wire of the baseline profile, the type closure of its operations is
// compared with identifiers normalized. A changed closure must carry a higher major of the same
// protocol; an unchanged closure must keep its identifier. Prints the old -> new identifier report.
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const [basePath,newPath]=process.argv.slice(2);
const b=JSON.parse(await readFile(basePath,'utf8')),n=JSON.parse(await readFile(newPath,'utf8'));
const parse=w=>{const m=/^(.+)\/[vV]([1-9][0-9]*)$/u.exec(w);assert.ok(m,w);return {protocol:m[1],major:Number(m[2])};};
const ident=/"const":"[A-Za-z-]+\/[vV][0-9]+"/gu;
function closure(p,wire){const d=p.definitions,seen=new Set(),st=[];
 for(const o of p.operations[wire])for(const k of ['request','response','alternateResult'])if(o[k])st.push(o[k]);
 while(st.length){const t=st.pop();if(seen.has(t)||!d[t])continue;seen.add(t);for(const m of JSON.stringify(d[t]).matchAll(/#\/definitions\/(\w+)/gu))st.push(m[1]);}
 return Object.fromEntries([...seen].sort().map(t=>[t,JSON.stringify(d[t]).replace(ident,'"const":"W"')]));}
const report=[];
for(const w of Object.keys(b.operations)){
 const {protocol,major}=parse(w),nw=Object.keys(n.operations).find(x=>parse(x).protocol===protocol);assert.ok(nw,'wire removed '+w);
 const x=closure(b,w),y=closure(n,nw),changed=[...new Set([...Object.keys(x),...Object.keys(y)])].filter(t=>x[t]!==y[t]).sort();
 assert.deepEqual(b.operations[w].map(o=>o.operation),n.operations[nw].map(o=>o.operation),'operations of '+w);
 if(changed.length)assert.ok(parse(nw).major>major,`${w} changed shape (${changed.join(',')}) but kept major`);else assert.equal(nw,w,`${w} unchanged but renamed to ${nw}`);
 report.push({old:w,new:nw,changed:changed.length>0,changedTypes:changed});
}
const sp=t=>t.definitions.SafetyProfile.properties.profileVersion.const;
console.log(JSON.stringify({baseline:b.version,current:n.version,wires:report,safetyProfile:{old:sp(b),new:sp(n)},
 removedTypes:Object.keys(b.definitions).filter(k=>!(k in n.definitions)),addedTypes:Object.keys(n.definitions).filter(k=>!(k in b.definitions)),
 compiledOperations:{old:b.compiledOperationsVersion,new:n.compiledOperationsVersion}},null,1));

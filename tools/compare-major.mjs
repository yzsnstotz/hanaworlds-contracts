// Major-change check: for every wire of the baseline profile, the type closure of its operations is
// compared with identifiers normalized. A closure whose changes are all additive (new types, or the
// qualified optional fields of protocolPolicy.minor: not required, no null form, every existing
// property, required list and keyword unchanged) must keep its identifier; any other change must carry
// a higher major of the same protocol; an unchanged closure keeps its identifier. Prints the report.
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const [basePath,newPath]=process.argv.slice(2);
const b=JSON.parse(await readFile(basePath,'utf8')),n=JSON.parse(await readFile(newPath,'utf8'));
const parse=w=>{const m=/^(.+)\/[vV]([1-9][0-9]*)$/u.exec(w);assert.ok(m,w);return {protocol:m[1],major:Number(m[2])};};
const ident=/"const":"[A-Za-z-]+\/[vV][0-9]+"/gu;
function closure(p,wire){const d=p.definitions,seen=new Set(),st=[];
 for(const o of p.operations[wire])for(const k of ['request','response','alternateResult'])if(o[k])st.push(o[k]);
 while(st.length){const t=st.pop();if(seen.has(t)||!d[t])continue;seen.add(t);for(const m of JSON.stringify(d[t]).matchAll(/#\/definitions\/(\w+)/gu))st.push(m[1]);}
 return Object.fromEntries([...seen].sort().map(t=>[t,JSON.stringify(d[t]).replace(ident,'"const":"W"')]));}
// Qualified optional addition: same keywords, same required list, every base property byte-identical,
// each added property optional and without a null form (absence is the previous meaning).
function additive(t){const x=b.definitions[t],y=n.definitions[t];if(!x)return {type:t,kind:'NEW_TYPE'};if(!y)return null;
 if(JSON.stringify(x)===JSON.stringify(y))return {type:t,kind:'EXISTING_UNCHANGED_NEWLY_REACHED'};
 const kx=Object.keys(x).filter(k=>k!=='properties').sort(),ky=Object.keys(y).filter(k=>k!=='properties').sort();
 if(JSON.stringify(kx)!==JSON.stringify(ky)||kx.some(k=>JSON.stringify(x[k])!==JSON.stringify(y[k]))||!x.properties||!y.properties)return null;
 const px=x.properties,py=y.properties;if(Object.keys(px).some(k=>JSON.stringify(px[k])!==JSON.stringify(py[k])))return null;
 const added=Object.keys(py).filter(k=>!(k in px));
 if(!added.length||added.some(k=>(y.required??[]).includes(k)||JSON.stringify(py[k]).includes('"type":"null"')))return null;
 return {type:t,kind:'OPTIONAL_FIELDS',fields:added};}
const report=[];
for(const w of Object.keys(b.operations)){
 const {protocol,major}=parse(w),nw=Object.keys(n.operations).find(x=>parse(x).protocol===protocol);assert.ok(nw,'wire removed '+w);
 const x=closure(b,w),y=closure(n,nw),changed=[...new Set([...Object.keys(x),...Object.keys(y)])].filter(t=>x[t]!==y[t]).sort();
 assert.deepEqual(b.operations[w].map(o=>o.operation),n.operations[nw].map(o=>o.operation),'operations of '+w);
 const additions=changed.map(additive),breaking=changed.filter((t,i)=>additions[i]===null);
 if(breaking.length)assert.ok(parse(nw).major>major,`${w} changed shape (${breaking.join(',')}) but kept major`);
 else assert.equal(nw,w,changed.length?`${w} changed only additively but was renamed to ${nw}`:`${w} unchanged but renamed to ${nw}`);
 report.push({old:w,new:nw,changed:changed.length>0,classification:!changed.length?'UNCHANGED':breaking.length?'BREAKING':'ADDITIVE',changedTypes:changed,breakingTypes:breaking,additions:additions.filter(Boolean)});
}
const sp=t=>t.definitions.SafetyProfile.properties.profileVersion.const;
console.log(JSON.stringify({baseline:b.version,current:n.version,wires:report,safetyProfile:{old:sp(b),new:sp(n)},
 removedTypes:Object.keys(b.definitions).filter(k=>!(k in n.definitions)),addedTypes:Object.keys(n.definitions).filter(k=>!(k in b.definitions)),
 compiledOperations:{old:b.compiledOperationsVersion,new:n.compiledOperationsVersion}},null,1));

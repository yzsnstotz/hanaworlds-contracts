import { decodeRawJSON, snapshotJSON } from '../dist/strict-json.mjs';
import { harness, captureError } from './harness.mjs';
const {check,finish}=harness(process.env.SUITE_LABEL || 'strict-admission');
const bytes=s=>new TextEncoder().encode(s);
const error=(reason='INVALID_SHAPE',code='SCHEMA_INVALID')=>({code,phase:'decode',reason,mutationState:'NONE',retryability:'NEVER',transactionRef:null,causeCode:null});
for (const [id,raw,reason,code] of [
 ['duplicate','{"a":1,"a":2}','DUPLICATE_DECODED_KEY','NON_CANONICAL_AMBIGUITY'],
 ['duplicate-escaped','{"a":1,"\\u0061":2}','DUPLICATE_DECODED_KEY','NON_CANONICAL_AMBIGUITY'],
 ['duplicate-nested','{"x":[{"a":1,"\\u0061":2}]}','DUPLICATE_DECODED_KEY','NON_CANONICAL_AMBIGUITY'],
 ['duplicate-nul','{"\\u0000":1,"\\u0000":2}','DUPLICATE_DECODED_KEY','NON_CANONICAL_AMBIGUITY'],
 ['surrogate-value','"\\ud800"','LONE_SURROGATE'],['surrogate-key','{"\\udfff":1}','LONE_SURROGATE'],
 ['overflow','1e999','INVALID_NUMBER'],['negative-overflow','-1e999','INVALID_NUMBER'],['nan','NaN','INVALID_NUMBER'],['infinity','Infinity','INVALID_NUMBER'],
 ['trailing-object-comma','{"a":1,}'],['trailing-array-comma','[1,]'],['trailing-value','true false'],['comment','/*x*/null'],['invalid-escape','"\\v"'],['invalid-unicode-escape','"\\u123z"'],['literal-control','"\n"'],['bom','\ufeff{}'],['nbsp','\u00a0{}'],['leading-zero','01'],['missing-fraction','1.'],['missing-exponent','1e'],['plus','+1'],['unclosed','[{}'],['empty',''],['wrong-object','{"a",1}'],['array-colon','[1:2]']
]) await check('STRICT-'+id,'raw-admission',({same})=>same(captureError(()=>decodeRawJSON(bytes(raw))),error(reason,code)));
for(const [id,hex] of [['overlong','c0af'],['truncated','e282'],['invalid-continuation','e228a1'],['utf8-surrogate','eda080'],['out-of-range','f4908080']]) await check('UTF8-'+id,'raw-admission',({same})=>same(captureError(()=>decodeRawJSON(Buffer.from(hex,'hex'))),error('INVALID_UTF8')));
for(const [id,raw,expected] of [['nested','{"a":[true,false,null,1,"あ",{}]}',{a:[true,false,null,1,'あ',{}]}],['escaped-pair','"\\ud83d\\ude00"','😀'],['exponent','-1.2e+2',-120],['independent-keys','[{"a":1},{"a":2}]',[{a:1},{a:2}]],['proto-key','{"__proto__":{"x":1},"constructor":"data"}',JSON.parse('{"__proto__":{"x":1},"constructor":"data"}')]]) await check('VALID-'+id,'raw-admission',({same})=>same(decodeRawJSON(bytes(raw)),expected));
await check('VALID-negative-zero','numeric-domain',({same})=>same(Object.is(decodeRawJSON(bytes('-0')),-0),true));
await check('VALID-deep-no-arbitrary-cap','raw-admission',({same})=>{ const n=20000;let v=decodeRawJSON(bytes('['.repeat(n)+'0'+']'.repeat(n)));v=snapshotJSON(v);let depth=0;while(Array.isArray(v)){depth++;v=v[0];}same(depth,n);same(v,0); });
await check('PURE-shared-noncyclic','pure-json',({same})=>{const x={v:1};same(snapshotJSON([x,x]),[{v:1},{v:1}]);});
let sideEffects=0;
const bad=[['undefined',undefined],['function',()=>1],['bigint',1n],['symbol',Symbol('fixture')],['nan',NaN],['infinity',Infinity],['boxed',new Number(1)],['date',new Date(0)],['map',new Map()],['sparse',new Array(2)],['prototype',Object.create({x:1})],['accessor',Object.defineProperty({},'x',{enumerable:true,get(){sideEffects++;return 1;}})],['toJSON',{toJSON(){sideEffects++;return {};}}],['nonenumerable',Object.defineProperty({},'x',{value:1})],['proxy',new Proxy({}, {ownKeys(){sideEffects++;return[];},getPrototypeOf(){sideEffects++;return null;}})]];
const cyclic={};cyclic.self=cyclic;bad.push(['cycle',cyclic]);const extra=[];extra.x=1;bad.push(['array-extra',extra]);const symbolKey={};symbolKey[Symbol('fixture')]=1;bad.push(['symbol-key',symbolKey]);
for(const [id,value] of bad) await check('PURE-REJECT-'+id,'pure-json',({same})=>same(captureError(()=>snapshotJSON(value)),error(['nan','infinity'].includes(id)?'INVALID_NUMBER':'INVALID_SHAPE')));
await check('PURE-no-side-effects','pure-json',({same})=>same(sideEffects,0));
await finish();

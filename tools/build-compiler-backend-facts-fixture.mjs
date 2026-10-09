// Regenerates spec/local-world/fixtures/compiler-backend-facts.json (compiler-backend-facts/v1 FIXTURE).
// Usage after `npm run build`: node tools/build-compiler-backend-facts-fixture.mjs; then `npm run build` again.
// Provider cases are what an Adapter must emit or must never emit; consumer cases are what Canvas
// must assemble or refuse. All refs are FIXTURE, not a real payload declaration.
import {readFile,writeFile} from 'node:fs/promises';
import * as a from '../src/local/index.mjs';
const main=JSON.parse(await readFile('spec/local-world/fixtures/main.json','utf8'));
const {worldRef,connectionRef,connectionIncarnationRef}=main.request.localContext;
const connection={worldRef,connectionRef,connectionIncarnationRef};
const backend={availability:'KNOWN',basis:'LOADED_PAYLOAD_DECLARATION',backendProfileId:'fixture-backend-profile',nodeWriteSemantics:'explicit-nodeName-param2-static-v2'};
const sign=p=>({...p,sourceRevision:a.digestValue('compiler-backend-facts',p).sha256});
const facts=(writeBackend,conn=connection)=>sign({profileVersion:'compiler-backend-facts/v1',connection:conn,writeBackend});
const known=facts(backend);
const undeclared=facts({availability:'UNAVAILABLE',reason:'NOT_DECLARED_BY_PAYLOAD'});
const changed=facts({...backend,backendProfileId:'fixture-backend-profile-reloaded'});
const otherIncarnation={...connection,connectionIncarnationRef:connectionIncarnationRef+'-fixture-reconnected'};
const reconnected=facts(backend,otherIncarnation);
const tamper=f=>{const x=structuredClone(known);f(x);return x;};
const err=(code,reason)=>({code,reason});
const leak=err('UNKNOWN_REQUIRED_FIELD','UNKNOWN_FIELD');
const fixture={
 evidence:'FIXTURE · compiler-backend-facts/v1 public contract fixture for both sides (Adapter provider, Canvas consumer). Connection comes from fixtures/main request; backend refs are fixture values, never a real payload declaration. No player geometry exists in this seam.',
 connection,
 provider:{
  valid:[
   {title:'payload declares its write backend',facts:known},
   {title:'payload declares none is a named UNAVAILABLE',facts:undeclared}
  ],
  invalid:[
   {title:'player envelope dimensions are not representable',facts:tamper(x=>{x.avatarDimensions={width:0.75,height:1.25,depth:0.5,unit:'node'};}),expect:leak},
   {title:'player collision box is not representable',facts:tamper(x=>{x.writeBackend.collisionBox=[-0.375,0,-0.25,0.375,1.25,0.25];}),expect:leak},
   {title:'player position is not representable',facts:tamper(x=>{x.position=[1,2,3];}),expect:leak},
   {title:'player yaw is not representable',facts:tamper(x=>{x.yaw=1.5;}),expect:leak},
   {title:'player identity is not representable',facts:tamper(x=>{x.playerNames=['fixture-player'];}),expect:leak},
   {title:'UNAVAILABLE carries a filled value',facts:tamper(x=>{x.writeBackend={availability:'UNAVAILABLE',reason:'NOT_DECLARED_BY_PAYLOAD',backendProfileId:'fixture-default'};}),expect:leak},
   {title:'backend for other write semantics',facts:tamper(x=>{x.writeBackend.nodeWriteSemantics='other-semantics';}),expect:err('SCHEMA_INVALID','INVALID_SHAPE')},
   {title:'empty backend ref',facts:tamper(x=>{x.writeBackend.backendProfileId='';}),expect:err('SCHEMA_INVALID','INVALID_SHAPE')},
   {title:'sourceRevision not recomputed',facts:tamper(x=>{x.writeBackend.backendProfileId='fixture-other';}),expect:err('NON_CANONICAL_AMBIGUITY','INVALID_SHAPE')}
  ]
 },
 consumer:{
  assemble:[
   {title:'KNOWN assembles backendProfileId',facts:known,backendProfileId:backend.backendProfileId},
   {title:'UNAVAILABLE refuses backendProfileId without a value',facts:undeclared,backendProfileId:err('CAPABILITY_UNAVAILABLE','REQUIRED_FACT_UNKNOWN')}
  ],
  avatarDimensions:{title:'no public avatarDimensions source: SafetyProfile assembly refuses, nothing is filled',refusal:{code:'CAPABILITY_UNAVAILABLE',phase:'validate',reason:'REQUIRED_FACT_UNKNOWN'}},
  lifecycle:[
   {title:'payload declaration change yields a new sourceRevision; previous assembly is invalidated',previous:known,current:changed,currentConnection:connection,previousStillCurrent:false},
   {title:'reconnect: facts of the previous incarnation are rejected against the new connection',previous:known,current:reconnected,currentConnection:otherIncarnation,previousRejected:err('CURRENT_WORLD_MISMATCH','INVALID_SHAPE')}
  ]
 }
};
await writeFile('spec/local-world/fixtures/compiler-backend-facts.json',JSON.stringify(fixture,null,2)+'\n');
console.log('compiler-backend-facts fixture',known.sourceRevision);

// Regenerates spec/local-world/fixtures/config-engine-facts.json (config-engine-facts/v1 FIXTURE).
// Usage after `npm run build`: node tools/build-config-engine-facts-fixture.mjs; then `npm run build` again.
// Provider cases are what an Adapter must emit or must never emit; consumer cases are what Canvas
// must assemble or refuse. All refs are FIXTURE inputs, not a real payload declaration or engine read.
import {readFile,writeFile} from 'node:fs/promises';
import * as a from '../src/local/index.mjs';
const main=JSON.parse(await readFile('spec/local-world/fixtures/main.json','utf8'));
const catalogue=main.request.catalogue;
const {worldRef,connectionRef,connectionIncarnationRef}=main.request.localContext;
const connection={worldRef,connectionRef,connectionIncarnationRef};
const catalogueDigest=a.digestValue('catalogue',catalogue).sha256;
const avatarEnvelope={availability:'UNAVAILABLE',reason:'NO_PUBLIC_SOURCE'};
const declared=id=>({availability:'KNOWN',basis:'LOADED_PAYLOAD_DECLARATION',backendProfileId:id,nodeWriteSemantics:'explicit-nodeName-param2-static-v2'});
const backend=declared('fixture-backend-profile');
const sign=p=>({...p,sourceRevision:a.digestValue('config-engine-facts',p).sha256});
const facts=(writeBackend,conn=connection)=>sign({profileVersion:'config-engine-facts/v1',connection:conn,catalogueDigest,avatarEnvelope,writeBackend});
const known=facts(backend);
// Same record shape Adapter 0.8.1 reports emitting; the id is used here only as fixture input.
const adapterShape=facts(declared('hanaworlds-luanti-worldedit-cell-write/v1'));
const undeclared=facts({availability:'UNAVAILABLE',reason:'NOT_DECLARED_BY_PAYLOAD'});
const changed=facts(declared('fixture-backend-profile-reloaded'));
const otherIncarnation={...connection,connectionIncarnationRef:connectionIncarnationRef+'-fixture-reconnected'};
const reconnected=facts(backend,otherIncarnation);
const tamper=f=>{const x=structuredClone(known);f(x);return x;};
const resign=f=>{const {sourceRevision,...p}=structuredClone(known);f(p);return sign(p);};
const err=(code,reason)=>({code,reason});
const leak=err('UNKNOWN_REQUIRED_FIELD','UNKNOWN_FIELD');
const fixture={
 evidence:'FIXTURE · config-engine-facts/v1 public contract fixture for both sides (Adapter provider, Canvas consumer). Catalogue/connection come from fixtures/main request; backend refs are fixture inputs, never a real payload declaration. avatarEnvelope has no KNOWN form: no player geometry exists in this seam.',
 catalogueRef:'fixtures/local/main.json#/request/catalogue',
 connection,
 provider:{
  valid:[
   {title:'payload declares its write backend; avatar has no public source',facts:known},
   {title:'Adapter 0.8.1 reported record shape validates',facts:adapterShape},
   {title:'payload declares no backend is a named UNAVAILABLE',facts:undeclared}
  ],
  invalid:[
   {title:'KNOWN avatar envelope is not representable',facts:tamper(p=>{p.avatarEnvelope={availability:'KNOWN',basis:'CONNECTED_PLAYERS_MAX_COLLISION_EXTENT',dimensions:{width:0.75,height:1.25,depth:0.5,unit:'node'}};}),expect:leak},
   {title:'avatar dimensions on the UNAVAILABLE record are not representable',facts:tamper(p=>{p.avatarEnvelope.dimensions={width:0.75,height:1.25,depth:0.5,unit:'node'};}),expect:leak},
   {title:'live-box reasons are not representable',facts:tamper(p=>{p.avatarEnvelope.reason='NO_CONNECTED_PLAYER';}),expect:err('SCHEMA_INVALID','INVALID_SHAPE')},
   {title:'player collision box is not representable',facts:tamper(x=>{x.collisionBox=[-0.375,0,-0.25,0.375,1.25,0.25];}),expect:leak},
   {title:'player position is not representable',facts:tamper(x=>{x.avatarEnvelope.position=[1,2,3];}),expect:leak},
   {title:'player yaw is not representable',facts:tamper(x=>{x.yaw=1.5;}),expect:leak},
   {title:'player identity is not representable',facts:tamper(x=>{x.playerNames=['fixture-player'];}),expect:leak},
   {title:'UNAVAILABLE backend carries a filled value',facts:tamper(x=>{x.writeBackend={availability:'UNAVAILABLE',reason:'NOT_DECLARED_BY_PAYLOAD',backendProfileId:'fixture-default'};}),expect:leak},
   {title:'backend for other write semantics',facts:tamper(x=>{x.writeBackend.nodeWriteSemantics='other-semantics';}),expect:err('SCHEMA_INVALID','INVALID_SHAPE')},
   {title:'sourceRevision not recomputed',facts:tamper(x=>{x.writeBackend.backendProfileId='fixture-other';}),expect:err('NON_CANONICAL_AMBIGUITY','INVALID_SHAPE')},
   {title:'Catalogue changed',facts:resign(p=>{p.catalogueDigest='0'.repeat(64);}),expect:err('CATALOGUE_MISMATCH','INVALID_SHAPE')}
  ]
 },
 consumer:{
  assemble:[
   {title:'KNOWN backend assembles backendProfileId',facts:known,backendProfileId:'fixture-backend-profile'},
   {title:'UNAVAILABLE backend refuses without a value',facts:undeclared,backendProfileId:err('CAPABILITY_UNAVAILABLE','REQUIRED_FACT_UNKNOWN')}
  ],
  avatarDimensions:{title:'SafetyProfile.avatarDimensions always refuses; cause INV-POSE-STAYS-IN-ENGINE; nothing filled or persisted',cause:'INV-POSE-STAYS-IN-ENGINE',refusal:{code:'CAPABILITY_UNAVAILABLE',phase:'validate',reason:'REQUIRED_FACT_UNKNOWN'}},
  lifecycle:[
   {title:'payload declaration change yields a new sourceRevision; previous assembly is invalidated',previous:known,current:changed,currentConnection:connection,previousStillCurrent:false},
   {title:'reconnect: facts of the previous incarnation are rejected against the new connection',previous:known,current:reconnected,currentConnection:otherIncarnation,previousRejected:err('CURRENT_WORLD_MISMATCH','INVALID_SHAPE')}
  ]
 }
};
await writeFile('spec/local-world/fixtures/config-engine-facts.json',JSON.stringify(fixture,null,2)+'\n');
console.log('config-engine-facts fixture',known.sourceRevision);

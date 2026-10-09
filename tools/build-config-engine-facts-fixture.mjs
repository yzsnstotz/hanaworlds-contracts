// Regenerates spec/local-world/fixtures/config-engine-facts.json (config-engine-facts/v1 FIXTURE).
// Usage after `npm run build`: node tools/build-config-engine-facts-fixture.mjs; then `npm run build` again.
// Provider cases are what an Adapter must emit or must never emit; consumer cases are what Canvas
// must assemble or refuse. All numbers and refs are FIXTURE, not measured, designed or real values.
import {readFile,writeFile} from 'node:fs/promises';
import * as a from '../src/local/index.mjs';
const main=JSON.parse(await readFile('spec/local-world/fixtures/main.json','utf8'));
const catalogue=main.request.catalogue;
const {worldRef,connectionRef,connectionIncarnationRef}=main.request.localContext;
const connection={worldRef,connectionRef,connectionIncarnationRef};
const catalogueDigest=a.digestValue('catalogue',catalogue).sha256;
const envelope={availability:'KNOWN',basis:'CONNECTED_PLAYERS_MAX_COLLISION_EXTENT',dimensions:{width:0.75,height:1.25,depth:0.5,unit:'node'}};
const backend={availability:'KNOWN',basis:'LOADED_PAYLOAD_DECLARATION',backendProfileId:'fixture-backend-profile',nodeWriteSemantics:'explicit-nodeName-param2-static-v2'};
const sign=p=>({...p,sourceRevision:a.digestValue('config-engine-facts',p).sha256});
const facts=(avatarEnvelope,writeBackend,conn=connection)=>sign({profileVersion:'config-engine-facts/v1',connection:conn,catalogueDigest,avatarEnvelope,writeBackend});
const known=facts(envelope,backend);
const noPlayer=facts({availability:'UNAVAILABLE',reason:'NO_CONNECTED_PLAYER'},backend);
const noBackend=facts(envelope,{availability:'UNAVAILABLE',reason:'NOT_DECLARED_BY_PAYLOAD'});
const changed=facts({...envelope,dimensions:{...envelope.dimensions,height:0.875}},backend);
const otherIncarnation={...connection,connectionIncarnationRef:connectionIncarnationRef+'-fixture-reconnected'};
const reconnected=facts(envelope,backend,otherIncarnation);
const tamper=f=>{const x=structuredClone(known);f(x);return x;};
const err=(code,reason)=>({code,reason});
const fixture={
 evidence:'FIXTURE · config-engine-facts/v1 public contract fixture for both sides (Adapter provider, Canvas consumer). Catalogue/connection come from fixtures/main request; every dimension and backend ref is a fixture value, never a measured, designed (1x2x1) or real engine fact.',
 catalogueRef:'fixtures/local/main.json#/request/catalogue',
 connection,
 provider:{
  valid:[
   {title:'both facts KNOWN',facts:known},
   {title:'no connected player is a named UNAVAILABLE envelope',facts:noPlayer},
   {title:'payload declares no backend is a named UNAVAILABLE backend',facts:noBackend}
  ],
  invalid:[
   {title:'player position leaks',facts:tamper(x=>{x.avatarEnvelope.position=[1,2,3];}),expect:err('UNKNOWN_REQUIRED_FIELD','UNKNOWN_FIELD')},
   {title:'yaw leaks',facts:tamper(x=>{x.avatarEnvelope.yaw=1.5;}),expect:err('UNKNOWN_REQUIRED_FIELD','UNKNOWN_FIELD')},
   {title:'raw collision box leaks',facts:tamper(x=>{x.avatarEnvelope.collisionBox=[-0.375,0,-0.25,0.375,1.25,0.25];}),expect:err('UNKNOWN_REQUIRED_FIELD','UNKNOWN_FIELD')},
   {title:'player identity leaks',facts:tamper(x=>{x.avatarEnvelope.playerNames=['fixture-player'];}),expect:err('UNKNOWN_REQUIRED_FIELD','UNKNOWN_FIELD')},
   {title:'UNAVAILABLE envelope carries a filled value',facts:tamper(x=>{x.avatarEnvelope={availability:'UNAVAILABLE',reason:'NO_CONNECTED_PLAYER',dimensions:envelope.dimensions};}),expect:err('UNKNOWN_REQUIRED_FIELD','UNKNOWN_FIELD')},
   {title:'unit other than node',facts:sign((({sourceRevision,...p})=>({...p,avatarEnvelope:{...envelope,dimensions:{...envelope.dimensions,unit:'meter'}}}))(known)),expect:err('SCHEMA_INVALID','INVALID_SHAPE')},
   {title:'zero size',facts:tamper(x=>{x.avatarEnvelope.dimensions.width=0;}),expect:err('SCHEMA_INVALID','INVALID_SHAPE')},
   {title:'backend for other write semantics',facts:tamper(x=>{x.writeBackend.nodeWriteSemantics='other-semantics';}),expect:err('SCHEMA_INVALID','INVALID_SHAPE')},
   {title:'sourceRevision not recomputed',facts:tamper(x=>{x.avatarEnvelope.dimensions.height=2;}),expect:err('NON_CANONICAL_AMBIGUITY','INVALID_SHAPE')},
   {title:'Catalogue changed',facts:tamper(x=>{x.catalogueDigest='0'.repeat(64);}),expect:err('CATALOGUE_MISMATCH','INVALID_SHAPE')}
  ]
 },
 consumer:{
  assemble:[
   {title:'KNOWN facts assemble both fields',facts:known,avatarDimensions:envelope.dimensions,backendProfileId:backend.backendProfileId},
   {title:'no connected player refuses avatarDimensions, backend still known',facts:noPlayer,avatarDimensions:err('CAPABILITY_UNAVAILABLE','REQUIRED_FACT_UNKNOWN'),backendProfileId:backend.backendProfileId},
   {title:'undeclared backend refuses backendProfileId, envelope still known',facts:noBackend,avatarDimensions:envelope.dimensions,backendProfileId:err('CAPABILITY_UNAVAILABLE','REQUIRED_FACT_UNKNOWN')}
  ],
  lifecycle:[
   {title:'envelope change yields a new sourceRevision; previous assembly is invalidated',previous:known,current:changed,currentConnection:connection,previousStillCurrent:false},
   {title:'reconnect: facts of the previous incarnation are rejected against the new connection',previous:known,current:reconnected,currentConnection:otherIncarnation,previousRejected:err('CURRENT_WORLD_MISMATCH','INVALID_SHAPE')}
  ]
 }
};
await writeFile('spec/local-world/fixtures/config-engine-facts.json',JSON.stringify(fixture,null,2)+'\n');
console.log('config-engine-facts fixture',known.sourceRevision);

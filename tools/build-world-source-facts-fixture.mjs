// Regenerates spec/local-world/fixtures/world-source-facts.json (world-source-facts/v1 FIXTURE).
// Usage after `npm run build`: node tools/build-world-source-facts-fixture.mjs; then `npm run build` again.
// Example exchanges for every named operation (what a provider may answer) and the named refusals a
// consumer must raise. All refs, sizes and colours are FIXTURE inputs, not a real world source declaration.
import {readFile,writeFile} from 'node:fs/promises';
import * as a from '../src/local/index.mjs';
const main=JSON.parse(await readFile('spec/local-world/fixtures/main.json','utf8'));
const catalogue=main.request.catalogue,ctx=main.request.localContext,sessionRef=main.request.sessionRef;
const {worldRef,connectionRef,connectionIncarnationRef}=ctx;
const connection={worldRef,connectionRef,connectionIncarnationRef};
const D=(k,v)=>a.digestValue(k,v).sha256,catalogueDigest=D('catalogue',catalogue);
const F='world-facts/v1',A='world-adapter/v8',I='world-inspection/v1';
const ok=(wire,requestId,result)=>({contractVersion:wire,requestId,result,error:null});
const failed=(wire,requestId,code,reason,phase='validate')=>({contractVersion:wire,requestId,result:null,error:{code,phase,retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason}});
const err=(code,reason)=>({code,reason});
const presentation={air:{displayName:null,color:null},'fixture:stone':{displayName:'Fixture stone',color:'#7f7f7f'}};
const orientationIndex=[{orientation:0,quarterTurnsAboutUp:0,upsideDown:false}];
const catalogueFacts={profileVersion:'catalogue-facts/v1',connection,catalogue,catalogueDigest,presentation,orientationIndex};
const texture={textureName:'fixture_stone.png',sourceKind:'MOD',sourceRef:'fixture-mod/textures/fixture_stone.png',interpretation:'SIMPLE_UNIFORM_NODE_TILES',mediaType:'image/png',bytesDigest:'5'.repeat(64),byteLength:96};
const snapshotProjection={profileVersion:'material-sources/v2',connection,catalogueDigest,engineRevisions:catalogue.engineRevisions,sourceBasis:'WORLD_SOURCE_ASSET_ONLY',materials:[
 {availability:'UNKNOWN',materialRef:'air',orientation:0,definitionRevision:catalogue.materials.air.definitionRevision,texture:null,reason:'UNSUPPORTED_APPEARANCE'},
 {availability:'KNOWN',materialRef:'fixture:stone',orientation:0,definitionRevision:catalogue.materials['fixture:stone'].definitionRevision,texture}]};
const materialSourceFacts={profileVersion:'material-source-facts/v1',snapshot:{...snapshotProjection,sourceRevision:D('material-sources',snapshotProjection)},presentation};
const worldGeometry={profileVersion:'world-geometry/v1',geometryProfiles:['voxel-grid/v1'],partition:{edge:[16,16,16]},postWriteLighting:'REQUIRED'};
const engineBounds={min:[-30912,-30912,-30912],max:[30927,30927,30927]};
const frame={axes:['+X','+Y','+Z'],handedness:'left',gridUnit:{name:'cell',metersPerGridUnit:1}};
const writeBackend={availability:'KNOWN',basis:'LOADED_PAYLOAD_DECLARATION',writeBackend:{profileId:'fixture-world-source-cell-write/v1',revision:'fixture-world-source-rev-7'}};
const unknownBackend={availability:'UNAVAILABLE',reason:'NOT_DECLARED_BY_PAYLOAD'};
const writeMethods=['PER_CELL','REGION'];
const engineFacts={profileVersion:'engine-facts/v1',connection,worldGeometry,engineBounds,frame,writeMethods,writeBackend};
const compilationConfig={profileVersion:'compilation-config/v3',writeBackend:{...writeBackend.writeBackend},overlapRule:'last-writer-wins',effectOrder:'numeric-x-y-z',compressionRule:'exact-final-effects-only'};
const avatarEnvelope={availability:'KNOWN',basis:'WORLD_SOURCE_DECLARATION',size:{width:0.6,height:1.77,depth:0.6}};
const noAvatar={availability:'UNAVAILABLE',reason:'NO_PUBLIC_SOURCE'};
const writeProfile={profileVersion:'write-profile/v1',connection,catalogueDigest,writeBackend,compilationConfig,writeMethods,avatarEnvelope};
const writeProfileUnknown={...writeProfile,writeBackend:unknownBackend,compilationConfig:null,writeMethods:[],avatarEnvelope:noAvatar};
const stateProfile={profileVersion:'state-profile/v3',derivedFields:['light'],preservedFields:[],clearedFields:['inventory','metadata','timer']};
const clean={hasSideEffects:false,hasPersistentState:false};
const writePath={profileVersion:'write-path-conclusions/v1',catalogueDigest,path:clean,materials:{air:clean,'fixture:stone':clean}};
const engineGuards={profileVersion:'engine-guards/v1',coverage:[{guard:'BODY_CLEARANCE',stages:['INSPECT_REGION','PREPARE_RECOVERABLE','APPLY_COMPILED','RESTORE'],protectionPrincipal:null},{guard:'CELL_PROTECTION',stages:['PREPARE_RECOVERABLE','APPLY_COMPILED'],protectionPrincipal:'ANONYMOUS'},{guard:'PLAYER_ENCLOSURE',stages:['APPLY_COMPILED'],protectionPrincipal:null}]};
const capabilities={profileVersion:'world-source-capabilities/v1',owner:'world-source',connection,capabilityRevision:'fixture-capability-1',catalogueDigest,worldGeometry,engineBounds,stateProfile,writeBackend,compilationConfig,writeMethods,writePath,engineGuards,avatarEnvelope};
const inspectionContext={sessionRef,worldRef,localContext:ctx,orderedSelectedObjectRefs:['object-2','object-1']};
const req={
 ReadCatalogue:{contractVersion:F,requestId:'read-catalogue-1',worldRef},
 ReadMaterialSources:{contractVersion:F,requestId:'read-material-sources-1',worldRef},
 ReadEngineFacts:{contractVersion:F,requestId:'read-engine-facts-1',worldRef},
 ReadWriteProfile:{contractVersion:F,requestId:'read-write-profile-1',worldRef},
 ReadWorldSourceCapabilities:{contractVersion:A,sessionRef,requestId:'read-capabilities-1',worldRef},
 ReadInspectionContext:{contractVersion:I,requestId:'read-inspection-1',sessionRef,worldRef}
};
const tamper=(x,f)=>{const y=structuredClone(x);f(y);return y;};
const otherConnection={...connection,connectionIncarnationRef:connectionIncarnationRef+'-fixture-reconnected'};
const leak=err('UNKNOWN_REQUIRED_FIELD','UNKNOWN_FIELD'),bad=err('SCHEMA_INVALID','INVALID_SHAPE');
const fixture={
 evidence:'FIXTURE · world-source-facts/v1 example exchanges for every named operation and the named refusals of both sides. Catalogue/connection/session come from fixtures/main request; backend, colours, sizes and revisions are fixture inputs, never a real world source declaration.',
 catalogueRef:'fixtures/local/main.json#/request/catalogue',
 connection,
 exchanges:[
  {title:'ReadCatalogue: vocabulary, names, colours and orientation index',wire:F,operation:'ReadCatalogue',request:req.ReadCatalogue,response:ok(F,'read-catalogue-1',catalogueFacts)},
  {title:'ReadCatalogue: no world bound is a named error',wire:F,operation:'ReadCatalogue',request:req.ReadCatalogue,response:failed(F,'read-catalogue-1','WORLD_NOT_BOUND','REQUIRED_FACT_UNKNOWN')},
  {title:'ReadMaterialSources: sources and colours, no texture bytes on the wire',wire:F,operation:'ReadMaterialSources',request:req.ReadMaterialSources,response:ok(F,'read-material-sources-1',materialSourceFacts)},
  {title:'ReadEngineFacts: geometry, partition, bounds, frame, lighting, write methods, backend',wire:F,operation:'ReadEngineFacts',request:req.ReadEngineFacts,response:ok(F,'read-engine-facts-1',engineFacts)},
  {title:'ReadWriteProfile: backend, complete configuration, write methods and declared body envelope',wire:F,operation:'ReadWriteProfile',request:req.ReadWriteProfile,response:ok(F,'read-write-profile-1',writeProfile)},
  {title:'ReadWriteProfile: nothing declared is UNAVAILABLE and null, never a default',wire:F,operation:'ReadWriteProfile',request:req.ReadWriteProfile,response:ok(F,'read-write-profile-1',writeProfileUnknown)},
  {title:'ReadWorldSourceCapabilities: one read of every world source declaration',wire:A,operation:'ReadWorldSourceCapabilities',request:req.ReadWorldSourceCapabilities,response:ok(A,'read-capabilities-1',capabilities)},
  {title:'ReadWorldSourceCapabilities: adapter not reachable',wire:A,operation:'ReadWorldSourceCapabilities',request:req.ReadWorldSourceCapabilities,response:failed(A,'read-capabilities-1','ADAPTER_UNAVAILABLE','REQUIRED_FACT_UNKNOWN')},
  {title:'ReadInspectionContext: the bound world and the ordered selection',wire:I,operation:'ReadInspectionContext',request:req.ReadInspectionContext,response:ok(I,'read-inspection-1',inspectionContext)},
  {title:'ReadInspectionContext: unknown session',wire:I,operation:'ReadInspectionContext',request:req.ReadInspectionContext,response:failed(I,'read-inspection-1','SESSION_NOT_FOUND','SCOPE_DENIED')}
 ],
 provider:{invalid:[
  {title:'compilation configuration without a known backend',type:'WriteProfile',value:{...writeProfileUnknown,compilationConfig},expect:bad},
  {title:'known backend without its configuration',type:'WriteProfile',value:{...writeProfile,compilationConfig:null},expect:bad},
  {title:'configuration with another backend than the declared one',type:'WriteProfile',value:tamper(writeProfile,x=>{x.compilationConfig.writeBackend.revision='fixture-other';}),expect:bad},
  {title:'body envelope with a live position is not representable',type:'WriteProfile',value:tamper(writeProfile,x=>{x.avatarEnvelope.position=[1,2,3];}),expect:leak},
  {title:'body envelope with a player identity is not representable',type:'WriteProfile',value:tamper(writeProfile,x=>{x.avatarEnvelope.playerName='fixture-player';}),expect:leak},
  {title:'UNAVAILABLE body envelope carrying a size',type:'WriteProfile',value:tamper(writeProfileUnknown,x=>{x.avatarEnvelope.size={width:1,height:2,depth:1};}),expect:leak},
  {title:'zero body height',type:'WriteProfile',value:tamper(writeProfile,x=>{x.avatarEnvelope.size.height=0;}),expect:bad},
  {title:'duplicate write method',type:'EngineFacts',value:{...engineFacts,writeMethods:['PER_CELL','PER_CELL']},expect:bad},
  {title:'write methods out of order',type:'EngineFacts',value:{...engineFacts,writeMethods:['REGION','PER_CELL']},expect:bad},
  {title:'unknown write method',type:'EngineFacts',value:{...engineFacts,writeMethods:['BULK']},expect:bad},
  {title:'presentation misses a Catalogue material',type:'CatalogueFacts',value:tamper(catalogueFacts,x=>{delete x.presentation.air;}),expect:bad},
  {title:'orientation used by a material is not described',type:'CatalogueFacts',value:{...catalogueFacts,orientationIndex:[]},expect:bad},
  {title:'colour that is not #rrggbb',type:'CatalogueFacts',value:tamper(catalogueFacts,x=>{x.presentation['fixture:stone'].color='grey';}),expect:bad},
  {title:'presentation names a material the snapshot does not carry',type:'MaterialSourceFacts',value:tamper(materialSourceFacts,x=>{x.presentation['fixture:wood']={displayName:null,color:null};}),expect:bad},
  {title:'capability owner is a package, not the role',type:'WorldSourceCapabilities',value:{...capabilities,owner:'fixture-adapter-package'},expect:bad},
  {title:'write path conclusions of another Catalogue',type:'WorldSourceCapabilities',value:tamper(capabilities,x=>{x.writePath.catalogueDigest='0'.repeat(64);}),expect:bad},
  {title:'inspection context of another world',type:'InspectionContext',value:tamper(inspectionContext,x=>{x.localContext.worldRef='fixture-other-world';}),expect:bad}
 ]},
 consumer:{
  bind:[
   {title:'catalogue read of a previous incarnation',check:'validateCatalogueFacts',value:{...catalogueFacts,connection:otherConnection},expect:err('CURRENT_WORLD_MISMATCH','INVALID_SHAPE')},
   {title:'catalogue digest that is not the carried Catalogue',check:'validateCatalogueFacts',value:{...catalogueFacts,catalogueDigest:'0'.repeat(64)},expect:err('CATALOGUE_MISMATCH','INVALID_SHAPE')},
   {title:'material sources not re-signed',check:'validateMaterialSourceFacts',value:tamper(materialSourceFacts,x=>{x.snapshot.materials[1].texture.byteLength=97;}),expect:err('NON_CANONICAL_AMBIGUITY','INVALID_SHAPE')},
   {title:'engine facts of another connection',check:'validateEngineFacts',value:{...engineFacts,connection:otherConnection},expect:err('CURRENT_WORLD_MISMATCH','INVALID_SHAPE')},
   {title:'write profile of another Catalogue',check:'validateWriteProfile',value:{...writeProfile,catalogueDigest:'0'.repeat(64)},expect:err('CATALOGUE_MISMATCH','INVALID_SHAPE')},
   {title:'placeable material without a clean write path conclusion',check:'validateWorldSourceCapabilities',value:tamper(capabilities,x=>{x.writePath.materials['fixture:stone'].hasPersistentState=null;}),expect:err('CATALOGUE_MISMATCH','CATALOGUE_UNRESOLVED')},
   {title:'placeable material while the path itself has side effects',check:'validateWorldSourceCapabilities',value:tamper(capabilities,x=>{x.writePath.path.hasSideEffects=true;}),expect:err('CATALOGUE_MISMATCH','CATALOGUE_UNRESOLVED')},
   {title:'write path conclusion for a material outside the Catalogue',check:'validateWorldSourceCapabilities',value:tamper(capabilities,x=>{x.writePath.materials['fixture:wood']=clean;}),expect:err('CATALOGUE_MISMATCH','CATALOGUE_UNRESOLVED')}
  ],
  require:[
   {title:'known backend: the complete configuration, unchanged',check:'requireWriteProfileConfig',value:writeProfile,expect:compilationConfig},
   {title:'unknown backend: named refusal, no configuration',check:'requireWriteProfileConfig',value:writeProfileUnknown,expect:err('CAPABILITY_UNAVAILABLE','REQUIRED_FACT_UNKNOWN')},
   {title:'declared body envelope from the write profile',check:'requireDeclaredAvatarEnvelope',value:writeProfile,expect:avatarEnvelope.size},
   {title:'declared body envelope from the capabilities',check:'requireDeclaredAvatarEnvelope',value:capabilities,expect:avatarEnvelope.size},
   {title:'no declared body envelope: named refusal, no size',check:'requireDeclaredAvatarEnvelope',value:writeProfileUnknown,expect:err('CAPABILITY_UNAVAILABLE','REQUIRED_FACT_UNKNOWN')}
  ],
  inspection:[
   {title:'answer about another session',request:req.ReadInspectionContext,response:ok(I,'read-inspection-1',{...inspectionContext,sessionRef:'fixture-other-session'}),expect:err('TRANSACTION_CONFLICT','PAYLOAD_CHANGED')},
   {title:'answer about another world',request:req.ReadInspectionContext,response:ok(I,'read-inspection-1',tamper(inspectionContext,x=>{x.worldRef='fixture-other-world';x.localContext.worldRef='fixture-other-world';})),expect:err('CURRENT_WORLD_MISMATCH','REVISION_CHANGED')}
  ]
 }
};
await writeFile('spec/local-world/fixtures/world-source-facts.json',JSON.stringify(fixture,null,2)+'\n');
console.log('world-source-facts fixture',fixture.exchanges.length,'exchanges');

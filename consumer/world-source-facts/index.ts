// Typed consumer of world-source-facts/v1 from the installed package root (compile-only).
import {version,validateWriteProfile,requireWriteProfileConfig,requireDeclaredAvatarEnvelope,validateWorldSourceCapabilities,validateCatalogueFacts,validateInspectionContextResponse,worldSourceFacts,minorWires} from 'hanaworlds-contracts';
import type {OperationMap,WriteProfile,WorldSourceCapabilities,CatalogueFacts,AvatarSize,CompilationConfig,MaterialSourceConnection,Catalogue,InspectionContext,ReadWriteProfileRequest} from 'hanaworlds-contracts';
declare const catalogue:Catalogue;declare const raw:unknown;
const connection:MaterialSourceConnection={worldRef:'w',connectionRef:'c',connectionIncarnationRef:'i'};
const request:ReadWriteProfileRequest={contractVersion:'world-facts/v1',requestId:'r',worldRef:'w'};
type Read=OperationMap['world-facts/v1']['ReadWriteProfile']['response'];
const profile:WriteProfile=validateWriteProfile(raw,catalogue,connection);
const config:CompilationConfig=requireWriteProfileConfig(profile);
const size:AvatarSize=requireDeclaredAvatarEnvelope(profile);
const caps:WorldSourceCapabilities=validateWorldSourceCapabilities(raw,catalogue,connection);
const owner:'world-source'=caps.owner;
const facts:CatalogueFacts=validateCatalogueFacts(raw,connection);
const context:InspectionContext|null=validateInspectionContextResponse(raw,raw).result;
const added:string|undefined=minorWires['world-facts/v1'];
const id:'world-source-facts/v1'=worldSourceFacts.id;
const currentVersion:'2.1.0'=version;
declare const response:Read;
void [request,config,size,owner,facts,context,added,id,currentVersion,response];

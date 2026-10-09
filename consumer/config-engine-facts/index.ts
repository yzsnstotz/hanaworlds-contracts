// Typed consumer of config-engine-facts/v1 from the installed package root (compile-only).
import {validateConfigEngineFacts,requireKnownWriteBackend,requireKnownAvatarEnvelope,configEngineFacts} from 'hanaworlds-contracts';
import type {ConfigEngineFacts,ConfigEngineFactsPort,AvatarEnvelopeFact,WriteBackendFact,MaterialSourceConnection,Catalogue,Ref} from 'hanaworlds-contracts';
const avatar:AvatarEnvelopeFact={availability:'UNAVAILABLE',reason:'NO_PUBLIC_SOURCE'};
const backend:WriteBackendFact={availability:'UNAVAILABLE',reason:'NOT_DECLARED_BY_PAYLOAD'};
const connection:MaterialSourceConnection={worldRef:'w',connectionRef:'c',connectionIncarnationRef:'i'};
const facts:ConfigEngineFacts={profileVersion:'config-engine-facts/v1',connection,catalogueDigest:'0'.repeat(64),avatarEnvelope:avatar,writeBackend:backend,sourceRevision:'0'.repeat(64)};
declare const port:ConfigEngineFactsPort;declare const catalogue:Catalogue;
async function assemble():Promise<Ref>{return requireKnownWriteBackend(validateConfigEngineFacts(await port.readConfigEngineFacts('w'),catalogue,connection));}
const refuse:()=>never=()=>requireKnownAvatarEnvelope(facts);
const cause:'INV-POSE-STAYS-IN-ENGINE'=configEngineFacts.avatarDimensions.cause;
void [assemble,refuse,cause];

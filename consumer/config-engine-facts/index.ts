// Typed consumer of config-engine-facts/v1 from the installed package root (compile-only).
import {validateConfigEngineFacts,requireKnownAvatarEnvelope,requireKnownWriteBackend,configEngineFacts} from 'hanaworlds-contracts';
import type {ConfigEngineFacts,ConfigEngineFactsPort,AvatarDimensions,AvatarEnvelopeFact,WriteBackendFact,MaterialSourceConnection,Catalogue,Ref} from 'hanaworlds-contracts';
const envelope:AvatarEnvelopeFact={availability:'UNAVAILABLE',reason:'NO_CONNECTED_PLAYER'};
const backend:WriteBackendFact={availability:'KNOWN',basis:'LOADED_PAYLOAD_DECLARATION',backendProfileId:'b',nodeWriteSemantics:'explicit-nodeName-param2-static-v2'};
const connection:MaterialSourceConnection={worldRef:'w',connectionRef:'c',connectionIncarnationRef:'i'};
const facts:ConfigEngineFacts={profileVersion:'config-engine-facts/v1',connection,catalogueDigest:'0'.repeat(64),avatarEnvelope:envelope,writeBackend:backend,sourceRevision:'0'.repeat(64)};
declare const port:ConfigEngineFactsPort;declare const catalogue:Catalogue;
async function assemble():Promise<[AvatarDimensions,Ref]>{const read=validateConfigEngineFacts(await port.readConfigEngineFacts('w'),catalogue,connection);return [requireKnownAvatarEnvelope(read),requireKnownWriteBackend(read)];}
const id:'config-engine-facts/v1'=configEngineFacts.id;
void [facts,assemble,id];

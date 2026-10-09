// Typed consumer of compiler-backend-facts/v1 from the installed package root (compile-only).
import {validateCompilerBackendFacts,requireKnownWriteBackend,compilerBackendFacts} from 'hanaworlds-contracts';
import type {CompilerBackendFacts,CompilerBackendFactsPort,WriteBackendFact,MaterialSourceConnection,Ref} from 'hanaworlds-contracts';
const backend:WriteBackendFact={availability:'UNAVAILABLE',reason:'NOT_DECLARED_BY_PAYLOAD'};
const connection:MaterialSourceConnection={worldRef:'w',connectionRef:'c',connectionIncarnationRef:'i'};
const facts:CompilerBackendFacts={profileVersion:'compiler-backend-facts/v1',connection,writeBackend:backend,sourceRevision:'0'.repeat(64)};
declare const port:CompilerBackendFactsPort;
async function assemble():Promise<Ref>{return requireKnownWriteBackend(validateCompilerBackendFacts(await port.readCompilerBackendFacts('w'),connection));}
const none:'NONE'=compilerBackendFacts.avatarDimensions.publicSource;
const id:'compiler-backend-facts/v1'=compilerBackendFacts.id;
void [facts,assemble,none,id];

/** compiler-backend-facts/v1: pure checks over the Adapter-declared write backend. No engine read,
 * default, persistence or world write. Provider authenticity/currentness stay with the caller.
 * No player geometry is representable here (INV-POSE-STAYS-IN-ENGINE). */
import {requireFact} from '../errors.mjs';
import {contractMetadata} from './generated/contracts.mjs';
import {validateType, digestValue, canonicalJSON} from './runtime.mjs';
export const compilerBackendFacts = contractMetadata.compilerBackendFacts;
export function validateCompilerBackendFacts(input, currentConnection) {
 const facts=validateType('CompilerBackendFacts',input);
 const current=validateType('MaterialSourceConnection',currentConnection);
 requireFact(canonicalJSON(facts.connection)===canonicalJSON(current),'CURRENT_WORLD_MISMATCH');
 const {sourceRevision,...projection}=facts;
 requireFact(sourceRevision===digestValue('compiler-backend-facts',projection).sha256,'NON_CANONICAL_AMBIGUITY');
 return facts;
}
// An UNAVAILABLE fact is a named refusal, never a value to fill.
export function requireKnownWriteBackend(facts) {
 const f=validateType('CompilerBackendFacts',facts);
 requireFact(f.writeBackend.availability==='KNOWN','CAPABILITY_UNAVAILABLE','REQUIRED_FACT_UNKNOWN');
 return f.writeBackend.backendProfileId;
}

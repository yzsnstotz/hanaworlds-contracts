// Consumer typecheck fixture for the same-major compatibility API.
import {checkContractsVersion,checkSchemaCompatibility,checkContractHandshake,contractsCompatibility,contractHandshake,schemaBundle} from 'hanaworlds-contracts';
const major:number=checkContractsVersion(contractHandshake.contracts).major;
const rule:'same-major'=contractsCompatibility.rule;
const schema:'SCHEMA_MAJOR_MATCH'=checkSchemaCompatibility(schemaBundle,['ContractHandshake']).result;
const id:string=schemaBundle.$id;
const handshake:'HANDSHAKE_VERSION_MATCH'=checkContractHandshake(contractHandshake).result;
export const summary={major,rule,schema,id,handshake};

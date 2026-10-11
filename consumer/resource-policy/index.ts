import {validateType} from 'hanaworlds-contracts';
import type {WorldSourceTransportPolicy, FailureSource, WorldSourceCapabilities, EngineFacts, WriteProfile, Error} from 'hanaworlds-contracts';
declare const caps: WorldSourceCapabilities, facts: EngineFacts, profile: WriteProfile, error: Error;
const declarations: (WorldSourceTransportPolicy|undefined)[]=[caps.transportPolicy,facts.transportPolicy,profile.transportPolicy];
const source: FailureSource|undefined=error.source;
for(const declaration of declarations)if(declaration)validateType('WorldSourceTransportPolicy',declaration);
if(source)validateType('FailureSource',source);

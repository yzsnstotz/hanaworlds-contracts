// Consumer typecheck fixture for skill site rules, the derived SafetyProfile and named safety capabilities.
import {safetyProfileFromConfirmedIntent,safetyCapabilities,unmetSafetyCapabilities,requireSafetyCapabilities,safetyCheckFailure,requireSiteRuleChecks,type SiteRules,type ClearanceCells,type SafetyProfile,type IntentProjection,type SafetyCapabilityId,type Error as ContractsError} from 'hanaworlds-contracts';
declare const intent:IntentProjection;
const rules:SiteRules=intent.confirmedIntent.siteRules;
const clearance:ClearanceCells|null=rules.entranceClearance;
const profile:SafetyProfile=safetyProfileFromConfirmedIntent(intent);
const version:'safety-profile/v4'=profile.profileVersion;
const ids:SafetyCapabilityId[]=safetyCapabilities.map(c=>c.id);
const unmet=unmetSafetyCapabilities({},['world-adapter/v7:cell-protection']).map(u=>u.cause);
const checked:readonly SafetyCapabilityId[]=requireSafetyCapabilities({},['world-adapter/v7:no-body-enclosure']);
const failure:ContractsError=safetyCheckFailure('world-adapter/v7:restore-body-recheck','transaction-1');
requireSiteRuleChecks(rules,{entrance:true});
// @ts-expect-error SafetyProfile v4 carries no player geometry
const geometry=profile.avatarDimensions;
export const summary={rules,clearance,version,ids,unmet,checked,failure,geometry};

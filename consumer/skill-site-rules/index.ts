// Consumer typecheck fixture for skill site rules, the derived SafetyProfile, site-rule capabilities and engine guards.
import {safetyProfileFromConfirmedIntent,safetyCapabilities,unmetSafetyCapabilities,requireSafetyCapabilities,requireSiteRuleChecks,
  engineGuards,guardRefusalError,unmetEngineGuards,requireEngineGuards,
  type SiteRules,type ClearanceCells,type SafetyProfile,type IntentProjection,type SafetyCapabilityId,type Error as ContractsError,
  type EngineGuardDeclaration,type GuardRefusal,type ReceiptProjection,type FailureDetail,type PublicCapabilities} from 'hanaworlds-contracts';
declare const intent:IntentProjection;
declare const capabilities:PublicCapabilities;
declare const receipt:ReceiptProjection;
const rules:SiteRules=intent.confirmedIntent.siteRules;
const clearance:ClearanceCells|null=rules.entranceClearance;
const profile:SafetyProfile=safetyProfileFromConfirmedIntent(intent);
const version:'safety-profile/v4'=profile.profileVersion;
const ids:SafetyCapabilityId[]=safetyCapabilities.map(c=>c.id);
const unmet=unmetSafetyCapabilities({},['painter/v6:light-rule']).map(u=>u.cause);
const checked:readonly SafetyCapabilityId[]=requireSafetyCapabilities({},['painter-region/v3:entrance-rule']);
requireSiteRuleChecks(rules,{entrance:true});
const declared:EngineGuardDeclaration|null=capabilities.engineGuards;
const gaps:readonly GuardRefusal[]=unmetEngineGuards(declared,[{guard:'PLAYER_ENCLOSURE',stage:'REGION_APPLY'},{guard:'CELL_PROTECTION',stage:'APPLY_COMPILED',protectionPrincipal:'ACTING_PRINCIPAL'}]);
requireEngineGuards(declared,[{guard:'BODY_CLEARANCE',stage:'RESTORE'}]);
const restoreError:ContractsError=guardRefusalError({guard:'BODY_CLEARANCE',stage:'RESTORE',finding:'GUARD_UNAVAILABLE'},{cause:'READBACK_MISMATCH'});
const both:[GuardRefusal|null,FailureDetail|null]=[receipt.guardRefusal,receipt.applyFailure];
const stages=engineGuards.stages.map(s=>s.stage);
// @ts-expect-error SafetyProfile v4 carries no player geometry
const geometry=profile.avatarDimensions;
export const summary={rules,clearance,version,ids,unmet,checked,gaps,restoreError,both,stages,geometry};

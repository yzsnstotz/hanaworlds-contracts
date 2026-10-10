// Consumer typecheck fixture for confirmed-placement/v1: proposal creation, the brief/intent binding,
// Painter/Canvas checks and the canvas/v6 apply binding.
import {confirmedPlacement,createPlacementProposal,requirePlacementSource,requirePlacementTarget,confirmedPlacementOf,confirmedPlacementBinding,checkConfirmedPlacementApply,validateCreateBuildPlanRequest,validateCreateBuildPlanResponse,validateRegionCommitRequest,checkConfirmedRegionPlacementCommit,validateRegionCommitSubmission,ContractError,
  type PlacementProposal,type PlacementTarget,type ConfirmedPlacementBinding,type RegionInspection,type IntentProjection,type BriefProjection,
  type ApplyRecoverableCommitRequest,type ApplyRegionCommitRequest,type CreateBuildPlanRequest,type CreateBuildPlanResponse,type ClarificationNeed,type PlacementFailure,type Controls,type ConfirmedIntent} from 'hanaworlds-contracts';
declare const inspection:RegionInspection;
declare const intent:IntentProjection;
declare const brief:BriefProjection;
declare const apply:ApplyRecoverableCommitRequest;
const target:PlacementTarget={kind:'EXACT_CELLS',cells:[[0,1,3],[1,1,3]]};
const placement:PlacementProposal=createPlacementProposal(inspection,target);
const version:'placement-proposal/v1'=placement.profileVersion;
requirePlacementSource(placement,inspection,placement.worldRef);
requirePlacementTarget(placement,[[0,1,3],[1,1,3]]);
const confirmed:PlacementProposal|null=confirmedPlacementOf(intent,brief);
const shown:PlacementProposal|undefined=brief.controls.placement;
const fromIntent:ConfirmedIntent['placement']=intent.confirmedIntent.placement;
const binding:ConfirmedPlacementBinding|null=confirmedPlacementBinding(intent);
const sent:ConfirmedPlacementBinding|null=apply.regionInspectionBinding?.confirmedPlacement??null;
const checked=checkConfirmedPlacementApply(apply,inspection,'world-revision');
const kind:'EXACT_CELLS'|'ANCHORED_EXTENT'|undefined=checked?.kind;
const planRequest:CreateBuildPlanRequest=validateCreateBuildPlanRequest({});
const planned:CreateBuildPlanResponse|ClarificationNeed=validateCreateBuildPlanResponse(planRequest,{});
const regionCommit:ApplyRegionCommitRequest=validateRegionCommitRequest({});
const regionSent:ConfirmedPlacementBinding|undefined=regionCommit.confirmedPlacement;
const regionChecked=checkConfirmedRegionPlacementCommit(regionCommit,inspection,'world-revision');
validateRegionCommitSubmission(intent,brief,regionCommit);
const names:PlacementFailure[]=confirmedPlacement.namedFailures.map(f=>f.failure);
declare const error:ContractError;
const failure:PlacementFailure|undefined=error.placementFailure;
// 1.1: placement is optional; absent keeps the 1.0 meaning. There is no null form.
const noPlacement:Controls={purpose:null,dimensions:null,entrancePortalRefs:[],styleText:null,siteRules:null};
// @ts-expect-error no null form
const nullPlacement:Controls={...noPlacement,placement:null};
// @ts-expect-error a PlacementProposal carries no player pose
const yaw=placement.source.yaw;
export const summary={nullPlacement,regionSent,regionChecked,planned,version,confirmed,shown,fromIntent,binding,sent,kind,names,failure,noPlacement,yaw};

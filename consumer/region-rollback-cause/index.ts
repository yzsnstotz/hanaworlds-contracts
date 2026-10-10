// Consumer typecheck fixture for region-rollback-cause/v1: reading the cause of a successful region rollback.
import {regionRollbackCause,regionRollbackCauseOf,validateRegionCommit,type ApplyRegionCommitRequest,type ApplyRegionCommitResponse,type RegionCommitResult,type FailureDetail} from 'hanaworlds-contracts';
declare const request:ApplyRegionCommitRequest;
declare const response:ApplyRegionCommitResponse;
const checked:ApplyRegionCommitResponse=validateRegionCommit(request,response);
const read=regionRollbackCauseOf(request,checked);
const cause:'REPORTED'|'UNKNOWN'=read.cause;
const failure:FailureDetail|null=read.failure;
const id:'region-rollback-cause/v1'=regionRollbackCause.id;
const capability:'canvas-region/v2:rollback-cause'=regionRollbackCause.capability;
declare const result:RegionCommitResult;
// Optional, no null form: absent means UNKNOWN.
const stated:FailureDetail|undefined=result.rollbackCause;
void cause;void failure;void id;void capability;void stated;

import {validateToolRequest,validateToolResponse,createSkillToolsMock,directBuild,type ToolBuildInput,type ToolBuildRequest,type ToolBuildHostFacts,type HostBuildIntentAuthorization,type ToolHostContext,type SkillToolsPort} from 'hanaworlds-contracts';
import fixture from 'hanaworlds-contracts/fixtures/direct-build' with {type:'json'};
import tools from 'hanaworlds-contracts/tools' with {type:'json'};
import skill from 'hanaworlds-contracts/skill' with {type:'json'};
const x=fixture.exchanges[0];
const host=x.hostFacts as ToolBuildHostFacts;
const authorization:HostBuildIntentAuthorization=host.intentAuthorization!;
const request:ToolBuildRequest=validateToolRequest('hanaworlds_build',x.request,host);
const input:ToolBuildInput=request.input;
const mock=createSkillToolsMock(fixture);
const response=validateToolResponse('hanaworlds_build',request,mock('hanaworlds_build',request,host));
if(response.result?.action==='build'){const stage:string=response.result.outcome.stage;void stage;}
// Old implementations and old model calls need no new field or method.
const oldHost:ToolHostContext={sessionRef:'s',turnRef:'t',turnRevision:'r',localContext:null};
const oldCall:ToolBuildRequest={contractVersion:'session/v5',requestId:'old',hostContext:oldHost,input:{action:'apply',confirmedProposalRef:'confirmed'}};
const oldProvider:SkillToolsPort={async invoke(name,call){return validateToolResponse(name,call,{contractVersion:'session/v5',requestId:call.requestId,result:null,error:{code:'WORLD_NOT_BOUND',phase:'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason:'REQUIRED_FACT_UNKNOWN'},guardRefusal:null});}};
// @ts-expect-error only host envelope may carry authorization
const forged:ToolBuildInput={action:'build',proposal:input.action==='build'?input.proposal:null,intentAuthorization:authorization};
// @ts-expect-error model cannot supply a confirmation boolean
const confirmed:ToolBuildInput={action:'build',proposal:input.action==='build'?input.proposal:null,confirmed:true};
void [directBuild,tools,skill,oldCall,oldProvider,forged,confirmed];

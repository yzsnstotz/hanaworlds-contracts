import {version,toolManifest,buildingSkill,validateToolRequest,validateToolResponse,createSkillToolsMock,validateRequest,type ToolHostContext,type ToolBuildInput,type BuildingSkillRequest,type SkillToolsPort,type BuildingSkillPort,type SessionRedoPort} from 'hanaworlds-contracts';
const release:'2.6.0'=version;
const host:ToolHostContext={sessionRef:'session',turnRef:'turn',turnRevision:'turn-1',localContext:{connectionRef:'connection',connectionIncarnationRef:'incarnation',worldRef:'world',selectionRevision:'selection'}};
const q=validateToolRequest('hanaworlds_context',{contractVersion:'session/v5',requestId:'q',hostContext:host,input:{action:'read'}},host);
const action:'read'=q.input.action;
const response=validateToolResponse('hanaworlds_context',q,{contractVersion:'session/v5',requestId:'q',result:null,error:{code:'WORLD_NOT_BOUND',phase:'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,reason:'REQUIRED_FACT_UNKNOWN'}});
const world:string|undefined=response.result?.localContext.worldRef;
const mock=createSkillToolsMock({exchanges:[]});
const result=mock('hanaworlds_context',q,host);
const call:BuildingSkillRequest={contractVersion:'skill/v1',requestId:'skill',hostContext:host,turn:{text:'Build',media:[]}};
validateRequest('skill/v1','hanaworlds-building',call);
validateRequest('session/v5','RedoCurrentBuild',{contractVersion:'session/v5',requestId:'redo',sessionRef:'session',worldRef:'world',expectedTurnRevision:'turn-1',expectedHistoryRevision:'history-1',localContext:host.localContext});
// @ts-expect-error model input cannot self-report the world
const fabricated:ToolBuildInput={action:'undo',worldRef:'forged'};
// @ts-expect-error only baseline actions are public
const legacy:ToolBuildInput={action:'set_material'};
// @ts-expect-error confirmation is host state, never a model boolean
const confirmed:ToolBuildInput={action:'apply',confirmed:true};
async function ports(t:SkillToolsPort,s:BuildingSkillPort,r:SessionRedoPort){await t.invoke('hanaworlds_context',q);await s.run(call);await r.RedoCurrentBuild({contractVersion:'session/v5',requestId:'redo',sessionRef:'session',worldRef:'world',expectedTurnRevision:'turn-1',expectedHistoryRevision:'history-1',localContext:host.localContext!});}
void [release,toolManifest,buildingSkill,action,world,result,fabricated,legacy,confirmed,ports];

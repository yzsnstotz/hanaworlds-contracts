/** Test-only synchronous provider of world-source-facts/v1 example data.
 * Pass the published fixtures/world-source-facts JSON. No engine, storage or host.
 * refusals maps operation names to a declared operation error for consumer tests. */
import {worldSourceFacts,validateRequest,validateBoundResponse} from 'hanaworlds-contracts';
export function createWorldSourceFactsMock(fixture,refusals={}){
 const exchanges=structuredClone(fixture.exchanges);
 return (wire,operation,input)=>{
  const request=validateRequest(wire,operation,input);
  const declaration=worldSourceFacts.operations.find(o=>o.wire===wire&&o.operation===operation);
  const example=exchanges.find(x=>x.wire===wire&&x.operation===operation&&x.response.result!==null);
  if(!declaration||!example)throw new TypeError('Not a world-source-facts fixture operation');
  let code=refusals[operation];
  if(request.worldRef!==example.request.worldRef)
   code=declaration.errors.includes('WORLD_NOT_BOUND')?'WORLD_NOT_BOUND':declaration.errors[0];
  else if(operation==='ReadInspectionContext'&&request.sessionRef!==example.request.sessionRef)code='SESSION_NOT_FOUND';
  if(code&&!declaration.errors.includes(code))throw new TypeError('Undeclared operation error');
  const response=code?{
   contractVersion:wire,requestId:request.requestId,result:null,
   error:{code,phase:'validate',retryability:'AFTER_NEW_FACTS',mutationState:'NONE',transactionRef:null,causeCode:null,
    reason:code==='SESSION_NOT_FOUND'?'SCOPE_DENIED':'REQUIRED_FACT_UNKNOWN'}
  }:{...example.response,requestId:request.requestId};
  return validateBoundResponse(wire,operation,request,response);
 };
}

// Reusable FIXTURE peers for the exact published sample only. No real provider, world or port.
import * as a from 'hanaworlds-contracts';
const same = (x,y) => a.canonicalJSON(x)===a.canonicalJSON(y);
export function createFixtureBrush(fixture) {
  return {compile(request) {
    const admitted=a.validateCompileRegionBuildRequest(request);
    if(!same(admitted,fixture.region.compileRequest))throw new Error('Request outside this fixture');
    return a.validateCompiledRegionSet(admitted,fixture.region.compileResponse);
  }};
}
export function createFixtureCanvas(fixture) {
  return {inspect(request) {
    try {
      const admitted=a.validatePlacementRegionRequest(request,fixture.canvas.connection);
      if(!same(admitted,fixture.canvas.request))throw new Error('Request outside this fixture');
      return a.validatePlacementRegionResponse(admitted,fixture.canvas.response,fixture.canvas.connection);
    } catch(error) {
      if(!(error instanceof a.ContractError))throw error;
      return a.validateResponse('canvas/v7','InspectPlacementRegion',{
        contractVersion:'canvas/v7',requestId:request.requestId,result:null,error:a.publicError(error),unavailableSettings:null,guardRefusal:null});
    }
  }};
}

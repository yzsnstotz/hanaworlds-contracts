import {createUnavailableSessionReadGuardFixture, type SessionReadGuardProvider, type SessionReadGuardScope} from 'hanaworlds-contracts';
/** Canvas may adapt connection/local checks from its own public provider contracts. */
export async function consumeStableRead<T>(session:SessionReadGuardProvider, scope:SessionReadGuardScope,
 prepare:()=>Promise<T>, connectionCurrent:()=>boolean, localCurrent:()=>boolean):Promise<T> {
 const capture=session.captureSessionReadGuard(scope);
 if(capture.error!==null)throw new Error(capture.error.code+': '+capture.missing.join(', '));
 const value=await prepare(); // the LAST await
 // Check callbacks must be synchronous read-only observations. No retry or renew.
 if(!session.isSessionReadGuardCurrent(capture.guard,scope)||!connectionCurrent()||!localCurrent())
   throw new Error('STALE_REVISION');
 return value;
}
const fixture:SessionReadGuardProvider=createUnavailableSessionReadGuardFixture(['OFFICIAL_PERSISTENCE_SYNCHRONOUS_CURRENTNESS']);
void fixture;

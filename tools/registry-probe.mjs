/** Public dependency metadata only. No user configuration, token or credentials. */
for (const [name,version] of [['canonicalize','5.1.0'],['typescript','5.8.3'],['node-linux-x64','24.13.1']]) {
  const url='https://registry.npmjs.org/'+name+'/'+version;
  try { const response=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('HTTP '+response.status);
    const metadata=await response.json();console.log(JSON.stringify({action:'PUBLIC_REGISTRY_ALLOWED',name,version,status:'RETRIEVED',integrity:metadata.dist?.integrity,license:metadata.license}));
  } catch(error){console.log(JSON.stringify({action:'PUBLIC_REGISTRY_ALLOWED',name,version,status:'BLOCKED',error:error.message,causeCode:error.cause?.code??null,credentialsRead:false}));process.exitCode=1;}
}

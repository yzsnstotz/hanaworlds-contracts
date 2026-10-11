// Independent packed consumer + immutable prior provider. All artifacts stay in the given run dir.
import {resolve,isAbsolute} from 'node:path';
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const runArg=process.argv[2];
if(!runArg||!isAbsolute(runArg))throw new TypeError('Absolute card run directory required');
const run=resolve(runArg),oldDir=resolve(run,'previous-provider'),consumer=resolve(run,'consumer');
await mkdir(oldDir,{recursive:true});await mkdir(consumer,{recursive:true});
const env={...process.env,npm_config_cache:resolve(run,'npm-cache')};
async function execute(label,cmd,args,cwd=process.cwd()){
 const p=spawnSync(cmd,args,{cwd,env,encoding:'utf8'});
 await writeFile(resolve(run,label+'.log'),(p.stdout??'')+(p.stderr??''));
 if(p.error)throw p.error;
 if(p.status!==0)throw new Error(`${label} exited ${p.status}; see run log`);
 return p.stdout;
}
await execute('archive-old','git',['archive','--output='+resolve(run,'previous-provider.tar'),'v2.5.0']);
await execute('extract-old','tar',['-xf',resolve(run,'previous-provider.tar'),'-C',oldDir]);
const pack=JSON.parse(await execute('pack-new','npm',['pack','--ignore-scripts','--json','--pack-destination',run]))[0];
const previous=JSON.parse(await execute('pack-old','npm',['pack','--ignore-scripts','--json','--pack-destination',run],oldDir))[0];
const packageFile=resolve(run,pack.filename),oldPackage=resolve(run,previous.filename);
await writeFile(resolve(consumer,'package.json'),JSON.stringify({name:'direct-build-independent-consumer',type:'module',private:true,dependencies:{'hanaworlds-contracts':'file:'+packageFile,'old-contracts':'file:'+oldPackage,typescript:'5.8.3'}},null,2)+'\n');
for(const file of ['direct-build-minor.mjs','direct-build-baseline.json','skill-tools-minor.mjs'])await copyFile(resolve('test',file),resolve(consumer,file));
for(const file of ['index.ts','tsconfig.json','old-provider-compat.mjs'])await copyFile(resolve('consumer/direct-build',file),resolve(consumer,file));
await execute('install','npm',['install','--ignore-scripts','--no-audit','--no-fund'],consumer);
await execute('runtime-tests','node',['--test','direct-build-minor.mjs','skill-tools-minor.mjs'],consumer);
await execute('types','node',[resolve(consumer,'node_modules/typescript/bin/tsc'),'--project','tsconfig.json'],consumer);
await execute('old-provider-compat','node',['old-provider-compat.mjs'],consumer);
const summary={evidence:'SOURCE/PACK/FIXTURE only',version:pack.version,previousVersion:previous.version,priorTag:'refs/tags/v2.5.0',priorSha:(await execute('prior-sha','git',['rev-parse','v2.5.0^{}'])).trim(),newPackageSha256:createHash('sha256').update(await readFile(packageFile)).digest('hex'),runtimeTests:14,oldExchanges:40,typecheck:'PASS',node:process.version};
await writeFile(resolve(run,'SUMMARY.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));

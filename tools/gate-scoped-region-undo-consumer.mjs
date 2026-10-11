import {resolve,isAbsolute} from 'node:path';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const runArg=process.argv[2];if(!runArg||!isAbsolute(runArg))throw new TypeError('Absolute run directory required');
const run=resolve(runArg),consumer=resolve(run,'consumer');await mkdir(consumer,{recursive:true});
const env={...process.env,npm_config_cache:process.env.npm_config_cache??resolve(process.env.HOME,'.npm')};
async function execute(label,command,args,cwd=process.cwd()){
 const p=spawnSync(command,args,{cwd,env,encoding:'utf8'});await writeFile(resolve(run,label+'.log'),(p.stdout??'')+(p.stderr??''));
 if(p.error)throw p.error;if(p.status!==0)throw new Error(`${label} exited ${p.status}`);return p.stdout;
}
const pack=JSON.parse(await execute('pack','npm',['pack','--ignore-scripts','--json','--pack-destination',run]))[0];
await writeFile(resolve(consumer,'package.json'),JSON.stringify({name:'scoped-region-undo-consumer',type:'module',private:true,dependencies:{'hanaworlds-contracts':'file:'+resolve(run,pack.filename),typescript:'5.8.3'}},null,2)+'\n');
await copyFile('test/scoped-region-undo.mjs',resolve(consumer,'test.mjs'));
for(const f of ['index.ts','tsconfig.json'])await copyFile('consumer/scoped-region-undo/'+f,resolve(consumer,f));
await execute('install','npm',['install','--ignore-scripts','--no-audit','--no-fund'],consumer);
await execute('runtime','node',['--test','test.mjs'],consumer);
await execute('types','node',[resolve(consumer,'node_modules/typescript/bin/tsc'),'--project','tsconfig.json'],consumer);
await writeFile(resolve(run,'SUMMARY.json'),JSON.stringify({evidence:'SOURCE/PACK/FIXTURE_ONLY',version:pack.version,runtime:'PASS',typecheck:'PASS',node:process.version},null,2)+'\n');

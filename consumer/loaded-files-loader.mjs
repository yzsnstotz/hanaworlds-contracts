/** Additional test observer. Never changes module bytes or resolution. */
import {readFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function load(url,context,nextLoad){
 const result=await nextLoad(url,context);
 if(url.startsWith('file:')&&url.includes('/node_modules/hanaworlds-contracts/')){
  const path='node_modules/hanaworlds-contracts/'+url.split('/node_modules/hanaworlds-contracts/')[1];
  const sha256=createHash('sha256').update(await readFile(new URL(url))).digest('hex');
  await appendFile('loaded-files.jsonl',JSON.stringify({path,sha256,via:'actual-esm-loader'})+'\n');
 }
 return result;
}

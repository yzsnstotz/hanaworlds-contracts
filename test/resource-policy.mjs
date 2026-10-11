import test from 'node:test';
import assert from 'node:assert/strict';
import {validateType,ContractError} from '../dist/local/index.mjs';
const setting={name:'courierBodyBytes',unit:'byte',defaultValue:4194304,value:131072,min:131072,max:4194304,editable:true,meaning:'UTF-8 JSON bytes in either direction',tradeoff:'smaller bodies use more batches',validation:'integer within declared inclusive range'};
test('public resource declaration and failure source have closed shapes',()=>{
 assert.deepEqual(JSON.parse(JSON.stringify(validateType('WorldSourceTransportPolicy',{profileVersion:'world-source-transport-policy/v1',owner:'world-source',settings:[setting]}).settings[0])),setting);
 const source={owner:'world-source',operation:'discover',resource:'payload-identity',kind:'CORRUPT',nativeCode:null};
 assert.deepEqual(JSON.parse(JSON.stringify(validateType('Error',new ContractError('ADAPTER_UNAVAILABLE','validate','REQUIRED_FACT_UNKNOWN',{source}).publicError).source)),source);
 for(const bad of [{...source,kind:'anything'},{...source,path:'/private'}])assert.throws(()=>validateType('FailureSource',bad));
});

import {readFile} from 'node:fs/promises';
test('real Adapter policy fixture and all three downstream read exchanges validate; old fixtures remain admissible',async()=>{
 const fx=JSON.parse(await readFile(new URL('../fixtures/local/resource-policy.json',import.meta.url)));
 validateType('WorldSourceTransportPolicy',fx.policy);validateType('Error',fx.refusal);
 for(const x of fx.exchanges)validateType(x.operation+'Response',x.response);
 for(const bad of [{...fx.policy,settings:[...fx.policy.settings,fx.policy.settings[0]]},
 {...fx.policy,settings:[{...fx.policy.settings[0],value:-1}]},
 {...fx.policy,settings:[{...fx.policy.settings[2],value:65535}]}])assert.throws(()=>validateType('WorldSourceTransportPolicy',bad));
 const old=JSON.parse(await readFile(new URL('../fixtures/local/world-source-facts.json',import.meta.url)));
 for(const x of old.exchanges)validateType(x.operation+'Response',x.response);
});

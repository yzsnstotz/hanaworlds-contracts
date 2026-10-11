// Regenerates spec/local-world/fixtures/history-receipt.json (2.8.0 QueryTransaction historical receipt).
// The receipt shape and digests are those of an actual durable VERIFIED receipt reported by adapter-07
// (j3-contract-blocker.json); world/connection refs are replaced by fixture refs and the receipt digest is
// recomputed with the package's own digest. SOURCE/FIXTURE only. Run after `npm run build`.
import {writeFile} from 'node:fs/promises';
import * as a from '../src/local/index.mjs';
const written={worldRef:'fixture-world-A',connectionRef:'fixture-connection-1',connectionIncarnationRef:'fixture-incarnation-1',selectionRevision:'selection-1'};
const receipt={contractVersion:'canvas/v7',transactionId:'house',
 operationDigest:'90f83d4d7fb4bf3a742aed41bd2c31d86c4ef4de9f11303b236722c2f445e763',
 transactionPayloadDigest:'61351fcd755fc4eaa715d05a77af6ecede3c222b5d78f26d2b34cf7612994abe',status:'VERIFIED',
 previousWorldRevision:'scope-state:ef7a5ed806a9f86b1326e5ef72103c587d80452ed2c5e18707b5cedb1ae8da31',
 observedWorldRevision:'scope-state:6424a99cc3b40a57e3c388adc8aae9fefa71764dd0692c16b59f02f2c606b117',
 readbackDigest:'6424a99cc3b40a57e3c388adc8aae9fefa71764dd0692c16b59f02f2c606b117',restoreStatus:'NOT_REQUIRED',error:null,
 localContext:written,guardRefusal:null,applyFailure:null};
const receiptDigest=a.digestValue('receipt',receipt).sha256;
const reconnected={...written,connectionIncarnationRef:'fixture-incarnation-2',selectionRevision:'selection-2'};
const otherWorld={worldRef:'fixture-world-B',connectionRef:'fixture-connection-2',connectionIncarnationRef:'fixture-incarnation-3',selectionRevision:'selection-1'};
const request=(requestId,localContext)=>({contractVersion:'world-adapter/v8',sessionRef:'fixture-session-S1',requestId,worldRef:localContext.worldRef,transactionId:receipt.transactionId,transactionPayloadDigest:receipt.transactionPayloadDigest,localContext});
const plain=q=>({contractVersion:q.contractVersion,requestId:q.requestId,result:receipt,error:null});
const pair=q=>({...plain(q),currentLocalContext:q.localContext,receiptDigest});
const same=request('query-same',written),again=request('query-reconnected',reconnected),other=request('query-other-world',otherWorld);
const W='world-adapter/v8',O='QueryTransaction';
const exchanges=[
 {title:'same incarnation, pre-2.8 shape (unchanged)',request:same,response:plain(same)},
 {title:'same incarnation, historical pair',request:same,response:pair(same)},
 {title:'after stop/reconnect, same world: receipt keeps its written context',request:again,response:pair(again)}
].map(x=>({wire:W,operation:O,...x}));
const tampered=(field,value)=>({...pair(again),result:{...receipt,[field]:value}});
const {receiptDigest:_,...onlyContext}=pair(again),{currentLocalContext:__,...onlyDigest}=pair(again);
const reject=[
 {title:'after reconnect without the pair: full equality still refuses (adapter-07 repro)',code:'CURRENT_WORLD_MISMATCH',request:again,response:plain(again)},
 {title:'receipt of another world',code:'CURRENT_WORLD_MISMATCH',request:other,response:pair(other)},
 {title:'envelope context is not the current request context',code:'CURRENT_WORLD_MISMATCH',request:again,response:{...pair(again),currentLocalContext:written}},
 {title:'receipt re-bound to the current incarnation',code:'NON_CANONICAL_AMBIGUITY',request:again,response:tampered('localContext',reconnected)},
 {title:'tampered receipt previousWorldRevision',code:'NON_CANONICAL_AMBIGUITY',request:again,response:tampered('previousWorldRevision','scope-state:'+'a'.repeat(64))},
 {title:'tampered receipt operationDigest',code:'NON_CANONICAL_AMBIGUITY',request:again,response:tampered('operationDigest','0'.repeat(64))},
 {title:'tampered receiptDigest',code:'NON_CANONICAL_AMBIGUITY',request:again,response:{...pair(again),receiptDigest:'f'.repeat(64)}},
 {title:'receipt of another transaction',code:'TRANSACTION_CONFLICT',request:{...again,transactionId:'other-transaction'},response:pair({...again,transactionId:'other-transaction'})},
 {title:'receipt of another prepared payload',code:'TRANSACTION_CONFLICT',request:{...again,transactionPayloadDigest:'e'.repeat(64)},response:pair({...again,transactionPayloadDigest:'e'.repeat(64)})},
 {title:'currentLocalContext without receiptDigest',code:'SCHEMA_INVALID',request:again,response:onlyContext},
 {title:'receiptDigest without currentLocalContext',code:'SCHEMA_INVALID',request:again,response:onlyDigest},
 {title:'pair beside an error',code:'SCHEMA_INVALID',request:again,response:{...pair(again),result:null,error:new a.ContractError('ADAPTER_UNAVAILABLE','validate','REQUIRED_FACT_UNKNOWN').publicError}},
 {title:'null is not a form of absence',code:'SCHEMA_INVALID',request:again,response:{...pair(again),currentLocalContext:null}}
].map(x=>({wire:W,operation:O,...x}));
// Expected outcomes are computed, not asserted by hand.
for(const x of exchanges)a.validateBoundResponse(x.wire,x.operation,x.request,x.response);
for(const x of reject){try{a.validateBoundResponse(x.wire,x.operation,x.request,x.response);}catch(e){if(e.code===x.code)continue;throw new Error(`${x.title}: ${e.code}`);}throw new Error(`${x.title}: accepted`);}
await writeFile('spec/local-world/fixtures/history-receipt.json',JSON.stringify({evidence:'SOURCE/FIXTURE only: receipt shape and digests from an actual adapter-07 durable VERIFIED receipt; refs are fixture refs. No world, Canvas or Adapter ran.',durable:[{receipt,receiptDigest}],exchanges,reject},null,2)+'\n');
console.log('Built history-receipt fixture',exchanges.length,'exchanges',reject.length,'rejections');

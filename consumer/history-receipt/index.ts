import {
 historicalReceipt,historicalReceiptResponse,readHistoricalReceipt,createHistoricalReceiptMock,validateBoundResponse,
 type QueryTransactionRequest,type QueryTransactionResponse,type ReceiptProjection,type LocalWorldContext,type HistoricalReceiptReading
} from 'hanaworlds-contracts';
const written:LocalWorldContext={worldRef:'w',connectionRef:'c',connectionIncarnationRef:'i1',selectionRevision:'s1'};
const now:LocalWorldContext={...written,connectionIncarnationRef:'i2',selectionRevision:'s2'};
declare const receipt:ReceiptProjection;
const request:QueryTransactionRequest={contractVersion:'world-adapter/v8',sessionRef:'S',requestId:'q',worldRef:'w',transactionId:'t',transactionPayloadDigest:'0'.repeat(64),localContext:now};
const old:QueryTransactionResponse={contractVersion:'world-adapter/v8',requestId:'q',result:receipt,error:null};
const paired:QueryTransactionResponse={...old,currentLocalContext:now,receiptDigest:'1'.repeat(64)};
validateBoundResponse('world-adapter/v8','QueryTransaction',request,paired);
const built:QueryTransactionResponse=historicalReceiptResponse(request,receipt,'1'.repeat(64));
const reading:HistoricalReceiptReading=readHistoricalReceipt(request,paired);
const incarnation:string=reading.writtenContext.connectionIncarnationRef;
const changed:boolean=!reading.sameIncarnation;
const mock=createHistoricalReceiptMock({durable:[]});
const answered:QueryTransactionResponse=mock('world-adapter/v8','QueryTransaction',request);
const fields:readonly ['currentLocalContext','receiptDigest']=historicalReceipt.fields;
// @ts-expect-error the pair has no null form.
const nulled:QueryTransactionResponse={...old,currentLocalContext:null};
// @ts-expect-error the mock answers only QueryTransaction.
mock('canvas/v7','SelectWorldConnection',request);
void [written,built,incarnation,changed,answered,fields,nulled];

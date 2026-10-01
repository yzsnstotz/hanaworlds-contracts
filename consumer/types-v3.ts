import {
  validateRequest, validateBoundRequest, admitRequest, digestValue,
  type TypeMap, type OperationMap, type WireVersion,
} from 'hanaworlds-contracts/v3';
import * as Canvas from 'hanaworlds-contracts/canvas/v3';
import * as Adapter from 'hanaworlds-contracts/world-adapter/v3';
import { evaluateV3Fixture } from 'hanaworlds-contracts/v3/fixture';
import { schemaInventory } from 'hanaworlds-contracts/v3/schemas';

const raw: unknown = {};
const apply: TypeMap['ApplyRecoverableCommitRequest'] = validateRequest('canvas/v3', 'ApplyRecoverableCommit', raw);
const bound: TypeMap['ApplyRecoverableCommitRequest'] = validateBoundRequest('canvas/v3', 'ApplyRecoverableCommit', raw);
const admitted: TypeMap['ApplyRecoverableCommitRequest'] = admitRequest('canvas/v3', 'ApplyRecoverableCommit', new Uint8Array());
const history: TypeMap['HistoryOperationProjection'] = {} as TypeMap['HistoryOperationProjection'];
const digest: string = digestValue('history-operation', history).sha256;
const prepared: TypeMap['PrepareHistoryTransactionRequest'] = Adapter.validate('PrepareHistoryTransaction', raw);
const query: TypeMap['QueryPreparedTransactionRequest'] = Adapter.validate('QueryPreparedTransaction', raw);
const object: TypeMap['CreateObjectRequest'] = Canvas.validate('CreateObject', raw);
const wire: WireVersion = 'world-adapter/v3';
const request: OperationMap['world-adapter/v3']['PrepareHistoryTransaction']['request'] = prepared;
const typeName: keyof TypeMap = schemaInventory[0]!;
const fixtureOutcome = evaluateV3Fixture('CreateObjectRequest', object, { trustedCanvasDomain: false });

// @ts-expect-error v2 mutation is never admitted by the v3 lane
validateRequest('canvas/v2', 'ApplyRecoverableCommit', raw);
// @ts-expect-error history-operation is the only new digest kind
digestValue('unapproved-v3-digest', history);
// @ts-expect-error a Canvas operation is not an Adapter operation
Adapter.validate('CreateObject', raw);

void [apply, bound, admitted, digest, query, wire, request, typeName, fixtureOutcome];

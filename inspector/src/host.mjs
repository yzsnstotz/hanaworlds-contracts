import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol';
import { describeInspector, inspectJSON } from './inspection.mjs';

const remoteInitializers = [];
export class ContractInspectorService extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, 'contractInspector');
    for (const initialize of remoteInitializers) initialize.call(this);
    describeInspector(); // Fail activation on an incorrect Contracts version.
  }
  describe() { return describeInspector(); }
  inspect(kind, jsonText) {
    const result = inspectJSON(kind, jsonText);
    this.ctx.logger('contract-inspector').info('inspect %s: accepted=%s contracts=%s', kind, result.accepted, result.contractsVersion);
    return result;
  }
}
// Standard public decorator API, invoked explicitly because this package uses
// plain JavaScript. Gateway's documented SRC-mode discovery reads these markers.
for (const name of ['describe', 'inspect']) {
  Remote(ContractInspectorService.prototype[name], {
    kind: 'method', name, static: false, private: false,
    addInitializer(initialize) { remoteInitializers.push(initialize); },
  });
}
export const name = 'hanaworlds-contract-inspector';
export const inject = ['typertGateway'];
export function apply(ctx) { ctx.plugin(ContractInspectorService); }

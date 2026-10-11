# World lifecycle · 2.3.0 additive minor

The existing 2.2.1 types, operations, wire identifiers and digest domains remain
unchanged. Three new wires implement the approved major-2 contracts. Import
schemas, generated types and validators from `hanaworlds-contracts`; provider
plugins depend on the Git release `git+https://github.com/yzsnstotz/hanaworlds-contracts.git#semver:^2.3.0`.

| Contract / wire | Provider → consumers | Operations |
| --- | --- | --- |
| C-world-lifecycle / `world-lifecycle/v2` | local-runtime → desktop-bridge, shell-ui | describe, list, create, describeDelete, delete, launch, stop, play |
| C-engine-runtime / `engine-runtime/v2` | local-runtime → adapter | StartWorldRuntime, StopWorldRuntime, ReadRuntimeStatus |
| C-local-worlds / `local-worlds/v2` | adapter → local-runtime | discover, createWorld, pair, deleteWorld |

All requests contain `contractVersion`, `requestId` and their declared inputs.
All responses contain `contractVersion`, the same `requestId`, and `result` XOR
`error` (the other is null). Shapes are closed except the explicitly opaque JSON
fields. `worldLifecycle.operations` declares every request/response type and
operation-specific business error code. Strict admission rejects unknown keys,
duplicate decoded JSON keys, non-JSON/executable values and wrong wire versions.
`validateBoundResponse` additionally checks shared selectors: worldId/worldRef,
connectionRef, templateId, displayName and confirmationName. Transport/schema
admission errors throw `ContractError`; they are distinct from an admitted
provider refusal. Existing `Error` fields and vocabulary are reused unchanged.

`describe` returns provider-owned templates (`templateId`, `label`), `canDelete`,
`canPlay` and prerequisites (`prerequisiteId`, `label`, `satisfied`). Template and
prerequisite ids are unique. `list` and `discover(worldRoot)` return a `worlds`
inventory with unique worldId/worldRef; each row has displayName and tags. The
root locator is owned and canonicalized by Adapter; it is never a worldRef.
`create(templateId, displayName)` and `createWorld(templateId, displayName)` return
the selected template, name, world reference and creationFacts. A template id
names a world-source template; no flat-map setting or other engine-specific
choice is part of this contract. Providers decide which names are legal and
return INVALID_NAME; the shared contract does not impose an engine name policy.

**Opaque values.** creationFacts and StartWorldRuntime.engineProfile have type
`OpaqueValue` (`unknown` in TypeScript). Any strict JSON value, including null,
is admitted. The world source owns its meaning. Bridge, shell and other hosts
carry creationFacts unchanged to the skill, without interpreting or extracting
engine settings. No lifecycle-specific digest projection is added; existing
`requestDigest` binds all fields, including opaque inputs, using the existing
canonicalization rule. Source-facts and all older digest domains stay unchanged.

`describeDelete(worldId)` returns worldRef, the current confirmationName and
provider-owned impacts. `delete(worldId, confirmationName)` and
`deleteWorld(worldRef, confirmationName)` return a matching confirmation and
`deleted: true`. The provider must recheck the current name. Before delete,
desktop-bridge must establish that no session currently selects that world;
contracts JSON cannot prove this product fact. A conflicting name or selection
returns TRANSACTION_CONFLICT. canDelete is a declaration of support, not an
assertion that a particular world can be deleted now.

`launch(worldId)` returns worldId, worldRef and both connection references.
`StartWorldRuntime(worldRef, engineProfile)` returns that world, both connection
references and RUNNING. `pair(worldRef)` returns the existing complete
LocalConnectionReadback; its worldRef must match both the requested world and
capabilities.worldRef. Each provider must obtain these from actual readback,
including the current incarnation; a stale fixture or request is not evidence.
`stop` and StopWorldRuntime take connectionRef and return STOPPED for that
connection. ReadRuntimeStatus reports RUNNING, STOPPED or UNKNOWN alongside the
world and both connection references. UNKNOWN supplies no running/stopped fact.

`play(worldId)` is available only when the provider's canPlay is true; otherwise
return CAPABILITY_UNAVAILABLE. ENTERED means the graphical client actually
entered that world. Starting a process, completing an HTTP call or waiting for
a timer is insufficient to claim ENTERED or STOPPED. Providers are responsible
for process/connection freshness and exact retries, with no side effects in this
pure contracts package.

## Examples and fixture-only provider

`hanaworlds-contracts/fixtures/world-lifecycle` contains 15 successes and all 23
operation-specific refusals. `createWorldLifecycleMock(fixture, refusals)` is
exported in the packed module; refusal keys use `${wire}:${operation}`. It admits
the supplied corpus, copies responses, echoes a new requestId and refuses
unavailable fixture selectors or wrong delete confirmations. It is stateless:
create does not change list, stop does not change status, and it performs no
filesystem, world, process or UI work. The fixture's capabilities describe only
the fixture. Use it as a counterparty in independent consumer tests, not as
runtime evidence. `WorldLifecyclePort`, `EngineRuntimePort` and `LocalWorldsPort`
declare the Promise-based provider interfaces.

```js
import {
  createWorldLifecycleMock, validateBoundResponse
} from 'hanaworlds-contracts';
import fixture from 'hanaworlds-contracts/fixtures/world-lifecycle'
  with { type: 'json' };
const provider = createWorldLifecycleMock(fixture);
const request = {
  contractVersion: 'world-lifecycle/v2', requestId: 'consumer-describe'
};
const response = provider('world-lifecycle/v2', 'describe', request);
validateBoundResponse('world-lifecycle/v2', 'describe', request, response);
```

Validation: `npm test`, `npm run typecheck:world-lifecycle`,
`npm run test:conformance`, `npm run verify:source`. Evidence is SOURCE/PACK/FIXTURE;
peer runtime, engine and UI validation remain separate cards.

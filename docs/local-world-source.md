# C-local-worlds · source description in 2.5.0

`local-worlds/v2` adds the read-only operation `describeSourceWorld`, provided by
Adapter to its paired local-runtime world source. Its request is exactly
`{contractVersion, requestId, worldRef}`. Its receipt is exactly
`{contractVersion, requestId, result, error}`, with result/error mutually exclusive
and the unused field null. Success has `result={worldRef, sourceLocator}`;
sourceLocator uses the existing `OpaqueValue` and admits any strict JSON, including
null. No new error structure or vocabulary is introduced.

Success must describe the exact requested worldRef and echo requestId. Names are
not identities: two worlds may have the same displayName but different worldRefs
and locators. `validateBoundResponse` rejects another reference with
CURRENT_WORLD_MISMATCH and another requestId with TRANSACTION_CONFLICT, even for
a refusal. Unknown envelope/result fields and non-JSON/executable values reject.

| Provider business error | Meaning |
| --- | --- |
| WORLD_NOT_FOUND | Requested source world does not exist. |
| ADAPTER_UNAVAILABLE | Adapter/world source cannot currently supply the read. |
| CURRENT_WORLD_MISMATCH | Source identity or reference is inconsistent with the requested world. |

sourceLocator describes location information at read time. Only the paired
Adapter/local-runtime world source interprets its meaning and rechecks current
identity/location before use. It grants no launch, write or delete authority and
is not proof of durable identity or freshness. It must not flow into any host
field of C-world-lifecycle, including creationFacts. Hosts must not extract engine
paths/settings from it. creationFacts and every previous operation/input/output
and digest rule retain their original meaning and shape.

`LocalWorldsPort.describeSourceWorld?` is optional: old providers and consumers
still compile. Consumers must explicitly report CAPABILITY_UNAVAILABLE when the
method is missing; absence must not synthesize a locator or imply a successful
read. The exported consumer helper checks this and strictly validates both input
and the bound provider receipt, preserving the provider method's `this` context.

```ts
import {describeSourceWorld, type LocalWorldsPort} from 'hanaworlds-contracts';
async function readInsideWorldSource(adapter: LocalWorldsPort, worldRef: string) {
  return describeSourceWorld(adapter, {
    contractVersion: 'local-worlds/v2', requestId: 'source-description', worldRef
  });
}
```

The schema/type names are `LocalWorldsDescribeSourceRequest`,
`LocalWorldsDescribeSourceResponse` and `LocalWorldsSourceDescription`; the root
package exports types, validators, operation metadata, `describeSourceWorld`
and `createLocalWorldSourceMock`. The existing wildcard export publishes
`hanaworlds-contracts/fixtures/local-world-source`, containing two same-name world
successes and all three business refusals. The old world-lifecycle fixture remains
unchanged. The fixture-only mock returns supplied observations selected by exact
worldRef, echoes each new requestId, and returns WORLD_NOT_FOUND for an unknown
world. An optional second argument forces one declared business refusal. It has
no filesystem/process/world effects and supplies no actual runtime evidence.

```js
import {createLocalWorldSourceMock} from 'hanaworlds-contracts';
import fixture from 'hanaworlds-contracts/fixtures/local-world-source'
  with {type: 'json'};
const describe = createLocalWorldSourceMock(fixture);
describe({contractVersion: 'local-worlds/v2', requestId: 'fixture-read',
  worldRef: 'source-world-a'});
```

Formal release: `v2.5.0`. Adapter and runtime use the released package
`git+https://github.com/yzsnstotz/hanaworlds-contracts.git#semver:^2.5.0`; record the
exact resolved tag/commit in their receipts. No workspace/vendor substitute.
Validation: `npm test`, `npm run typecheck:world-lifecycle`,
`npm run typecheck:local-world-source`, `npm run test:major-compat`,
`npm run test:conformance`, `npm run verify:source`. Evidence is SOURCE/PACK/FIXTURE;
actual Adapter/local-runtime source reads and product acceptance belong to peers.

## Optional source startup facts · 2.13.0

`LocalWorldsSourceDescription.sourceStartupFacts?: OpaqueValue` is a second, optional
world-source-owned JSON observation. It does not change `sourceLocator`, previous
operations, requests, creationFacts, or digests. Old provider shapes and consumers
that do not need startup facts remain valid with this SDK. A consumer that needs
these facts must pin at least v2.13.0 and refuse their absence explicitly; an older
closed-schema SDK must be upgraded before consuming the new field.

Only the paired adapter/local-runtime world source interprets the value. Hosts,
clients and other plugins must neither extract engine fields nor forward this
observation as product input or lifecycle authority. The source supplies facts from
its current, verified payload; request JSON cannot supply mod identities or broaden
permissions. The paired runtime rechecks world/directory/payload identity before
each native launch. Missing, forged or stale facts are not authorization. The
opaque observation is allowed to describe an unavailable prerequisite; that is not
a successful launch. `fixtures/source-startup` demonstrates renamed and
heterogeneous source shapes with no common engine fields.

Identity semantics remain unchanged: `Frame.frameId` and `providerRef` are opaque
identities, even when their strings contain an engine name. `MaterialSpec.extension`
is opaque: baseline extensions such as `param2Type` and `collisionBoxes` retain their
source meaning and are not interpreted by non-world-source consumers. Visible grid
units and geometry values use the existing neutral schema. No lexical renaming of
opaque identity/extension data is a neutrality proof.

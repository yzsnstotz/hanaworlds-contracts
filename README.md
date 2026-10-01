# hanaworlds-contracts 0.1.1

Independent **non-runtime** contracts package implementing the approved HanaWorlds v2 profile. This repository does not register a gadget, establish a grant, instantiate a Session/store/transport, connect to an engine or write to a world. Provider gates remain `NOT_RUN`.

This is the 0.1.1 v2 source baseline for the planned contracts@0.2.0 v3 work. It includes the CA-02-INVALID patch-field correction without changing the seven v2 wires, operations/v2, the contracts@0.1.0 digest domain or the 19 production digest goldens. The task branch is not a v3 implementation, admitted release, registry publication or product acceptance. Its public origin is [yzsnstotz/hanaworlds-contracts](https://github.com/yzsnstotz/hanaworlds-contracts).

HanaWorlds original code is MIT-licensed; the separate Apache-2.0 upstream source fixture retains its own license. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

## Public surface

The root export contains strict admission, typed validation, immutable protocol inventories, explicit production projections and digest functions. The eight versioned subpaths are `interaction-surface/v2`, `world-adapter/v2`, `canvas/v2`, `session/v2`, `painter/v2`, `ReferenceBrief/v2`, `BUILD/V2`, and `operations/v2`. Case is significant. The first seven expose `validate`, `admit` and `response`. Canvas also exposes `event`; operations exposes `validate`, `admit`, `digest` and `validateCompiledSet`. Painter preserves the explicit alternate `ClarificationNeed` result rather than inventing a Build.

All 243 named types are emitted as TypeScript declarations and self-contained Draft-07 schemas. `schema-inventory` inventories the 244 schema documents, eight bindings, 38 operations, 14 Canvas event types, and 19 digest projections. JavaScript ES modules and TypeScript declarations are the minimum closed language bindings; no Lua provider is included. JSON Schema establishes structure; the public validators also enforce local normative domain invariants. Cross-provider authenticity, durable storage and engine safety cannot be inferred from structurally valid fields.

```js
import { admitRequest, digestValue, runtimeCompatibility } from 'hanaworlds-contracts';
import * as Canvas from 'hanaworlds-contracts/canvas/v2';

// bytes are Uint8Array received at the caller's own boundary.
const request = admitRequest('canvas/v2', 'SetObjectSelection', bytes);
// Canonical digests accept exact declared projection objects, never arbitrary JSON.
const receiptDigest = digestValue('receipt', typedReceiptProjection).sha256;
const compatibility = runtimeCompatibility();
```

## Admission and projection boundaries

`decodeRawJSON` validates strict UTF-8, JSON grammar, duplicate **decoded** keys and Unicode scalars. It rejects overflow/non-finite numbers and never applies a reviver or full-document `JSON.parse`. The explicit stack does not impose an invented nesting limit. `snapshotJSON` uses descriptors, rejects proxies, getters, functions, symbols, custom prototypes, cycles, boxed values, sparse arrays and extra array properties, and never calls `toJSON`. It detaches inputs into plain JSON before validation. Public error values contain only the seven frozen fields, not exception text or private payloads.

`admitType`, `admitRequest` and `digestRaw` are raw-byte admission entry points. `validateType`/`validateRequest` accept already-decoded pure JSON but cannot recover whether an upstream decoder discarded duplicate keys; network callers must use raw admission before any provider query. `validateBoundRequest` checks carried digest and identity coherence without authenticating the caller. `validateWitnessCoherence` checks supplied facts but never returns an authorization grant. Pure validations return immutable detached values and do not sort, deduplicate, normalize refs, round coordinates or inject defaults.

Each digest uses the exact type declared in `digestProfile.projectionTypes` and invokes the pinned `canonicalize@5.1.0` implementation directly. The prefix is `HanaWorlds|contracts@0.1.0|<kind>\n`. No recursive deletion is performed. `projectField(kind, sourceType, source, field)` admits a complete declared wrapper and extracts the typed field; loose undeclared wrapper fields are rejected. Nested state-record metadata/inventory/timers and nested digest fields are retained.

Naming is separate: forbidden characters are rejected before trim; display text retains its trimmed original form and comparison keys use NFC then ASCII-only case conversion. `normalizeName` refuses to create persistent keys unless the actual Node/ICU runtime declares Unicode **17.0** and passes the compatibility checks. Ordinary refs never use this function. The source reference runtime was Node 24.13.1; each new runner must record its own actual version and compatibility result.

## Build and validation

On a compatible, isolated environment with public registry access:

```sh
npm ci --ignore-scripts
npm run build
npm run typecheck
npm run compat
npm run test:strict
npm test
npm run pack:artifact
```

`package-lock.json` pins canonicalize 5.1.0 and TypeScript 5.8.3 to their public npm registry integrities. Historical return evidence is not part of this source repository and does not prove the current branch's build or installation.

An explicit diagnostic command, `npm run test:source-fixture`, maps the bare canonicalize import to the unchanged approved upstream source snapshot through a **test-only loader**. It permits source/fixture checks when npm is unavailable. It is not a production fallback, an installed registry dependency, or package REAL_RUNTIME installation evidence. The loader is outside the npm artifact. Standard `npm test` does not silently use it.

`hanaworlds-contracts/fixture` exports pure, clearly named fixture evaluators for authorization ordering, replay, recovery, history, retention, deletion and event eligibility. Inputs are synthetic explicit facts; no expected outcomes or fixture IDs are passed to semantic evaluators. Reported oracle `worldWrites` values are modelled counters, not actual effects. The actual number of world writes/provider queries is zero. Query success alone never implies a changed event. Source snapshots under `spec/` are evidence only, not runtime engine dependencies.

This branch's public source and MIT license do not prove contracts@0.2.0, clean-host installation, provider conformance, release, deployment or user acceptance.

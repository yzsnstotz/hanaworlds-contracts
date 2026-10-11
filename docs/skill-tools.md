# Skill tools · 2.6.0 · skill-tools/v1

Approved C-session, C-painter and C-skill declarations. This minor adds public
schemas and operations; all previous action branches, operations and digest rules remain.
Session `/v5` advertises minor 2, skill `/v1` minor 1; Painter `/v6` retains minor 1. C-skill is major 1 at
`skill/v1` inside the major-2 contracts package.

Install the formal Git release:

```json
{"dependencies":{"hanaworlds-contracts":"git+https://github.com/yzsnstotz/hanaworlds-contracts.git#semver:^2.6.0"}}
```

```js
import {toolManifest, buildingSkill, validateToolRequest, validateToolResponse,
        createSkillToolsMock} from 'hanaworlds-contracts';
import tools from 'hanaworlds-contracts/tools' with {type:'json'};
import skill from 'hanaworlds-contracts/skill' with {type:'json'};
```

`/tools` lists all seven names, provider, contract, wire, operation, request,
response, model input schema, output schema, actions and each action's errors.
Its `definitions` resolve every `#/definitions/...` reference within the JSON
file itself. `/skill` exports the current-turn input/output schemas and skill
description with the same complete definitions. Root exports are frozen runtime
metadata. `/schema` and `/profile` continue to expose the full public protocol.
`/fixtures/skill-tools` is the public success/refusal fixture. TypeScript has
ToolMap, model input types, typed envelopes and Promise port interfaces.

| Tool | Provider | Actions | Input | Successful output |
|---|---|---|---|---|
| hanaworlds_context | Workshop | read | no model facts | current LocalWorldContext, selected objects, placement target, EngineFacts and CatalogueFacts |
| hanaworlds_proposal | Workshop | validate | BuildProposal | Painter-validated BuildPlan, pending proposalRef, confirmed=false |
| hanaworlds_region_proposal | Workshop | validate | RegionProposal with voxel-grid/v1 discriminator and opaque palette | Painter-validated RegionBuildPlan, pending proposalRef, confirmed=false |
| hanaworlds_build | Workshop | apply / inspect / undo / redo / build | build: neutral BuildProposal or RegionProposal; apply: confirmedProposalRef; inspect/undo/redo: no model facts | build/apply: BuildEntryOutcome; inspect: CurrentUndoStatus and current receipt; undo: CurrentBuildUndoResult; redo: ReceiptProjection |
| hanaworlds_write_methods | Workshop | read | no model facts | EngineFacts.writeMethods (purpose, typical scale, source geometry and partition) plus CatalogueFacts |
| hanaworlds_download_image | Workshop | download | HTTP(S) image URL | conversation attachmentRef plus actual ImageBytes |
| hanaworlds_image_material | Painter | match | ImageBytes; CatalogueFacts injected by host | main colour matches with legal opaque materialRef, source material colour and CIEDE2000 deltaE; modelCalls=0 and worldWrites=0 |

The JSON declaration is the authoritative action/error inventory. Structural
admission can raise the existing decode/validation errors even for tools whose
baseline has no business errors (write_methods). A host must gate an unbound
world before calling write_methods; C-skill can return WORLD_NOT_BOUND.

## Host and provider boundaries

The model sees only each `inputSchema` and returns its corresponding input.
`hostContext` is a separate required envelope field injected from independently
read host state: sessionRef, turnRef, turnRevision and nullable LocalWorldContext.
The model cannot put session/world/connection fields or a confirmation boolean
in any model input. For image_material the host also injects fresh CatalogueFacts
at the envelope root. A model cannot register or rename actions.

Providers call `validateToolRequest(name, request, independentlyReadHostFacts)`
before invoking their implementation, and `validateToolResponse` on the response.
The validators admit closed JSON, bind request IDs and actions, compare host
session/turn/world facts and source connections, and check declared error codes.
A shape-valid self-reported host envelope is never independent host evidence.
The contracts cannot authenticate a source or prove that a provider read it.

Workshop resolves proposal references in its own current session/turn/world
state and forwards the existing ValidateBuildProposal/ValidateRegionProposal
requests with current confirmed intent, catalogue, target facts and safety
witnesses to Painter. A proposal response remains pending. `apply` succeeds only
for the exact proposal confirmed through the host's existing interaction path;
unknown/unconfirmed references return INTENT_UNCONFIRMED. Model text never
supplies confirmation. Other objects affected must return OTHER_OBJECTS_AFFECTED;
no broader scope is inferred. Unbound context/build returns WORLD_NOT_BOUND.
All world/engine/material facts come from source reads; no engine vocabulary,
fixed chunk size or guessed write backend belongs in the skill.

`RedoCurrentBuild` is an additive session/v5 call alongside UndoCurrentBuild.
It takes the same current session/world and expected turn/history revisions,
resolves the undoable current build from Workshop state, and calls existing
Canvas `RedoRequest` / `RedoReceipt`. Canvas owns transaction IDs, before/after
state, conflict checks, readback and durable history. The returned receipt and
existing guard refusal are relayed unchanged. No second apply or reconstructed
model proposal replaces Redo. `hanaworlds_build` action redo exposes its receipt;
STALE_TRANSACTION, TRANSACTION_CONFLICT and WORLD_NOT_BOUND are public refusals. Existing CAPABILITY_UNAVAILABLE, SAFETY_INVARIANT_FAILED and
RESTORE_FAILED also relay on mutating actions, with guardRefusal beside the error.
Receipts carry the actual readback digest; they do not by themselves prove a
real world read or durable storage.

`ImageBytes` carries actual base64 bytes, supported image mediaType, byteLength
and SHA-256 bytesDigest. Admission validates canonical base64, byte count and
byte integrity. The real downloader must validate actual decoded image type,
persist the conversation attachment and return its reference. Contracts do not
fetch URLs, decode images or label a fixture as a download.
Painter owns colour extraction and nearest legal source-material selection with
CIEDE2000 (D-13/D-16). Admission checks that returned material references exist,
are statically placeable, have known orientations/revision, exclude the source's
empty material and retain its declared colour. It does not claim to calculate
CIEDE2000 or prove the nearest colour; that is Painter's implementation gate.

## hanaworlds-building · C-skill

Input is the current turn's text and `Media` attachment references (including
stored bytes digest/type/size); current session, turn and world are host-injected.
Output is a clarification question, structured per-cell or region proposal, or a tool call
whose tool name and arguments conform to one of these seven schemas. Skill
chooses per-cell versus region writes using current write-method declarations.
No old draft's unapproved action is imported. The existing apply path requires a host-confirmed proposal; the direct build path requires the current user request authorization described below. The skill description, request, response and errors
are exported in the installed package; skills-01 can reference formal 2.6.0, full tag `refs/tags/v2.6.0` and the remote source SHA in contracts-direct-build-01 REPORT.

## Verification and fixture-only mock

`npm test` includes tool, skill and session/Canvas Redo admission and negative
boundaries. `npm run typecheck:skill-tools` checks a separate typed consumer.
`node tools/build-skill-tools-fixture.mjs` regenerates 40 tool exchanges and 8
skill/Redo examples from published fixtures and deterministic bytes.
`createSkillToolsMock(fixture, refusalCodes)` returns only supplied examples
matching the model input, host context and source facts; it rejects unmatched
invocations and never guesses results. Refusal keys are `toolName:action`.
The mock makes zero network/model/image matching/world calls. Evidence is
SOURCE/FIXTURE and installed-consumer verification, separate from REAL_RUNTIME,
REAL_UI and owner acceptance.

## Direct build · approved J3.S1 / Q-26

`ToolDirectBuildInput` is exactly `{action:"build", proposal}`. `proposal` is
`BuildProposal` (`decision:"BUILD"`) or `RegionProposal` (`decision:"REGION"`),
with the existing neutral geometry/material schema. The successful
`ToolDirectBuildResult` is `{action:"build", outcome: BuildEntryOutcome}`.
The model has no session, world, confirmation, authorization identity or host
facts input. `clear:true`, `confirmed:true` and model-supplied authorization are
unknown fields. A valid proposal shape does not supply authorization.

The **current real user request itself** is the approved direct-build path's user
input. A clear request does not require another confirmation reply. Ambiguous
size, placement, material or scope remains on the pending proposal/clarification
round trip and formal confirmation path. `apply` still takes only the exact
`confirmedProposalRef`; proposal tools still return `confirmed:false`.

### Host authorization handoff

The host independently reads the current real user message, stores it under the
current session/turn revision/world and determines its allowed intent scope.
It must establish that the neutral proposal fits that scope using its own
current user input and policy, never a model declaration or shape validation.
An unknown range or unconfirmed change has **no authorization** and returns
`INTENT_UNCONFIRMED`. Authorizing an exact proposal is the narrowest permitted
scope; it does not grant a world-wide mutation permission.

New public types:

- `CurrentBuildUserRequest`: `messageRef`, actual `text`, actual `Media` references.
- `HostBuildIntentAuthorization`: the existing `ToolHostContext` fields,
  `messageRef`, `messageDigest`, `intent: ConfirmedIntent`, `proposalDigest`.
  Its intent is the host-established BUILD_STRUCTURE scope (including dimensions,
  site rules and optional confirmed placement). `confirmedTurnRevision` is the
  current request's authorized revision; it does not demand a second user reply.
- `ToolBuildHostFacts`: the existing host context fields, with optional
  `currentUserRequest` and stored `intentAuthorization` read independently.
- `ToolBuildRequest.intentAuthorization`: optional host-injected envelope carrier.
  It is never part of `ToolBuildInput` or a model input schema.

Both digests are lowercase SHA-256 of RFC 8785 canonical JSON encoded as UTF-8:
`messageDigest` covers the entire `CurrentBuildUserRequest`, including its message
reference, text and attachment references; `proposalDigest` covers the entire
neutral proposal. These hashes have no authority by themselves. Existing digest
projections and domain-separated digests are unchanged.

```js
import {createHash} from 'node:crypto';
import {canonicalJSON, validateToolRequest} from 'hanaworlds-contracts';
const sha = value => createHash('sha256').update(canonicalJSON(value), 'utf8').digest('hex');
// Independently read host state; never construct facts from a tool/model envelope.
const facts = host.readCurrentBuildFacts();
const proposal = modelInput.proposal;
const authorizedIntent = host.resolveAllowedBuildIntent(facts.currentUserRequest, proposal);
// Unknown/ambiguous/changed scope: return INTENT_UNCONFIRMED, do not mint a carrier.
const intentAuthorization = host.storeAuthorization({
  ...facts.context,
  messageRef: facts.currentUserRequest.messageRef,
  messageDigest: sha(facts.currentUserRequest),
  intent: authorizedIntent,
  proposalDigest: sha(proposal)
});
const request = {
  contractVersion: 'session/v5', requestId: host.newRequestId(),
  hostContext: facts.context, input: {action: 'build', proposal}, intentAuthorization
};
validateToolRequest('hanaworlds_build', request, host.readCurrentBuildFactsForValidation());
```

The host adapter functions in this example belong to the host implementation;
they are not contracts exports. The authorization must match stored readback
exactly. Validation compares session/turn (`TRANSACTION_CONFLICT`), current
revision and intent revision (`TURN_REVISION_MISMATCH`), full current local-world
context (`CURRENT_WORLD_MISMATCH`), current message reference/content digest,
authorized intent and exact proposal digest (`INTENT_UNCONFIRMED`). An unbound
world returns `WORLD_NOT_BOUND`. Old messages cannot be reused even when text is
identical. Before every execution or replay, including after any async stage,
the host rechecks current facts. A changed request needs a new authorization;
there is no implicit authorization extension. The host owns authenticity and
atomic consumption/current-state checks; this pure package checks correlation.

`validateRequest`/`admitRequest` admit structural wire data only.
`validateToolRequest` with independent `ToolBuildHostFacts` is the mandatory
semantic authorization gate. `validateToolResponse` checks request/action/outcome
binding and carrier coherence on success; it cannot independently read host
state. Missing authorization can be reported through a legal error response.
Old apply/inspect/undo/redo calls and old implementations retain their legal
request shapes and need no added port method or authorization field.

### Mandatory execution order and refusals

After consuming the current authorization, Workshop builds the existing Painter
request from host-established intent, current world/source facts, placement
inspection and safety witnesses. It dispatches `ValidateBuildProposal` for BUILD
or `ValidateRegionProposal` for REGION. Painter validation is mandatory before
existing Brush/Canvas compilation and submission. Current-world facts, exact
placement checks, capability coverage and non-disableable engine/body/hazard
safety invariants remain mandatory at inspection and commit. Direct build does
not relax any existing safety or readback checks or invent an Adapter backend.

`OTHER_OBJECTS_AFFECTED` always refuses and requires the existing continue
confirmation flow; current direct-build authorization cannot authorize that
broader scope. Legal action errors are listed per action in `/tools`, including
`CAPABILITY_GAP`, `CAPABILITY_UNAVAILABLE`, `SAFETY_INVARIANT_FAILED`, missing/stale
intent/facts and existing Painter/apply/restore errors. Existing `Error` and
`guardRefusal` carriers are used unchanged. No error word or old action/error
relation was changed.

`/fixtures/direct-build` publishes BUILD and REGION successes, all 17 declared
refusals for each, independent mock hostFacts, and two C-skill direct tool calls.
`createSkillToolsMock` consumes these hostFacts explicitly, checks authorization
before selecting a supplied response and never performs world/model/network
calls. A fixture provider is not proof of a host reading a real user request or
of Painter/Brush/Canvas execution. `consumer/direct-build` and an independently
installed packed consumer exercise this exported API. Real Workshop execution,
real world/UI and owner acceptance remain downstream gates.

Reproduce the independent installed-consumer and old-provider checks from the
module checkout (all evidence/cache/archive files stay in the supplied directory):

```sh
npm run test:direct-build-consumer -- /absolute/card-run/consumer-gate
```

This gate packs the current release and immutable `v2.5.0`, installs both into a
separate consumer, runs the 14 tool/authorization tests, TypeScript checks and
40 old-provider exchanges. It requires Node 24+, Git `v2.5.0`, and the existing
registry dependencies. It does not change a peer implementation.

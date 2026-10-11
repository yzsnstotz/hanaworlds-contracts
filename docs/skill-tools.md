# Skill tools · 2.4.0 · skill-tools/v1

Approved C-session, C-painter and C-skill declarations. This minor adds public
schemas and operations; all 2.3.0 definitions, operations and digest rules remain.
Session `/v5` and Painter `/v6` now advertise minor 1. C-skill is major 1 at
`skill/v1` inside the major-2 contracts package.

Install the formal Git release:

```json
{"dependencies":{"hanaworlds-contracts":"git+https://github.com/yzsnstotz/hanaworlds-contracts.git#semver:^2.4.0"}}
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
| hanaworlds_build | Workshop | apply / inspect / undo / redo | apply: confirmedProposalRef; other actions: no model facts | apply: BuildEntryOutcome; inspect: CurrentUndoStatus and current receipt; undo: CurrentBuildUndoResult; redo: ReceiptProjection |
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
No old draft's unapproved action is imported. Only host-confirmed proposals can
advance through Workshop. The skill description, request, response and errors
are exported in the installed package; skills-01 can reference formal 2.4.0,
full tag `refs/tags/v2.4.0` and the remote source SHA in contracts-05 REPORT.

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

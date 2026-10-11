# C-canvas / C-session · world context on the public Error in 2.7.0

The public `Error` gains one optional field, `worldRef: Ref`. It names the target
world the admitted operation actually needed. It is not the currently available or
selected world, not a file path and not a display name.

The seven existing fields (`code`, `phase`, `retryability`, `mutationState`,
`transactionRef`, `causeCode`, `reason`) and their vocabulary and meaning are
unchanged. The world reference is never encoded into `reason` or `transactionRef`,
and no free `message`, path, credential or stack field is added: the Error stays
closed (`additionalProperties:false`).

## Absence and null

Absent keeps exactly the previous meaning: the error carries no world context.
There is no null form; a provider omits the field when it cannot determine a target.
(The canvas-05 request suggested `Ref` or null. This package's `protocolPolicy.minor`
only admits optional fields without a null form, because a second encoding of "no
world" would change digests and `tools/compare-major.mjs` would classify it as
breaking.)

## Who may set it

| Request carries | Error `worldRef` |
| --- | --- |
| top-level `worldRef`, `localContext.worldRef`, or host-injected `hostContext.localContext.worldRef` | must equal that selector; another reference rejects with `CURRENT_WORLD_MISMATCH` |
| no world selector | set only by the provider from its own trusted current-Session/operation binding; otherwise omitted |

Model input, raw JSON, another Session and exception messages never provide the
target. Consumers cannot verify a selector-less binding and must not treat the
field as a selection; it only explains which world was needed.

## SDK

- `new ContractError(code, phase, reason, {…, worldRef})` → `publicError.worldRef`
  and the `worldRef` getter. Without `details.worldRef` the result is byte-identical
  to 2.6.0. A non-empty string is required; anything else is a `TypeError`, never
  silently dropped.
- `publicError(error)` keeps the field; a plain `Error` never acquires one.
- `validateType('Error', …)`, `validateResponse` and `validateBoundResponse` keep
  the field; `validateBoundResponse` enforces the selector binding above.
- `requestWorldSelectors(request)` lists the selectors a request carries.
- Provider helpers: `targetWorldRef(request, trustedSessionWorlds)` (selector,
  else trusted `sessionRef → worldRef` binding, else `undefined`; two different
  selectors reject) and `worldUnavailableError(request, errorTemplate, trusted)`
  (keeps every existing field, including `mutationState`; a template that already
  names a world is a `TypeError`).
- `createWorldErrorMock(fixture)` is the minimal stateless provider over
  `hanaworlds-contracts/fixtures/world-error`.

## Fixture

`hanaworlds-contracts/fixtures/world-error` holds `trustedSessionWorlds`, success
and failure `exchanges` (request selector, host-injected tool context, trusted
Session binding, no context), `legacy` (pre-2.7 seven-field error;
`mutationState: UNKNOWN` with `transactionRef` beside `worldRef`) and `reject`
cases (wrong world, empty/null/non-string reference, reference in `reason`,
`message`, path, stack, credential). SOURCE/FIXTURE evidence only.

## Compatibility

Same package major (`same-major`); no protocol minor requirement is added. Old
errors without the field remain valid with unchanged digests. A 2.6.0 or older
SDK is a closed decoder: it refuses an error carrying `worldRef` with
`UNKNOWN_REQUIRED_FIELD`. Producing or consuming the field requires
`hanaworlds-contracts >= 2.7.0`; canvas, workshop and bridge must pin
`refs/tags/v2.7.0` exactly on the paths that relay it.

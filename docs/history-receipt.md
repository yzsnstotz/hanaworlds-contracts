# C-world-adapter / C-canvas · historical receipt on QueryTransaction in 2.8.0

A durable receipt is written once, with the `localContext` that was current at write
time (`connectionIncarnationRef`, `selectionRevision`, `connectionRef`, `worldRef`)
and its receipt digest (`HistoryEntry.receiptDigest`). After the server stops or the
Adapter reconnects, the incarnation and selection revision are new. Up to 2.7.0
`validateBoundResponse` required `result.localContext` to equal the current request
`localContext` in full, so a legitimate persisted VERIFIED receipt read back by
`world-adapter/v8 QueryTransaction` was refused with `CURRENT_WORLD_MISMATCH`
(reported by adapter-07).

2.8.0 adds one optional pair to `QueryTransactionResponse` only:

| field | meaning |
| --- | --- |
| `currentLocalContext: LocalWorldContext` | the current context of this exchange; must equal the request `localContext` in full |
| `receiptDigest: Digest` | the stored receipt digest of `result`, unchanged since write |

With the pair, `result` is the historical `ReceiptProjection` **exactly as written**.
It is never re-bound to the current incarnation; re-binding changes its digest and
is refused.

## Binding (validateBoundResponse)

| check | refusal |
| --- | --- |
| `currentLocalContext` equals the request `localContext` (currency is not relaxed) | `CURRENT_WORLD_MISMATCH` |
| `receiptDigest` equals the receipt digest of `result` (tamper, re-bind) | `NON_CANONICAL_AMBIGUITY` |
| `result.localContext.worldRef` equals the request `worldRef` (another world) | `CURRENT_WORLD_MISMATCH` |
| `result.transactionId`, `result.transactionPayloadDigest` equal the request; `operationDigest` is bound through `receiptDigest` | `TRANSACTION_CONFLICT` |
| the pair is complete, non-null, beside a non-null `result` and a null `error` | `SCHEMA_INVALID` |

`result.localContext.connectionRef`, `connectionIncarnationRef` and
`selectionRevision` may differ from the current context.

## Unchanged

Every other operation keeps the full-equality `localContext` check and refuses the
pair (`UNKNOWN_REQUIRED_FIELD`). A `QueryTransaction` response without the pair keeps
exactly the previous rule, including the refusal after reconnect. `ReceiptProjection`,
its digest and all old fixtures are unchanged.

## SDK

- `historicalReceiptResponse(request, storedReceipt, storedReceiptDigest)` — provider:
  answers with the stored receipt and digest as written plus the request context.
- `readHistoricalReceipt(request, response)` — consumer: validates, then returns
  `{receipt, receiptDigest, historical, writtenContext, currentContext,
  sameConnection, sameIncarnation, sameSelectionRevision}` (frozen).
- `createHistoricalReceiptMock(fixture)` — stateless provider over `fixture.durable`;
  a receipt of another world answers `CURRENT_WORLD_MISMATCH` naming the requested world.
- `historicalReceipt` — metadata (introducedIn, fields, binding, compatibility).

## Fixture

`hanaworlds-contracts/fixtures/history-receipt`: `durable` (one VERIFIED receipt with
the shape and digests of the actual adapter-07 durable receipt, fixture refs),
`exchanges` (same instance without/with the pair; same world after reconnect) and
`reject` (adapter-07 repro without the pair, another world, stale envelope, re-bound
receipt, tampered receipt and digest, other transaction/payload, incomplete/null pair,
pair beside an error). SOURCE/FIXTURE evidence only.

## Compatibility

Same package major; `world-adapter` protocol minor 2 → 3. A 2.7.0 or older SDK is a
closed decoder and refuses a response carrying the pair with `UNKNOWN_REQUIRED_FIELD`.
Adapter (producer) and Canvas (consumer) of historical receipts need
`hanaworlds-contracts >= 2.8.0`; a consumer that relies on it requires
`world-adapter` minor 3.

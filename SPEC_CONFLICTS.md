# Contracts v3 rc.2 conflicts and rc.3 correction

Status: `SOURCE/FIXTURE` correction implemented from the user-approved Stage 1 `2.0.0-rc.3` BlueMap. This record does not claim independent component admission, provider conformance or product acceptance.

The previous rc.2 source candidate at `6659bd440c5b0ff2f49ba8217145ab0cfe6c07c5` reported eight conflicting oracle cases. Under the approved rc.3 input:

- `WA-09-VALID` and `CA-09-VALID` use matching v3/v3 wires. `WA-09-MIXED-INVALID` and `CA-09-MIXED-INVALID` explicitly reject v3/v2 pairs as `UNSUPPORTED_VERSION`, with `mutationState=NONE` and zero writes. The two closure row descriptions now refer to the current v3 wire.
- Only the **outer** `ObjectNameChanged` and `HistoryPositionChanged` event schema constants change to `=canvas/v3`. Their six v3 event fixtures are unchanged and now validate against the approved profile.
- `AffectedProjection`, `AuthProjection`, `TxProjection` and `ReceiptProjection` retain their v2 versions. All nineteen old production digest goldens are byte-identical to rc.2. No version fallback has been added.

The rc.3 approval is identified by candidate digest `2679982cc250acb8cc43ad9dc5f25f67783d7ac438757efb4d7aa19127da0fb7` and core digest `0402690813873497d80d3f352dca69b56a4d5c3fd95290d49100131c4271113a`. The source suite runs all 142 closure cases, 30 Canvas event cases and 18 A/B/C v3 cases. Specification and quality review remain PM-owned gates in that order.

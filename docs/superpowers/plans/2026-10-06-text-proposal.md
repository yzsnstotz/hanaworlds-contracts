# Text proposal public contract implementation plan

Goal: expose the approved route A's pure-text exterior proposal validation and BUILD result through contracts only.
Architecture: add painter/v3.ValidateBuildProposal with a strict BUILD/materials/local boxes proposal; reuse the existing request facts and BuildPlan/error envelope. Keep CreateBuildPlan and all transaction/auth helpers unchanged. Pure correlation helpers validate bounded geometry and trusted provider facts; only Painter assembles BUILD and checks full entrance geometry.
Tech stack: existing JSON type DSL, generated JSON Schema/TypeScript, ESM pure validators, Node24.
Authority: current CARD plus owner74a598e94; Painter BLOCKED read on 2026-10-06. Execute inline, no subagent (project rule).

## Decisions

- Reuse current actor/Session/request/original authorization/world/confirmed turn/invocation/intent/brief/catalogue/target/safety/region fields. New model-only BuildProposal is exactly decision BUILD, materials, nonempty ordered boxes. Reject identity/grant/transaction/evidence additions in model data.
- The first operation supports picture-blocks and authentic REGION_INSPECTED first-building facts only, media empty. Skill performs clarification; errors remain typed. No image fallback/model invocation.
- Context capture is the same public request facts excluding per-call requestId and proposal. Trusted Workshop captures that context before planning; Host/Painter compare it to current authenticated facts at use, after awaits, before release/replay. INSPECT follows the existing Workshop plan capability; only the explicit new operation is delegated. Proposal is never an authority proof.
- No new digest domain is required: reuse existing intent/brief/target/catalogue/safety/build digests; provider replay compares the complete strict request, including proposal. No private cross-plugin digest/wire.
- Source package0.3.10 is isolated from fixed a467/0.3.9. New feature capability checks only the Painter producer's exact current advertisement; no changes to existing global capability helper implementation or in-flight source/pins.

## Tasks and verification

- [x] Red: test public `validateRequest('painter/v3','ValidateBuildProposal', request)` against current0.3.9 and see UNSUPPORTED_OPERATION; record raw proposal rejection from existing operation.
- [x] Spec/generator: `spec/v4/BUILD_PROPOSAL_EXTENSION.json`, `tools/build-v4.mjs`, package exports; seven strict types, one operation, no changed transaction wires. Generate using `npm run build`.
- [x] Validators: `src/v4/build-proposal.mjs` exports `checkBuildProposalHandshake`, `validateBuildProposalRequest`, `validateBuildProposalContext`, `validateBuildProposalResponse`. Hook bound request validation; no network/provider reads/writes. Validate digest correlation, exact context, safe-integer local boxes within sampled bounds, material membership, known-empty coverage and protection/body/hazard constraints. Reuse exact BigInt union volume so huge boxes do not trigger cell enumeration.
- [x] Conformance: new exported text-proposal fixture and test `node test/build-proposal-v4.mjs`; positive decoded/raw/BUILD/error/replay plus unknown/missing/model authority, wrong brief/world/turn, bad materials/geometry/safety, changed facts, cancellation/revocation/expiry/replay and changed result.
- [x] TS/source: narrow TypeScript consumer plus generated inventory consistency; schema count369 and proposal-only export resolution. Do not rerun0.3.9 authorization179/admission/route matrices.
- [ ] Commit/push source. Run dedicated archive gate from full SHA, fresh dependencies, deterministic generated check, new conformance, typecheck, actual npm pack and isolated install of that tarball. Record full logs/SHA and cleanup temporary source/dependencies/cache.
- [ ] Prepend current REPORT preserving historical text; include source/root commits, applicable consumers, package SHA, exact evidence index and truthful SOURCE/FIXTURE limits. Commit/push only own report. Read current PM binding; comply with tool direct-human message restriction (durable report/final if no human send authorization).

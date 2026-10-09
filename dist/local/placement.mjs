// confirmed-placement/v1. A placement shown to the player before confirmation is data, not prose:
// a PlacementProposal made from a real RegionInspection, carried in Controls.placement and
// ConfirmedIntent.placement (digest-bound), and matched against the final world effect set by
// Painter and again by Canvas before any write. Pure functions over supplied facts only: no world
// read, no model, no transaction decision, no authenticity claim about the human confirmation.
import { contractMetadata } from './generated/contracts.mjs';
import { validateType, validateRegionInspection, validateBoundRequest, digestValue, canonicalJSON, deepFreeze } from './runtime.mjs';
import { ContractError } from '../errors.mjs';
import { inside, unionCellCount } from '../geometry.mjs';
export const confirmedPlacement = contractMetadata.confirmedPlacement;
const named = new Map(confirmedPlacement.namedFailures.map(f => [f.failure, f]));
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const key = p => p.join(',');
/** Every refusal is a public Error (code/reason from confirmedPlacement.namedFailures) that also
 * carries its failure name in-process as `placementFailure`. */
function need(ok, failure) {
  if (ok) return;
  const f = named.get(failure);
  const error = new ContractError(f.code, f.phase, f.reason);
  error.placementFailure = failure;
  throw error;
}
// Exact: the same cell set. Extent: every position inside the confirmed bounds. `positions` is any
// iterable of world positions, read once.
function matchTarget(target, positions) {
  if (target.kind === 'ANCHORED_EXTENT') {
    for (const p of positions) need(inside(p, target.bounds), 'PLACEMENT_TARGET_MISMATCH');
    return;
  }
  const cells = new Set(target.cells.map(key)), seen = new Set();
  for (const p of positions) { const k = key(p); need(cells.has(k) && !seen.has(k), 'PLACEMENT_TARGET_MISMATCH'); seen.add(k); }
  need(seen.size === cells.size, 'PLACEMENT_TARGET_MISMATCH');
}

/** The only way to make a PlacementProposal: from the RegionInspection the candidates were sampled
 * in and the selected target (model or player choice). The target must lie inside that
 * inspection's sampled bounds; known-empty, body and engine guards are still checked at submit. */
export function createPlacementProposal(inspectionInput, targetInput) {
  const inspection = validateRegionInspection(inspectionInput);
  const target = validateType('PlacementTarget', targetInput), facts = inspection.targetFacts;
  const corners = target.kind === 'EXACT_CELLS' ? target.cells : [target.bounds.min, target.bounds.max];
  need(corners.every(p => inside(p, facts.sampledBounds)), 'PLACEMENT_OUTSIDE_INSPECTION');
  return validateType('PlacementProposal', { profileVersion: 'placement-proposal/v1', worldRef: facts.worldRef,
    source: { inspectionId: inspection.inspectionId, anchorKind: inspection.anchorKind, worldRevision: facts.worldRevision,
      targetFactsDigest: inspection.targetFactsDigest, frameDigest: facts.frameDigest }, target });
}
/** The inspection a build uses must be exactly the one the placement was proposed from: a new
 * CURRENT_VIEW (or any other) inspection never re-interprets confirmed local geometry. */
export function requirePlacementSource(placementInput, inspectionInput, worldRef) {
  const placement = validateType('PlacementProposal', placementInput);
  const inspection = validateRegionInspection(inspectionInput);
  const source = placement.source, facts = inspection.targetFacts;
  need(placement.worldRef === worldRef && facts.worldRef === worldRef, 'PLACEMENT_WORLD_CHANGED');
  need(facts.frameDigest === source.frameDigest, 'PLACEMENT_FRAME_CHANGED');
  need(facts.worldRevision === source.worldRevision, 'PLACEMENT_REVISION_STALE');
  need(inspection.inspectionId === source.inspectionId && inspection.anchorKind === source.anchorKind &&
    inspection.targetFactsDigest === source.targetFactsDigest, 'PLACEMENT_INSPECTION_CHANGED');
  return placement;
}
/** Final world positions of an effect set against the confirmed target. */
export function requirePlacementTarget(placementInput, positionsInput) {
  const placement = validateType('PlacementProposal', placementInput);
  matchTarget(placement.target, validateType('Positions', positionsInput));
  return placement;
}
/** Brief controls and confirmed intent carry the same placement (both null, or equal). Null means
 * no structured placement was confirmed: the normal CURRENT_VIEW placement applies unchanged. */
export function confirmedPlacementOf(intentInput, briefInput) {
  const intent = validateType('IntentProjection', intentInput), brief = validateType('BriefProjection', briefInput);
  need(same(intent.confirmedIntent.placement, brief.controls.placement), 'PLACEMENT_BINDING_CHANGED');
  return intent.confirmedIntent.placement;
}
/** The canvas/v7 apply binding Workshop sends for a confirmed intent; null when none was confirmed. */
export function confirmedPlacementBinding(intentInput) {
  const intent = validateType('IntentProjection', intentInput), placement = intent.confirmedIntent.placement;
  if (placement === null) return null;
  return validateType('ConfirmedPlacementBinding', { placement,
    placementDigest: digestValue('placement-proposal', placement).sha256, intentDigest: digestValue('intent', intent).sha256 });
}
/** validateCurrentBuildSubmission: the apply binding is exactly the confirmed one (none when none). */
export function requireConfirmedPlacementSent(intent, apply) {
  need(same(confirmedPlacementBinding(intent), apply.regionInspectionBinding?.confirmedPlacement ?? null), 'PLACEMENT_BINDING_CHANGED');
}
/** Pure coherence of a canvas/v7 ApplyRecoverableCommit binding with its own operations; called by
 * validateBoundRequest, so every admission of that request checks it. */
export function placementApplyCoherence(request) {
  const binding = request.regionInspectionBinding, confirmed = binding?.confirmedPlacement ?? null;
  if (confirmed === null) return;
  const { placement } = confirmed, source = placement.source;
  need(digestValue('placement-proposal', placement).sha256 === confirmed.placementDigest, 'PLACEMENT_BINDING_CHANGED');
  need(placement.worldRef === request.worldRef, 'PLACEMENT_WORLD_CHANGED');
  need(source.frameDigest === request.operations.frameDigest, 'PLACEMENT_FRAME_CHANGED');
  need(source.worldRevision === request.expectedWorldRevision, 'PLACEMENT_REVISION_STALE');
  need(source.inspectionId === binding.inspectionId && source.targetFactsDigest === request.operations.targetFactsDigest,
    'PLACEMENT_INSPECTION_CHANGED');
  matchTarget(placement.target, request.operations.effects.map(e => e.position));
}
/** Canvas pre-commit check of a canvas/v7 ApplyRecoverableCommit against Canvas's own recorded
 * inspection and current world revision. Returns null when the apply carries no confirmed placement
 * (validateCurrentBuildSubmission makes Workshop send it whenever one was confirmed). */
export function checkConfirmedPlacementApply(applyInput, recordedInspectionInput, currentWorldRevision) {
  const apply = validateBoundRequest('canvas/v7', 'ApplyRecoverableCommit', applyInput);
  const confirmed = apply.regionInspectionBinding?.confirmedPlacement ?? null;
  if (confirmed === null) return null;
  requirePlacementSource(confirmed.placement, recordedInspectionInput, apply.worldRef);
  need(validateType('Revision', currentWorldRevision) === confirmed.placement.source.worldRevision, 'PLACEMENT_REVISION_STALE');
  return deepFreeze({ placementDigest: confirmed.placementDigest, intentDigest: confirmed.intentDigest,
    kind: confirmed.placement.target.kind, cellCount: apply.operations.effects.length });
}
/** painter/v6 CreateBuildPlan: a confirmed placement needs the source inspection to plan on. */
export function requirePlacementInspection(placement, inspection) {
  if (placement !== null) need(inspection !== null, 'PLACEMENT_INSPECTION_CHANGED');
}
/** BUILD operations (set_box, world coordinates) against the target without enumerating cells:
 * extent = every box inside the bounds; exact = every cell covered and the union is exactly that many. */
export function requireOperationsPlacementTarget(placement, operations) {
  const t = placement.target;
  if (t.kind === 'ANCHORED_EXTENT') {
    for (const op of operations) need(inside(op.min, t.bounds) && inside(op.max, t.bounds), 'PLACEMENT_TARGET_MISMATCH');
    return;
  }
  need(t.cells.every(c => operations.some(op => inside(c, op))) && unionCellCount(operations) === BigInt(t.cells.length), 'PLACEMENT_TARGET_MISMATCH');
}
/** painter-region/v3: the region is in world node coordinates of the placement World. */
export function requirePlacementWorld(placement, worldRef) { need(placement.worldRef === worldRef, 'PLACEMENT_WORLD_CHANGED'); }
/** painter-region/v3: specified world cells of the region block against the confirmed target. */
export function requireRegionPlacementTarget(placement, block) {
  const { min, max } = block.box, [sx, sy] = [0, 1].map(a => max[a] - min[a] + 1);
  if (placement.target.kind === 'ANCHORED_EXTENT' && inside(min, placement.target.bounds) && inside(max, placement.target.bounds)) return;
  function* specified() {
    for (let i = 0; i < block.indices.length; i++) if (block.indices[i] !== -1)
      yield [min[0] + i % sx, min[1] + Math.floor(i / sx) % sy, min[2] + Math.floor(i / (sx * sy))];
  }
  matchTarget(placement.target, specified());
}

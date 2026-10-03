import { validateType, validateRequest, digestValue, admitRequest, version, canvasV2, operationsV2, normalizeName, type BuildProjection, type ObjectSelectionSetReceipt, type TypeMap, type OperationMap, type WireVersion } from 'hanaworlds-contracts';
import * as Canvas from 'hanaworlds-contracts/canvas/v2';
import * as Surface from 'hanaworlds-contracts/interaction-surface/v2';
import * as Adapter from 'hanaworlds-contracts/world-adapter/v2';
import * as Session from 'hanaworlds-contracts/session/v2';
import * as Painter from 'hanaworlds-contracts/painter/v2';
import * as Brief from 'hanaworlds-contracts/ReferenceBrief/v2';
import * as Build from 'hanaworlds-contracts/BUILD/V2';
import * as Operations from 'hanaworlds-contracts/operations/v2';
import { schemaInventory } from 'hanaworlds-contracts/schemas';
import { evaluateSemanticFixture, compileFixtureEffects } from 'hanaworlds-contracts/fixture';
const v: typeof version = version;
const raw: unknown = {};
const b: BuildProjection = validateType('BuildProjection', raw);
const hash: string = digestValue('build', b).sha256;
const selection = Canvas.validate('SetObjectSelection', raw);
const selected: readonly string[] = selection.objectRefs;
const req = validateRequest('canvas/v2', 'SetObjectSelection', raw);
const expected: TypeMap['SetObjectSelectionRequest'] = req;
const admitted: TypeMap['SetObjectSelectionRequest'] = admitRequest('canvas/v2', 'SetObjectSelection', new Uint8Array());
const full: keyof TypeMap = schemaInventory[0]!;
const key: string = normalizeName('fixture').comparisonKey;
const effects = compileFixtureEffects(b.operations, b.materials);
const effectName: string = effects[0]!.nodeName;
const wires: readonly string[] = [Surface.contractVersion, Adapter.contractVersion, Canvas.contractVersion, Session.contractVersion, Painter.contractVersion, Brief.contractVersion, Build.contractVersion, Operations.contractVersion, canvasV2.contractVersion, operationsV2.contractVersion];
// @ts-expect-error a wire major is not silently accepted
validateRequest('canvas/v1', 'SetObjectSelection', raw);
// @ts-expect-error operations are scoped to their owning public protocol
validateRequest('canvas/v2', 'ReadAttachment', raw);
// @ts-expect-error unknown production digest kinds have no overload
digestValue('unapproved-digest', raw);
// @ts-expect-error immutable contract arrays cannot be sorted or mutated
selection.objectRefs.push('other');
// @ts-expect-error unknown named schema is not an extension seam
validateType('PrivateExtension', raw);
void [v, hash, selected, expected, admitted, full, key, effectName, wires, evaluateSemanticFixture];

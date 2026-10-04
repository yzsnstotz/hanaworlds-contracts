import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const readJSON = async p => JSON.parse(await readFile(p, 'utf8'));
const pkg = await readJSON('package.json');
const baseProfile = await readJSON('spec/v4/CONTRACT_SCHEMA_PROFILE.json');
const readback = await readJSON('spec/v4/SESSION_READBACK_EXTENSION.json');
const undo = await readJSON('spec/v4/SESSION_UNDO_EXTENSION.json');
const scoped = await readJSON('spec/v4/SCOPED_WORLD_EXTENSION.json');
if (baseProfile.package !== 'hanaworlds-contracts@0.3.0' ||
    readback.baseProfile !== 'CONTRACT_SCHEMA_PROFILE.json' ||
    readback.operation.operation !== 'ReadSessionTurnDetails' ||
    Object.keys(readback.types).some(name => Object.hasOwn(baseProfile.types, name)) ||
    baseProfile.operations['session/v2'].some(op => op.operation === readback.operation.operation))
  throw new Error('Session readback extension is not a strict addition to the pinned 0.3.0 profile');
if (undo.baseProfile !== 'CONTRACT_SCHEMA_PROFILE.json' ||
    undo.priorExtension !== 'SESSION_READBACK_EXTENSION.json' ||
    undo.historyQuery.expectedHistoryRevision !== 'Revision|null' ||
    Object.keys(undo.types).some(name => Object.hasOwn(baseProfile.types, name) || Object.hasOwn(readback.types, name)) ||
    undo.operations.some(op => [...baseProfile.operations['session/v2'], readback.operation].some(existing => existing.operation === op.operation)))
  throw new Error('Session undo extension is not a strict addition to the 0.3.1 package');
if (scoped.baseProfile !== 'CONTRACT_SCHEMA_PROFILE.json' || scoped.priorExtension !== 'SESSION_UNDO_EXTENSION.json' ||
    scoped.wire !== 'world-adapter/v5' || baseProfile.wireVersions.includes(scoped.wire) ||
    Object.keys(scoped.types).some(name => Object.hasOwn(baseProfile.types, name) || Object.hasOwn(readback.types, name) || Object.hasOwn(undo.types, name)))
  throw new Error('Scoped world extension is not a distinct, strictly added wire');
const oldHistory = baseProfile.operations['canvas/v4'].find(op => op.operation === 'HistoryQuery');
if (!oldHistory || baseProfile.types.HistoryQuery.fields.expectedHistoryRevision !== 'Revision')
  throw new Error('HistoryQuery base is not the pinned exact-CAS shape');
const profile = {
  ...baseProfile,
  wireVersions: [...baseProfile.wireVersions, scoped.wire],
  digest: { ...baseProfile.digest, projectionTypes: {
    ...baseProfile.digest.projectionTypes, 'scoped-world': 'ScopedWorldBinding',
    'scoped-transaction-payload': 'ScopedTxProjection',
  }, domainPrefixByKind: {
    ...baseProfile.digest.domainPrefixByKind,
    'scoped-world': 'HanaWorlds|contracts@0.3.3|',
    'scoped-transaction-payload': 'HanaWorlds|contracts@0.3.3|',
  } },
  types: {
    ...baseProfile.types,
    HistoryQuery: { ...baseProfile.types.HistoryQuery,
      fields: { ...baseProfile.types.HistoryQuery.fields, expectedHistoryRevision: undo.historyQuery.expectedHistoryRevision } },
    ...readback.types, ...undo.types, ...scoped.types,
  },
  operations: {
    ...baseProfile.operations,
    'canvas/v4': baseProfile.operations['canvas/v4'].map(op => op.operation === 'HistoryQuery' ? {
      ...op,
      successSemantics: undo.historyQuery.successSemantics,
      validationOrder: undo.historyQuery.validationOrder,
      failureCodes: [...op.failureCodes, ...undo.historyQuery.additionalFailureCodes],
      idempotency: undo.historyQuery.idempotency,
    } : op),
    'session/v2': [...baseProfile.operations['session/v2'], readback.operation, ...undo.operations],
    'world-adapter/v5': scoped.operations.map(op => {
      const old = baseProfile.operations['world-adapter/v4'].find(candidate => candidate.operation === op.operation);
      if (!old) throw new Error('Scoped operation has no v4 predecessor: ' + op.operation);
      return { ...old, ...op,
        failureCodes: [...new Set([...old.failureCodes, 'TARGET_FACTS_INCOMPLETE', 'OBJECT_SCOPE_MISMATCH', 'STALE_REVISION', 'NON_CANONICAL_AMBIGUITY'])],
        successSemantics: op.successSemantics };
    }),
  },
};
const closure = await readJSON('spec/v4/CONTRACT_SEMANTIC_CLOSURE.json');
const registry = await readJSON('spec/v4/SETTINGS_AND_INVARIANTS.json');
const oracles = await readJSON('spec/v4/fixtures/candidate/closure-oracles-v4.json');
const legacyOracles = await readJSON('spec/v4/fixtures/candidate/closure-oracles.json');
if (pkg.version !== '0.3.3') throw new Error('Scoped world extension requires package 0.3.3');
const schemaId = `https://hanaworlds.invalid/contracts/${pkg.version}/v4/schema.json`;
const definitions = Object.create(null);
function literal(value) { const s = value.slice(1); return /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?)$/.test(s) ? JSON.parse(s) : s; }
function ref(name) {
  if (name.includes('|')) return { anyOf: name.split('|').map(ref) };
  if (name === 'null') return { type: 'null' };
  if (name.startsWith('=')) return { const: literal(name) };
  if (!Object.hasOwn(profile.types, name)) throw new Error('Unresolved declared type: ' + name);
  return { $ref: '#/definitions/' + name };
}
function object(fields) { return { type: 'object', properties: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, ref(v)])), required: Object.keys(fields), additionalProperties: false }; }
for (const [name, type] of Object.entries(profile.types)) {
  let s;
  if (type.type === 'object') s = object(type.fields);
  else if (type.type === 'discriminated-object') {
    const entries = Object.entries(type.variants);
    s = { oneOf: entries.map(([key, fields]) => object({ ...type.common, ...fields, [type.discriminator]: '=' + key })),
      'x-discriminator': type.discriminator, 'x-variantKeys': entries.map(([key]) => key) };
  } else if (type.type === 'enum') s = { enum: type.values };
  else if (type.type === 'tuple') s = { type: 'array', items: type.items.map(ref), minItems: type.items.length, maxItems: type.items.length, additionalItems: false };
  else if (type.type === 'array') s = { type: 'array', items: ref(type.items), ...(type.minItems !== undefined ? { minItems: type.minItems } : {}), ...(type.unique ? { uniqueItems: true } : {}) };
  else if (type.type === 'map') s = { type: 'object', propertyNames: ref(type.keyType), additionalProperties: ref(type.values), ...(type.minEntries !== undefined ? { minProperties: type.minEntries } : {}) };
  else s = Object.fromEntries(['type', 'minimum', 'maximum', 'exclusiveMinimum', 'minLength', 'pattern'].filter(k => Object.hasOwn(type, k)).map(k => [k, type[k]]));
  s['x-typeName'] = name;
  for (const key of ['rules', 'order', 'uniqueBy', 'normalization', 'finite']) if (Object.hasOwn(type, key)) s['x-' + key] = type[key];
  definitions[name] = s;
}
const schemaBundle = { $schema: 'http://json-schema.org/draft-07/schema#', $id: schemaId,
  title: `HanaWorlds contracts ${pkg.version} — complete v4 type inventory`,
  description: 'Select a definition. JSON Schema establishes structure; exported validators additionally enforce the normative domain rules. Validation never authenticates a provider.', definitions };

// rc.7 compatibility (profile.compatibility.rc7): painter/v2 -> painter/v3 and interaction-surface/v2 -> interaction-surface/v3.
// Inherited closure fixtures keep their retired wire labels; the successor map lets ownership facts follow the renamed envelope.
const legacyWireSuccessors = { 'interaction-surface/v2': 'interaction-surface/v3', 'painter/v2': 'painter/v3', 'canvas/v3': 'canvas/v4', 'world-adapter/v3': 'world-adapter/v4' };
for (const [from, to] of Object.entries(legacyWireSuccessors))
  if (profile.wireVersions.includes(from) || !profile.wireVersions.includes(to)) throw new Error('Successor map disagrees with the approved wire set: ' + from);
const owners = {};
for (const x of [...legacyOracles.cases, ...oracles.cases].filter(x => x.dimension === 'ownership' && x.kind === 'valid')) {
  const wire = legacyWireSuccessors[x.wire] ?? x.wire;
  if (profile.wireVersions.includes(wire)) owners[wire] = { domainOwner: x.input.domainOwner, mutationCaller: x.input.mutationCaller };
}
owners[scoped.wire] = owners['world-adapter/v4']; // Same Adapter owner and Canvas-only mutation caller.
if (Object.keys(owners).length !== profile.wireVersions.length) throw new Error('Every v4 wire needs an approved ownership fact');
// ContractHandshake advertisement: the exact approved wire set (UTF16 order) and every TargetFacts profile constant.
const factProfiles = profile.types.TargetFacts.fields.profileVersion.split('|').map(literal).sort();
const contractHandshake = { contracts: `${pkg.name}@${pkg.version}`, wireVersions: [...profile.wireVersions].sort(), compiledOperationsVersion: profile.compiledOperationsVersion, factProfiles };
const placementSettings = registry.settings.map(s => ({ name: s.name, field: s.name.replace(/^placement\./, ''), owner: s.owner, type: s.type, scope: s.scope, editable: s.editable,
  default: s.default, defaultAuthority: s.defaultAuthority, nameAuthority: s.nameAuthority, meaning: s.meaning, consequence: s.consequence, whenUnsetOrInvalid: s.whenUnsetOrInvalid }));
const placementInvariants = registry.invariants.map(i => ({ id: i.id, owner: i.owner, switchable: i.switchable, authority: i.authority, text: i.text, whyNotSwitchable: i.whyNotSwitchable, consequence: i.consequence }));
for (const s of placementSettings) if (!Object.hasOwn(profile.types.PlacementSettings.fields, s.field) || !profile.types.PlacementSettingName.values.includes(s.name)) throw new Error('Setting registry and profile disagree: ' + s.name);
const metadata = { package: `${pkg.name}@${pkg.version}`, version: pkg.version, wireVersions: profile.wireVersions, compiledOperationsVersion: profile.compiledOperationsVersion,
  operations: profile.operations, canvasEventRules: profile.canvasEventRules, digest: profile.digest, namePolicy: profile.namePolicy,
  errorPrecedence: profile.errorPrecedence, ownership: owners, providerGates: profile.providerGates, contractHandshake, legacyWireSuccessors,
  placementSettings, placementInvariants, settingsSurface: registry.surface, attributedEngineCaps: registry.attributedEngineCaps,
  typeNames: Object.keys(definitions), closureRows: closure.rows.map(x => ({ id: x.id, protocol: x.protocol, dimension: x.dimension, rule: x.rule, authorityRefs: x.authorityRefs })) };
await mkdir('src/v4/generated', { recursive: true }); await mkdir('types/v4', { recursive: true }); await mkdir('schemas/v4/profile', { recursive: true });
const freezeSource = `const freeze = root => { const stack=[root]; while(stack.length){ const x=stack.pop(); if(x&&typeof x==='object'&&!Object.isFrozen(x)){ for(const v of Object.values(x))stack.push(v); Object.freeze(x); }} return root; };\n`;
await writeFile('src/v4/generated/contracts.mjs', '// Generated deterministically from the pinned 0.3.0 v4 profile, readback/undo/scoped extensions and settings registry.\n' + freezeSource +
  'export const schemaBundle = freeze(' + JSON.stringify(schemaBundle) + ');\nexport const contractMetadata = freeze(' + JSON.stringify(metadata) + ');\n');
await writeFile('schemas/v4/contracts.schema.json', JSON.stringify(schemaBundle, null, 2) + '\n');
for (const name of Object.keys(definitions)) {
  await writeFile('schemas/v4/' + name + '.schema.json', JSON.stringify({ ...schemaBundle, $id: schemaId.replace('schema.json', name + '.schema.json'), $ref: '#/definitions/' + name }, null, 2) + '\n');
}
// The approved normative inputs are shipped unchanged so consumers and the approved checkers read the package bytes.
for (const item of ['CONTRACT_SCHEMA_PROFILE.json', 'CONTRACT_SEMANTIC_CLOSURE.json', 'SETTINGS_AND_INVARIANTS.json'])
  await copyFile('spec/v4/' + item, 'schemas/v4/profile/' + item);
await copyFile('spec/v4/SESSION_READBACK_EXTENSION.json', 'schemas/v4/profile/SESSION_READBACK_EXTENSION.json');
await copyFile('spec/v4/SESSION_UNDO_EXTENSION.json', 'schemas/v4/profile/SESSION_UNDO_EXTENSION.json');
await copyFile('spec/v4/SCOPED_WORLD_EXTENSION.json', 'schemas/v4/profile/SCOPED_WORLD_EXTENSION.json');
// TS binding is derived from the same DSL, but is an actual public declaration file.
function tsref(name) {
  if (name.includes('|')) return name.split('|').map(tsref).join(' | ');
  if (name === 'null') return 'null';
  if (name.startsWith('=')) return JSON.stringify(literal(name));
  return name;
}
const fieldsTS = fields => '{\n' + Object.entries(fields).map(([k, v]) => '  readonly ' + JSON.stringify(k) + ': ' + tsref(v) + ';').join('\n') + '\n}';
let declarations = `// GENERATED — ${Object.keys(profile.types).length} named types from approved base plus session readback extension; no any/open object fallback.\n`;
for (const [name, type] of Object.entries(profile.types)) {
  let value;
  if (type.type === 'object') value = fieldsTS(type.fields);
  else if (type.type === 'discriminated-object') value = Object.entries(type.variants).map(([key, fields]) => fieldsTS({ ...type.common, ...fields, [type.discriminator]: '=' + key })).join(' | ');
  else if (type.type === 'enum') value = type.values.map(v => JSON.stringify(v)).join(' | ');
  else if (type.type === 'tuple') value = 'readonly [' + type.items.map(tsref).join(', ') + ']';
  else if (type.type === 'array') value = 'ReadonlyArray<' + tsref(type.items) + '>';
  else if (type.type === 'map') value = '{ readonly [key: string]: ' + tsref(type.values) + ' }';
  else value = type.type === 'integer' ? 'number' : type.type;
  const rules = [...(type.rules ?? []), ...(type.order ? ['Order: ' + type.order] : [])];
  if (rules.length) declarations += '/** ' + rules.join(' | ').replaceAll('*/', '* /') + ' */\n';
  declarations += 'export type ' + name + ' = ' + value + ';\n';
}
declarations += '\nexport interface TypeMap {\n' + Object.keys(profile.types).map(k => '  readonly ' + k + ': ' + k + ';').join('\n') + '\n}\nexport type TypeName = keyof TypeMap;\n';
declarations += 'export type WireVersion = ' + profile.wireVersions.map(x => JSON.stringify(x)).join(' | ') + ';\n';
declarations += 'export type FactProfile = ' + factProfiles.map(x => JSON.stringify(x)).join(' | ') + ';\n';
declarations += 'export interface OperationMap {\n';
for (const [wire, ops] of Object.entries(profile.operations)) {
  declarations += '  readonly ' + JSON.stringify(wire) + ': {\n';
  for (const op of ops) declarations += '    readonly ' + JSON.stringify(op.operation) + ': { readonly request: ' + op.request + '; readonly response: ' + op.response + (op.alternateResult ? ' | ' + op.alternateResult : '') + '; };\n';
  declarations += '  };\n';
}
declarations += '}\nexport interface ProjectionMap {\n' + Object.entries(profile.digest.projectionTypes).map(([kind, type]) => '  readonly ' + JSON.stringify(kind) + ': ' + type + ';').join('\n') + '\n}\nexport type DigestKind = keyof ProjectionMap;\n';
await writeFile('types/v4/contracts.d.ts', declarations);
const wireExport = wire => 'hanaworlds-contracts/' + (['interaction-surface/v3', 'world-adapter/v4', 'world-adapter/v5', 'canvas/v4', 'painter/v3'].includes(wire) ? wire : 'v4/' + wire);
const bindingName = wire => wire.replace('/', '-');
const v2IndexDeclarations = await readFile('types/index.d.ts', 'utf8');
const exportName = wire => bindingName(wire).replace(/-([a-zA-Z])/g, (_, c) => c.toUpperCase()).replace(/^BUILD/, 'build').replace(/^ReferenceBrief/, 'referenceBrief');
const bindingWires = [...profile.wireVersions, profile.compiledOperationsVersion];
await writeFile('types/v4/index.d.ts', v2IndexDeclarations
  .replace(/^export \* as .*$/gm, '')
  .replace(/export declare const version: '[^']+';/, `export declare const version: '${pkg.version}';`)
  + `
export type PlacementSettingField = 'frontGapCells' | 'forwardSearchCells' | 'lateralSearchCells' | 'verticalSearchCells';
export interface PlacementSettingDescriptor { readonly name: T.PlacementSettingName; readonly field: PlacementSettingField; readonly owner: string; readonly type: 'NonNegativeInt'; readonly scope: string; readonly editable: boolean; readonly default: number; readonly defaultAuthority: JSONValue; readonly nameAuthority: string; readonly meaning: string; readonly consequence: string; readonly whenUnsetOrInvalid: string; }
export interface PlacementInvariantDescriptor { readonly id: string; readonly owner: string; readonly switchable: false; readonly authority: JSONValue; readonly text: string; readonly whyNotSwitchable: string; readonly consequence: string; }
export interface HandshakeRequirement { readonly wires: ReadonlyArray<string>; readonly factProfiles: ReadonlyArray<string>; }
/** Exactly what this package advertises in ContractHandshake. */
export declare const contractHandshake: T.ContractHandshake;
export declare const legacyWireSuccessors: Readonly<Record<string, T.WireVersion>>;
/** Display/registry metadata only; a default is never applied by this package. */
export declare const placementSettingDescriptors: ReadonlyArray<PlacementSettingDescriptor>;
export declare const placementInvariants: ReadonlyArray<PlacementInvariantDescriptor>;
export declare function checkContractHandshake(advertised: unknown, required: HandshakeRequirement): { readonly result: 'HANDSHAKE_VERSION_MATCH'; readonly advertised: T.ContractHandshake };
/** Requires a peer that advertises the 0.3.1 package containing ReadSessionTurnDetails. */
export declare function checkSessionReadbackHandshake(advertised: unknown): { readonly result: 'HANDSHAKE_OPERATION_MATCH'; readonly advertised: T.ContractHandshake };
/** Requires a peer that advertises the 0.3.2 package containing the two current-build undo operations. */
export declare function checkSessionUndoHandshake(advertised: unknown): { readonly result: 'HANDSHAKE_OPERATION_MATCH'; readonly advertised: T.ContractHandshake };
/** Requires world-adapter/v5; matching v4 peers fail before Prepare. */
export declare function checkScopedWorldHandshake(advertised: unknown): { readonly result: 'HANDSHAKE_OPERATION_MATCH'; readonly advertised: T.ContractHandshake };
export declare function validateScopedTransition(prepare: unknown, apply: unknown): { readonly prepare: T.ScopedPrepareRequest; readonly apply: T.ScopedApplyRequest };
export declare function projectScopedPreparedTransaction(result: unknown): T.ScopedPreparedTransaction;
export declare function admitPlacementSettings(stored: Readonly<Record<string, unknown>>, settingsRevision: unknown): T.PlacementSettings;
export declare function validateChoiceSelection(frame: unknown, request: unknown): T.InvokeActionRequest;
export declare function validateRegionInspection(inspection: unknown): T.RegionInspection;
export declare function projectPreparedTransaction(result: unknown): T.PreparedTransaction;
`
  + bindingWires.map(w => `export * as ${exportName(w)} from '../../bindings/v4/${bindingName(w)}.js';`).join('\n') + '\n');
await writeFile('types/v4/fixture.d.ts', (await readFile('types/fixture.d.ts', 'utf8'))
  +"\nexport declare function evaluateV4Fixture(typeName: string, request: unknown, context?: unknown): import('./index.js').JSONValue;\n");
await writeFile('types/v4/schemas.d.ts', await readFile('types/schemas.d.ts', 'utf8'));
await mkdir('fixtures/v4/candidate', { recursive: true });
for (const item of await readdir('spec/v4/fixtures/candidate')) {
  if (item.endsWith('.json')) await copyFile('spec/v4/fixtures/candidate/' + item, 'fixtures/v4/candidate/' + item);
}
async function copySource(from, to) {
  await mkdir(to, { recursive: true });
  for (const item of await readdir(from, { withFileTypes: true })) {
    if (item.isDirectory()) await copySource(from + '/' + item.name, to + '/' + item.name);
    else if (item.name.endsWith('.mjs')) await copyFile(from + '/' + item.name, to + '/' + item.name);
  }
}
await copySource('src/v4', 'dist/v4');
await mkdir('dist/v4/bindings', { recursive: true }); await mkdir('bindings/v4', { recursive: true });
const bindingInventory = [];
for (const wire of bindingWires) {
  const name = bindingName(wire); const isOperations = wire === 'operations/v2';
  const body = isOperations
    ? `import { validateType, admitType, digestValue } from '../runtime.mjs';\nexport const contractVersion = 'operations/v2';\nexport const validate = value => validateType('OperationsProjection', value);\nexport const admit = bytes => admitType('OperationsProjection', bytes);\nexport const digest = value => digestValue('operations', value);\nexport const validateCompiledSet = value => validateType('CompiledOperationSet', value);\n`
    : `import { operationContracts, validateRequest, admitRequest, validateResponse, validateCanvasEvent } from '../runtime.mjs';\nexport const contractVersion = ${JSON.stringify(wire)};\nexport const operations = operationContracts[contractVersion];\nexport const validate = (operation, value) => validateRequest(contractVersion, operation, value);\nexport const admit = (operation, bytes) => admitRequest(contractVersion, operation, bytes);\nexport const response = (operation, value) => validateResponse(contractVersion, operation, value);\n` + (wire === 'canvas/v4' ? 'export const event = validateCanvasEvent;\n' : '');
  await writeFile('dist/v4/bindings/' + name + '.mjs', body);
  await writeFile('bindings/v4/' + name + '.mjs', body.replaceAll("'../runtime.mjs'", "'../../dist/v4/runtime.mjs'"));
  let dts = `import type * as T from '../../types/v4/contracts.js';\nexport declare const contractVersion: ${JSON.stringify(wire)};\n`;
  if (isOperations) dts += `export declare function validate(value: unknown): T.OperationsProjection;\nexport declare function admit(bytes: Uint8Array): T.OperationsProjection;\nexport declare function digest(value: unknown): import('../../types/v4/index.js').DigestResult<T.OperationsProjection>;\nexport declare function validateCompiledSet(value: unknown): T.CompiledOperationSet;\n`;
  else {
    dts += 'export declare const operations: ReadonlyArray<import(\'../../types/v4/index.js\').OperationContract>;\n';
    for (const op of profile.operations[wire]) {
      dts += `export declare function validate(operation: ${JSON.stringify(op.operation)}, value: unknown): T.${op.request};\n`;
      dts += `export declare function admit(operation: ${JSON.stringify(op.operation)}, bytes: Uint8Array): T.${op.request};\n`;
      dts += `export declare function response(operation: ${JSON.stringify(op.operation)}, value: unknown): T.${op.response}` + (op.alternateResult ? ' | T.' + op.alternateResult : '') + ';\n';
    }
    if (wire === 'canvas/v4') dts += `export declare function event(typeName: keyof typeof import('../../types/v4/index.js').canvasEventRules, value: unknown): unknown;\n`;
  }
  await writeFile('bindings/v4/' + name + '.d.ts', dts);
  bindingInventory.push({ wire, specifier: wireExport(wire), javascript: 'dist/v4/bindings/' + name + '.mjs', declarations: 'bindings/v4/' + name + '.d.ts' });
}
const manifest = { types: Object.keys(definitions), schemas: ['schemas/v4/contracts.schema.json', ...Object.keys(definitions).map(name => 'schemas/v4/' + name + '.schema.json')],
  operations: Object.fromEntries(Object.entries(profile.operations).map(([wire, ops]) => [wire, ops.map(op => ({ operation: op.operation, request: op.request, response: op.response, ...(op.alternateResult ? { alternateResult: op.alternateResult } : {}), ...(op.event ? { event: op.event } : {}) }))])),
  canvasEventTypes: Object.keys(profile.canvasEventRules), projections: profile.digest.projectionTypes, bindings: bindingInventory, contractHandshake,
  placementSettings: placementSettings.map(s => s.name),
  approvedProfileSha256: createHash('sha256').update(await readFile('spec/v4/CONTRACT_SCHEMA_PROFILE.json')).digest('hex'),
  sessionReadbackExtensionSha256: createHash('sha256').update(await readFile('spec/v4/SESSION_READBACK_EXTENSION.json')).digest('hex'),
  sessionUndoExtensionSha256: createHash('sha256').update(await readFile('spec/v4/SESSION_UNDO_EXTENSION.json')).digest('hex'),
  scopedWorldExtensionSha256: createHash('sha256').update(await readFile('spec/v4/SCOPED_WORLD_EXTENSION.json')).digest('hex'),
  approvedClosureSha256: createHash('sha256').update(await readFile('spec/v4/CONTRACT_SEMANTIC_CLOSURE.json')).digest('hex') };
await writeFile('schemas/v4/inventory.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ result: 'BUILT', lane: 'v4', types: manifest.types.length, schemas: manifest.schemas.length, bindings: bindingInventory.length,
  operations: Object.values(profile.operations).reduce((n, a) => n + a.length, 0), canvasEventTypes: manifest.canvasEventTypes.length, projections: Object.keys(manifest.projections).length, providerRuntime: 'NOT_RUN' }));

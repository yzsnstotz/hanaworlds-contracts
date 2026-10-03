import { readFile, writeFile, mkdir, readdir, rm, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const readJSON = async p => JSON.parse(await readFile(p, 'utf8'));
const pkg = await readJSON('package.json');
const profile = await readJSON('spec/v3/CONTRACT_SCHEMA_PROFILE.json');
const closure = await readJSON('spec/v3/CONTRACT_SEMANTIC_CLOSURE.json');
const oracles = await readJSON('spec/v3/fixtures/candidate/closure-oracles-v3.json');
// The v3 schema identity stays byte-stable at the release that introduced it while the package adds a v4 lane.
const schemaId = 'https://hanaworlds.invalid/contracts/0.2.1/v3/schema.json';
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
  title: 'HanaWorlds contracts 0.2.1 — complete v3 type inventory',
  description: 'Select a definition. JSON Schema establishes structure; exported validators additionally enforce the normative domain rules. Validation never authenticates a provider.', definitions };
const owners = Object.fromEntries(oracles.cases.filter(x => x.dimension === 'ownership' && x.kind === 'valid').map(x => [x.wire, { domainOwner: x.input.domainOwner, mutationCaller: x.input.mutationCaller }]));
const metadata = { package: `${pkg.name}@${pkg.version}`, version: pkg.version, wireVersions: profile.wireVersions, compiledOperationsVersion: profile.compiledOperationsVersion,
  operations: profile.operations, canvasEventRules: profile.canvasEventRules, digest: profile.digest, namePolicy: profile.namePolicy,
  errorPrecedence: profile.errorPrecedence, ownership: owners, providerGates: profile.providerGates,
  typeNames: Object.keys(definitions), closureRows: closure.rows.map(x => ({ id: x.id, protocol: x.protocol, dimension: x.dimension, rule: x.rule, authorityRefs: x.authorityRefs })) };
await mkdir('src/v3/generated', { recursive: true }); await mkdir('types', { recursive: true }); await mkdir('schemas', { recursive: true });
const freezeSource = `const freeze = root => { const stack=[root]; while(stack.length){ const x=stack.pop(); if(x&&typeof x==='object'&&!Object.isFrozen(x)){ for(const v of Object.values(x))stack.push(v); Object.freeze(x); }} return root; };\n`;
await writeFile('src/v3/generated/contracts.mjs', '// Generated deterministically from the byte-pinned approved profile.\n' + freezeSource +
  'export const schemaBundle = freeze(' + JSON.stringify(schemaBundle) + ');\nexport const contractMetadata = freeze(' + JSON.stringify(metadata) + ');\n');
await writeFile('schemas/v3/contracts.schema.json', JSON.stringify(schemaBundle, null, 2) + '\n');
for (const name of Object.keys(definitions)) {
  await writeFile('schemas/v3/' + name + '.schema.json', JSON.stringify({ ...schemaBundle, $id: schemaId.replace('schema.json', name + '.schema.json'), $ref: '#/definitions/' + name }, null, 2) + '\n');
}
// TS binding is derived from the same DSL, but is an actual public declaration file.
function tsref(name) {
  if (name.includes('|')) return name.split('|').map(tsref).join(' | ');
  if (name === 'null') return 'null';
  if (name.startsWith('=')) return JSON.stringify(literal(name));
  return name;
}
const fieldsTS = fields => '{\n' + Object.entries(fields).map(([k, v]) => '  readonly ' + JSON.stringify(k) + ': ' + tsref(v) + ';').join('\n') + '\n}';
let declarations = '// GENERATED — all 258 approved named types, no any/open object fallback.\n';
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
declarations += 'export interface OperationMap {\n';
for (const [wire, ops] of Object.entries(profile.operations)) {
  declarations += '  readonly ' + JSON.stringify(wire) + ': {\n';
  for (const op of ops) declarations += '    readonly ' + JSON.stringify(op.operation) + ': { readonly request: ' + op.request + '; readonly response: ' + op.response + (op.alternateResult ? ' | ' + op.alternateResult : '') + '; };\n';
  declarations += '  };\n';
}
declarations += '}\nexport interface ProjectionMap {\n' + Object.entries(profile.digest.projectionTypes).map(([kind, type]) => '  readonly ' + JSON.stringify(kind) + ': ' + type + ';').join('\n') + '\n}\nexport type DigestKind = keyof ProjectionMap;\n';
await writeFile('types/v3/contracts.d.ts', declarations);
const v2IndexDeclarations = await readFile('types/index.d.ts', 'utf8');
await writeFile('types/v3/index.d.ts', v2IndexDeclarations
  .replace(/^export \* as .*$/gm, '')
  .replace(/export declare const version: '[^']+';/, `export declare const version: '${pkg.version}';`)
  + "\nexport * as worldAdapterV3 from '../../bindings/v3/world-adapter-v3.js';\nexport * as canvasV3 from '../../bindings/v3/canvas-v3.js';\n");
await writeFile('types/v3/fixture.d.ts', (await readFile('types/fixture.d.ts', 'utf8'))
  + "\nexport declare function evaluateV3Fixture(typeName: string, request: unknown, context?: unknown): import('./index.js').JSONValue;\n");
await writeFile('types/v3/schemas.d.ts', await readFile('types/schemas.d.ts', 'utf8'));
await mkdir('fixtures/v3/candidate', { recursive: true });
for (const item of await readdir('spec/v3/fixtures/candidate')) {
  if (item.endsWith('.json')) await copyFile('spec/v3/fixtures/candidate/' + item, 'fixtures/v3/candidate/' + item);
}
await mkdir('dist/v3', { recursive: true });
async function copySource(from, to) {
  await mkdir(to, { recursive: true });
  for (const item of await readdir(from, { withFileTypes: true })) {
    if (item.isDirectory()) await copySource(from + '/' + item.name, to + '/' + item.name);
    else if (item.name.endsWith('.mjs')) await copyFile(from + '/' + item.name, to + '/' + item.name);
  }
}
await copySource('src/v3', 'dist/v3');
await mkdir('dist/v3/bindings', { recursive: true }); await mkdir('bindings/v3', { recursive: true });
const bindingInventory = [];
for (const wire of profile.wireVersions.filter(wire => wire === 'canvas/v3' || wire === 'world-adapter/v3')) {
  const name = wire.replace('/', '-'); const isOperations = wire === 'operations/v2';
  const body = isOperations
    ? `import { validateType, admitType, digestValue } from '../runtime.mjs';\nexport const contractVersion = 'operations/v2';\nexport const validate = value => validateType('OperationsProjection', value);\nexport const admit = bytes => admitType('OperationsProjection', bytes);\nexport const digest = value => digestValue('operations', value);\nexport const validateCompiledSet = value => validateType('CompiledOperationSet', value);\n`
    : `import { operationContracts, validateRequest, admitRequest, validateResponse, validateCanvasEvent } from '../runtime.mjs';\nexport const contractVersion = ${JSON.stringify(wire)};\nexport const operations = operationContracts[contractVersion];\nexport const validate = (operation, value) => validateRequest(contractVersion, operation, value);\nexport const admit = (operation, bytes) => admitRequest(contractVersion, operation, bytes);\nexport const response = (operation, value) => validateResponse(contractVersion, operation, value);\n` + (wire === 'canvas/v3' ? 'export const event = validateCanvasEvent;\n' : '');
  await writeFile('dist/v3/bindings/' + name + '.mjs', body);
  await writeFile('bindings/v3/' + name + '.mjs', body.replaceAll("'../runtime.mjs'", "'../../dist/v3/runtime.mjs'"));
  let dts = `import type * as T from '../../types/v3/contracts.js';\nexport declare const contractVersion: ${JSON.stringify(wire)};\n`;
  if (isOperations) dts += `export declare function validate(value: unknown): T.OperationsProjection;\nexport declare function admit(bytes: Uint8Array): T.OperationsProjection;\nexport declare function digest(value: unknown): import('../../types/v3/index.js').DigestResult<T.OperationsProjection>;\nexport declare function validateCompiledSet(value: unknown): T.CompiledOperationSet;\n`;
  else {
    dts += 'export declare const operations: ReadonlyArray<import(\'../../types/v3/index.js\').OperationContract>;\n';
    for (const op of profile.operations[wire]) {
      dts += `export declare function validate(operation: ${JSON.stringify(op.operation)}, value: unknown): T.${op.request};\n`;
      dts += `export declare function admit(operation: ${JSON.stringify(op.operation)}, bytes: Uint8Array): T.${op.request};\n`;
      dts += `export declare function response(operation: ${JSON.stringify(op.operation)}, value: unknown): T.${op.response}` + (op.alternateResult ? ' | T.' + op.alternateResult : '') + ';\n';
    }
    if (wire === 'canvas/v3') dts += `export declare function event(typeName: keyof typeof import('../../types/v3/index.js').canvasEventRules, value: unknown): unknown;\n`;
  }
  await writeFile('bindings/v3/' + name + '.d.ts', dts);
  bindingInventory.push({ wire, javascript: 'dist/v3/bindings/' + name + '.mjs', declarations: 'bindings/v3/' + name + '.d.ts' });
}
const manifest = { types: Object.keys(definitions), schemas: ['schemas/v3/contracts.schema.json', ...Object.keys(definitions).map(name => 'schemas/v3/' + name + '.schema.json')],
  operations: Object.fromEntries(Object.entries(profile.operations).map(([wire, ops]) => [wire, ops.map(op => ({ operation: op.operation, request: op.request, response: op.response, ...(op.alternateResult ? { alternateResult: op.alternateResult } : {}), ...(op.event ? { event: op.event } : {}) }))])),
  canvasEventTypes: Object.keys(profile.canvasEventRules), projections: profile.digest.projectionTypes, bindings: bindingInventory,
  approvedProfileSha256: createHash('sha256').update(await readFile('spec/v3/CONTRACT_SCHEMA_PROFILE.json')).digest('hex') };
await writeFile('schemas/v3/inventory.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ result: 'BUILT', types: manifest.types.length, schemas: manifest.schemas.length, bindings: bindingInventory.length,
  operations: Object.values(profile.operations).reduce((n, a) => n + a.length, 0), canvasEventTypes: manifest.canvasEventTypes.length, projections: Object.keys(manifest.projections).length, providerRuntime: 'NOT_RUN' }));

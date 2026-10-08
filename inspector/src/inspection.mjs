// Read-only consumer of the exact public 0.5.4 API. No world or peer access.
import {
  version, contractProtocols, regionCapabilities, protocolPolicy, schemaBundle,
  admitType, decodeRawJSON, validateType, ContractError, checkProtocolCompatibility,
  protocolRequirement,
} from 'hanaworlds-contracts';
import main from 'hanaworlds-contracts/fixtures/main' with { type: 'json' };

const execution = 'Host / hanaworlds-contracts public pure functions';
const kinds = { building: 'BuildProjection', region: 'RegionVoxelBlock' };
const region = {
  profileVersion: 'region-voxels/v1', origin: [0, 0, 0], size: [2, 1, 1],
  indexOrder: 'X_FASTEST_THEN_Y_THEN_Z',
  palette: [{ nodeName: 'fixture:stone', param2: 0 }], runs: [[2, 0]],
};
const advertised = {
  profileVersion: 'protocol-handshake/v1', component: 'fixture-brush',
  protocols: [{ protocol: 'BUILD', major: 3, minor: 0 }],
  capabilities: ['BUILD/V3:per-cell-compile'],
  provenance: { packageName: 'fixture-brush', packageVersion: '0.5.0', sourceRevision: null, artifactDigest: null },
};
const requirements = [protocolRequirement('BUILD/V3', ['BUILD/V3:per-cell-compile'])];

export function describeInspector() {
  if (version !== '0.5.4') throw new Error(`Inspector requires contracts 0.5.4; loaded ${version}`);
  const wrongMajor = structuredClone(advertised); wrongMajor.protocols[0].major = 4;
  const missingCapability = structuredClone(advertised); missingCapability.capabilities = [];
  const invalid = structuredClone(region); invalid.origin[0] = 'bad';
  return {
    contractsVersion: version, panelVersion: '0.1.0', execution,
    protocols: contractProtocols,
    capabilities: regionCapabilities.map(c => c.id), capabilityDeclarations: regionCapabilities,
    policy: protocolPolicy,
    samples: [
      { id: 'building', label: '建筑 · 合法 BUILD/V3', kind: 'building', fixture: true, input: main.response.result.build },
      { id: 'region-fill', label: '区域 · 填充石块', kind: 'region', fixture: true, input: region },
      { id: 'region-air', label: '区域 · 显式挖空 air', kind: 'region', fixture: true,
        input: { ...region, palette: [{ nodeName: 'air', param2: 0 }] } },
      { id: 'invalid-region', label: '区域 · 无效坐标（可修正）', kind: 'region', fixture: true, input: invalid },
      { id: 'protocol-ok', label: '协议演示 · 兼容', kind: 'protocol', fixture: true, input: { advertised, requirements } },
      { id: 'protocol-major', label: '协议演示 · major 不符', kind: 'protocol', fixture: true, input: { advertised: wrongMajor, requirements } },
      { id: 'protocol-capability', label: '协议演示 · 缺少能力', kind: 'protocol', fixture: true, input: { advertised: missingCapability, requirements } },
    ],
  };
}

const reasonText = {
  INVALID_SHAPE: '字段缺失、类型或值不符合公开合约；请核对字段与样例。',
  INVALID_GEOMETRY: '坐标、范围或几何关系不符合公开合约。',
  VERSION_UNSUPPORTED: '协议 major、最低 minor 或必需能力不满足要求。',
  INVALID_JSON: '输入不是合约允许的严格 JSON。',
};

// Diagnostic locations only. Acceptance always comes from the complete public
// admission above. Referenced fields are checked with validateType itself;
// cross-field/domain errors retain "$" instead of inventing a precise path.
function rejectedFields(typeName, value) {
  const definition = schemaBundle.definitions[typeName];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['$'];
  const fields = [];
  for (const name of definition.required ?? []) if (!Object.hasOwn(value, name)) fields.push(`$.${name}`);
  for (const name of Object.keys(value)) {
    const property = definition.properties?.[name];
    if (!property) { fields.push(`$.${name}`); continue; }
    if (property.$ref) {
      try { validateType(property.$ref.split('/').at(-1), value[name]); }
      catch (error) { if (!(error instanceof ContractError)) throw error; fields.push(`$.${name}`); }
    } else if (Object.hasOwn(property, 'const') && value[name] !== property.const) fields.push(`$.${name}`);
  }
  return fields.length ? fields : ['$（整体输入约束；公共校验未提供单字段路径）'];
}

export function inspectJSON(kind, jsonText) {
  if (!Object.hasOwn(kinds, kind) && kind !== 'protocol') throw new TypeError('Unknown inspection kind');
  if (typeof jsonText !== 'string') throw new TypeError('Inspection input must be JSON text');
  const bytes = new TextEncoder().encode(jsonText);
  let input;
  try {
    if (kind === 'protocol') {
      input = decodeRawJSON(bytes);
      const matched = checkProtocolCompatibility(input?.advertised, input?.requirements);
      return { accepted: true, execution, contractsVersion: version, fixtureDemo: true, summary: matched, input };
    }
    input = admitType(kinds[kind], bytes);
    const summary = kind === 'building'
      ? { type: kinds[kind], documentId: input.documentId, operations: input.operations.length, bounds: input.declaredBounds }
      : { type: kinds[kind], origin: input.origin, size: input.size,
        cells: input.size.reduce((n, v) => n * BigInt(v), 1n).toString(),
        explicitAirCells: input.runs.reduce((n, [count, index]) => n + (index !== null && input.palette[index].nodeName === 'air' ? BigInt(count) : 0n), 0n).toString(),
        unspecifiedCells: input.runs.reduce((n, [count, index]) => n + (index === null ? BigInt(count) : 0n), 0n).toString() };
    return { accepted: true, execution, contractsVersion: version, fixtureDemo: false, summary, input };
  } catch (error) {
    if (!(error instanceof ContractError)) throw error;
    // Decode once more only through the public strict decoder for diagnostics.
    // A decode failure has no trustworthy field path.
    if (input === undefined) {
      try { input = decodeRawJSON(bytes); }
      catch (decodeError) { if (!(decodeError instanceof ContractError)) throw decodeError; }
    }
    const fields = input === undefined ? ['$（严格 JSON 解码）'] : kind === 'protocol'
      ? (error.code === 'CAPABILITY_UNAVAILABLE' ? ['$.advertised.capabilities'] : ['$.advertised.protocols', '$.requirements'])
      : rejectedFields(kinds[kind], input);
    return { accepted: false, execution, contractsVersion: version, fixtureDemo: kind === 'protocol',
      error: error.publicError, fields,
      reason: error.code === 'CAPABILITY_UNAVAILABLE' ? '演示声明缺少要求的能力（CAPABILITY_UNAVAILABLE）。'
        : reasonText[error.reason] ?? `公开合约拒绝：${error.code} / ${error.reason}。` };
  }
}

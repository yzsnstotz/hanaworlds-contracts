const byId = id => document.getElementById(id);
const sampleSelect = byId('sample'), kindSelect = byId('kind'), editor = byId('json-input');
const button = byId('inspect'), body = byId('result-body');
let description;

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function clearResult() { body.replaceChildren(node('p', '选择样例或粘贴 JSON，点击「检查」。', 'hw-placeholder')); }
function showError(message) {
  const error = node('p', message, 'hw-fail'); error.setAttribute('role', 'alert'); body.replaceChildren(error);
}
async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `请求失败：${response.status}`);
  return data;
}
function choose(id) {
  const sample = description.samples.find(item => item.id === id);
  kindSelect.value = sample.kind;
  editor.value = JSON.stringify(sample.input, null, 2);
  byId('input-label').textContent = 'JSON 输入 · fixture 样例';
  clearResult();
}
sampleSelect.addEventListener('change', () => choose(sampleSelect.value));
kindSelect.addEventListener('change', clearResult);
editor.addEventListener('input', () => {
  byId('input-label').textContent = 'JSON 输入 · 编辑 / 粘贴数据'; clearResult();
});

byId('input-form').addEventListener('submit', async event => {
  event.preventDefault();
  const kind = kindSelect.value, jsonText = editor.value;
  for (const control of [sampleSelect, kindSelect, editor, button]) control.disabled = true;
  byId('result').setAttribute('aria-busy', 'true'); button.textContent = '正在检查…';
  body.replaceChildren(node('p', '正在等待本机服务返回结果…', 'hw-placeholder'));
  try {
    const result = await request('/api/inspect', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, jsonText }) });
    body.replaceChildren(node('div', result.accepted ? '✓ 通过' : '× 拒绝', `hw-status ${result.accepted ? 'hw-pass' : 'hw-fail'}`));
    if (result.fixtureDemo) body.append(node('p', '协议演示 fixture：只检查显式输入声明。', 'hw-fixture'));
    if (result.accepted) body.append(node('pre', JSON.stringify(result.summary, null, 2)));
    else {
      body.append(node('p', result.reason), node('p', `出错字段：${result.fields.join('、')}`));
      body.append(node('code', `${result.error.code} / ${result.error.phase} / ${result.error.reason}`));
    }
    body.append(node('p', `执行位置：本机开发服务 · hanaworlds-contracts ${result.contractsVersion}`, 'hw-muted'));
    if (result.input) {
      const details = node('details'); details.append(node('summary', '已检查的输入'), node('pre', JSON.stringify(result.input, null, 2))); body.append(details);
    }
  } catch (error) { showError(error.message); }
  finally {
    for (const control of [sampleSelect, kindSelect, editor, button]) control.disabled = false;
    byId('result').setAttribute('aria-busy', 'false'); button.textContent = '检查';
  }
});

try {
  description = await request('/api/describe');
  byId('version').textContent = `Contracts ${description.contractsVersion}`;
  for (const sample of description.samples) {
    const option = node('option', `${sample.label} · fixture`); option.value = sample.id; sampleSelect.append(option);
  }
  for (const protocol of description.protocols) {
    const row = node('tr'); row.append(node('td', protocol.protocol), node('td', protocol.major), node('td', protocol.minor)); byId('protocols').append(row);
  }
  byId('capability-heading').textContent = `查看 ${description.capabilityDeclarations.length} 项公开必需能力`;
  for (const capability of description.capabilityDeclarations) {
    const item = node('li'); item.append(node('code', capability.id), node('div', `声明归属：${capability.owner}`, 'hw-muted')); byId('capabilities').append(item);
  }
  sampleSelect.value = 'region-fill'; choose('region-fill'); sampleSelect.disabled = false; button.disabled = false;
} catch (error) { showError(`无法读取本机合约声明：${error.message}`); }

const React = require('react');
const { useState, useEffect, useRef } = React;
const h = React.createElement;
const panelId = 'hanaworlds-contract-inspector';
const css = `
.hw-inspector{height:100%;overflow:auto;background:var(--ds-bg-primary,#f7f8f7);color:var(--ds-text-primary,#26332e);padding:calc(var(--dsh-frame-top-clearance,0px) + 22px) 28px 28px;box-sizing:border-box;font:14px/1.5 system-ui,sans-serif}
.hw-inspector *{box-sizing:border-box}.hw-inspector .hw-wrap{max-width:1100px;margin:0 auto}.hw-inspector h1{margin:2px 0 6px;font-size:26px;letter-spacing:-.6px}.hw-inspector h2{font-size:15px;margin:0 0 12px}.hw-inspector p{margin:0 0 12px}.hw-inspector .hw-kicker{font:11px ui-monospace,monospace;letter-spacing:1.6px;color:#527261}.hw-inspector .hw-muted{color:var(--ds-text-secondary,#64736b);font-size:12px}.hw-inspector .hw-tag{display:inline-block;border:1px solid #c6d8cb;background:#edf5ef;color:#315b40;border-radius:6px;padding:3px 8px;font-size:11px;margin-right:6px}.hw-inspector .hw-fixture{border-left:3px solid #bc912f;background:#fff7e4;color:#775716;padding:10px 14px;border-radius:5px;margin:20px 0}.hw-inspector .hw-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,1fr);gap:18px}.hw-inspector .hw-card{border:1px solid var(--ds-border,#d9e0db);background:var(--ds-bg-elevated,#fff);border-radius:12px;padding:20px;min-width:0}.hw-inspector label{display:block;font-weight:550;font-size:12px;margin:12px 0 6px}.hw-inspector select,.hw-inspector textarea{width:100%;border:1px solid #c5d1c9;border-radius:7px;background:var(--ds-bg-primary,#fff);color:inherit;padding:9px 10px;font:inherit}.hw-inspector textarea{resize:vertical;height:330px;font:12px/1.55 ui-monospace,SFMono-Regular,monospace;tab-size:2}.hw-inspector select:focus,.hw-inspector textarea:focus{outline:2px solid #508261;outline-offset:2px}.hw-inspector button{border:0;border-radius:7px;background:#315e43;color:white;font:600 14px system-ui;padding:10px 22px;cursor:pointer}.hw-inspector button:disabled{opacity:.55;cursor:default}.hw-inspector button:focus-visible{outline:2px solid #508261;outline-offset:3px}.hw-inspector .hw-actions{display:flex;align-items:center;gap:12px;margin-top:14px}.hw-inspector .hw-status{font-size:22px;font-weight:650;letter-spacing:-.4px;margin:0 0 8px}.hw-inspector .hw-pass{color:#267041}.hw-inspector .hw-fail{color:#b34438}.hw-inspector pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 ui-monospace,monospace;margin:10px 0 0}.hw-inspector .hw-placeholder{padding:40px 0;color:#6a7971}.hw-inspector .hw-detail{margin-top:18px}.hw-inspector summary{cursor:pointer;font-weight:600;padding:2px 0}.hw-inspector table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}.hw-inspector th,.hw-inspector td{text-align:left;padding:7px 9px;border-bottom:1px solid var(--ds-border,#e5eae6)}.hw-inspector th{color:#6a7971;font-weight:500}.hw-inspector code{font:12px ui-monospace,monospace;overflow-wrap:anywhere}.hw-inspector .hw-capabilities{padding-left:18px;font-size:12px}.hw-inspector .hw-capabilities li{margin:8px 0}@media(max-width:850px){.hw-inspector{padding-left:16px;padding-right:16px}.hw-inspector .hw-grid{grid-template-columns:1fr}}
`;
exports.name = 'hanaworlds-contract-inspector';
exports.inject = ['slots', 'connection'];
exports.apply = function apply(ctx) {
  async function call(method, args, signal) {
    const response = await ctx.connection.rpc.call('/api', `contractInspector/${method}`, { args }, signal);
    if (!response.ok) throw new Error(`${response.error.code}: ${response.error.message}`);
    return response.value;
  }
  function Icon() { return h('span', { style: { font: '600 14px ui-monospace' }, 'aria-hidden': true }, '{✓}'); }
  function Panel() {
    const [description, setDescription] = useState(null);
    const [sampleId, setSampleId] = useState('region-fill');
    const [kind, setKind] = useState('region');
    const [text, setText] = useState('');
    const [source, setSource] = useState('fixture 样例');
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const controller = useRef(null);
    useEffect(() => {
      const lifetime = new AbortController(); controller.current = lifetime;
      call('describe', {}, lifetime.signal).then(d => {
        if (lifetime.signal.aborted) return;
        setDescription(d);
        setText(JSON.stringify(d.samples.find(s => s.id === 'region-fill').input, null, 2));
      }).catch(e => { if (!lifetime.signal.aborted) setError(`无法读取 Host 合约声明：${e.message}`); });
      return () => lifetime.abort();
    }, []);
    function choose(id) {
      const sample = description.samples.find(s => s.id === id);
      setSampleId(id); setKind(sample.kind); setText(JSON.stringify(sample.input, null, 2));
      setSource('fixture 样例'); setResult(null); setError('');
    }
    async function inspect(event) {
      event.preventDefault(); setBusy(true); setError(''); setResult(null);
      try {
        const value = await call('inspect', { kind, jsonText: text }, controller.current.signal);
        if (!controller.current.signal.aborted) setResult(value);
      } catch (e) { if (!controller.current.signal.aborted) setError(`Host 检查失败：${e.message}`); }
      finally { if (!controller.current.signal.aborted) setBusy(false); }
    }
    return h('section', { className: 'hw-inspector', 'aria-label': '合约检查器' },
      h('style', null, css),
      h('div', { className: 'hw-wrap' },
        h('div', { className: 'hw-kicker' }, 'HANAWORLDS / CONTRACTS'),
        h('h1', null, '合约检查器'),
        h('p', { className: 'hw-muted' }, '输入建筑或区域数据，在本机 Host 中检查公开合约。'),
        h('span', { className: 'hw-tag' }, `Contracts ${description?.contractsVersion ?? '读取中'}`),
        h('span', { className: 'hw-tag' }, '只读检查 · 无世界写入'),
        h('div', { className: 'hw-fixture' }, '样例输入与协议兼容演示均为 fixture；不代表其他插件实时状态。air 表示显式挖空，null 表示不指定。'),
        h('div', { className: 'hw-grid' },
          h('form', { className: 'hw-card', onSubmit: inspect },
            h('h2', null, '01 / 输入'),
            h('label', { htmlFor: 'hw-sample' }, '选择样例'),
            h('select', { id: 'hw-sample', value: sampleId, disabled: !description || busy, onChange: e => choose(e.target.value) },
              ...(description?.samples ?? []).map(s => h('option', { key: s.id, value: s.id }, `${s.label} · fixture`))),
            h('label', { htmlFor: 'hw-kind' }, '检查类型'),
            h('select', { id: 'hw-kind', value: kind, disabled: busy, onChange: e => { setKind(e.target.value); setResult(null); } },
              h('option', { value: 'building' }, '建筑 · BuildProjection / BUILD/V3'),
              h('option', { value: 'region' }, '区域 · RegionVoxelBlock / region-voxels/v1'),
              h('option', { value: 'protocol' }, '协议兼容演示 · 显式输入声明')),
            h('label', { htmlFor: 'hw-json' }, `JSON 输入 · ${source}`),
            h('textarea', { id: 'hw-json', value: text, disabled: busy, spellCheck: false, onChange: e => { setText(e.target.value); setSource('编辑 / 粘贴数据'); setResult(null); setError(''); } }),
            h('div', { className: 'hw-actions' },
              h('button', { type: 'submit', disabled: !description || busy }, busy ? '正在检查…' : '检查'),
              h('span', { className: 'hw-muted' }, '由 Host 调用公开纯函数'))),
          h('div', { className: 'hw-card', 'aria-live': 'polite', 'aria-busy': busy },
            h('h2', null, '02 / 检查结果'),
            error ? h('p', { role: 'alert', className: 'hw-fail' }, error) : result ? h(React.Fragment, null,
              h('div', { className: `hw-status ${result.accepted ? 'hw-pass' : 'hw-fail'}` }, result.accepted ? '✓ 通过' : '× 拒绝'),
              result.fixtureDemo && h('p', { className: 'hw-fixture' }, '协议演示 fixture：只检查显式输入声明。'),
              !result.accepted && h(React.Fragment, null,
                h('p', null, result.reason),
                h('p', null, h('strong', null, '出错字段：'), h('code', null, result.fields.join('、'))),
                h('p', null, h('code', null, `${result.error.code} / ${result.error.phase} / ${result.error.reason}`))),
              result.accepted && h('pre', null, JSON.stringify(result.summary, null, 2)),
              h('p', { className: 'hw-muted', style: { marginTop: 18 } }, `执行位置：Host · hanaworlds-contracts ${result.contractsVersion}`),
              result.input && h('details', null, h('summary', null, '已检查的输入'), h('pre', null, JSON.stringify(result.input, null, 2))))
              : h('p', { className: 'hw-placeholder' }, busy ? '正在等待 Host 返回结果…' : '选择样例或粘贴 JSON，点击「检查」。'))),
        description && h('details', { className: 'hw-card hw-detail', open: true },
          h('summary', null, '合约公开声明 · 协议 major 与必需能力'),
          h('p', { className: 'hw-muted', style: { marginTop: 10 } }, '以下来自本插件 Contracts 的实际公开元数据。能力是协议要求及归属声明，未探测对应插件是否安装或具备能力。'),
          h('table', null,
            h('thead', null, h('tr', null, ...['协议', 'major', 'minor'].map(v => h('th', { key: v }, v)))),
            h('tbody', null, ...description.protocols.map(p => h('tr', { key: p.protocol }, h('td', null, h('code', null, p.protocol)), h('td', null, p.major), h('td', null, p.minor))))),
          h('details', { style: { marginTop: 14 } }, h('summary', null, `查看 ${description.capabilityDeclarations.length} 项公开必需能力`),
            h('ul', { className: 'hw-capabilities' }, ...description.capabilityDeclarations.map(c => h('li', { key: c.id }, h('code', null, c.id), h('div', { className: 'hw-muted' }, `声明归属：${c.owner}`))))),
          h('p', { className: 'hw-muted', style: { marginTop: 12 } }, '兼容规则：major 相同，minor 不低于要求，必需能力齐全。包版本、提交与摘要只作来源记录。'))));
  }
  ctx.slots.register({ name: 'main', key: panelId }, Panel);
  ctx.slots.register({ name: 'sidebar.panellist', id: panelId, label: '合约检查器', order: 25 }, Icon);
};

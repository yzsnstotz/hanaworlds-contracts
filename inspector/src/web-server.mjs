import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { describeInspector, inspectJSON } from './inspection.mjs';

const clientSource = await readFile(new URL('./client.cjs', import.meta.url), 'utf8');
const css = clientSource.match(/const css = `([\s\S]*?)`;/)?.[1];
if (!css) throw new Error('Inspector panel stylesheet is missing');
const html = (await readFile(new URL('../web/index.html', import.meta.url), 'utf8')).replace('/* PANEL_STYLE */', css);
const javascript = await readFile(new URL('../web/client.js', import.meta.url));
// Validate the exact Contracts runtime before announcing a usable listener.
describeInspector();

const server = createServer(async (request, response) => {
  function send(status, type, body) {
    response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    response.end(body);
  }
  function json(status, value) { send(status, 'application/json; charset=utf-8', JSON.stringify(value)); }
  // Route by path so links that carry a query string still open the page.
  let path = new URL(request.url, 'http://127.0.0.1:47604').pathname;
  if (request.method === 'GET' && path !== '/client.js' && !path.startsWith('/api/')) path = '/';
  try {
    if (request.method === 'GET' && path === '/') return send(200, 'text/html; charset=utf-8', html);
    if (request.method === 'GET' && path === '/client.js') return send(200, 'text/javascript; charset=utf-8', javascript);
    if (request.method === 'GET' && path === '/api/describe') return json(200, describeInspector());
    if (request.method === 'POST' && path === '/api/inspect') {
      const parts = [];
      for await (const part of request) parts.push(part);
      let input;
      try { input = JSON.parse(Buffer.concat(parts).toString('utf8')); }
      catch { return json(400, { error: '检查请求不是有效 JSON。' }); }
      if (!['building', 'region', 'protocol'].includes(input?.kind) || typeof input?.jsonText !== 'string') {
        return json(400, { error: '请选择检查类型并输入 JSON 文本。' });
      }
      return json(200, inspectJSON(input.kind, input.jsonText));
    }
    send(404, 'text/plain; charset=utf-8', 'Not found');
  } catch (error) {
    console.error(error);
    json(500, { error: `本机检查失败：${error.message}` });
  }
});
server.on('error', error => { console.error(error); process.exitCode = 1; });
server.listen(47604, '127.0.0.1', () => console.log('Contract Inspector ready at http://127.0.0.1:47604/ · Contracts 0.5.5-rc.1 · read-only'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('inspector/package.json', root), 'utf8'));
const body = await readFile(new URL('inspector/src/client.cjs', root), 'utf8');
await mkdir(new URL('inspector/lib/', root), { recursive: true });
const bundle = `// Generated from inspector/src/client.cjs by tools/build-contract-inspector.mjs.\nwindow.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{\nconst module={exports:{}};const exports=module.exports;\n${body}\nreturn module.exports;\n}});\n`;
await writeFile(new URL('inspector/lib/client.js', root), bundle);
console.log('Built', pkg.name, pkg.version, Buffer.byteLength(bundle), 'bytes at', fileURLToPath(new URL('inspector/lib/client.js', root)));

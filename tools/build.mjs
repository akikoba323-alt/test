// Bundles src/ into two single-page builds:
//   dist/index.html     standalone page, imports three.js from ./three.module.min.js (served locally)
//   dist/artifact.html  page fragment for claude.ai Artifacts, imports three.js from jsdelivr
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const threePkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/three/package.json'), 'utf8'));
const THREE_CDN = `https://cdn.jsdelivr.net/npm/three@${threePkg.version}/build/three.module.js`;
const watch = process.argv.includes('--watch');
const minify = !process.argv.includes('--dev');

function threeExternal(url) {
  return {
    name: 'three-external',
    setup(build) {
      build.onResolve({ filter: /^three$/ }, () => ({ path: url, external: true }));
    },
  };
}

async function bundle(threeUrl) {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'src/main.js')],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify,
    legalComments: 'none',
    write: false,
    plugins: [threeExternal(threeUrl)],
    loader: { '.glsl': 'text' },
    define: { __THREE_VERSION__: JSON.stringify(threePkg.version) },
  });
  return result.outputFiles[0].text;
}

function page(template, js, standalone) {
  // A literal "</script" inside the bundle would terminate the inline tag early.
  const safe = js.replace(/<\/script/gi, '<\\/script');
  const body = template.replace('/*__APP__*/', () => safe);
  if (!standalone) return body;
  return `<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}

async function buildAll() {
  const t0 = Date.now();
  const template = fs.readFileSync(path.join(root, 'src/page.html'), 'utf8');
  const [localJs, cdnJs] = await Promise.all([bundle('./three.module.js'), bundle(THREE_CDN)]);
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  for (const f of ['three.module.js', 'three.core.js']) fs.copyFileSync(path.join(root, 'node_modules/three/build', f), path.join(root, 'dist', f));
  fs.writeFileSync(path.join(root, 'dist/index.html'), page(template, localJs, true));
  fs.writeFileSync(path.join(root, 'dist/artifact.html'), page(template, cdnJs, false));
  const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' KB';
  console.log(`built in ${Date.now() - t0} ms  app ${kb(localJs)}  three ${threePkg.version}`);
}

try {
  await buildAll();
} catch (e) {
  console.error(e.message);
  if (!watch) process.exit(1);
}
if (watch) {
  let timer = null;
  fs.watch(path.join(root, 'src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => buildAll().catch((e) => console.error(e.message)), 80);
  });
  console.log('watching src/ ...');
}

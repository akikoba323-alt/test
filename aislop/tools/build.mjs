// Build: generate icon data from Lucide (ISC), bundle src/main.js -> dist/bundle.js, copy page.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

// --- icons: convert lucide icon nodes into arrays of SVG path strings
const iconOut = path.join(root, 'src/lib/icondata.js');
const nodesFile = path.join(root, 'node_modules/lucide-static/icon-nodes.json');
if (!fs.existsSync(iconOut) || fs.statSync(iconOut).mtimeMs < fs.statSync(nodesFile).mtimeMs) {
  const nodes = JSON.parse(fs.readFileSync(nodesFile, 'utf8'));
  const n = (v) => Number(v);
  const toD = ([t, a]) => {
    switch (t) {
      case 'path': return a.d;
      case 'circle': { const cx = n(a.cx), cy = n(a.cy), r = n(a.r); return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`; }
      case 'ellipse': { const cx = n(a.cx), cy = n(a.cy), rx = n(a.rx), ry = n(a.ry); return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`; }
      case 'rect': {
        const x = n(a.x || 0), y = n(a.y || 0), w = n(a.width), h = n(a.height); let r = n(a.rx || a.ry || 0); r = Math.min(r, w / 2, h / 2);
        if (!r) return `M${x} ${y}h${w}v${h}h${-w}z`;
        return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
      }
      case 'line': return `M${a.x1} ${a.y1}L${a.x2} ${a.y2}`;
      case 'polyline': return 'M' + a.points.trim().split(/[\s,]+/).reduce((s, v, i, arr) => (i % 2 ? s : s + (i ? 'L' : '') + v + ' ' + arr[i + 1]), '');
      case 'polygon': return 'M' + a.points.trim().split(/[\s,]+/).reduce((s, v, i, arr) => (i % 2 ? s : s + (i ? 'L' : '') + v + ' ' + arr[i + 1]), '') + 'z';
      default: return '';
    }
  };
  const out = {};
  for (const [name, list] of Object.entries(nodes)) out[name] = list.map(toD).filter(Boolean);
  fs.writeFileSync(iconOut, '// generated from lucide-static (ISC license) by tools/build.mjs\nexport default ' + JSON.stringify(out) + ';\n');
  console.log('icons:', Object.keys(out).length);
}

const watch = process.argv.includes('--watch');
const opts = {
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  format: 'esm',
  outfile: path.join(dist, 'bundle.js'),
  sourcemap: 'inline',
  target: 'chrome120',
  logLevel: 'warning',
  loader: { '.glsl': 'text' },
};
fs.copyFileSync(path.join(root, 'src/index.html'), path.join(dist, 'index.html'));
if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log('watching...');
} else {
  const t0 = Date.now();
  await esbuild.build(opts);
  console.log(`built in ${Date.now() - t0}ms`);
}

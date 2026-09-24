// Fighter trajectory probe: node tools/traj.mjs --t0 10 --t1 20 --step 0.02 --out file.json
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import { serve } from './serve.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => { if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]); return acc; }, []));
const server = await serve(0);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text().slice(0, 500)); });
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?offline=1&w=320&h=200&q=low&test=film&tw=1`);
await page.waitForFunction(() => window.__ready === true || window.__failed, null, { timeout: 600000, polling: 200 });
const data = await page.evaluate(([a, b, c]) => window.__traj(a, b, c), [Number(args.t0 || 0), Number(args.t1 || 10), Number(args.step || 0.02)]);
fs.writeFileSync(args.out || '/tmp/traj.json', JSON.stringify(data));
console.log('frames', data.length, '->', args.out);
await browser.close(); server.close();

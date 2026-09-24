// Shared headless Chromium launcher. WebGL2 runs on Mesa llvmpipe through ANGLE/EGL (3-5x faster than SwiftShader here).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

export async function openPage(url, { W, H, quiet = false, threads } = {}) {
  const env = { ...process.env, EGL_PLATFORM: 'surfaceless', LIBGL_ALWAYS_SOFTWARE: '1', GALLIUM_DRIVER: 'llvmpipe' };
  if (threads) env.LP_NUM_THREADS = String(threads);
  const browser = await chromium.launch({
    env,
    args: ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu', '--disable-software-rasterizer', '--disable-gpu-watchdog',
      '--js-flags=--max-old-space-size=8192', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--font-render-hinting=none'],
  });
  const page = await browser.newPage({ viewport: { width: Math.min(W, 1920), height: Math.min(H, 1080) } });
  page.on('console', (m) => {
    const t = m.text();
    if (t.includes('GPU stall due to ReadPixels')) return;
    if (!quiet || m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}] ${t.slice(0, 1500)}`);
  });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(0, 5).join(' | ')));
  await page.goto(url);
  await page.waitForFunction(() => window.__ready === true || window.__failed, null, { timeout: 900000, polling: 250 });
  const failed = await page.evaluate(() => window.__failed);
  if (failed) { await browser.close(); throw new Error('page init failed: ' + failed); }
  const renderer = await page.evaluate(() => { const g = window.__eng.gl.gl; const d = g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?'; });
  if (!quiet) console.log('renderer:', renderer);
  if (!/llvmpipe/.test(renderer)) console.log('WARNING: not running on llvmpipe:', renderer);
  return { browser, page };
}

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('view');
const W = Number(params.get('w')) || innerWidth, H = Number(params.get('h')) || innerHeight;

async function boot() {
  try {
    const test = params.get('test');
    if (test === 'film') { const { runFilmTest } = await import('./testfilm.js'); await runFilmTest(canvas, W, H, params); return; }
    if (test === 'city') { const { runCityTest } = await import('./testcity.js'); await runCityTest(canvas, W, H, params); return; }
    if (test === 'fx') { const { runFxTest } = await import('./testfx.js'); await runFxTest(canvas, W, H, params); return; }
    if (test === 'mocap') { const { runMocapTest } = await import('./testmocap.js'); await runMocapTest(canvas, W, H, params); return; }
    if (test === 'char') { const { runCharTest } = await import('./testchar.js'); await runCharTest(canvas, W, H, params); return; }
    if (params.has('render')) { const { runRender } = await import('./render.js'); await runRender(canvas, W, H, params); return; }
    const { runApp } = await import('./app.js');
    await runApp(canvas, params);
  } catch (e) {
    console.error(e.stack || e);
    window.__failed = true;
    const t = document.getElementById('ptxt');
    if (t) t.textContent = '起動に失敗しました: ' + (e.message || e) + ' — WebGL2 に対応したブラウザで開いてください。';
  }
}
boot();

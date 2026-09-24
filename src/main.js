const params = new URLSearchParams(location.search);
const canvas = document.getElementById('view');
const W = Number(params.get('w')) || innerWidth, H = Number(params.get('h')) || innerHeight;

async function boot() {
  try {
    if (params.get('test') === 'city') {
      const { runCityTest } = await import('./testcity.js');
      await runCityTest(canvas, W, H, params);
      return;
    }
    if (params.get('test') === 'film') {
      const { runFilmTest } = await import('./testfilm.js');
      await runFilmTest(canvas, W, H, params);
      return;
    }
    if (params.get('test') === 'fx') {
      const { runFxTest } = await import('./testfx.js');
      await runFxTest(canvas, W, H, params);
      return;
    }
    if (params.get('test') === 'char') {
      const { runCharTest } = await import('./testchar.js');
      await runCharTest(canvas, W, H, params);
      return;
    }
  } catch (e) {
    console.error(e.stack || e);
    window.__failed = true;
  }
}
boot();

// 3D "content factory": parallel conveyor lines carrying video packages, stamping presses, industrial lights.
import { THREE } from '../engine/gl.js';
import { videoThumb, atlas } from './thumbs.js';

export function buildFactory(o = {}) {
  const lines = o.lines ?? 9, spacing = o.spacing ?? 3.2, len = o.len ?? 80;
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.FogExp2(0x0b0c0e, o.fog ?? 0.028);
  // textures
  const thumbs = atlas(64, 256, 144, 8, (ctx, x, y, w, h, i) => videoThumb(ctx, x, y, w, h, i * 5 + 11, i % 3 === 0 ? 'slop' : 'bait'));
  const tex = new THREE.CanvasTexture(thumbs.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x18191c, roughness: 0.55, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  // belts
  const beltCv = document.createElement('canvas'); beltCv.width = 64; beltCv.height = 512;
  const bctx = beltCv.getContext('2d'); bctx.fillStyle = '#1b1c20'; bctx.fillRect(0, 0, 64, 512);
  for (let k = 0; k < 32; k++) { bctx.fillStyle = k % 2 ? '#26272c' : '#1f2024'; bctx.fillRect(0, k * 16, 64, 3); }
  const beltTex = new THREE.CanvasTexture(beltCv); beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping; beltTex.repeat.set(1, len / 2);
  const beltMat = new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.8, metalness: 0.1 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x55585f, roughness: 0.35, metalness: 0.85 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.5, metalness: 0.6 });
  const group = new THREE.Group(); scene.add(group);
  const lineX = [];
  for (let l = 0; l < lines; l++) {
    const x = (l - (lines - 1) / 2) * spacing; lineX.push(x);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, len), beltMat); belt.position.set(x, 0.9, 0); belt.receiveShadow = true; group.add(belt);
    for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, len), railMat); rail.position.set(x + s * 0.6, 0.95, 0); rail.castShadow = true; group.add(rail); }
    for (let z = -len / 2; z <= len / 2; z += 4) for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), legMat); leg.position.set(x + s * 0.5, 0.45, z); group.add(leg); }
  }
  // packages: instanced boxes whose top face shows a thumbnail (per-instance atlas cell)
  const per = o.per ?? 40;
  const n = lines * per;
  const pg = new THREE.BoxGeometry(0.78, 0.3, 0.46);
  const pm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, metalness: 0.05 });
  const cell = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2);
  const stamp = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  pg.setAttribute('aCell', cell); pg.setAttribute('aStamp', stamp);
  pm.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCell; attribute float aStamp; varying vec2 vCell; varying float vStamp; varying vec3 vObjN;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvCell = aCell; vStamp = aStamp; vObjN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vCell; varying float vStamp; varying vec3 vObjN;')
      .replace('#include <map_fragment>', `
        vec2 uvc = vMapUv;
        vec4 texel = texture2D(map, (vCell + vec2(uvc.x, uvc.y)) / vec2(8., 8.));
        float top = step(.5, vObjN.y);
        vec3 side = vec3(.72, .69, .62);
        vec3 base = mix(side, texel.rgb, top);
        // lime stamp band on the top once stamped
        float band = top * vStamp * step(.62, uvc.x) * step(uvc.x, .96) * step(.08, uvc.y) * step(uvc.y, .38);
        base = mix(base, vec3(.55, .78, .05), band);
        diffuseColor.rgb *= base;`);
  };
  const pkgs = new THREE.InstancedMesh(pg, pm, n); pkgs.castShadow = true; pkgs.receiveShadow = true; group.add(pkgs);
  for (let i = 0; i < n; i++) { const k = (i * 37) % 64; cell.setXY(i, k % 8, 7 - Math.floor(k / 8)); }
  // presses (one per line)
  const pressMat = new THREE.MeshStandardMaterial({ color: 0xc6f432, roughness: 0.4, metalness: 0.3, emissive: 0x1a2a02, emissiveIntensity: 0.6 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x35373d, roughness: 0.4, metalness: 0.8 });
  const presses = [];
  const pressZ = o.pressZ ?? 2;
  for (const x of lineX) {
    const g = new THREE.Group();
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.7), frameMat); fr.position.y = 2.8; g.add(fr);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.8, 0.15), frameMat); p.position.set(s * 0.75, 1.4, 0); p.castShadow = true; g.add(p); }
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.45), pressMat); head.castShadow = true; g.add(head);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2), frameMat); g.add(rod);
    g.position.set(x, 0, pressZ); group.add(g);
    presses.push({ head, rod });
  }
  // lights
  scene.add(new THREE.HemisphereLight(0x8090a0, 0x101014, 0.35));
  const key = new THREE.DirectionalLight(0xfff0dc, 1.6); key.position.set(-6, 14, 8); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -20; key.shadow.camera.right = 20; key.shadow.camera.top = 20; key.shadow.camera.bottom = -20; key.shadow.camera.far = 60; key.shadow.bias = -0.0006;
  scene.add(key);
  // overhead lamp strips
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 3.6) });
  const lamps = new THREE.Group(); scene.add(lamps);
  for (let z = -len / 2; z <= len / 2; z += 6) { const lamp = new THREE.Mesh(new THREE.BoxGeometry(lines * spacing, 0.05, 0.25), lampMat); lamp.position.set(0, 7, z); lamps.add(lamp); }
  for (let z = -len / 2; z <= len / 2; z += 12) { const pl = new THREE.PointLight(0xfff2dd, 9, 18, 1.6); pl.position.set(0, 6.5, z); scene.add(pl); }
  const accent = new THREE.PointLight(0xc6f432, 6, 16, 1.4); accent.position.set(0, 3.5, pressZ); scene.add(accent);

  const o3 = new THREE.Object3D();
  function update(t, speed = 1.4) {
    beltTex.offset.y = -t * speed / 2;
    for (let l = 0; l < lines; l++) {
      for (let k = 0; k < per; k++) {
        const i = l * per + k;
        const z0 = -len / 2 + ((k * (len / per) + t * speed + l * 0.7) % len);
        o3.position.set(lineX[l], 1.09, z0);
        o3.rotation.set(0, (Math.sin(i * 12.3) * 0.04), 0);
        o3.updateMatrix(); pkgs.setMatrixAt(i, o3.matrix);
        stamp.setX(i, z0 > pressZ + 0.2 ? 1 : 0);
      }
    }
    pkgs.instanceMatrix.needsUpdate = true; stamp.needsUpdate = true;
    // press stroke synced to package pitch
    const pitch = len / per;
    presses.forEach((p, l) => {
      const ph = ((((t * speed + l * 0.7 - (len / 2 + pressZ)) % pitch) + pitch) % pitch) / pitch; // 0 when a package is under the press
      const d = Math.min(ph, 1 - ph);
      const down = Math.max(0, 1 - d * 7);
      const y = 2.35 - down * 1.05;
      p.head.position.y = y; p.rod.position.y = y + 0.75;
    });
  }
  return { scene, update, lineX, len, lamps };
}

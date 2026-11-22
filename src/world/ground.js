// Textura do chão do mapa inteiro: cor por altitude e inclinação + áreas, ruas, calçadas e rio do OSM.
// Serve de "LOD" das ruas: de longe a rua é só a textura; de perto vira geometria (roads.js).
import * as THREE from 'three';

const RAMP = [[20, [143, 186, 92]], [60, [122, 168, 80]], [160, [92, 145, 64]], [350, [74, 122, 54]], [550, [88, 122, 60]], [750, [128, 138, 92]]];

export const AREA_COLORS = {
  park: '#6dae4f', garden: '#6dae4f', grass: '#82b65c', pitch: '#4f9a3a', forest: '#3f6e34', cemetery: '#a9ab98',
  water: '#3f86bd', pool: '#4fb6e0', parking: '#9a9a94', industrial: '#b9b2a6', retail: '#c9bfb2', commercial: '#c9bfb2',
  quarry: '#b8ab92', farmland: '#a7b56a', residential: null,
};

export function buildGroundCanvas(terrain, world, maxSize) {
  const t = terrain, aspect = t.W / t.H;
  const H = maxSize, W = Math.round(maxSize * aspect);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // 1. base: relevo na resolução do grid, depois ampliada com suavização
  const b = document.createElement('canvas'); b.width = t.nx; b.height = t.nz;
  const bg = b.getContext('2d'), im = bg.createImageData(t.nx, t.nz);
  for (let j = 0; j < t.nz; j++) for (let i = 0; i < t.nx; i++) {
    const e = t.hi(i, j);
    let q = 0; while (q < RAMP.length - 2 && e > RAMP[q + 1][0]) q++;
    const [a0, c0] = RAMP[q], [a1, c1] = RAMP[q + 1], u = Math.min(1, Math.max(0, (e - a0) / (a1 - a0)));
    const slope = Math.hypot(t.hi(i + 1, j) - t.hi(i - 1, j), t.hi(i, j + 1) - t.hi(i, j - 1)) / (2 * t.cell);
    const rock = Math.min(1, Math.max(0, (slope - 0.55) / 0.5)) * 0.65;
    const k = (j * t.nx + i) * 4;
    for (let ch = 0; ch < 3; ch++) im.data[k + ch] = (c0[ch] + (c1[ch] - c0[ch]) * u) * (1 - rock) + [138, 130, 112][ch] * rock;
    im.data[k + 3] = 255;
  }
  bg.putImageData(im, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(b, 0, 0, W, H);
  // manchas de variação (pasto/mato) para quebrar a uniformidade
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 2500; n++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(60,100,40,0.10)' : 'rgba(190,200,120,0.08)';
    g.beginPath(); g.ellipse(rnd() * W, rnd() * H, 4 + rnd() * 30, 4 + rnd() * 30, rnd() * 3, 0, 7); g.fill();
  }

  // 2. camadas do OSM em coordenadas do mundo
  const sx = W / t.W, sz = H / t.H;
  g.save(); g.scale(sx, sz); g.translate(-t.x0, -t.z0);
  g.lineCap = g.lineJoin = 'round';
  const path = (p, close) => { g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); if (close) g.closePath(); };
  for (const a of world.areas) { const col = AREA_COLORS[a.k]; if (!col) continue; path(a.p, true); g.fillStyle = col; g.fill(); }
  // quintais e lotes: chão mais claro sob e em volta das construções
  g.fillStyle = 'rgba(205,196,170,0.55)';
  for (const [x, z, , w, d, r, , k] of world.gen) {
    g.save(); g.translate(x, z); g.rotate(-r); g.fillRect(-w / 2 - 1.5, -d / 2 - 1.5, w + 3, d + 3); g.restore();
    void k;
  }
  for (const bd of world.buildings) { path(bd.p, true); g.fill(); }
  // rio e córregos
  for (const w of world.water) { path(w.p, false); g.strokeStyle = '#3f86bd'; g.lineWidth = w.w; g.stroke(); }
  // calçadas e ruas
  const order = r => (r.k === 'footway' || r.k === 'path' || r.k === 'track' ? 0 : 1);
  const roads = [...world.roads].sort((a, b) => order(a) - order(b) || a.w - b.w);
  for (const r of roads) {
    if (order(r) === 0) continue;
    path(r.p, false); g.strokeStyle = '#cfc8ba'; g.lineWidth = r.w + (r.k === 'service' ? 1 : 4); g.stroke();
  }
  for (const r of roads) {
    path(r.p, false);
    g.strokeStyle = r.k === 'track' ? '#a88a5e' : r.k === 'path' || r.k === 'footway' ? '#c8b48e' : r.sf === 'unpaved' || r.sf === 'gravel' || r.sf === 'dirt' ? '#a8916a' : '#55585e';
    g.lineWidth = Math.max(r.w, 1 / sx); g.stroke();
  }
  g.restore();
  return c;
}

export function groundTexture(canvas, renderer) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

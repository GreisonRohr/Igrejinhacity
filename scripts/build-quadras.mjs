// Quadras do GEO Igrejinha (camada "Quadras", Prefeitura) em coordenadas do jogo, só no centro (+ margem).
// A borda da quadra é o alinhamento predial: daqui saem calçada e meio-fio no teste ?quadras (src/world/quadras.js).
// Uso: node scripts/build-quadras.mjs  →  public/data/quadras.data.json
import fs from 'node:fs';
import { toXZ } from '../src/geo.js';
const BOX = [-260, -245, 240, 270];   // caixa do centro (centro.js) + 70 m
const f = JSON.parse(fs.readFileSync('data/raw/geoigrejinha/quadras.geojson')).features;
const r1 = v => Math.round(v * 100) / 100, out = [];
for (const q of f) for (const pg of q.geometry.type === 'Polygon' ? [q.geometry.coordinates] : q.geometry.coordinates) {
  const p = pg[0].map(c => toXZ(c[1], c[0]).map(r1)); if (p.length > 1 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1]) p.pop();
  if (!p.some(([x, z]) => x > BOX[0] && x < BOX[2] && z > BOX[1] && z < BOX[3])) continue;
  out.push(p);
}
fs.writeFileSync('public/data/quadras.data.json', JSON.stringify({ fonte: 'GEO Igrejinha — Quadras (pmirs.nextgis.com, camada 7577)', quadras: out }));
console.log('quadras no centro:', out.length);

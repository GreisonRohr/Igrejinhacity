// Baixa tiles Terrarium (AWS elevation-tiles-prod) e gera data/terrain.bin (grade em metros locais).
import fs from 'node:fs'; import path from 'node:path'; import { PNG } from 'pngjs';
import { BBOX, toXZ, toLatLon } from '../src/geo.js';
const Z = 14, CELL = 10; // metros por célula da grade final
const RAW = 'data/raw/terrarium'; fs.mkdirSync(RAW, { recursive: true });
const lon2t = (lon) => (lon + 180) / 360 * 2 ** Z;
const lat2t = (lat) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** Z; };
const tx0 = Math.floor(lon2t(BBOX.west)), tx1 = Math.floor(lon2t(BBOX.east));
const ty0 = Math.floor(lat2t(BBOX.north)), ty1 = Math.floor(lat2t(BBOX.south));
const tiles = new Map();
for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
  const f = path.join(RAW, `${Z}_${tx}_${ty}.png`);
  if (!fs.existsSync(f)) {
    const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`;
    const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log('baixado', url);
  }
  tiles.set(`${tx}_${ty}`, PNG.sync.read(fs.readFileSync(f)));
}
function elev(lat, lon) { // bilinear em pixels globais
  const px = lon2t(lon) * 256 - 0.5, py = lat2t(lat) * 256 - 0.5;
  const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
  const s = (x, y) => { const t = tiles.get(`${x >> 8}_${y >> 8}`); const i = ((y & 255) * 256 + (x & 255)) * 4;
    return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768; };
  return (s(x0, y0) * (1 - fx) + s(x0 + 1, y0) * fx) * (1 - fy) + (s(x0, y0 + 1) * (1 - fx) + s(x0 + 1, y0 + 1) * fx) * fy;
}
const [xw, zn] = toXZ(BBOX.north, BBOX.west), [xe, zs] = toXZ(BBOX.south, BBOX.east);
const x0 = Math.ceil(xw / CELL) * CELL, z0 = Math.ceil(zn / CELL) * CELL;
const nx = Math.floor((xe - x0) / CELL) + 1, nz = Math.floor((zs - z0) / CELL) + 1;
const h = new Float32Array(nx * nz); let min = 1e9, max = -1e9;
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const [lat, lon] = toLatLon(x0 + i * CELL, z0 + j * CELL); const v = elev(lat, lon);
  h[j * nx + i] = v; min = Math.min(min, v); max = Math.max(max, v);
}
// Int16 em decímetros (cabeçalho JSON separado)
const q = new Int16Array(nx * nz); for (let k = 0; k < q.length; k++) q[k] = Math.round(h[k] * 10);
fs.mkdirSync('data/raw', { recursive: true });
fs.writeFileSync('data/raw/terrarium.bin', Buffer.from(q.buffer));   // fonte de reserva; o relevo final sai de build-terrain.mjs
fs.writeFileSync('data/raw/terrarium.json', JSON.stringify({ x0, z0, nx, nz, cell: CELL, scale: 0.1, min, max }, null, 1));
console.log({ tiles: tiles.size, nx, nz, x0, z0, min: min.toFixed(1), max: max.toFixed(1) });

// Relevo final do jogo (grade de 5 m) a partir das curvas de nível da Prefeitura (1 m, 4 m e 10 m),
// completado pelo relevo de satélite (Terrarium) onde não há curvas.
// Interpolação harmônica (Laplace) entre as curvas, resolvida do grosso para o fino (multigrid simples).
// Saída: public/data/terrain.bin.gz (Int16 em decímetros, linhas com codificação delta) + terrain.json
import fs from 'node:fs';
import zlib from 'node:zlib';
import { toXZ } from '../src/geo.js';

const CELL = 5;
const t0 = Date.now();
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', ...a);

// relevo de satélite (10 m) como base e reserva
const tm = JSON.parse(fs.readFileSync('data/raw/terrarium.json'));
const tq = new Int16Array(fs.readFileSync('data/raw/terrarium.bin').buffer.slice(0));
const sat = (x, z) => {
  const fx = Math.max(0, Math.min(tm.nx - 1.001, (x - tm.x0) / tm.cell)), fz = Math.max(0, Math.min(tm.nz - 1.001, (z - tm.z0) / tm.cell));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, h = (a, b) => tq[b * tm.nx + a] * tm.scale;
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
};

const x0 = tm.x0, z0 = tm.z0;
const W = (tm.nx - 1) * tm.cell, H = (tm.nz - 1) * tm.cell;
const nx = Math.round(W / CELL) + 1, nz = Math.round(H / CELL) + 1, N = nx * nz;
log('grade', nx, 'x', nz, '=', N, 'células');

// 1. rasteriza as curvas: soma/contagem por célula, por nível de detalhe
function rasterContours(file, key) {
  const sum = new Float32Array(N), cnt = new Uint16Array(N);
  if (!fs.existsSync(file)) return null;
  const j = JSON.parse(fs.readFileSync(file));
  for (const f of j.features) {
    const e = +f.properties[key]; if (!Number.isFinite(e)) continue;
    const ls = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const l of ls) {
      let prev = null;
      for (const [lon, lat] of l) {
        const [x, z] = toXZ(lat, lon);
        if (prev) {
          const L = Math.hypot(x - prev[0], z - prev[1]), n = Math.max(1, Math.ceil(L / (CELL * 0.5)));
          for (let k = 1; k <= n; k++) {
            const px = prev[0] + (x - prev[0]) * k / n, pz = prev[1] + (z - prev[1]) * k / n;
            const i = Math.round((px - x0) / CELL), jj = Math.round((pz - z0) / CELL);
            if (i < 0 || jj < 0 || i >= nx || jj >= nz) continue;
            const c = jj * nx + i; sum[c] += e; cnt[c]++;
          }
        }
        prev = [x, z];
      }
    }
  }
  return { sum, cnt };
}
const C1 = rasterContours('data/raw/geoigrejinha/curvas_1m.geojson', 'Elevation'); log('curvas 1 m');
const C4 = rasterContours('data/raw/geoigrejinha/curvas_4m.geojson', 'ELEV'); log('curvas 4 m');
const C10 = rasterContours('data/raw/geoigrejinha/curvas_10m.geojson', 'ELEV'); log('curvas 10 m');

// 2. cobertura por blocos de 60 m: usa o nível mais fino presente no bloco (e vizinhos)
const B = 12, bx = Math.ceil(nx / B), bz = Math.ceil(nz / B);
const blockHas = C => { const m = new Uint8Array(bx * bz); if (!C) return m; for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (C.cnt[j * nx + i]) m[Math.floor(j / B) * bx + Math.floor(i / B)] = 1; return m; };
const dilate = (m, r) => { const o = new Uint8Array(m.length); for (let j = 0; j < bz; j++) for (let i = 0; i < bx; i++) { if (!m[j * bx + i]) continue; for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { const I = i + a, J = j + b; if (I >= 0 && J >= 0 && I < bx && J < bz) o[J * bx + I] = 1; } } return o; };
const cov1 = dilate(blockHas(C1), 1), cov4 = dilate(blockHas(C4), 2), cov10 = dilate(blockHas(C10), 2);
const level = new Uint8Array(N);   // 1, 4, 10 ou 0 (satélite)
const fixed = new Uint8Array(N), val = new Float32Array(N);
let nFix = 0, nSat = 0;
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const c = j * nx + i, b = Math.floor(j / B) * bx + Math.floor(i / B);
  const L = cov1[b] ? 1 : cov4[b] ? 4 : cov10[b] ? 10 : 0; level[c] = L;
  const C = L === 1 ? C1 : L === 4 ? C4 : L === 10 ? C10 : null;
  if (C && C.cnt[c]) { fixed[c] = 1; val[c] = C.sum[c] / C.cnt[c]; nFix++; }
}
// fora de qualquer cobertura: satélite fixo (âncora), a 2 blocos de distância da área com curvas
const anyCov = dilate(cov1.map((v, k) => v | cov4[k] | cov10[k]), 0);
const near = dilate(anyCov, 1);
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
  const c = j * nx + i, b = Math.floor(j / B) * bx + Math.floor(i / B);
  if (!near[b] && !fixed[c]) { fixed[c] = 1; val[c] = sat(x0 + i * CELL, z0 + j * CELL); nSat++; }
}
log('células fixas: curvas', nFix, 'satélite', nSat);

// 3. Laplace multigrid: resolve em 40 m, 20 m, 10 m e 5 m; cada nível parte do anterior
function solve(f, fixedF, valF, nxF, nzF, init, iters) {
  const h = init;
  for (let it = 0; it < iters; it++) {
    for (let pass = 0; pass < 2; pass++) for (let j = 0; j < nzF; j++) for (let i = (j + pass) & 1; i < nxF; i += 2) {
      const c = j * nxF + i; if (fixedF[c]) { h[c] = valF[c]; continue; }
      let s = 0, n = 0;
      if (i > 0) { s += h[c - 1]; n++; } if (i < nxF - 1) { s += h[c + 1]; n++; }
      if (j > 0) { s += h[c - nxF]; n++; } if (j < nzF - 1) { s += h[c + nxF]; n++; }
      h[c] += 1.9 * (s / n - h[c]);   // SOR
    }
  }
  return h;
}
let cur = null, curF = 0, curNx = 0, curNz = 0;
for (const F of [8, 4, 2, 1]) {
  const fnx = Math.ceil(nx / F), fnz = Math.ceil(nz / F), fN = fnx * fnz;
  const fx = new Uint8Array(fN), fv = new Float32Array(fN), fc = new Uint16Array(fN);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const c = j * nx + i; if (!fixed[c]) continue; const k = Math.floor(j / F) * fnx + Math.floor(i / F); fv[k] += val[c]; fc[k]++; }
  for (let k = 0; k < fN; k++) if (fc[k]) { fx[k] = 1; fv[k] /= fc[k]; }
  const init = new Float32Array(fN);
  for (let j = 0; j < fnz; j++) for (let i = 0; i < fnx; i++) {
    init[j * fnx + i] = cur ? cur[Math.min(curNz - 1, Math.floor(j * F / curF)) * curNx + Math.min(curNx - 1, Math.floor(i * F / curF))] : sat(x0 + i * F * CELL, z0 + j * F * CELL);
  }
  cur = solve(null, fx, fv, fnx, fnz, init, F === 1 ? 120 : F === 2 ? 150 : 250);
  curF = F; curNx = fnx; curNz = fnz;
  log('nível', F * CELL, 'm pronto');
}
// suaviza levemente os "degraus" nas curvas (média 3x3 nas células não-âncora de satélite)
const out = new Float32Array(cur);
for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
  const c = j * nx + i; if (level[c] === 0) continue;
  out[c] = (cur[c] * 4 + cur[c - 1] + cur[c + 1] + cur[c - nx] + cur[c + nx]) / 8;
}

// 4. grava: Int16 em decímetros, codificação delta por linha (comprime muito melhor)
const q = new Int16Array(N); let min = Infinity, max = -Infinity;
for (let j = 0; j < nz; j++) { let prev = 0; for (let i = 0; i < nx; i++) { const c = j * nx + i, v = Math.round(out[c] * 10); min = Math.min(min, out[c]); max = Math.max(max, out[c]); q[c] = v - prev; prev = v; } }
const gz = zlib.gzipSync(Buffer.from(q.buffer), { level: 9 });
fs.writeFileSync('public/data/terrain.data.json', JSON.stringify({ gzip_base64: gz.toString('base64') }));
for (const f of ['public/data/terrain.bin.gz']) if (fs.existsSync(f)) fs.unlinkSync(f);
fs.writeFileSync('public/data/terrain.json', JSON.stringify({ x0, z0, nx, nz, cell: CELL, scale: 0.1, delta: true, min, max,
  fonte: 'Curvas de nível GEO Igrejinha (1 m, 4 m, 10 m) + AWS Terrain Tiles' }, null, 1));
if (fs.existsSync('public/data/terrain.bin')) fs.unlinkSync('public/data/terrain.bin');
log('terrain.data.json', (gz.length / 1048576).toFixed(2), 'MB', { min: min.toFixed(1), max: max.toFixed(1) });

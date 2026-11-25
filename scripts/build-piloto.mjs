// PILOTO de reconstrução urbana pelas QUADRAS oficiais da Prefeitura (GEO Igrejinha, camada Quadras).
// Gera, para uma caixa piloto, tudo o que forma a rua a partir do alinhamento predial real:
//   1. eixo de cada via centrado no vão entre as quadras (pista simples, pista dupla com canteiro, cruzamentos);
//   2. meio-fio = borda da quadra deslocada pela largura da calçada, com esquina em arco;
//   3. canteiro central entre as pistas da avenida, aberto nos cruzamentos e retornos, com nariz arredondado;
//   4. classificação do chão sem sobreposição nem vazio (lote / canteiro / calçada / asfalto), em trapézios
//      alinhados à grade do terreno (5 m), e o meio-fio onde calçada ou canteiro encontram o asfalto.
// Os dados originais (world.data.json, quadras.geojson) não são alterados: a correção do eixo sai como um arquivo à
// parte, aplicado no jogo só com o piloto ligado (?piloto ou build experimental).
// Uso: node scripts/build-piloto.mjs  →  public/data/piloto.data.json (+ relatório no console)
import fs from 'node:fs';
import zlib from 'node:zlib';
import { toXZ } from '../src/geo.js';

// Expansão por ETAPAS (cumulativas; cada uma validada e publicada à parte — rollback = etapa anterior).
// Retângulos com lados múltiplos de 5 m (alinhados à grade do terreno). Uso: PILOTO_ETAPA=n node scripts/build-piloto.mjs
export const ETAPAS = [
  { nome: 'Piloto (praça, Castelo Branco, Dorneles, rótula norte)', r: [-190, -60, 60, 410] },
  { nome: 'Centro leste (malha entre a Dorneles e a Rua Tiradentes)', r: [60, -60, 360, 410] },
  { nome: 'Centro norte (até a Igreja e o Centro Administrativo)', r: [-130, -480, 360, -60] },
  { nome: 'Centro, faixa leste até o arroio', r: [360, -300, 640, 330] },
];
const ETAPA = Math.max(1, Math.min(ETAPAS.length, +(process.env.PILOTO_ETAPA || 1)));
const AREAS = ETAPAS.slice(0, ETAPA).map(e => ({ x0: e.r[0], z0: e.r[1], x1: e.r[2], z1: e.r[3] }));
export const BOX = { x0: Math.min(...AREAS.map(a => a.x0)), z0: Math.min(...AREAS.map(a => a.z0)), x1: Math.max(...AREAS.map(a => a.x1)), z1: Math.max(...AREAS.map(a => a.z1)) };
console.log('ETAPA', ETAPA, '—', ETAPAS[ETAPA - 1].nome, '| áreas', AREAS.length);
const FADE = 30;                       // a correção do eixo some em 30 m fora da caixa
const T = 5;                           // ladrilho = célula do terreno (terrain.json: cell 5, origem múltipla de 5)
const URBAN = new Set(['primary', 'secondary', 'tertiary', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link']);
const VEH = r => !r.br && (URBAN.has(r.k) || r.k === 'service' || r.k === 'unclassified');
const r2 = v => Math.round(v * 100) / 100;
const key = q => q[0] + ',' + q[1];
const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const W = JSON.parse(zlib.gunzipSync(Buffer.from(JSON.parse(fs.readFileSync('public/data/world.data.json')).gzip_base64, 'base64')));
const roads = W.roads;
const inBox = (x, z, m = 0) => AREAS.some(A => x > A.x0 - m && x < A.x1 + m && z > A.z0 - m && z < A.z1 + m);   // região = união das áreas
const fadeAt = (x, z) => { let d = Infinity; for (const A of AREAS) { const dx = Math.max(A.x0 - x, 0, x - A.x1), dz = Math.max(A.z0 - z, 0, z - A.z1); d = Math.min(d, Math.hypot(dx, dz)); } return 1 - Math.min(1, d / FADE); };

/* ---------- quadras ---------- */
const signedArea = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
let blocks = [];
for (const f of JSON.parse(fs.readFileSync('data/raw/geoigrejinha/quadras.geojson')).features)
  for (const pg of f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) {
    let p = pg[0].map(c => toXZ(c[1], c[0])); if (p.length > 1 && Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 1e-6) p.pop();
    // remove vértices repetidos/colineares (< 5 cm)
    p = p.filter((q, i) => Math.hypot(q[0] - p[(i + 1) % p.length][0], q[1] - p[(i + 1) % p.length][1]) > 0.05);
    if (p.length < 3 || !p.some(([x, z]) => inBox(x, z, 120))) continue;
    if (signedArea(p) < 0) p.reverse();   // anti-horário (x, z)
    blocks.push(p);
  }

/* ---------- grade de segmentos (raios) ---------- */
class SegGrid {
  constructor(c = 20) { this.c = c; this.m = new Map(); }
  add(s) { const c = this.c; for (let i = Math.floor(Math.min(s.a[0], s.b[0]) / c); i <= Math.floor(Math.max(s.a[0], s.b[0]) / c); i++) for (let j = Math.floor(Math.min(s.a[1], s.b[1]) / c); j <= Math.floor(Math.max(s.a[1], s.b[1]) / c); j++) { const k = i + ',' + j; (this.m.get(k) || this.m.set(k, []).get(k)).push(s); } }
  near(x0, z0, x1, z1) { const c = this.c, out = new Set(); for (let i = Math.floor(Math.min(x0, x1) / c); i <= Math.floor(Math.max(x0, x1) / c); i++) for (let j = Math.floor(Math.min(z0, z1) / c); j <= Math.floor(Math.max(z0, z1) / c); j++) for (const s of this.m.get(i + ',' + j) || []) out.add(s); return out; }
}
const blockSegs = new SegGrid();
blocks.forEach((p, bi) => p.forEach((a, i) => blockSegs.add({ a, b: p[(i + 1) % p.length], bi })));
/** distância até a borda de quadra mais próxima ao longo do raio (Infinity se não há até max) */
function ray(x, z, dx, dz, max = 45) {
  let best = Infinity;
  for (const { a, b } of blockSegs.near(x, z, x + dx * max, z + dz * max)) {
    const ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - x) * ez - (a[1] - z) * ex) / den, u = ((a[0] - x) * dz - (a[1] - z) * dx) / den;
    if (u >= 0 && u <= 1 && t > 0.05 && t < max && t < best) best = t;
  }
  return best;
}
const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const inAnyBlock = (x, z) => { for (const s of blockSegs.near(x, z, x, z)) if (inPoly(x, z, blocks[s.bi])) return true; return false; };

/* ---------- seção transversal de cada via (as mesmas regras de city.js) ---------- */
const segDist = (px, pz, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2)); return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t); };
const hasTwin = r => { const m = r.p[r.p.length >> 1]; for (const q of roads) { if (q === r || !q.ow || !q.med || q.n !== r.n) continue; for (let i = 0; i < q.p.length - 1; i++) if (segDist(m[0], m[1], q.p[i], q.p[i + 1]) < r.w * 1.2) return q; } return null; };
const medSign = r => {   // lado do canteiro em relação ao sentido do traçado (−1 = lado −n)
  let acc = 0;
  for (let i = 0; i < r.p.length - 1; i++) { const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L; let best = Infinity, side = 0;
    for (const q of roads) { if (q === r || !q.ow || !q.med || q.n !== r.n) continue; for (let j = 0; j < q.p.length - 1; j++) { const c = q.p[j], d = q.p[j + 1], dx = d[0] - c[0], dz = d[1] - c[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((mx - c[0]) * dx + (mz - c[1]) * dz) / l2)); const px = c[0] + dx * t - mx, pz = c[1] + dz * t - mz, dd = Math.hypot(px, pz); if (dd < best) { best = dd; side = Math.sign(px * nx + pz * nz); } } }
    if (best < r.w * 3) acc += side * L; }
  return acc > 0 ? 1 : -1;
};
const spec = new Map();
for (const r of roads) {
  if (!VEH(r) || !r.p.some(([x, z]) => inBox(x, z, FADE + 40))) continue;
  const unpaved = r.pav === 'terra' || (!r.pav && ['unpaved', 'gravel', 'dirt', 'ground', 'compacted'].includes(r.sf));
  const urban = URBAN.has(r.k) && !unpaved, twin = r.ow && r.med ? hasTwin(r) : null, dual = !!twin;
  const side = r.sw ? (r.sw[0] + r.sw[1]) / 2 : (urban ? 2.2 : 0);
  const half = (dual ? Math.max(3.5, (r.w - r.med) / 2) : r.w) / 2;
  spec.set(r, { dual, twin, half, side, MS: dual ? medSign(r) : -1, expROW: dual ? r.w + 2 * side : r.w + 2 * side });
}

/* ---------- rótulas: anel de vias de mão única que volta ao início (fica onde o OSM desenhou, como as pontes) ---------- */
const ring = new Set(), loops = [];
{ const starts = new Map(); for (const r of roads) if (r.ow && VEH(r)) (starts.get(key(r.p[0])) || starts.set(key(r.p[0]), []).get(key(r.p[0]))).push(r);
  for (const r0 of roads) { if (!r0.ow || !VEH(r0) || !r0.p.some(([x, z]) => inBox(x, z, FADE))) continue;
    const c = r0.p[0]; const walk = (r, path) => { if (path.length > 8) return null; const nx = starts.get(key(r.p.at(-1))) || [];
      for (const q of nx) { if (q === r0) return path; if (path.includes(q) || q.p.some(v => Math.hypot(v[0] - c[0], v[1] - c[1]) > 70)) continue; const w = walk(q, [...path, q]); if (w) return w; } return null; };
    const loop = walk(r0, [r0]); if (loop && loop.length >= 2) { const pts = loop.flatMap(q => q.p), cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cz = pts.reduce((a, q) => a + q[1], 0) / pts.length;
      if (pts.every(q => Math.hypot(q[0] - cx, q[1] - cz) < 35) && !loop.some(q => ring.has(q))) { loop.forEach(q => ring.add(q)); loops.push(loop); } } } }
// acessos, retornos, vias de serviço e rótulas: não têm "vão entre quadras" próprio; seguem os nós das vias principais
const noCenter = r => ring.has(r) || r.k.endsWith('_link') || r.k === 'service';

/* ---------- 1. eixo centrado ---------- */
function resampleArc(p, step) {
  const out = [], cum = [0]; for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const L = cum.at(-1), n = Math.max(2, Math.ceil(L / step) + 1);
  for (let k = 0; k < n; k++) { const s = L * k / (n - 1); let i = 0; while (i < p.length - 2 && cum[i + 1] < s) i++; const f = (s - cum[i]) / Math.max(1e-9, cum[i + 1] - cum[i]);
    const a = p[i], b = p[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; out.push({ s, x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, tx: (b[0] - a[0]) / l, tz: (b[1] - a[1]) / l }); }
  // tangente suavizada (média dos vizinhos) e normal n = (−tz, tx) — a mesma convenção do jogo
  for (let k = 0; k < out.length; k++) { const a = out[Math.max(0, k - 1)], b = out[Math.min(out.length - 1, k + 1)]; let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; out[k].nx = -tz; out[k].nz = tx; out[k].tx = tx; out[k].tz = tz; }
  return { S: out, cum };
}
const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const stats = { amostras: 0, validas: 0, rejeitadas: 0, nos: 0 };
const fields = new Map();   // via → {S, cum, d[] (deslocamento escalar ao longo de n), ok[]}
for (const [r, sp] of spec) {
  const { S, cum } = resampleArc(r.p, 2);
  const d = new Array(S.length).fill(0), ok = new Array(S.length).fill(false), row = new Array(S.length).fill(0);
  for (let k = 0; k < S.length; k++) {
    const q = S[k]; if (fadeAt(q.x, q.z) <= 0) { ok[k] = true; continue; }
    if (noCenter(r)) continue;
    stats.amostras++;
    let off;
    if (sp.dual) {
      // pista de avenida dupla: ancorada na quadra do SEU lado (calçada + meia pista da lei); o canteiro é o que sobra
      const ux = -sp.MS * q.nx, uz = -sp.MS * q.nz, o = ray(q.x, q.z, ux, uz, 30); if (o === Infinity) continue;
      const ot = sp.side + sp.half; if (o < ot - 6 || o > ot + 9) continue;
      off = -sp.MS * (o - ot); row[k] = o;
    } else {
      const l = ray(q.x, q.z, q.nx, q.nz), rr = ray(q.x, q.z, -q.nx, -q.nz); if (l === Infinity || rr === Infinity) continue;
      const ROW = l + rr; if (ROW < sp.expROW * 0.55 || ROW > Math.max(sp.expROW * 1.7, sp.expROW + 8) || ROW > 50) continue;
      off = (l - rr) / 2; row[k] = ROW;   // centro do vão em relação ao ponto, ao longo de n
    }
    if (Math.abs(off) > 7) continue;
    d[k] = off; ok[k] = true;
  }
  // filtro robusto: mediana local (±8 m) e descarte do que destoa (cruzamentos, recuos, entradas de garagem)
  const keep = ok.slice();
  for (let k = 0; k < S.length; k++) { if (!ok[k] || fadeAt(S[k].x, S[k].z) <= 0) continue; const win = []; for (let j = Math.max(0, k - 4); j <= Math.min(S.length - 1, k + 4); j++) if (ok[j]) win.push(d[j]);
    if (win.length < 3 || Math.abs(d[k] - med(win)) > 1.0) { keep[k] = false; stats.rejeitadas++; } else stats.validas++; }
  fields.set(r, { S, cum, d, ok: keep, row });
}
// nós: vértices compartilhados por 2+ vias (qualquer tipo); deslocamento por mínimos quadrados das normais dos braços
const occ = new Map();
roads.forEach((r, ri) => r.p.forEach((q, j) => { const k = key(q); (occ.get(k) || occ.set(k, []).get(k)).push([ri, j]); }));
const bridgeKeys = new Set(); for (const r of roads) if (r.br) for (const q of r.p) bridgeKeys.add(key(q));
const nodeD = new Map();
for (const [k, list] of occ) {
  if (list.length < 2) continue;
  const [x, z] = k.split(',').map(Number); if (fadeAt(x, z) <= 0) continue;
  if (bridgeKeys.has(k) || list.some(([ri]) => ring.has(roads[ri]))) { nodeD.set(k, [0, 0]); continue; }   // ponte e rótula não se movem
  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0, n = 0;
  for (const [ri, j] of list) {
    const r = roads[ri], F = fields.get(r); if (!F) continue;
    const s0 = F.cum[j];
    for (const dir of [1, -1]) {   // braço para frente e para trás: primeira amostra válida entre 8 e 30 m
      let best = null;
      for (let k2 = 0; k2 < F.S.length; k2++) { const ds = (F.S[k2].s - s0) * dir; if (ds < 8 || ds > 30 || !F.ok[k2]) continue; if (!best || ds < best.ds) best = { ds, k2 }; }
      if (!best) continue;
      const q = F.S[best.k2], w = 1 / (1 + best.ds / 10);
      a11 += w * q.nx * q.nx; a12 += w * q.nx * q.nz; a22 += w * q.nz * q.nz; b1 += w * q.nx * F.d[best.k2]; b2 += w * q.nz * F.d[best.k2]; n++;
    }
  }
  if (!n) continue;
  const lam = 0.05 * (a11 + a22) + 1e-6; a11 += lam; a22 += lam;
  const det = a11 * a22 - a12 * a12, f = fadeAt(x, z);
  let Dx = (a22 * b1 - a12 * b2) / det, Dz = (a11 * b2 - a12 * b1) / det; const m = Math.hypot(Dx, Dz); if (m > 7) { Dx *= 7 / m; Dz *= 7 / m; }
  nodeD.set(k, [f * Dx, f * Dz]); stats.nos++;
}
for (const r of ring) for (const q of r.p) nodeD.set(key(q), [0, 0]);
console.log('rótulas: vias no anel', ring.size);
// campo de deslocamento (vetor) ao longo de cada via, preso nos nós
const moved = new Map();    // chave do vértice original → nova posição
const newP = new Map();     // via → nova polilinha
for (const [r, F] of fields) {
  const { S, cum } = F, n = S.length;
  const V = S.map((q, k) => F.ok[k] ? [F.d[k] * q.nx * fadeAt(q.x, q.z), F.d[k] * q.nz * fadeAt(q.x, q.z)] : null);
  // nós desta via (arco e vetor)
  const pins = []; r.p.forEach((q, j) => { const D = nodeD.get(key(q)); if (D) pins.push([cum[j], D]); });
  // perto de um nó, o vetor tende ao do nó (o cruzamento é decidido pelo nó, não pelo raio que escapa pela transversal)
  for (let k = 0; k < n; k++) { let best = null; for (const [s, D] of pins) { const dd = Math.abs(S[k].s - s); if (!best || dd < best[0]) best = [dd, D]; }
    if (best) { const t = smoothstep(4, 16, best[0]); V[k] = V[k] ? [best[1][0] + (V[k][0] - best[1][0]) * t, best[1][1] + (V[k][1] - best[1][1]) * t] : (best[0] < 4 ? best[1].slice() : null); } }
  // preenche lacunas por interpolação linear no arco
  const known = []; for (let k = 0; k < n; k++) if (V[k]) known.push(k);
  if (!known.length) continue;
  for (let k = 0; k < n; k++) if (!V[k]) { let a = -1, b = -1; for (const kk of known) { if (kk < k) a = kk; else { b = kk; break; } }
    V[k] = a < 0 ? V[b].slice() : b < 0 ? V[a].slice() : (() => { const t = (S[k].s - S[a].s) / (S[b].s - S[a].s); return [V[a][0] + (V[b][0] - V[a][0]) * t, V[a][1] + (V[b][1] - V[a][1]) * t]; })(); }
  // suaviza (±6 m), mantendo os nós
  const Vs = V.map((v, k) => { let sx = 0, sz = 0, c = 0; for (let j = Math.max(0, k - 3); j <= Math.min(n - 1, k + 3); j++) { sx += V[j][0]; sz += V[j][1]; c++; } return [sx / c, sz / c]; });
  const at = s => { let k = 0; while (k < n - 2 && S[k + 1].s < s) k++; const t = Math.max(0, Math.min(1, (s - S[k].s) / Math.max(1e-9, S[k + 1].s - S[k].s))); return [Vs[k][0] + (Vs[k + 1][0] - Vs[k][0]) * t, Vs[k][1] + (Vs[k + 1][1] - Vs[k][1]) * t]; };
  // vértices originais deslocados + vértices extras onde a correção deixa de ser linear (> 15 cm)
  const out = [];
  for (let j = 0; j < r.p.length; j++) {
    const q = r.p[j], D = nodeD.get(key(q)) || at(cum[j]), np = [r2(q[0] + D[0]), r2(q[1] + D[1])];
    if (j > 0) {   // pontos intermediários (Douglas–Peucker simples entre vértices originais)
      const a = out.at(-1), mids = S.filter(s => s.s > cum[j - 1] + 0.5 && s.s < cum[j] - 0.5).map(s => { const v = at(s.s); return [r2(s.x + v[0]), r2(s.z + v[1])]; });
      const dp = (pts, i0, i1, acc) => { let bi = -1, bd = 0.15; const A = pts[i0], B = pts[i1]; for (let i = i0 + 1; i < i1; i++) { const dd = segDist(pts[i][0], pts[i][1], A, B); if (dd > bd) { bd = dd; bi = i; } } if (bi < 0) return; dp(pts, i0, bi, acc); acc.push(pts[bi]); dp(pts, bi, i1, acc); };
      const all = [a, ...mids, np], acc = []; dp(all, 0, all.length - 1, acc); out.push(...acc);
    }
    out.push(np); moved.set(key(q), np);
  }
  newP.set(r, out);
}
// todas as vias que tocam um vértice movido (calçadões, trilhas, acessos) acompanham
const corr = [];
roads.forEach((r, ri) => {
  let p = newP.get(r);
  if (!p) { if (!r.p.some(q => moved.has(key(q)))) return; p = r.p.map(q => moved.get(key(q)) || q); }
  corr.push([ri, p]);
});
const P = r => newP.get(r) || r.p;

/* ---------- 2. meio-fio das quadras ---------- */
const vehSegs = new SegGrid(20);
for (const [r, sp] of spec) { const p = P(r); for (let i = 0; i < p.length - 1; i++) vehSegs.add({ a: p[i], b: p[i + 1], r, sp }); }
const curbPolys = [], cornerSet = new Set();
for (const p of blocks) {
  if (!p.some(([x, z]) => inBox(x, z, 40))) continue;
  const n = p.length, E = p.map((a, i) => { const b = p[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); return { a, b, L, dx: (b[0] - a[0]) / L, dz: (b[1] - a[1]) / L, nx: (b[1] - a[1]) / L, nz: -(b[0] - a[0]) / L }; });
  // largura da calçada por aresta: via paralela do lado de fora; calçada = a da lei (Passeio), sem chegar a menos de
  // 2,6 m do eixo (uma faixa); sem via de frente → sem calçada (fundo de lote, praça interna, margem de arroio)
  for (const e of E) {
    const ws = [];
    for (let s = 1; s < e.L - 1 || ws.length === 0; s += 2) {
      const t = Math.min(s, e.L / 2), x = e.a[0] + e.dx * t, z = e.a[1] + e.dz * t; let best = null;
      for (const g of vehSegs.near(x - 30, z - 30, x + 30, z + 30)) {
        const sx = g.b[0] - g.a[0], sz = g.b[1] - g.a[1], L = Math.hypot(sx, sz) || 1; if (Math.abs((sx * e.dx + sz * e.dz) / L) < 0.75) continue;
        const u = ((x - g.a[0]) * sx + (z - g.a[1]) * sz) / (L * L); if (u < -0.05 || u > 1.05) continue;
        const px = g.a[0] + sx * u, pz = g.a[1] + sz * u, out = (px - x) * e.nx + (pz - z) * e.nz; if (out <= 0) continue;
        const dist = Math.hypot(px - x, pz - z); if (dist > g.sp.half + g.sp.side + 8) continue;
        if (!best || dist < best.dist) best = { dist, g };
      }
      if (best) { const { half, side } = best.g.sp; ws.push(Math.max(0.6, Math.min(side || 2.2, best.dist - half - 0.0, best.dist - 2.6))); } else ws.push(0);
      if (e.L <= 2) break;
    }
    const pos = ws.filter(w => w > 0); e.w = pos.length >= ws.length * 0.5 ? med(pos) : 0;
  }
  // contorno do meio-fio
  const out = [];
  for (let i = 0; i < n; i++) {
    const e0 = E[(i - 1 + n) % n], e1 = E[i], P0 = p[i], w0 = e0.w, w1 = e1.w;
    const cross = e0.dx * e1.dz - e0.dz * e1.dx;
    if (w0 > 0 && w1 > 0 && cross > 0.05) {   // quina convexa: arco tangente às duas linhas do meio-fio
      let Rc = Math.max(4.0, w0, w1), C, T1, T2;
      for (let it = 0; it < 8; it++) {
        const c0 = w0 - Rc, c1 = w1 - Rc, det = e0.nx * e1.nz - e0.nz * e1.nx;
        C = [P0[0] + (c0 * e1.nz - c1 * e0.nz) / det, P0[1] + (e0.nx * c1 - e1.nx * c0) / det];
        T1 = [C[0] + e0.nx * Rc, C[1] + e0.nz * Rc]; T2 = [C[0] + e1.nx * Rc, C[1] + e1.nz * Rc];
        const d0 = -((T1[0] - P0[0]) * e0.dx + (T1[1] - P0[1]) * e0.dz), d1 = (T2[0] - P0[0]) * e1.dx + (T2[1] - P0[1]) * e1.dz;
        if (d0 <= e0.L * 0.45 && d1 <= e1.L * 0.45) break; Rc *= 0.75;
      }
      let a0 = Math.atan2(e0.nz, e0.nx), a1 = Math.atan2(e1.nz, e1.nx); while (a1 < a0) a1 += Math.PI * 2;
      const st = Math.max(2, Math.ceil((a1 - a0) / (12 * Math.PI / 180)));
      for (let s = 0; s <= st; s++) { const an = a0 + (a1 - a0) * s / st, q = [C[0] + Math.cos(an) * Rc, C[1] + Math.sin(an) * Rc]; out.push(q); if (s > 0) cornerSet.add(out.length - 1 + ':' + curbPolys.length); }
    } else {
      // quina côncava ou lado sem calçada: encontro das duas linhas (limitado)
      const A = [P0[0] + e0.nx * w0, P0[1] + e0.nz * w0], B = [P0[0] + e1.nx * w1, P0[1] + e1.nz * w1], den = e0.dx * e1.dz - e0.dz * e1.dx;
      if (Math.abs(den) < 0.05) { out.push(A); if (Math.hypot(A[0] - B[0], A[1] - B[1]) > 0.01) out.push(B); continue; }
      const t = ((B[0] - A[0]) * e1.dz - (B[1] - A[1]) * e1.dx) / den, M = [A[0] + e0.dx * t, A[1] + e0.dz * t];
      if (Math.hypot(M[0] - P0[0], M[1] - P0[1]) > 3 * Math.max(w0, w1, 0.5)) { out.push(A, B); } else out.push(M);
    }
  }
  curbPolys.push(out.map(q => [r2(q[0]), r2(q[1])]));
}

/* ---------- 3. canteiros centrais ---------- */
const medPolys = [];
// a avenida vem em vários trechos no OSM: "pista oposta" = qualquer trecho de mesmo nome em sentido contrário
const crossesOther = (x, z, r) => { for (const g of vehSegs.near(x - 15, z - 15, x + 15, z + 15)) { if (g.r === r || (g.r.n && g.r.n === r.n && g.sp.dual)) continue; if (segDist(x, z, g.a, g.b) < g.sp.half + 1.2) return true; } return false; };
for (const [r, sp] of spec) {
  if (!sp.dual) continue;
  const { S } = resampleArc(P(r), 1.5);
  const rows = S.map(q => {
    if (!inBox(q.x, q.z, 5)) return null;
    const dx = sp.MS * q.nx, dz = sp.MS * q.nz; let t = Infinity, th = 0;
    for (const sg of vehSegs.near(q.x - 40, q.z - 40, q.x + 40, q.z + 40)) {
      if (sg.r === r || sg.r.n !== r.n || !sg.sp.dual) continue;
      const a = sg.a, b = sg.b, ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez) || 1; if ((ex * q.tx + ez * q.tz) / L > -0.3) continue;   // mesmo sentido = mesma pista
      const den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const tt = ((a[0] - q.x) * ez - (a[1] - q.z) * ex) / den, u = ((a[0] - q.x) * dz - (a[1] - q.z) * dx) / den; if (u >= 0 && u <= 1 && tt > 0 && tt < t) { t = tt; th = sg.sp.half; } }
    const g = t - sp.half - th; if (t > 40 || g < 0.6) return null;
    const ix = q.x + dx * sp.half, iz = q.z + dz * sp.half, mx = q.x + dx * (sp.half + g / 2), mz = q.z + dz * (sp.half + g / 2);
    if (crossesOther(mx, mz, r) || crossesOther(ix, iz, r)) return null;   // cruzamento ou retorno: canteiro aberto
    return { i: [ix, iz], m: [mx, mz], g, tx: q.tx, tz: q.tz, dx, dz };
  });
  // trechos contínuos → polígono (borda da pista + linha do meio), com nariz em quarto de círculo nas pontas
  let run = [];
  const flush = () => {
    // largura suavizada (mediana de 5 + média de 3): sem serrilhado onde o raio até a pista oposta oscila
    if (run.length >= 3) {
      const g0 = run.map(q => q.g), gm = g0.map((_, k) => med(g0.slice(Math.max(0, k - 2), k + 3))), gs = gm.map((_, k) => (gm[Math.max(0, k - 1)] + gm[k] + gm[Math.min(gm.length - 1, k + 1)]) / 3);
      run = run.map((q, k) => { const sh = (gs[k] - q.g) / 2; return { ...q, g: gs[k], m: [q.m[0] + q.dx * sh, q.m[1] + q.dz * sh] }; });
      // descarta pontas finas (< 0,8 m) que sobram nos extremos
      while (run.length > 3 && run[0].g < 0.8) run.shift(); while (run.length > 3 && run.at(-1).g < 0.8) run.pop();
    }
    if (run.length >= 3) {
      const cap = (end, dir) => {   // quarto de círculo: do meio do canteiro até a borda da pista
        const R = Math.min(end.g / 2, 2.5), o = [end.m[0] - end.tx * dir * R, end.m[1] - end.tz * dir * R], pts = [];
        for (let s = 0; s <= 6; s++) { const an = (Math.PI / 2) * s / 6; const ux = end.tx * dir * Math.cos(an) - end.dx * Math.sin(an), uz = end.tz * dir * Math.cos(an) - end.dz * Math.sin(an); pts.push([o[0] + ux * R, o[1] + uz * R]); }
        return pts;   // começa na linha do meio, avançado; termina recuado R para a pista
      };
      const A = run.map(q => q.i), M = run.map(q => q.m);
      const c0 = cap(run[0], -1), c1 = cap(run.at(-1), 1);
      const gAvg = run.reduce((a, q) => a + q.g, 0) / run.length;   // canteiro largo (> 2,6 m no total): grama com árvores, como na foto
      medPolys.push({ p: [...M.slice(1, -1), ...c1, ...A.slice(1, -1).reverse(), ...c0.reverse()].map(q => [r2(q[0]), r2(q[1])]), grass: gAvg > 2.6 });
    }
    run = [];
  };
  for (const q of rows) { if (q) run.push(q); else flush(); } flush();
}

// ilha central das rótulas: anel recuado da meia pista para dentro (gramada)
for (const loop of loops) {
  const pts = []; for (const q of loop) for (const v of P(q).slice(pts.length ? 1 : 0)) pts.push(v);
  const cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cz = pts.reduce((a, q) => a + q[1], 0) / pts.length, half = spec.get(loop[0])?.half || 3.5;
  let isl = pts.map(([x, z]) => { const d = Math.hypot(x - cx, z - cz) || 1, k = Math.max(0.2, (d - half) / d); return [r2(cx + (x - cx) * k), r2(cz + (z - cz) * k)]; });
  if (signedArea(isl) < 0) isl.reverse();
  medPolys.push({ p: isl, grass: true, ring: true });
}

/* ---------- 4. classificação do chão (lote > canteiro > calçada > asfalto) ---------- */
// faixa de asfalto de cada via: do eixo até o meio-fio/quadra/canteiro (raio a cada 2 m, até meia pista + 6 m); sem
// nada do lado (parque, área verde) a pista acaba na meia largura + 0,5 m — o resto do espaço público fica terreno
const edgeSegs = new SegGrid(20);
for (const p of [...curbPolys, ...blocks, ...medPolys.map(m => m.p)]) p.forEach((a, i) => edgeSegs.add({ a, b: p[(i + 1) % p.length] }));
const rayE = (x, z, dx, dz, max) => { let best = Infinity; for (const { a, b } of edgeSegs.near(x, z, x + dx * max, z + dz * max)) { const ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue; const t = ((a[0] - x) * ez - (a[1] - z) * ex) / den, u = ((a[0] - x) * dz - (a[1] - z) * dx) / den; if (u >= 0 && u <= 1 && t > 0.05 && t < max && t < best) best = t; } return best; };
const bands = [], nodeExt = new Map();
for (const [r, sp] of spec) {
  const { S } = resampleArc(P(r), 2); if (!S.some(q => inBox(q.x, q.z, 10))) continue;
  const E = S.map(q => [1, -1].map(sg => { const m = sp.half + 6, t = rayE(q.x, q.z, q.nx * sg, q.nz * sg, m); return t < m ? t + 0.05 : sp.half + 0.5; }));
  // um polígono por trecho contínuo (borda esquerda + borda direita invertida), largura suavizada para não serrilhar
  const Es = E.map((e, k) => [0, 1].map(j => { const w = []; for (let i = Math.max(0, k - 1); i <= Math.min(E.length - 1, k + 1); i++) w.push(E[i][j]); return Math.min(...w); }));
  let run = [];
  const flushB = () => { if (run.length >= 2) bands.push([...run.map(k => [S[k].x + S[k].nx * Es[k][0], S[k].z + S[k].nz * Es[k][0]]), ...run.slice().reverse().map(k => [S[k].x - S[k].nx * Es[k][1], S[k].z - S[k].nz * Es[k][1]])].map(q => [r2(q[0]), r2(q[1])])); run = []; };
  for (let k = 0; k < S.length; k++) { if (inBox(S[k].x, S[k].z, 10)) run.push(k); else flushB(); } flushB();
  for (const q of [P(r)[0], P(r).at(-1)]) { const k2 = key(q), e = Math.max(...E[0], ...E.at(-1)); nodeExt.set(k2, Math.max(nodeExt.get(k2) || 0, e)); }
  for (const q of P(r).slice(1, -1)) { const k2 = key(q); if (nodeExt.has(k2) || (occ.get(key(r.p[P(r).indexOf(q)] || q)) || []).length > 1) nodeExt.set(k2, Math.max(nodeExt.get(k2) || 0, sp.half + 2)); }
}
// cruzamentos: disco de asfalto (cobre o canto entre as faixas; o meio-fio arredondado e o lote têm prioridade)
const vehNodes = new Map(); for (const [r] of spec) for (const q of P(r)) vehNodes.set(key(q), (vehNodes.get(key(q)) || 0) + 1);
for (const [k2, cnt] of vehNodes) { if (cnt < 2) continue; const [x, z] = k2.split(',').map(Number); if (!inBox(x, z, 8)) continue; const R = (nodeExt.get(k2) || 6) + 4.5, pts = [];
  for (let i = 0; i < 24; i++) { const an = -i / 24 * Math.PI * 2; pts.push([r2(x + Math.cos(an) * R), r2(z + Math.sin(an) * R)]); } bands.push(pts.reverse()); }
// vias de pedestre largas (calçadão, Rua Coberta): piso de calçada
const pedBands = [];
for (const r of roads) { if (r.br || !(r.k === 'pedestrian' || (r.k === 'footway' && r.w >= 3)) || !r.p.some(([x, z]) => inBox(x, z, 5))) continue;
  const { S } = resampleArc(P(r), 2), h = Math.max(1.5, (r.w || 4) / 2);
  for (let k = 0; k < S.length - 1; k++) { const a = S[k], b = S[k + 1]; pedBands.push([[a.x + a.nx * h, a.z + a.nz * h], [b.x + b.nx * h, b.z + b.nz * h], [b.x - b.nx * h, b.z - b.nz * h], [a.x - a.nx * h, a.z - a.nz * h]].map(q => [r2(q[0]), r2(q[1])])); } }
// espaços de pedestre da Prefeitura (camada Praças e Espaços de Lazer): o que fica sobre o espaço público, e não sobre uma
// quadra, é calçadão (ex.: Rua Coberta, sobre a Rua Ary Delmar Koppe) — não depende do OSM
const espacos = [];
for (const f of JSON.parse(fs.readFileSync('data/raw/geoigrejinha/pracas_lazer.geojson')).features) for (const pg of f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) {
  let p = pg[0].map(c => toXZ(c[1], c[0])); if (!p.some(([x, z]) => inBox(x, z))) continue; if (signedArea(p) < 0) p.reverse();
  const xs = p.map(q => q[0]), zs = p.map(q => q[1]); let n = 0, fora = 0;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 1) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 1) if (inPoly(x, z, p)) { n++; if (!inAnyBlock(x, z)) fora++; }
  if (n && fora / n > 0.8) { pedBands.push(p.map(q => [r2(q[0]), r2(q[1])])); espacos.push([f.properties.Nome_1, Math.round(100 * fora / n) + '%']); }
}
console.log('faixas de asfalto', bands.length, '| calçadão', pedBands.length, '| espaços de pedestre da Prefeitura:', espacos.map(e => e.join(' ')).join(', ') || '—');
const sets = [...blocks.map(p => ({ p, c: 3 })), ...medPolys.map(m => ({ p: m.p, c: 2, grass: m.grass })), ...curbPolys.map(p => ({ p, c: 1 })),
  ...pedBands.map(p => ({ p, c: 0.75 })), ...bands.map(p => ({ p, c: 0.5 }))];
// 0 lote/terreno, 1 asfalto, 2 calçada (e calçadão), 3 canteiro de concreto, 4 canteiro gramado
const code = P2 => !P2 ? 0 : P2.c === 3 ? 0 : P2.c === 2 ? (P2.grass ? 4 : 3) : P2.c === 0.5 ? 1 : 2;
const polyGrid = new SegGrid(T * 4); const edges = [];
sets.forEach((P2, pi) => { P2.pi = pi; let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const [x, z] of P2.p) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); } P2.bb = [x0, z0, x1, z1];
  P2.p.forEach((a, i) => { const b = P2.p[(i + 1) % P2.p.length]; if (Math.abs(b[1] - a[1]) < 1e-9 && Math.abs(b[0] - a[0]) < 1e-9) return; const e = { a, b, pi }; edges.push(e); polyGrid.add(e); }); });
const bbGrid = new Map(); sets.forEach(P2 => { for (let i = Math.floor(P2.bb[0] / 20); i <= Math.floor(P2.bb[2] / 20); i++) for (let j = Math.floor(P2.bb[1] / 20); j <= Math.floor(P2.bb[3] / 20); j++) { const k = i + ',' + j; (bbGrid.get(k) || bbGrid.set(k, []).get(k)).push(P2); } });
const classify = (x, z) => { let w = null; for (const P2 of bbGrid.get(Math.floor(x / 20) + ',' + Math.floor(z / 20)) || []) { if ((w && P2.c <= w.c) || x < P2.bb[0] || x > P2.bb[2] || z < P2.bb[1] || z > P2.bb[3]) continue; if (inPoly(x, z, P2.p)) w = P2; } return code(w); };
const quads = { 1: [], 2: [], 3: [], 4: [] };
const segX = (e, z) => e.a[0] + (e.b[0] - e.a[0]) * (z - e.a[1]) / (e.b[1] - e.a[1]);
for (let tx = Math.floor(BOX.x0 / T) * T; tx < BOX.x1; tx += T) for (let tz = Math.floor(BOX.z0 / T) * T; tz < BOX.z1; tz += T) {
  const x0 = tx, x1 = tx + T, z0 = tz, z1 = tz + T; if (!inBox(tx + T / 2, tz + T / 2)) continue;
  const es = [...polyGrid.near(x0, z0, x1, z1)].filter(e => Math.max(e.a[0], e.b[0]) >= x0 && Math.min(e.a[0], e.b[0]) <= x1 && Math.max(e.a[1], e.b[1]) >= z0 && Math.min(e.a[1], e.b[1]) <= z1);
  const zs = new Set([z0, z1]);
  for (const e of es) { for (const q of [e.a, e.b]) if (q[1] > z0 && q[1] < z1) zs.add(q[1]);
    for (const X of [x0, x1]) { if ((e.a[0] - X) * (e.b[0] - X) < 0) { const zz = e.a[1] + (e.b[1] - e.a[1]) * (X - e.a[0]) / (e.b[0] - e.a[0]); if (zz > z0 && zz < z1) zs.add(zz); } } }
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {   // cruzamentos de arestas
    const A = es[i], B = es[j], d1x = A.b[0] - A.a[0], d1z = A.b[1] - A.a[1], d2x = B.b[0] - B.a[0], d2z = B.b[1] - B.a[1], den = d1x * d2z - d1z * d2x; if (Math.abs(den) < 1e-12) continue;
    const t = ((B.a[0] - A.a[0]) * d2z - (B.a[1] - A.a[1]) * d2x) / den, u = ((B.a[0] - A.a[0]) * d1z - (B.a[1] - A.a[1]) * d1x) / den;
    if (t > 0 && t < 1 && u > 0 && u < 1) { const zz = A.a[1] + d1z * t; if (zz > z0 && zz < z1) zs.add(zz); } }
  const Z = [...zs].sort((a, b) => a - b);
  for (let s = 0; s < Z.length - 1; s++) {
    const za = Z[s], zb = Z[s + 1]; if (zb - za < 1e-4) continue; const zm = (za + zb) / 2;
    const act = es.filter(e => Math.min(e.a[1], e.b[1]) < zm && Math.max(e.a[1], e.b[1]) > zm).map(e => ({ e, xa: segX(e, za), xb: segX(e, zb), xm: segX(e, zm) })).filter(o => o.xm > x0 && o.xm < x1).sort((a, b) => a.xm - b.xm);
    // estado inicial na borda esquerda do ladrilho (teste de ponto), depois alterna a paridade de cada polígono
    const inside = new Map(); const cls = () => { let w = null; for (const [pi, v] of inside) if (v && (!w || sets[pi].c > w.c)) w = sets[pi]; return code(w); };
    for (const P2 of bbGrid.get(Math.floor((x0 + 0.001) / 20) + ',' + Math.floor(zm / 20)) || []) if (!(x0 + 1e-4 < P2.bb[0] || x0 > P2.bb[2] || zm < P2.bb[1] || zm > P2.bb[3])) { if (inPoly(x0 + 1e-4, zm, P2.p)) inside.set(P2.pi, true); }
    // polígonos que começam dentro do ladrilho, à direita de x0, entram pelo cruzamento da aresta (paridade)
    let L = { a: x0, b: x0 }, c = cls();
    const emit = (R) => { if (c > 0 && (R.a - L.a > 1e-4 || R.b - L.b > 1e-4)) quads[c].push(r2(L.a), r2(za), r2(R.a), r2(za), r2(R.b), r2(zb), r2(L.b), r2(zb)); };
    for (const o of act) { inside.set(o.e.pi, !inside.get(o.e.pi)); const c2 = cls(); if (c2 !== c) { const R = { a: o.xa, b: o.xb }; emit(R); L = R; c = c2; } }
    emit({ a: x1, b: x1 });
  }
}

/* ---------- 5. meio-fio onde calçada/canteiro encontram o asfalto ---------- */
const curbs = [];   // [ax, az, bx, bz, tipo] tipo: 0 reto (concreto), 1 esquina/canteiro (amarelo)
sets.forEach((P2, pi) => {
  if (P2.c === 3 || P2.c === 0.5) return;   // borda de lote e da faixa de asfalto: sem meio-fio próprio
  const p = P2.p, n = p.length;
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.02) continue;
    const k = Math.max(1, Math.ceil(L / 1.5)), nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;   // para fora (polígono anti-horário)
    const ccw = signedArea(p) > 0 ? 1 : -1;
    for (let s = 0; s < k; s++) {
      const A = [a[0] + (b[0] - a[0]) * s / k, a[1] + (b[1] - a[1]) * s / k], B = [a[0] + (b[0] - a[0]) * (s + 1) / k, a[1] + (b[1] - a[1]) * (s + 1) / k], m = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      if (!inBox(m[0], m[1])) continue;
      const out = classify(m[0] + nx * ccw * 0.06, m[1] + nz * ccw * 0.06), inn = classify(m[0] - nx * ccw * 0.06, m[1] - nz * ccw * 0.06);
      if (out === 1 && inn >= 2) curbs.push(r2(A[0]), r2(A[1]), r2(B[0]), r2(B[1]), P2.c === 2 || cornerSet.has(((i + 1) % n) + ':' + (pi - blocks.length - medPolys.length)) ? 1 : 0);
    }
  }
});

/* ---------- 5b. prédios que avançam sobre a calçada/rua: vértice de volta à borda do lote ---------- */
// (cadastro de edificações e de quadras vêm de levantamentos diferentes; até 4 m de diferença é erro de desenho,
//  não construção na rua). Saída: polígonos corrigidos por índice do prédio; o original não muda.
const bfix = [], bstat = { naCaixa: 0, avancam: 0, corrigidos: 0, grandes: 0 };
const nearestBlockPt = (x, z) => { let best = null; for (const s2 of blockSegs.near(x - 5, z - 5, x + 5, z + 5)) { const { a, b } = s2, dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)), px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(px - x, pz - z); if (!best || d < best.d) best = { d, px, pz, nx: -(dz) / Math.sqrt(l2), nz: dx / Math.sqrt(l2) }; } return best; };
W.buildings.forEach((b, bi) => {
  if (!b.p.some(([x, z]) => inBox(x, z, -2))) return; bstat.naCaixa++;
  const out = b.p.map(([x, z]) => { if (classify(x, z) === 0) return null; const q = nearestBlockPt(x, z); return q ? q : { d: 99 }; });
  if (!out.some(Boolean)) return; bstat.avancam++;
  const dmax = Math.max(...out.filter(Boolean).map(q => q.d)); if (dmax > 4) { bstat.grandes++; return; }
  // empurra para dentro (anti-horário: a normal esquerda da aresta da quadra aponta para dentro)
  bfix.push([bi, b.p.map((q, i) => out[i] ? [r2(out[i].px + out[i].nx * 0.05), r2(out[i].pz + out[i].nz * 0.05)] : q)]); bstat.corrigidos++;
});
console.log('prédios na caixa', bstat.naCaixa, '| avançam sobre calçada/rua', bstat.avancam, '| corrigidos (≤ 4 m)', bstat.corrigidos, '| maiores, mantidos', bstat.grandes);

/* ---------- 5c. transição na borda da região: medidas do piloto onde cada via sai (a malha antiga continua com elas) ---------- */
const trans = [];
for (const [r, sp] of spec) {
  if (ring.has(r) || r.k === 'service') continue;
  const p = P(r), { S } = resampleArc(p, 0.5);
  for (let k = 0; k < S.length - 1; k++) {
    const a = S[k], b = S[k + 1], ia = inBox(a.x, a.z), ib = inBox(b.x, b.z); if (ia === ib) continue;
    const dir = ia ? 1 : -1, q = ia ? a : b;                // dir: +1 = sai da região no sentido do traçado
    const qx = q.x - q.tx * dir * 1.5, qz = q.z - q.tz * dir * 1.5;   // mede 1,5 m para dentro
    if (classify(qx, qz) !== 1) continue;
    const side = sg => { let t = 0; while (t < 25 && classify(qx + q.nx * sg * t, qz + q.nz * sg * t) === 1) t += 0.1; const c = t; while (t < c + 12 && classify(qx + q.nx * sg * t, qz + q.nz * sg * t) === 2) t += 0.1; return [r2(c), r2(t)]; };
    const [cL, eL] = side(1), [cR, eR] = side(-1);
    if (cL < 2 || cR < 2 || cL > 20 || cR > 20) continue;
    trans.push([roads.indexOf(r), r2((a.s + b.s) / 2), dir, cL, eL, cR, eR]);
  }
}
console.log('transições na borda', trans.length);

/* ---------- 6. mapa de piso (0,5 m) para andar: 0 lote, 1 asfalto, 2 calçada, 3 canteiro ---------- */
const GC = 0.5, GW = Math.round((BOX.x1 - BOX.x0) / GC), GH = Math.round((BOX.z1 - BOX.z0) / GC), grid = new Uint8Array(GW * GH);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const x = BOX.x0 + (i + 0.5) * GC, z = BOX.z0 + (j + 0.5) * GC; grid[j * GW + i] = inBox(x, z) ? classify(x, z) : 255; }   // 255 = fora da região

const data = { v: 2, etapa: ETAPA, nome: ETAPAS[ETAPA - 1].nome, areas: AREAS, fonte: 'GEO Igrejinha — Quadras (camada 7577); eixos OSM centrados entre as quadras', box: BOX, fade: FADE,
  trans, rings: loops.map(l => l.map(q => roads.indexOf(q))), ringGeo: loops.map(l => { const pts = l.flatMap(q => P(q)), cx = pts.reduce((a, q) => a + q[0], 0) / pts.length, cz = pts.reduce((a, q) => a + q[1], 0) / pts.length; return [r2(cx), r2(cz), r2(Math.max(...pts.map(q => Math.hypot(q[0] - cx, q[1] - cz))))]; }), buildings: bfix, borig: bfix.map(([bi]) => [bi, W.buildings[bi].p[0]]), roads: corr, asph: quads[1], walk: quads[2], med: quads[3], medG: quads[4], curbs, grid: { cell: GC, w: GW, h: GH, b64: Buffer.from(grid).toString('base64') },
  blocks: blocks.filter(p => p.some(([x, z]) => inBox(x, z, 10))).map(p => p.map(q => [r2(q[0]), r2(q[1])])), curbPolys, medPolys: medPolys.map(m => m.p),
  orig: [...newP.keys()].map(r => [roads.indexOf(r), r.p]) };
fs.writeFileSync('public/data/piloto.data.json', JSON.stringify({ gzip_base64: zlib.gzipSync(JSON.stringify(data), { level: 9 }).toString('base64') }));
const nq = k => quads[k].length / 8;
console.log('quadras', blocks.length, '| meio-fio de quadra', curbPolys.length, '| canteiros', medPolys.length, '| vias corrigidas', newP.size, '(+', corr.length - newP.size, 'ligadas) | nós', stats.nos);
console.log('amostras', stats.amostras, 'válidas', stats.validas, 'descartadas', stats.rejeitadas);
console.log('trapézios: asfalto', nq(1), 'calçada', nq(2), 'canteiro', nq(3), '+ gramado', nq(4), '| rótulas', loops.length, '| meio-fio', curbs.length / 5, '| arquivo', Math.round(fs.statSync('public/data/piloto.data.json').size / 1024), 'KB');
// deslocamento aplicado (para o relatório)
const dl = []; for (const [r, p] of newP) { const q = r.p; for (let j = 0; j < q.length; j++) { const m = moved.get(key(q[j])); if (m && inBox(q[j][0], q[j][1])) dl.push(Math.hypot(m[0] - q[j][0], m[1] - q[j][1])); } }
dl.sort((a, b) => a - b); console.log('deslocamento dos vértices na caixa: mediana', dl[dl.length >> 1]?.toFixed(2), 'm, P90', dl[Math.floor(dl.length * 0.9)]?.toFixed(2), 'm, máx', dl.at(-1)?.toFixed(2), 'm');

/* ---------- 7. validação numérica (antes = Centro 7, depois = piloto) ---------- */
{
  const res = { antes: { pistaNoLote: 0, calcadaNoLote: 0, n: 0, nc: 0, eixo: [] }, depois: { pistaNoLote: 0, pistaNaCalcada: 0, n: 0, eixo: [] } };
  for (const [r, sp] of spec) {
    if (noCenter(r)) continue;
    for (const [tag, poly] of [['antes', r.p], ['depois', P(r)]]) {
      const { S } = resampleArc(poly, 2), R = res[tag];
      for (const q of S) {
        if (!inBox(q.x, q.z, -5)) continue;
        // pista: 5 pontos atravessando a largura
        for (const f of [-0.9, -0.45, 0, 0.45, 0.9]) { const x = q.x + q.nx * sp.half * f, z = q.z + q.nz * sp.half * f; R.n++; const c = classify(x, z);
          if (tag === 'antes' ? inAnyBlock(x, z) : c === 0) R.pistaNoLote++; else if (tag === 'depois' && c === 2) R.pistaNaCalcada++; }
        // calçada do modelo antigo (faixa paralela ao eixo)
        if (tag === 'antes' && sp.side > 0) for (const sg of sp.dual ? [-sp.MS] : [1, -1]) { const o = sp.half + sp.side / 2, x = q.x + q.nx * o * sg, z = q.z + q.nz * o * sg; R.nc++; if (inAnyBlock(x, z)) R.calcadaNoLote++; }
        // eixo em relação ao centro do vão (pista simples) ou à posição da lei (pista dupla)
        if (sp.dual) { const o = ray(q.x, q.z, -sp.MS * q.nx, -sp.MS * q.nz, 30); if (o < 30) R.eixo.push(Math.abs(o - sp.side - sp.half)); }
        else { const l = ray(q.x, q.z, q.nx, q.nz), rr = ray(q.x, q.z, -q.nx, -q.nz); if (l + rr < Math.max(sp.expROW * 1.7, sp.expROW + 8)) R.eixo.push(Math.abs(l - rr) / 2); }
      }
    }
  }
  const pct = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + '%', mq = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? `mediana ${s[s.length >> 1].toFixed(2)} m, P90 ${s[Math.floor(s.length * 0.9)].toFixed(2)} m` : '—'; };
  const A = res.antes, D = res.depois;
  console.log('VALIDAÇÃO na caixa piloto:');
  console.log('  pista dentro de lote:    antes', pct(A.pistaNoLote, A.n), '| depois', pct(D.pistaNoLote, D.n));
  console.log('  calçada dentro de lote:  antes', pct(A.calcadaNoLote, A.nc), '| depois 0% (por construção: calçada só fora da quadra)');
  console.log('  pista sob a calçada:     depois', pct(D.pistaNaCalcada, D.n));
  console.log('  eixo fora do centro:     antes', mq(A.eixo), '| depois', mq(D.eixo));
  const out = JSON.parse(zlib.gunzipSync(Buffer.from(JSON.parse(fs.readFileSync('public/data/piloto.data.json')).gzip_base64, 'base64')));
  fs.writeFileSync('docs/piloto-validacao.json', JSON.stringify({ pistaNoLote: [pct(A.pistaNoLote, A.n), pct(D.pistaNoLote, D.n)], calcadaNoLote: [pct(A.calcadaNoLote, A.nc), '0%'], pistaSobCalcada: pct(D.pistaNaCalcada, D.n), eixo: [mq(A.eixo), mq(D.eixo)], trapezios: { asfalto: nq(1), calcada: nq(2), canteiro: nq(3) + nq(4) }, meioFio: curbs.length / 5 }, null, 1));
}

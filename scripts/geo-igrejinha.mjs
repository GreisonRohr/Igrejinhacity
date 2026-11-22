// Integra as camadas do GEO Igrejinha (Prefeitura) ao mundo montado a partir do OSM.
import fs from 'node:fs';
import { toXZ } from '../src/geo.js';

const DIR = 'data/raw/geoigrejinha';
const r1 = v => Math.round(v * 10) / 10;
export const hasGeo = () => fs.existsSync(`${DIR}/edificacoes.geojson`);
const load = n => fs.existsSync(`${DIR}/${n}.geojson`) ? JSON.parse(fs.readFileSync(`${DIR}/${n}.geojson`)).features : [];
const ring = c => { const p = c.map(([lon, lat]) => toXZ(lat, lon).map(r1)); if (p.length > 1 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1]) p.pop(); return p; };
const polys = g => !g ? [] : g.type === 'Polygon' ? [g.coordinates.map(ring)] : g.type === 'MultiPolygon' ? g.coordinates.map(pg => pg.map(ring)) : [];
const lines = g => !g ? [] : g.type === 'LineString' ? [ring(g.coordinates)] : g.type === 'MultiLineString' ? g.coordinates.map(ring) : [];
const point = g => {
  if (!g) return null;
  if (g.type === 'Point') return toXZ(g.coordinates[1], g.coordinates[0]).map(r1);
  const p = polys(g)[0]?.[0] || lines(g)[0]; if (!p?.length) return null;
  return [r1(p.reduce((s, q) => s + q[0], 0) / p.length), r1(p.reduce((s, q) => s + q[1], 0) / p.length)];
};

/* ---------- geometria ---------- */
export const area = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const centroid = p => { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; };
/** Remove pontos quase alinhados (simplifica contornos da Prefeitura). */
function simplify(p, tol = 0.25) {
  let out = p.slice(), changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const a = out[(i - 1 + out.length) % out.length], b = out[i], c = out[(i + 1) % out.length];
      const L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1e-9;
      const d = Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / L;
      if (d < tol || Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.3) { out.splice(i, 1); changed = true; i--; }
    }
  }
  return out;
}
/** Menor retângulo orientado (testa a direção de cada aresta). */
export function obb(p) {
  let best = null;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.5) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of p) { const u = x * ux + z * uz, v = -x * uz + z * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const ar = (u1 - u0) * (v1 - v0);
    if (!best || ar < best.ar) {
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      best = { ar, cx: cu * ux - cv * uz, cz: cu * uz + cv * ux, ux, uz, hu: (u1 - u0) / 2, hv: (v1 - v0) / 2 };
    }
  }
  return best;
}

class Grid {
  constructor(c) { this.c = c; this.m = new Map(); }
  add(it, x0, z0, x1, z1) { for (let i = Math.floor(x0 / this.c); i <= Math.floor(x1 / this.c); i++) for (let j = Math.floor(z0 / this.c); j <= Math.floor(z1 / this.c); j++) { const k = i + ',' + j; (this.m.get(k) || this.m.set(k, []).get(k)).push(it); } }
  near(x, z) { return this.m.get(Math.floor(x / this.c) + ',' + Math.floor(z / this.c)) || []; }
}
const bbox = p => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, z] of p) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); } return [a, b, c, d]; };

let seed = 4242; const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/* ---------- prédios ---------- */
export function mergeBuildings(osmBuildings) {
  const centro = polys(load('bairros').find(f => /Centro/.test(f.properties.Nome))?.geometry)[0]?.[0];
  const out = [], grid = new Grid(40), pools = [];
  const overlaps = p => {
    const [cx, cz] = centroid(p);
    for (const o of grid.near(cx, cz)) if (inPoly(cx, cz, o.p) || inPoly(o.c[0], o.c[1], p)) return o;
    return null;
  };
  const push = (b) => { b.c = centroid(b.p); grid.add(b, ...bbox(b.p)); out.push(b); };
  const heightFor = (p, ar, tipo) => {
    const [cx, cz] = centroid(p), noCentro = centro && inPoly(cx, cz, centro), r = rand();
    if (tipo === 'D') return { h: ar > 150 ? 4.5 : 2.7, kind: ar > 150 ? 'shed' : 'annex', lv: 1 };
    if (ar > 700) return { h: r < 0.5 ? 8 : 10, kind: 'industrial', lv: 1 };
    if (ar > 300) return noCentro ? { h: 3 * 3.1 + 0.4, kind: 'commercial', lv: 3 } : { h: r < 0.5 ? 6.5 : 7.5, kind: r < 0.5 ? 'industrial' : 'commercial', lv: 2 };
    const lv = noCentro ? (r < 0.3 ? 1 : r < 0.75 ? 2 : r < 0.93 ? 3 : 4) : ar < 70 ? 1 : (r < 0.62 ? 1 : r < 0.96 ? 2 : 3);
    return { h: lv * 3.0 + 0.4, kind: noCentro && lv >= 2 ? 'commercial' : 'house', lv };
  };
  // 1. Prefeitura (levantamento cadastral)
  for (const f of load('edificacoes')) {
    const tipo = f.properties.Tipo;
    for (const pg of polys(f.geometry)) {
      let p = simplify(pg[0]); if (p.length < 3) continue;
      if (area(p) > 0) p.reverse();
      const ar = Math.abs(area(p));
      if (tipo === 'P') { pools.push(p); continue; }      // piscinas
      if (ar < 6) continue;
      push({ p, ...heightFor(p, ar, tipo), src: 'pref' });
    }
  }
  const nPref = out.length;
  // 2. Google Open Buildings 2024: só o que a Prefeitura não tem (construções novas e zona rural)
  for (const f of load('open_buildings_google_2024')) {
    if ((f.properties.confidence ?? 1) < 0.72) continue;
    for (const pg of polys(f.geometry)) {
      let p = simplify(pg[0]); if (p.length < 3) continue;
      if (area(p) > 0) p.reverse();
      const ar = Math.abs(area(p)); if (ar < 12) continue;
      if (overlaps(p)) continue;
      push({ p, ...heightFor(p, ar, ar < 40 ? 'D' : 'C'), src: 'google' });
    }
  }
  const nGoogle = out.length - nPref;
  // 3. OSM: fora do município ou ainda faltando; nomes do OSM passam para o prédio da Prefeitura
  let nOsm = 0;
  for (const b of osmBuildings) {
    const p = b.p.slice(); if (area(p) > 0) p.reverse();
    const o = overlaps(p);
    if (o) { if (b.n && !o.n) o.n = b.n; continue; }
    push({ p, h: b.h, kind: b.kind, lv: b.lv, n: b.n, src: 'osm' }); nOsm++;
  }
  // telhado: retângulo orientado quando o contorno é "quase retângulo"
  for (const b of out) {
    const ar = Math.abs(area(b.p)), o = obb(b.p);
    if (o && ar / o.ar > 0.74) b.rect = [r1(o.cx * 10) / 10, r1(o.cz * 10) / 10, Math.round(o.ux * 1000) / 1000, Math.round(o.uz * 1000) / 1000, r1(o.hu * 10) / 10, r1(o.hv * 10) / 10];
    delete b.c;
  }
  return { buildings: out, pools, stats: { prefeitura: nPref, google: nGoogle, osm: nOsm, piscinas: pools.length } };
}

/* ---------- ruas: pavimento e perfil da Prefeitura aplicados às ruas do OSM ---------- */
export function enrichRoads(roads) {
  const grid = new Grid(50), segs = [];
  for (const f of load('ruas_estradas')) {
    const pr = f.properties;
    for (const l of lines(f.geometry)) for (let i = 0; i < l.length - 1; i++) {
      const s = { a: l[i], b: l[i + 1], pr }; segs.push(s);
      grid.add(s, Math.min(s.a[0], s.b[0]) - 15, Math.min(s.a[1], s.b[1]) - 15, Math.max(s.a[0], s.b[0]) + 15, Math.max(s.a[1], s.b[1]) + 15);
    }
  }
  const dist = (x, z, s) => { const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / l2)); return Math.hypot(x - s.a[0] - dx * t, z - s.a[1] - dz * t); };
  const PAV = { 'pedra irregular': 'pedra', asfalto: 'asfalto', 'bloco de concreto': 'bloco', concreto: 'concreto', 'sem pavimento': 'terra' };
  let n = 0;
  for (const r of roads) {
    if (['footway', 'path', 'steps', 'cycleway', 'track', 'service'].includes(r.k)) continue;
    const votes = new Map();
    for (let i = 0; i < r.p.length - 1; i++) {
      const mx = (r.p[i][0] + r.p[i + 1][0]) / 2, mz = (r.p[i][1] + r.p[i + 1][1]) / 2;
      let best = null, bd = 12;
      for (const s of grid.near(mx, mz)) { const d = dist(mx, mz, s); if (d < bd) { bd = d; best = s; } }
      if (best) votes.set(best.pr, (votes.get(best.pr) || 0) + 1);
    }
    if (!votes.size) continue;
    const pr = [...votes].sort((a, b) => b[1] - a[1])[0][0];
    n++;
    const num = v => +v || 0;
    if (PAV[pr.Tipo_Pav]) r.pav = PAV[pr.Tipo_Pav];
    const lanes = num(pr.Faixa_E) + num(pr.Faixa_D), park = num(pr.Estacio_E) + num(pr.Estacio_D), cic = num(pr.Ciclovia_E) + num(pr.Ciclovia_D);
    if (lanes > 0) r.w = r1(lanes + park + cic + num(pr.Canteiro_C));
    if (num(pr.Passeio_E) || num(pr.Passeio_D)) r.sw = [num(pr.Passeio_E), num(pr.Passeio_D)];
    if (num(pr.Canteiro_C)) r.med = num(pr.Canteiro_C);
    if (cic) r.cic = cic;
    if (!r.n && pr.Logradouro) r.n = pr.Logradouro;
  }
  return n;
}

/* ---------- água, praças e lugares ---------- */
export function extras() {
  const areas = [], places = [];
  const rio = load('rio_paranhana')[0];
  for (const pg of polys(rio?.geometry)) areas.push({ p: pg[0], k: 'river', n: 'Rio Paranhana' });
  for (const f of load('lagos')) for (const pg of polys(f.geometry)) if (Math.abs(area(pg[0])) > 30) areas.push({ p: pg[0], k: 'water' });
  for (const f of load('pracas_lazer')) {
    const nome = f.properties.Nome_1, tipo = f.properties.Tipo_1;
    for (const pg of polys(f.geometry)) areas.push({ p: pg[0], k: tipo === 'Praça' ? 'park' : 'plaza', n: nome });
    const c = point(f.geometry); if (c && nome) places.push({ x: c[0], z: c[1], k: tipo === 'Praça' ? 'praca' : 'social', n: nome });
  }
  for (const f of load('cemiterios_poligonal')) for (const pg of polys(f.geometry)) areas.push({ p: pg[0], k: 'cemetery' });
  for (const f of load('escolas')) { const c = point(f.geometry); if (c) places.push({ x: c[0], z: c[1], k: 'escola', n: f.properties.Name }); }
  for (const f of load('saude')) { const c = point(f.geometry); if (c) places.push({ x: c[0], z: c[1], k: /Bombeiros/.test(f.properties.Nome) ? 'bombeiros' : /Farm/.test(f.properties.Nome) ? 'farmacia' : 'saude', n: f.properties.Nome }); }
  for (const f of load('pontes')) { const c = point(f.geometry); if (c) places.push({ x: c[0], z: c[1], k: 'ponte', n: f.properties.Nome }); }
  const REF = /Monte da Fe|Mirante|Cascata|Camping|Sociedade|Reservatorio|Torre/i;
  for (const f of load('pontos_referencia')) { const d = f.properties.Descric || ''; const c = point(f.geometry); if (c && REF.test(d)) places.push({ x: c[0], z: c[1], k: /Cascata/.test(d) ? 'cascata' : /Mirante/.test(d) ? 'mirante' : 'ref', n: d.replace('Monte da Fe', 'Monte da Fé').replace('Solitaria', 'Solitária') }); }
  for (const f of load('localidades_toponimos')) { const c = point(f.geometry); if (c) places.push({ x: c[0], z: c[1], k: 'localidade', n: f.properties.Nome }); }
  for (const f of load('paradas_onibus')) { const c = point(f.geometry); if (c) places.push({ x: c[0], z: c[1], k: 'onibus', n: 'Parada de ônibus' }); }
  const ciclo = []; for (const f of load('ciclovias')) for (const l of lines(f.geometry)) ciclo.push(l);
  return { areas, places, ciclovias: ciclo };
}

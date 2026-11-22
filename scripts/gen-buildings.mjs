// Gera casas e comércio ao longo das ruas reais onde o OSM não tem prédios mapeados.
// Determinístico (semente fixa): o mapa é sempre o mesmo.
import fs from 'node:fs';

export function loadTerrain() {
  const meta = JSON.parse(fs.readFileSync('public/data/terrain.json'));
  const q = new Int16Array(fs.readFileSync('public/data/terrain.bin').buffer.slice(0));
  const hi = (i, j) => q[Math.max(0, Math.min(meta.nz - 1, j)) * meta.nx + Math.max(0, Math.min(meta.nx - 1, i))] * meta.scale;
  const height = (x, z) => {
    const fx = (x - meta.x0) / meta.cell, fz = (z - meta.z0) / meta.cell, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    return (hi(i, j) * (1 - u) + hi(i + 1, j) * u) * (1 - v) + (hi(i, j + 1) * (1 - u) + hi(i + 1, j + 1) * u) * v;
  };
  return { meta, height };
}

let seed = 20240917;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const R = (a, b) => a + rand() * (b - a);

// grade espacial simples
class Grid {
  constructor(cell) { this.cell = cell; this.m = new Map(); }
  key(i, j) { return i * 100003 + j; }
  add(item, minX, minZ, maxX, maxZ) {
    const c = this.cell;
    for (let i = Math.floor(minX / c); i <= Math.floor(maxX / c); i++)
      for (let j = Math.floor(minZ / c); j <= Math.floor(maxZ / c); j++) {
        const k = this.key(i, j); let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(item);
      }
  }
  query(minX, minZ, maxX, maxZ, out = new Set()) {
    const c = this.cell;
    for (let i = Math.floor(minX / c); i <= Math.floor(maxX / c); i++)
      for (let j = Math.floor(minZ / c); j <= Math.floor(maxZ / c); j++) {
        const a = this.m.get(this.key(i, j)); if (a) for (const it of a) out.add(it);
      }
    return out;
  }
}

const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
};
const corners = (b) => {
  const c = Math.cos(b.r), s = Math.sin(b.r), hw = b.w / 2, hd = b.d / 2;
  // eixo local: x' ao longo da rua (largura w), z' para dentro do lote (profundidade d)
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([u, v]) => [b.x + u * c + v * s, b.z - u * s + v * c]);
};
const polyOverlap = (A, B) => { // SAT para polígonos convexos
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % P.length], nx = z2 - z1, nz = x1 - x2;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (const [x, z] of A) { const d = x * nx + z * nz; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
    for (const [x, z] of B) { const d = x * nx + z * nz; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
    if (a1 <= b0 || b1 <= a0) return false;
  }
  return true;
};
const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const bboxOf = p => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, z] of p) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); } return [a, b, c, d]; };

const URBAN_ROADS = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'primary_link', 'secondary_link']);
const COMMERCIAL = /Castelo Branco|Independ|Tancredo|Benjamin Constant|Arlindo Geis|Ildo Meneghetti|João Corrêa|Sete de Setembro/i;

export function generateBuildings(world, landmarks, terrain) {
  const { height } = terrain;
  // 1. obstáculos: ruas, rio, áreas especiais, prédios reais, pontos marcantes
  const roadGrid = new Grid(60);
  for (const r of world.roads) for (let i = 0; i < r.p.length - 1; i++) {
    const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], m = r.w / 2 + 1.2;
    roadGrid.add({ ax, az, bx, bz, m }, Math.min(ax, bx) - m, Math.min(az, bz) - m, Math.max(ax, bx) + m, Math.max(az, bz) + m);
  }
  for (const w of world.water) for (let i = 0; i < w.p.length - 1; i++) {
    const [ax, az] = w.p[i], [bx, bz] = w.p[i + 1], m = w.w / 2 + (w.k === 'river' ? 10 : 3);
    roadGrid.add({ ax, az, bx, bz, m }, Math.min(ax, bx) - m, Math.min(az, bz) - m, Math.max(ax, bx) + m, Math.max(az, bz) + m);
  }
  const areaGrid = new Grid(200);
  const BLOCK_AREAS = new Set(['water', 'park', 'pitch', 'pool', 'forest', 'cemetery', 'grass', 'parking', 'quarry']);
  for (const a of world.areas) if (BLOCK_AREAS.has(a.k)) { const bb = bboxOf(a.p); areaGrid.add({ p: a.p, bb }, ...bb); }
  const industrial = world.areas.filter(a => a.k === 'industrial').map(a => ({ p: a.p, bb: bboxOf(a.p) }));
  const bGrid = new Grid(40);
  for (const b of world.buildings) { const bb = bboxOf(b.p); const it = { poly: b.p }; bGrid.add(it, ...bb); }
  const reserved = landmarks.filter(l => !['avenida', 'cruz', 'asadelta'].includes(l.id))
    .map(l => ({ x: l.x, z: l.z, r: { praca: 45, ruacoberta: 20, igreja: 30, oktober: 120, prefeitura: 45, ponte: 25, passarela: 20, beirario: 60, usaflex: 60, piccfab: 35 }[l.id] || 18 }));

  // 2. densidade urbana: metros de rua urbana em cada célula de 200 m
  const dens = new Map(), DC = 200, dk = (x, z) => Math.floor(x / DC) * 100003 + Math.floor(z / DC);
  for (const r of world.roads) if (URBAN_ROADS.has(r.k)) for (let i = 0; i < r.p.length - 1; i++) {
    const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], l = Math.hypot(bx - ax, bz - az);
    const k = dk((ax + bx) / 2, (az + bz) / 2); dens.set(k, (dens.get(k) || 0) + l);
  }
  const density = (x, z) => { let s = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) s += dens.get(dk(x + a * DC, z + b * DC)) || 0; return s / 9; };

  const placed = new Grid(40), out = [];
  const ok = (b, poly) => {
    const [x0, z0, x1, z1] = bboxOf(poly);
    // pontos de teste: cantos, meio das arestas e centro
    const probe = [[b.x, b.z]];
    for (let i = 0; i < 4; i++) { const p0 = poly[i], p1 = poly[(i + 1) % 4]; probe.push(p0, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2]); }
    for (const s of roadGrid.query(x0, z0, x1, z1)) {
      for (const [x, z] of probe) if (segDist(x, z, s.ax, s.az, s.bx, s.bz) < s.m) return false;
      if (inPoly(s.ax, s.az, poly) || inPoly(s.bx, s.bz, poly)) return false;
    }
    for (const a of areaGrid.query(x0, z0, x1, z1)) if (inPoly(b.x, b.z, a.p) || poly.some(([x, z]) => inPoly(x, z, a.p))) return false;
    for (const it of bGrid.query(x0, z0, x1, z1)) if (polyOverlap(poly, it.poly)) return false;
    for (const it of placed.query(x0, z0, x1, z1)) if (polyOverlap(poly, it.poly)) return false;
    for (const r of reserved) if (Math.hypot(b.x - r.x, b.z - r.z) < r.r) return false;
    const hs = poly.map(([x, z]) => height(x, z)); const dh = Math.max(...hs) - Math.min(...hs);
    if (dh > 4.5) return false;                              // terreno íngreme demais
    b.y = Math.round(Math.min(...hs) * 10) / 10;
    return true;
  };

  for (const r of world.roads) {
    if (!URBAN_ROADS.has(r.k) && r.k !== 'service' && r.k !== 'track') continue;
    const commercial = COMMERCIAL.test(r.n || '');
    for (let i = 0; i < r.p.length - 1; i++) {
      const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1], L = Math.hypot(bx - ax, bz - az);
      if (L < 8) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      for (const side of [-1, 1]) {
        let t = R(2, 8);
        while (t < L - 4) {
          const x = ax + dx * t, z = az + dz * t;
          const dn = density(x, z);
          const urban = dn > 450, rural = !urban;
          // rural: casas esparsas; urbano: lotes contínuos
          if (rural && (r.k === 'track' || rand() > (dn > 150 ? 0.25 : 0.06))) { t += R(25, 60); continue; }
          if (r.k === 'service' && rand() > 0.3) { t += 15; continue; }
          const isInd = industrial.some(a => x > a.bb[0] && x < a.bb[2] && z > a.bb[1] && z < a.bb[3] && inPoly(x, z, a.p));
          const com = commercial && urban && rand() < 0.85;
          const front = isInd ? R(25, 45) : com ? R(9, 16) : R(8.5, 13);
          const depth = isInd ? R(20, 40) : com ? R(12, 20) : R(8, 12);
          const setback = r.w / 2 + (com ? 2.2 : isInd ? 8 : R(3.5, 6));
          const nx = -dz * side, nz = dx * side;                       // normal para o lado do lote
          const cx = x + dx * front / 2 + nx * (setback + depth / 2), cz = z + dz * front / 2 + nz * (setback + depth / 2);
          const rot = Math.atan2(-dz, dx);                            // alinhado com a rua
          const b = { x: cx, z: cz, w: front - (com ? 0.3 : R(1.8, 3.5)), d: depth, r: side > 0 ? rot : rot + Math.PI };
          const poly = corners(b);
          if (ok(b, poly)) {
            const rr = rand();
            b.k = isInd ? 'i' : com ? 'c' : 'h';
            b.h = isInd ? R(7, 10) : com ? (rr < 0.5 ? 2 : rr < 0.85 ? 3 : 4) * 3.2 + 0.5 : (rr < 0.62 ? 1 : rr < 0.95 ? 2 : 3) * 3.0 + 0.4;
            placed.add({ poly }, ...bboxOf(poly));
            out.push(b);
            t += front;
          } else t += R(3, 6);
        }
      }
    }
  }
  const r2 = v => Math.round(v * 100) / 100;
  return out.map(b => [r2(b.x), r2(b.z), r2(b.y), r2(b.w), r2(b.d), r2(((b.r % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)), r2(b.h), b.k]);
}

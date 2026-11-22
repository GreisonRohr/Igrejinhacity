// Cidade em 3D a partir do world.json: rio escavado no terreno, ruas com calçada, pontes e prédios.
// Tudo é mesclado por região (chunks de 400 m) → poucas draw calls; regiões distantes somem.
import * as THREE from 'three';
import { GeoBuilder, litMaterial } from './geo-builder.js';
import { editHeights } from './terrain.js';

const CHUNK = 600;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
};
const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };

let seed = 99;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = a => a[Math.floor(rand() * a.length)];

const WALLS = [0xf4f0e6, 0xf2e6c4, 0xf0dcc8, 0xe4ece3, 0xf7f2dc, 0xecd2b0, 0xdbe6f0, 0xd5e3cc, 0xf6e9d8, 0xffffff, 0xf3d9d9].map(c => new THREE.Color(c));
const COM_WALLS = [0xf4f0e6, 0xe9e2d4, 0xf2e6c4, 0xdedad2, 0xf0dcc8, 0xd9e2ea].map(c => new THREE.Color(c));
const IND_WALLS = [0xe9ebee, 0xdfe3e8, 0xf2f2f0, 0xd8dde3].map(c => new THREE.Color(c));
const ROOFS = [0xa4452c, 0x8a3b26, 0xb5553a, 0x9a5a3b, 0x7a3a28, 0xa85a32, 0x6b4a3a].map(c => new THREE.Color(c));
const FLAT = [0x9d9a92, 0xb0aca4, 0x8c8a86].map(c => new THREE.Color(c));
const METAL = [0x8e98a4, 0xa9b2bb, 0x6f8fa8].map(c => new THREE.Color(c));
const C = {
  asphalt: new THREE.Color(0x4d5157), dirt: new THREE.Color(0xa08660), path: new THREE.Color(0xc2ad86),
  side: new THREE.Color(0xc9c3b6), curb: new THREE.Color(0xe4e0d6), line: new THREE.Color(0xf0f0ea), yellow: new THREE.Color(0xf2d24b),
  concrete: new THREE.Color(0xb9b6ae), plain: new THREE.Color(0xffffff), pool: new THREE.Color(0x7fd6ff),
  pedra: new THREE.Color(0x8a8378), bloco: new THREE.Color(0xa29d94), median: new THREE.Color(0x6f9e4c),
};

const URBAN = new Set(['primary', 'secondary', 'tertiary', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link']);
const MARKED = new Set(['primary', 'secondary', 'tertiary']);

function windowTextures() {
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  // uma "baia" de 3,5 m × 1 andar de 3,1 m; a faixa de baixo (v < 0,2) é parede lisa
  const map = mk(g => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#e8e2d6'; g.fillRect(0, 60, 64, 4);
    g.fillStyle = '#f3efe8'; g.fillRect(17, 11, 30, 34);
    g.fillStyle = '#56667a'; g.fillRect(20, 14, 24, 28);
    g.fillStyle = '#7d8fa3'; g.fillRect(20, 14, 24, 8);
    g.fillStyle = '#eeeae2'; g.fillRect(31, 14, 2, 28); g.fillRect(16, 44, 32, 3);
  });
  const emissive = mk(g => { g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#ffc874'; g.fillRect(20, 14, 24, 28); });
  return { map, emissive };
}

/** Pedra irregular (paralelepípedo de basalto), típica das ruas de Igrejinha. */
function cobbleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#6d6a64'; g.fillRect(0, 0, 128, 128);
  let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 128; y += 16) for (let x = -8; x < 128; x += 16) {
    const ox = (y / 16) % 2 ? 8 : 0, l = 150 + r() * 70;
    g.fillStyle = `rgb(${l},${l * 0.97},${l * 0.92})`;
    g.beginPath(); g.roundRect(x + ox + 1 + r() * 2, y + 1 + r() * 2, 12 + r() * 2, 12 + r() * 2, 4); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function roofTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 28, 32, 4);
  g.fillStyle = 'rgba(0,0,0,0.07)'; for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 1, 28);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export class City {
  constructor(world, terrain, { buildDist = 3500, roadDist = 950 } = {}, exclusions = []) {
    this.world = world; this.t = terrain;
    this.exclusions = exclusions;     // pontos marcantes com modelo próprio: o prédio genérico sai
    this.buildDist = buildDist; this.roadDist = roadDist;
    this.group = new THREE.Group();
    this.chunks = new Map();
    this.colGrid = new Map();
    const tex = windowTextures();
    this.wallMat = litMaterial({ vertexColors: true, map: tex.map, emissive: 0xffffff, emissiveMap: tex.emissive, emissiveIntensity: 0 });
    this.roofMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: roofTexture() });
    this.roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.cobbleMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: cobbleTexture(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.waterMat = new THREE.MeshPhongMaterial({ vertexColors: true, color: 0x3f7fb0, specular: 0x9fc6e8, shininess: 60, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  }

  chunk(x, z) {
    const k = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
    let c = this.chunks.get(k);
    if (!c) this.chunks.set(k, c = { walls: new GeoBuilder(), roofs: new GeoBuilder(), roads: new GeoBuilder(), cobble: new GeoBuilder(), cx: (Math.floor(x / CHUNK) + 0.5) * CHUNK, cz: (Math.floor(z / CHUNK) + 0.5) * CHUNK, meshes: [] });
    return c;
  }

  /* ---------- 1. rio: calcula o nível da água e escava o leito (antes de montar o terreno) ---------- */
  carveWater() {
    const t = this.t;
    this.orig = (x, z) => t.heightAt(x, z);          // será trocado por cópia antes de escavar
    const copy = new Float32Array(t.h), tt = Object.create(t); tt.h = copy;
    this.orig = (x, z) => t.heightAt.call(tt, x, z);
    this.waterLines = [];
    // máscara do rio (polígono da Prefeitura) na grade do terreno, por varredura de linhas
    this.riverAreas = this.world.areas.filter(a => a.k === 'river');
    this.mask = new Uint8Array(t.nx * t.nz);
    for (const a of this.riverAreas) rasterize(a.p, t, this.mask);
    const masked = (x, z) => { const i = Math.round((x - t.x0) / t.cell), j = Math.round((z - t.z0) / t.cell); return i >= 0 && j >= 0 && i < t.nx && j < t.nz && this.mask[j * t.nx + i]; };
    this.masked = masked;
    for (const w of this.world.water) {
      if (w.k !== 'river' && w.k !== 'stream' && w.k !== 'canal') continue;
      const big = w.k === 'river', half = w.w / 2;
      const pts = resample(w.p, 8);
      const ys = pts.map(([x, z], i) => {
        const [nx, nz] = perp(pts, i);
        return Math.min(this.orig(x, z), this.orig(x + nx * (half + 4), z + nz * (half + 4)), this.orig(x - nx * (half + 4), z - nz * (half + 4))) - (big ? 0.8 : 0.3);
      });
      for (let i = 1; i < ys.length; i++) ys[i] = Math.min(ys[i], ys[i - 1] + 0.02);   // água não sobe rio abaixo
      for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.max(ys[i], ys[i + 1] - 0.6); // sem degraus bruscos
      this.waterLines.push({ pts, ys, half, big });
      const depth = big ? 2.2 : 0.8, bank = big ? 7 : 3;
      for (let i = 0; i < pts.length - 1; i++) {
        if (masked((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2)) continue;   // trecho coberto pelo polígono
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], R = half + bank;
        editHeights(t, Math.min(ax, bx) - R, Math.min(az, bz) - R, Math.max(ax, bx) + R, Math.max(az, bz) + R, (x, z, h) => {
          const d = segDist(x, z, ax, az, bx, bz);
          if (d > R) return h;
          const target = Math.min(ys[i], ys[i + 1]) - depth;
          return Math.min(h, target + (h - target) * smooth(half - 1, R, d));
        });
      }
    }

    // nível da água em qualquer ponto = amostra mais próxima da linha central do rio
    this.levelGrid = new Map();
    for (const wl of this.waterLines) if (wl.big) wl.pts.forEach((p, i) => { const k = Math.floor(p[0] / 50) + ',' + Math.floor(p[1] / 50); (this.levelGrid.get(k) || this.levelGrid.set(k, []).get(k)).push([p[0], p[1], wl.ys[i]]); });
    // escava tudo o que está dentro do polígono do rio
    for (let j = 0; j < t.nz; j++) for (let i = 0; i < t.nx; i++) {
      const k = j * t.nx + i; if (!this.mask[k]) continue;
      const x = t.x0 + i * t.cell, z = t.z0 + j * t.cell, lv = this.levelAt(x, z);
      if (lv !== null) t.h[k] = Math.min(t.h[k], lv - 2.2);
    }
  }

  levelAt(x, z) {
    let best = null, bd = Infinity;
    const ci = Math.floor(x / 50), cj = Math.floor(z / 50);
    for (let r = 0; r <= 3 && best === null; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
      for (const q of this.levelGrid.get((ci + a) + ',' + (cj + b)) || []) { const d = (q[0] - x) ** 2 + (q[1] - z) ** 2; if (d < bd) { bd = d; best = q[2]; } }
    }
    return best ?? (this.orig(x, z) - 0.5);
  }

  /* ---------- 2. tudo o mais (depois que o terreno está pronto) ---------- */
  build() {
    this.buildWater();
    this.buildRoads();
    this.buildBuildings();
    for (const c of this.chunks.values()) {
      for (const [key, mat, shadow] of [['walls', this.wallMat, true], ['roofs', this.roofMat, true], ['roads', this.roadMat, false], ['cobble', this.cobbleMat, false]]) {
        const g = c[key].build(); c[key] = null;
        if (!g) continue;
        const m = new THREE.Mesh(g, mat);
        m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false;
        m.userData.kind = key;
        c.meshes.push(m); this.group.add(m);
      }
    }
    return this.group;
  }

  buildWater() {
    const b = new GeoBuilder(), col = C.plain;   // água: cor do material × cor do vértice
    for (const { pts, ys, half } of this.waterLines) {
      for (let i = 0; i < pts.length - 1; i++) {
        if (this.masked((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2)) continue;
        const [n0x, n0z] = perp(pts, i), [n1x, n1z] = perp(pts, i + 1), w0 = half + 1.5, w1 = half + 1.5;
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        b.quad([ax + n0x * w0, ys[i], az + n0z * w0], [bx + n1x * w1, ys[i + 1], bz + n1z * w1], [bx - n1x * w1, ys[i + 1], bz - n1z * w1], [ax - n0x * w0, ys[i], az - n0z * w0],
          [[0, 0], [1, 0], [1, 1], [0, 1]], col, 0, [0, 1, 0]);
      }
    }
    // rio Paranhana pelo polígono real (Prefeitura): cada vértice no nível da água mais próximo
    for (const a of this.riverAreas) {
      const ys = a.p.map(([x, z]) => this.levelAt(x, z));
      const tris = THREE.ShapeUtils.triangulateShape(a.p.map(([x, z]) => new THREE.Vector2(x, z)), []);
      for (const [i, j, k] of tris) b.tri([a.p[i][0], ys[i], a.p[i][1]], [a.p[j][0], ys[j], a.p[j][1]], [a.p[k][0], ys[k], a.p[k][1]], [[0, 0], [1, 0], [0, 1]], col, 0, [0, 1, 0]);
    }
    // piscinas
    for (const p of this.world.pools || []) {
      let y = -Infinity; for (const [x, z] of p) y = Math.max(y, this.t.heightAt(x, z));
      const tris = THREE.ShapeUtils.triangulateShape(p.map(([x, z]) => new THREE.Vector2(x, z)), []);
      for (const [i, j, k] of tris) b.tri([p[i][0], y + 0.12, p[i][1]], [p[j][0], y + 0.12, p[j][1]], [p[k][0], y + 0.12, p[k][1]], [[0, 0], [1, 0], [0, 1]], C.pool, 0, [0, 1, 0]);
    }
    // lagos e açudes
    for (const a of this.world.areas) if (a.k === 'water' || a.k === 'pool') {
      const cx = a.p.reduce((s2, q) => s2 + q[0], 0) / a.p.length, cz = a.p.reduce((s2, q) => s2 + q[1], 0) / a.p.length;
      if (this.masked(cx, cz)) continue;               // já coberto pelo polígono do rio
      let y = Infinity; for (const [x, z] of a.p) y = Math.min(y, this.t.heightAt(x, z));
      const tris = THREE.ShapeUtils.triangulateShape(a.p.map(([x, z]) => new THREE.Vector2(x, z)), []);
      for (const [i, j, k] of tris) b.tri([a.p[i][0], y + 0.15, a.p[i][1]], [a.p[j][0], y + 0.15, a.p[j][1]], [a.p[k][0], y + 0.15, a.p[k][1]], [[0, 0], [1, 0], [0, 1]], col, 0, [0, 1, 0]);
    }
    const g = b.build();
    if (g) { const m = new THREE.Mesh(g, this.waterMat); m.receiveShadow = true; this.group.add(m); this.water = m; }
  }

  buildRoads() {
    const t = this.t;
    for (const r of this.world.roads) {
      const pts = resample(r.p, 5), n = pts.length;
      const unpaved = r.pav === 'terra' || (!r.pav && (r.k === 'track' || ['unpaved', 'gravel', 'dirt', 'ground', 'compacted'].includes(r.sf)));
      const cobble = r.pav === 'pedra' || r.pav === 'bloco';
      const surf = r.k === 'path' || r.k === 'footway' || r.k === 'steps' ? C.path : unpaved ? C.dirt : r.pav === 'pedra' ? C.pedra : r.pav === 'bloco' ? C.bloco : C.asphalt;
      // pista dupla (duas linhas de mão única no OSM): cada uma fica com metade da largura da Prefeitura
      const dual = r.ow && r.med;
      const width = dual ? Math.max(3.5, (r.w - r.med) / 2) : r.w;
      const half = width / 2;
      const swAvg = r.sw ? (r.sw[0] + r.sw[1]) / 2 : (URBAN.has(r.k) && !unpaved ? 2.2 : 0);
      const side = r.br ? 0 : swAvg;
      const sideL = dual ? 0 : side, sideR = side;   // pista dupla: calçada só do lado de fora (direita)
      // ponte: a pista vai em linha reta entre as cabeceiras (altura original, antes de escavar o rio)
      let yAt = (x, z) => t.heightAt(x, z) + 0.08;
      if (r.br) {
        const h0 = this.orig(...pts[0]), h1 = this.orig(...pts[n - 1]), L = pathLen(pts);
        let acc = 0; const ys = pts.map((p, i) => { if (i) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); return h0 + (h1 - h0) * acc / L + 0.5; });
        const at = new Map(pts.map((p, i) => [p, ys[i]]));
        yAt = (x, z, p) => at.get(p);
      }
      const L = [], Rr = [], SL = [], SR = [], Y = [];
      for (let i = 0; i < n; i++) {
        const [x, z] = pts[i], [nx, nz, m] = perp(pts, i, true);
        L.push([x + nx * half * m, z + nz * half * m]); Rr.push([x - nx * half * m, z - nz * half * m]);
        SL.push([x + nx * (half + sideL) * m, z + nz * (half + sideL) * m]); SR.push([x - nx * (half + sideR) * m, z - nz * (half + sideR) * m]);
        Y.push(r.br ? yAt(x, z, pts[i]) : null);
      }
      const hy = (p, i) => (r.br ? Y[i] : yAt(p[0], p[1]));
      let dist = 0;
      for (let i = 0; i < n - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, mz = (pts[i][1] + pts[i + 1][1]) / 2;
        const ch = this.chunk(mx, mz), c = ch.roads, cs = cobble ? ch.cobble : c;
        const up = [0, 1, 0], uv4 = [[0, 0], [1, 0], [1, 1], [0, 1]];
        const P = (p, i2, dy = 0) => [p[0], hy(p, i2) + dy, p[1]];
        const wuv = q => [q[0] / 2.5, q[1] / 2.5];   // UV no mundo: textura de pedra/bloco em escala real
        cs.quad(P(L[i], i), P(L[i + 1], i + 1), P(Rr[i + 1], i + 1), P(Rr[i], i), [wuv(L[i]), wuv(L[i + 1]), wuv(Rr[i + 1]), wuv(Rr[i])], surf, 0, up);
        if (sideL) {
          c.quad(P(SL[i], i, 0.14), P(SL[i + 1], i + 1, 0.14), P(L[i + 1], i + 1, 0.14), P(L[i], i, 0.14), uv4, C.side, 0, up);
          c.quad(P(L[i], i, 0), P(L[i + 1], i + 1, 0), P(L[i + 1], i + 1, 0.14), P(L[i], i, 0.14), uv4, C.curb, 0, [pts[i][0] - L[i][0], 0, pts[i][1] - L[i][1]]);
        }
        if (sideR) {
          c.quad(P(Rr[i], i, 0.14), P(Rr[i + 1], i + 1, 0.14), P(SR[i + 1], i + 1, 0.14), P(SR[i], i, 0.14), uv4, C.side, 0, up);
          c.quad(P(Rr[i], i, 0), P(Rr[i + 1], i + 1, 0), P(Rr[i + 1], i + 1, 0.14), P(Rr[i], i, 0.14), uv4, C.curb, 0, [pts[i][0] - Rr[i][0], 0, pts[i][1] - Rr[i][1]]);
        }
        // canteiro central gramado (pista única com canteiro)
        if (r.med && !dual) {
          const [nx, nz] = perp(pts, i), mw = r.med / 2, a = pts[i], bb = pts[i + 1];
          c.quad([a[0] + nx * mw, hy(a, i) + 0.18, a[1] + nz * mw], [bb[0] + nx * mw, hy(bb, i + 1) + 0.18, bb[1] + nz * mw], [bb[0] - nx * mw, hy(bb, i + 1) + 0.18, bb[1] - nz * mw], [a[0] - nx * mw, hy(a, i) + 0.18, a[1] - nz * mw], uv4, C.median, 0, up);
        }
        // faixa central tracejada
        const seg = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
        if (MARKED.has(r.k) && !unpaved && !cobble && !r.med && Math.floor(dist / 3) % 2 === 0) {
          const [nx, nz] = perp(pts, i), lw = 0.08;
          const a = pts[i], b = pts[i + 1], col = r.main ? C.yellow : C.line;
          c.quad([a[0] + nx * lw, hy(a, i) + 0.02, a[1] + nz * lw], [b[0] + nx * lw, hy(b, i + 1) + 0.02, b[1] + nz * lw],
            [b[0] - nx * lw, hy(b, i + 1) + 0.02, b[1] - nz * lw], [a[0] - nx * lw, hy(a, i) + 0.02, a[1] - nz * lw], uv4, col, 0, up);
        }
        dist += seg;
        if (r.br) { // guarda-corpo e laterais da ponte
          for (const [E, s] of [[L, 1], [Rr, -1]]) {
            const a = E[i], b = E[i + 1], ya = hy(a, i), yb = hy(b, i + 1), [nx, nz] = perp(pts, i);
            const out = [nx * s, 0, nz * s];
            c.quad([a[0], ya - 1.2, a[1]], [b[0], yb - 1.2, b[1]], [b[0], yb + 1.0, b[1]], [a[0], ya + 1.0, a[1]], uv4, C.concrete, 0, out);
            c.quad([a[0], ya - 1.2, a[1]], [b[0], yb - 1.2, b[1]], [b[0], yb + 1.0, b[1]], [a[0], ya + 1.0, a[1]], uv4, C.concrete, 0, out.map(v => -v));
          }
        }
      }
    }
  }

  buildBuildings() {
    const t = this.t;
    let i = 0;
    for (const b of this.world.buildings) {
      if (this.exclusions.length) {
        const cx = b.p.reduce((s2, q) => s2 + q[0], 0) / b.p.length, cz = b.p.reduce((s2, q) => s2 + q[1], 0) / b.p.length;
        if (this.exclusions.some(f => f(cx, cz))) continue;
      }
      const p = b.p.slice();
      if (signedArea(p) > 0) p.reverse();
      let rect = null;
      if (b.rect) {
        const [cx, cz, ux, uz, hu, hv] = b.rect, U = [ux, uz], V = [-uz, ux];
        rect = hu >= hv ? { cx, cz, a: hu, b: hv, ua: U, ub: V } : { cx, cz, a: hv, b: hu, ua: V, ub: U };
      } else rect = asRect(p);
      const k = b.kind || 'house';
      const ind = /industrial|warehouse|shed/.test(k), com = /commercial|retail|office|apartments|school|church/.test(k);
      const roof = !rect ? 'flat' : ind ? 'shed' : com ? 'flat' : rect.a * rect.b * 4 > 520 ? 'flat' : 'gable';
      this.addBuilding(p, b.h, roof, ind ? 'i' : com ? 'c' : k === 'annex' ? 'a' : 'h', rect, i++);
    }
    for (const [x, z, , w, d, r, h, k] of this.world.gen) {
      const c = Math.cos(r), s = Math.sin(r);
      const p = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [x + u * c + v * s, z - u * s + v * c]);
      if (signedArea(p) > 0) p.reverse();
      const ua = [c, -s], ub = [s, c];
      const rect = w >= d ? { cx: x, cz: z, a: w / 2, b: d / 2, ua, ub } : { cx: x, cz: z, a: d / 2, b: w / 2, ua: ub, ub: ua };
      this.addBuilding(p, h, k === 'h' ? 'gable' : k === 'i' ? 'shed' : 'flat', k, rect, i++);
    }
    void t;
  }

  addBuilding(p, h, roof, kind, rect, id) {
    const t = this.t;
    let ymin = Infinity, ymax = -Infinity, cx = 0, cz = 0;
    for (const [x, z] of p) { const y = t.heightAt(x, z); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); cx += x; cz += z; }
    cx /= p.length; cz /= p.length;
    const floor = ymax + 0.15, top = floor + h, base = ymin - 0.6;
    this._top = top + (roof === 'gable' && rect ? rect.b * 0.75 : 0.6);
    const ch = this.chunk(cx, cz);
    const wall = kind === 'i' ? pick(IND_WALLS) : kind === 'c' ? pick(COM_WALLS) : pick(WALLS);
    const lit = kind === 'a' ? 0 : rand() < (kind === 'i' ? 0.15 : 0.6) ? 1 : 0;
    const floors = Math.max(1, Math.round(h / 3.1));
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const out = [-(b[1] - a[1]), 0, b[0] - a[0]];   // polígono com área negativa → normal à esquerda é para fora
      const bays = Math.max(1, Math.round(len / (kind === 'i' ? 6 : 3.5)));
      ch.walls.quad([a[0], floor, a[1]], [b[0], floor, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], [[0, 0], [bays, 0], [bays, floors], [0, floors]], wall, lit, out);
      if (floor - base > 0.05) ch.walls.quad([a[0], base, a[1]], [b[0], base, b[1]], [b[0], floor, b[1]], [a[0], floor, a[1]], [[0, 0.02], [bays, 0.02], [bays, 0.05], [0, 0.05]], wall, 0, out);
    }
    if (roof === 'flat' || !rect) {
      const col = pick(FLAT), y = top + 0.05;
      const tris = THREE.ShapeUtils.triangulateShape(p.map(([x, z]) => new THREE.Vector2(x, z)), []);
      for (const [i, j, k] of tris) ch.roofs.tri([p[i][0], y, p[i][1]], [p[j][0], y, p[j][1]], [p[k][0], y, p[k][1]], [[p[i][0] / 4, p[i][1] / 4], [p[j][0] / 4, p[j][1] / 4], [p[k][0] / 4, p[k][1] / 4]], col, 0, [0, 1, 0]);
      // platibanda
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length], out = [-(b[1] - a[1]), 0, b[0] - a[0]];
        ch.walls.quad([a[0], top, a[1]], [b[0], top, b[1]], [b[0], top + 0.6, b[1]], [a[0], top + 0.6, a[1]], [[0, 0.02], [1, 0.02], [1, 0.05], [0, 0.05]], wall, 0, out);
      }
      return this.addCollider(p, cx, cz, id);
    }
    // telhado de duas águas (ou meia-água nos galpões) sobre o retângulo orientado
    const { a, b, ua, ub } = rect, o = roof === 'shed' ? 0.4 : 0.55, pitch = roof === 'shed' ? 0.18 : 0.75;
    const rh = b * pitch, col = roof === 'shed' ? pick(METAL) : pick(ROOFS);
    const P = (sa, sb, y) => [rect.cx + ua[0] * sa + ub[0] * sb, y, rect.cz + ua[1] * sa + ub[1] * sb];
    const ye = top - o * pitch, yr = top + rh;
    for (const s of [1, -1]) {
      const e1 = P(a + o, s * (b + o), ye), e2 = P(-a - o, s * (b + o), ye), r2 = P(-a - o, 0, yr), r1 = P(a + o, 0, yr);
      const sl = Math.hypot(b + o, rh + o * pitch);
      ch.roofs.quad(e1, e2, r2, r1, [[0, 0], [(2 * a + 2 * o) / 1.2, 0], [(2 * a + 2 * o) / 1.2, sl / 0.4], [0, sl / 0.4]], col, 0, [ub[0] * s, 1, ub[1] * s]);
      // empena (triângulo de parede) nas pontas
      const g1 = P(s * a, b, top), g2 = P(s * a, -b, top), g3 = P(s * a, 0, top + rh);
      ch.walls.tri(g1, g2, g3, [[0.1, 0.02], [0.9, 0.02], [0.5, 0.05]], wall, 0, [ua[0] * s, 0, ua[1] * s]);
    }
    // forro sob o beiral (face de baixo) para não ver o telhado "oco"
    ch.roofs.quad(P(a + o, b + o, ye), P(-a - o, b + o, ye), P(-a - o, -b - o, ye), P(a + o, -b - o, ye), [[0, 0], [1, 0], [1, 1], [0, 1]], col, 0, [0, -1, 0]);
    this.addCollider(p, cx, cz, id);
  }

  addCollider(p, cx, cz, id) {
    let r = 0; for (const [x, z] of p) r = Math.max(r, Math.hypot(x - cx, z - cz));
    const it = { p, cx, cz, r, id, top: this._top };
    const c0 = Math.floor((cx - r) / 50), c1 = Math.floor((cx + r) / 50), d0 = Math.floor((cz - r) / 50), d1 = Math.floor((cz + r) / 50);
    for (let i = c0; i <= c1; i++) for (let j = d0; j <= d1; j++) { const k = i + ',' + j; let a = this.colGrid.get(k); if (!a) this.colGrid.set(k, a = []); a.push(it); }
  }

  /** Altura do topo do prédio no ponto (ou -Infinity). */
  roofAt(x, z) {
    const a = this.colGrid.get(Math.floor(x / 50) + ',' + Math.floor(z / 50));
    if (a) for (const it of a) if (Math.hypot(x - it.cx, z - it.cz) < it.r + 1 && inPoly(x, z, it.p)) return it.top;
    return -Infinity;
  }

  /** Colisão com prédios: ponto (x,z) com raio r. */
  blocked(x, z, r) {
    const a = this.colGrid.get(Math.floor(x / 50) + ',' + Math.floor(z / 50));
    if (!a) return false;
    for (const it of a) {
      if (Math.hypot(x - it.cx, z - it.cz) > it.r + r) continue;
      if (inPoly(x, z, it.p)) return true;
      for (let i = 0; i < it.p.length; i++) { const p0 = it.p[i], p1 = it.p[(i + 1) % it.p.length]; if (segDist(x, z, p0[0], p0[1], p1[0], p1[1]) < r) return true; }
    }
    return false;
  }

  /** Mostra/esconde regiões pela distância da câmera. */
  update(px, pz) {
    for (const c of this.chunks.values()) {
      const d = Math.max(0, Math.hypot(px - c.cx, pz - c.cz) - CHUNK * 0.7);
      for (const m of c.meshes) m.visible = d < (m.userData.kind === 'roads' || m.userData.kind === 'cobble' ? this.roadDist : this.buildDist);
    }
  }

  setNight(n) { this.wallMat.emissiveIntensity = n * 0.95; }
}

/** Marca na máscara as células da grade do terreno dentro do polígono (varredura por linha). */
function rasterize(p, t, mask) {
  let z0 = Infinity, z1 = -Infinity; for (const q of p) { z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
  const j0 = Math.max(0, Math.ceil((z0 - t.z0) / t.cell)), j1 = Math.min(t.nz - 1, Math.floor((z1 - t.z0) / t.cell));
  // arestas por linha da grade
  const rows = Array.from({ length: j1 - j0 + 1 }, () => []);
  for (let i = 0, k = p.length - 1; i < p.length; k = i++) {
    const [ax, az] = p[k], [bx, bz] = p[i]; if (az === bz) continue;
    const lo = Math.max(j0, Math.ceil((Math.min(az, bz) - t.z0) / t.cell)), hi = Math.min(j1, Math.floor((Math.max(az, bz) - t.z0) / t.cell));
    for (let j = lo; j <= hi; j++) { const z = t.z0 + j * t.cell; if (z === Math.max(az, bz)) continue; rows[j - j0].push(ax + (bx - ax) * (z - az) / (bz - az)); }
  }
  rows.forEach((xs, r) => {
    xs.sort((a, b) => a - b); const j = j0 + r;
    for (let q = 0; q + 1 < xs.length; q += 2) {
      const i0 = Math.max(0, Math.ceil((xs[q] - t.x0) / t.cell) - 1), i1 = Math.min(t.nx - 1, Math.floor((xs[q + 1] - t.x0) / t.cell) + 1);
      for (let i = i0; i <= i1; i++) mask[j * t.nx + i] = 1;   // +1 célula de folga nas margens
    }
  });
}

/* ---------- utilidades de polilinha ---------- */
function resample(p, step) {
  const out = [p[0]];
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i], [bx, bz] = p[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  return out;
}
function pathLen(p) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s || 1; }
/** Normal (à esquerda) no vértice i; com miter=true devolve também o fator de esquina. */
function perp(p, i, miter = false) {
  const a = p[Math.max(0, i - 1)], b = p[i], c = p[Math.min(p.length - 1, i + 1)];
  let d1x = b[0] - a[0], d1z = b[1] - a[1], d2x = c[0] - b[0], d2z = c[1] - b[1];
  const l1 = Math.hypot(d1x, d1z) || 1, l2 = Math.hypot(d2x, d2z) || 1;
  d1x /= l1; d1z /= l1; d2x /= l2; d2z /= l2;
  if (i === 0) { d1x = d2x; d1z = d2z; } if (i === p.length - 1) { d2x = d1x; d2z = d1z; }
  let tx = d1x + d2x, tz = d1z + d2z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
  const nx = -tz, nz = tx;
  if (!miter) return [nx, nz];
  const m = Math.min(2, 1 / Math.max(0.5, nx * -d1z + nz * d1x));
  return [nx, nz, m];
}
function signedArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
/** Se o polígono é (quase) um retângulo, devolve o retângulo orientado. */
function asRect(p) {
  if (p.length !== 4) return null;
  const e = i => [p[(i + 1) % 4][0] - p[i][0], p[(i + 1) % 4][1] - p[i][1]];
  const e0 = e(0), e1 = e(1), l0 = Math.hypot(...e0), l1 = Math.hypot(...e1);
  if (Math.abs(e0[0] * e1[0] + e0[1] * e1[1]) / (l0 * l1) > 0.2) return null;
  const cx = p.reduce((s, q) => s + q[0], 0) / 4, cz = p.reduce((s, q) => s + q[1], 0) / 4;
  const u0 = [e0[0] / l0, e0[1] / l0], u1 = [e1[0] / l1, e1[1] / l1];
  return l0 >= l1 ? { cx, cz, a: l0 / 2, b: l1 / 2, ua: u0, ub: u1, area: l0 * l1 } : { cx, cz, a: l1 / 2, b: l0 / 2, ua: u1, ub: u0, area: l0 * l1 };
}

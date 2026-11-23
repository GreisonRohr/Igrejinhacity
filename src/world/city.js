// Cidade em 3D a partir do world.json: rio escavado no terreno, ruas com calçada, pontes e prédios.
// Tudo é mesclado por região (chunks de 400 m) → poucas draw calls; regiões distantes somem.
import * as THREE from 'three';
import { GeoBuilder, litMaterial } from './geo-builder.js';
import { editHeights } from './terrain.js';
import { freeAfterUpload } from './merge.js';

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
  asphalt: new THREE.Color(0x55585c), dirt: new THREE.Color(0xa08660), path: new THREE.Color(0xc2ad86),
  side: new THREE.Color(0xd4d0c8), curb: new THREE.Color(0xdcd8cf), line: new THREE.Color(0xf0f0ea), yellow: new THREE.Color(0xf2d24b),
  concrete: new THREE.Color(0xb9b6ae), plain: new THREE.Color(0xffffff), pool: new THREE.Color(0x7fd6ff),
  pedra: new THREE.Color(0x8a8378), metal: new THREE.Color(0x9aa0a6), concreteDark: new THREE.Color(0x8f8c85), bloco: new THREE.Color(0xa29d94), median: new THREE.Color(0x6f9e4c),
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

const noiseTex = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
/** Asfalto: grão fino, manchas de desgaste e remendos (multiplica a cor do vértice). */
function asphaltTexture() {
  return noiseTex(256, (g, S) => {
    const im = g.createImageData(S, S); let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < S * S; i++) { const v = 205 + r() * 50 - (r() < 0.04 ? 60 : 0); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.06})`; g.beginPath(); g.ellipse(r() * S, r() * S, 10 + r() * 40, 6 + r() * 25, r() * 3, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y); for (let j = 0; j < 6; j++) { x += (r() - 0.5) * 30; y += (r() - 0.3) * 20; g.lineTo(x, y); } g.stroke(); }
  });
}
/** Calçada de lajotas/blocos de concreto (1,2 m por repetição). */
function paverTexture() {
  return noiseTex(128, (g, S) => {
    let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = '#8f8a82'; g.fillRect(0, 0, S, S);
    const q = S / 3;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { const v = 228 + r() * 22; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(x * q + 1.5, y * q + 1.5, q - 3, q - 3); }
  });
}
function concreteTexture() {
  return noiseTex(128, (g, S) => {
    const im = g.createImageData(S, S); let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < S * S; i++) { const v = 222 + r() * 33; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, S - 3, S, 3);
  });
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
    this.buildDist = buildDist; this.roadDist = roadDist; this.detailDist = Math.min(400, roadDist * 0.5);
    this.group = new THREE.Group();
    this.chunks = new Map();
    this.colGrid = new Map();
    const tex = windowTextures();
    this.wallMat = litMaterial({ vertexColors: true, map: tex.map, emissive: 0xffffff, emissiveMap: tex.emissive, emissiveIntensity: 0 });
    this.roofMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: roofTexture() });
    this.roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: asphaltTexture(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.walkMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: paverTexture(), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    this.markMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    this.bridgeMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: concreteTexture() });
    this.cobbleMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: cobbleTexture(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.waterMat = new THREE.MeshPhongMaterial({ vertexColors: true, color: 0x3f7fb0, specular: 0x9fc6e8, shininess: 60, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  }

  chunk(x, z) {
    const k = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
    let c = this.chunks.get(k);
    if (!c) this.chunks.set(k, c = { walls: new GeoBuilder(), roofs: new GeoBuilder(), roads: new GeoBuilder(), cobble: new GeoBuilder(), walk: new GeoBuilder(), marks: new GeoBuilder(), bridge: new GeoBuilder(), cx: (Math.floor(x / CHUNK) + 0.5) * CHUNK, cz: (Math.floor(z / CHUNK) + 0.5) * CHUNK, meshes: [] });
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
    // cabeceiras de ponte: o terreno ali não é escavado (a rua chega no nível do tabuleiro)
    this.bridgeEnds = [];
    for (const r of this.world.roads) if (r.br) this.bridgeEnds.push(r.p[0], r.p[r.p.length - 1]);
    // bueiros: onde um arroio cruza uma rua comum (sem ponte), a rua passa por cima e o terreno não é escavado
    this.culverts = [];
    const segX = (a, b, c, d) => { const r = [b[0] - a[0], b[1] - a[1]], s2 = [d[0] - c[0], d[1] - c[1]], den = r[0] * s2[1] - r[1] * s2[0]; if (Math.abs(den) < 1e-9) return null; const t = ((c[0] - a[0]) * s2[1] - (c[1] - a[1]) * s2[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + r[0] * t, a[1] + r[1] * t] : null; };
    const box = p => { let a = Infinity, b2 = Infinity, c = -Infinity, d = -Infinity; for (const q of p) { a = Math.min(a, q[0]); b2 = Math.min(b2, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); } return [a, b2, c, d]; };
    const hit = (A, B) => A[0] <= B[2] && B[0] <= A[2] && A[1] <= B[3] && B[1] <= A[3];
    const cRoads = this.world.roads.filter(r => !r.br && (URBAN.has(r.k) || r.k === 'unclassified' || r.k === 'service')).map(r => ({ r, bb: box(r.p) }));
    for (const w of this.world.water) {
      if (w.k !== 'stream' && w.k !== 'ditch' && w.k !== 'drain') continue;
      const wb = box(w.p);
      for (const { r, bb } of cRoads) {
        if (!hit(wb, bb)) continue;
        for (let i = 0; i < w.p.length - 1; i++) {
          const sb = box([w.p[i], w.p[i + 1]]); if (!hit(sb, bb)) continue;
          for (let j = 0; j < r.p.length - 1; j++) {
          const q = segX(w.p[i], w.p[i + 1], r.p[j], r.p[j + 1]); if (!q) continue;
          const sw = r.sw ? Math.max(r.sw[0], r.sw[1]) : (URBAN.has(r.k) ? 2.2 : 0.5);
          const L = Math.hypot(r.p[j + 1][0] - r.p[j][0], r.p[j + 1][1] - r.p[j][1]) || 1;
          const sL = Math.hypot(w.p[i + 1][0] - w.p[i][0], w.p[i + 1][1] - w.p[i][1]) || 1;
          this.culverts.push({ x: q[0], z: q[1], r: r.w / 2 + sw + 0.6, half: w.w / 2, rd: [(r.p[j + 1][0] - r.p[j][0]) / L, (r.p[j + 1][1] - r.p[j][1]) / L], sd: [(w.p[i + 1][0] - w.p[i][0]) / sL, (w.p[i + 1][1] - w.p[i][1]) / sL], road: r.n });
          }
        }
      }
    }
    const cg = new Map(), CG = 32;   // grade dos bueiros e cabeceiras (consulta por célula, não lista inteira)
    for (const c of this.culverts) for (let i = Math.floor((c.x - 24) / CG); i <= Math.floor((c.x + 24) / CG); i++) for (let j = Math.floor((c.z - 24) / CG); j <= Math.floor((c.z + 24) / CG); j++) { const k = i + ',' + j; (cg.get(k) || cg.set(k, []).get(k)).push(c); }
    const bg = new Map();
    for (const e of this.bridgeEnds) for (let i = Math.floor((e[0] - 16) / CG); i <= Math.floor((e[0] + 16) / CG); i++) for (let j = Math.floor((e[1] - 16) / CG); j <= Math.floor((e[1] + 16) / CG); j++) { const k = i + ',' + j; (bg.get(k) || bg.set(k, []).get(k)).push(e); }
    const keep = (x, z) => {
      let m = 1; const key = Math.floor(x / CG) + ',' + Math.floor(z / CG);
      for (const e of bg.get(key) || []) { const d = Math.hypot(x - e[0], z - e[1]); if (d < 16) m = Math.min(m, smooth(5, 16, d)); }
      for (const c of cg.get(key) || []) {
        // distância ao longo do arroio até o eixo da rua: dentro da largura da rua (+calçada) não escava
        const dx = x - c.x, dz = z - c.z, across = Math.abs(dx * c.sd[1] - dz * c.sd[0]);   // afastamento do eixo do arroio
        if (across > 12) continue;
        const proj = Math.abs(dx * -c.rd[1] + dz * c.rd[0]);                                  // distância perpendicular à rua
        m = Math.min(m, smooth(c.r, c.r + 1.5, proj));
      }
      return m;
    };
    this.keep = keep;
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
      // valão de paredes retas (arroio canalizado na praça): escavação larga e plana; paredes vêm do praca.js
      const val = pts.map(([x, z]) => !big && (this.valaoZones || []).some(v => Math.hypot(x - v.x, z - v.z) < v.r));
      this.waterLines.push({ pts, ys, half, big, val });
      const depth = big ? 2.2 : 0.8, bank = big ? 7 : 3;
      for (let i = 0; i < pts.length - 1; i++) {
        if (masked((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2)) continue;   // trecho coberto pelo polígono
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], R = (val[i] || val[i + 1]) ? half + 6 : half + bank;
        editHeights(t, Math.min(ax, bx) - R, Math.min(az, bz) - R, Math.max(ax, bx) + R, Math.max(az, bz) + R, (x, z, h) => {
          const d = segDist(x, z, ax, az, bx, bz);
          if (d > R) return h;
          const V = val[i] || val[i + 1];
          const target = Math.min(ys[i], ys[i + 1]) - (V ? 1.9 : depth);
          const carved = Math.min(h, target + (h - target) * (V ? smooth(half + 3.5, half + 5.5, d) : smooth(half - 1, R, d)));
          return h + (carved - h) * keep(x, z);
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
      if (lv !== null) { const c = Math.min(t.h[k], lv - 2.2); t.h[k] += (c - t.h[k]) * keep(x, z); }
    }
  }

  /** Nível da água: o MENOR nível da linha central do rio num raio de 45 m (evita água "subindo" nas curvas). */
  levelAt(x, z) {
    let best = null, nearest = null, nd = Infinity;
    const ci = Math.floor(x / 50), cj = Math.floor(z / 50);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++)
      for (const q of this.levelGrid.get((ci + a) + ',' + (cj + b)) || []) {
        const d = Math.hypot(q[0] - x, q[1] - z);
        if (d < nd) { nd = d; nearest = q[2]; }
        if (d < 45 && (best === null || q[2] < best)) best = q[2];
      }
    return best ?? nearest ?? (this.orig(x, z) - 0.5);
  }

  /* ---------- 2. tudo o mais (depois que o terreno está pronto) ---------- */
  /** Monta tudo, cedendo a thread entre etapas (tick(fração) é chamado e aguardado). */
  async build(tick = async () => {}) {
    this.buildWater();
    await tick(0.1);
    this.buildRoads();
    await tick(0.3);
    await this.buildBuildings(f => tick(0.3 + f * 0.6));
    this.buildLamps();
    await tick(0.95);
    for (const c of this.chunks.values()) {
      for (const [key, mat, shadow] of [['walls', this.wallMat, true], ['roofs', this.roofMat, true], ['roads', this.roadMat, false], ['cobble', this.cobbleMat, false], ['walk', this.walkMat, false], ['marks', this.markMat, false], ['bridge', this.bridgeMat, true]]) {
        const g = c[key].build(); c[key] = null;
        if (!g) continue;
        freeAfterUpload(g);
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
    for (const { pts, ys: ys0, half, val } of this.waterLines) {
      // valão: lâmina d'água rasa no fundo do canal (o leito de cascalho fica 10 cm abaixo)
      const ys = ys0.map((y, i) => (val && val[i] ? y - 1.5 : y));
      for (let i = 0; i < pts.length - 1; i++) {
        if (this.masked((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2)) continue;
        const V = val && (val[i] || val[i + 1]);
        if (V) continue;   // valão: a água é desenhada junto com o leito (praca.js)
        const [n0x, n0z] = perp(pts, i), [n1x, n1z] = perp(pts, i + 1), w0 = V ? half * 0.6 : half + 1.5, w1 = w0;
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
    const t = this.t, up = [0, 1, 0];
    this.lampPos = [];
    const lampGrid = new Set(), lampKey = (x, z) => Math.round(x / 10) + ',' + Math.round(z / 10);
    const addLamp = (x, z, y, yaw) => { const k = lampKey(x, z); if (lampGrid.has(k)) return; lampGrid.add(k); this.lampPos.push([x, y, z, yaw]); };
    const crossings = this.findCrossings();
    this.zebras = [];                                  // faixas de pedestre (para decoração: casinhas da avenida)
    const duals = this.world.roads.filter(q => q.ow && q.med && !q.br);
    // distância do ponto até a outra pista da mesma avenida (largura real do canteiro)
    const otherDist = (r, x, z) => { let best = Infinity; for (const q of duals) { if (q === r || q.n !== r.n) continue; for (let i = 0; i < q.p.length - 1; i++) { const a = q.p[i], b = q.p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); best = Math.min(best, Math.hypot(x - a[0] - dx * u, z - a[1] - dz * u)); } } return best; };
    for (const r of this.world.roads) {
      const pts = resample(r.p, 4), n = pts.length;
      const unpaved = r.pav === 'terra' || (!r.pav && (r.k === 'track' || ['unpaved', 'gravel', 'dirt', 'ground', 'compacted'].includes(r.sf)));
      const cobble = r.pav === 'pedra' || r.pav === 'bloco';
      const foot = r.k === 'path' || r.k === 'footway' || r.k === 'steps' || r.k === 'cycleway';
      const surf = foot ? C.path : unpaved ? C.dirt : r.pav === 'pedra' ? C.pedra : r.pav === 'bloco' ? C.bloco : C.asphalt;
      const asphalt = !foot && !unpaved && !cobble;
      const urban = URBAN.has(r.k) && !unpaved;
      // pista dupla só se a pista irmã (mesmo nome, mão única com canteiro) estiver ao lado; senão desenha a rua inteira
      const dual = r.ow && r.med && !r.br && this._hasTwin(r);
      const width = dual ? Math.max(3.5, (r.w - r.med) / 2) : r.w;
      const half = width / 2;
      const swAvg = r.sw ? (r.sw[0] + r.sw[1]) / 2 : (urban ? 2.2 : 0);
      const side = r.br ? (urban ? 1.5 : 0.4) : swAvg;
      const sideL = side, sideR = dual && !r.br ? 0 : side;   // pista dupla (sentido do OSM = sentido do trânsito): canteiro à esquerda (−), calçada à direita (+)
      // ponte: pista reta entre as cabeceiras (altura original, antes de escavar o rio)
      let Y = null;
      if (r.br) {
        const h0 = t.heightAt(...pts[0]) + 0.08, h1 = t.heightAt(...pts[n - 1]) + 0.08, L = pathLen(pts);
        const arch = Math.min(0.8, L * 0.015);
        let acc = 0; Y = pts.map((p, i) => { if (i) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); const f = acc / L; return h0 + (h1 - h0) * f + arch * Math.sin(Math.PI * f); });
      }
      const hy = (p, i) => (Y ? Y[i] : t.heightAt(p[0], p[1]) + 0.08);
      const NRM = pts.map((_, i) => perp(pts, i, true));
      const off = (i, o) => { const [nx, nz, m] = NRM[i]; return [pts[i][0] + nx * o * m, pts[i][1] + nz * o * m]; };
      const wuv = (q, s) => [q[0] / s, q[1] / s];
      const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      // tira contínua entre deslocamentos o0 e o1 (o > 0 = esquerda), altura dy, no construtor B
      const strip = (B, o0, o1, dy, col, uvs = 4, filt = null) => {
        for (let i = 0; i < n - 1; i++) {
          if (filt && !filt(cum[i], cum[i + 1])) continue;
          const a0 = off(i, o0), a1 = off(i + 1, o0), b1 = off(i + 1, o1), b0 = off(i, o1);
          B.quad([a0[0], hy(a0, i) + dy, a0[1]], [a1[0], hy(a1, i + 1) + dy, a1[1]], [b1[0], hy(b1, i + 1) + dy, b1[1]], [b0[0], hy(b0, i) + dy, b0[1]],
            [wuv(a0, uvs), wuv(a1, uvs), wuv(b1, uvs), wuv(b0, uvs)], col, 0, up);
        }
      };
      const wall = (B, o, y0, y1, col, outSign) => {
        for (let i = 0; i < n - 1; i++) {
          const a = off(i, o), b = off(i + 1, o), [nx, nz] = NRM[i];
          B.quad([a[0], hy(a, i) + y0, a[1]], [b[0], hy(b, i + 1) + y0, b[1]], [b[0], hy(b, i + 1) + y1, b[1]], [a[0], hy(a, i) + y1, a[1]],
            [[cum[i] / 2, y0], [cum[i + 1] / 2, y0], [cum[i + 1] / 2, y1], [cum[i] / 2, y1]], col, 0, [nx * outSign, 0, nz * outSign]);
        }
      };
      // os pedaços vão para o chunk do ponto médio da via inteira (vias longas: por trecho)
      const pieces = [];
      for (let i0 = 0; i0 < n - 1; i0 += 40) pieces.push([i0, Math.min(n - 1, i0 + 40)]);
      for (const [i0, i1] of pieces) {
        const mid = pts[(i0 + i1) >> 1], ch = this.chunk(mid[0], mid[1]);
        const range = (s0) => s0 >= cum[i0] - 1e-6 && s0 < cum[i1] - 1e-6;
        const F = (f) => (a, b2) => range(a) && (!f || f(a, b2));
        // pista
        strip(cobble ? ch.cobble : ch.roads, half, -half, 0, surf, cobble ? 2.5 : 4, F());
        // calçadas (lajota) + meio-fio de concreto
        const curbH = 0.15;
        if (sideL) { strip(ch.walk, half + sideL, half, curbH, C.side, 1.2, F()); }
        if (sideR) { strip(ch.walk, -half, -half - sideR, curbH, C.side, 1.2, F()); }
        if (sideL || r.br) for (let i = i0; i < i1; i++) { const a = off(i, half), b = off(i + 1, half), [nx, nz] = NRM[i];
          ch.roads.quad([a[0], hy(a, i), a[1]], [b[0], hy(b, i + 1), b[1]], [b[0], hy(b, i + 1) + curbH, b[1]], [a[0], hy(a, i) + curbH, a[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], C.curb, 0, [-nx, 0, -nz]); }
        if (sideR) for (let i = i0; i < i1; i++) { const a = off(i, -half), b = off(i + 1, -half), [nx, nz] = NRM[i];
          ch.roads.quad([a[0], hy(a, i), a[1]], [b[0], hy(b, i + 1), b[1]], [b[0], hy(b, i + 1) + curbH, b[1]], [a[0], hy(a, i) + curbH, a[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], C.curb, 0, [nx, 0, nz]); }
        // canteiro central (pista única com canteiro)
        // exceções conferidas em foto: o cadastro marca canteiro onde hoje é só asfalto
        const noMedian = /Jo.o Corr/.test(r.n || '') && Math.min(...r.p.map(q => Math.hypot(q[0], q[1] - 47))) < 60;
        if (r.med && !dual && !noMedian) { strip(ch.roads, r.med / 2, -r.med / 2, 0.2, C.median, 4, F()); }
        // pista dupla: canteiro gramado até o meio do vão entre as pistas, meio-fio pintado de amarelo
        if (dual && !r.br && !foot) {
          const G = []; for (let i = i0; i <= i1; i++) { const d = otherDist(r, pts[i][0], pts[i][1]); G.push(d === Infinity ? 0 : Math.max(0, Math.min(r.med / 2 + 1, (d - 2 * half) / 2))); }
          for (let i = i0; i < i1; i++) {
            const g0 = G[i - i0], g1 = G[i + 1 - i0]; if (g0 < 0.4 || g1 < 0.4) continue;
            const a0 = off(i, -half), a1 = off(i + 1, -half), b0 = off(i, -half - g0), b1 = off(i + 1, -half - g1), [nx, nz] = NRM[i];
            ch.roads.quad([a0[0], hy(a0, i) + 0.15, a0[1]], [a1[0], hy(a1, i + 1) + 0.15, a1[1]], [b1[0], hy(b1, i + 1) + 0.15, b1[1]], [b0[0], hy(b0, i) + 0.15, b0[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], C.median, 0, up);
            ch.roads.quad([a0[0], hy(a0, i), a0[1]], [a1[0], hy(a1, i + 1), a1[1]], [a1[0], hy(a1, i + 1) + 0.15, a1[1]], [a0[0], hy(a0, i) + 0.15, a0[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], C.yellow, 0, [nx, 0, nz]);
          }
        }
        // sinalização horizontal (padrão brasileiro: amarelo separa sentidos, branco separa faixas/bordas)
        if (asphalt && !foot && width >= 5.5) {
          const M = ch.marks, lw = 0.12, dash = (a) => Math.floor(a / 4) % 2 === 0;
          const twoWay = !r.ow;
          if (twoWay) {
            if (r.main || r.k === 'primary' || r.k === 'secondary') { strip(M, 0.2, 0.2 - lw, 0.03, C.yellow, 4, F()); strip(M, -0.2 + lw, -0.2, 0.03, C.yellow, 4, F()); }
            else strip(M, lw / 2, -lw / 2, 0.03, C.yellow, 4, F(dash));
          } else if (width >= 6.5) strip(M, lw / 2, -lw / 2, 0.03, C.line, 4, F(dash));
          if (MARKED.has(r.k) || r.br) { strip(M, half - 0.3, half - 0.3 - lw, 0.03, C.line, 4, F()); strip(M, -half + 0.3 + lw, -half + 0.3, 0.03, C.line, 4, F()); }
        }
      }
      // faixas de pedestre perto dos cruzamentos (zebrado)
      if ((asphalt || cobble) && urban && !r.br) for (const ci of crossings.get(r) || []) {
        for (const dir of [1, -1]) {
          if ((ci === 0 && dir < 0) || (ci === n - 1 && dir > 0)) continue;
          const s0 = cum[Math.min(n - 1, Math.max(0, ci))] + dir * 7;
          if (s0 < 3 || s0 > cum[n - 1] - 3) continue;
          let k = 0; while (k < n - 2 && cum[k + 1] < s0) k++;
          const f = (s0 - cum[k]) / Math.max(1e-6, cum[k + 1] - cum[k]);
          const cx = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, cz = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f;
          const L = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]) || 1, ux = (pts[k + 1][0] - pts[k][0]) / L, uz = (pts[k + 1][1] - pts[k][1]) / L;
          const ch = this.chunk(cx, cz), y = t.heightAt(cx, cz) + 0.115;
          this.zebras.push({ x: cx, z: cz, ux, uz, half, name: r.n, dual, med: r.med || 0 });
          for (let o = -half + 0.5; o <= half - 0.4; o += 0.9) {
            const px = cx - uz * o, pz = cz + ux * o;
            const P = (a, b) => [px + ux * a - uz * b, y, pz + uz * a + ux * b];
            ch.marks.quad(P(-1.5, -0.22), P(1.5, -0.22), P(1.5, 0.22), P(-1.5, 0.22), [[0, 0], [1, 0], [1, 1], [0, 1]], C.line, 0, up);
          }
        }
      }
      // postes de iluminação nas vias urbanas do centro e nas pontes
      const nearTown = Math.hypot(pts[0][0], pts[0][1]) < 2600 || Math.hypot(pts[n - 1][0], pts[n - 1][1]) < 2600;
      if ((urban && nearTown && !foot) || r.br) {
        const step = r.br ? 18 : 30;
        for (let s0 = 8, j = 0; s0 < cum[n - 1] - 4; s0 += step, j++) {
          let k = 0; while (k < n - 2 && cum[k + 1] < s0) k++;
          const sgn = r.br ? (j % 2 ? 1 : -1) : (j % 2 ? 1 : -1);
          const o = sgn * (half + Math.max(0.5, Math.min(side, 2.5) - 0.4));
          const q = off(k, o), [nx, nz] = NRM[k];
          addLamp(q[0], q[1], hy(q, k) + (side ? 0.15 : 0), Math.atan2(-nx * sgn, -nz * sgn));
          if (r.br) { const q2 = off(k, -o); addLamp(q2[0], q2[1], hy(q2, k) + 0.15, Math.atan2(nx * sgn, nz * sgn)); }
        }
      }
      if (r.br) this.buildBridge(r, pts, NRM, cum, hy, half, side, off, wall);
    }
  }

  /** Ponte: laje com espessura, calçadas, guarda-corpo metálico com montantes e pilares até o leito. */
  buildBridge(r, pts, NRM, cum, hy, half, side, off, wall) {
    const t = this.t, n = pts.length, W = half + side;
    const mid = pts[n >> 1], ch = this.chunk(mid[0], mid[1]);
    const B = ch.bridge, deck = 0.9;
    // tabuleiro caminhável (para o jogador e, depois, os carros)
    this.decks ??= new Map();
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i], b = pts[i + 1], seg = { a, b, ya: hy(a, i), yb: hy(b, i + 1), W };
      for (const q of [a, b]) { const k = Math.floor(q[0] / 50) + ',' + Math.floor(q[1] / 50); (this.decks.get(k) || this.decks.set(k, []).get(k)).push(seg); }
    }
    // faces laterais da laje e fundo
    wall(B, W, -deck, 0.18, C.concrete, 1);
    wall(B, -W, -deck, 0.18, C.concrete, -1);
    for (let i = 0; i < n - 1; i++) {
      const a0 = off(i, W), a1 = off(i + 1, W), b1 = off(i + 1, -W), b0 = off(i, -W);
      B.quad([a0[0], hy(a0, i) - deck, a0[1]], [a1[0], hy(a1, i + 1) - deck, a1[1]], [b1[0], hy(b1, i + 1) - deck, b1[1]], [b0[0], hy(b0, i) - deck, b0[1]],
        [[0, 0], [1, 0], [1, 1], [0, 1]], C.concreteDark, 0, [0, -1, 0]);
    }
    // guarda-corpo: montantes a cada 2 m e dois corrimãos
    for (const s of [1, -1]) {
      const o = s * (W - 0.12);
      for (let s0 = 0; s0 <= cum[n - 1]; s0 += 2) {
        let k = 0; while (k < n - 2 && cum[k + 1] < s0) k++;
        const f = (s0 - cum[k]) / Math.max(1e-6, cum[k + 1] - cum[k]);
        const a = off(k, o), b = off(k + 1, o), x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f, y = hy(a, k) + (hy(b, k + 1) - hy(a, k)) * f + 0.18;
        const [nx, nz] = NRM[k];
        B.box(x, y, z, 0.08, 1.05, 0.08, nz, -nx, C.metal);
      }
      for (const yy of [1.05, 0.55]) for (let i = 0; i < n - 1; i++) {
        const a = off(i, o), b = off(i + 1, o), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
        const ya = hy(a, i), yb = hy(b, i + 1);
        B.box((a[0] + b[0]) / 2, (ya + yb) / 2 + 0.18 + yy - 0.03, (a[1] + b[1]) / 2, L + 0.02, 0.06, 0.06, ux, uz, C.metal);
      }
    }
    // pilares onde o vão é alto
    for (let s0 = 10; s0 < cum[n - 1] - 6; s0 += 14) {
      let k = 0; while (k < n - 2 && cum[k + 1] < s0) k++;
      const p = pts[k], y = hy(p, k) - deck, g = t.heightAt(p[0], p[1]);
      if (y - g < 1.5) continue;
      const [nx, nz] = NRM[k], ux = nz, uz = -nx;
      for (const o of [-half * 0.55, half * 0.55]) {
        const q = off(k, o);
        B.box(q[0], g - 1.5, q[1], 0.9, y - g + 1.5, 0.9, ux, uz, C.concreteDark);
      }
      B.box(p[0], y - 0.6, p[1], 1.0, 0.6, W * 2 - 0.4, ux, uz, C.concreteDark);
    }
  }

  /** Altura do tabuleiro de ponte em (x, z), ou null se não há ponte ali. */
  deckAt(x, z) {
    const list = this.decks?.get(Math.floor(x / 50) + ',' + Math.floor(z / 50)); if (!list) return null;
    let best = null;
    for (const s of list) {
      const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], l2 = dx * dx + dz * dz || 1;
      const t = ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / l2; if (t < -0.05 || t > 1.05) continue;
      const tt = Math.max(0, Math.min(1, t)), d = Math.hypot(x - s.a[0] - dx * tt, z - s.a[1] - dz * tt);
      if (d < s.W - 0.15) { const y = s.ya + (s.yb - s.ya) * tt + (d > s.W - 1.6 ? 0.18 : 0); if (best === null || y > best) best = y; }
    }
    return best;
  }

  /** Vértices compartilhados por 3+ trechos de via (cruzamentos), por via → índices (na via reamostrada). */
  findCrossings() {
    const deg = new Map(), key = q => Math.round(q[0] * 2) + ',' + Math.round(q[1] * 2);
    const DRIVE = new Set([...URBAN, 'unclassified', 'service']);
    for (const r of this.world.roads) if (DRIVE.has(r.k)) r.p.forEach((q, i) => { deg.set(key(q), (deg.get(key(q)) || 0) + (i === 0 || i === r.p.length - 1 ? 1 : 2)); });
    const out = new Map();
    for (const r of this.world.roads) {
      if (!URBAN.has(r.k)) continue;
      const rs = resample(r.p, 4), idx = [];
      for (const q of r.p) if ((deg.get(key(q)) || 0) >= 3 && Math.hypot(q[0], q[1]) < 2200) {
        let bi = 0, bd = Infinity; rs.forEach((p, i) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; bi = i; } }); idx.push(bi);
      }
      if (idx.length) out.set(r, idx);
    }
    return out;
  }

  /** Postes: três malhas instanciadas (poste, braço, luminária). */
  buildLamps() {
    const N = this.lampPos.length; if (!N) return;
    const pole = new THREE.CylinderGeometry(0.07, 0.11, 8, 6).translate(0, 4, 0);
    const arm = new THREE.BoxGeometry(0.08, 0.08, 1.6).translate(0, 7.9, 0.75);
    const head = new THREE.BoxGeometry(0.32, 0.12, 0.6).translate(0, 7.85, 1.55);
    const mPole = new THREE.MeshLambertMaterial({ color: 0x8d9196 });
    this.lampMat = new THREE.MeshLambertMaterial({ color: 0xf4f1e6, emissive: 0xffd9a0, emissiveIntensity: 0 });
    const d = new THREE.Object3D();
    for (const [geo, mat] of [[pole, mPole], [arm, mPole], [head, this.lampMat]]) {
      const im = new THREE.InstancedMesh(geo, mat, N);
      this.lampPos.forEach(([x, y, z, yaw], i) => { d.position.set(x, y, z); d.rotation.set(0, yaw, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
      im.castShadow = geo === pole; this.group.add(im);
    }
    // mancha de luz no chão sob cada poste (aditiva, só à noite): ilusão barata de luz real
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.45, 'rgba(255,190,120,.45)'); gr.addColorStop(1, 'rgba(255,170,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const pt = new THREE.CanvasTexture(c); pt.colorSpace = THREE.SRGBColorSpace;
    this.poolMat = new THREE.MeshBasicMaterial({ map: pt, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16, fog: true });
    const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), this.poolMat, N);
    this.lampPos.forEach(([x, y, z, yaw], i) => { d.position.set(x + Math.sin(yaw) * 1.5, this.t.heightAt(x + Math.sin(yaw) * 1.5, z + Math.cos(yaw) * 1.5) + 0.2, z + Math.cos(yaw) * 1.5); d.rotation.set(0, 0, 0); d.updateMatrix(); pool.setMatrixAt(i, d.matrix); });
    pool.renderOrder = 3; this.pools = pool; this.group.add(pool);
  }

  async buildBuildings(tick = null) {
    const t = this.t;
    let i = 0, n = 0;
    let wi = -1;
    for (const b of this.world.buildings) {
      wi++;
      if (tick && ++n % 2500 === 0) await tick(n / this.world.buildings.length);
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
      let roof = !rect ? 'flat' : ind ? 'shed' : com ? 'flat' : rect.a * rect.b * 4 > 520 ? 'flat' : 'gable';
      // formato lido na imagem aérea (scripts/build-roofshape.py): 1 laje, 2 duas águas, 3 quatro águas
      const rs = rect && this.roofShapes ? this.roofShapes[wi] : 0;
      if (rs === 1) roof = 'flat'; else if (rs === 2 && !ind) roof = 'gable'; else if (rs === 3 && !ind) roof = 'hip';
      this._roofReal = this.roofColors && this.roofColors[wi] >= 0 ? this.roofColors[wi] : -1;   // cor da foto aérea
      this.addBuilding(p, b.h, roof, ind ? 'i' : com ? 'c' : k === 'annex' ? 'a' : 'h', rect, i++);
      this._roofReal = -1;
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

  _hasTwin(r) {
    const m = r.p[r.p.length >> 1];
    for (const q of this.world.roads) {
      if (q === r || !q.ow || !q.med || q.n !== r.n) continue;
      for (let i = 0; i < q.p.length - 1; i++) { if (segDist(m[0], m[1], q.p[i][0], q.p[i][1], q.p[i + 1][0], q.p[i + 1][1]) < r.w * 1.2) return true; }
    }
    return false;
  }

  /** Cor real do telhado (foto aérea 2016), com leve ganho: a foto vem mais escura que a luz do jogo. */
  _realRoof() {
    if (!(this._roofReal >= 0)) return null;
    const c = this._rc || (this._rc = new THREE.Color());
    c.setHex(this._roofReal).multiplyScalar(1.3);   // setHex já converte de sRGB
    // a foto puxa para o magenta nos cinzas: telhados que não são de telha vermelha ficam neutros
    const r = this._roofReal >> 16 & 255, g = this._roofReal >> 8 & 255;
    if (r - g < 28) { const l = (c.r + c.g + c.b) / 3; c.r += (l - c.r) * 0.75; c.g += (l - c.g) * 0.75; c.b += (l - c.b) * 0.75; }
    return c;
  }

  addBuilding(p, h, roof, kind, rect, id) {
    const t = this.t;
    let ymin = Infinity, ymax = -Infinity, cx = 0, cz = 0;
    for (const [x, z] of p) { const y = t.heightAt(x, z); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); cx += x; cz += z; }
    cx /= p.length; cz /= p.length;
    const floor = ymax + 0.15, top = floor + h, base = ymin - 0.6;
    this._top = top + (roof === 'gable' && rect ? rect.b * 0.75 : roof === 'hip' && rect ? rect.b * 0.55 : 0.6);
    const ch = this.chunk(cx, cz);
    const wall = kind === 'i' ? pick(IND_WALLS) : kind === 'c' ? pick(COM_WALLS) : pick(WALLS);
    const lit = kind === 'a' ? 0 : rand() < (kind === 'i' ? 0.15 : 0.6) ? 1 : 0;
    const floors = Math.max(1, Math.round(h / 3.1));
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const out = [-(b[1] - a[1]), 0, b[0] - a[0]];   // polígono com área negativa → normal à esquerda é para fora
      const bays = Math.max(1, Math.round(len / (kind === 'i' ? 6 : 3.5)));
      if (kind === 'i' && h > 5) {
        // pavilhão: parede lisa (faixa sem janela da textura) e uma fileira de janelas altas no topo
        const ys = top - 2.4;
        ch.walls.quad([a[0], floor, a[1]], [b[0], floor, b[1]], [b[0], ys, b[1]], [a[0], ys, a[1]], [[0, 0.08], [bays, 0.08], [bays, 0.24], [0, 0.24]], wall, 0, out);
        ch.walls.quad([a[0], ys, a[1]], [b[0], ys, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], [[0, 0.1], [bays, 0.1], [bays, 0.95], [0, 0.95]], wall, lit, out);
      } else ch.walls.quad([a[0], floor, a[1]], [b[0], floor, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], [[0, 0], [bays, 0], [bays, floors], [0, floors]], wall, lit, out);
      if (floor - base > 0.05) ch.walls.quad([a[0], base, a[1]], [b[0], base, b[1]], [b[0], floor, b[1]], [a[0], floor, a[1]], [[0, 0.02], [bays, 0.02], [bays, 0.05], [0, 0.05]], wall, 0, out);
    }
    if (roof === 'flat' || !rect) {
      const col = this._realRoof() || pick(FLAT), y = top + 0.05;
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
    const { a, b, ua, ub } = rect, o = roof === 'shed' ? 0.4 : 0.55, pitch = roof === 'shed' ? 0.18 : roof === 'hip' ? 0.55 : 0.75;
    const rh = b * pitch, col = this._realRoof() || (roof === 'shed' ? pick(METAL) : pick(ROOFS));
    const P = (sa, sb, y) => [rect.cx + ua[0] * sa + ub[0] * sb, y, rect.cz + ua[1] * sa + ub[1] * sb];
    const ye = top - o * pitch, yr = top + rh;
    if (roof === 'hip') {
      // quatro águas: cumeeira encurtada (recua b nas pontas), 2 trapézios + 2 triângulos
      const ra = Math.max(0, a - b);
      for (const s of [1, -1]) {
        const e1 = P(a + o, s * (b + o), ye), e2 = P(-a - o, s * (b + o), ye), r2 = P(-ra, 0, yr), r1 = P(ra, 0, yr);
        ch.roofs.quad(e1, e2, r2, r1, [[0, 0], [(2 * a + 2 * o) / 1.2, 0], [(2 * ra) / 1.2, (b + o) / 0.4], [0, (b + o) / 0.4]], col, 0, [ub[0] * s, 1, ub[1] * s]);
        ch.roofs.tri(P(s * (a + o), -(b + o), ye), P(s * (a + o), b + o, ye), P(s * ra, 0, yr), [[0, 0], [(2 * b + 2 * o) / 1.2, 0], [(b + o) / 1.2, (b + o) / 0.4]], col, 0, [ua[0] * s, 1, ua[1] * s]);
      }
      ch.roofs.quad(P(a + o, b + o, ye), P(-a - o, b + o, ye), P(-a - o, -b - o, ye), P(a + o, -b - o, ye), [[0, 0], [1, 0], [1, 1], [0, 1]], col, 0, [0, -1, 0]);
      return this.addCollider(p, cx, cz, id);
    }
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
      for (const m of c.meshes) {
        const k = m.userData.kind;
        m.visible = d < (k === 'marks' || k === 'walk' ? this.detailDist : k === 'roads' || k === 'cobble' ? this.roadDist : this.buildDist);
      }
    }
  }

  setNight(n) { this.wallMat.emissiveIntensity = n * 0.95; if (this.lampMat) this.lampMat.emissiveIntensity = n * 1.6; if (this.poolMat) { this.poolMat.opacity = n * 0.55; this.pools.visible = n > 0.05; } }
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

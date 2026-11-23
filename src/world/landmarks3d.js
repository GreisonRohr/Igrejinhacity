// Modelos próprios dos pontos marcantes, feitos a partir de fotos de referência (docs/referencias.md).
// Cada ponto: posição/orientação tirada dos dados reais (Prefeitura/OSM), "exclusão" para tirar o
// prédio genérico do lugar, peças mescladas por material (poucas draw calls) e colisores.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { byId } from '../landmarks.js';
import { makeLabel } from './labels.js';
import { planOktober, buildOktober } from './oktoberfest.js';
import { buildAvenida } from './avenida.js';
import { buildPraca } from './praca.js';
import { buildEntorno, entornoExclusions, buildCulverts } from './entorno.js';
import { buildPontos, heidelbergExclusion } from './pontos.js';
import { placePontosTur, buildPontosTur } from './pontos-tur.js';
import { mergeStatic } from './merge.js';

const PI = Math.PI;
export const tex = (w, h, draw, repeat = false) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
const matCache = new Map();
/** Material Lambert; sem textura, a mesma cor+opções reaproveita o mesmo material (permite juntar malhas). */
export const lambert = (color, o = {}) => {
  if (o.map || o.emissiveMap) return new THREE.MeshLambertMaterial({ color, ...o });
  const k = color + JSON.stringify(o);
  let m = matCache.get(k); if (!m) { matCache.set(k, m = new THREE.MeshLambertMaterial({ color, ...o })); m.userData.plain = Object.keys(o).length === 0; }
  return m;
};
/** Material único de cor por vértice: todas as peças de cor lisa de um Kit viram uma malha só (menos draw calls). */
const VC = new THREE.MeshLambertMaterial({ vertexColors: true });
export const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
export const segClosest = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)); return [a[0] + dx * t, a[1] + dz * t]; };

/** Junta geometrias por material e devolve poucas malhas. */
export class Kit {
  constructor() { this.parts = new Map(); this.extra = []; }
  add(geo, mat, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return g;
  }
  box(w, h, d, mat, x, y, z, ry = 0) { return this.add(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, ry); }
  build(group, shadow = true) {
    const vc = [];
    for (const [mat, geos] of this.parts) {
      if (mat.userData.plain) {
        for (const g of geos) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[3 * i] = mat.color.r; a[3 * i + 1] = mat.color.g; a[3 * i + 2] = mat.color.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); vc.push(g); }
        continue;
      }
      const m = new THREE.Mesh(mergeGeometries(geos), mat);
      m.castShadow = shadow && !mat.transparent; m.receiveShadow = true;
      group.add(m);
    }
    if (vc.length) { const m = new THREE.Mesh(mergeGeometries(vc), VC); m.castShadow = shadow; m.receiveShadow = true; group.add(m); }
    for (const o of this.extra) group.add(o);
    return group;
  }
}

/** Arco ogival (gótico) como Shape: largura w, altura total h. */
function lancet(w, h) {
  // arco ogival equilátero: dois arcos de raio w centrados nas impostas opostas
  const ah = w * Math.sqrt(3) / 2, hs = Math.max(0, h - ah), s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, hs);
  for (let i = 1; i <= 8; i++) { const a = (i / 8) * PI / 3; s.lineTo(-w / 2 + Math.cos(a) * w, hs + Math.sin(a) * w); }
  for (let i = 7; i >= 0; i--) { const a = (i / 8) * PI / 3; s.lineTo(w / 2 - Math.cos(a) * w, hs + Math.sin(a) * w); }
  s.lineTo(-w / 2, 0);
  return new THREE.ShapeGeometry(s);
}

/* ======================================================================= */
export function placeLandmarks(world, terrain) {
  // posições e orientações a partir dos dados; usadas antes de montar a cidade (para tirar prédios genéricos)
  const P = {};
  // Igreja Gabriel: eixo perpendicular à Rua da Independência, frente para a rua
  {
    const l = byId.igreja; let best = null;
    for (const r of world.roads) if (/Independ/.test(r.n || '')) for (let i = 0; i < r.p.length - 1; i++) {
      const q = segClosest(l.x, l.z, r.p[i], r.p[i + 1]), d = Math.hypot(q[0] - l.x, q[1] - l.z);
      if (!best || d < best.d) best = { d, q };
    }
    const ux = (l.x - best.q[0]) / best.d, uz = (l.z - best.q[1]) / best.d;   // da rua para dentro do lote
    const L = 30;                                                                // da frente da torre ao fundo da abside
    const front = 10;                                                            // frente a 10 m do eixo da rua
    const c = [best.q[0] + ux * (front + L / 2), best.q[1] + uz * (front + L / 2)];
    P.igreja = { x: c[0], z: c[1], ux, uz, hl: L / 2 + 2, hw: 9 };
  }
  // Rua Coberta: polígono da Prefeitura (faixa sobre a Rua Ary Delmar Koppe)
  {
    const a = world.areas.find(q => q.k === 'plaza' && /Rua Coberta/.test(q.n || ''));
    const p = a ? a.p : null;
    let cx = byId.ruacoberta.x, cz = byId.ruacoberta.z, ux = 0.995, uz = 0.097, hl = 33, hw = 8.5;
    if (p) {
      cx = p.reduce((s, q) => s + q[0], 0) / p.length; cz = p.reduce((s, q) => s + q[1], 0) / p.length;
      let bi = 0, bl = 0; for (let i = 0; i < p.length; i++) { const b = p[(i + 1) % p.length], L = Math.hypot(b[0] - p[i][0], b[1] - p[i][1]); if (L > bl) { bl = L; bi = i; } }
      const b = p[(bi + 1) % p.length]; ux = (b[0] - p[bi][0]) / bl; uz = (b[1] - p[bi][1]) / bl; hl = bl / 2;
      let w = 0; for (const q of p) w = Math.max(w, Math.abs((q[0] - cx) * -uz + (q[1] - cz) * ux)); hw = w;
    }
    P.ruacoberta = { x: cx, z: cz, ux, uz, hl, hw, poly: p };
  }
  // Praça Dona Luiza
  P.praca = { poly: world.areas.find(q => q.k === 'park' && /Dona Lu/.test(q.n || ''))?.p, erni: world.areas.find(q => q.k === 'park' && /Erni Engelmann/.test(q.n || ''))?.p };
  // Bar do Waldir: o prédio da Prefeitura que contém o ponto
  {
    const l = byId.waldir;
    const b = world.buildings.find(q => inPoly(l.x, l.z, q.p));
    P.waldir = { poly: b ? b.p : null, rect: b?.rect };
  }
  // exclusões: prédios genéricos cujo centro cai aqui saem do mapa
  const ex = [];
  const obb = (o) => (x, z) => { const dx = x - o.x, dz = z - o.z; return Math.abs(dx * o.ux + dz * o.uz) < o.hl && Math.abs(-dx * o.uz + dz * o.ux) < o.hw; };
  ex.push(obb(P.igreja));
  ex.push(obb({ ...P.ruacoberta, hl: P.ruacoberta.hl + 2, hw: P.ruacoberta.hw + 1 }));
  if (P.praca.poly) ex.push((x, z) => inPoly(x, z, P.praca.poly));
  if (P.praca.erni) ex.push((x, z) => inPoly(x, z, P.praca.erni));
  if (P.waldir.poly) { const wp = P.waldir.poly; ex.push((x, z) => inPoly(x, z, wp)); }
  ex.push(...entornoExclusions(), heidelbergExclusion);
  P.tur = placePontosTur(world); ex.push(...P.tur.ex);
  P.oktober = planOktober(world);
  if (P.oktober) ex.push(P.oktober.excl);
  P.exclusions = ex;
  return P;
}

/* ======================================================================= */
export function buildLandmarks(P, world, terrain, scene, city = null) {
  const root = new THREE.Group(); scene.add(root);
  const colliders = [];          // {p: polígono} para colisão
  const updaters = [];
  const seats = [];              // assentos de bancos para pedestres: {x, y, z, face}
  const H = (x, z) => terrain.heightAt(x, z);
  const frame = (o, y) => { const g = new THREE.Group(); g.position.set(o.x, y, o.z); g.rotation.y = Math.atan2(-o.uz, o.ux); root.add(g); return g; };
  const toWorld = (o, lx, lz) => [o.x + lx * o.ux - lz * o.uz, o.z + lx * o.uz + lz * o.ux];
  const rectCollider = (o, x0, x1, z0, z1) => colliders.push({ p: [toWorld(o, x0, z0), toWorld(o, x1, z0), toWorld(o, x1, z1), toWorld(o, x0, z1)] });

  /* ---------------- Igreja Gabriel (Igreja do Relógio) ---------------- */
  const clock = buildChurch(P.igreja);
  function buildChurch(o) {
    const L = 24, W = 12, WH = 9, GH = 5.5, TW = 4.8, AR = 4.2;           // nave, torre, abside
    const x0 = -15;                                                         // frente da torre (local x)
    const fx = x0 + 1.4;                                                    // fachada da nave
    let ymax = -1e9, ymin = 1e9;
    for (const [lx, lz] of [[x0, -W / 2], [x0, W / 2], [fx + L, -W / 2], [fx + L, W / 2]]) { const [wx, wz] = toWorld(o, lx, lz); const h = H(wx, wz); ymax = Math.max(ymax, h); ymin = Math.min(ymin, h); }
    const g = frame(o, ymax + 0.3);
    const k = new Kit();
    // cores da foto (Wikimedia Commons, "IECLB em Igrejinha"): paredes rosa-creme, frisos mostarda, telha escura
    const orange = lambert(0xf3dcc6), dark = lambert(0xd6a23f), white = lambert(0xf6efe2), roof = lambert(0x5a3226),
      glass = lambert(0x3a3f44), wood = lambert(0x4a2e1c), stone = lambert(0xb7ab98), gold = lambert(0xd8b445);
    // embasamento
    k.box(L + 6, 0.3 + (ymax - ymin) + 0.6, W + 2, stone, fx + L / 2 - 1, -(ymax - ymin) - 0.9, 0);
    // nave
    k.box(L, WH, W, orange, fx + L / 2, 0, 0);
    // frontão (empena da fachada) e empena dos fundos
    const gable = new THREE.Shape([new THREE.Vector2(-W / 2, 0), new THREE.Vector2(W / 2, 0), new THREE.Vector2(0, GH)]);
    const gg = new THREE.ExtrudeGeometry(gable, { depth: 0.6, bevelEnabled: false });
    k.add(gg, orange, fx - 0.3, WH, 0, PI / 2);
    k.add(gg, orange, fx + L - 0.3, WH, 0, PI / 2);
    // telhado de duas águas
    const slope = Math.hypot(W / 2 + 0.6, GH + 0.45);
    const ang = Math.atan2(GH, W / 2);
    for (const s of [-1, 1]) {
      const geo = new THREE.BoxGeometry(L + 0.8, 0.25, slope);
      geo.rotateX(s * ang);
      k.add(geo, roof, fx + L / 2, WH + GH / 2 + 0.05, s * (W / 4 + 0.1));
    }
    // pilastras e cornija (laranja escuro)
    for (const s of [-1, 1]) {
      k.box(0.7, WH + 0.2, 0.7, dark, fx - 0.1, 0, s * (W / 2 - 0.2));
      k.box(0.7, WH + 0.2, 0.7, dark, fx + L - 0.2, 0, s * (W / 2 - 0.2));
      for (let i = 1; i < 5; i++) k.box(0.5, WH, 0.35, dark, fx + i * L / 5, 0, s * (W / 2 + 0.05));
      // pináculos nos cantos do frontão
      k.add(new THREE.ConeGeometry(0.45, 1.6, 4), dark, fx - 0.1, WH + 1.1, s * (W / 2 - 0.2), PI / 4);
    }
    k.box(L + 0.3, 0.45, W + 0.5, dark, fx + L / 2, WH - 0.2, 0);
    // janelas ogivais nas laterais
    const lw = lancet(1.3, 3.4), lf = lancet(1.7, 3.9);
    // laterais da nave: janelas em arco pleno com moldura mostarda (foto)
    const aw = new THREE.ShapeGeometry((() => { const sh = new THREE.Shape(); sh.moveTo(-0.6, 0); sh.lineTo(0.6, 0); sh.lineTo(0.6, 1.8); sh.absarc(0, 1.8, 0.6, 0, PI, false); sh.lineTo(-0.6, 0); return sh; })(), 10);
    const af = new THREE.ShapeGeometry((() => { const sh = new THREE.Shape(); sh.moveTo(-0.85, 0); sh.lineTo(0.85, 0); sh.lineTo(0.85, 1.8); sh.absarc(0, 1.8, 0.85, 0, PI, false); sh.lineTo(-0.85, 0); return sh; })(), 10);
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
      const lx = fx + 1.6 + i * (L - 3) / 5;
      k.add(af, dark, lx, 3.4, s * (W / 2 + 0.03), s > 0 ? 0 : PI);
      k.add(aw, glass, lx, 3.55, s * (W / 2 + 0.06), s > 0 ? 0 : PI);
    }
    // fachada: janelas ogivais ao lado da torre
    for (const s of [-1, 1]) {
      k.add(lf, white, fx - 0.33, 4.0, s * 3.6, -PI / 2);
      k.add(lw, glass, fx - 0.36, 4.2, s * 3.6, -PI / 2);
    }
    // abside (meio cilindro nos fundos)
    k.add(new THREE.CylinderGeometry(AR, AR, 7, 16, 1, false, 0, PI), orange, fx + L, 3.5, 0);
    k.add(new THREE.ConeGeometry(AR + 0.4, 3, 16, 1, false, 0, PI), roof, fx + L, 8.5, 0);
    // torre
    const tx = x0 + TW / 2, T1 = 14.5, T2 = 19.5, T3 = 24.5, SP = 10;
    k.box(TW, T1, TW, orange, tx, 0, 0);
    k.box(TW - 0.4, T2 - T1, TW - 0.4, orange, tx, T1, 0);
    k.box(TW - 0.2, T3 - T2, TW - 0.2, orange, tx, T2, 0);
    for (const y of [T1, T2, T3]) k.box(TW + 0.5, 0.45, TW + 0.5, dark, tx, y - 0.2, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.45, T3, 0.45, dark, tx + sx * (TW / 2 - 0.05), 0, sz * (TW / 2 - 0.05));
    // porta ogival, rosácea e medalhão
    // porta em arco pleno com grade de ferro e o nome "IGREJA GABRIEL" na bandeira
    const arch = (w, h) => { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, 0, PI, false); sh.lineTo(-w / 2, 0); return new THREE.ShapeGeometry(sh, 12); };
    k.add(arch(2.5, 4.4), dark, x0 - 0.04, 0, 0, -PI / 2);
    const gateT = tex(128, 256, (c, w, h) => { c.fillStyle = '#20242a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8a8f96'; c.lineWidth = 3; for (let x = 8; x < w; x += 14) { c.beginPath(); c.moveTo(x, 40); c.lineTo(x, h); c.stroke(); } for (let y = 70; y < h; y += 60) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.fillStyle = '#f6efe2'; c.fillRect(6, 4, w - 12, 26); c.fillStyle = '#333'; c.font = 'bold 15px serif'; c.textAlign = 'center'; c.fillText('IGREJA GABRIEL', w / 2, 23); });
    const gateG = arch(2.0, 4.0); { const uv = gateG.attributes.uv, pa = gateG.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pa.getX(i) + 1) / 2, pa.getY(i) / 4); }
    const gateMesh = new THREE.Mesh(gateG, new THREE.MeshLambertMaterial({ map: gateT })); gateMesh.position.set(x0 - 0.08, 0, 0); gateMesh.rotation.y = -PI / 2; k.extra.push(gateMesh);
    // medalhão "1900" na torre
    const medT = tex(128, 128, c => { c.fillStyle = '#d6a23f'; c.beginPath(); c.arc(64, 64, 62, 0, 7); c.fill(); c.fillStyle = '#f3dcc6'; c.beginPath(); c.arc(64, 64, 50, 0, 7); c.fill(); c.fillStyle = '#8a6420'; c.font = 'bold 34px serif'; c.textAlign = 'center'; c.fillText('1900', 64, 76); });
    const med = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshLambertMaterial({ map: medT })); med.position.set(x0 - 0.06 + 0, 12.6, 0); med.rotation.y = -PI / 2; k.extra.push(med);
    k.add(new THREE.CircleGeometry(1.05, 24), dark, x0 - 0.04, 9.2, 0, -PI / 2);
    k.add(new THREE.CircleGeometry(0.8, 24), glass, x0 - 0.08, 9.2, 0, -PI / 2);
    k.add(new THREE.CircleGeometry(0.75, 24), dark, x0 + 0.16, 16.8, 0, -PI / 2);
    // campanário: duas aberturas ogivais em cada face
    const lou = lancet(0.75, 2.4);
    for (const [ry, ox, oz] of [[-PI / 2, -1, 0], [PI / 2, 1, 0], [0, 0, 1], [PI, 0, -1]]) for (const s of [-1, 1]) {
      const off = s * 0.55;
      k.add(lou, glass, tx + ox * (TW / 2 - 0.05) + (oz ? off : 0), T1 + 1.3, oz * (TW / 2 - 0.05) + (ox ? off * -ox : 0), ry);
    }
    // agulha piramidal e cruz
    k.add(new THREE.ConeGeometry(TW * 0.62, SP * 1.15, 8), lambert(0xf0dcb4), tx, T3 + SP * 0.575, 0, PI / 8);   // coruchéu octogonal creme
    k.box(0.18, 2.2, 0.18, gold, tx, T3 + SP - 0.2, 0);
    k.box(0.18, 0.18, 1.1, gold, tx, T3 + SP + 1.2, 0);
    k.build(g);
    // relógios (três faces: frente e laterais) — marcam a hora do jogo
    const cc = document.createElement('canvas'); cc.width = cc.height = 256; const cg = cc.getContext('2d');
    const ct = new THREE.CanvasTexture(cc); ct.colorSpace = THREE.SRGBColorSpace;
    const cmat = new THREE.MeshLambertMaterial({ map: ct, emissive: 0xffffff, emissiveMap: ct, emissiveIntensity: 0, transparent: true });
    const face = new THREE.CircleGeometry(1.35, 32);
    for (const [ry, ox, oz] of [[-PI / 2, -1, 0], [0, 0, 1], [PI, 0, -1]]) {
      const m = new THREE.Mesh(face, cmat);
      m.position.set(tx + ox * (TW / 2 + 0.02), T2 + 2.6, oz * (TW / 2 + 0.02)); m.rotation.y = ry; g.add(m);
    }
    let last = -1;
    const draw = (h, mi) => {
      cg.clearRect(0, 0, 256, 256);
      cg.beginPath(); cg.arc(128, 128, 124, 0, 7); cg.fillStyle = '#fbf8ef'; cg.fill(); cg.lineWidth = 10; cg.strokeStyle = '#2a2a2a'; cg.stroke();
      for (let i = 0; i < 12; i++) { cg.save(); cg.translate(128, 128); cg.rotate(i / 12 * PI * 2); cg.fillStyle = '#222'; cg.fillRect(-4, -112, 8, i % 3 ? 14 : 26); cg.restore(); }
      const hand = (a, l, w) => { cg.save(); cg.translate(128, 128); cg.rotate(a); cg.fillStyle = '#111'; cg.fillRect(-w / 2, -l, w, l + 14); cg.restore(); };
      hand(((h % 12) + mi / 60) / 12 * PI * 2, 66, 12); hand(mi / 60 * PI * 2, 100, 7);
      cg.beginPath(); cg.arc(128, 128, 9, 0, 7); cg.fillStyle = '#222'; cg.fill(); ct.needsUpdate = true;
    };
    rectCollider(o, x0, fx + L + AR, -W / 2 - 0.3, W / 2 + 0.3);
    const lab = makeLabel('Igreja Gabriel (IECLB)', 20); const [lx, lz] = toWorld(o, tx, 0);
    lab.position.set(lx, ymax + T3 + SP + 6, lz); lab.userData.maxDist = 2500; root.add(lab);
    return { update(hours, night) { const h = Math.floor(hours), mi = Math.floor((hours - h) * 60); if (mi !== last) { last = mi; draw(h, mi); } cmat.emissiveIntensity = night * 0.8; } };
  }
  updaters.push((dt, s) => clock.update(s.hours, s.night));

  /* ---------------- Rua Coberta ---------------- */
  buildRuaCoberta(P.ruacoberta);
  function buildRuaCoberta(o) {
    const g = frame(o, 0), k = new Kit();
    const white = lambert(0xf6f6f4), brick = lambert(0xa65a3e);
    const span = o.hw * 2 - 1, half = span / 2, colH = 5.6, rise = 4.6, N = Math.max(4, Math.round(o.hl * 2 / 6));
    const arcPt = (t, r = 0) => { const a = PI * t; return new THREE.Vector3(0, colH + Math.sin(a) * (rise - r), -Math.cos(a) * (half - r)); };
    const arcCurve = r => new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, i) => arcPt(i / 16, r)));
    const outer = new THREE.TubeGeometry(arcCurve(0), 24, 0.16, 6), inner = new THREE.TubeGeometry(arcCurve(0.7), 24, 0.1, 6);
    const ring = new THREE.TorusGeometry(0.3, 0.05, 6, 16);
    const ys = [];
    for (let i = 0; i <= N; i++) {
      const lx = -o.hl + i * (o.hl * 2 / N);
      const [wx0, wz0] = toWorld(o, lx, -half), [wx1, wz1] = toWorld(o, lx, half);
      const y0 = H(wx0, wz0), y1 = H(wx1, wz1), y = Math.max(y0, y1); ys.push(y);
      for (const [s, yb] of [[-1, y0], [1, y1]]) {
        k.box(0.9, 0.7 + (y - yb), 0.9, brick, lx, yb, s * half);
        k.add(new THREE.CylinderGeometry(0.22, 0.24, colH - 0.7, 10), white, lx, y + 0.7 + (colH - 0.7) / 2, s * half);
      }
      k.add(outer, white, lx, y, 0); k.add(inner, white, lx, y, 0);
      for (let j = 1; j < 8; j++) { const p = arcPt(j / 8, 0.35); k.add(ring, white, lx, y + p.y, p.z, PI / 2); }
    }
    // terças ao longo da cobertura e vigas laterais
    const yMid = ys.reduce((a, b) => a + b, 0) / ys.length;
    for (let j = 0; j <= 6; j++) { const p = arcPt(j / 6); k.add(new THREE.BoxGeometry(o.hl * 2, 0.12, 0.12), white, 0, yMid + p.y, p.z); }
    // cobertura translúcida (policarbonato)
    const cols = 24, pos = [], idx = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= cols; j++) { const p = arcPt(j / cols); pos.push(-o.hl + i * (o.hl * 2 / N), ys[i] + p.y + 0.12, p.z); }
    for (let i = 0; i < N; i++) for (let j = 0; j < cols; j++) { const a = i * (cols + 1) + j, b = a + cols + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setIndex(idx); rg.computeVertexNormals();
    // policarbonato bege fosco com nervuras (fotos de abr/2026): deixa passar luz difusa e faz sombra embaixo
    const ribT = tex(64, 64, (c, w, h) => { c.fillStyle = '#e4d8bf'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) { c.fillStyle = 'rgba(120,100,70,0.18)'; c.fillRect(0, y, w, 2); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, y + 3, w, 1); } }, true);
    const uvs = []; for (let i = 0; i <= N; i++) for (let j = 0; j <= cols; j++) uvs.push(i * 3, j * 1.5);
    rg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const roofM = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({ map: ribT, color: 0xf4ecdc, emissive: 0x6a5e48, side: THREE.DoubleSide }));
    roofM.castShadow = true; roofM.receiveShadow = true; k.extra.push(roofM);
    k.build(g);
    const lab = makeLabel('Rua Coberta', 16); lab.position.set(o.x, yMid + colH + rise + 4, o.z); lab.userData.maxDist = 1500; root.add(lab);
    for (const s of [-1, 1]) for (let i = 0; i <= N; i++) { const [wx, wz] = toWorld(o, -o.hl + i * (o.hl * 2 / N), s * half); colliders.push({ p: [[wx - 0.4, wz - 0.4], [wx + 0.4, wz - 0.4], [wx + 0.4, wz + 0.4], [wx - 0.4, wz + 0.4]] }); }
  }

  /* ---------------- Praça Dona Luiza (src/world/praca.js) ---------------- */
  const praca = P.praca.poly ? buildPraca({ root, colliders, updaters, seats, H, world, poly: P.praca.poly, erni: P.praca.erni }) : {};

  /* ---------------- Bar do Waldir ---------------- */
  let waldirNpc = null;
  if (P.waldir.poly) waldirNpc = buildWaldir(P.waldir.poly);
  function buildWaldir(poly) {
    const g = new THREE.Group(); root.add(g);
    let p = poly.slice(); { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } if (s > 0) p.reverse(); }
    let ymax = -1e9, ymin = 1e9; for (const [x, z] of p) { ymax = Math.max(ymax, H(x, z)); ymin = Math.min(ymin, H(x, z)); }
    const y0 = ymax + 0.15, F1 = 3.6, F = 3.0, top = y0 + F1 + 2 * F;
    // fachadas que dão para a rua (arestas a menos de 9 m de uma rua)
    const segD = (x, z, a, b) => { const q = segClosest(x, z, a, b); return Math.hypot(q[0] - x, q[1] - z); };
    const street = []; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; let d = 1e9; for (const r of world.roads) for (let j = 0; j < r.p.length - 1; j++) d = Math.min(d, segD(m[0], m[1], r.p[j], r.p[j + 1])); street.push(d < 9 && Math.hypot(b[0] - a[0], b[1] - a[1]) > 3); }
    const brickT = tex(128, 128, (c) => { c.fillStyle = '#e8dcc0'; c.fillRect(0, 0, 128, 128); for (let y = 0; y < 128; y += 16) for (let x = -32; x < 128; x += 32) { const o = (y / 16) % 2 ? 16 : 0; const l = 236 + ((x * 7 + y * 3) % 19); c.fillStyle = `rgb(${l},${l * 0.9 | 0},${l * 0.66 | 0})`; c.fillRect(x + o + 1, y + 1, 30, 14); } }, true);
    const brick = lambert(0xffffff, { map: brickT }), wine = lambert(0x8e2228), pinkP = lambert(0xe2aca2), white = lambert(0xf4f4f2), glass = lambert(0x41505e),
      slab = lambert(0xc4b8ad), roofM = lambert(0x8a8a86), red = lambert(0xd9161e), tile = lambert(0xd8c09a), woodT = lambert(0xa0703f);
    const k = new Kit();
    const wall = (a, b, ya, yb, mat, uvScale = 1) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const geo = new THREE.PlaneGeometry(L, yb - ya); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L / 2 * uvScale, uv.getY(i) * (yb - ya) / 2 * uvScale);
      const nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;          // normal para fora (polígono com área negativa)
      k.add(geo, mat, (a[0] + b[0]) / 2, (ya + yb) / 2, (a[1] + b[1]) / 2, Math.atan2(nx, nz));
      return { L, nx, nz, ux: (b[0] - a[0]) / L, uz: (b[1] - a[1]) / L };
    };
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      wall(a, b, ymin - 0.5, y0 + F1, wine);
      wall(a, b, y0 + F1, top, brick);
      if (!street[i]) continue;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz, nz = ux;
      const at = (t, out) => [a[0] + ux * t + nx * out, a[1] + uz * t + nz * out];
      const ry = Math.atan2(nx, nz);
      // térreo: janelas com grade e porta branca
      for (let t = 2.5; t < L - 2; t += 4.2) { const [x, z] = at(t, 0.04); k.add(new THREE.PlaneGeometry(2.4, 1.7), glass, x, y0 + 1.9, z, ry); for (let j = 0; j < 7; j++) { const [gx, gz] = at(t - 1.1 + j * 0.37, 0.08); k.add(new THREE.BoxGeometry(0.04, 1.7, 0.04), white, gx, y0 + 1.9, gz, ry); } }
      { const [x, z] = at(Math.min(1.2, L / 2), 0.05); k.add(new THREE.PlaneGeometry(1.1, 2.3), white, x, y0 + 1.15, z, ry); }
      // andares de cima: sacadas com pilares rosados com faixas brancas, grade branca e vidro
      for (let f = 0; f < 2; f++) {
        const yb = y0 + F1 + f * F;
        const [sx, sz] = at(L / 2, 0.75); k.add(new THREE.BoxGeometry(L, 0.22, 1.5), slab, sx, yb, sz, ry);
        for (let t = 0.3; t <= L - 0.2; t += Math.max(3, L / Math.round(L / 4.5))) {
          const [x, z] = at(t, 1.35);
          k.add(new THREE.BoxGeometry(0.5, F, 0.5), pinkP, x, yb + F / 2, z, ry);
          for (let s = 0; s < 4; s++) k.add(new THREE.BoxGeometry(0.52, 0.12, 0.52), white, x, yb + 0.4 + s * 0.7, z, ry);
        }
        const [rx, rz] = at(L / 2, 1.42); k.add(new THREE.BoxGeometry(L - 0.4, 0.06, 0.06), white, rx, yb + 1.05, rz, ry);
        k.add(new THREE.PlaneGeometry(L - 0.4, 0.8), lambert(0xbfd6e0, { transparent: true, opacity: 0.45, side: THREE.DoubleSide }), rx, yb + 0.6, rz, ry);
        for (let t = 0.5; t < L; t += 0.5) { const [x, z] = at(t, 1.42); k.add(new THREE.BoxGeometry(0.04, 0.9, 0.04), white, x, yb + 0.6, z, ry); }
        for (let t = 2.2; t < L - 1.5; t += 4.5) { const [x, z] = at(t, 0.04); k.add(new THREE.PlaneGeometry(1.9, 1.9), glass, x, yb + 1.35, z, ry); }
      }
      // toldo vermelho com letreiro + piso de lajotas e mesas na calçada
      const depth = 3.0;
      const [cx, cz] = at(L / 2, depth / 2); const cov = new THREE.BoxGeometry(L, 0.08, depth); cov.rotateX(0.12);
      k.add(cov, lambert(0xd81a22), cx, y0 + 3.05, cz, ry);
      // letreiro na proporção real da fachada (96 px por 1,15 m de altura)
      const SW = Math.min(4096, Math.round(L / 1.15 * 96));
      const signT = tex(SW, 96, (c, w, h) => {
        c.fillStyle = '#ee1c25'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textBaseline = 'middle';
        c.font = '900 60px Arial Black, Arial, sans-serif';
        if (L > 18) {
          c.textAlign = 'left'; c.fillText('BRAHMA', 30, h / 2 + 3);
          c.textAlign = 'right'; c.fillText('BRAHMA', w - 30, h / 2 + 3);
          c.textAlign = 'center'; c.fillText('BAR DO WALDIR', w * 0.56, h / 2 + 3);
        } else { c.textAlign = 'center'; c.fillText('BAR DO WALDIR', w / 2, h / 2 + 3); }
      });
      const sm = new THREE.MeshLambertMaterial({ map: signT, emissive: 0xffffff, emissiveMap: signT, emissiveIntensity: 0.3 });
      updaters.push((dt, s) => { sm.emissiveIntensity = 0.3 + s.night * 0.4; });
      const [fx, fz] = at(L / 2, depth + 0.02); const sign = new THREE.Mesh(new THREE.PlaneGeometry(L, 1.15), sm); sign.position.set(fx, y0 + 2.75, fz); sign.rotation.y = ry; k.extra.push(sign);
      for (let t = 0; t <= L; t += L / Math.max(1, Math.round(L / 6))) { const [x, z] = at(t, depth - 0.1); k.add(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), white, x, y0 + 1.25, z); }
      const [tx, tz] = at(L / 2, depth / 2); k.add(new THREE.BoxGeometry(L, 0.06, depth), tile, tx, y0 + 0.02, tz, ry);
      for (let t = 2; t < L - 1.5; t += 2.6) {
        const [x, z] = at(t, 1.7), yy = y0;
        k.add(new THREE.BoxGeometry(0.75, 0.05, 0.75), woodT, x, yy + 0.74, z, ry); k.add(new THREE.CylinderGeometry(0.04, 0.04, 0.72, 5), woodT, x, yy + 0.37, z);
        for (const s of [-1, 1]) { const [qx, qz] = at(t + s * 0.65, 1.7); k.add(new THREE.BoxGeometry(0.42, 0.04, 0.42), woodT, qx, yy + 0.45, qz, ry); const back = new THREE.BoxGeometry(0.04, 0.45, 0.42); k.add(back, woodT, qx + ux * s * 0.2, yy + 0.7, qz + uz * s * 0.2, ry); }
      }
    }
    // telhado baixo de 4 águas (fibrocimento) e chaminés
    const tris = THREE.ShapeUtils.triangulateShape(p.map(([x, z]) => new THREE.Vector2(x, z)), []);
    const pos = []; for (const t of tris) for (const i of t) pos.push(p[i][0], top + 0.05, p[i][1]);
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.computeVertexNormals();
    if (rg.attributes.normal.getY(0) < 0) { const a = rg.attributes.position.array; for (let i = 0; i < a.length; i += 9) for (let j = 0; j < 3; j++) [a[i + 3 + j], a[i + 6 + j]] = [a[i + 6 + j], a[i + 3 + j]]; rg.computeVertexNormals(); }
    k.add(rg, roofM);
    const pcx = p.reduce((s, q) => s + q[0], 0) / p.length, pcz = p.reduce((s, q) => s + q[1], 0) / p.length;
    k.box(1.2, 1.8, 1.2, lambert(0xb07a5a), pcx - 3, top, pcz - 4); k.box(1.2, 1.8, 1.2, lambert(0xb07a5a), pcx + 2, top, pcz + 5);
    k.build(g);
    colliders.push({ p });
    const lab = makeLabel('Bar do Waldir', 14); lab.position.set(pcx, top + 5, pcz); lab.userData.maxDist = 900; root.add(lab);
    // o Waldir, na porta do bar
    let best = null; for (let i = 0; i < p.length; i++) if (street[i]) { const a = p[i], b = p[(i + 1) % p.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!best || L > best.L) best = { a, b, L }; }
    if (!best) return null;
    const ux = (best.b[0] - best.a[0]) / best.L, uz = (best.b[1] - best.a[1]) / best.L;
    return { x: best.a[0] + ux * best.L * 0.3 - uz * 1.2, z: best.a[1] + uz * best.L * 0.3 + ux * 1.2, y: y0, face: Math.atan2(-uz, ux) };
  }

  buildOktober(P.oktober, world, terrain, root, colliders, updaters);
  if (city) colliders.push(...buildAvenida(world, terrain, city, root).colliders);
  buildEntorno(terrain, root, colliders);
  buildPontos(terrain, root, colliders, updaters, world);
  buildPontosTur(P.tur, terrain, root, colliders, updaters);
  if (city) buildCulverts(city, terrain, root, colliders);
  // junta as peças estáticas por material e região de 1 km (menos malhas); regiões distantes somem
  const cells = mergeStatic(root, 1000);

  return {
    colliders, root, waldir: waldirNpc, cells, seats, footbridges: praca.footbridges || [], inPraca: (x, z) => (P.praca.poly && inPoly(x, z, P.praca.poly)) || (P.praca.erni && inPoly(x, z, P.praca.erni)), pipoca: praca.pipoca, parking: praca.parking || [], trees: praca.trees || [],
    cull(px, pz, dist) { for (const c of cells) { const v = Math.hypot(px - c.cx, pz - c.cz) < dist; for (const m of c.meshes) m.visible = v; } },
    update(dt, state) { for (const u of updaters) u(dt, state); },
  };
}

/** Colisão com os modelos (polígonos e círculos). */
export function landmarkBlocked(colliders, x, z, r) {
  for (const c of colliders) {
    if (c.circle) { if (Math.hypot(x - c.circle[0], z - c.circle[1]) < c.circle[2] + r) return true; continue; }
    if (!c.p) continue;
    if (inPoly(x, z, c.p)) return true;
    for (let i = 0; i < c.p.length; i++) { const q = segClosest(x, z, c.p[i], c.p[(i + 1) % c.p.length]); if (Math.hypot(q[0] - x, q[1] - z) < r) return true; }
  }
  return false;
}

// Parque de Eventos Almiro Grings montado para a Oktoberfest (referência: renders do projeto da 37ª edição).
// Os pavilhões usam os contornos reais da Prefeitura/Google; a decoração segue os renders:
// lonas listradas preto-vermelho-amarelo, treliças marrons, enxaimel, guarda-sóis, varais de lâmpadas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Kit, tex, lambert, inPoly, segClosest } from './landmarks3d.js';
import { makeLabel } from './labels.js';
import { byId } from '../landmarks.js';

const PI = Math.PI;
const cen = p => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
const area = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s / 2); };

/** Retângulo orientado do prédio: eixo longo L, transversal T, semi-medidas a (longo) e b. */
function rectOf(b) {
  if (!b.rect) return null;
  const [cx, cz, ux, uz, hu, hv] = b.rect;
  const L = hu >= hv ? [ux, uz] : [-uz, ux];
  return { cx, cz, Lx: L[0], Lz: L[1], a: Math.max(hu, hv), b: Math.min(hu, hv) };
}

/* ======================= planejamento (antes de montar a cidade) ======================= */
export function planOktober(world) {
  const parkArea = world.areas.find(a => /Almiro Grings/.test(a.n || ''));
  if (!parkArea) return null;
  const okt = byId.oktober;
  // núcleo do parque: parte do polígono perto dos pavilhões (o resto é gramado na beira do rio)
  const core = parkArea.p.filter(([x, z]) => z > -905);
  const inCore = (x, z) => inPoly(x, z, parkArea.p) && z > -905 && Math.hypot(x - okt.x, z - okt.z) < 260;
  const blds = world.buildings.map(b => ({ b, c: cen(b.p), ar: area(b.p) })).filter(o => inCore(o.c[0], o.c[1]));
  const big = blds.filter(o => o.ar >= 550 && o.b.rect).sort((p, q) => q.ar - p.ar);
  const roles = ['festhalle', 'kerb', 'zelt', 'bierplatz', 'essen', 'restaurant'];
  // Bierplatz = ginásio a oeste (o maior entre os de x mais baixo)
  const pav = [];
  const west = big.filter(o => o.c[0] < -255).sort((p, q) => q.ar - p.ar)[0];
  const east = big.filter(o => o !== west);
  const order = ['festhalle', 'kerb', 'zelt', 'essen', 'restaurant'];
  east.forEach((o, i) => pav.push({ ...o, role: order[i] || 'restaurant' }));
  if (west) pav.push({ ...west, role: 'bierplatz' });
  void roles;
  // pórtico: construções pequenas na divisa norte do parque
  const north = blds.filter(o => o.ar < 120 && o.c[1] > -640);
  let portal = null;
  if (north.length) {
    const px = north.reduce((s, o) => s + o.c[0], 0) / north.length, pz = north.reduce((s, o) => s + o.c[1], 0) / north.length;
    // virado para a rua mais próxima
    let best = null;
    for (const r of world.roads) for (let i = 0; i < r.p.length - 1; i++) { const q = segClosest(px, pz, r.p[i], r.p[i + 1]), d = Math.hypot(q[0] - px, q[1] - pz); if (d > 4 && (!best || d < best.d)) best = { d, q }; }
    const ox = (best.q[0] - px) / best.d, oz = (best.q[1] - pz) / best.d;
    portal = { x: px, z: pz, ox, oz, members: north };
  }
  // casinhas da Vila Germânica / quiosques: construções pequenas e médias do núcleo
  const used = new Set([...pav.map(o => o.b), ...(portal ? portal.members.map(o => o.b) : [])]);
  const houses = blds.filter(o => !used.has(o.b) && o.ar >= 30 && o.ar < 550 && o.b.rect);
  const remove = [...pav, ...houses, ...(portal ? portal.members : [])].map(o => o.c);
  const excl = (x, z) => remove.some(c => Math.abs(c[0] - x) < 0.01 && Math.abs(c[1] - z) < 0.01);
  return { park: parkArea.p, core, inCore, pav, portal, houses, excl, all: blds };
}

/* ============================== texturas ============================== */
function stripes(colors, bandPx = 32) {
  return tex(bandPx * colors.length, 8, (g) => { colors.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * bandPx, 0, bandPx, 8); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(i * bandPx + bandPx - 2, 0, 2, 8); }); }, true);
}
const trussTex = () => tex(32, 64, (g) => {
  g.clearRect(0, 0, 32, 64); g.strokeStyle = '#5a3420'; g.fillStyle = '#5a3420';
  g.fillRect(0, 0, 5, 64); g.fillRect(27, 0, 5, 64); g.lineWidth = 3;
  g.beginPath(); g.moveTo(3, 0); g.lineTo(29, 32); g.lineTo(3, 64); g.stroke();
  g.fillRect(0, 31, 32, 3);
}, true);
const silverTruss = () => tex(32, 64, (g) => {
  g.clearRect(0, 0, 32, 64); g.strokeStyle = '#d7dbe0'; g.fillStyle = '#d7dbe0';
  g.fillRect(0, 0, 4, 64); g.fillRect(28, 0, 4, 64); g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(2, 0); g.lineTo(30, 16); g.lineTo(2, 32); g.lineTo(30, 48); g.lineTo(2, 64); g.stroke();
}, true);
const planks = (base = '#c9965a') => tex(64, 64, (g) => {
  g.fillStyle = base; g.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 8) { g.fillStyle = 'rgba(70,40,15,.35)'; g.fillRect(x, 0, 1, 64); g.fillStyle = `rgba(255,255,255,${0.04 + (x % 24) / 400})`; g.fillRect(x + 1, 0, 6, 64); }
}, true);
// enxaimel: 3 m × 3 m por repetição (paredes brancas com vigas marrons)
const enxTex = () => tex(96, 96, (g) => {
  g.fillStyle = '#f4efe4'; g.fillRect(0, 0, 96, 96); g.fillStyle = '#5b3a24';
  g.fillRect(0, 0, 96, 5); g.fillRect(0, 91, 96, 5); g.fillRect(0, 0, 5, 96); g.fillRect(46, 0, 5, 96); g.fillRect(0, 46, 96, 4);
  g.strokeStyle = '#5b3a24'; g.lineWidth = 4; g.beginPath(); g.moveTo(51, 50); g.lineTo(93, 92); g.moveTo(93, 50); g.lineTo(51, 92); g.stroke();
}, true);
const tileTex = () => tex(64, 64, (g) => {
  g.fillStyle = '#c8642e'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) { g.fillStyle = 'rgba(90,30,10,.35)'; g.fillRect(0, y, 64, 2); for (let x = (y / 8) % 2 ? 4 : 0; x < 64; x += 8) { g.fillStyle = 'rgba(255,200,150,.12)'; g.fillRect(x + 1, y + 2, 5, 5); } }
}, true);
const latticeTex = () => tex(64, 64, (g) => {
  g.clearRect(0, 0, 64, 64); g.strokeStyle = '#a86e3a'; g.lineWidth = 3;
  for (let i = -64; i < 128; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.moveTo(i + 64, 0); g.lineTo(i, 64); g.stroke(); }
}, true);
const sign = (text, w = 512, h = 128, bg = '#7a4a26', fg = '#f6ead2', font = '900 78px Georgia, serif') => tex(w, h, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4);
});
const bannerTex = () => tex(1024, 400, (g, w, h) => {
  g.fillStyle = '#b5161f'; g.fillRect(0, 0, w, h); g.fillStyle = '#f0b51d'; g.fillRect(w - 260, 0, 260, h);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '900 120px Rubik, Arial Black, sans-serif'; g.fillText('Bem-vindos', 390, 150);
  g.font = '700 52px Rubik, Arial, sans-serif'; g.fillText('»» WILLKOMMEN »»', 390, 235);
  g.fillStyle = '#f0b51d'; g.font = '900 64px Georgia, serif'; g.fillText('37ª OKTOBERFEST', 390, 335);
  // caneco de chope
  g.fillStyle = '#ffd659'; g.fillRect(800, 120, 140, 200); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(870, 118, 85, 40, 0, 0, 7); g.fill();
  g.strokeStyle = '#ffd659'; g.lineWidth = 22; g.beginPath(); g.arc(950, 215, 50, -PI / 2, PI / 2); g.stroke();
});

/** Caixa com UV em metros (textura repetida a cada tu × tv metros). */
function boxUV(w, h, d, tu = 3, tv = 3) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tu, uv.getY(i) * dims[f][1] / tv); }
  return g;
}
/** Lona drapeada: plano len × wid que cai entre as vigas (bays ao longo do comprimento). */
function drape(len, wid, bays, sag, bandM = 1.0) {
  const g = new THREE.PlaneGeometry(len, wid, bays * 10, 6); g.rotateX(-PI / 2);
  const pos = g.attributes.position, uv = g.attributes.uv, bay = len / bays;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), f = ((x + len / 2) / bay) % 1;
    pos.setY(i, -sag * Math.sin(PI * f) - 0.25 * sag * Math.sin(PI * (z / wid + 0.5)));
    uv.setXY(i, (z + wid / 2) / bandM / 4, (x + len / 2) / 4);
  }
  g.computeVertexNormals();
  return g;
}

/* ============================== montagem ============================== */
export function buildOktober(O, world, terrain, root, colliders, updaters) {
  if (!O) return;
  const H = (x, z) => terrain.heightAt(x, z);
  const M = {
    wood: lambert(0xdba66a), darkWood: lambert(0x5a3a24), white: lambert(0xf4f1ea), concrete: lambert(0xcfc8ba), black: lambert(0x1e1e22),
    metal: lambert(0x9aa1a8), yellow: lambert(0xf2b01e), red: lambert(0xc4161f), green: lambert(0x3f8a35), leaf: lambert(0x4f8f3a),
    truss: lambert(0xffffff, { map: trussTex(), alphaTest: 0.5, side: THREE.DoubleSide }),
    silver: lambert(0xffffff, { map: silverTruss(), alphaTest: 0.5, side: THREE.DoubleSide }),
    planks: lambert(0xffffff, { map: planks() }), enx: lambert(0xffffff, { map: enxTex() }), tile: lambert(0xffffff, { map: tileTex() }),
    lattice: lambert(0xffffff, { map: latticeTex(), alphaTest: 0.5, side: THREE.DoubleSide }),
    festa: lambert(0xffffff, { map: stripes(['#1b1b1b', '#c4161f', '#f2a81e']), side: THREE.DoubleSide }),
    bayern: lambert(0xffffff, { map: stripes(['#f6f6f2', '#3f8fd8']), side: THREE.DoubleSide }),
    glass: lambert(0x9fc2d6, { transparent: true, opacity: 0.6 }),
  };
  const tables = [], umbrellas = { green: [], yellow: [], beige: [] }, bulbs = [], lightPoles = [];
  const label = (t, x, y, z, w = 12, d = 400) => { const s = makeLabel(t, w); s.position.set(x, y, z); s.userData.maxDist = d; root.add(s); };
  const floorY = (r, pad = 1) => { let m = -Infinity; for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const x = r.cx + r.Lx * sx * (r.a + pad) - r.Lz * sz * (r.b + pad), z = r.cz + r.Lz * sx * (r.a + pad) + r.Lx * sz * (r.b + pad); m = Math.max(m, H(x, z)); } return m + 0.15; };
  const frame = (r, y) => { const g = new THREE.Group(); g.position.set(r.cx, y, r.cz); g.rotation.y = Math.atan2(-r.Lz, r.Lx); root.add(g); return g; };
  const toW = (r, lx, lz) => [r.cx + r.Lx * lx - r.Lz * lz, r.cz + r.Lz * lx + r.Lx * lz];
  const rectCol = (r, x0, x1, z0, z1) => colliders.push({ p: [toW(r, x0, z0), toW(r, x1, z0), toW(r, x1, z1), toW(r, x0, z1)] });
  const circ = (r, lx, lz, rad) => { const [x, z] = toW(r, lx, lz); colliders.push({ circle: [x, z, rad] }); };
  const gable = (k, len, wid, y, rise, mat, over = 0.6) => {
    const ang = Math.atan2(rise, wid / 2), sl = Math.hypot(wid / 2 + over, rise + over * rise / (wid / 2));
    for (const s of [-1, 1]) { const g = boxUV(len + over * 2, 0.22, sl, 2, 2); g.rotateX(s * ang); k.add(g, mat, 0, y + rise / 2, s * (wid / 4 + 0.05)); }
    const tri = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-wid / 2, 0), new THREE.Vector2(wid / 2, 0), new THREE.Vector2(0, rise)]), { depth: 0.15, bevelEnabled: false });
    return tri;
  };
  const wreath = (k, x, y, z, ry) => { k.add(new THREE.TorusGeometry(0.55, 0.16, 6, 14), M.leaf, x, y, z, ry); k.add(new THREE.CircleGeometry(0.32, 14), M.red, x + Math.sin(ry) * 0.05, y, z + Math.cos(ry) * 0.05, ry); };
  const addTables = (r, x0, x1, z0, z1, y, along = true) => {
    for (let x = x0; x <= x1; x += along ? 3 : 2.6) for (let z = z0; z <= z1; z += along ? 2.6 : 3) { const [wx, wz] = toW(r, x, z); tables.push([wx, y, wz, Math.atan2(-r.Lz, r.Lx) + (along ? 0 : PI / 2)]); }
  };

  /* ---------- pavilhões ---------- */
  for (const P of O.pav) {
    const r = rectOf(P.b); if (!r) continue;
    const y = floorY(r), g = frame(r, y), k = new Kit(), A = r.a, B = r.b, Hh = P.role === 'bierplatz' ? 8 : 7;
    // piso
    k.add(boxUV(2 * A + 2, 1.2, 2 * B + 2, 2, 2), M.concrete, 0, -0.6, 0);
    const closedEnds = P.role === 'kerb' || P.role === 'bierplatz' || P.role === 'restaurant';
    const closedSides = P.role === 'bierplatz' || P.role === 'restaurant';
    const nb = Math.max(2, Math.round((2 * A) / 6.5));
    // pilares
    for (let i = 0; i <= nb; i++) {
      const x = -A + i * (2 * A / nb);
      for (const s of [-1, 1]) {
        if (P.role === 'zelt') k.add(boxUV(0.5, Hh, 0.5, 0.5, 1), M.silver, x, Hh / 2, s * B);
        else if (P.role === 'kerb' || P.role === 'bierplatz' || P.role === 'restaurant') k.add(boxUV(0.35, Hh, 0.35, 1, 3), M.planks, x, Hh / 2, s * B);
        else k.add(boxUV(0.55, Hh + 1.5, 0.55, 0.55, 1.1), M.truss, x, (Hh + 1.5) / 2, s * (B + 0.3));
        circ(r, x, s * B, 0.35);
        if (i % 2 === 1 && !closedSides) wreath(k, x, Hh - 1.6, s * (B + 0.75), s > 0 ? 0 : PI);
      }
    }
    // vigas de beiral e placas brancas (Festhalle) / tábuas
    for (const s of [-1, 1]) {
      k.add(boxUV(2 * A + 0.6, 0.35, 0.3, 2, 1), M.darkWood, 0, Hh, s * B);
      if (P.role === 'festhalle' || P.role === 'essen') for (let i = 0; i < nb; i++) k.add(boxUV(2 * A / nb - 1.2, 1.9, 0.12, 3, 3), M.white, -A + (i + 0.5) * (2 * A / nb), Hh - 1.1, s * (B + 0.62));
      if (closedSides) { k.add(boxUV(2 * A, Hh, 0.2, 3, 3), P.role === 'restaurant' ? M.enx : M.planks, 0, Hh / 2, s * B); rectCol(r, -A, A, s * B - 0.2, s * B + 0.2); }
      else if (P.role === 'kerb') k.add(boxUV(2 * A, 1.6, 0.15, 3, 3), M.planks, 0, Hh - 0.8, s * B);
    }
    // telhado
    if (P.role === 'bierplatz') {
      const vault = new THREE.CylinderGeometry(B + 0.6, B + 0.6, 2 * A + 1, 28, 1, true, 0, PI); vault.rotateZ(PI / 2); vault.scale(1, 0.5, 1);
      k.add(vault, lambert(0xa9b0b6, { side: THREE.DoubleSide }), 0, Hh, 0);
    } else {
      const tri = gable(k, 2 * A, 2 * B, Hh + 0.2, P.role === 'kerb' || P.role === 'restaurant' ? B * 0.55 : B * 0.3, P.role === 'restaurant' ? M.tile : lambert(0x8f969c));
      for (const s of [-1, 1]) k.add(tri, closedEnds ? M.planks : M.white, s * A, Hh + 0.2, 0, PI / 2);
    }
    // pontas fechadas (madeira) com placa
    if (closedEnds) for (const s of [-1, 1]) {
      const open = s < 0 && P.role !== 'restaurant';
      if (open) { // fachada com abertura central, treliça e floreira
        for (const z of [-B * 0.62, B * 0.62]) k.add(boxUV(0.2, Hh, B * 0.76, 3, 3), M.planks, s * A, Hh / 2, z);
        k.add(boxUV(0.2, Hh * 0.35, B * 0.5, 3, 3), M.planks, s * A, Hh * 0.65, 0);
        k.add(new THREE.PlaneGeometry(B * 0.6, Hh * 0.6), M.lattice, s * A - 0.15, Hh * 0.3, -B * 0.6, -PI / 2);
        k.add(boxUV(0.6, 0.45, B * 0.6, 1, 1), M.wood, s * A - 0.5, 0.8, B * 0.6);
        for (let f = 0; f < 10; f++) k.add(new THREE.SphereGeometry(0.16, 5, 4), [lambert(0xe2557a), lambert(0xf5a0c0), M.leaf][f % 3], s * A - 0.5, 1.1, B * 0.6 - B * 0.27 + f * B * 0.06);
        rectCol(r, s * A - 0.2, s * A + 0.2, -B, -B * 0.25); rectCol(r, s * A - 0.2, s * A + 0.2, B * 0.25, B);
      } else { k.add(boxUV(0.2, Hh, 2 * B, 3, 3), M.planks, s * A, Hh / 2, 0); rectCol(r, s * A - 0.2, s * A + 0.2, -B, B); }
    }
    // lona listrada por dentro
    if (P.role !== 'bierplatz') {
      const m = P.role === 'essen' ? M.bayern : M.festa;
      k.add(drape(2 * A - 0.4, 2 * B - 0.4, nb, 1.1), m, 0, Hh - 0.15, 0);
    }
    // palco (Festhalle / Zelt / Kerb) na ponta +A
    let tablesEnd = A - 3;
    if (P.role === 'festhalle' || P.role === 'zelt' || P.role === 'kerb') {
      const D = P.role === 'festhalle' ? 12 : 7, Wd = Math.min(2 * B - 3, P.role === 'festhalle' ? 22 : 14);
      k.add(boxUV(D, 1.2, Wd, 2, 2), M.black, A - D / 2 - 0.5, 0, 0);
      k.add(boxUV(0.4, Hh - 1.5, Wd, 2, 2), M.black, A - 0.7, 1.2 + (Hh - 1.5) / 2, 0);
      for (const z of [-Wd / 2, Wd / 2]) k.add(boxUV(0.5, Hh, 0.5, 0.5, 1), M.silver, A - D - 0.5, Hh / 2, z);
      k.add(boxUV(0.5, 0.5, Wd, 0.5, 1), M.silver, A - D - 0.5, Hh - 0.6, 0);
      rectCol(r, A - D - 0.5, A, -Wd / 2, Wd / 2);
      tablesEnd = A - D - 3;
    }
    // balcões de chope
    if (P.role !== 'bierplatz') {
      const bw = Math.min(2 * A * 0.35, 18), bx = -A + 2 + bw / 2;
      k.add(boxUV(bw, 1.1, 1.0, 2, 2), M.yellow, bx, 0, -B + 1.4);
      const st = new THREE.Mesh(new THREE.PlaneGeometry(bw, 0.8), lambert(0xffffff, { map: sign('CHOPE', 512, 64, '#f2b01e', '#1b1b1b', '900 46px Rubik, Arial Black') }));
      st.position.set(bx, 0.55, -B + 1.91); g.add(st);
      rectCol(r, bx - bw / 2, bx + bw / 2, -B + 0.9, -B + 1.9);
    }
    // mesas comunitárias
    if (P.role !== 'bierplatz') addTables(r, -A + 4, tablesEnd, -B + 3.5, B - 2.5, y);
    else addTables(r, -A + 5, A - 4, -B + 3, B - 3, y);
    k.build(g);
    const names = { festhalle: 'Festhalle', kerb: 'Kerb', zelt: 'Oktoberzelt', essen: 'Essenplatz', restaurant: 'Oktober Restaurant', bierplatz: 'Bierplatz' };
    // placa na fachada
    const sw = Math.min(2 * B * 0.5, 10), sp = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 0.25), lambert(0xffffff, { map: sign(names[P.role].toUpperCase()) }));
    sp.position.set(-A - 0.2, Hh + (closedEnds ? 1.2 : -0.6), 0); sp.rotation.y = -PI / 2; g.add(sp);
    const [lx, lz] = toW(r, 0, 0); label(names[P.role], lx, y + Hh + 8, lz, 10, 500);
    P.y = y; P.r = r;
  }

  /* ---------- Vila Germânica: casinhas em enxaimel com telhado laranja e floreiras ---------- */
  for (const o of O.houses) {
    const r = rectOf(o.b); if (!r) continue;
    const y = floorY(r, 0.3), g = frame(r, y), k = new Kit(), A = r.a, B = r.b, h = 3.2;
    k.add(boxUV(2 * A, h + 1, 2 * B, 3, 3.2), M.enx, 0, h / 2 - 0.5, 0);
    const tri = gable(k, 2 * A, 2 * B + 1.6, h, B * 0.7, M.tile, 0.5);
    for (const s of [-1, 1]) k.add(tri, M.enx, s * A, h, 0, PI / 2);
    // varanda com postes de um lado
    for (let x = -A + 1; x <= A - 1; x += 3) k.add(boxUV(0.18, h, 0.18, 1, 3), M.darkWood, x, h / 2, B + 0.9);
    for (let x = -A + 1.5; x < A - 1; x += 3) {
      k.add(boxUV(1.1, 0.3, 0.3, 1, 1), M.darkWood, x, 0.7, B + 0.15);
      for (let f = 0; f < 4; f++) k.add(new THREE.SphereGeometry(0.12, 5, 4), [M.red, lambert(0xf2c12e), lambert(0xe2557a)][f % 3], x - 0.38 + f * 0.25, 1.05, B + 0.15);
      k.add(new THREE.PlaneGeometry(0.9, 1.0), M.darkWood, x, 1.6, B + 0.02);  // janela/porta de madeira
    }
    k.build(g);
    colliders.push({ p: [toW(r, -A, -B), toW(r, A, -B), toW(r, A, B), toW(r, -A, B)] });
  }

  /* ---------- pórtico "Bem-vindos / Willkommen" ---------- */
  if (O.portal) {
    const p = O.portal, r = { cx: p.x, cz: p.z, Lx: -p.oz, Lz: p.ox, a: 9, b: 3 };   // x local ao longo da fachada, z local para dentro
    const y = floorY(r, 0.5), g = frame(r, y), k = new Kit();
    const front = -1;   // a rua fica do lado +o → z local negativo? (normal da fachada = (ox,oz) = -T)
    const oct = (rad, h) => new THREE.CylinderGeometry(rad, rad, h, 8, 1, false, PI / 8);
    for (const s of [-1, 1]) {
      const tx = s * 6.5;
      const tw = oct(2.6, 9); const uv = tw.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 5.5, uv.getY(i) * 3);
      k.add(tw, M.enx, tx, 4.5 - 1, 0);
      k.add(new THREE.CylinderGeometry(3.2, 3.2, 0.25, 8, 1, false, PI / 8), M.darkWood, tx, 3.6, 0);
      const rail = new THREE.CylinderGeometry(3.15, 3.15, 1.0, 8, 1, true, PI / 8); k.add(rail, M.lattice, tx, 4.25, 0);
      k.add(oct(2.9, 0.4), M.darkWood, tx, 8.0, 0);
      k.add(new THREE.ConeGeometry(3.4, 3.4, 8, 1, false, PI / 8), M.tile, tx, 9.9, 0);
      for (let w = 0; w < 4; w++) { const a = PI / 8 + w * PI / 4 + PI; k.add(new THREE.PlaneGeometry(1.0, 1.3), M.glass, tx + Math.sin(a) * 2.62, 6.3, Math.cos(a) * 2.62, a); }
      colliders.push({ circle: [...toW(r, tx, 0), 2.8] });
    }
    // bloco central sobre a passagem
    k.add(boxUV(8.5, 2.6, 3.5, 3, 3), M.enx, 0, 7.6, 0);
    const tri = gable(k, 8.5, 4.4, 8.9, 2.2, M.tile, 0.4);
    for (const s of [-1, 1]) k.add(tri, M.enx, s * 4.25, 8.9, 0, PI / 2);
    // janela triangular de vidro na frente
    const gt = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-1.2, 0), new THREE.Vector2(1.2, 0), new THREE.Vector2(0, 1.5)]));
    k.add(gt, M.glass, 0, 9.0, front * 1.8, front > 0 ? 0 : PI);
    // faixa vermelha
    const bm = lambert(0xffffff, { map: bannerTex() });
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 3.2), bm); ban.position.set(0, 5.4, front * 1.8); ban.rotation.y = front > 0 ? 0 : PI; g.add(ban);
    // cercas de ferro dos lados
    for (const s of [-1, 1]) for (let i = 0; i < 12; i++) k.add(boxUV(0.06, 1.8, 0.06, 1, 1), M.black, s * (9.8 + i * 0.5), 0.9, 0);
    for (const s of [-1, 1]) k.add(boxUV(6, 0.08, 0.08, 1, 1), M.black, s * 12.5, 1.7, 0);
    k.build(g);
    label('Oktoberfest · Bem-vindos', p.x, y + 15, p.z, 16, 1500);
  }

  /* ---------- áreas abertas: biergarten, Lichterwinkel, Spielplatz ---------- */
  const obst = [];
  for (const o of O.all) obst.push(o.b.p);
  for (const P of O.pav) if (P.r) { const r = P.r; obst.push([toW(r, -r.a - 2, -r.b - 2), toW(r, r.a + 2, -r.b - 2), toW(r, r.a + 2, r.b + 2), toW(r, -r.a - 2, r.b + 2)]); }
  const roads = []; for (const rd of world.roads) for (let i = 0; i < rd.p.length - 1; i++) roads.push([rd.p[i], rd.p[i + 1], rd.w / 2 + 1]);
  const clearance = (x, z) => {
    let d = 40;
    for (const p of obst) { if (inPoly(x, z, p)) return 0; for (let i = 0; i < p.length; i++) { const q = segClosest(x, z, p[i], p[(i + 1) % p.length]); d = Math.min(d, Math.hypot(q[0] - x, q[1] - z)); } }
    for (const [a, b, w] of roads) { const q = segClosest(x, z, a, b); d = Math.min(d, Math.hypot(q[0] - x, q[1] - z) - w); }
    for (let i = 0; i < O.park.length; i += 3) { const q = O.park[i]; d = Math.min(d, Math.hypot(q[0] - x, q[1] - z) + 0); }
    return d;
  };
  const cands = [];
  const xs = O.core.map(q => q[0]), zs = O.core.map(q => q[1]);
  for (let x = Math.min(...xs); x < Math.max(...xs); x += 4) for (let z = -900; z < Math.max(...zs); z += 4) if (O.inCore(x, z)) { const c = clearance(x, z); if (c > 7) cands.push([x, z, c]); }
  cands.sort((p, q) => q[2] - p[2]);
  const spots = [];
  for (const c of cands) { if (spots.every(s => Math.hypot(s[0] - c[0], s[1] - c[1]) > s[2] + c[2] - 2)) spots.push(c); if (spots.length >= 4) break; }
  const [sBier, sSpiel, sLicht, sDorf] = spots;
  const scatter = (s, kind, n) => {
    if (!s) return;
    const R = Math.min(s[2] - 2, 22);
    for (let i = 0; i < n; i++) {
      const a = i * 2.399, rr = Math.sqrt((i + 0.5) / n) * R, x = s[0] + Math.cos(a) * rr, z = s[1] + Math.sin(a) * rr;
      umbrellas[kind].push([x, H(x, z), z, a]);
      colliders.push({ circle: [x, z, 0.6] });
    }
    // varais de lâmpadas em volta
    const poles = 6; const ps = [];
    for (let i = 0; i < poles; i++) { const a = i / poles * PI * 2, x = s[0] + Math.cos(a) * (R + 1.5), z = s[1] + Math.sin(a) * (R + 1.5); ps.push([x, H(x, z), z]); lightPoles.push([x, H(x, z), z]); }
    for (let i = 0; i < poles; i++) { stringLights(ps[i], ps[(i + 2) % poles]); stringLights(ps[i], ps[(i + 1) % poles]); }
  };
  function stringLights(a, b) {
    const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(4, Math.round(L / 1.2));
    for (let i = 1; i < n; i++) { const t = i / n, sag = Math.sin(PI * t) * Math.min(1.5, L * 0.05); bulbs.push([a[0] + (b[0] - a[0]) * t, a[1] + 5 + (b[1] - a[1]) * t - sag, a[2] + (b[2] - a[2]) * t]); }
  }
  scatter(sBier, 'green', 24);
  scatter(sLicht, 'yellow', 14);
  if (sBier) label('Biergarten', sBier[0], H(sBier[0], sBier[1]) + 9, sBier[1], 9, 350);
  if (sLicht) label('Lichterwinkel', sLicht[0], H(sLicht[0], sLicht[1]) + 9, sLicht[1], 9, 350);

  /* ---------- Spielplatz: roda-gigante e carrossel ---------- */
  if (sSpiel) {
    const k = new Kit(), gy = H(sSpiel[0], sSpiel[1]);
    const g = new THREE.Group(); g.position.set(sSpiel[0], gy, sSpiel[1]); root.add(g);
    const wheelR = Math.min(10, sSpiel[2] - 3);
    const holder = new THREE.Group(); holder.position.set(-wheelR * 0.4, wheelR + 2, 0); holder.userData.dynamic = true; g.add(holder);
    for (const s of [-1, 1]) for (const z of [-1.6, 1.6]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, wheelR + 3, 6), M.white); leg.position.set(s * (wheelR * 0.28), -(wheelR + 2) / 2, z); leg.rotation.z = s * 0.28; holder.add(leg); }
    const wheel = new THREE.Group(); holder.add(wheel);
    for (const z of [-1.2, 1.2]) { const t = new THREE.Mesh(new THREE.TorusGeometry(wheelR, 0.18, 6, 48), M.white); t.position.z = z; wheel.add(t); }
    const cabCols = [M.red, M.white, M.red, lambert(0xf2c12e)], cabins = [];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * PI * 2, sp = new THREE.Mesh(new THREE.BoxGeometry(0.12, wheelR, 0.12), M.white);
      sp.position.set(Math.cos(a) * wheelR / 2, Math.sin(a) * wheelR / 2, 0); sp.rotation.z = a - PI / 2; wheel.add(sp);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.5, 10), cabCols[i % 4]); c.position.set(Math.cos(a) * wheelR, Math.sin(a) * wheelR - 1.0, 0); c.castShadow = true; wheel.add(c); cabins.push(c);
    }
    const lit = lambert(0xffffff, { emissive: 0xffe08a, emissiveIntensity: 0 });
    for (let i = 0; i < 32; i++) { const a = i / 32 * PI * 2, b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), lit); b.position.set(Math.cos(a) * wheelR, Math.sin(a) * wheelR, 1.3); wheel.add(b); }
    updaters.push((dt, s) => { wheel.rotation.z += dt * 0.12; for (const c of cabins) c.rotation.z = -wheel.rotation.z; lit.emissiveIntensity = s.night * 2; });
    colliders.push({ circle: [sSpiel[0] - wheelR * 0.4, sSpiel[1], 3] });
    // carrossel
    const cx = wheelR * 0.75, car = new THREE.Group(); car.position.set(cx, 0, 0); g.add(car);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.5, 20), M.white); base.position.y = 0.25; car.add(base);
    const top = new THREE.Mesh(new THREE.ConeGeometry(4.8, 2.2, 20), lambert(0xffffff, { map: stripes(['#c4161f', '#f6f6f2', '#3f8fd8', '#f2b01e'], 16) })); top.position.y = 5.2; car.add(top);
    const spin = new THREE.Group(); spin.userData.dynamic = true; car.add(spin);
    for (let i = 0; i < 10; i++) { const a = i / 10 * PI * 2; const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 6), lambert(0xd8b445)); pole.position.set(Math.cos(a) * 3.3, 2.5, Math.sin(a) * 3.3); spin.add(pole);
      const horse = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 1.2), [M.white, lambert(0x8a5a32)][i % 2]); horse.position.set(Math.cos(a) * 3.3, 1.6, Math.sin(a) * 3.3); horse.rotation.y = -a; spin.add(horse); }
    updaters.push((dt) => { spin.rotation.y += dt * 0.6; });
    colliders.push({ circle: [sSpiel[0] + cx, sSpiel[1], 4.5] });
    k.build(g);
    label('Spielplatz', sSpiel[0], gy + wheelR * 2 + 6, sSpiel[1], 9, 600);
  }

  /* ---------- Vila Germânica: Maibaum (mastro) e coração da foto ---------- */
  const dorf = sDorf || spots[0];
  if (dorf) {
    const gy = H(dorf[0], dorf[1]), g = new THREE.Group(); g.position.set(dorf[0], gy, dorf[1]); root.add(g);
    const spiral = tex(32, 256, (c) => { c.fillStyle = '#f6f6f2'; c.fillRect(0, 0, 32, 256); c.fillStyle = '#3f8fd8'; for (let y = -32; y < 256; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(32, y + 16); c.lineTo(32, y + 32); c.lineTo(0, y + 16); c.fill(); } }, true);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 18, 10), lambert(0xffffff, { map: spiral })); pole.position.y = 9; pole.castShadow = true; g.add(pole);
    for (let i = 0; i < 5; i++) {
      const y = 6 + i * 2.2, bar = new THREE.Mesh(new THREE.BoxGeometry(3.2 - i * 0.3, 0.08, 0.08), M.darkWood); bar.position.y = y; bar.rotation.y = i * 0.6; g.add(bar);
      for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.04), M.white); b.position.set(Math.cos(i * 0.6) * s * (1.4 - i * 0.13), y - 0.35, -Math.sin(i * 0.6) * s * (1.4 - i * 0.13)); b.rotation.y = i * 0.6; g.add(b); }
    }
    const wr = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.25, 6, 16), M.leaf); wr.position.y = 17.2; wr.rotation.x = PI / 2; g.add(wr);
    // coração de moldura (ponto de foto)
    const heart = new THREE.Shape(); heart.moveTo(0, -1.6); heart.bezierCurveTo(-3.2, 0.6, -1.8, 2.8, 0, 1.4); heart.bezierCurveTo(1.8, 2.8, 3.2, 0.6, 0, -1.6);
    const hole = new THREE.Path(); hole.moveTo(0, -1.0); hole.bezierCurveTo(-2.4, 0.6, -1.4, 2.1, 0, 1.0); hole.bezierCurveTo(1.4, 2.1, 2.4, 0.6, 0, -1.0); heart.holes.push(hole);
    const hm = new THREE.Mesh(new THREE.ExtrudeGeometry(heart, { depth: 0.12, bevelEnabled: false }), lambert(0xffffff, { map: stripes(['#1b1b1b', '#c4161f', '#f2a81e'], 8) }));
    hm.position.set(4, 1.8, 0); hm.scale.setScalar(1.1); g.add(hm);
    colliders.push({ circle: [dorf[0], dorf[1], 0.5] });
    label('Germanisches Dorf', dorf[0], gy + 21, dorf[1], 9, 400);
  }

  /* ---------- instâncias: mesas, guarda-sóis, lâmpadas ---------- */
  const wood = M.wood, d = new THREE.Object3D();
  const merge = (parts) => mergeGeometries(parts.map(([g2, x, y, z]) => { const q = g2.clone(); q.translate(x, y, z); return q; }));
  if (tables.length) {
    const tg = merge([[new THREE.BoxGeometry(2.2, 0.06, 0.75), 0, 0.76, 0], [new THREE.BoxGeometry(2.2, 0.05, 0.28), 0, 0.45, 0.62], [new THREE.BoxGeometry(2.2, 0.05, 0.28), 0, 0.45, -0.62],
      [new THREE.BoxGeometry(0.08, 0.74, 1.5), -0.9, 0.37, 0], [new THREE.BoxGeometry(0.08, 0.74, 1.5), 0.9, 0.37, 0]]);
    const im = new THREE.InstancedMesh(tg, wood, tables.length);
    tables.forEach(([x, y, z, ry], i) => { d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.castShadow = im.receiveShadow = true; root.add(im);
  }
  const umbGeo = new THREE.ConeGeometry(1.9, 0.6, 8).translate(0, 2.6, 0);
  const setG = merge([[new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5), 0, 1.3, 0], [new THREE.CylinderGeometry(0.55, 0.55, 0.05, 10), 0, 0.74, 0], [new THREE.CylinderGeometry(0.06, 0.08, 0.72, 6), 0, 0.36, 0],
    [new THREE.BoxGeometry(0.42, 0.05, 0.42), 0.95, 0.45, 0], [new THREE.BoxGeometry(0.05, 0.45, 0.42), 1.15, 0.68, 0], [new THREE.BoxGeometry(0.42, 0.05, 0.42), -0.95, 0.45, 0], [new THREE.BoxGeometry(0.05, 0.45, 0.42), -1.15, 0.68, 0]]);
  const allU = [...umbrellas.green, ...umbrellas.yellow, ...umbrellas.beige];
  if (allU.length) {
    const im = new THREE.InstancedMesh(setG, wood, allU.length);
    allU.forEach(([x, y, z, a], i) => { d.position.set(x, y, z); d.rotation.set(0, a, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.castShadow = true; root.add(im);
    for (const [kind, col] of [['green', 0x4f9e3a], ['yellow', 0xf2b01e], ['beige', 0xefe6d2]]) {
      const L = umbrellas[kind]; if (!L.length) continue;
      const um = new THREE.InstancedMesh(umbGeo, lambert(col, { side: THREE.DoubleSide }), L.length);
      L.forEach(([x, y, z, a], i) => { d.position.set(x, y, z); d.rotation.set(0, a, 0); d.updateMatrix(); um.setMatrixAt(i, d.matrix); });
      um.castShadow = true; root.add(um);
    }
  }
  if (lightPoles.length) {
    const pm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 5.4, 6).translate(0, 2.7, 0), M.darkWood, lightPoles.length);
    lightPoles.forEach(([x, y, z], i) => { d.position.set(x, y, z); d.rotation.set(0, 0, 0); d.updateMatrix(); pm.setMatrixAt(i, d.matrix); });
    root.add(pm);
  }
  if (bulbs.length) {
    const bm = new THREE.MeshLambertMaterial({ color: 0xfff6dc, emissive: 0xffd58a, emissiveIntensity: 0.2 });
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 6, 4), bm, bulbs.length);
    bulbs.forEach(([x, y, z], i) => { d.position.set(x, y, z); d.rotation.set(0, 0, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    root.add(im);
    updaters.push((dt, s) => { bm.emissiveIntensity = 0.2 + s.night * 2.2; });
  }
}

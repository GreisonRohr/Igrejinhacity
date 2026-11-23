// Praça Dona Luísa (centro de Igrejinha), refeita a partir das fotos do diretor (Street View abr/2026 e TripAdvisor):
// piso de lajotas de pedra, canteiros elevados com árvores grandes de copa larga, pérgola de madeira com trepadeira e
// bancos, monumento com 4 mastros sobre canteiro revestido de madeira, totem do relógio, prédio enxaimel
// "Erni Engelmann" (frente para a Rua Coberta), feira do produtor, lampiões pretos, pedra grande com banco vermelho,
// floreiras redondas, parquinho, o Arroio Koetz com muros de pedra e ponte de madeira, e o carrinho do pipoqueiro.
import * as THREE from 'three';
import { Kit, lambert, tex, inPoly, segClosest } from './landmarks3d.js';

const PI = Math.PI;

/* ------------------------------ texturas ------------------------------ */
const paverTex = () => tex(256, 256, (c, w, h) => {
  // lajotas de pedra (basalto/arenito claro) em fiadas desencontradas, juntas escuras
  c.fillStyle = '#8f8a82'; c.fillRect(0, 0, w, h);
  let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < h; y += 32) for (let x = ((y / 32) % 2) * -24; x < w; x += 48) {
    const v = 150 + r() * 40 | 0; c.fillStyle = `rgb(${v},${v - 4},${v - 10})`; c.fillRect(x + 2, y + 2, 44, 28);
    c.fillStyle = 'rgba(0,0,0,0.06)'; c.fillRect(x + 2 + r() * 30, y + 4 + r() * 18, 8, 5);
  }
}, true);
const woodCladTex = () => tex(128, 64, (c, w, h) => {
  c.fillStyle = '#8a6448'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 12) { c.fillStyle = y % 24 ? '#7d5a40' : '#94704f'; c.fillRect(0, y, w, 11); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, y + 11, w, 1); }
  for (let x = 0; x < w; x += 9) { c.fillStyle = 'rgba(60,35,20,0.12)'; c.fillRect(x, 0, 1, h); }
}, true);
// fotos da Prefeitura (notícia 1188, 2026): madeira clara cor de mel; painéis com mãos-francesas escuras em X
const honeyTex = () => tex(128, 64, (c, w, h) => {
  c.fillStyle = '#c99a5c'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) { c.fillStyle = x % 32 ? '#bf8f52' : '#d2a467'; c.fillRect(x, 0, 15, h); c.fillStyle = 'rgba(70,40,15,0.35)'; c.fillRect(x + 15, 0, 1, h); }
}, true);
const xPanelTex = () => tex(128, 128, (c, w, h) => {
  c.fillStyle = '#cf9e60'; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) { c.fillStyle = 'rgba(80,45,15,0.18)'; c.fillRect(x, 0, 1, h); }
  c.fillStyle = '#7a4e28'; c.fillRect(0, 0, w, 8); c.fillRect(0, h - 8, w, 8); c.fillRect(0, 0, 8, h); c.fillRect(w - 8, 0, 8, h);
  c.strokeStyle = '#7a4e28'; c.lineWidth = 8; c.beginPath(); c.moveTo(6, 6); c.lineTo(w - 6, h - 6); c.moveTo(w - 6, 6); c.lineTo(6, h - 6); c.stroke();
}, true);
const brickTex = () => tex(128, 64, (c, w, h) => {
  c.fillStyle = '#d8d0c4'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 10) for (let x = ((y / 10) % 2) * -11; x < w; x += 22) { c.fillStyle = ['#a9583c', '#9c4d33', '#b5643f'][(x + y) % 3]; c.fillRect(x + 1, y + 1, 20, 8); }
}, true);
const totemTex = () => tex(64, 256, (c, w, h) => {
  // coluna do relógio: blocos marrom-avermelhados e brancos alternados (como enxaimel)
  c.fillStyle = '#f2efe8'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) if (((x + y) / 32) % 2) { c.fillStyle = '#9a4a2e'; c.fillRect(x + 3, y + 3, 26, 26); }
});
const clockTex = () => tex(64, 64, (c, w) => {
  c.fillStyle = '#f7f5ee'; c.beginPath(); c.arc(32, 32, 30, 0, 7); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 3; c.stroke();
  c.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = i / 12 * PI * 2; c.fillRect(32 + Math.sin(a) * 24 - 1, 32 - Math.cos(a) * 24 - 1, 3, 3); }
  c.lineWidth = 3; c.beginPath(); c.moveTo(32, 32); c.lineTo(32, 14); c.moveTo(32, 32); c.lineTo(45, 36); c.stroke();
});
const railTex = () => tex(128, 64, (c, w, h) => {
  // guarda-corpo de madeira em X (varanda do Erni Engelmann)
  c.strokeStyle = '#b8783e'; c.lineWidth = 7;
  c.strokeRect(4, 4, w - 8, h - 8);
  c.beginPath(); c.moveTo(4, 4); c.lineTo(w / 2, h - 4); c.lineTo(w - 4, 4); c.moveTo(4, h - 4); c.lineTo(w / 2, 4); c.lineTo(w - 4, h - 4); c.stroke();
});
const gableWoodTex = () => tex(256, 256, (c, w, h) => {
  c.fillStyle = '#c98a4a'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(80,40,10,0.35)'; c.lineWidth = 2; for (let x = 0; x < w; x += 12) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
  // vidros do oitão
  c.fillStyle = '#2d3a44'; c.fillRect(w * 0.22, h * 0.45, w * 0.56, h * 0.45);
  c.strokeStyle = '#c98a4a'; c.lineWidth = 6; for (let x = w * 0.22; x <= w * 0.78; x += w * 0.14) { c.beginPath(); c.moveTo(x, h * 0.45); c.lineTo(x, h * 0.9); c.stroke(); }
  c.strokeStyle = '#6e3c18'; c.lineWidth = 10; c.beginPath(); c.moveTo(w / 2, 10); c.lineTo(w / 2, h * 0.45); c.moveTo(w * 0.18, h * 0.62); c.lineTo(w / 2, h * 0.3); c.lineTo(w * 0.82, h * 0.62); c.stroke();
  c.fillStyle = '#6e3c18'; c.fillRect(0, h - 26, w, 26);
  c.fillStyle = '#f0d9b0'; c.font = 'bold 18px serif'; c.textAlign = 'center'; c.fillText('E r n i   E n g e l m a n n', w / 2, h - 7);
});
const bannerTex = () => tex(256, 128, (c, w, h) => {
  c.fillStyle = '#f19a2e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff3d6'; c.fillRect(8, 8, w - 16, h - 16);
  c.fillStyle = '#7a3a12'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText('FESTIVAL DE', 70, 46); c.fillText('CERVEJA', 70, 70); c.font = '13px sans-serif'; c.fillText('E GASTRONOMIA', 70, 92);
  c.fillStyle = '#2f6a3a'; c.beginPath(); c.arc(175, 60, 32, 0, 7); c.fill(); c.fillStyle = '#f2c12e'; c.beginPath(); c.arc(175, 60, 20, 0, 7); c.fill();
});
const flagPanelTex = () => tex(64, 128, (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w / 3, h); c.fillStyle = '#d4202a'; c.fillRect(w / 3, 0, w / 3, h); c.fillStyle = '#f3c614'; c.fillRect(2 * w / 3, 0, w / 3, h); });
const pipocaTex = () => tex(256, 48, (c, w, h) => { c.fillStyle = '#d6232a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 26px serif'; c.textAlign = 'center'; c.fillText('PIPOCA E BATATA', w / 2, 34); });

/* ------------------------------ peças ------------------------------ */
/**
 * ctx: { root, colliders, updaters, seats, H, world, poly (praça), erni (canto Erni Engelmann) }
 * Devolve { pipoca: {x, y, z, face}, parking: [{x, z, yaw}] }.
 */
export function buildPraca(ctx) {
  const { root, colliders, updaters, seats, H, world, poly } = ctx;
  const erni = ctx.erni || [];
  const g = new THREE.Group(); root.add(g);
  const k = new Kit(), kd = new Kit();          // kd: detalhes chapados sem sombra (placas, mostradores)
  const inside = (x, z) => inPoly(x, z, poly) || (erni.length && inPoly(x, z, erni));
  const xs = [...poly, ...erni].map(q => q[0]), zs = [...poly, ...erni].map(q => q[1]);
  const X0 = Math.min(...xs), X1 = Math.max(...xs), Z0 = Math.min(...zs), Z1 = Math.max(...zs);
  const M = {
    wood: lambert(0x6b4a33), darkWood: lambert(0x4a2f1f), concrete: lambert(0xd8d4cc), white: lambert(0xf3f1ea), stone: lambert(0x8a8170),
    grass: lambert(0x5f8f3e), shrub: lambert(0x3f7330), shrub2: lambert(0x4e8a3a), vine: lambert(0x4d8a36), pinkFlower: lambert(0xd86aa0),
    red: lambert(0xc8282d), yellow: lambert(0xf2c12e), blue: lambert(0x2f6fd0), black: lambert(0x1d1f22), metal: lambert(0x55595e),
    pedestal: lambert(0xb9b6ae), plaque: lambert(0x9c9890), glassDark: lambert(0x2d3a44), roofSlate: lambert(0x4b4f55), roofTile: lambert(0x7a3a28),
    rock: lambert(0x8c6f55), sand: lambert(0xe3d3a8), fruitR: lambert(0xd23a2a), fruitG: lambert(0x7ab83a), fruitO: lambert(0xf09a20), fruitY: lambert(0xf2d03a),
    lightWood: lambert(0xc08a52), yellowCurb: lambert(0xe8b923), restroom: lambert(0xf2f2ee),
    clad: new THREE.MeshLambertMaterial({ map: woodCladTex() }), honey: new THREE.MeshLambertMaterial({ map: honeyTex() }), xpanel: new THREE.MeshLambertMaterial({ map: xPanelTex() }), brick: new THREE.MeshLambertMaterial({ map: brickTex() }),
    totem: new THREE.MeshLambertMaterial({ map: totemTex() }), clock: new THREE.MeshLambertMaterial({ map: clockTex() }),
    rail: new THREE.MeshLambertMaterial({ map: railTex(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
    gable: new THREE.MeshLambertMaterial({ map: gableWoodTex(), side: THREE.DoubleSide }), banner: new THREE.MeshLambertMaterial({ map: bannerTex() }),
    flag: new THREE.MeshLambertMaterial({ map: flagPanelTex() }), pipoca: new THREE.MeshLambertMaterial({ map: pipocaTex(), side: THREE.DoubleSide }),
  };
  M.clad.map.repeat.set(4, 1); M.brick.map.repeat.set(3, 1); M.honey.map.repeat.set(6, 2); M.xpanel.map.repeat.set(4, 1);
  const lampGlass = new THREE.MeshLambertMaterial({ color: 0xfff1c8, emissive: 0xffd27a, emissiveIntensity: 0 });
  updaters.push((dt, s) => { lampGlass.emissiveIntensity = s.night * 1.5; });
  const Y = (x, z) => H(x, z);
  const solids = [];                                   // áreas ocupadas (piso não vira canteiro, árvores não nascem)
  const occupy = (x0, z0, x1, z1) => solids.push([x0, z0, x1, z1]);
  const occupied = (x, z, m = 0) => solids.some(([a, b, c, d]) => x > a - m && x < c + m && z > b - m && z < d + m);
  const rectCol = (x0, z0, x1, z1) => colliders.push({ p: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] });

  /* ---------- arroio Koetz: muros de pedra e ponte de madeira (mantidos) ---------- */
  const stream = [];
  const cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  for (const w of world.water) if (w.k === 'stream' && /Koetz/.test(w.n || '')) for (let i = 0; i < w.p.length - 1; i++) {
    const a = w.p[i], b = w.p[i + 1];
    if (inside(a[0], a[1]) || inside(b[0], b[1]) || Math.hypot((a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cz) < 45) stream.push([a, b]);
  }
  const nearStream = (x, z, d) => stream.some(([a, b]) => { const q = segClosest(x, z, a, b); return Math.hypot(q[0] - x, q[1] - z) < d; });
  // valão (fotos TripAdvisor): paredes verticais de pedra e concreto ~2,2 m, leito de cascalho, margem plana no nível
  // da rua. O terreno é escavado largo e plano (city.valaoZones); aqui o piso das margens fica na altura original.
  const streamD = (x, z) => { let best = null; for (const [a, b] of stream) { const q = segClosest(x, z, a, b), d = Math.hypot(q[0] - x, q[1] - z); if (!best || d < best.d) best = { d, q }; } return best; };
  const Yb = (x, z) => {   // altura da margem: amostra fora da escavação, do mesmo lado
    const s2 = streamD(x, z); if (!s2 || s2.d > 9) return H(x, z);
    const dx = x - s2.q[0], dz = z - s2.q[1], L = Math.hypot(dx, dz) || 1;
    return H(s2.q[0] + dx / L * 9, s2.q[1] + dz / L * 9);
  };
  const WALL = 2.8, gravel = lambert(0x8c8478), conc = lambert(0x9a958b);
  const waterM = new THREE.MeshPhongMaterial({ color: 0x5f6f62, specular: 0x9fb8c8, shininess: 70, transparent: true, opacity: 0.85 });
  for (const [a, b] of stream) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, ry = Math.atan2(-uz, ux);
    const n = Math.max(1, Math.ceil(L / 4));
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n, cx2 = a[0] + (b[0] - a[0]) * t, cz2 = a[1] + (b[1] - a[1]) * t;
      for (const s of [-1, 1]) {
        const mx = cx2 - uz * s * (WALL + 0.25), mz = cz2 + ux * s * (WALL + 0.25), yb = Yb(mx - uz * s * 2, mz + ux * s * 2);
        k.add(new THREE.BoxGeometry(L / n + 0.05, 2.6, 0.5), s > 0 ? M.stone : conc, mx, yb - 1.2, mz, ry);
        // faixa de margem com vegetação baixa cobrindo a borda da escavação até o piso
        const gx = cx2 - uz * s * (WALL + 2.0), gz = cz2 + ux * s * (WALL + 2.0);
        k.add(new THREE.BoxGeometry(L / n + 0.05, 1.2, 3.1), M.grass, gx, yb - 0.55, gz, ry);
        if ((j + (s > 0 ? 1 : 0)) % 2 === 0) k.add(new THREE.IcosahedronGeometry(0.5, 0), M.shrub2, gx, yb + 0.2, gz, j, 0, 0, 1.4, 0.6, 1.2);
      }
      const yb = Math.min(Yb(cx2 - uz * 5, cz2 + ux * 5), Yb(cx2 + uz * 5, cz2 - ux * 5));
      k.add(new THREE.BoxGeometry(L / n + 0.05, 0.6, WALL * 2), gravel, cx2, yb - 2.2, cz2, ry);   // leito (topo 1,9 m abaixo)
      k.add(new THREE.BoxGeometry(L / n + 0.05, 0.06, 2.2), waterM, cx2 + uz * 1.4, yb - 1.86, cz2 - ux * 1.4, ry);   // lâmina d'água rasa junto a uma parede
      for (let r = 0; r < 1; r++) { const o = ((j * 7 + r * 3) % 9) / 9 - 0.5; k.add(new THREE.DodecahedronGeometry(0.18 + r * 0.06, 0), M.rock, cx2 + ux * o * 2 - uz * o * 3, yb - 1.85, cz2 + uz * o * 2 + ux * o * 3); }
    }
  }
  // passarela de madeira de troncos sobre o arroio (fotos TripAdvisor), levemente arqueada, guarda-corpo em X
  const footbridges = [], decks = [], porches = [];   // porches: [x0, z0, x1, z1, y] pisos elevados (varanda do Erni)
  {
    const inner = stream.filter(([a, b]) => inside((a[0] + b[0]) / 2, (a[1] + b[1]) / 2));
    const lens = inner.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1])), tot = lens.reduce((x, y) => x + y, 0);
    const log = lambert(0xb08a5a), plank = lambert(0x8a6a48), BL = 7.5;
    for (const f of [0.3]) {   // fotos: uma passarela só, perto da João Corrêa
      let d = f * tot, i = 0; while (i < lens.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
      if (!inner[i]) continue;
      const [a, b] = inner[i], ux = (b[0] - a[0]) / lens[i], uz = (b[1] - a[1]) / lens[i], qx = a[0] + ux * d, qz = a[1] + uz * d;
      const bg = new THREE.Group(); bg.position.set(qx, Math.min(Yb(qx - uz * 5, qz + ux * 5), Yb(qx + uz * 5, qz - ux * 5)) + 0.12, qz);   // apoiada nas margens
      bg.rotation.y = Math.atan2(-uz, ux); g.add(bg);
      const bk = new Kit(), N = 6;
      for (let s2 = 0; s2 < N; s2++) {   // tabuleiro em arco
        const z0 = -BL / 2 + s2 * BL / N, z1 = z0 + BL / N, y0 = Math.sin((s2 / N) * PI) * 0.45, y1 = Math.sin(((s2 + 1) / N) * PI) * 0.45;
        bk.add(new THREE.BoxGeometry(1.8, 0.1, Math.hypot(BL / N, y1 - y0) + 0.02), plank, 0, (y0 + y1) / 2, (z0 + z1) / 2, 0, -Math.atan2(y1 - y0, BL / N));
        for (const sd of [-1, 1]) {
          bk.add(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 7), log, sd * 0.9, y0 + 0.5, z0);
          bk.add(new THREE.CylinderGeometry(0.07, 0.07, Math.hypot(BL / N, y1 - y0), 6).rotateX(PI / 2), log, sd * 0.9, (y0 + y1) / 2 + 0.95, (z0 + z1) / 2, 0, -Math.atan2(y1 - y0, BL / N));
          const xg = new THREE.CylinderGeometry(0.045, 0.045, Math.hypot(BL / N, 0.8), 5).rotateX(PI / 2); bk.add(xg, log, sd * 0.9, (y0 + y1) / 2 + 0.5, (z0 + z1) / 2, 0, 0.6);
          bk.add(xg, log, sd * 0.9, (y0 + y1) / 2 + 0.5, (z0 + z1) / 2, 0, -0.6);
        }
      }
      for (const sd of [-1, 1]) bk.add(new THREE.CylinderGeometry(0.1, 0.1, 1.1, 7), log, sd * 0.9, 0.5, BL / 2);
      bk.add(new THREE.CylinderGeometry(0.12, 0.12, BL, 7).rotateX(PI / 2), log, 0, -0.12, 0);   // viga de tronco sob o tabuleiro
      bk.build(bg);
      footbridges.push([qx, qz, -uz, ux]);   // centro e direção da travessia
      decks.push({ qx, qz, nx: -uz, nz: ux, ux, uz, y: bg.position.y, L: BL });   // tabuleiro: atravessa o arroio na direção (nx, nz)
      // guarda-corpos: não se cai da passarela para dentro do valão
      for (const sd of [-1, 1]) { const ox = ux * sd * 0.95, oz = uz * sd * 0.95, P2 = (t, w) => [qx + -uz * t + ox + ux * w, qz + ux * t + oz + uz * w];
        colliders.push({ p: [P2(-BL / 2, -0.08), P2(BL / 2, -0.08), P2(BL / 2, 0.08), P2(-BL / 2, 0.08)] }); }
    }
  }
  // paredes do valão (2,2 m, retas): ninguém desce para o leito; a passarela é a travessia
  for (const [a, b] of stream) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.1) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, n = Math.max(1, Math.ceil(L / 2));
    const A = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    // vão da passarela: entre os guarda-corpos (|w| < 0,95 m do eixo do tabuleiro) a parede fica aberta
    const open = t => { const p = A(t); return decks.some(d => Math.abs((p[0] - d.qx) * d.ux + (p[1] - d.qz) * d.uz) < 0.95 && Math.hypot(p[0] - d.qx, p[1] - d.qz) < d.L / 2 + 1); };
    const K = n * 10; let start = null;
    for (let i = 0; i <= K; i++) {
      const t = i / K, o = i < K && open((i + 0.5) / K);
      if (!o && i < K && start === null) start = t;
      if ((o || i === K) && start !== null) {
        for (const s of [-1, 1]) {
          const o0 = s * WALL, o1 = s * (WALL + 0.5), p0 = A(start), p1 = A(t), Q = (p, off) => [p[0] - uz * off, p[1] + ux * off];
          colliders.push({ p: [Q(p0, o0), Q(p1, o0), Q(p1, o1), Q(p0, o1)] });
        }
        start = null;
      }
    }
  }

  /* ---------- prédio Erni Engelmann (enxaimel, frente para a Rua Coberta) ---------- */
  // canto nordeste da praça; frente ao norte, 4 m recuado da borda
  const eN = (erni.length ? Math.min(...erni.map(q => q[1])) : Z0) + 4.5;   // borda norte + recuo
  {
    const x0 = 13, x1 = 25, z0 = eN + 2.6, z1 = z0 + 10.5, wallH = 3.3, ridge = 5.6, y = Y((x0 + x1) / 2, (z0 + z1) / 2) + 0.6;
    const mx = (x0 + x1) / 2, W = x1 - x0, D = z1 - z0;
    k.box(W + 0.4, 0.6, D + 0.4, M.brick, mx, y - 0.6, (z0 + z1) / 2);                     // embasamento de tijolo
    k.box(W, wallH, D, M.honey, mx, y, (z0 + z1) / 2);                                        // madeira cor de mel (fotos 2026)
    k.add(new THREE.BoxGeometry(W - 1.2, 2.3, 0.08), M.glassDark, mx, y + 1.35, z0 - 0.02);  // vitrine da frente
    for (let i = 0; i <= 5; i++) k.add(new THREE.BoxGeometry(0.12, 2.5, 0.14), M.darkWood, x0 + 0.6 + i * (W - 1.2) / 5, y + 1.3, z0 - 0.05);
    k.add(new THREE.BoxGeometry(W + 0.2, 0.25, 0.3), M.darkWood, mx, y + wallH - 0.1, z0 - 0.05);
    // oitão de madeira com vidros e o nome (frente), telhado de ardósia escura bem inclinado
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-W / 2 - 0.4, 0, 0, W / 2 + 0.4, 0, 0, 0, ridge, 0], 3));
    tri.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, -1, 0, 0, -1, 0, 0, -1], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([1, 0, 0, 0, 0.5, 1], 2));   // vista de frente (−z): sem espelhar o nome
    k.add(tri, M.gable, mx, y + wallH, z0 - 0.9);
    k.add(tri, M.white, mx, y + wallH, z1);
    const sl = Math.hypot(W / 2 + 1.2, ridge + 0.5), sa = Math.atan2(ridge + 0.5, W / 2 + 1.2);
    for (const s of [-1, 1]) {
      k.add(new THREE.BoxGeometry(sl, 0.2, D + 2.2), M.roofSlate, mx + s * (W / 4 + 0.3), y + wallH + ridge / 2 - 0.05, (z0 + z1) / 2 - 0.45, 0, 0, -s * sa);
      k.add(new THREE.BoxGeometry(sl, 0.35, 0.18), M.darkWood, mx + s * (W / 4 + 0.3), y + wallH + ridge / 2 - 0.2, z0 - 1.5, 0, 0, -s * sa);   // beiral frontal
    }
    // chaminé de pedra (fundo esquerdo)
    k.box(1.1, wallH + ridge + 1, 1.1, M.stone, x0 + 1.5, y, z1 - 2);
    // ala leste mais baixa (telhado escuro)
    const wx0 = x1, wx1 = Math.min(x1 + 7, X1 - 1);
    if (wx1 - wx0 > 3) {
      const wm = (wx0 + wx1) / 2, wW = wx1 - wx0;
      k.box(wW, 2.9, D - 2, M.white, wm, y, (z0 + z1) / 2 + 1);
      for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(Math.hypot(wW / 2 + 0.6, 2), 0.18, D), M.roofSlate, wm + s * (wW / 4 + 0.15), y + 3.9, (z0 + z1) / 2 + 1, 0, 0, -s * Math.atan2(2, wW / 2 + 0.6));
      kd.add(new THREE.BoxGeometry(wW * 0.35, 1.2, 0.1), M.flag, wm, y + 1.6, z0 + 1 - 0.05);   // painel preto-vermelho-amarelo
      rectCol(wx0, z0 + 1, wx1, z1); occupy(wx0, z0, wx1, z1);
    }
    // varanda de madeira com guarda-corpo em X sobre base de tijolo
    k.box(W + 1, 0.15, 2.6, M.wood, mx, y - 0.15, z0 - 1.3); porches.push([x0 - 0.5, z0 - 2.6, x1 + 0.5, z0, y]);
    k.box(W + 1, 0.6, 0.3, M.brick, mx, y - 0.6, z0 - 2.6);
    for (let i = 0; i < 9; i++) { const lx = x0 - 0.5 + (i + 0.5) * (W + 1) / 9; if (Math.abs(lx - mx) < 1) continue; kd.add(new THREE.PlaneGeometry((W + 1) / 9, 0.9), M.rail, lx, y + 0.45, z0 - 2.6); }
    kd.add(new THREE.PlaneGeometry(3.6, 1.8), M.banner, x0 + 2.6, y + 1.5, z0 - 0.08, PI);  // faixa do festival na fachada
    rectCol(x0, z0, x1, z1); occupy(x0 - 0.5, z0 - 3, x1, z1);
  }

  /* ---------- feira do produtor (à esquerda do Erni Engelmann) ---------- */
  {
    const x0 = 1, x1 = 11, z0 = eN + 3.5, z1 = z0 + 6.5, y = Y((x0 + x1) / 2, (z0 + z1) / 2), W = x1 - x0, D = z1 - z0, mx = (x0 + x1) / 2;
    k.box(W, 1.1, 0.3, M.brick, mx, y, z1); k.box(0.3, 1.1, D, M.brick, x0, y, (z0 + z1) / 2); k.box(0.3, 1.1, D, M.brick, x1, y, (z0 + z1) / 2);   // base de tijolo
    k.box(W, 2.1, 0.25, M.xpanel, mx, y + 1.1, z1); k.box(0.25, 2.1, D, M.xpanel, x0, y + 1.1, (z0 + z1) / 2); k.box(0.25, 2.1, D, M.xpanel, x1, y + 1.1, (z0 + z1) / 2);   // painéis de madeira com X
    // pérgola de metal preto com cobertura de vidro na frente (fotos 2026)
    for (let i = 0; i <= 3; i++) k.box(0.12, 3.0, 0.12, M.black, x0 + 0.3 + i * (W - 0.6) / 3, y, z0 - 2.6);
    k.box(W + 0.4, 0.14, 0.14, M.black, mx, y + 2.95, z0 - 2.6);
    for (let i = 0; i <= 6; i++) k.add(new THREE.BoxGeometry(0.08, 0.1, 2.8), M.black, x0 + i * W / 6, y + 3.1, z0 - 1.2, 0, 0.12);
    k.add(new THREE.BoxGeometry(W + 0.3, 0.04, 2.8), lambert(0xb9c8cf), mx, y + 3.17, z0 - 1.2, 0, 0.12);
    k.box(W, 1.0, 0.5, M.brick, mx, y, z0 + 0.4);                                             // balcão de tijolo
    // pilares de madeira clara na frente (fotos: R. Osvaldo Cruz 561) e telhado de uma água revestido de madeira
    for (let i = 0; i <= 4; i++) k.box(0.3, 3.4, 0.3, M.lightWood, x0 + 0.2 + i * (W - 0.4) / 4, y, z0 + 0.1);
    k.box(W + 0.6, 0.35, 0.3, M.lightWood, mx, y + 3.3, z0 + 0.05);
    const rise = 1.6, sl = Math.hypot(D + 1.6, rise), sa = Math.atan2(rise, D + 1.6);
    k.add(new THREE.BoxGeometry(W + 1.2, 0.18, sl), M.lightWood, mx, y + 3.6 + rise / 2, (z0 + z1) / 2 - 0.3, 0, -sa);
    k.add(new THREE.BoxGeometry(W + 1.3, 0.55, 0.12), M.lightWood, mx, y + 3.75 + rise, z0 - 1.05);   // testeira alta na frente
    k.box(W, rise, 0.25, M.honey, mx, y + 3.2, z1);
    // frutas e verduras em caixotes sobre o balcão
    const fr = [M.fruitR, M.fruitG, M.fruitO, M.fruitY];
    for (let i = 0; i < 8; i++) { const fx = x0 + 0.8 + i * (W - 1.6) / 7; k.box(0.9, 0.22, 0.45, M.wood, fx, y + 1.0, z0 + 0.4); for (let j = 0; j < 5; j++) k.add(new THREE.SphereGeometry(0.09, 5, 4), fr[(i + j) % 4], fx - 0.32 + j * 0.16, y + 1.3, z0 + 0.4 + ((j % 2) - 0.5) * 0.15); }
    rectCol(x0, z0 + 0.2, x1, z1); occupy(x0 - 0.5, z0 - 1, x1 + 0.5, z1 + 0.5);
  }

  /* ---------- monumento: canteiro elevado revestido de madeira, pedestal de pedra e 4 mastros ---------- */
  const mon = [X0 + 15, cz - 6];
  {
    const [mx, mz] = mon, y = Y(mx, mz), S = 8, h = 0.85;
    for (const [dx, dz, w, d] of [[0, -S / 2, S, 0.3], [0, S / 2, S, 0.3], [-S / 2, 0, 0.3, S], [S / 2, 0, 0.3, S]]) k.box(w, h, d, M.clad, mx + dx, y, mz + dz);
    k.box(S - 0.4, h - 0.1, S - 0.4, M.grass, mx, y, mz);
    for (let i = 0; i < 28; i++) { const a = i / 28 * PI * 2, r = S / 2 - 0.9; k.add(new THREE.IcosahedronGeometry(0.55, 0), i % 3 ? M.shrub : M.shrub2, mx + Math.cos(a) * r * 1.05, y + h + 0.25, mz + Math.sin(a) * r * 1.05, i, 0, 0, 1.2, 0.7, 1.2); }
    k.box(3.4, 0.25, 3.4, M.pedestal, mx, y + h - 0.1, mz);
    k.box(1.4, 0.4, 1.4, M.pedestal, mx, y + h + 0.15, mz);
    k.box(1.0, 1.7, 1.0, M.plaque, mx, y + h + 0.55, mz);
    for (const [dx, dz, ry] of [[0, 0.51, 0], [0.51, 0, PI / 2], [0, -0.51, PI], [-0.51, 0, -PI / 2]]) k.add(new THREE.BoxGeometry(0.7, 1.1, 0.03), M.pedestal, mx + dx, y + h + 1.4, mz + dz, ry);
    k.box(1.4, 0.35, 1.4, M.pedestal, mx, y + h + 2.25, mz);
    for (const [dx, dz] of [[-1.1, -2.2], [1.1, -2.2], [-2.2, 1.1], [-2.2, -1.1]]) k.add(new THREE.CylinderGeometry(0.05, 0.07, 11, 6), M.black, mx + dx, y + h + 5.5, mz + dz);
    rectCol(mx - S / 2, mz - S / 2, mx + S / 2, mz + S / 2); occupy(mx - S / 2 - 1, mz - S / 2 - 1, mx + S / 2 + 1, mz + S / 2 + 1);
  }
  /* ---------- totem do relógio ---------- */
  {
    const tx = mon[0] + 9, tz = mon[1] + 9, y = Y(tx, tz);
    k.add(new THREE.CylinderGeometry(0.75, 1.1, 0.7, 4), M.white, tx, y + 0.35, tz, PI / 4);
    k.add(new THREE.BoxGeometry(0.7, 3.6, 0.7), M.totem, tx, y + 2.5, tz);
    k.add(new THREE.BoxGeometry(0.9, 0.9, 0.9), M.white, tx, y + 4.6, tz);
    for (const [dx, dz, ry] of [[0, 0.46, 0], [0.46, 0, PI / 2], [0, -0.46, PI], [-0.46, 0, -PI / 2]]) kd.add(new THREE.CircleGeometry(0.36, 16), M.clock, tx + dx, y + 4.6, tz + dz, ry);
    k.add(new THREE.ConeGeometry(0.7, 0.6, 4), M.roofTile, tx, y + 5.35, tz, PI / 4);
    colliders.push({ circle: [tx, tz, 0.8] }); occupy(tx - 1.5, tz - 1.5, tx + 1.5, tz + 1.5);
  }

  /* ---------- pérgola de madeira com trepadeira, bancos embaixo ---------- */
  const pg = { x: cx + 1, z0: cz - 10, z1: cz + 20, w: 4.2 };
  {
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const z = pg.z0 + (pg.z1 - pg.z0) * i / n;
      for (const s of [-1, 1]) { const x = pg.x + s * pg.w / 2, y = Y(x, z); k.box(0.55, 0.6, 0.55, M.concrete, x, y, z); k.box(0.3, 2.6, 0.3, M.wood, x, y + 0.6, z); colliders.push({ circle: [x, z, 0.3] }); }
      const y = Y(pg.x, z); k.box(pg.w + 1.4, 0.28, 0.2, M.wood, pg.x, y + 3.2, z);
    }
    for (const s of [-1, 1]) { const y = Y(pg.x, (pg.z0 + pg.z1) / 2); k.box(0.25, 0.32, pg.z1 - pg.z0 + 1.2, M.wood, pg.x + s * pg.w / 2, y + 2.9, (pg.z0 + pg.z1) / 2); }
    for (let z = pg.z0; z <= pg.z1; z += 0.9) { const y = Y(pg.x, z); k.box(pg.w + 0.8, 0.12, 0.1, M.wood, pg.x, y + 3.48, z); }
    for (let i = 0; i < 30; i++) {
      const z = pg.z0 + (pg.z1 - pg.z0) * (i + 0.5) / 30, y = Y(pg.x, z), x = pg.x + ((i * 7) % 5 - 2) * 0.8;
      k.add(new THREE.IcosahedronGeometry(1, 0), i % 7 === 3 ? M.pinkFlower : M.vine, x, y + 3.75, z, i, 0, 0, 1.3, 0.45, 1.2);
    }
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
      const z = pg.z0 + 2.5 + i * (pg.z1 - pg.z0 - 5) / 4, x = pg.x + s * 1.15, y = Y(x, z);
      k.box(0.45, 0.42, 0.45, M.concrete, x, y, z - 0.6); k.box(0.45, 0.42, 0.45, M.concrete, x, y, z + 0.6); k.box(0.6, 0.1, 1.9, M.wood, x, y + 0.42, z);
      for (const o of [-0.5, 0.5]) seats.push({ x, y: y + 0.47, z: z + o, face: s > 0 ? -PI / 2 : PI / 2 });
    }
    occupy(pg.x - pg.w / 2 - 1, pg.z0 - 1, pg.x + pg.w / 2 + 1, pg.z1 + 1);
  }
  /* ---------- parquinho atrás da pérgola ---------- */
  {
    const px = pg.x + 9, pz = (pg.z0 + pg.z1) / 2 - 4;
    if (inside(px, pz) && !nearStream(px, pz, 6)) {
      const y = Y(px, pz);
      k.add(new THREE.CylinderGeometry(5.5, 5.5, 0.12, 20), M.sand, px, y + 0.06, pz);
      for (const s of [-1, 1]) { const leg = new THREE.CylinderGeometry(0.08, 0.08, 2.9, 6); k.add(leg, M.yellow, px - 2 + s * 1.4, y + 1.35, pz - 1, 0, 0, 0.25); k.add(leg, M.yellow, px - 2 + s * 1.4, y + 1.35, pz + 1, 0, 0, -0.25); }
      { const top = new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6); top.rotateZ(PI / 2); k.add(top, M.red, px - 2, y + 2.72, pz); }
      for (const s of [-1, 1]) k.box(0.5, 0.06, 0.25, M.black, px - 2 + s * 0.7, y + 0.55, pz);
      k.box(1.2, 1.6, 1.2, M.blue, px + 2.2, y, pz - 1); k.box(1.4, 0.1, 1.4, M.red, px + 2.2, y + 1.6, pz - 1);
      { const sl = new THREE.BoxGeometry(0.8, 0.08, 3.2); sl.rotateX(-0.5); k.add(sl, M.yellow, px + 2.2, y + 0.85, pz + 1.2); }
      occupy(px - 5.5, pz - 5.5, px + 5.5, pz + 5.5);
    }
  }
  /* ---------- pedra grande com banco vermelho; floreiras redondas ---------- */
  {
    const rx = X0 + 6, rz = cz + 6, y = Y(rx, rz);
    k.add(new THREE.DodecahedronGeometry(1.3, 0), M.rock, rx, y + 0.8, rz, 0.4, 0.2, 0.1, 1.3, 1, 1.1);
    k.box(1.8, 0.08, 0.5, M.red, rx + 2.4, y + 0.45, rz); k.box(1.8, 0.45, 0.06, M.red, rx + 2.4, y + 0.55, rz + 0.24);
    for (const s of [-1, 1]) k.box(0.08, 0.45, 0.45, M.black, rx + 2.4 + s * 0.8, y, rz);
    seats.push({ x: rx + 2.4, y: y + 0.49, z: rz - 0.05, face: PI });
    colliders.push({ circle: [rx, rz, 1.4] }); occupy(rx - 2, rz - 2, rx + 4, rz + 1.5);
    for (const [fx, fz] of [[X0 + 7, Z0 + 8], [X0 + 7, cz - 14], [cx - 8, Z0 + 10], [X0 + 24, cz + 4]]) {
      if (!inside(fx, fz) || occupied(fx, fz, 1.6)) continue;
      const fy = Y(fx, fz);
      k.add(new THREE.CylinderGeometry(1.6, 1.6, 0.5, 16), M.concrete, fx, fy + 0.25, fz);
      for (let i = 0; i < 9; i++) { const a = i / 9 * PI * 2; k.add(new THREE.IcosahedronGeometry(0.45, 0), i % 2 ? M.shrub2 : M.pinkFlower, fx + Math.cos(a) * 0.9, fy + 0.7, fz + Math.sin(a) * 0.9); }
      k.add(new THREE.IcosahedronGeometry(0.7, 0), M.shrub, fx, fy + 0.9, fz);
      colliders.push({ circle: [fx, fz, 1.6] }); occupy(fx - 1.7, fz - 1.7, fx + 1.7, fz + 1.7);
    }
  }

  /* ---------- banheiro público (lado da Gen. Ernesto Dorneles): branco, beiral de madeira, janelinhas altas ---------- */
  {
    const bx = X1 - 7, bz = cz + 4;
    if (inside(bx, bz) && !occupied(bx, bz, 3) && !nearStream(bx, bz, 5)) {
      const y = Y(bx, bz), W = 7, D = 5;
      k.box(W, 3, D, M.restroom, bx, y, bz);
      for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(W + 1.4, 0.15, D / 2 + 1), M.lightWood, bx, y + 3.35, bz + s * (D / 4 + 0.3), 0, s * 0.22);
      for (let i = 0; i < 3; i++) k.add(new THREE.BoxGeometry(1, 0.45, 0.05), M.lightWood, bx - 2 + i * 1.6, y + 2.3, bz - D / 2 - 0.03);
      k.add(new THREE.BoxGeometry(0.9, 2.1, 0.05), M.lightWood, bx + 2.6, y + 1.05, bz - D / 2 - 0.03);
      rectCol(bx - W / 2, bz - D / 2, bx + W / 2, bz + D / 2); occupy(bx - W / 2 - 1, bz - D / 2 - 1, bx + W / 2 + 1, bz + D / 2 + 1);
    }
  }
  /* ---------- arroio: pedras grandes na margem e cerca de ferro baixa (fotos: Gen. Ernesto Dorneles 480) ---------- */
  {
    let sd = 5;
    for (const [a, b] of stream) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      for (const side of [-1, 1]) for (let t = 1; t < L; t += 2.2) {
        const x = a[0] + ux * t - uz * side * 3.9, z = a[1] + uz * t + ux * side * 3.9; if (!inside(x, z)) continue;
        sd = (sd * 16807) % 2147483647; const r = sd / 2147483647;
        if (r < 0.45) k.add(new THREE.DodecahedronGeometry(0.45 + r * 0.5, 0), M.rock, x - uz * side * 0.8, Yb(x, z) + 0.15, z + ux * side * 0.8, r * 6, r * 3, 0, 1.3, 0.8, 1.1);
        if (!footbridges.some(f => Math.hypot(f[0] - x, f[1] - z) < 4.5)) k.add(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 4), M.metal, x - uz * side * 0.6, Yb(x, z) + 0.5, z + ux * side * 0.6);
      }
      const nearBridge = footbridges.some(f => segClosest(f[0], f[1], a, b) && Math.hypot(segClosest(f[0], f[1], a, b)[0] - f[0], segClosest(f[0], f[1], a, b)[1] - f[1]) < 1 && Math.hypot((a[0] + b[0]) / 2 - f[0], (a[1] + b[1]) / 2 - f[1]) < L / 2 + 2);
      for (const side of [-1, 1]) { const mx = (a[0] + b[0]) / 2 - uz * side * 3.3, mz = (a[1] + b[1]) / 2 + ux * side * 3.3; if (inside(mx, mz) && !nearBridge) for (const hy of [0.45, 0.95]) k.add(new THREE.BoxGeometry(L, 0.04, 0.04), M.metal, mx, Yb(mx, mz) + hy, mz, Math.atan2(-uz, ux)); }
    }
  }
  /* ---------- meio-fio pintado de amarelo em volta da praça ---------- */
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
    const n = Math.ceil(L / 4);
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      if (nearStream(x, z, 3)) continue;
      k.add(new THREE.BoxGeometry(L / n + 0.05, 0.2, 0.16), M.yellowCurb, x, Y(x, z) + 0.06, z, Math.atan2(-(b[1] - a[1]), b[0] - a[0]));
    }
  }

  /* ---------- canteiros elevados com árvores grandes (metade sul, sombra densa das fotos aéreas) ---------- */
  const beds = [[X0 + 2, cz + 10, cx - 8, Z1 - 2], [pg.x + 4, cz + 12, X1 - 2, Z1 - 2], [X1 - 14, cz - 10, X1 - 2, cz + 6]];
  const inBed = (x, z) => beds.some(([a, b, c, d]) => x > a && x < c && z > b && z < d);

  /* ---------- piso: lajotas em toda a praça, grama nos canteiros (grade drapeada no relevo) ---------- */
  {
    const S = 2, pav = [], pavUV = [], grass = [], curb = [];
    const pushQ = (arr, uv, a, b, c, d) => { arr.push(...a, ...b, ...c, ...a, ...c, ...d); if (uv) uv.push(a[0] / 4, a[2] / 4, b[0] / 4, b[2] / 4, c[0] / 4, c[2] / 4, a[0] / 4, a[2] / 4, c[0] / 4, c[2] / 4, d[0] / 4, d[2] / 4); };
    const cell = (i, j) => { const x = X0 + (i + 0.5) * S, z = Z0 + (j + 0.5) * S; if (!inside(x, z) || nearStream(x, z, WALL + 0.6)) return 0; return inBed(x, z) ? 2 : 1; };
    const ni = Math.ceil((X1 - X0) / S), nj = Math.ceil((Z1 - Z0) / S);
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
      const t = cell(i, j); if (!t) continue;
      const x0 = X0 + i * S, z0 = Z0 + j * S, x1 = x0 + S, z1 = z0 + S, lift = t === 2 ? 0.32 : 0.06;
      const P = (x, z) => [x, (nearStream(x, z, 9) ? Yb(x, z) : Y(x, z)) + lift, z];
      if (t === 1) pushQ(pav, pavUV, P(x0, z0), P(x0, z1), P(x1, z1), P(x1, z0));
      else {
        pushQ(grass, null, P(x0, z0), P(x0, z1), P(x1, z1), P(x1, z0));
        // meio-fio de concreto onde o canteiro encontra o piso
        const edge = (ax, az, bx, bz) => { const A0 = [ax, Y(ax, az) + 0.04, az], B0 = [bx, Y(bx, bz) + 0.04, bz]; pushQ(curb, null, A0, B0, [bx, B0[1] + 0.32, bz], [ax, A0[1] + 0.32, az]); };
        if (cell(i - 1, j) !== 2) edge(x0, z1, x0, z0); if (cell(i + 1, j) !== 2) edge(x1, z0, x1, z1);
        if (cell(i, j - 1) !== 2) edge(x0, z0, x1, z0); if (cell(i, j + 1) !== 2) edge(x1, z1, x0, z1);
      }
    }
    const mk = (pos, uv, mat) => { if (!pos.length) return; const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals(); const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; g.add(m); };
    mk(pav, pavUV, new THREE.MeshLambertMaterial({ map: paverTex() }));
    mk(grass, null, M.grass);
    mk(curb, null, new THREE.MeshLambertMaterial({ color: 0xd8d4cc, side: THREE.DoubleSide }));
  }

  /* ---------- árvores grandes, palmeiras e bambus (instanciados) ---------- */
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const trees = [], palms = [], bamboos = [];
  for (let i = 0; i < 900 && trees.length < 12; i++) {
    const x = X0 + rnd() * (X1 - X0), z = Z0 + rnd() * (Z1 - Z0);
    const bed = inBed(x, z);
    if (!inside(x, z) || nearStream(x, z, 3.5) || occupied(x, z, 2) || (!bed && rnd() < 0.85)) continue;
    if (trees.some(t => Math.hypot(t[0] - x, t[1] - z) < 11)) continue;
    trees.push([x, z, 0.8 + rnd() * 0.35, rnd() * 6.28]);
  }
  for (let i = 0; i < 300 && palms.length < 5; i++) {
    const x = X0 + rnd() * (X1 - X0), z = Z0 + rnd() * (Z1 - Z0);
    if (!inside(x, z) || nearStream(x, z, 3) || occupied(x, z, 1.5) || [...trees, ...palms].some(t => Math.hypot(t[0] - x, t[1] - z) < 6)) continue;
    palms.push([x, z, 0.9 + rnd() * 0.3]);
  }
  for (const [a, b] of stream) for (const t of [0.3, 0.8]) { const x = a[0] + (b[0] - a[0]) * t + (rnd() - 0.5) * 2, z = a[1] + (b[1] - a[1]) * t; if (Math.hypot(x - cx, z - cz) < 45) bamboos.push([x + 4, z, 1]); }
  const inst = (geo, mat, list, f, color) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length), d = new THREE.Object3D(), c = new THREE.Color(); list.forEach((t, i) => { f(d, t); d.updateMatrix(); im.setMatrixAt(i, d.matrix); if (color) im.setColorAt(i, c.setHex(color(t, i))); }); im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); g.add(im); };
  // árvores grandes e palmeiras vão para o sistema de árvores detalhadas (src/world/trees.js)
  const treeList = [];
  trees.forEach(([x, z, sc, r], i) => treeList.push({ x, y: Y(x, z) + (inBed(x, z) ? 0.3 : 0), z, s: sc, rot: r, kind: 'big', color: [0x4f7f33, 0x5a8a3a, 0x46752f, 0x628f3f][i % 4] }));
  palms.forEach(([x, z, sc]) => treeList.push({ x, y: Y(x, z), z, s: sc, rot: x * 7 % 6.28, kind: 'palm', color: 0x5d9a3d }));
  const bambooG = new THREE.CylinderGeometry(0.07, 0.07, 9, 5).translate(0, 4.5, 0), bl = [];
  bamboos.forEach(([x, z]) => { for (let i = 0; i < 14; i++) bl.push([x + (rnd() - 0.5) * 2.4, z + (rnd() - 0.5) * 2.4, rnd()]); });
  inst(bambooG, lambert(0x7fa04a), bl, (d, [x, z, r]) => { d.position.set(x, Yb(x, z), z); d.rotation.set((r - 0.5) * 0.3, 0, (r - 0.4) * 0.3); d.scale.set(1, 0.8 + r * 0.4, 1); });
  for (const [x, z] of trees) colliders.push({ circle: [x, z, 0.65] });
  for (const [x, z] of palms) colliders.push({ circle: [x, z, 0.3] });

  /* ---------- bancos modernos (pés de concreto branco, assento de madeira) e lampiões pretos ---------- */
  {
    const spots = [];
    for (let i = 0; i < 400 && spots.length < 12; i++) {
      const x = X0 + 3 + rnd() * (X1 - X0 - 6), z = Z0 + 3 + rnd() * (Z1 - Z0 - 6);
      if (!inside(x, z) || inBed(x, z) || nearStream(x, z, 4) || occupied(x, z, 1.5) || spots.some(s => Math.hypot(s[0] - x, s[1] - z) < 6)) continue;
      // de costas para o canteiro/árvore mais próxima, virado para o piso aberto
      const t = trees.reduce((b, q) => (!b || Math.hypot(q[0] - x, q[1] - z) < Math.hypot(b[0] - x, b[1] - z) ? q : b), null);
      const face = t ? Math.atan2(x - t[0], z - t[1]) : rnd() * 6.28;
      spots.push([x, z, face]);
    }
    for (const [x, z, face] of spots) {
      const y = Y(x, z), c = Math.cos(face), s = Math.sin(face);
      const L = (a, b) => [x + a * c + b * s, z - a * s + b * c];
      for (const a of [-0.75, 0.75]) { const [px, pz] = L(a, 0); k.add(new THREE.BoxGeometry(0.12, 0.45, 0.55), M.white, px, y + 0.22, pz, face); }
      k.add(new THREE.BoxGeometry(1.9, 0.08, 0.5), M.wood, x, y + 0.47, z, face);
      { const [px, pz] = L(0, -0.24); k.add(new THREE.BoxGeometry(1.9, 0.4, 0.06), M.wood, px, y + 0.78, pz, face, 0.15); }
      for (const a of [-0.45, 0.45]) { const [px, pz] = L(a, 0.05); seats.push({ x: px, y: y + 0.51, z: pz, face }); }
      occupy(x - 1, z - 1, x + 1, z + 1);
    }
    const lamps = [];
    for (let i = 0; i < 300 && lamps.length < 12; i++) {
      const x = X0 + 2 + rnd() * (X1 - X0 - 4), z = Z0 + 2 + rnd() * (Z1 - Z0 - 4);
      if (!inside(x, z) || inBed(x, z) || nearStream(x, z, 3) || occupied(x, z, 1) || lamps.some(l => Math.hypot(l[0] - x, l[1] - z) < 9)) continue;
      lamps.push([x, z]);
    }
    for (const [x, z] of lamps) {
      const y = Y(x, z);
      k.add(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 8), M.black, x, y + 0.25, z);
      k.add(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 6), M.black, x, y + 1.8, z);
      k.add(new THREE.CylinderGeometry(0.22, 0.14, 0.12, 6), M.black, x, y + 3.42, z);
      k.add(new THREE.CylinderGeometry(0.18, 0.13, 0.5, 6), lampGlass, x, y + 3.72, z);
      k.add(new THREE.ConeGeometry(0.28, 0.25, 6), M.black, x, y + 4.08, z);
      colliders.push({ circle: [x, z, 0.2] });
    }
  }

  /* ---------- abrigo da esquina SW (Castelo Branco × João Corrêa): esteios verdes, telhado de telha, brasão; placas ---------- */
  {
    const sw = [...poly].sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]))[0];        // canto sudoeste
    const ax = sw[0] + 5, az = sw[1] - 5, y = Y(ax, az), face = PI / 4, W = 6, D = 4;
    const ag = new THREE.Group(); ag.position.set(ax, y, az); ag.rotation.y = face; g.add(ag);
    const ak = new Kit(), green = lambert(0x2f6a3a);
    for (const [px, pz] of [[-W / 2, -D / 2], [0, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [0, D / 2], [W / 2, D / 2]]) ak.box(0.18, 2.6, 0.18, green, px, 0, pz);
    ak.box(W + 0.3, 0.2, 0.2, green, 0, 2.6, -D / 2); ak.box(W + 0.3, 0.2, 0.2, green, 0, 2.6, D / 2);
    const sl = Math.hypot(D / 2 + 0.6, 1.3), sa = Math.atan2(1.3, D / 2 + 0.6);
    for (const sd of [-1, 1]) ak.add(new THREE.BoxGeometry(W + 1.2, 0.12, sl), M.roofTile, 0, 2.8 + 0.65, sd * (D / 4 + 0.15), 0, sd * sa);
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -D / 2 - 0.3, 0, 0, D / 2 + 0.3, 0, 1.3, 0], 3)); tri.computeVertexNormals();
    ak.add(tri, M.white, W / 2 + 0.05, 2.75, 0); ak.add(tri, M.white, -W / 2 - 0.05, 2.75, 0, PI);
    ak.add(new THREE.CircleGeometry(0.3, 12), M.yellow, W / 2 + 0.08, 3.2, 0, PI / 2);                      // brasão
    ak.box(W - 0.6, 0.45, 0.4, M.wood, 0, 0, D / 2 - 0.3);                                                 // banco
    ak.build(ag);
    for (const [px, pz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) { const c = Math.cos(face), s2 = Math.sin(face); colliders.push({ circle: [ax + px * c + pz * s2, az - px * s2 + pz * c, 0.15] }); }
    occupy(ax - 4, az - 4, ax + 4, az + 4);
    // placa de direção: azul (Hospital, Fórum, Polícia Civil) e marrom turística (Oktoberfest, Monte da Fé, Morro da Cruz…)
    const signT = tex(128, 160, (c, Wc, Hc) => {
      c.fillStyle = '#1d4fa3'; c.fillRect(0, 0, Wc, 64); c.fillStyle = '#fff'; c.font = 'bold 15px sans-serif'; c.fillText('↑ Hospital', 8, 20); c.fillText('   Fórum', 8, 38); c.fillText('   Polícia Civil', 8, 56);
      c.fillStyle = '#7a4a28'; c.fillRect(0, 68, Wc, 92); c.fillStyle = '#fff'; c.font = '11px sans-serif';
      ['Oktoberfest →', 'Monte da Fé →', 'Morro da Cruz →', 'Alto da Pedra →', 'Terra Grande →'].forEach((t, i) => c.fillText(t, 8, 84 + i * 16));
    });
    const sx = ax - 3.5, sz = az + 3.5;
    k.add(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6), M.metal, sx, Y(sx, sz) + 2.1, sz);
    k.add(new THREE.PlaneGeometry(1.5, 1.9), new THREE.MeshLambertMaterial({ map: signT, side: THREE.DoubleSide }), sx, Y(sx, sz) + 3.1, sz + 0.07, PI / 4);
    colliders.push({ circle: [sx, sz, 0.1] });
  }

  /* ---------- carrinho do pipoqueiro (esquina noroeste, junto à faixa da Castelo Branco) ---------- */
  let pipoca = null;
  {
    // canto noroeste do polígono, um pouco para dentro
    const nw = [...poly].sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]))[0];
    const px = nw[0] + 3.5, pz = nw[1] + 3.2, y = Y(px, pz), face = -PI / 4;
    const cg = new THREE.Group(); cg.position.set(px, y, pz); cg.rotation.y = face; g.add(cg);
    const ck = new Kit();
    ck.box(1.5, 0.75, 0.8, M.white, 0, 0.35, 0);
    ck.box(1.5, 0.08, 0.8, M.red, 0, 1.1, 0);
    ck.add(new THREE.BoxGeometry(0.7, 0.55, 0.6), new THREE.MeshLambertMaterial({ color: 0xfff7dc, emissive: 0xffe2a0, emissiveIntensity: 0.25 }), -0.3, 1.45, 0);   // vitrine com pipoca
    for (const [a, b] of [[-0.7, -0.38], [0.7, -0.38], [-0.7, 0.38], [0.7, 0.38]]) ck.add(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 5), M.metal, a, 1.75, b);
    ck.add(new THREE.BoxGeometry(2.1, 0.06, 1.5), M.red, 0, 2.42, 0, 0, -0.06);                                // toldo vermelho
    ck.add(new THREE.PlaneGeometry(2.1, 0.38), M.pipoca, 0, 2.2, 0.75);
    ck.add(new THREE.PlaneGeometry(2.1, 0.38), M.pipoca, 0, 2.2, -0.75, PI);
    for (const s of [-1, 1]) { const wh = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12); wh.rotateX(PI / 2); ck.add(wh, M.black, s * 0.55, 0.28, 0.42); }
    for (let i = 0; i < 4; i++) ck.box(0.18, 0.3, 0.12, lambert(0xf3e7c4), -0.55 + i * 0.12, 1.14, 0.25);   // saquinhos prontos
    ck.build(cg);
    colliders.push({ circle: [px, pz, 1.0] });
    // o pipoqueiro fica atrás do carrinho
    const bx = px - Math.sin(face) * 1.1, bz = pz - Math.cos(face) * 1.1;
    pipoca = { x: bx, y: Y(bx, bz), z: bz, face, cart: [px, pz] };
  }

  const parking = [];
  /* ---------- vagas em ângulo na João Corrêa, junto à praça (fotos 697–735) ---------- */
  {
    const jc = world.roads.filter(r => /Jo.o Corr/.test(r.n || '') && r.p.some(q => Math.hypot(q[0] + 10, q[1] - 48) < 60));
    const pm = new THREE.MeshBasicMaterial({ color: 0xf2f2ee }), pl = new Kit();
    for (const r of jc) for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      let nx = -uz, nz = ux; if (nz > 0) { nx = -nx; nz = -nz; }                 // lado norte (praça)
      const off = r.w / 2 - 2.6;
      for (let t = 4; t < L - 3; t += 2.6) {
        const x = a[0] + ux * t + nx * off, z = a[1] + uz * t + nz * off;
        if (x < X0 + 6 || x > X1 - 6 || nearStream(x, z, 6)) continue;
        pl.add(new THREE.BoxGeometry(0.1, 0.02, 5), pm, x - ux * 1.3, Y(x, z) + 0.11, z - uz * 1.3, Math.atan2(nx, nz) + 0.35);
        if ((Math.floor(t * 3.7) % 4) !== 0) parking.push({ x, z, yaw: Math.atan2(nx, nz) + 0.35 + PI });
      }
    }
    pl.build(g, false);
  }

  /* ---------- vagas em ângulo sob a Rua Coberta (lado da praça) ---------- */
  const coberta = world.areas.find(q => q.k === 'plaza' && /Rua Coberta/.test(q.n || ''));
  if (coberta) {
    const cp = coberta.p, czMax = Math.max(...cp.map(q => q[1]));     // borda sul da cobertura (lado da praça)
    const xA = Math.min(...cp.map(q => q[0])) + 8, xB = Math.max(...cp.map(q => q[0])) - 6;
    const lineM = new THREE.MeshBasicMaterial({ color: 0xf2f2ee });
    const lines = new Kit();
    for (let x = xA; x < xB; x += 2.7) {
      const z = czMax - 3.2, y = Y(x, z) + 0.11;
      lines.add(new THREE.BoxGeometry(0.1, 0.02, 5), lineM, x, y, z, 0.45);
      if (x + 1.35 < xB && (Math.floor(x * 7) % 5) !== 0) parking.push({ x: x + 1.35, z, yaw: PI + 0.45 });
    }
    lines.build(g, false);
  }

  k.build(g); kd.build(g, false);
  /** Altura do piso da praça onde ele não é o terreno: tabuleiro da passarela e margens do valão (o terreno ali foi
   *  escavado largo e plano; o piso das margens fica na altura da rua). null = usar o terreno. */
  const deckAt = (x, z) => {
    for (const d of decks) {
      const s = (x - d.qx) * d.nx + (z - d.qz) * d.nz, w = (x - d.qx) * d.ux + (z - d.qz) * d.uz;
      if (Math.abs(s) <= d.L / 2 + 0.3 && Math.abs(w) < 0.85) return d.y + Math.sin(Math.max(0, Math.min(1, (s + d.L / 2) / d.L)) * PI) * 0.45 + 0.05;
    }
    return null;
  };
  const surfaceAt = (x, z) => {
    for (const [a, b, c, d, y] of porches) if (x > a && x < c && z > b && z < d) return y;
    const s2 = streamD(x, z), bank = s2 && s2.d < 9.5;
    if (s2 && s2.d <= WALL + 0.45) return null;                                   // dentro do canal: leito (terreno)
    // mesma regra do piso (pav/grass acima): lajotas +6 cm, canteiros elevados +32 cm, margens na altura da rua
    if (inside(x, z)) return (bank ? Yb(x, z) : Y(x, z)) + (inBed(x, z) ? 0.32 : 0.06);
    if (bank) return Yb(x, z) + 0.05;
    return null;
  };
  return { footbridges, pipoca, parking, trees: treeList, bounds: [X0, Z0, X1, Z1], surfaceAt, deckAt };
}

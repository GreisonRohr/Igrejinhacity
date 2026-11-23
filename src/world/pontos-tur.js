// Pontos da cidade montados a partir das fotos do site de turismo da Prefeitura (igrejinha.tur.br), de fotos livres
// (Wikimedia Commons, "Rs115-igrejinha.jpg": Loja Piccadilly e McBenett) e de notícias públicas (Centro Administrativo:
// 3 pavimentos, ~3.000 m², Av. Ildo Meneghetti 757). Pegadas e alturas vêm dos dados do mapa (world.buildings).
//  - Fábricas (Beira Rio, Usaflex, Piccadilly): o pavilhão genérico fica; ganha letreiro na fachada voltada para a rua.
//  - Loja Piccadilly + McBenett, Centro Administrativo: o prédio genérico sai e entra o modelo.
//  - Casa de Pedra (Stein Haus), Kinder Park (Alles Blau), Morro Alto da Pedra (voo livre): modelos novos.
// Todos os letreiros e fachadas pintadas usam UM atlas (uma textura, um material): poucas chamadas de desenho.
import * as THREE from 'three';
import { Kit, lambert, inPoly } from './landmarks3d.js';
import { byId } from '../landmarks.js';

const PI = Math.PI, ROW = 128, ROWS = 16;

/* ---------------- atlas de letreiros e fachadas ---------------- */
function drawAtlas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = ROW * ROWS; const g = c.getContext('2d');
  const row = (i, n, f) => { g.save(); g.translate(0, i * ROW); g.beginPath(); g.rect(0, 0, 1024, ROW * n); g.clip(); f(1024, ROW * n); g.restore(); };
  const text = (t, x, y, font, col, al = 'center') => { g.font = font; g.fillStyle = col; g.textAlign = al; g.textBaseline = 'middle'; g.fillText(t, x, y); };
  // 0: painel vermelho da Loja Piccadilly (foto Commons)
  row(0, 1, (w, h) => { g.fillStyle = '#c4122f'; g.fillRect(0, 0, w, h); g.fillStyle = '#9c0c22'; g.fillRect(0, h - 14, w, 14);
    g.fillStyle = '#f3d6c8'; g.beginPath(); g.ellipse(840, 70, 150, 34, -0.15, 0, 7); g.fill(); g.fillStyle = '#7a0a1a'; g.beginPath(); g.ellipse(880, 60, 70, 18, -0.15, 0, 7); g.fill();
    text('Piccadilly', 60, 62, 'italic bold 84px Georgia, serif', '#fff', 'left'); text('VAREJO', 470, 100, 'bold 26px sans-serif', '#ffd9de', 'left'); });
  // 1: Calçados Beira Rio
  row(1, 1, (w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#163d7a'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10); text('CALÇADOS BEIRA RIO', w / 2, h / 2 + 2, 'bold 76px sans-serif', '#163d7a'); });
  // 2: Usaflex
  row(2, 1, (w, h) => { g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, w, h); text('usaflex', w / 2, h / 2, 'bold 96px sans-serif', '#1f2a36'); });
  // 3: Piccadilly (fábrica)
  row(3, 1, (w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); text('Piccadilly', w / 2, h / 2, 'italic bold 92px Georgia, serif', '#c4122f'); });
  // 4: Centro Administrativo
  row(4, 1, (w, h) => { g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, w, h); text('CENTRO ADMINISTRATIVO', w / 2, 44, 'bold 58px sans-serif', '#2a3a4a'); text('PREFEITO LAURI AURI KRAUSE', w / 2, 98, '34px sans-serif', '#2a3a4a'); });
  // 5: McBenett
  row(5, 1, (w, h) => { g.fillStyle = '#1d1d1f'; g.fillRect(0, 0, w, h); text('McBENETT', w / 2, h / 2 + 4, 'bold 86px Georgia, serif', '#d9b25a'); });
  // 6-7: fachada enxaimel creme/madeira escura (McBenett) — 1024×256, 4 painéis por 2 andares
  row(6, 2, (w, h) => { g.fillStyle = '#efe1bf'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a2618';
    for (let f = 0; f < 2; f++) { const y0 = f * 128; g.fillRect(0, y0, w, 9); g.fillRect(0, y0 + 74, w, 7);
      for (let i = 0; i <= 8; i++) g.fillRect(i * 128 - 5, y0, 10, 128);
      for (let i = 0; i < 8; i++) { const x = i * 128; g.fillStyle = '#2f3b44'; g.fillRect(x + 34, y0 + 18, 60, 50); g.fillStyle = '#3a2618';
        g.save(); g.lineWidth = 7; g.strokeStyle = '#3a2618'; g.beginPath(); g.moveTo(x + 5, y0 + 81); g.lineTo(x + 64, y0 + 128); g.lineTo(x + 123, y0 + 81); g.stroke(); g.restore(); } }
    g.fillRect(0, h - 8, w, 8); });
  // 8-10: Casa de Pedra — reboco de pedra caiado e gasto, janelas sem caixilho, 2 andares
  row(8, 3, (w, h) => { let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = '#d6d2c8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = 150 + r() * 70; g.fillStyle = `rgba(${v},${v - 4},${v - 12},0.35)`; g.fillRect(r() * w, r() * h, 6 + r() * 30, 3 + r() * 14); }
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(70,64,52,0.18)'; g.fillRect(r() * w, h * 0.5 + r() * h * 0.5, 2 + r() * 4, 20 + r() * 60); }   // escorridos
    for (let f = 0; f < 2; f++) for (let i = 0; i < 6; i++) { const x = 60 + i * 165, y = f ? 220 : 50;
      if (f && i === 2) { g.fillStyle = '#7a4a2e'; g.fillRect(x - 6, y - 30, 82, 140); g.fillStyle = '#2a201a'; g.fillRect(x, y - 24, 70, 134); continue; }
      g.fillStyle = '#7a4a2e'; g.fillRect(x - 7, y - 7, 84, 104); g.fillStyle = '#231c17'; g.fillRect(x, y, 70, 90); }
    g.fillStyle = 'rgba(90,84,74,0.5)'; g.fillRect(0, h - 22, w, 22); });
  // 11: Kinder Park
  row(11, 1, (w, h) => { g.fillStyle = '#3d4248'; g.fillRect(0, 0, w, h); const L = 'KINDER PARK'.split(''), C = ['#e8322c', '#f6c01a', '#33a852', '#2c7be5', '#e8322c', '#f08a24', '#fff', '#2c7be5', '#f6c01a', '#33a852', '#e8322c'];
    g.font = 'bold 92px sans-serif'; g.textBaseline = 'middle'; let x = 60; L.forEach((ch, i) => { g.fillStyle = C[i]; g.fillText(ch, x, h / 2 + 4); x += ch === ' ' ? 40 : g.measureText(ch).width + 6; }); });
  // 12: placa Casa de Pedra
  row(12, 1, (w, h) => { g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2a5d8a'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    text('PREFEITURA DE IGREJINHA', w / 2, 38, '26px sans-serif', '#2a5d8a'); text('CASA DE PEDRA', w / 2, 86, 'bold 58px sans-serif', '#2a5d8a'); });
  // 13: vidro espelhado (Centro Administrativo), faixas
  row(13, 1, (w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7f98ad'); gr.addColorStop(1, '#30475a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d8dcdf'; for (let i = 0; i <= 16; i++) g.fillRect(i * 64 - 3, 0, 6, h); g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); });
  // 14: biruta/rampa — faixas laranja e branca
  row(14, 1, (w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff' : '#ff6a13'; g.fillRect(i * 128, 0, 128, h); } });
  // 15: placa "Casa do Artesão" (madeira escura, letras creme) e faixa vermelha
  row(15, 1, (w, h) => { g.fillStyle = '#3a2418'; g.fillRect(0, 0, 640, h); g.strokeStyle = '#d9c9a0'; g.lineWidth = 6; g.strokeRect(10, 10, 620, h - 20);
    text('Casa do Artesão', 320, h / 2 + 2, 'italic bold 70px Georgia, serif', '#f0e2bd'); g.fillStyle = '#d32f2f'; g.fillRect(660, 0, 364, h); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.MeshLambertMaterial({ map: t });
}
let ATLAS = null;
/** Retângulo plano (largura w, altura h) com a(s) linha(s) r..r+n-1 do atlas; u0..u1 recorta na horizontal. */
function quad(w, h, r, n = 1, u0 = 0, u1 = 1) {
  const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv, v0 = 1 - (r + n) / ROWS, v1 = 1 - r / ROWS;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  return g;
}

/* ---------------- planejamento (antes da cidade): prédios, frentes, exclusões ---------------- */
const rectOf = b => { const [x, z, ux, uz, a, bb] = b.rect; return { x, z, ux, uz, a, b: bb }; };
function nearestRoadDist(world, x, z, R = 150) {
  let best = 1e9;
  for (const r of world.roads) {
    const p = r.p; if (!p || r.k === 'path' || r.k === 'footway') continue;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1]; if (Math.min(a[0], b[0]) > x + R || Math.max(a[0], b[0]) < x - R || Math.min(a[1], b[1]) > z + R || Math.max(a[1], b[1]) < z - R) continue;
      const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l));
      best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z));
    }
  }
  return best;
}
/** Lado do retângulo voltado para a rua mais próxima: normal (nx, nz), distância centro→face e comprimento da face. */
function frontOf(world, R, longOnly = false) {
  const sides = [[R.ux, R.uz, R.a, R.b], [-R.ux, -R.uz, R.a, R.b], [-R.uz, R.ux, R.b, R.a], [R.uz, -R.ux, R.b, R.a]];
  let best = null;
  for (const [nx, nz, half, other] of sides) {
    if (longOnly && other < half) continue;
    const d = nearestRoadDist(world, R.x + nx * (half + 2), R.z + nz * (half + 2));
    if (!best || d < best.d) best = { d, nx, nz, half, len: other * 2 };
  }
  return best;
}
function pick(world, l, r, re) {
  let best = null, ba = 0;
  for (const b of world.buildings) {
    if (!b.rect) continue; const R = rectOf(b), d = Math.hypot(R.x - l.x, R.z - l.z); if (d > r) continue;
    if (re && re.test(b.n || '')) return b;
    const A = R.a * R.b; if (A > ba) { ba = A; best = b; }
  }
  return best;
}
const groundOf = (H, p) => { let lo = Infinity, hi = -Infinity; for (const [x, z] of p) { const y = H(x, z); lo = Math.min(lo, y); hi = Math.max(hi, y); } return { lo, hi }; };

export function placePontosTur(world, igreja = null) {
  const T = { signs: [], ex: [] };
  const own = b => { const p = b.p; T.ex.push((x, z) => inPoly(x, z, p)); };
  // fábricas: letreiro na fachada do maior pavilhão
  for (const [id, r, re, row] of [['beirario', 130, null, 1], ['usaflex', 170, /Usaflex/i, 2], ['piccfab', 80, null, 3]]) {
    const b = pick(world, byId[id], r, re); if (!b) continue;
    T.signs.push({ b, R: rectOf(b), f: frontOf(world, rectOf(b)), row });
  }
  // Loja Piccadilly (substitui o prédio genérico)
  const lp = pick(world, byId.piccloja, 40, /Piccadilly/i);
  if (lp) { const R = rectOf(lp); T.loja = { b: lp, R, f: frontOf(world, R) }; own(lp); }
  // Centro Administrativo: maior prédio a até 80 m do ponto
  const ca = pick(world, byId.prefeitura, 80, null);
  if (ca) { const R = rectOf(ca); T.centro = { b: ca, R, f: frontOf(world, R, true) }; own(ca); }
  // Casa do Artesão: ao lado da Igreja Gabriel, do lado da R. Santos Dumont (fotos do diretor e do site de turismo)
  if (igreja) {
    const o = igreja, S = [o.x - o.ux * 25, o.z - o.uz * 25];                 // ponto na R. Independência em frente à igreja
    let side = 1, sd = 1e9;                                                    // lado da R. Santos Dumont
    for (const r of world.roads) if (/Santos Dumont/.test(r.n || '')) for (const q of r.p) { const d = Math.hypot(q[0] - S[0], q[1] - S[1]); if (d < sd) { sd = d; side = Math.sign((q[0] - S[0]) * -o.uz + (q[1] - S[1]) * o.ux) || 1; } }
    T.artesao = { S, ux: o.ux, uz: o.uz, side };
    const W = (a, p) => [S[0] + o.ux * a - o.uz * p * side, S[1] + o.uz * a + o.ux * p * side];
    T.ex.push((x, z) => { const dx = x - S[0], dz = z - S[1], a = dx * o.ux + dz * o.uz, p = (dx * -o.uz + dz * o.ux) * side; return a > 7 && a < 32 && p > 9.5 && p < 20.5; });
    T.artesao.W = W;
  }
  // Casa de Pedra e Kinder Park: tira o que houver no lugar
  for (const id of ['casapedra', 'kinder']) { const l = byId[id]; T.ex.push((x, z) => Math.hypot(x - l.x, z - l.z) < 16); T[id] = { f: frontOf(world, { x: l.x, z: l.z, ux: 1, uz: 0, a: 9, b: 5 }) }; }
  return T;
}

/* ---------------- montagem ---------------- */
export function buildPontosTur(T, terrain, root, colliders, updaters) {
  if (!T) return;
  const H = (x, z) => terrain.heightAt(x, z), A = ATLAS || (ATLAS = drawAtlas());
  // letreiros e fachadas: material do atlas; uma malha por local (o mergeStatic junta por região de 500 m e apaga as distantes)
  const g = new THREE.Group(); root.add(g);
  let kit = new Kit(); const flush = () => { if (kit.parts.size) kit.build(g, false); kit = new Kit(); };
  const face = (f, x, z) => Math.atan2(f.nx, f.nz);   // rotação Y de um plano cuja normal é (nx, nz)

  // letreiros das fábricas: no alto da fachada voltada para a rua
  for (const s of T.signs) {
    const { lo, hi } = groundOf(H, s.b.p), top = hi + 0.15 + s.b.h, w = Math.min(s.f.len * 0.55, 34), h = w / 8;
    const x = s.R.x + s.f.nx * (s.f.half + 0.12), z = s.R.z + s.f.nz * (s.f.half + 0.12);
    kit.add(quad(w, h, s.row), A, x, top - h / 2 - 0.6, z, face(s.f)); flush();
  }

  // Loja Piccadilly (fachada da foto: caixa baixa, painel vermelho, marquise) + McBenett enxaimel com duas torres
  if (T.loja) {
    const { R, f, b } = T.loja, y = groundOf(H, b.p).hi + 0.1, k = new Kit();
    const tx = -f.nz, tz = f.nx, L = f.len, D = f.half * 2;            // tangente da fachada, largura e fundo
    const cx = R.x, cz = R.z, ry = face(f), mcW = Math.min(16, L * 0.3), stW = L - mcW;
    const sx = cx - tx * (mcW / 2), sz = cz - tz * (mcW / 2);           // centro da loja; McBenett na outra ponta
    const wall = lambert(0xe9e7e2), grey = lambert(0x9fa3a6), dark = lambert(0x2c3238), red = lambert(0xc4122f), slate = lambert(0x2b2d31);
    k.box(stW, 7, D, wall, sx, y, sz, ry);
    k.box(stW + 0.4, 0.6, D + 0.4, grey, sx, y + 7, sz, ry);
    k.add(new THREE.BoxGeometry(stW - 2, 2.6, 0.1), dark, sx + f.nx * (D / 2 + 0.05), y + 1.6, sz + f.nz * (D / 2 + 0.05), ry);    // vitrine
    k.add(new THREE.BoxGeometry(stW * 0.7, 0.5, 3), red, sx + f.nx * (D / 2 + 1.5), y + 3.2, sz + f.nz * (D / 2 + 1.5), ry);       // marquise
    for (const s of [-1, 1]) k.box(0.3, 3, 0.3, grey, sx + f.nx * (D / 2 + 2.8) + tx * s * stW * 0.33, y, sz + f.nz * (D / 2 + 2.8) + tz * s * stW * 0.33, ry);
    const pw = Math.min(stW * 0.8, 30); kit.add(quad(pw, pw / 8, 0), A, sx + f.nx * (D / 2 + 0.15), y + 5.2, sz + f.nz * (D / 2 + 0.15), ry);
    // McBenett
    const mx = cx + tx * (stW / 2), mz = cz + tz * (stW / 2), md = Math.min(D, 14), mo = D / 2 - md / 2;
    const mcx = mx + f.nx * mo, mcz = mz + f.nz * mo;
    k.box(mcW, 8, md, lambert(0xefe1bf), mcx, y, mcz, ry);
    kit.add(quad(mcW, 8, 6, 2, 0, mcW / 32), A, mcx + f.nx * (md / 2 + 0.06), y + 4, mcz + f.nz * (md / 2 + 0.06), ry);
    kit.add(quad(mcW * 0.6, mcW * 0.6 / 8, 5), A, mcx + f.nx * (md / 2 + 0.12), y + 8.6, mcz + f.nz * (md / 2 + 0.12), ry);
    const rs = Math.atan2(4, md / 2), sl = Math.hypot(md / 2, 4);
    for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(mcW + 0.6, 0.25, sl + 0.4), slate, mcx - f.nx * s * md / 4, y + 10, mcz - f.nz * s * md / 4, ry, -s * rs);
    for (const s of [-1, 1]) {                                         // duas torres de agulha escura (foto)
      const qx = mcx + tx * s * (mcW / 2 - 1.6) + f.nx * (md / 2 - 1.6), qz = mcz + tz * s * (mcW / 2 - 1.6) + f.nz * (md / 2 - 1.6);
      k.box(3.2, 11, 3.2, lambert(0xefe1bf), qx, y, qz, ry);
      k.add(new THREE.ConeGeometry(2.4, 7, 8), slate, qx, y + 14.5, qz, ry);
      k.add(new THREE.SphereGeometry(0.25, 6, 4), lambert(0xd9b25a), qx, y + 18.1, qz);
    }
    k.build(g); flush();
    colliders.push({ p: b.p.map(q => [q[0], q[1]]) });
  }

  // Centro Administrativo: 3 pavimentos, faixas de vidro, pórtico de entrada, mastros com bandeiras
  if (T.centro) {
    const { R, f, b } = T.centro, y = groundOf(H, b.p).lo, k = new Kit();
    const L = f.len, D = f.half * 2, ry = face(f), tx = -f.nz, tz = f.nx, Hh = 11;
    const white = lambert(0xf1f0eb), grey = lambert(0xb7b8b4), pole = lambert(0xd8d8d8);
    k.box(L, Hh, D, white, R.x, y, R.z, ry);
    k.box(L + 0.6, 0.5, D + 0.6, grey, R.x, y + Hh, R.z, ry);
    for (const s of [1, -1]) for (let fl = 0; fl < 3; fl++)            // faixas de vidro na frente e nos fundos
      kit.add(quad(L - 3, 1.9, 13, 1, 0, Math.round((L - 3) / 4) / 16), A, R.x + f.nx * s * (D / 2 + 0.05), y + 1.9 + fl * 3.5, R.z + f.nz * s * (D / 2 + 0.05), s > 0 ? ry : ry + PI);
    // pórtico central saliente, todo de vidro, com o nome em cima
    const px = R.x + f.nx * (D / 2 + 2), pz = R.z + f.nz * (D / 2 + 2);
    k.box(12, Hh + 1.5, 4, grey, px, y, pz, ry);
    kit.add(quad(10, Hh - 3.5, 13, 1, 0, 0.6), A, px + f.nx * 2.06, y + (Hh - 3.5) / 2 + 0.4, pz + f.nz * 2.06, ry);
    kit.add(quad(11, 11 / 8, 4), A, px + f.nx * 2.08, y + Hh - 1.6, pz + f.nz * 2.08, ry);
    k.add(new THREE.BoxGeometry(14, 0.4, 6), grey, px + f.nx * 3, y + 3.6, pz + f.nz * 3, ry);   // marquise
    // três mastros (Brasil, RS, Igrejinha) na frente
    const flags = [[0x1e9b3c, 0xf7d117], [0x1e9b3c, 0xd6322c], [0x2a5d8a, 0xffffff]];
    flags.forEach(([c1, c2], i) => {
      const fx = R.x + f.nx * (D / 2 + 12) + tx * (i - 1) * 3, fz = R.z + f.nz * (D / 2 + 12) + tz * (i - 1) * 3, fy = H(fx, fz);
      k.box(0.14, 10, 0.14, pole, fx, fy, fz);
      k.add(new THREE.BoxGeometry(2.2, 1.4, 0.04), lambert(c1), fx + tx * 1.15, fy + 9.2, fz + tz * 1.15, ry);
      k.add(new THREE.BoxGeometry(1.0, 0.7, 0.06), lambert(c2), fx + tx * 0.75, fy + 9.2, fz + tz * 0.75, ry);
    });
    k.build(g); flush();
    colliders.push({ p: b.p.map(q => [q[0], q[1]]) });
  }

  // Casa do Artesão: casa branca de rodapé vermelho, varanda em "A" de madeira escura com mãos-francesas, telhado de
  // fibrocimento cinza e uma ala comprida atrás (fotos do diretor e do site de turismo)
  if (T.artesao) {
    const { W, ux, uz, side } = T.artesao, k = new Kit();
    const [cx, cz] = W(15.5, 14), g2 = new THREE.Group(); g2.position.set(cx, 0, cz); g2.rotation.y = Math.atan2(-ux, -uz) + (side < 0 ? 0 : 0); g.add(g2);
    const sx = side;                                                     // x local = para o lado da Santos Dumont (sinal)
    let y = Infinity; for (const [a, p] of [[11, 10.5], [11, 17.5], [30, 10.5], [30, 19.5]]) { const [x, z] = W(a, p); y = Math.min(y, H(x, z)); }
    g2.position.y = y;
    const white = lambert(0xf6f5f1), red = lambert(0xd32f2f), brown = lambert(0x3e2a1e), grey = lambert(0x8f9194), under = lambert(0xe3ded4), dark = lambert(0x2c2f33), glass = lambert(0x3a4a55);
    const Hw = 3.4;
    // corpo da frente (7 × 9 m) e ala dos fundos (9 × 10 m)
    k.box(7, Hw, 9, white, 0, 0, 0); k.box(7.1, 0.55, 9.1, red, 0, -0.05, 0);
    k.box(9, Hw - 0.2, 10, white, sx * 1, 0, -9.5); k.box(9.1, 0.55, 10.1, red, sx * 1, -0.05, -9.5);
    // telhados de duas águas (cumeeira na direção do fundo)
    const roof = (w, d, x0, z0, y0, rh) => { const sl = Math.hypot(w / 2 + 0.5, rh), ang = Math.atan2(rh, w / 2 + 0.5);
      for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(sl, 0.08, d + 0.6), grey, x0 + s * (w / 4 + 0.1), y0 + rh / 2, z0, 0, 0, -s * ang);
      const tri = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rh)]);
      k.add(new THREE.ShapeGeometry(tri), white, x0, y0, z0 + d / 2, 0); k.add(new THREE.ShapeGeometry(tri), white, x0, y0, z0 - d / 2, PI); };
    roof(7, 9, 0, 0, Hw, 2.2); roof(9, 10, sx * 1, -9.5, Hw - 0.2, 1.8);
    // porta (grade escura), janelas de moldura vermelha, placa
    k.add(new THREE.BoxGeometry(1.3, 2.3, 0.08), dark, 0, 1.15 + 0.5, 4.52);
    for (const s of [-1, 1]) { k.add(new THREE.BoxGeometry(1.4, 1.5, 0.06), red, s * 2.3, 1.95, 4.52); k.add(new THREE.BoxGeometry(1.1, 1.2, 0.08), glass, s * 2.3, 1.95, 4.55); }
    for (let i = 0; i < 3; i++) { const z = 2 - i * 3; k.add(new THREE.BoxGeometry(0.06, 1.4, 1.3), red, sx * 3.52, 1.95, z); k.add(new THREE.BoxGeometry(0.08, 1.1, 1.0), glass, sx * 3.55, 1.95, z); }
    for (let i = 0; i < 3; i++) { const z = -6 - i * 3; k.add(new THREE.BoxGeometry(0.06, 1.3, 1.3), red, sx * 5.52, 1.85, z); k.add(new THREE.BoxGeometry(0.08, 1.0, 1.0), glass, sx * 5.55, 1.85, z); }
    k.add(quad(2.2, 0.4, 15, 1, 0, 0.625), A, 0, 3.05, 4.58);   // placa (coordenadas locais da casa)
    // degraus vermelhos e brancos
    for (let i = 0; i < 3; i++) k.box(2.6, 0.18, 0.5 * (3 - i), i % 2 ? white : red, 0, i * 0.18 - 0.05, 4.5 + 0.25 * (3 - i));
    // varanda em "A": telhado claro íngreme, caibros escuros, linha, pendural e mãos-francesas
    const pz0 = 4.5, pz1 = 8.2, ew = 3.4, ey = 2.5, ay = 6.0, pl = Math.hypot(ew, ay - ey), pa = Math.atan2(ay - ey, ew);
    for (const s of [-1, 1]) {
      k.add(new THREE.BoxGeometry(pl + 0.3, 0.08, pz1 - pz0 + 0.3), under, s * ew / 2, (ey + ay) / 2, (pz0 + pz1) / 2, 0, 0, -s * pa);
      k.add(new THREE.BoxGeometry(pl + 0.3, 0.2, 0.2), brown, s * ew / 2, (ey + ay) / 2 - 0.1, pz1, 0, 0, -s * pa);          // caibro da frente
      k.add(new THREE.BoxGeometry(0.2, ey, 0.2), brown, s * (ew - 0.2), ey / 2, pz1 - 0.1);                               // pilar
      k.add(new THREE.BoxGeometry(0.16, 1.6, 0.16), brown, s * (ew - 0.75), ey + 0.1, pz1 - 0.1, 0, 0, s * 0.75);         // mão-francesa
    }
    k.add(new THREE.BoxGeometry(ew * 2 - 0.4, 0.18, 0.18), brown, 0, ey + 0.9, pz1 - 0.1);                                // linha
    k.add(new THREE.BoxGeometry(0.18, ay - ey - 0.9, 0.18), brown, 0, (ey + 0.9 + ay) / 2, pz1 - 0.1);                    // pendural
    for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.14, 1.4, 0.14), brown, s * 0.75, ey + 1.5, pz1 - 0.1, 0, 0, -s * 0.9);
    k.add(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-ew + 0.6, 0), new THREE.Vector2(ew - 0.6, 0), new THREE.Vector2(0, ay - ey - 0.7)])), red, 0, ey + 0.4, pz0 + 0.06);   // empena vermelha sob a varanda
    k.build(g2);
    const qx = (a, p) => W(a, p);
    colliders.push({ p: [qx(11, 10.5), qx(11, 17.5), qx(20, 17.5), qx(20, 19.5), qx(30, 19.5), qx(30, 10.5)] });
    for (const [a, p] of [[7.4, 10.8], [7.4, 17.2]]) { const [x, z] = qx(a, p); colliders.push({ circle: [x, z, 0.25] }); }
    flush();
  }

  // Casa de Pedra (Stein Haus): casarão de pedra de 2 andares, reboco caiado gasto, telhado de telha (fotos do site)
  {
    const l = byId.casapedra, f = T.casapedra.f, k = new Kit(), ry = face(f), Lg = 20, D = 9, tx = -f.nz, tz = f.nx;
    let y = Infinity; for (const [a, bb] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) y = Math.min(y, H(l.x + tx * a * Lg / 2 + f.nx * bb * D / 2, l.z + tz * a * Lg / 2 + f.nz * bb * D / 2));
    const stone = lambert(0xd4d0c6), tile = lambert(0xa9583a), Hh = 6.4;
    k.box(Lg, Hh + 1, D, stone, l.x, y - 1, l.z, ry);
    for (const s of [1, -1]) kit.add(quad(Lg, Hh, 8, 3), A, l.x + f.nx * s * (D / 2 + 0.05), y + Hh / 2, l.z + f.nz * s * (D / 2 + 0.05), s > 0 ? ry : ry + PI);
    const rh = 4.2, sl = Math.hypot(D / 2 + 0.5, rh), ra = Math.atan2(rh, D / 2 + 0.5);
    for (const s of [1, -1]) k.add(new THREE.BoxGeometry(Lg + 1, 0.22, sl), tile, l.x + f.nx * s * (D / 4 + 0.1), y + Hh + rh / 2, l.z + f.nz * s * (D / 4 + 0.1), ry, s * ra);
    const tri = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, rh)]);
    for (const s of [1, -1]) k.add(new THREE.ShapeGeometry(tri), stone, l.x + tx * s * Lg / 2, y + Hh, l.z + tz * s * Lg / 2, ry - s * PI / 2);
    // escada de madeira até a porta (foto) e a placa
    k.box(2.2, 0.9, 3, lambert(0x8a6a48), l.x + f.nx * (D / 2 + 1.5) + tx * (-Lg / 2 + 6), y - 0.2, l.z + f.nz * (D / 2 + 1.5) + tz * (-Lg / 2 + 6), ry);
    kit.add(quad(2.4, 0.3, 12), A, l.x + f.nx * (D / 2 + 0.08) + tx * 3.2, y + 3.4, l.z + f.nz * (D / 2 + 0.08) + tz * 3.2, ry);
    k.build(g); flush();
    const P = (a, bb) => [l.x + tx * a + f.nx * bb, l.z + tz * a + f.nz * bb];
    colliders.push({ p: [P(-Lg / 2, -D / 2), P(Lg / 2, -D / 2), P(Lg / 2, D / 2), P(-Lg / 2, D / 2)] });
  }

  // Kinder Park (Alles Blau): fachada de castelo cinza, torres vermelhas com cones coloridos, torre central de agulha verde
  {
    const l = byId.kinder, f = T.kinder.f, k = new Kit(), ry = face(f), tx = -f.nz, tz = f.nx, W = 22;
    const y = Math.min(H(l.x - tx * W / 2, l.z - tz * W / 2), H(l.x + tx * W / 2, l.z + tz * W / 2), H(l.x, l.z));
    const stone = lambert(0x6e7378), stone2 = lambert(0x5b6066), red = lambert(0xd8322c), green = lambert(0x5fae3a), yel = lambert(0xf6c01a), blue = lambert(0x2c7be5), dark = lambert(0x2a2422);
    k.box(W, 6, 3, stone, l.x, y - 0.5, l.z, ry);
    for (let i = 0; i < 11; i++) k.box(1, 1, 3, i % 2 ? stone2 : stone, l.x + tx * (-W / 2 + 1 + i * 2), y + 5.5, l.z + tz * (-W / 2 + 1 + i * 2), ry);   // ameias
    for (const s of [-1, 0, 1]) k.add(new THREE.BoxGeometry(3, 3.6, 0.1), dark, l.x + tx * s * 6 + f.nx * 1.56, y + 1.8, l.z + tz * s * 6 + f.nz * 1.56, ry);   // portões em arco
    k.box(6, 13, 5, stone, l.x - f.nx * 1, y - 0.5, l.z - f.nz * 1, ry);
    k.add(new THREE.ConeGeometry(4.2, 6, 4), green, l.x - f.nx * 1, y + 15.5, l.z - f.nz * 1, ry + PI / 4);
    for (let i = 0; i < 3; i++) k.add(new THREE.BoxGeometry(0.9, 1.6, 0.1), dark, l.x - f.nx * 1 + tx * (i - 1) * 1.6 + f.nx * 2.56, y + 9.5, l.z - f.nz * 1 + tz * (i - 1) * 1.6 + f.nz * 2.56, ry);
    [[-1, yel], [1, blue]].forEach(([s, top]) => {
      const qx = l.x + tx * s * (W / 2 - 0.5), qz = l.z + tz * s * (W / 2 - 0.5);
      k.add(new THREE.CylinderGeometry(1.8, 2, 10, 10), red, qx, y + 4.5, qz);
      k.add(new THREE.ConeGeometry(2.4, 4, 10), top, qx, y + 11.5, qz);
    });
    kit.add(quad(9, 9 / 8, 11), A, l.x + f.nx * 1.58, y + 4.1, l.z + f.nz * 1.58, ry);
    k.build(g); flush();
    const P = (a, bb) => [l.x + tx * a + f.nx * bb, l.z + tz * a + f.nz * bb];
    colliders.push({ p: [P(-W / 2, -1.6), P(-4, -1.6), P(-4, 1.6), P(-W / 2, 1.6)] }, { p: [P(4, -1.6), P(W / 2, -1.6), P(W / 2, 1.6), P(4, 1.6)] });
  }

  // Morro Alto da Pedra: rampa de voo livre, biruta e o balanço com a vista (fotos do site)
  {
    const l = byId.asadelta, k = new Kit();
    let px = l.x, pz = l.z, ph = H(l.x, l.z);
    for (let i = 0; i < 36; i++) { const a = i / 12 * PI * 2, r = 10 + Math.floor(i / 12) * 12, x = l.x + Math.cos(a) * r, z = l.z + Math.sin(a) * r, h = H(x, z); if (h > ph) { ph = h; px = x; pz = z; } }
    let da = 0, lo = 1e9; for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, h = H(px + Math.cos(a) * 40, pz + Math.sin(a) * 40); if (h < lo) { lo = h; da = a; } }   // encosta abaixo
    const wood = lambert(0x7a5a3a), ry = -da + PI / 2, dx = Math.cos(da), dz = Math.sin(da);
    // balanço: dois cavaletes e a trave
    const bx = px + dx * 6 - dz * 6, bz = pz + dz * 6 + dx * 6, by = H(bx, bz);
    for (const s of [-1, 1]) for (const t of [-1, 1]) k.add(new THREE.BoxGeometry(0.22, 5.6, 0.22), wood, bx - dz * s * 1.6 + dx * t * 0.7, by + 2.7, bz + dx * s * 1.6 + dz * t * 0.7, ry, t * 0.14);
    k.add(new THREE.BoxGeometry(3.6, 0.24, 0.24), wood, bx, by + 5.4, bz, ry);
    for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.04, 4, 0.04), lambert(0x555555), bx - dz * s * 0.35, by + 3.4, bz + dx * s * 0.35);
    k.add(new THREE.BoxGeometry(0.9, 0.08, 0.35), wood, bx, by + 1.4, bz, ry);
    // rampa de decolagem (deque inclinado na beira) e biruta
    const rx = px + dx * 10, rz = pz + dz * 10, rh = H(rx, rz);
    k.add(new THREE.BoxGeometry(5, 0.3, 10), lambert(0x8d7a5c), rx, rh + 0.6, rz, -da - PI / 2, -0.2);
    const wx = px - dz * 5, wz = pz + dx * 5, wy = H(wx, wz);
    k.box(0.12, 6, 0.12, lambert(0xcfcfcf), wx, wy, wz);
    kit.add(new THREE.ConeGeometry(0.45, 2.2, 8, 1, true).rotateZ(PI / 2).translate(1.1, 0, 0), A, wx, wy + 5.7, wz, ry);
    k.build(g); flush();
  }
}

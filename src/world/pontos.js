// Pontos turísticos fora do centro, a partir de fotos livres (Wikimedia Commons) e descrições públicas:
//  - Cascata da Solitária: poço cercado de paredões de pedra avermelhada na mata, queda d'água animada
//    (foto "Cascata da Solitária - Igrejinha - RS - panoramio", CC BY-SA 3.0)
//  - Monte da Fé (Morro da Cruz): cruz de 35 m a ~650 m de altitude, mirante e café (Jornal NH, 2025)
//  - Edifício Heidelberg: torre residencial em estilo enxaimel, telhados escuros íngremes
//    (foto "Edifício Heidelberg - Igrejinha", CC BY-SA 4.0); 11 pavimentos pelo cadastro do GEO Igrejinha
import * as THREE from 'three';
import { Kit, lambert, tex } from './landmarks3d.js';
import { byId } from '../landmarks.js';

const PI = Math.PI;
export const HEIDELBERG = { x: -590.5, z: -461.7, ux: 0.13, uz: -0.992, w: 19.5, d: 9 };
export const heidelbergExclusion = (x, z) => {
  const o = HEIDELBERG, dx = x - o.x, dz = z - o.z;
  return Math.abs(dx * o.ux + dz * o.uz) < o.w / 2 + 2 && Math.abs(-dx * o.uz + dz * o.ux) < o.d / 2 + 2;
};

export function buildPontos(terrain, root, colliders, updaters, world = null) {
  const H = (x, z) => terrain.heightAt(x, z);

  /* ---------- Cascata da Solitária (igrejinha.tur.br): degraus largos de arenito, lâminas d'água, poço raso com seixos ---------- */
  {
    const c = byId.cascata, k = new Kit(), g = new THREE.Group(); root.add(g);
    // direção do rio = descida do terreno
    // direção do arroio (dados do mapa), no sentido em que desce; sem dados, a descida do terreno
    let dn = 0, lo = 1e9; for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, h = H(c.x + Math.cos(a) * 30, c.z + Math.sin(a) * 30); if (h < lo) { lo = h; dn = a; } }
    let seg = null; for (const r of world?.water || []) { const p = r.p; if (!p || r.k !== 'stream' && r.k !== 'river') continue; for (let i = 0; i < p.length - 1; i++) { const d = Math.hypot(p[i][0] - c.x, p[i][1] - c.z); if (d < 25 && (!seg || d < seg.d)) seg = { d, a: p[i], b: p[i + 1] }; } }
    if (seg) { let a = Math.atan2(seg.b[1] - seg.a[1], seg.b[0] - seg.a[0]); if (H(c.x + Math.cos(a) * 20, c.z + Math.sin(a) * 20) > H(c.x - Math.cos(a) * 20, c.z - Math.sin(a) * 20)) a += PI; dn = a; }
    const dx = Math.cos(dn), dz = Math.sin(dn), ry = -dn + PI / 2, y0 = H(c.x, c.z);   // ry: eixo local z = rio abaixo
    const sand = [lambert(0xa8916c), lambert(0x97805c), lambert(0xb49d78)], peb = [lambert(0x8f8577), lambert(0xa39886), lambert(0x6f675c)];
    const wt = tex(64, 256, (cx, w, h) => { cx.fillStyle = '#e3eef4'; cx.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { cx.fillStyle = `rgba(255,255,255,${0.35 + (i % 5) * 0.12})`; cx.fillRect((i * 37) % w, (i * 53) % h, 2 + (i % 3), 18 + (i % 7) * 6); } cx.fillStyle = 'rgba(120,150,160,0.25)'; for (let i = 0; i < 30; i++) cx.fillRect((i * 19) % w, (i * 71) % h, 3, 40); }, true);
    wt.repeat.set(4, 1);
    const fallM = new THREE.MeshLambertMaterial({ map: wt, transparent: true, opacity: 0.88, emissive: 0x2a3640 });
    const P = (u, v) => [c.x + dx * v - dz * u, c.z + dz * v + dx * u];   // u = através do rio, v = rio abaixo
    // três degraus de laje apoiados no terreno: cada um ≥ 1,1 m acima do de baixo (a água cai essa altura)
    const W = 12, [p0x, p0z] = P(0, 7), yPool = H(p0x, p0z);
    let below = yPool; const tops = [];
    for (const v of [-2, -8, -14]) { const [x, z] = P(0, v); const t = Math.max(H(x, z) + 0.3, below + 1.1); tops.push([v, t, t - below]); below = t; }
    tops.forEach(([v, top, drop], i) => {
      for (let j = 0; j < 5; j++) {
        const u = -W / 2 + 1.2 + j * (W - 2.4) / 4, [x, z] = P(u, v - 2.6 + ((j * 5 + i) % 3) * 0.35), hb = Math.min(H(x, z), top) - 1.5;
        k.add(new THREE.BoxGeometry(3.4, 1, 6), sand[(i + j) % 3], x, (top + hb) / 2, z, ry, 0, ((j + i) % 3 - 1) * 0.03, 1, top - hb, 1);
      }
      const [fx, fz] = P(0, v + 0.42);
      k.add(new THREE.PlaneGeometry(W * 0.7, drop), fallM, fx, top - drop / 2, fz, ry);                    // lâmina caindo
      const [wx, wz] = P(0, v - 2.6);
      k.add(new THREE.PlaneGeometry(W * 0.72, 6).rotateX(-PI / 2), fallM, wx, top + 0.03, wz, ry);        // água correndo na laje
    });
    // paredes laterais do vale (lajes empilhadas) e seixos arredondados no poço e nas margens (foto)
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const v = -16 + i * 4.5, [x, z] = P(s * (W / 2 + 1.6), v), t = (tops[Math.min(2, Math.max(0, Math.floor((-v - 2) / 6)))] || tops[0])[1] + 1.2, hb = H(x, z) - 1;
      k.add(new THREE.BoxGeometry(3.6, 1, 4.6), sand[i % 3], x, (t + hb) / 2, z, ry + (i % 2) * 0.08, 0, 0, 1, Math.max(1, t - hb), 1); }
    for (let i = 0; i < 40; i++) {
      const u = ((i * 37) % 100) / 100 * (W + 6) - (W + 6) / 2, v = 1 + ((i * 53) % 100) / 100 * 12, [x, z] = P(u, v), r = 0.35 + (i % 5) * 0.16;
      k.add(new THREE.IcosahedronGeometry(1, 1), peb[i % 3], x, Math.max(H(x, z), yPool) + r * 0.25, z, i, i * 0.3, 0, r * 1.3, r * 0.75, r);
    }
    k.build(g);
    const [px, pz] = [p0x, p0z];
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 28).rotateX(-PI / 2), new THREE.MeshPhongMaterial({ color: 0x5f7f6c, specular: 0xbfd8e0, shininess: 90, transparent: true, opacity: 0.78 }));
    pool.scale.set(9, 1, 7); pool.position.set(px, yPool + 0.3, pz); pool.rotation.y = ry; g.add(pool);
    updaters.push(dt => { wt.offset.y = (wt.offset.y - dt * 1.4) % 1; });
  }

  /* ---------- Monte da Fé (igrejinha.tur.br): cruz branca sobre o prédio branco do mirante, escadaria de corrimão preto,
     letreiro colorido "MONTE DA FÉ" na entrada ---------- */
  {
    const c = byId.cruz, k = new Kit(), g = new THREE.Group(); root.add(g);
    let px = c.x, pz = c.z, ph = H(c.x, c.z);
    for (let i = 0; i < 24; i++) { const a = i / 12 * PI * 2, r = 10 + Math.floor(i / 12) * 12, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r, h = H(x, z); if (h > ph) { ph = h; px = x; pz = z; } }
    const white = lambert(0xf6f6f2), conc = lambert(0xcac6bd), rail = lambert(0x1e1f22), glass = lambert(0x3b4752), steps = lambert(0xb8b2a6);
    const ax = Math.atan2(0 - pz, 0 - px), ry = -ax + PI / 2, ux = Math.cos(ax), uz = Math.sin(ax);   // eixo local z = rumo à cidade
    const Q = (a, b) => [px + ux * b - uz * a, pz + uz * b + ux * a];
    // prédio do mirante/café: dois volumes brancos, terraço com guarda-corpo preto
    k.box(12, 4.2, 9, white, px, ph - 1, pz, ry);
    for (const s of [1, -1]) k.add(new THREE.BoxGeometry(10, 1.6, 0.1), glass, ...(([x, z]) => [x, ph + 1.6, z])(Q(0, s * 4.56)), ry);
    for (const [a, b, w, d] of [[0, 4.5, 12, 0.06], [0, -4.5, 12, 0.06], [6, 0, 0.06, 9], [-6, 0, 0.06, 9]]) { const [x, z] = Q(a, b); k.add(new THREE.BoxGeometry(w, 1.1, d), rail, x, ph + 3.75, z, ry); }
    // cruz de 35 m saindo do terraço
    k.box(1.6, 35, 1.6, white, px, ph + 3.2, pz, ry);
    k.box(12, 1.6, 1.6, white, px, ph + 3.2 + 24, pz, ry);
    // arco metálico sobre o terraço (foto)
    for (let i = 0; i <= 8; i++) { const t = i / 8 * PI, [x, z] = Q(-3 + Math.cos(t) * 2.2, -2.5); k.add(new THREE.BoxGeometry(0.12, 0.12, 0.12), rail, x, ph + 3.2 + Math.sin(t) * 2.6, z); }
    // escadaria larga descendo para a cidade, corrimãos pretos
    for (let i = 0; i < 14; i++) {
      const [x, z] = Q(0, 6.5 + i * 1.1), y = Math.max(H(x, z), ph - 1 - i * 0.45);
      k.add(new THREE.BoxGeometry(3.6, 0.45, 1.15), steps, x, y - 0.2, z, ry);
      if (i % 2 === 0) for (const s of [-1, 1]) { const [rx, rz] = Q(s * 1.9, 6.5 + i * 1.1); k.box(0.07, 1.0, 0.07, rail, rx, y, rz, ry); }
    }
    for (const s of [-1, 1]) { const [a0, a1] = [Q(s * 1.9, 6.5), Q(s * 1.9, 6.5 + 13 * 1.1)], y0 = ph - 1 + 1, y1 = Math.max(H(a1[0], a1[1]), ph - 1 - 13 * 0.45) + 1;
      const L = Math.hypot(a1[0] - a0[0], a1[1] - a0[1], y1 - y0); k.add(new THREE.BoxGeometry(0.06, 0.06, L), rail, (a0[0] + a1[0]) / 2, (y0 + y1) / 2, (a0[1] + a1[1]) / 2, ry, Math.atan2(y0 - y1, Math.hypot(a1[0] - a0[0], a1[1] - a0[1]))); }
    // letreiro colorido "MONTE DA FÉ" ao pé da escada, com pórtico de madeira atrás
    const [lx, lz] = Q(0, 6.5 + 14 * 1.1 + 4), ly = H(lx, lz);
    const letters = tex(512, 96, (x, w, h) => { const L = 'MONTE DA FÉ'.split(''), C = ['#3fa9e0', '#f6c01a', '#e8322c', '#33a852', '#f08a24', '', '#2c7be5', '#e8322c', '', '#33a852', '#f6c01a']; x.font = 'bold 84px sans-serif'; x.textBaseline = 'middle'; let p = 12; L.forEach((ch, i) => { if (ch !== ' ') { x.fillStyle = C[i]; x.fillText(ch, p, h / 2 + 4); } p += ch === ' ' ? 26 : x.measureText(ch).width + 2; }); });
    const lm = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), new THREE.MeshLambertMaterial({ map: letters, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
    lm.position.set(lx, ly + 0.9, lz); lm.rotation.y = ry; g.add(lm);
    k.box(7.6, 0.25, 0.8, conc, lx, ly, lz, ry);
    const wood = lambert(0x5b4330), [bx, bz] = Q(0, 6.5 + 14 * 1.1 + 2.5);
    for (const s of [-1, 1]) { const [x, z] = Q(s * 3.6, 6.5 + 14 * 1.1 + 2.5); k.box(0.3, 3.4, 0.3, wood, x, H(x, z), z, ry); }
    k.add(new THREE.BoxGeometry(7.6, 0.3, 0.3), wood, bx, H(bx, bz) + 3.3, bz, ry);
    k.build(g);
    // a cruz acende à noite
    const glow = new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0 });
    const halo = new THREE.Mesh(new THREE.BoxGeometry(1.7, 35, 1.7), glow); halo.position.set(px, ph + 20.7, pz); halo.rotation.y = ry; g.add(halo);
    updaters.push((dt, s) => { glow.opacity = s.night * 0.35; });
    const C4 = [Q(-6, -4.5), Q(6, -4.5), Q(6, 4.5), Q(-6, 4.5)];
    colliders.push({ p: C4 });
  }

  /* ---------- Edifício Heidelberg (centro, 11 pavimentos, estilo enxaimel) ---------- */
  {
    const o = HEIDELBERG, floors = 11, fh = 3, W = o.w, D = o.d;
    let y = Infinity; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) y = Math.min(y, H(o.x + o.ux * a * W / 2 - o.uz * b * D / 2, o.z + o.uz * a * W / 2 + o.ux * b * D / 2));
    const g = new THREE.Group(); g.position.set(o.x, y, o.z); g.rotation.y = Math.atan2(-o.uz, o.ux); root.add(g);
    const k = new Kit(), dark = lambert(0x2a2a2c), slate = lambert(0x3c3f44), base = lambert(0x8a7f74);
    // fachada: reboco branco, enxaimel escuro, janelas — textura por andar
    const ft = tex(128, 96, (c, w, h) => {
      c.fillStyle = '#f4f2ec'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2b2d';
      c.fillRect(0, h - 7, w, 7); c.fillRect(0, 58, w, 5); c.fillRect(0, 0, 7, h); c.fillRect(w - 7, 0, 7, h);
      c.fillStyle = '#3b4650'; c.fillRect(34, 14, 60, 42); c.fillStyle = '#e8e4da'; c.fillRect(62, 14, 4, 42);
      c.lineWidth = 4; c.strokeStyle = '#2b2b2d'; c.beginPath(); c.moveTo(7, 63); c.lineTo(w / 2, h - 7); c.lineTo(w - 7, 63); c.stroke();
    }, true);
    const fm = new THREE.MeshLambertMaterial({ map: ft }); ft.repeat.set(Math.round(W / 4), floors);
    const fm2 = new THREE.MeshLambertMaterial({ map: ft.clone() }); fm2.map.repeat.set(Math.round(D / 4), floors); fm2.map.needsUpdate = true;
    const Ht = floors * fh;
    k.box(W, 3, D, base, 0, 0, 0);                                                    // térreo de pedra
    k.add(new THREE.PlaneGeometry(W, Ht), fm, 0, 3 + Ht / 2, D / 2 + 0.02);
    k.add(new THREE.PlaneGeometry(W, Ht), fm, 0, 3 + Ht / 2, -D / 2 - 0.02, PI);
    k.add(new THREE.PlaneGeometry(D, Ht), fm2, W / 2 + 0.02, 3 + Ht / 2, 0, PI / 2);
    k.add(new THREE.PlaneGeometry(D, Ht), fm2, -W / 2 - 0.02, 3 + Ht / 2, 0, -PI / 2);
    k.box(W - 0.1, Ht, D - 0.1, lambert(0xf4f2ec), 0, 3, 0);
    // telhado escuro íngreme com torreões e mansardas (foto)
    const top = 3 + Ht, rh = 7, sl = Math.hypot(D / 2 + 0.6, rh), sa = Math.atan2(rh, D / 2 + 0.6);
    for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(W + 1, 0.3, sl), slate, 0, top + rh / 2, s * (D / 4 + 0.15), 0, s * sa);
    for (const s of [-1, 1]) { const tri = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, rh)]); k.add(new THREE.ShapeGeometry(tri), lambert(0xf4f2ec), s * W / 2, top, 0, s > 0 ? PI / 2 : -PI / 2); }
    for (const sx of [-1, 1]) { k.box(4, 4, 4, lambert(0xf4f2ec), sx * (W / 2 - 1.5), top, D / 2 - 1.5); k.add(new THREE.ConeGeometry(3.2, 5, 4), slate, sx * (W / 2 - 1.5), top + 6.5, D / 2 - 1.5, PI / 4); }
    for (let i = -1; i <= 1; i++) { k.box(2.2, 2.2, 1.6, lambert(0xf4f2ec), i * 5, top + 1, D / 2 - 0.6); k.add(new THREE.ConeGeometry(1.8, 1.8, 4), slate, i * 5, top + 4.1, D / 2 - 0.6, PI / 4); }
    k.box(1.4, 4, 1.4, dark, -W / 2 + 4, top + rh - 2, 0);                         // chaminé
    k.build(g);
    const c2 = (a, b) => [o.x + o.ux * a - o.uz * b, o.z + o.uz * a + o.ux * b];
    colliders.push({ p: [c2(-W / 2, -D / 2), c2(W / 2, -D / 2), c2(W / 2, D / 2), c2(-W / 2, D / 2)] });
  }
}

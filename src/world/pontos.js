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

export function buildPontos(terrain, root, colliders, updaters) {
  const H = (x, z) => terrain.heightAt(x, z);

  /* ---------- Cascata da Solitária ---------- */
  {
    const c = byId.cascata, k = new Kit(), g = new THREE.Group(); root.add(g);
    const y0 = H(c.x, c.z), rock = lambert(0x8a5a44), rock2 = lambert(0x6e4636), moss = lambert(0x4d6a34);
    // paredão em ferradura em volta do poço (lado "de cima" do terreno)
    let up = 0, best = -1e9; for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, h = H(c.x + Math.cos(a) * 25, c.z + Math.sin(a) * 25); if (h > best) { best = h; up = a; } }
    const fallH = Math.max(9, Math.min(16, best - y0 + 4));
    // paredão de arenito em camadas (ferradura), cada camada recua um pouco, tons avermelhados como na foto
    const tones = [lambert(0x9a5f45), lambert(0x84503b), lambert(0xa86d50), rock2], tiers = Math.ceil(fallH / 2.2) + 1;
    for (let i = 0; i < 26; i++) {
      const a = up - 1.75 + i / 25 * 3.5, seg = 3.5 / 25 * 12.5 + 0.6;
      for (let t = 0; t < tiers; t++) {
        const r = 11 + t * 0.35 + ((i * 13 + t * 7) % 5) * 0.12, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        k.add(new THREE.BoxGeometry(2.4 + ((i + t) % 3) * 0.3, 2.2, seg), tones[(i + t * 3) % 4], x, y0 + 1.1 + t * 2.2, z, -a, 0, ((i + t) % 3 - 1) * 0.03);
      }
      if (i % 2 === 0) k.add(new THREE.IcosahedronGeometry(1, 0), moss, c.x + Math.cos(a) * (12 + tiers * 0.35), y0 + tiers * 2.2 + 0.3, c.z + Math.sin(a) * (12 + tiers * 0.35), i, 0, 0, 2.2, 0.9, 2.2);
    }
    // pedras soltas na beira do poço
    for (let i = 0; i < 10; i++) { const a = up + PI - 1.2 + i * 0.26, r = 9 + (i % 2) * 1.5; k.add(new THREE.DodecahedronGeometry(0.9 + (i % 3) * 0.3, 0), rock2, c.x + Math.cos(a) * r, y0 + 0.2, c.z + Math.sin(a) * r, i, i, 0, 1.3, 0.7, 1.1); }
    k.build(g);
    // poço (água escura) e queda d'água com textura que corre
    const pool = new THREE.Mesh(new THREE.CircleGeometry(9.5, 24).rotateX(-PI / 2), new THREE.MeshPhongMaterial({ color: 0x3e5a4c, specular: 0x9fb8c8, shininess: 80, transparent: true, opacity: 0.9 }));
    pool.position.set(c.x, y0 + 0.35, c.z); g.add(pool);
    const wt = tex(64, 256, (cx, w, h) => { cx.fillStyle = '#d8e6ee'; cx.fillRect(0, 0, w, h); for (let i = 0; i < 90; i++) { cx.fillStyle = `rgba(255,255,255,${0.3 + (i % 5) * 0.12})`; cx.fillRect((i * 37) % w, (i * 53) % h, 2 + (i % 3), 18 + (i % 7) * 6); } }, true);
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(4.5, fallH), new THREE.MeshLambertMaterial({ map: wt, transparent: true, opacity: 0.85, emissive: 0x334455 }));
    fall.position.set(c.x + Math.cos(up) * 9.6, y0 + fallH / 2 + 0.2, c.z + Math.sin(up) * 9.6); fall.lookAt(c.x, y0 + fallH / 2, c.z); g.add(fall);
    const foam = new THREE.Mesh(new THREE.CircleGeometry(2.4, 16).rotateX(-PI / 2), new THREE.MeshLambertMaterial({ color: 0xf4f8fa, transparent: true, opacity: 0.7 }));
    foam.position.set(c.x + Math.cos(up) * 8.3, y0 + 0.4, c.z + Math.sin(up) * 8.3); g.add(foam);
    wt.repeat.set(1, 2);
    updaters.push(dt => { wt.offset.y = (wt.offset.y + dt * 1.6) % 1; foam.scale.setScalar(1 + Math.sin(performance.now() / 180) * 0.06); });
    colliders.push({ circle: [c.x, c.z, 8.5] });
  }

  /* ---------- Monte da Fé: cruz de 35 m, mirante e café ---------- */
  {
    const c = byId.cruz, k = new Kit(), g = new THREE.Group(); root.add(g);
    // ponto mais alto num raio de 60 m
    let px = c.x, pz = c.z, ph = H(c.x, c.z);
    for (let i = 0; i < 48; i++) { const a = i / 12 * PI * 2, r = 15 + Math.floor(i / 12) * 15, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r, h = H(x, z); if (h > ph) { ph = h; px = x; pz = z; } }
    const white = lambert(0xf4f4f0), conc = lambert(0xc9c5bc), wood = lambert(0x6b4a33), rail = lambert(0x4a4f55), roof = lambert(0x7a3a28);
    // base de concreto e cruz branca (35 m)
    k.box(6, 1.2, 6, conc, px, ph - 0.4, pz);
    k.box(1.6, 35, 1.6, white, px, ph + 0.8, pz);
    k.box(11, 1.6, 1.6, white, px, ph + 0.8 + 24, pz);
    // deque do mirante voltado para a cidade (sudeste)
    const ax = Math.atan2(0 - pz, 0 - px), mx = px + Math.cos(ax) * 9, mz = pz + Math.sin(ax) * 9, my = H(mx, mz);
    k.add(new THREE.BoxGeometry(10, 0.25, 6), wood, mx, Math.max(my, ph - 1) + 0.5, mz, -ax);
    for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(10, 1, 0.08), rail, mx + Math.sin(ax) * s * 3, Math.max(my, ph - 1) + 1.1, mz - Math.cos(ax) * s * 3, -ax);
    k.add(new THREE.BoxGeometry(0.08, 1, 6), rail, mx + Math.cos(ax) * 5, Math.max(my, ph - 1) + 1.1, mz + Math.sin(ax) * 5, -ax);
    // café (casinha de madeira, telhado de telha)
    const cx = px - Math.cos(ax) * 12, cz = pz - Math.sin(ax) * 12, cy = H(cx, cz);
    k.box(8, 3, 6, wood, cx, cy, cz, -ax);
    const sl = Math.hypot(3.6, 1.8);
    for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(9, 0.15, sl), roof, cx + Math.sin(ax) * s * 1.6, cy + 3.9, cz - Math.cos(ax) * s * 1.6, -ax, s * 0.46);
    const sign = tex(256, 64, (x, w, h) => { x.fillStyle = '#4a2c1c'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2e3c2'; x.font = 'bold 30px serif'; x.textAlign = 'center'; x.fillText('Café Monte da Fé', w / 2, 42); });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 0.9), new THREE.MeshLambertMaterial({ map: sign }));
    sm.position.set(cx + Math.cos(ax) * 4.05, cy + 2.4, cz + Math.sin(ax) * 4.05); sm.rotation.y = -ax + PI / 2; g.add(sm);
    k.build(g);
    // luz da cruz à noite (holofotes na base)
    const glow = new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0 });
    const halo = new THREE.Mesh(new THREE.BoxGeometry(1.7, 35, 1.7), glow); halo.position.set(px, ph + 18.3, pz); g.add(halo);
    updaters.push((dt, s) => { glow.opacity = s.night * 0.35; });
    colliders.push({ circle: [px, pz, 3] }, { circle: [cx, cz, 4.5] });
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
    for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(W + 1, 0.3, sl), slate, 0, top + rh / 2, s * (D / 4 + 0.15), 0, -s * sa);
    for (const s of [-1, 1]) { const tri = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, rh)]); k.add(new THREE.ShapeGeometry(tri), lambert(0xf4f2ec), s * W / 2, top, 0, s > 0 ? PI / 2 : -PI / 2); }
    for (const sx of [-1, 1]) { k.box(4, 4, 4, lambert(0xf4f2ec), sx * (W / 2 - 1.5), top, D / 2 - 1.5); k.add(new THREE.ConeGeometry(3.2, 5, 4), slate, sx * (W / 2 - 1.5), top + 6.5, D / 2 - 1.5, PI / 4); }
    for (let i = -1; i <= 1; i++) { k.box(2.2, 2.2, 1.6, lambert(0xf4f2ec), i * 5, top + 1, D / 2 - 0.6); k.add(new THREE.ConeGeometry(1.8, 1.8, 4), slate, i * 5, top + 4.1, D / 2 - 0.6, PI / 4); }
    k.box(1.4, 4, 1.4, dark, -W / 2 + 4, top + rh - 2, 0);                         // chaminé
    k.build(g);
    const c2 = (a, b) => [o.x + o.ux * a - o.uz * b, o.z + o.uz * a + o.ux * b];
    colliders.push({ p: [c2(-W / 2, -D / 2), c2(W / 2, -D / 2), c2(W / 2, D / 2), c2(-W / 2, D / 2)] });
  }
}

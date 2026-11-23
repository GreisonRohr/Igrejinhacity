// Prédios marcantes em volta da Praça Dona Luísa, a partir das fotos do diretor (Street View abr/2026):
// torre Athos (24 andares, em obra, base com losangos laranja e pretos), agência da Caixa, Panvel (esquina
// Osvaldo Cruz × Gen. Ernesto Dorneles) e Farmácias São João (esquina Gen. Ernesto Dorneles × João Corrêa).
// Cada um substitui o prédio genérico do lote (exclusões em placeLandmarks).
import * as THREE from 'three';
import { Kit, lambert, tex } from './landmarks3d.js';

const PI = Math.PI;
// x, z (centro), rotação (rad; +x local = frente principal, −z local = lateral da esquina), largura (x), profundidade (z)
export const ENTORNO = {
  athos: { x: -84, z: -66, rot: Math.atan2(-0.12, 0.99), w: 26, d: 20 },
  caixa: { x: -80, z: -44, rot: Math.atan2(-0.12, 0.99), w: 16, d: 14 },
  // SE da Osvaldo Cruz × Gen. Ernesto Dorneles; letreiro para o norte (+x local) e lateral na Dorneles (−z local)
  panvel: { x: 61, z: -25, rot: Math.PI / 2, w: 24, d: 20 },
  // SW da João Corrêa × Gen. Ernesto Dorneles (telhado de 4 águas na vista aérea); frente na Dorneles, lateral na João Corrêa
  saojoao: { x: 14, z: 70, rot: 0, w: 26, d: 36 },
  // NE da Osvaldo Cruz × Dorneles: sobrado de 3 andares com Levi, Casa de Carnes e Escola de Música (frente oeste)
  levi: { x: 61, z: -60, rot: Math.PI, w: 17, d: 17 },
  // NE da João Corrêa × Dorneles: torre cinza de 9 andares, térreo vermelho do Mercadão dos Óculos (frente oeste, lateral sul)
  oculos: { x: 51, z: 37, rot: Math.PI, w: 14, d: 15 },
  // ao norte, na Dorneles: fileira de sobrados com o Jair Cabeleireiro e a Hashtag Presentes (fachada roxa)
  jair: { x: 61, z: 20, rot: Math.PI, w: 30, d: 13 },
  hashtag: { x: 63, z: 8, rot: Math.PI, w: 25, d: 11 },
  // NW da Castelo Branco × João Corrêa: sobrado branco de telhado de 4 águas com a Agafarma (frente sul, lateral leste)
  agafarma: { x: -70, z: 33, rot: -Math.PI / 2, w: 16, d: 12 },
  // R. Gen. Ernesto Dorneles 592: residencial de 10 andares, térreo com lojas (Sonia Moden Haus)
  r592: { x: 62, z: -82, rot: Math.PI, w: 16, d: 22 },
};
/** Funções de exclusão (centro de prédio genérico dentro da área sai do mapa). */
export function entornoExclusions() {
  return Object.values(ENTORNO).map(o => (x, z) => {
    const dx = x - o.x, dz = z - o.z, c = Math.cos(o.rot), s = Math.sin(o.rot);
    return Math.abs(dx * c - dz * s) < o.w / 2 + 2 && Math.abs(dx * s + dz * c) < o.d / 2 + 2;
  });
}

const sign = (w, h, bg, draw) => tex(w, h, (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); draw(c, W, H); });

export function buildEntorno(terrain, root, colliders) {
  const H = (x, z) => terrain.heightAt(x, z);
  const place = (o) => {
    const g = new THREE.Group();
    let y = Infinity; for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const c = Math.cos(o.rot), s = Math.sin(o.rot), lx = a * o.w / 2, lz = b * o.d / 2; y = Math.min(y, H(o.x + lx * c + lz * s, o.z - lx * s + lz * c)); }
    g.position.set(o.x, y, o.z); g.rotation.y = o.rot; root.add(g);
    const c = Math.cos(o.rot), s = Math.sin(o.rot), P = (lx, lz) => [o.x + lx * c + lz * s, o.z - lx * s + lz * c];
    colliders.push({ p: [P(-o.w / 2, -o.d / 2), P(o.w / 2, -o.d / 2), P(o.w / 2, o.d / 2), P(-o.w / 2, o.d / 2)] });
    return g;
  };
  // fachada de janelas (faixas de andar); repeat = número de andares
  const windowsTex = (wall, glass, cols = 4) => { const t = tex(128, 64, (c, W, Hh) => { c.fillStyle = wall; c.fillRect(0, 0, W, Hh); for (let i = 0; i < cols; i++) { c.fillStyle = glass; c.fillRect(6 + i * (W / cols), 14, W / cols - 12, 34); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(6 + i * (W / cols), 46, W / cols - 12, 3); } c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, 60, W, 4); }, true); return t; };

  /* ---------- torre Athos: 24 andares + base com losangos ---------- */
  {
    const o = ENTORNO.athos, g = place(o), k = new Kit();
    const floors = 24, fh = 3.05, tw = 18, td = 15, base = 7.5;
    const tm = new THREE.MeshLambertMaterial({ map: windowsTex('#e8e1d2', '#4a5560', 5) }); tm.map.repeat.set(3, floors);
    const tm2 = new THREE.MeshLambertMaterial({ map: windowsTex('#e8e1d2', '#4a5560', 5) }); tm2.map.repeat.set(2.5, floors);
    // torre (recuada para o fundo do lote), faces com janelas
    for (const [px, pz, w, ry, m] of [[tw / 2, 0, td, PI / 2, tm2], [-tw / 2, 0, td, -PI / 2, tm2], [0, td / 2, tw, 0, tm], [0, -td / 2, tw, PI, tm]]) {
      k.add(new THREE.PlaneGeometry(w, floors * fh), m, px - 2, base + floors * fh / 2, pz - 2, ry);
    }
    k.add(new THREE.BoxGeometry(tw, 0.4, td), lambert(0xd9d2c2), -2, base + floors * fh + 0.2, -2);
    k.add(new THREE.BoxGeometry(5, 4, 4), lambert(0xd9d2c2), -2, base + floors * fh + 2.2, -2);   // casa de máquinas
    // faixa vertical branca (pilar da fachada) e grua da obra
    k.add(new THREE.BoxGeometry(1.4, floors * fh, 0.6), lambert(0xf4f2ec), 1, base + floors * fh / 2, td / 2 - 1.7);
    k.add(new THREE.BoxGeometry(0.8, floors * fh * 0.9, 0.8), lambert(0xc8642c), -tw / 2 - 2.5, base + floors * fh * 0.45, td / 2 - 3);
    // base: losangos laranja e pretos (esquina), mureta preta com o nome
    const diamonds = sign(256, 128, '#c06a2e', (c, W, Hh) => {
      for (let y = -32; y < Hh + 32; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < W + 32; x += 64) { c.fillStyle = '#2a2622'; c.beginPath(); c.moveTo(x, y + 16); c.lineTo(x + 16, y); c.lineTo(x + 32, y + 16); c.lineTo(x + 16, y + 32); c.fill(); }
    });
    const dm = new THREE.MeshLambertMaterial({ map: diamonds });
    k.add(new THREE.BoxGeometry(o.w, 0.5, o.d), lambert(0xdedad2), 0, base - 0.25, 0);
    k.add(new THREE.BoxGeometry(12, base - 3.4, 9), dm, o.w / 2 - 6, 3.4 + (base - 3.4) / 2, -o.d / 2 + 4.5);
    k.add(new THREE.BoxGeometry(o.w - 12, base - 0.5, o.d), lambert(0xf2f0ea), -6, (base - 0.5) / 2, 0);
    k.add(new THREE.BoxGeometry(11.5, 3.2, 8.5), lambert(0x2d3338), o.w / 2 - 6, 1.6, -o.d / 2 + 4.5);   // térreo envidraçado
    const nameT = sign(256, 48, '#1c1c1e', (c, W, Hh) => { c.fillStyle = '#e8e4da'; c.font = '34px serif'; c.textAlign = 'center'; c.fillText('A T H O S', W / 2, 36); });
    k.add(new THREE.PlaneGeometry(10, 1.6), new THREE.MeshLambertMaterial({ map: nameT }), o.w / 2 + 0.02, 0.9, -2, PI / 2);
    k.build(g);
  }
  /* ---------- Caixa: térreo de vidro escuro, faixa azul ---------- */
  {
    const o = ENTORNO.caixa, g = place(o), k = new Kit();
    k.add(new THREE.BoxGeometry(o.w, 6.5, o.d), lambert(0x3a3f45), 0, 3.25, 0);
    k.add(new THREE.BoxGeometry(o.w + 0.4, 1.0, o.d + 0.4), lambert(0x22262a), 0, 6.4, 0);
    k.add(new THREE.BoxGeometry(0.1, 3.4, o.d - 2), lambert(0x8fa3b0), o.w / 2 + 0.02, 1.9, 0);   // vitrine
    const cx = sign(256, 64, '#1b5fae', (c, W, Hh) => { c.fillStyle = '#fff'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.fillText('CAIXA', W / 2, 46); c.fillStyle = '#f39200'; c.fillRect(W / 2 + 62, 14, 10, 36); });
    k.add(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshLambertMaterial({ map: cx }), o.w / 2 + 0.06, 4.4, -2, PI / 2);
    k.add(new THREE.BoxGeometry(0.1, 3.4, 4), lambert(0x1b5fae), o.w / 2 + 0.05, 1.7, 3);         // porta azul
    k.build(g);
  }
  /* ---------- Panvel: esquina branca com faixa azul e laranja ---------- */
  {
    const o = ENTORNO.panvel, g = place(o), k = new Kit();
    k.add(new THREE.BoxGeometry(o.w, 6.6, o.d), lambert(0xf4f4f2), 0, 3.3, 0);
    k.add(new THREE.BoxGeometry(o.w + 0.6, 1.7, o.d + 0.6), lambert(0x1e2f7a), 0, 4.6, 0);         // faixa azul
    for (const [px, pz, w, ry] of [[o.w / 2 + 0.05, 0, o.d, PI / 2], [0, -o.d / 2 - 0.05, o.w, PI]]) {
      const pv = sign(256, 64, '#1e2f7a', (c, W, Hh) => { c.fillStyle = '#fff'; c.font = 'bold italic 40px sans-serif'; c.textAlign = 'center'; c.fillText('PanVel', W / 2, 40); c.font = '12px sans-serif'; c.fillText('FARMÁCIAS', W / 2, 56); });
      k.add(new THREE.PlaneGeometry(Math.min(8, w * 0.6), 1.6), new THREE.MeshLambertMaterial({ map: pv }), px * 1.03, 4.6, pz * 1.03, ry);
      k.add(new THREE.PlaneGeometry(w * 0.3, 3), lambert(0xf2a33a), px * 1.02 + (ry === PI ? -o.w * 0.25 : 0), 1.6, pz * 1.02 + (ry === PI ? 0 : o.d * 0.2), ry);
    }
    k.build(g);
  }
  /* ---------- sobrado da esquina: Levi, Casa de Carnes, Escola de Música ---------- */
  {
    const o = ENTORNO.levi, g = place(o), k = new Kit(), F = o.w / 2 + 0.05;
    k.add(new THREE.BoxGeometry(o.w, 9.6, o.d), lambert(0xe9e7e1), 0, 4.8, 0);
    k.add(new THREE.BoxGeometry(o.w + 0.2, 3.3, o.d + 0.2), lambert(0xb98a63), 0, 1.65, 0);       // térreo revestido
    k.add(new THREE.BoxGeometry(o.w + 1.6, 0.25, o.d + 1.6), lambert(0x2f7a4a), 0, 3.4, 0);       // marquise verde
    const tw = new THREE.MeshLambertMaterial({ map: windowsTex('#e9e7e1', '#3a4650', 4) }); tw.map.repeat.set(1, 2);
    k.add(new THREE.PlaneGeometry(o.d - 1, 5.6), tw, F, 6.6, 0, PI / 2);
    k.add(new THREE.PlaneGeometry(o.w - 1, 5.6), tw, 0, 6.6, -o.d / 2 - 0.05, PI);
    const levi = sign(256, 96, '#4a2c22', (c, W, Hh) => { c.fillStyle = '#efe6d8'; c.font = 'italic 64px serif'; c.textAlign = 'center'; c.fillText('Levi', W / 2, 70); });
    k.add(new THREE.PlaneGeometry(5, 1.9), new THREE.MeshLambertMaterial({ map: levi }), F + 0.03, 1.2, 2.5, PI / 2);
    k.add(new THREE.BoxGeometry(1.6, 0.08, 6), lambert(0x6b5446), F + 0.8, 3.0, 2.5, 0, 0, -0.3);  // toldo marrom
    const carnes = sign(256, 64, '#1d1d1d', (c, W, Hh) => { c.fillStyle = '#e8c23a'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText('CASA DE CARNES', W / 2, 40); });
    k.add(new THREE.PlaneGeometry(4.5, 1.1), new THREE.MeshLambertMaterial({ map: carnes }), F + 0.03, 2.7, -4.5, PI / 2);
    const esc = sign(512, 48, '#e9e7e1', (c, W, Hh) => { c.fillStyle = '#555'; c.font = '28px serif'; c.textAlign = 'center'; c.fillText('ESCOLA DE MÚSICA', W / 2, 34); });
    k.add(new THREE.PlaneGeometry(8, 0.75), new THREE.MeshLambertMaterial({ map: esc }), F + 0.02, 9.1, 0, PI / 2);
    k.build(g);
  }
  /* ---------- torre do Mercadão dos Óculos ---------- */
  {
    const o = ENTORNO.oculos, g = place(o), k = new Kit(), floors = 9, fh = 2.9, F = o.w / 2 + 0.05;
    k.add(new THREE.BoxGeometry(o.w, 4, o.d), lambert(0xc8272d), 0, 2, 0);                               // térreo vermelho
    k.add(new THREE.BoxGeometry(o.w + 1.4, 0.6, o.d + 1.4), lambert(0x8d8f93), 0, 4.3, 0);              // laje/marquise
    k.add(new THREE.BoxGeometry(o.w, floors * fh, o.d), lambert(0xc9cacc), 0, 4.6 + floors * fh / 2, 0);
    const tw = new THREE.MeshLambertMaterial({ map: windowsTex('#c9cacc', '#4c565e', 3) }); tw.map.repeat.set(1.5, floors);
    k.add(new THREE.PlaneGeometry(o.d - 1, floors * fh), tw, F, 4.6 + floors * fh / 2, 0, PI / 2);
    k.add(new THREE.PlaneGeometry(o.w - 1, floors * fh), tw, 0, 4.6 + floors * fh / 2, -o.d / 2 - 0.05, PI);
    for (let i = 1; i <= floors; i++) k.add(new THREE.BoxGeometry(1.2, 0.9, o.d * 0.55), lambert(0x77797d), F + 0.6, 4.6 + i * fh - 2.2, -o.d * 0.15);   // sacadas
    const mo = sign(256, 96, '#c8272d', (c, W, Hh) => { c.fillStyle = '#ffe9a8'; c.font = 'italic bold 30px serif'; c.textAlign = 'center'; c.fillText('Mercadão', W / 2, 40); c.fillText('dos Óculos', W / 2, 78); });
    const mm = new THREE.MeshLambertMaterial({ map: mo });
    k.add(new THREE.PlaneGeometry(4.5, 1.7), mm, F + 0.03, 2.7, -o.d / 2 + 3, PI / 2);
    k.add(new THREE.PlaneGeometry(4.5, 1.7), mm, o.w / 2 - 3, 2.7, -o.d / 2 - 0.03, PI);
    k.add(new THREE.PlaneGeometry(o.d - 6, 2.4), lambert(0xf4e8c8), F + 0.03, 1.4, 2, PI / 2);          // vitrine
    k.build(g);
  }
  /* ---------- sobrados com o Jair Cabeleireiro ---------- */
  {
    const o = ENTORNO.jair, g = place(o), k = new Kit(), F = o.w / 2 + 0.05;
    k.add(new THREE.BoxGeometry(o.w, 6.4, o.d), lambert(0xeee2c6), 0, 3.2, 0);
    k.add(new THREE.BoxGeometry(o.w, 0.2, o.d + 0.2), lambert(0x6b4a33), 0, 6.5, 0);
    const tw = new THREE.MeshLambertMaterial({ map: windowsTex('#eee2c6', '#5a3c2a', 3) }); tw.map.repeat.set(1, 1);
    k.add(new THREE.PlaneGeometry(o.d - 1, 2.8), tw, F, 4.6, 0, PI / 2);
    k.add(new THREE.BoxGeometry(1.2, 0.1, o.d - 1), lambert(0x8a7a64), F + 0.6, 3.3, 0);                // sacada com grade
    for (let i = 0; i < 14; i++) k.add(new THREE.BoxGeometry(0.04, 0.9, 0.04), lambert(0x3a3a3a), F + 1.15, 3.8, -o.d / 2 + 0.8 + i * (o.d - 1.6) / 13);
    const jt = sign(128, 128, '#ffffff', (c, W, Hh) => { c.fillStyle = '#d4202a'; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.fillText('JAIR', 64, 78); });
    k.add(new THREE.CircleGeometry(0.8, 18), new THREE.MeshLambertMaterial({ map: jt }), F + 0.06, 2.4, -o.d / 2 + 2.2, PI / 2);
    k.add(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8), new THREE.MeshLambertMaterial({ map: tex(16, 64, (c) => { for (let y = -16; y < 80; y += 12) { c.fillStyle = '#d4202a'; c.fillRect(0, y, 16, 4); c.fillStyle = '#1d4fa3'; c.fillRect(0, y + 6, 16, 4); } }) }), F + 0.3, 2.0, -o.d / 2 + 0.9);
    k.add(new THREE.BoxGeometry(o.d, 2.8, 0.1), lambert(0x2f4f8a), F - 0.02 - 0.06, 1.4, 0, PI / 2);   // portas azuis
    k.build(g);
  }
  /* ---------- Hashtag Presentes: fachada e toldo roxos ---------- */
  {
    const o = ENTORNO.hashtag, g = place(o), k = new Kit(), F = o.w / 2 + 0.05;
    k.add(new THREE.BoxGeometry(o.w, 6.2, o.d), lambert(0xe6e2dc), 0, 3.1, 0);
    const ht = sign(512, 128, '#6b3fa0', (c, W, Hh) => { for (let x = 0; x < W; x += 12) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x, 0, 4, Hh); } c.fillStyle = '#fff'; c.font = 'italic 64px serif'; c.textAlign = 'center'; c.fillText('Hashtag', W / 2 - 40, 78); c.font = '20px sans-serif'; c.fillText('PRESENTES  ·  BRINQUEDOS  ·  BOLSAS-BAZAR', W / 2, 116); });
    k.add(new THREE.PlaneGeometry(o.d, 2.6), new THREE.MeshLambertMaterial({ map: ht }), F + 0.03, 4.9, 0, PI / 2);
    k.add(new THREE.BoxGeometry(1.6, 0.1, o.d), lambert(0x7b4bb4), F + 0.8, 3.3, 0, 0, 0, 0.35);       // toldo roxo
    k.add(new THREE.PlaneGeometry(o.d - 1, 2.8), lambert(0xf0ece2), F + 0.03, 1.5, 0, PI / 2);         // vitrine
    k.build(g);
  }
  /* ---------- Agafarma: sobrado branco, telhado de 4 águas, faixa amarela ---------- */
  {
    const o = ENTORNO.agafarma, g = place(o), k = new Kit(), F = o.w / 2 + 0.05;
    k.add(new THREE.BoxGeometry(o.w, 6.6, o.d), lambert(0xf2f2ee), 0, 3.3, 0);
    { const r = new THREE.ConeGeometry(1, 1, 4, 1).rotateY(PI / 4); r.scale(o.w * 0.78, 2.6, o.d * 0.78); k.add(r, lambert(0x7a4a34), 0, 6.6 + 1.3, 0); }
    const ag = sign(256, 64, '#f2b705', (c, W, Hh) => { c.fillStyle = '#1d4fa3'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.fillText('Agafarma', W / 2, 46); });
    const am = new THREE.MeshLambertMaterial({ map: ag });
    k.add(new THREE.PlaneGeometry(o.d - 1, 1.2), am, F + 0.04, 3.3, 0, PI / 2);
    k.add(new THREE.PlaneGeometry(o.w - 4, 1.2), am, 1.5, 3.3, -o.d / 2 - 0.04, PI);
    for (const [px, pz, ry] of [[F + 0.03, 0, PI / 2], [0, -o.d / 2 - 0.03, PI]]) for (let i = -1; i <= 1; i++) k.add(new THREE.PlaneGeometry(1.1, 1.4), lambert(0x8a2a22), px + (ry === PI ? i * 4 : 0), 5, pz + (ry === PI ? 0 : i * 3.5), ry);   // janelas vermelhas
    k.add(new THREE.PlaneGeometry(o.d - 3, 2.4), lambert(0x46525a), F + 0.03, 1.3, 0, PI / 2);
    k.build(g);
  }
  /* ---------- rótula da Castelo Branco × João Corrêa: canteiro redondo com meio-fio amarelo e flores ---------- */
  {
    const rx = -55, rz = 47, y = H(rx, rz), k = new Kit();
    k.add(new THREE.CylinderGeometry(2.4, 2.4, 0.25, 20), lambert(0xe8b923), rx, y + 0.12, rz);
    k.add(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 20), lambert(0x5f8f3e), rx, y + 0.15, rz);
    for (let i = 0; i < 14; i++) { const a = i / 14 * PI * 2; k.add(new THREE.IcosahedronGeometry(0.35, 0), lambert(i % 2 ? 0xd8283a : 0x3f7330), rx + Math.cos(a) * 1.5, y + 0.5, rz + Math.sin(a) * 1.5); }
    const gr = new THREE.Group(); root.add(gr); k.build(gr);
    colliders.push({ circle: [rx, rz, 2.4] });
  }
  /* ---------- residencial 592: 10 andares, sacadas, térreo com lojas e grade verde ---------- */
  {
    const o = ENTORNO.r592, g = place(o), k = new Kit(), floors = 10, fh = 2.9, F = o.w / 2 + 0.05;
    k.add(new THREE.BoxGeometry(o.w, floors * fh + 3.5, o.d), lambert(0xf0efea), 0, (floors * fh + 3.5) / 2, 0);
    const tw = new THREE.MeshLambertMaterial({ map: windowsTex('#f0efea', '#5d6a72', 4) }); tw.map.repeat.set(1.5, floors);
    k.add(new THREE.PlaneGeometry(o.d - 1, floors * fh), tw, F, 3.5 + floors * fh / 2, 0, PI / 2);
    for (let i = 0; i < floors; i++) k.add(new THREE.BoxGeometry(1.1, 0.15, o.d * 0.45), lambert(0x6f7479), F + 0.55, 3.6 + i * fh, -o.d * 0.2);   // sacadas cinza
    k.add(new THREE.BoxGeometry(0.15, 3.3, o.d), lambert(0x2f6e5e), F + 0.1, 1.65, 0);            // grade verde do térreo
    const sm = sign(256, 64, '#4a3428', (c, W, Hh) => { c.fillStyle = '#f2e7d6'; c.font = 'italic 34px serif'; c.textAlign = 'center'; c.fillText('Sonia Moden Haus', W / 2, 44); });
    k.add(new THREE.PlaneGeometry(5, 1.3), new THREE.MeshLambertMaterial({ map: sm }), F + 0.2, 3.0, 4, PI / 2);
    k.build(g);
  }
  /* ---------- fachada da Piccadilly na Dorneles (cobre o galpão do GEO: faixas de janelas, base de tijolo, logo) ---------- */
  {
    const g = new THREE.Group(); root.add(g); const k = new Kit(), X = 42.12;
    const band = new THREE.MeshLambertMaterial({ map: tex(256, 128, (c, W, Hh) => {
      c.fillStyle = '#e6e1d4'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#d2bf7a'; c.fillRect(0, 22, W, 34); c.fillRect(0, 82, W, 34);
      c.fillStyle = '#5c6670'; c.fillRect(70, 24, 60, 30); c.fillRect(190, 84, 50, 30);
      for (let x = 70; x < 130; x += 5) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x, 24, 2, 30); }
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, 58, W, 4);
    }, true) });
    band.map.repeat.set(5, 1);
    const L = 52, zc = -81, y = H(X, zc);
    k.add(new THREE.PlaneGeometry(L, 7.5), band, X, y + 1.2 + 3.75, zc, PI / 2);
    k.add(new THREE.PlaneGeometry(L, 1.2), new THREE.MeshLambertMaterial({ map: tex(64, 16, (c, W, Hh) => { c.fillStyle = '#c9b48c'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#b39a70'; for (let i = 0; i < 8; i++) c.fillRect(i * 8 + (i % 2) * 4, 0, 1, Hh); }, true) }), X, y + 0.6, zc, PI / 2);
    const logo = tex(512, 96, (c, W, Hh) => { c.fillStyle = '#e6e1d4'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#6d6a66'; c.font = 'bold 54px serif'; c.textAlign = 'center'; c.fillText('PICCADILLY', W / 2, 56); c.font = '22px serif'; c.fillText('C O M P A N Y', W / 2, 86); });
    k.add(new THREE.PlaneGeometry(7, 1.4), new THREE.MeshLambertMaterial({ map: logo }), X + 0.04, y + 6.2, -96, PI / 2);
    k.add(new THREE.BoxGeometry(2.5, 0.25, 4.5), lambert(0x3a3d42), X + 1.2, y + 3.2, -96);      // marquise da entrada 577
    k.add(new THREE.PlaneGeometry(2.2, 2.8), lambert(0x2c3238), X + 0.05, y + 1.4, -96, PI / 2);
    // bloco de 4 andares mais ao norte (foto "Piccadilly Company 577")
    k.add(new THREE.BoxGeometry(12, 14, 26), lambert(0xe4dfd2), X - 6, H(X - 6, -117) + 7, -117);
    const b4 = band.clone(); b4.map = band.map.clone(); b4.map.repeat.set(2.5, 2); b4.map.needsUpdate = true;
    k.add(new THREE.PlaneGeometry(26, 13), b4, X + 0.02, H(X, -117) + 7, -117, PI / 2);
    k.build(g);
    colliders.push({ p: [[X - 12, -130], [X, -130], [X, -104], [X - 12, -104]] });
  }
  /* ---------- Farmácias São João: sobrado cinza-claro, sacada de ferro, floreiras ---------- */
  {
    const o = ENTORNO.saojoao, g = place(o), k = new Kit();
    k.add(new THREE.BoxGeometry(o.w, 7.4, o.d), lambert(0xd9dadb), 0, 3.7, 0);
    k.add(new THREE.BoxGeometry(o.w + 0.3, 0.5, o.d + 0.3), lambert(0xeeeeee), 0, 7.6, 0);
    { const r = new THREE.ConeGeometry(1, 1, 4, 1).rotateY(PI / 4); r.scale(o.w * 0.75, 4, o.d * 0.75); k.add(r, lambert(0x6c7075), 0, 9.85, 0); }   // telhado de 4 águas
    for (let i = 0; i < 10; i++) k.add(new THREE.BoxGeometry(0.6, 0.7, 1.2), lambert(0xdcdcdc), o.w / 2 - 0.3, 8.2, -o.d / 2 + 1.5 + i * (o.d - 3) / 9);   // platibanda com ameias
    k.add(new THREE.BoxGeometry(o.w + 0.2, 0.25, o.d + 0.2), lambert(0xffffff), 0, 3.6, 0);           // friso entre andares
    const sj = sign(256, 64, '#ffffff', (c, W, Hh) => { c.fillStyle = '#1f4fa0'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText('Farmácias', W / 2, 30); c.fillStyle = '#2c8f3e'; c.fillText('São João', W / 2, 60); });
    const sm = new THREE.MeshLambertMaterial({ map: sj });
    for (const [px, pz, w, ry] of [[o.w / 2 + 0.06, 0, o.d, PI / 2], [0, -o.d / 2 - 0.06, o.w, PI]]) {
      k.add(new THREE.PlaneGeometry(4, 1), sm, px, 4.3, pz, ry);
      for (let i = 0; i < 4; i++) {   // janelas brancas com floreiras vermelhas
        const t = (i + 0.5) / 4 - 0.5, ox = ry === PI ? t * w : 0, oz = ry === PI ? 0 : t * w;
        k.add(new THREE.PlaneGeometry(1.1, 1.6), lambert(0xf8f8f8), px + ox * 1, 5.8, pz + oz, ry);
        k.add(new THREE.BoxGeometry(1.2, 0.25, 0.3), lambert(0xc8282d), px + ox + (ry === PI ? 0 : 0.15), 4.95, pz + oz + (ry === PI ? -0.15 : 0));
        k.add(new THREE.PlaneGeometry(1.2, 2.6), lambert(0xf4f4f4), px + ox, 1.3, pz + oz, ry);
      }
    }
    k.add(new THREE.BoxGeometry(0.9, 0.08, 3), lambert(0x222222), o.w / 2 + 0.45, 4.9, -o.d / 4);        // sacada
    for (let i = 0; i <= 6; i++) k.add(new THREE.BoxGeometry(0.03, 1, 0.03), lambert(0x222222), o.w / 2 + 0.85, 5.4, -o.d / 4 - 1.5 + i * 0.5);
    k.build(g);
  }
}

/**
 * Bueiros do Arroio Koetz e outros arroios sob as ruas (fotos: R. Gen. Ernesto Dorneles 496): muro de concreto com a
 * boca do canal escura e guarda-corpo de ferro na beira da calçada, dos dois lados da rua.
 */
export function buildCulverts(city, terrain, root, colliders, near = 900) {
  const H = (x, z) => terrain.heightAt(x, z), k = new Kit();
  const conc = lambert(0xa9a59c), dark = lambert(0x1c2024), rail = lambert(0x6e7378);
  for (const c of city.culverts || []) {
    if (Math.hypot(c.x, c.z) > near) continue;
    const n = [-c.rd[1], c.rd[0]], cosA = Math.max(0.35, Math.abs(c.sd[0] * n[0] + c.sd[1] * n[1]));
    const yRoad = H(c.x, c.z) + 0.15, wallLen = (c.half * 2 + 2.4) / cosA, ry = Math.atan2(-c.rd[1], c.rd[0]);
    for (const side of [-1, 1]) {
      const t = (c.r + 0.15) / cosA * side, x = c.x + c.sd[0] * t, z = c.z + c.sd[1] * t;
      k.add(new THREE.BoxGeometry(wallLen, 2.0, 0.3), conc, x, yRoad - 0.95, z, ry);                                   // muro de testa
      k.add(new THREE.BoxGeometry(c.half * 2 / cosA, 1.0, 0.32), dark, x, yRoad - 1.35, z, ry);                       // boca do canal
      for (const h of [0.55, 1.05]) k.add(new THREE.BoxGeometry(wallLen, 0.06, 0.06), rail, x, yRoad + h, z, ry);
      for (let i = 0; i <= 4; i++) { const u = (i / 4 - 0.5) * wallLen; k.add(new THREE.BoxGeometry(0.05, 1.1, 0.05), rail, x + c.rd[0] * u, yRoad + 0.55, z + c.rd[1] * u); }
      const e = [c.rd[0] * wallLen / 2, c.rd[1] * wallLen / 2], o = [n[0] * 0.25, n[1] * 0.25];
      colliders.push({ p: [[x - e[0] - o[0], z - e[1] - o[1]], [x + e[0] - o[0], z + e[1] - o[1]], [x + e[0] + o[0], z + e[1] + o[1]], [x - e[0] + o[0], z - e[1] + o[1]]] });
    }
  }
  const g = new THREE.Group(); root.add(g); k.build(g);
  return (city.culverts || []).length;
}

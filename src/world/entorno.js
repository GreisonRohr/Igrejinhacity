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
  panvel: { x: 63, z: -59, rot: Math.PI, w: 14, d: 11 },
  saojoao: { x: 52, z: 63, rot: Math.PI / 2, w: 16, d: 11 },
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
  /* ---------- Farmácias São João: sobrado cinza-claro, sacada de ferro, floreiras ---------- */
  {
    const o = ENTORNO.saojoao, g = place(o), k = new Kit();
    k.add(new THREE.BoxGeometry(o.w, 7.4, o.d), lambert(0xd9dadb), 0, 3.7, 0);
    k.add(new THREE.BoxGeometry(o.w + 0.3, 0.5, o.d + 0.3), lambert(0xeeeeee), 0, 7.6, 0);
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

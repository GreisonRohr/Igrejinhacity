// Personagem humano estilizado (low-poly arredondado), com articulações e animação de andar/correr.
// Original do projeto: geometria procedural, sem modelos externos.
import * as THREE from 'three';

const PI = Math.PI;
const G = {};                       // geometrias compartilhadas entre todos os personagens
function geo() {
  if (G.ready) return G;
  const cap = (r, l, s = 6) => new THREE.CapsuleGeometry(r, l, 3, s);
  Object.assign(G, {
    torso: cap(0.165, 0.3, 10), hips: cap(0.15, 0.08, 10), neck: new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8),
    head: new THREE.SphereGeometry(0.115, 16, 12), hairShort: new THREE.SphereGeometry(0.122, 16, 10, 0, PI * 2, 0, PI * 0.52),
    hairLong: cap(0.11, 0.16, 10), ear: new THREE.SphereGeometry(0.025, 6, 4), eye: new THREE.SphereGeometry(0.016, 6, 4),
    nose: new THREE.ConeGeometry(0.018, 0.045, 5), brow: new THREE.BoxGeometry(0.045, 0.01, 0.012), mustache: new THREE.BoxGeometry(0.07, 0.016, 0.02),
    upperArm: cap(0.052, 0.2), sleeve: cap(0.062, 0.1), foreArm: cap(0.044, 0.19), hand: new THREE.SphereGeometry(0.048, 8, 6),
    thigh: cap(0.075, 0.3), shin: cap(0.062, 0.32), shoe: new THREE.BoxGeometry(0.11, 0.08, 0.26), sole: new THREE.BoxGeometry(0.115, 0.025, 0.27),
    belt: new THREE.CylinderGeometry(0.158, 0.158, 0.04, 14), apron: new THREE.BoxGeometry(0.3, 0.42, 0.02),
  });
  G.ready = true; return G;
}
const mats = new Map();
const mat = c => { if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c })); return mats.get(c); };

export const SKINS = [0xf1c6a0, 0xe2b48c, 0xc68e64, 0x9a6b47, 0x6f4a32];
export const HAIRS = [0x2b1d14, 0x4a2f1d, 0x7a5532, 0xb98a4b, 0x1a1a1a, 0x9a9a9a];

/**
 * opts: { shirt, pants, skin, hair, shoes, hairStyle: 'short'|'long'|'bald', mustache, apron, build (1 = normal) }
 * Devolve um THREE.Group com userData.animate(dt, speed, run).
 */
export function makePerson(opts = {}) {
  if (typeof opts === 'number') opts = { shirt: opts };
  const g = geo();
  const o = { shirt: 0x1d4e9e, pants: 0x2f4a6e, skin: 0xe2b48c, hair: 0x3a2618, shoes: 0xf2f2f2, hairStyle: 'short', build: 1, ...opts };
  const M = { shirt: mat(o.shirt), pants: mat(o.pants), skin: mat(o.skin), hair: mat(o.hair), shoes: mat(o.shoes), sole: mat(0x333333), dark: mat(0x1b1b1b), belt: mat(0x3b2a1e) };
  const add = (parent, gg, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const mesh = new THREE.Mesh(gg, m); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; parent.add(mesh); return mesh; };
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);          // balança/inclina
  const hips = new THREE.Group(); hips.position.y = 0.93; body.add(hips);
  const b = o.build;
  add(hips, g.hips, M.pants, 0, 0.02, 0, 1.05 * b, 1, 0.8);
  add(hips, g.belt, M.belt, 0, 0.1, 0, 1 * b, 1, 0.78);
  // tronco
  const chest = new THREE.Group(); chest.position.y = 0.12; hips.add(chest);
  add(chest, g.torso, M.shirt, 0, 0.24, 0, 1.12 * b, 1, 0.74 * (0.9 + b * 0.1));
  if (o.apron) add(chest, g.apron, mat(o.apron), 0, 0.12, 0.125 * b);
  add(chest, g.neck, M.skin, 0, 0.5, 0);
  // cabeça
  const head = new THREE.Group(); head.position.y = 0.62; chest.add(head);
  add(head, g.head, M.skin, 0, 0, 0, 0.92, 1.08, 0.98);
  if (o.hairStyle !== 'bald') add(head, g.hairShort, M.hair, 0, 0.012, -0.008, 0.96, 1.1, 1.03);
  if (o.hairStyle === 'long') add(head, g.hairLong, M.hair, 0, -0.07, -0.06, 1, 1, 0.55);
  for (const s of [-1, 1]) {
    add(head, g.ear, M.skin, s * 0.106, 0, 0, 0.6, 1, 1);
    add(head, g.eye, M.dark, s * 0.04, 0.02, 0.1);
    add(head, g.brow, M.hair, s * 0.04, 0.048, 0.103);
  }
  const nose = add(head, g.nose, M.skin, 0, -0.01, 0.115); nose.rotation.x = PI / 2;
  if (o.mustache) add(head, g.mustache, mat(o.hair), 0, -0.045, 0.1);
  // braços
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.215 * b, 0.43, 0); chest.add(sh);
    add(sh, g.upperArm, M.skin, 0, -0.13, 0);
    add(sh, g.sleeve, M.shirt, 0, -0.06, 0, 1, 1, 1);
    const el = new THREE.Group(); el.position.y = -0.27; sh.add(el);
    add(el, g.foreArm, M.skin, 0, -0.12, 0);
    add(el, g.hand, M.skin, 0, -0.27, 0.01, 0.8, 1, 0.9);
    sh.rotation.z = s * 0.08;
    arms.push({ sh, el, s });
  }
  // pernas
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.09, 0, 0); hips.add(hip);
    add(hip, g.thigh, M.pants, 0, -0.22, 0);
    const knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee);
    add(knee, g.shin, M.pants, 0, -0.2, 0);
    const foot = new THREE.Group(); foot.position.y = -0.45; knee.add(foot);
    add(foot, g.shoe, M.shoes, 0, -0.005, 0.05); add(foot, g.sole, M.sole, 0, -0.05, 0.05);
    legs.push({ hip, knee, foot, s });
  }
  let ph = 0, t = 0;
  root.userData = {
    head, chest, hips, legs, arms,
    /** speed em m/s; run = correndo */
    animate(dt, speed = 0, run = false) {
      t += dt;
      const moving = speed > 0.15;
      ph += dt * (moving ? speed * (run ? 1.5 : 2.1) : 0);
      const amp = moving ? Math.min(1, speed / (run ? 8 : 4)) * (run ? 0.85 : 0.5) : 0;
      for (const L of legs) {
        const p = Math.sin(ph + (L.s > 0 ? PI : 0));
        L.hip.rotation.x = p * amp;
        L.knee.rotation.x = Math.max(0, -Math.cos(ph + (L.s > 0 ? PI : 0))) * amp * (run ? 1.8 : 1.3);
        L.foot.rotation.x = -L.hip.rotation.x * 0.3;
      }
      for (const A of arms) {
        const p = Math.sin(ph + (A.s > 0 ? 0 : PI));
        A.sh.rotation.x = p * amp * (run ? 1.1 : 0.8);
        A.el.rotation.x = -(run ? 1.3 : 0.25) - Math.max(0, p) * amp * 0.5;
      }
      // sobe e desce, inclinação ao correr, respiração parado
      body.position.y = moving ? Math.abs(Math.cos(ph)) * 0.04 * amp * 2 : 0;
      body.rotation.x = run && moving ? 0.18 : 0;
      chest.rotation.y = moving ? Math.sin(ph) * 0.12 * amp : 0;
      chest.scale.y = moving ? 1 : 1 + Math.sin(t * 2) * 0.008;
      head.rotation.y = moving ? -chest.rotation.y * 0.6 : Math.sin(t * 0.5) * 0.15;
    },
  };
  return root;
}

// Personagem humano estilizado (cartoon arredondado), com articulações e animação de andar/correr.
// Original do projeto: geometria procedural (torno/cápsulas), sem modelos externos.
import * as THREE from 'three';

const PI = Math.PI;
const runK0 = v => Math.min(1, Math.max(0, (v - 4) / 3));
const V = (x, y) => new THREE.Vector2(x, y);
const lathe = (pts, seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => V(r, y)), seg);

const G = {};                       // geometrias compartilhadas entre todos os personagens
function geo() {
  if (G.ready) return G;
  const cap = (r, l, s = 10) => new THREE.CapsuleGeometry(r, l, 4, s);
  Object.assign(G, {
    // tronco: perfil do quadril ao pescoço (achatado em z depois)
    torso: lathe([[0.001, 0], [0.15, 0.0], [0.158, 0.06], [0.145, 0.16], [0.152, 0.27], [0.18, 0.38], [0.19, 0.44], [0.16, 0.5], [0.07, 0.535], [0.001, 0.54]], 20),
    collar: new THREE.TorusGeometry(0.062, 0.016, 6, 16),
    hem: new THREE.TorusGeometry(0.156, 0.012, 6, 20),
    hips: lathe([[0.001, -0.1], [0.12, -0.09], [0.16, -0.02], [0.158, 0.06], [0.001, 0.07]], 20),
    neck: new THREE.CylinderGeometry(0.048, 0.055, 0.12, 10),
    head: lathe([[0.001, -0.13], [0.06, -0.125], [0.095, -0.09], [0.112, -0.03], [0.118, 0.03], [0.112, 0.09], [0.085, 0.135], [0.04, 0.155], [0.001, 0.158]], 20),
    hairCap: new THREE.SphereGeometry(0.124, 20, 12, 0, PI * 2, 0, PI * 0.5),
    nape: new THREE.SphereGeometry(0.123, 16, 8, PI, PI, PI * 0.45, PI * 0.33),   // meia faixa de trás, do meio para baixo
        fringe: new THREE.SphereGeometry(0.05, 8, 6),
    ponytail: cap(0.045, 0.12, 8), hairLong: cap(0.1, 0.2, 12),
    ear: new THREE.SphereGeometry(0.026, 8, 6), eyeW: new THREE.SphereGeometry(0.016, 12, 8), iris: new THREE.SphereGeometry(0.0095, 10, 8), lid: new THREE.SphereGeometry(0.018, 10, 6, 0, PI * 2, 0, PI * 0.42),
    nose: new THREE.SphereGeometry(0.022, 8, 6), mouth: new THREE.TorusGeometry(0.022, 0.005, 4, 10, PI),
    brow: new THREE.CapsuleGeometry(0.006, 0.03, 2, 4), mustache: new THREE.CapsuleGeometry(0.014, 0.06, 3, 6),
    upperArm: cap(0.05, 0.19), sleeve: lathe([[0.066, 0], [0.068, -0.12], [0.062, -0.14], [0.001, -0.14]], 12),
    shoulder: new THREE.SphereGeometry(0.068, 12, 8),
    foreArm: lathe([[0.042, 0.02], [0.046, -0.04], [0.036, -0.2], [0.03, -0.24], [0.001, -0.245]], 10),
    palm: new THREE.BoxGeometry(0.07, 0.085, 0.032, 2, 2, 1), fingers: cap(0.016, 0.045, 6), thumb: cap(0.014, 0.03, 6),
    thigh: lathe([[0.001, 0.02], [0.08, 0.0], [0.082, -0.08], [0.068, -0.36], [0.06, -0.44], [0.001, -0.45]], 14),
    knee: new THREE.SphereGeometry(0.05, 10, 8),
    shin: lathe([[0.058, 0.0], [0.062, -0.08], [0.05, -0.3], [0.046, -0.4], [0.001, -0.41]], 14),
    cuff: new THREE.CylinderGeometry(0.058, 0.06, 0.04, 12),
    shoe: (() => { const g = new THREE.CapsuleGeometry(0.055, 0.15, 4, 10); g.rotateX(PI / 2); g.scale(1, 0.75, 1); return g; })(),
    sole: new THREE.BoxGeometry(0.11, 0.03, 0.27),
    belt: new THREE.CylinderGeometry(0.162, 0.162, 0.04, 20), buckle: new THREE.BoxGeometry(0.04, 0.03, 0.01),
    // jaqueta bomber aberta na frente (vão de ~0,5 rad em +z)
    jacket: new THREE.LatheGeometry([[0.172, -0.07], [0.176, -0.02], [0.168, 0.06], [0.163, 0.16], [0.17, 0.27], [0.196, 0.38], [0.205, 0.44], [0.172, 0.5], [0.09, 0.535]].map(([r, y]) => V(r, y)), 20, 0.24, PI * 2 - 0.48),
    jacketHem: new THREE.TorusGeometry(0.17, 0.013, 6, 20, PI * 2 - 0.5),
    jacketCollar: new THREE.TorusGeometry(0.085, 0.024, 6, 16, PI * 2 - 0.9),
    zip: new THREE.BoxGeometry(0.005, 0.56, 0.005),
    jSleeveUp: lathe([[0.07, 0.02], [0.072, -0.1], [0.064, -0.28], [0.001, -0.29]], 12),
    jSleeveLow: lathe([[0.062, 0.02], [0.062, -0.1], [0.054, -0.2], [0.001, -0.21]], 12),
    jCuff: new THREE.CylinderGeometry(0.046, 0.05, 0.05, 12),
    pocket: new THREE.BoxGeometry(0.04, 0.14, 0.12), flap: new THREE.BoxGeometry(0.045, 0.02, 0.125),
    watchBand: new THREE.CylinderGeometry(0.041, 0.041, 0.022, 14), watchFace: new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16),
    // barba: faixa de esfera cobrindo mandíbula, queixo e bochechas (frente-baixo)
    beard: new THREE.LatheGeometry([[0.001, -0.139], [0.066, -0.134], [0.102, -0.096], [0.118, -0.045], [0.12, -0.026]].map(([r, y]) => V(r, y)), 22, -1.5, 3.0),
    hairSides: new THREE.SphereGeometry(0.123, 22, 6, PI / 2 + 0.95, PI * 2 - 1.9, PI * 0.26, PI * 0.3),
    teeth: new THREE.BoxGeometry(0.03, 0.009, 0.006),
    apron: new THREE.PlaneGeometry(0.3, 0.46), apronTop: new THREE.PlaneGeometry(0.18, 0.16),
  });
  G.ready = true; return G;
}
const mats = new Map();
const mat = (c, side = THREE.FrontSide, rough = 0.85) => {
  const k = c + ':' + side + ':' + rough;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: c, side, roughness: rough, metalness: 0 }));
  return mats.get(k);
};
const shade = (c, f) => new THREE.Color(c).multiplyScalar(f).getHex();

export const SKINS = [0xf1c6a0, 0xe2b48c, 0xc68e64, 0x9a6b47, 0x6f4a32];
export const HAIRS = [0x2b1d14, 0x4a2f1d, 0x7a5532, 0xb98a4b, 0x1a1a1a, 0x9a9a9a];

/**
 * opts: { shirt, pants, skin, hair, shoes, eyes, hairStyle: 'short'|'long'|'ponytail'|'bald',
 *         mustache, apron, build (1 = normal), height (1 = 1,75 m) }
 * Devolve um THREE.Group com userData.animate(dt, speed, run).
 */
export function makePerson(opts = {}) {
  if (typeof opts === 'number') opts = { shirt: opts };
  const g = geo();
  const o = { shirt: 0x1d4e9e, pants: 0x2f4a6e, skin: 0xe2b48c, hair: 0x3a2618, shoes: 0xf2f2f2, eyes: 0x4a3222, hairStyle: 'short', build: 1, height: 1, ...opts };
  const M = {
    shirt: mat(o.shirt, undefined, 0.95), shirtDark: mat(shade(o.shirt, 0.8), undefined, 0.95), pants: mat(o.pants, undefined, 0.9), skin: mat(o.skin, undefined, 0.55), lip: mat(shade(o.skin, 0.72), undefined, 0.5),
    hair: mat(o.hair), shoes: mat(o.shoes), sole: mat(o.sole ?? 0x3a3a3a), white: mat(0xf4f1ec, undefined, 0.25), iris: mat(o.eyes, undefined, 0.2), belt: mat(0x3b2a1e), buckle: mat(0xc9b37a),
  };
  const add = (parent, gg, m, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(gg, m); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; parent.add(mesh); return mesh;
  };
  const b = o.build;
  const root = new THREE.Group();
  const body = new THREE.Group(); body.scale.setScalar(o.height); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.94; body.add(hips);
  add(hips, g.hips, M.pants, 0, 0, 0, 1.0 * b, 1, 0.78 * b);
  add(hips, g.belt, M.belt, 0, 0.06, 0, b, 1, 0.8 * b);
  add(hips, g.buckle, M.buckle, 0, 0.06, 0.13 * b);

  // tronco (camiseta)
  const chest = new THREE.Group(); chest.position.y = 0.07; hips.add(chest);
  add(chest, g.torso, M.shirt, 0, 0, 0, 1.08 * b, 1, 0.7 * (0.85 + 0.15 * b));
  const hem = add(chest, g.hem, M.shirtDark, 0, 0.012, 0, 1.0 * b, 0.72 * b, 1); hem.rotation.x = PI / 2;
  const col = add(chest, g.collar, M.shirtDark, 0, 0.525, 0.004, 1, 0.8, 1); col.rotation.x = PI / 2;
  if (o.apron) {
    const am = mat(o.apron, THREE.DoubleSide);
    add(chest, g.apron, am, 0, 0.0, 0.126 * b + 0.004).rotation.x = -0.06;
    add(chest, g.apronTop, am, 0, 0.3, 0.13 * b);
  }
  const neck = add(chest, g.neck, M.skin, 0, 0.555, 0, 1.05, 1, 1.05);
  if (o.jacket) {
    const J = mat(o.jacket, THREE.DoubleSide), JR = mat(shade(o.jacket, 0.7)), Z = mat(0x55575a);
    add(chest, g.jacket, J, 0, 0, 0, 1.08 * b, 1, 0.74 * b);
    const jc = add(chest, g.jacketCollar, JR, 0, 0.53, -0.01, 1.05, 0.92, 1); jc.rotation.set(PI / 2, 0, PI / 2 + 0.45 - PI);
    for (const sx of [-1, 1]) add(chest, g.zip, Z, sx * 0.043 * b, 0.23, 0.128 * b);
  }

  // cabeça (levemente grande: estilo cartoon)
  const head = new THREE.Group(); head.position.y = 0.675; head.scale.setScalar(o.headScale ?? 0.9); chest.add(head);
  add(head, g.head, M.skin, 0, 0, 0, 0.98, 1.04, 1.02);
  for (const s of [-1, 1]) {
    add(head, g.ear, M.skin, s * 0.112, 0.0, -0.005, 0.55, 1, 0.9);
    add(head, g.eyeW, M.white, s * 0.04, 0.02, 0.1, 1.15, 0.85, 0.55);
    add(head, g.iris, M.iris, s * 0.04, 0.02, 0.1085, 1, 1, 0.6);
    add(head, g.lid, M.skin, s * 0.04, 0.02, 0.099, 1.2, 1.0, 0.65);   // pálpebra superior
    const br = add(head, g.brow, o.hairStyle === 'bald' ? M.lip : M.hair, s * 0.045, 0.06, 0.103); br.rotation.z = PI / 2 + s * 0.12;
  }
  add(head, g.nose, M.skin, 0, -0.012, 0.113, 0.8, 1, 0.9);
  const mouth = add(head, g.mouth, M.lip, 0, -0.052, 0.1); mouth.rotation.z = PI;
  const teeth = o.smile ? add(head, g.teeth, M.white, 0, -0.056, 0.104) : null;
  if (o.beard) {
    const B = mat(o.beard);
    add(head, g.beard, mat(o.beard, THREE.DoubleSide), 0, 0.0, 0.0, 0.99, 1.05, 1.03);
    const mu = add(head, g.mustache, B, 0, -0.035, 0.117, 0.6, 0.62, 0.45); mu.rotation.z = PI / 2;
    mouth.position.set(0, -0.052, 0.124); mouth.scale.set(0.8, 0.55, 0.8); mouth.material = mat(0x7a3b34); if (teeth) teeth.position.set(0, -0.057, 0.124);
  } else if (o.mustache) { const mu = add(head, g.mustache, mat(o.hair), 0, -0.036, 0.105); mu.rotation.z = PI / 2; }
  // cabelo: calota inclinada para trás (testa livre na frente, nuca coberta atrás) + franja
  if (o.hairStyle === 'fade') {
    // corte social: topo um pouco mais alto, laterais e nuca rentes (mesmo tom, um pouco mais claro = pele aparecendo)
    add(head, g.hairCap, M.hair, 0, 0.05, -0.006, 1.0, 1.1, 1.05);
    add(head, g.nape, mat(shade(o.hair, 1.12)), 0, 0.045, -0.004, 0.995, 1.12, 1.02);
    add(head, g.hairSides, mat(shade(o.hair, 1.12)), 0, 0.045, -0.004, 0.995, 1.12, 1.02);
    add(head, g.fringe, M.hair, 0.0, 0.135, 0.06, 1.7, 0.5, 0.9);
  } else if (o.hairStyle !== 'bald') {
    add(head, g.hairCap, M.hair, 0, 0.04, -0.004, 1.05, 1.0, 1.08);
    add(head, g.nape, M.hair, 0, 0.04, -0.004, 1.05, 1.15, 1.08);
    for (const [x, y, z, s] of [[-0.055, 0.1, 0.078, 1], [0.0, 0.112, 0.085, 1.15], [0.055, 0.1, 0.076, 0.95], [-0.09, 0.07, 0.04, 0.8], [0.09, 0.07, 0.04, 0.8]]) add(head, g.fringe, M.hair, x, y, z, s * 1.15, s * 0.62, s * 0.8);
  } else {
    const cap = add(head, g.hairCap, M.hair, 0, -0.02, -0.03, 1.03, 0.7, 1.0); cap.rotation.x = -1.3;
  }
  if (o.hairStyle === 'long') add(head, g.hairLong, M.hair, 0, -0.1, -0.06, 1.15, 1, 0.6);
  if (o.hairStyle === 'ponytail') { const pt = add(head, g.ponytail, M.hair, 0, -0.04, -0.15); pt.rotation.x = 0.5; }

  // braços
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.2 * b, 0.43, 0); chest.add(sh);
    const top = o.jacket ? mat(o.jacket) : M.shirt;
    add(sh, g.shoulder, top, 0, -0.01, 0, 1.05, 1, 1);
    if (o.jacket) add(sh, g.jSleeveUp, top); else { add(sh, g.upperArm, M.skin, 0, -0.14, 0); add(sh, g.sleeve, M.shirt, 0, 0.0, 0); }
    const el = new THREE.Group(); el.position.y = -0.28; sh.add(el);
    if (o.jacket) { add(el, g.jSleeveLow, top); add(el, g.jCuff, mat(shade(o.jacket, 0.7)), 0, -0.205, 0); add(el, g.foreArm, M.skin, 0, -0.03, 0, 0.9, 1, 0.9); }
    else add(el, g.foreArm, M.skin);
    if (o.watch && s < 0) { add(el, g.watchBand, mat(0x1c1c1c), 0, -0.235, 0); const wf = add(el, g.watchFace, mat(0x9aa3ad), 0, -0.235, 0.04); wf.rotation.x = PI / 2; }
    const hand = new THREE.Group(); hand.position.y = -0.25; el.add(hand);
    add(hand, g.palm, M.skin, 0, -0.035, 0, 1, 1, 1).rotation.y = s * 0.2;
    add(hand, g.fingers, M.skin, 0, -0.095, 0.006, 1.9, 1, 1.05);
    const th = add(hand, g.thumb, M.skin, -s * 0.038, -0.03, 0.022); th.rotation.z = s * 0.6;
    sh.rotation.z = s * 0.07;
    arms.push({ sh, el, hand, s });
  }
  // pernas
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.085 * b, -0.04, 0); hips.add(hip);
    add(hip, g.thigh, M.pants, 0, 0, 0, b, 1, b);
    if (o.cargo) { add(hip, g.pocket, mat(shade(o.pants, 0.85)), s * 0.072 * b, -0.25, 0.0); add(hip, g.flap, mat(shade(o.pants, 0.75)), s * 0.075 * b, -0.18, 0.0); }
    const knee = new THREE.Group(); knee.position.y = -0.44; hip.add(knee);
    add(knee, g.knee, M.pants, 0, 0.005, 0, 1, 1, 1);
    add(knee, g.shin, M.pants);
    add(knee, g.cuff, mat(shade(o.pants, 0.85)), 0, -0.4, 0);
    const foot = new THREE.Group(); foot.position.y = -0.43; knee.add(foot);
    add(foot, g.shoe, M.shoes, 0, -0.0, 0.05);
    add(foot, g.sole, M.sole, 0, -0.035, 0.05);
    legs.push({ hip, knee, foot, s });
  }

  let ph = 0, t = Math.random() * 10, amp = 0, blink = 2 + Math.random() * 3;
  const eyes = head.children.filter(m => m.geometry === g.eyeW || m.geometry === g.iris);
  for (const e of eyes) e.userData.sy = e.scale.y;
  root.userData = {
    head, chest, hips, legs, arms,
    /** speed em m/s; run = correndo */
    animate(dt, speed = 0, run = false, air = 0) {
      t += dt;
      // passada real: a fase avança conforme a distância percorrida (o pé não escorrega no chão)
      const cycle = speed > 7.5 ? 3.1 : run ? 2.5 : 1.5;          // metros por ciclo (2 passos)
      ph += dt * speed / cycle * PI * 2;
      const moving = speed > 0.15;
      const stepLen = cycle / 2 * Math.min(1, speed / (run ? 5 : 2.5));
      const target = moving ? Math.min(0.42 + runK0(speed) * 0.2, Math.asin(Math.min(0.95, stepLen / 1.75))) : 0;
      amp += (target - amp) * Math.min(1, dt * 7);
      const runK = Math.min(1, Math.max(0, (speed - 4) / 3));       // 0 = andando, 1 = correndo
      for (const L of legs) {
        const a = ph + (L.s > 0 ? PI : 0), sa = Math.sin(a), ca = Math.cos(a);
        const hip = -sa * amp;                                       // negativo = perna para frente
        const swing = Math.max(0, ca);                               // fase de balanço (perna indo à frente)
        const knee = 0.06 + amp * (0.2 * (1 - swing) * Math.max(0, -sa) + Math.pow(swing, 1.4) * (1.6 + runK * 1.2));
        L.hip.rotation.x = hip;
        L.knee.rotation.x = knee;
        // pé paralelo ao chão no apoio; calcanhar toca primeiro (ponta para cima) e ponta empurra no fim
        const toeUp = -0.25 * amp * Math.max(0, sa) * (1 - swing);
        const push = 0.6 * amp * Math.max(0, -sa) * Math.max(0, ca);
        L.foot.rotation.x = -(hip + knee) + toeUp + push;
      }
      for (const A of arms) {
        const a = ph + (A.s > 0 ? 0 : PI), sa = Math.sin(a);      // braço oposto à perna do mesmo lado
        A.sh.rotation.x = -sa * amp * (0.75 + runK * 0.4);
        A.sh.rotation.z = A.s * (0.06 + amp * 0.05 + runK * 0.06);
        A.el.rotation.x = -(0.15 + runK * 1.25) - Math.max(0, sa) * amp * (0.35 + runK * 0.2);
        A.hand.rotation.x = -0.15;
      }
      if (air > 0) {                                                // no ar: pernas encolhidas, braços para cima
        for (const L of legs) { L.hip.rotation.x += (-0.5 + (L.s > 0 ? 0.3 : -0.1) - L.hip.rotation.x) * air; L.knee.rotation.x += (0.9 - L.knee.rotation.x) * air; L.foot.rotation.x = -0.2; }
        for (const A of arms) { A.sh.rotation.x += (-0.6 - A.sh.rotation.x) * air; A.sh.rotation.z = A.s * 0.45 * air + A.sh.rotation.z * (1 - air); A.el.rotation.x = -0.5; }
      }
      // centro de massa: mais baixo no duplo apoio, mais alto no meio do passo
      const bob = (0.035 + runK * 0.04) * amp / 0.5;
      body.position.y = (Math.abs(Math.cos(ph)) - 0.65) * bob - runK * 0.04 * amp;
      body.rotation.x = runK * 0.1 + (speed > 7.5 ? 0.05 : 0);
      hips.rotation.y = Math.sin(ph) * 0.16 * amp;                    // quadril gira com a perna
      hips.rotation.z = Math.cos(ph * 2) * 0.035 * amp * (1 - runK);  // quadril cai do lado da perna no ar
      chest.rotation.y = -hips.rotation.y * 1.4;                      // ombros contra o quadril
      chest.rotation.z = -hips.rotation.z * 0.7;
      // parado: respira, troca o peso e olha em volta
      const idle = 1 - Math.min(1, amp / 0.15);
      chest.scale.set(1, 1 + Math.sin(t * 1.7) * 0.012 * idle, 1);
      body.position.x = Math.sin(t * 0.35) * 0.015 * idle;
      head.rotation.y = -chest.rotation.y * 0.8 + idle * Math.sin(t * 0.4) * 0.35;
      head.rotation.x = idle * Math.sin(t * 0.27) * 0.06 - runK * 0.06;
      // piscar
      blink -= dt; const closed = blink < 0.12;
      for (const e of eyes) e.scale.y = closed ? 0.12 : e.userData.sy;
      if (blink < 0) blink = 2.5 + Math.random() * 3;
    },
  };
  return root;
}

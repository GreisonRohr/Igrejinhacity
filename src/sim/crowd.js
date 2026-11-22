// Corpo das multidões: pessoas de partes rígidas instanciadas (uma InstancedMesh por parte para TODOS os pedestres).
// ~13 draw calls para a multidão inteira; cor por pessoa via instanceColor × cor de vértice (olhos, sola, cuia).
// Proporções iguais às do protagonista (src/player/person.js), com menos polígonos.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeContactShadow } from '../player/person.js';

const PI = Math.PI;
const V = (x, y) => new THREE.Vector2(x, y);
const lathe = (pts, seg = 9) => new THREE.LatheGeometry(pts.map(([r, y]) => V(r, y)), seg);
/** Pinta a geometria inteira com uma cor de vértice (1 = usa só a cor da pessoa). */
const tint = (g, c = 1) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); const col = c <= 1 ? new THREE.Color(c, c, c) : new THREE.Color(c); for (let i = 0; i < n; i++) { a[3 * i] = col.r; a[3 * i + 1] = col.g; a[3 * i + 2] = col.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const prep = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k); return g; };
const merge = (...parts) => mergeGeometries(parts.map(([g, c]) => tint(prep(g), c)));
const at = (g, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => g.scale(sx, sy, sz).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z);

function parts() {
  const head = merge(
    [at(lathe([[0.001, -0.13], [0.06, -0.125], [0.095, -0.09], [0.112, -0.03], [0.118, 0.03], [0.112, 0.09], [0.085, 0.135], [0.04, 0.155], [0.001, 0.158]], 10), 0, 0, 0, 0.9 * 0.98, 0.9 * 1.04, 0.9 * 1.02), 1],
    [at(new THREE.CylinderGeometry(0.048, 0.055, 0.14, 6, 1, true), 0, -0.15, 0), 1],
    [at(new THREE.SphereGeometry(0.02, 4, 3), 0, -0.011, 0.102, 0.8, 1, 0.9), 0.93],                   // nariz
    [at(new THREE.SphereGeometry(0.013, 4, 2), -0.036, 0.018, 0.092, 1, 1, 0.5), 0.12],               // olhos
    [at(new THREE.SphereGeometry(0.013, 4, 2), 0.036, 0.018, 0.092, 1, 1, 0.5), 0.12],
    [at(new THREE.BoxGeometry(0.035, 0.006, 0.01), 0, -0.047, 0.094), 0.55],                          // boca
    [at(new THREE.SphereGeometry(0.024, 4, 3), -0.101, 0, -0.004, 0.55, 1, 0.9), 0.95],                // orelhas
    [at(new THREE.SphereGeometry(0.024, 4, 3), 0.101, 0, -0.004, 0.55, 1, 0.9), 0.95],
  );
  const cap = (sy = 1) => at(new THREE.SphereGeometry(0.113, 9, 4, 0, PI * 2, 0, PI * 0.55), 0, 0.03, -0.006, 1.0, sy, 1.06, -0.25);
  const hairShort = merge([cap(1), 1]);
  const hairLong = merge([cap(1.05), 1], [at(new THREE.CapsuleGeometry(0.09, 0.16, 2, 7), 0, -0.07, -0.05, 1.12, 1, 0.55), 1]);
  const pelvis = merge(
    [lathe([[0.001, -0.1], [0.12, -0.09], [0.16, -0.02], [0.158, 0.075], [0.001, 0.08]], 10).scale(1, 1, 0.78), 1],
    [at(new THREE.CylinderGeometry(0.162, 0.162, 0.035, 10), 0, 0.06, 0, 1, 1, 0.8), 0.35],           // cinto
  );
  const torso = merge(
    [lathe([[0.001, 0], [0.15, 0.0], [0.158, 0.06], [0.145, 0.16], [0.152, 0.27], [0.18, 0.38], [0.19, 0.44], [0.16, 0.5], [0.07, 0.535], [0.001, 0.54]], 10).scale(1.08, 1, 0.7), 1],
    [at(new THREE.TorusGeometry(0.06, 0.014, 4, 10), 0, 0.525, 0.004, 1, 0.8, 1, PI / 2), 0.8],       // gola
  );
  const skirt = merge([lathe([[0.001, 0.03], [0.165, 0.03], [0.2, -0.1], [0.25, -0.42], [0.001, -0.42]], 10).scale(1, 1, 0.82), 1]);
  const upperArm = merge(
    [new THREE.SphereGeometry(0.064, 6, 4), 1],
    [at(new THREE.CylinderGeometry(0.062, 0.055, 0.28, 6, 1, true), 0, -0.14, 0), 1],
  );
  const foreArm = merge(
    [at(lathe([[0.045, 0.02], [0.046, -0.04], [0.036, -0.2], [0.03, -0.24], [0.001, -0.245]], 7), 0, 0, 0), 1],
    [at(new THREE.BoxGeometry(0.065, 0.1, 0.03), 0, -0.29, 0), 1],                                    // mão
    [at(new THREE.BoxGeometry(0.022, 0.05, 0.022), -0.035, -0.27, 0.02, 1, 1, 1, 0, 0, 0.6), 1],   // polegar
  );
  const thigh = merge([lathe([[0.001, 0.02], [0.08, 0.0], [0.082, -0.08], [0.068, -0.36], [0.06, -0.44], [0.001, -0.45]], 9), 1]);
  const shin = merge([lathe([[0.06, 0.02], [0.062, -0.08], [0.05, -0.3], [0.047, -0.41], [0.001, -0.42]], 9), 1]);
  const shoe = merge(
    [at(new THREE.CapsuleGeometry(0.052, 0.14, 2, 6), 0, 0, 0.045, 1, 0.72, 1, PI / 2), 1],
    [at(new THREE.BoxGeometry(0.105, 0.025, 0.25), 0, -0.035, 0.045), 0.35],                          // sola
  );
  // cuia de chimarrão com bomba de metal (presa na mão direita)
  const cuia = merge(
    [at(new THREE.SphereGeometry(0.05, 7, 4, 0, PI * 2, PI * 0.25, PI * 0.75), 0, 0, 0, 1, 1.15, 1), 0x6f7a3a],
    [at(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 8), 0, 0.05, 0), 0x3f5a22],                    // erva
    [at(new THREE.CylinderGeometry(0.004, 0.004, 0.17, 4), 0.01, 0.1, 0, 1, 1, 1, 0, 0, -0.15), 0xd8d8d8],
  );
  return { pelvis, torso, skirt, head, hairShort, hairLong, upperArm, foreArm, thigh, shin, shoe, cuia };
}

const PAIRED = new Set(['upperArm', 'foreArm', 'thigh', 'shin', 'shoe']);

export class Crowd {
  constructor(scene, max) {
    this.max = max;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
    this.meshes = {};
    for (const [name, g] of Object.entries(parts())) {
      const n = PAIRED.has(name) ? max * 2 : max;
      const m = new THREE.InstancedMesh(g, mat, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      m.castShadow = !['hairShort', 'hairLong', 'cuia', 'shoe', 'foreArm'].includes(name); m.frustumCulled = false; m.count = 0;   // partes pequenas sem sombra
      m.userData.dynamic = true;
      this.meshes[name] = m; scene.add(m);
    }
    const blob = makeContactShadow(0.42);
    this.blob = new THREE.InstancedMesh(blob.geometry, blob.material, max);
    this.blob.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.blob.frustumCulled = false; this.blob.renderOrder = 1; this.blob.count = 0;
    this.blob.userData.dynamic = true; scene.add(this.blob);
    this._c = new THREE.Color();
    // matrizes de trabalho (sem alocação por quadro)
    this.R = new THREE.Matrix4(); this.P = new THREE.Matrix4(); this.C = new THREE.Matrix4(); this.H = new THREE.Matrix4();
    this.A = new THREE.Matrix4(); this.B = new THREE.Matrix4(); this.T = new THREE.Matrix4(); this.S = new THREE.Matrix4(); this.O = new THREE.Matrix4();
    this.e = new THREE.Euler(); this.hv = new THREE.Vector3(); this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  /** Cores de uma pessoa (look.rgb) na vaga i; as vagas mudam a cada quadro (só quem está na vista é desenhado). */
  dress(i, look) {
    const M = this.meshes, c = look.rgb;
    const set = (name, idx, k) => { const a = M[name].instanceColor.array; a[3 * idx] = c[k][0]; a[3 * idx + 1] = c[k][1]; a[3 * idx + 2] = c[k][2]; };
    set('pelvis', i, 'pants'); set('torso', i, 'shirt'); set('skirt', i, 'pants'); set('head', i, 'skin');
    set('hairShort', i, 'hair'); set('hairLong', i, 'hair'); set('cuia', i, 'white');
    const legs = look.skirt ? 'skin' : 'pants';
    for (let s = 0; s < 2; s++) { const j = 2 * i + s; set('upperArm', j, 'shirt'); set('foreArm', j, 'skin'); set('thigh', j, legs); set('shin', j, legs); set('shoe', j, 'shoes'); }
  }
  static rgb(look) {
    const c = new THREE.Color(), f = h => { c.setHex(h); return [c.r, c.g, c.b]; };
    return { pants: f(look.pants), shirt: f(look.shirt), skin: f(look.skin), hair: f(look.hair), shoes: f(look.shoes), white: [1, 1, 1] };
  }

  /** Monta as matrizes de uma pessoa. p: {x, y, z, ang, h (altura), b (largura), pose: ângulos}. */
  pose(i, a, p) {
    const { R, P, C, H, A, B, T, S, O, e } = this, M = this.meshes, b = a.look.b;
    const loc = (out, parent, x, y, z, rx = 0, ry = 0, rz = 0) => { T.makeRotationFromEuler(e.set(rx, ry, rz)); T.setPosition(x, y, z); out.multiplyMatrices(parent, T); };
    const put = (name, idx, m, sx = 1, sy = 1, sz = 1) => { if (sx !== 1 || sy !== 1 || sz !== 1) { S.makeScale(sx, sy, sz); O.multiplyMatrices(m, S); M[name].setMatrixAt(idx, O); } else M[name].setMatrixAt(idx, m); };
    const h = a.look.h;
    R.makeRotationY(p.ang); R.scale(this.hv.set(h, h, h));
    R.setPosition(p.x, p.y, p.z);
    loc(P, R, 0, 0.94 + p.bob, 0, p.pelvisX, p.hipYaw, 0);
    put('pelvis', i, P, b, 1, b);
    put('skirt', i, a.look.skirt ? P : this.zero, b, 1, b);
    loc(C, P, 0, 0.07, 0, p.chestX, p.chestYaw, 0);
    put('torso', i, C, b * a.look.sh, 1, b * (0.85 + 0.15 * b));
    loc(H, C, 0, 0.675, 0, p.headX, p.headYaw, 0);
    put('head', i, H);
    put('hairShort', i, a.look.hairStyle === 'short' ? H : this.zero);
    put('hairLong', i, a.look.hairStyle === 'long' ? H : this.zero);
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1, j = 2 * i + s;
      loc(A, C, sg * 0.2 * b * a.look.sh, 0.43, 0, p.sh[s], 0, sg * p.shZ[s]);
      put('upperArm', j, A);
      loc(B, A, 0, -0.28, 0, p.el[s], 0, 0);
      put('foreArm', j, B);
      if (s === 1) { if (a.look.cuia && p.cuia) { loc(A, B, 0, -0.28, 0.04, -p.el[s] - p.sh[s], 0, 0); put('cuia', i, A); } else put('cuia', i, this.zero); }
      loc(A, P, sg * 0.085 * b, -0.04, 0, p.hip[s], 0, 0);
      put('thigh', j, A);
      loc(B, A, 0, -0.44, 0, p.knee[s], 0, 0);
      put('shin', j, B);
      loc(A, B, 0, -0.43, 0, p.foot[s], 0, 0);
      put('shoe', j, A);
    }
    T.makeTranslation(p.x, p.gy + 0.04, p.z); this.blob.setMatrixAt(i, T);
  }

  /** Esconde a vaga i (sem desenhar). */
  hide(i) {
    for (const [name, m] of Object.entries(this.meshes)) { if (PAIRED.has(name)) { m.setMatrixAt(2 * i, this.zero); m.setMatrixAt(2 * i + 1, this.zero); } else m.setMatrixAt(i, this.zero); }
    this.blob.setMatrixAt(i, this.zero);
  }

  commit(count) {
    for (const [name, m] of Object.entries(this.meshes)) { m.count = PAIRED.has(name) ? count * 2 : count; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    this.blob.count = count; this.blob.instanceMatrix.needsUpdate = true;
  }
}

// Etapa 2 — dirigir (referência: Bah City). Carros procedurais (perfil lateral extrudado: capô, para-brisa, teto,
// porta-malas; rodas com aro) e física arcade sobre o relevo real: aceleração, freio, ré, direção que fecha com a
// velocidade, freio de mão, ladeira, fora da estrada mais lento, batida em prédio/obstáculo com repique.
// O jogador entra num carro estacionado (F), que some do "estacionamento" e vira o carro dirigido.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/* ---------- modelos 3D (Kenney Car Kit 3.1, CC0 — public/models/cars/LICENSE-Kenney-CarKit.txt) ----------
 * Os modelos vêm com proporção de brinquedo (curtos e altos); a carroceria é esticada para medidas reais de carro
 * brasileiro e as rodas são escaladas por igual (continuam redondas) e reposicionadas nos eixos esticados. */
export const CAR_MODELS = {   // arquivo: [comprimento, largura, altura] reais em m
  sedan: [4.4, 1.78, 1.47], 'hatchback-sports': [4.0, 1.74, 1.45], suv: [4.5, 1.86, 1.72], 'suv-luxury': [4.75, 1.92, 1.75],
  taxi: [4.4, 1.78, 1.6], van: [4.9, 1.95, 1.95], truck: [5.2, 1.9, 1.85], 'sedan-sports': [4.3, 1.8, 1.38], delivery: [6.0, 2.1, 2.8],
};
async function bytes(url) {
  try { const r = await fetch(url + '.b64.json'); if (r.ok) { const j = await r.json(); return Uint8Array.from(atob(j.base64), c => c.charCodeAt(0)).buffer; } } catch { /* sem cópia */ }
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer();
}
export async function loadCarModels(base) {
  const L = new GLTFLoader(), dir = base + 'models/cars/', out = {};
  await Promise.all(Object.keys(CAR_MODELS).map(async n => { try { out[n] = (await L.parseAsync(await bytes(dir + n + '.glb'), dir)).scene; } catch (e) { console.warn('carro', n, e.message); } }));
  return out;
}
/* ---------- carros reais (Sketchfab, CC BY 4.0 — public/models/cars3d/CREDITOS.txt) ----------
 * Convertidos por scripts/convert-car.mjs: frente em +z, medidas reais, rodas "wheel_*" com pivô no centro, pintura
 * no material "paint" (branca: a cor vem por carro), e um nível leve "lod1" no mesmo arquivo para os estacionados. */
export const REAL_CARS = {
  honda_city: { nome: 'Honda City', head: [0.6, 0.77, 2.12], tail: [0.62, 0.93, -2.16] },
  peugeot_206: { nome: 'Peugeot 206', head: [0.56, 0.72, 1.78], tail: [0.62, 0.86, -1.86] },
};
// cores comuns da frota brasileira (branco, prata e preto dominam)
export const REAL_PAINT = [0xeeeeee, 0xe4e4e2, 0xa7abb0, 0x8e9297, 0x2b2e33, 0x161719, 0x7d1d1d, 0x23406e, 0x5a5f63, 0xc9c2ae];
/** Carrega os modelos reais (uma vez; as instâncias dividem geometria e materiais). */
let _real = null;
export function loadRealCars(base) {
  return _real ||= (async () => {
    const L = new GLTFLoader(), dir = base + 'models/cars3d/', out = {};
    await Promise.all(Object.keys(REAL_CARS).map(async n => {
      try {
        const sc = (await L.parseAsync(await bytes(dir + n + '.glb'), dir)).scene;
        sc.userData.real = n;
        sc.traverse(o => { if (o.isMesh) { const m = o.material; if (m.map) m.map.anisotropy = 4; o.castShadow = true; o.receiveShadow = true; } });
        out[n] = sc;
      } catch (e) { console.warn('carro', n, e.message); }
    }));
    return out;
  })();
}
const _paints = new Map();
function paintFor(src, color) {   // um material de pintura por cor (os outros materiais são os do arquivo)
  const k = color; if (_paints.has(k)) return _paints.get(k);
  let base = null; src.traverse(o => { if (o.isMesh && o.material.name === 'paint') base = o.material; });
  const m = base.clone(); m.color.setHex(color); _paints.set(k, m); return m;
}
/** Brilho de farol/lanterna por cima das lâmpadas do modelo: Vehicle mexe em emissiveIntensity, aqui vira opacidade. */
function glowMat(color, i0, span) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  let I = i0; Object.defineProperty(m, 'emissiveIntensity', { get: () => I, set: v => { I = v; m.opacity = Math.max(0, Math.min(1, (v - i0) / span)); m.visible = m.opacity > 0.01; } });
  m.emissiveIntensity = i0; return m;
}
function realCarMesh(src, name, color) {
  const cfg = REAL_CARS[name], g = src.clone(true), wheels = [];
  g.getObjectByName('lod1')?.removeFromParent();
  const paint = paintFor(src, color);
  g.traverse(o => { if (o.isMesh && o.material.name === 'paint') o.material = paint; });
  for (const n of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
    const w = g.getObjectByName(n); if (!w) continue;
    const piv = new THREE.Group(); piv.position.copy(w.position); w.position.set(0, 0, 0); w.parent.add(piv); piv.add(w);
    wheels.push({ rotation: { set: (a, b) => { piv.rotation.y = b; w.rotation.x = a; } } });
    if (!g.userData.wheelR) { const bb = new THREE.Box3().setFromObject(w); g.userData.wheelR = (bb.max.y - bb.min.y) / 2; }
  }
  const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3());
  const lightM = glowMat(0xfff1c8, 0.2, 2.5), tailM = glowMat(0xff2410, 0.3, 1.3);
  const quad = new THREE.PlaneGeometry(0.34, 0.13);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(quad, lightM); h.position.set(s * cfg.head[0], cfg.head[1], cfg.head[2] + 0.04); g.add(h);
    const t = new THREE.Mesh(quad, tailM); t.position.set(s * cfg.tail[0], cfg.tail[1], cfg.tail[2] - 0.04); t.rotation.y = Math.PI; g.add(t);
  }
  const beam = new THREE.SpotLight(0xfff2d0, 0, 45, 0.5, 0.6, 1.2); beam.position.set(0, cfg.head[1], cfg.head[2]); beam.target.position.set(0, 0, cfg.head[2] + 12); g.add(beam, beam.target);
  g.userData = { wheels, lightM, tailM, beam, len: size.z, w: size.x, model: name, nome: cfg.nome, wheelR: g.userData.wheelR || 0.31 };
  return g;
}

/** Instância pronta de um modelo, nas medidas reais; devolve { group, wheels[4] (frente esq/dir primeiro), len, w, hl }. */
export function buildModelCar(src, name, tint = null) {
  const [L, W, H] = CAR_MODELS[name], g = new THREE.Group(), s = src.clone(true);
  const box = new THREE.Box3().setFromObject(s), size = box.getSize(new THREE.Vector3());
  const sx = W / size.x, sy = H / size.y, sz = L / size.z, sw = Math.min(1.25, (sy + sx) / 2 * 1.02);
  const wheels = [];
  for (const ch of [...s.children]) {
    if (/wheel/.test(ch.name)) {
      ch.position.set(ch.position.x * sx * 1.05, ch.position.y * sw, ch.position.z * sz * 0.94); ch.scale.setScalar(sw);
      const piv = new THREE.Group(); piv.position.copy(ch.position); ch.position.set(0, 0, 0); piv.add(ch); g.add(piv);
      piv.userData.front = piv.position.z > 0; wheels.push(piv);
    } else { ch.position.set(ch.position.x * sx, ch.position.y * sy, ch.position.z * sz); ch.scale.set(sx, sy, sz); g.add(ch); }
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; const m = o.material; o.material = new THREE.MeshStandardMaterial({ map: m.map, roughness: 0.42, metalness: 0.15 }); if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace; } });
  wheels.sort((a, b) => b.position.z - a.position.z);
  return { group: g, wheels: wheels.filter(w => w.position.y < H * 0.5), len: L, w: W, h: H };
}

const PI = Math.PI;
// perfis laterais (z = frente +, y = altura) por tipo; largura em x
const PROFILES = {
  hatch: { w: 1.7, pts: [[-1.85, 0.32], [1.85, 0.32], [1.95, 0.55], [1.9, 0.78], [1.15, 0.9], [0.55, 1.42], [-0.95, 1.47], [-1.75, 1.15], [-1.92, 0.8]], glass: [[0.52, 1.36], [-0.9, 1.41], [-1.62, 1.13], [-1.62, 0.95], [1.05, 0.95]] },
  sedan: { w: 1.75, pts: [[-2.2, 0.3], [2.2, 0.3], [2.3, 0.52], [2.25, 0.75], [1.3, 0.88], [0.6, 1.38], [-0.75, 1.42], [-1.45, 1.0], [-2.25, 0.92], [-2.3, 0.6]], glass: [[0.57, 1.32], [-0.7, 1.36], [-1.32, 1.0], [-1.32, 0.92], [1.2, 0.92]] },
  suv: { w: 1.85, pts: [[-2.15, 0.42], [2.15, 0.42], [2.25, 0.7], [2.2, 0.98], [1.45, 1.08], [0.9, 1.62], [-1.95, 1.68], [-2.2, 1.35], [-2.25, 0.8]], glass: [[0.87, 1.56], [-1.85, 1.62], [-2.0, 1.36], [-2.0, 1.12], [1.35, 1.12]] },
};
export const CAR_TYPES = Object.keys(PROFILES);

function extrudeSide(pts, w, inset = 0) {
  const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: w - inset * 2, bevelEnabled: false });
  g.rotateY(-PI / 2); g.translate(w / 2 - inset, 0, 0);   // extrusão ao longo de x, frente em +z
  return g;
}
/** Geometrias de um tipo: carroceria, vidros, rodas (no lugar). Simples o bastante para milhares de carros parados. */
export function carGeometries(type = 'hatch', segs = 7) {
  const P = PROFILES[type], body = extrudeSide(P.pts, P.w), glass = extrudeSide(P.glass, P.w + 0.02, 0);
  const zf = P.pts[1][0] - 0.62, zb = P.pts[0][0] + 0.62, wx = P.w / 2 - 0.08;
  const wheel = () => new THREE.CylinderGeometry(0.33, 0.33, 0.24, segs).rotateZ(PI / 2);
  const wheels = mergeGeometries([[wx, zf], [-wx, zf], [wx, zb], [-wx, zb]].map(([x, z]) => wheel().translate(x, 0.33, z)));
  return { body, glass, wheels, wheelPos: [[wx, zf], [-wx, zf], [wx, zb], [-wx, zb]], len: P.pts[1][0] - P.pts[0][0], w: P.w };
}

/** Carro do jogador (mais detalhe: rodas com aro que giram, faróis e lanternas que acendem). */
export function makeCarMesh(type, color, models = null) {
  const mname = models && (models[type] ? type : Object.keys(models).find(n => models[n]));
  if (mname && models[mname].userData.real) return realCarMesh(models[mname], mname, color);
  if (mname) return modelCarMesh(models[mname], mname);
  const G = carGeometries(type, 14), g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x1e2830, roughness: 0.08, metalness: 0.4 });
  const body = new THREE.Mesh(G.body, paint), glass = new THREE.Mesh(G.glass, glassM);
  body.castShadow = true; body.receiveShadow = true; g.add(body, glass);
  const tyre = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }), rim = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.3, metalness: 0.8 });
  const wheels = G.wheelPos.map(([x, z]) => {
    const w = new THREE.Group(); w.position.set(x, 0.33, z);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 16).rotateZ(PI / 2), tyre);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.25, 10).rotateZ(PI / 2), rim);
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.05), rim); sp.rotation.x = k / 5 * PI; w.add(sp); }
    w.add(t, r); g.add(w); return w;
  });
  const lightM = new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xfff2cc, emissiveIntensity: 0.2 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0x8a1010, emissive: 0xff2020, emissiveIntensity: 0.3 });
  const zf = PROFILES[type].pts[1][0] + 0.08, zb = PROFILES[type].pts[0][0] - 0.05, yl = PROFILES[type].pts[2][1] + 0.05;
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.05), lightM); h.position.set(s * (G.w / 2 - 0.3), yl, zf); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.05), tailM); t.position.set(s * (G.w / 2 - 0.25), yl + 0.18, zb); g.add(t);
  }
  const beam = new THREE.SpotLight(0xfff2d0, 0, 45, 0.5, 0.6, 1.2); beam.position.set(0, yl, zf); beam.target.position.set(0, 0, zf + 12); g.add(beam, beam.target);
  g.userData = { wheels, lightM, tailM, beam, len: G.len, w: G.w };
  return g;
}

function modelCarMesh(src, name) {
  const M = buildModelCar(src, name), g = M.group, L = M.len / 2, yl = 0.75;
  const lightM = new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xfff2cc, emissiveIntensity: 0.2 });
  const tailM = new THREE.MeshStandardMaterial({ color: 0x8a1010, emissive: 0xff2020, emissiveIntensity: 0.3 });
  for (const s of [-1, 1]) {   // faróis e lanternas finos por cima do modelo (acendem à noite, luz de freio)
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.03), lightM); h.position.set(s * (M.w / 2 - 0.3), yl, L + 0.01); g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.03), tailM); t.position.set(s * (M.w / 2 - 0.25), yl + 0.1, -L - 0.01); g.add(t);
  }
  const beam = new THREE.SpotLight(0xfff2d0, 0, 45, 0.5, 0.6, 1.2); beam.position.set(0, yl, L); beam.target.position.set(0, 0, L + 12); g.add(beam, beam.target);
  // rodas no formato que o Vehicle espera: frente primeiro; o giro vai num grupo interno
  const wheels = M.wheels.map(p => { const spin = p.children[0]; return { rotation: { set: (a, b) => { p.rotation.y = b; spin.rotation.x = a; } } }; });
  g.userData = { wheels, lightM, tailM, beam, len: M.len, w: M.w, model: name };
  return g;
}

export class Vehicle {
  constructor(scene, { type = 'hatch', color = 0xb02a2a, x, z, yaw }, ctx) {
    this.ctx = ctx;           // { groundAt(x,z,cur), blocked(x,z,r), surfOffset(x,z), terrain }
    this.type = type; this.mesh = makeCarMesh(type, color, ctx.models); scene.add(this.mesh);
    this.x = x; this.z = z; this.yaw = yaw; this.v = 0; this.steer = 0; this.y = ctx.groundAt(x, z, ctx.terrain.heightAt(x, z) + 1);
    this.pitch = 0; this.roll = 0; this.spin = 0; this.prev = { x, z, yaw, y: this.y }; this.hit = 0; this.honk = 0;
  }
  get kmh() { return Math.abs(this.v) * 3.6; }
  /** Passo fixo. ax = { f, t }, hb = freio de mão. */
  step(h, ax, hb = false) {
    const P = this.prev; P.x = this.x; P.z = this.z; P.yaw = this.yaw; P.y = this.y;
    const c = this.ctx, onRoad = c.surfOffset(this.x, this.z) > 0, vmax = onRoad ? 23 : 10, f = ax.f;
    // motor / freio / ré
    if (f > 0.05) this.v += (this.v < 0 ? 10 : 6.5 * (1 - Math.max(0, this.v) / vmax)) * f * h;
    else if (f < -0.05) this.v += (this.v > 0.5 ? -11 : -4 * (1 + Math.min(0, this.v) / 6)) * -f * h;
    else this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), (onRoad ? 1.2 : 3) * h);   // rolagem
    if (hb) this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), 7 * h);
    if (!onRoad && Math.abs(this.v) > vmax) this.v -= Math.sign(this.v) * 6 * h;
    // ladeira: componente da gravidade ao longo do carro
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), T = c.terrain;
    const slope = (T.heightAt(this.x + fx * 1.5, this.z + fz * 1.5) - T.heightAt(this.x - fx * 1.5, this.z - fz * 1.5)) / 3;
    this.v -= Math.max(-0.3, Math.min(0.3, slope)) * 9.8 * 0.6 * h;
    // direção: ângulo máximo fecha com a velocidade (bicicleta cinemática)
    const smax = 0.62 / (1 + Math.abs(this.v) * 0.06);
    this.steer += (ax.t * smax - this.steer) * Math.min(1, h * 8);
    let yawRate = this.v / 2.6 * Math.tan(this.steer); if (hb && Math.abs(this.v) > 4) yawRate *= 1.45;
    this.yaw -= yawRate * h;
    const nx = this.x + Math.sin(this.yaw) * this.v * h, nz = this.z + Math.cos(this.yaw) * this.v * h;
    // batida: cantos da frente (ou de trás, na ré) e o centro
    const dir = Math.sign(this.v) || 1, sx = Math.sin(this.yaw), sz = Math.cos(this.yaw), L = this.mesh.userData.len / 2, W = this.mesh.userData.w / 2;
    const probe = [[0, dir * L], [W * 0.9, dir * L * 0.95], [-W * 0.9, dir * L * 0.95], [W, 0], [-W, 0]];
    const free = (x, z) => T.inside(x, z, 5) && probe.every(([a, b]) => !c.blocked(x + sz * a * 1 + sx * b - 0, z - sx * a + sz * b, 0.15));
    if (Math.abs(this.v) < 0.01 || free(nx, nz)) { this.x = nx; this.z = nz; }
    else { this.hit = Math.min(1, Math.abs(this.v) / 15); this.v = -this.v * 0.25; }
    // altura, inclinação (frente/trás) e rolagem (lados) pelo chão
    const g = (dx, dz) => c.groundAt(this.x + dx, this.z + dz, this.y + 0.6);
    const yF = g(sx * L * 0.7, sz * L * 0.7), yB = g(-sx * L * 0.7, -sz * L * 0.7), yR = g(sz * W, -sx * W), yL = g(-sz * W, sx * W);
    this.y = (yF + yB + yR + yL) / 4;
    this.pitch += (Math.atan2(yF - yB, L * 1.4) - this.pitch) * Math.min(1, h * 10);
    this.roll += (Math.atan2(yR - yL, W * 2) + this.steer * this.v * 0.004 - this.roll) * Math.min(1, h * 10);
    this.spin += this.v * h / (this.mesh.userData.wheelR || 0.33); this.hit *= 1 - Math.min(1, h * 4);
  }
  /** Desenho interpolado. */
  present(alpha, night = 0) {
    const P = this.prev, m = this.mesh;
    let d = this.yaw - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    const x = P.x + (this.x - P.x) * alpha, z = P.z + (this.z - P.z) * alpha, y = P.y + (this.y - P.y) * alpha, yaw = P.yaw + d * alpha;
    m.position.set(x, y, z); m.rotation.set(-this.pitch, yaw, this.roll, 'YXZ');
    const U = m.userData;
    U.wheels.forEach((w, i) => { w.rotation.set(this.spin, i < 2 ? -this.steer : 0, 0, 'YXZ'); });
    U.lightM.emissiveIntensity = 0.2 + night * 2.5; U.beam.intensity = night * 40; U.tailM.emissiveIntensity = this.v < -0.1 || this._braking ? 1.6 : 0.3 + night * 0.6;
    return { x, y, z, yaw };
  }
}

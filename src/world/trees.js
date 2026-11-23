// Árvores detalhadas perto da câmera: tronco e galhos de verdade, copa de cartões de folha recortados (alpha test)
// com normais radiais (a copa sombreia como um volume, skill gamedev-foliage) e vento por vértice (raiz parada,
// pontas mexendo, rajada que viaja pelo mundo). Longe, as árvores continuam com a copa simples do streetlife.
// Um "pool" de instâncias por espécie: a cada 0,3 s as árvores mais próximas trocam a copa simples pela detalhada.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const PI = Math.PI;
export const wind = { time: { value: 0 } };

/* ------------------------------ texturas ------------------------------ */
function leafTexture() {
  // ramo de folhas em tons de cinza (a cor vem da instância: verde, ipê rosa, ipê amarelo), fundo transparente
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 120; i++) {
    const a = r() * PI * 2, d = Math.sqrt(r()) * 104, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d;
    const v = 150 + r() * 105 | 0, len = 12 + r() * 10, ang = a + (r() - 0.5) * 1.2;
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(0, 0, len, len * 0.42, 0, 0, PI * 2); g.fill();
    g.strokeStyle = `rgba(0,0,0,0.25)`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-len, 0); g.lineTo(len, 0); g.stroke();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
/** Piloto: ramo com muitas folhas pequenas e pecíolos, tons por folha (claro nas bordas, mais escuro dentro), recorte
 *  irregular — de perto lê como folhagem, não como placa. Tons de cinza claros (a cor vem da instância). */
function leafTextureP() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const twig = (x0, y0, a, L, depth) => {
    const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L;
    g.strokeStyle = 'rgb(95,85,70)'; g.lineWidth = Math.max(1, depth * 1.4); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const n = 5 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const t = 0.25 + i / n * 0.8, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const side of [-1, 1]) {
        const la = a + side * (0.7 + r() * 0.5), len = 13 + r() * 10, v = 165 + r() * 80 | 0, w = len * (0.36 + r() * 0.1);
        g.save(); g.translate(x + Math.cos(la) * len * 0.55, y + Math.sin(la) * len * 0.55); g.rotate(la);
        g.fillStyle = `rgb(${v},${v},${v - 10})`; g.beginPath(); g.moveTo(-len * 0.55, 0); g.quadraticCurveTo(0, -w, len * 0.55, 0); g.quadraticCurveTo(0, w, -len * 0.55, 0); g.fill();
        g.strokeStyle = 'rgba(60,60,50,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-len * 0.5, 0); g.lineTo(len * 0.5, 0); g.stroke();
        g.restore();
      }
    }
    if (depth > 1) for (let k = 0; k < 2; k++) twig(x0 + (x1 - x0) * (0.4 + k * 0.3), y0 + (y1 - y0) * (0.4 + k * 0.3), a + (k ? 0.6 : -0.6) + (r() - 0.5) * 0.3, L * 0.55, depth - 1);
  };
  for (let i = 0; i < 6; i++) { const a = -PI / 2 + (i - 2.5) * 0.42 + (r() - 0.5) * 0.2; twig(256, 470, a, 170 + r() * 60, 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function frondTexture() {
  // folha de palmeira: nervura central e folíolos
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
  g.strokeStyle = '#d8d8d8'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 256); g.lineTo(32, 0); g.stroke();
  for (let y = 8; y < 250; y += 7) { const w = 28 * Math.sin((y / 256) * PI) + 4, v = 170 + (y % 3) * 25; g.strokeStyle = `rgb(${v},${v},${v})`; g.lineWidth = 3; g.beginPath(); g.moveTo(32, y); g.lineTo(32 - w, y + 14); g.moveTo(32, y); g.lineTo(32 + w, y + 14); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function barkTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#6a5848'; g.fillRect(0, 0, 64, 128);
  let s = 9; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 60; i++) { g.fillStyle = r() < 0.5 ? 'rgba(40,30,22,0.45)' : 'rgba(150,130,110,0.3)'; g.fillRect(r() * 64, r() * 128, 2 + r() * 3, 8 + r() * 24); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ------------------------------ materiais com vento ------------------------------ */
/** Lambert com vento por vértice (atributo `wind` 0..1) e normais radiais sem inverter na face de trás. */
function windMaterial(opts, radial, pilot = false) {
  const m = new THREE.MeshLambertMaterial(opts);
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = wind.time;
    if (pilot) {
      // varyings: posição no mundo (fade perto da câmera) e "exterioridade" da folha (wind ~ altura/raio → oclusão)
      sh.vertexShader = 'varying vec3 vWPos;\nvarying float vOut;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\nvOut = wind;');
      sh.fragmentShader = 'varying vec3 vWPos;\nvarying float vOut;\n' + sh.fragmentShader
        .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
          { // folhas entre a câmera e o personagem: somem aos poucos (pontilhado), só perto da câmera
            float dc = length(vWPos - cameraPosition);
            float keep = smoothstep(1.2, 4.5, dc);
            float n = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
            if (n > keep) discard;
          }`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.rgb *= mix(0.72, 1.12, clamp(vOut, 0.0, 1.0));   // miolo da copa mais escuro, bordas mais claras`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += diffuseColor.rgb * 0.16;              // luz que atravessa as folhas (sem verde-preto na sombra)`);
    }
    sh.vertexShader = 'attribute float wind;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 wp = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float ph = wp.x * 0.07 + wp.z * 0.05;
        float sway = sin(uTime * 0.9 + ph) * 0.6 + sin(uTime * 1.7 + ph * 1.3) * 0.25;
        float flutter = sin(uTime * 6.0 + position.x * 2.1 + position.y * 1.7 + position.z * 2.3);
        transformed.x += wind * (sway * 0.18 + flutter * 0.035);
        transformed.z += wind * (sway * 0.12 + flutter * 0.03);
        transformed.y += wind * flutter * 0.02;
      }`);
    // copa: a normal radial já aponta para fora dos dois lados do cartão; não inverter na face de trás
    if (radial) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
  };
  m.customProgramCacheKey = () => 'wind' + (radial ? 'R' : '') + (pilot ? 'P' : '');
  return m;
}

/* ------------------------------ geometrias por espécie ------------------------------ */
const clean = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; };
const withWind = (g, f) => { const p = g.attributes.position, a = new Float32Array(p.count); for (let i = 0; i < p.count; i++) a[i] = f(p.getX(i), p.getY(i), p.getZ(i)); g.setAttribute('wind', new THREE.BufferAttribute(a, 1)); return g; };

/** Árvore folhosa: tronco, galhos primários e secundários; cachos de cartões nas pontas. */
function broadleaf({ trunkH, trunkR, crownR, crownH, crownY, branches, cards, seed, cardScale = 1, lobes = 0 }) {
  let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const wood = [], leaves = [], tips = [];
  const limb = (x0, y0, z0, x1, y1, z1, r0, r1) => {
    const L = Math.hypot(x1 - x0, y1 - y0, z1 - z0), g = new THREE.CylinderGeometry(r1, r0, L, 6, 1, true).translate(0, L / 2, 0);
    const dir = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.applyQuaternion(q).translate(x0, y0, z0); wood.push(g);
  };
  limb(0, 0, 0, 0, trunkH, 0, trunkR, trunkR * 0.7);
  for (let i = 0; i < branches; i++) {
    const a = i / branches * PI * 2 + r() * 0.6, out = crownR * (0.55 + r() * 0.3), y1 = crownY + (r() - 0.3) * crownH * 0.6;
    const bx = Math.cos(a) * out, bz = Math.sin(a) * out;
    limb(0, trunkH * (0.8 + r() * 0.15), 0, bx, y1, bz, trunkR * 0.55, trunkR * 0.18);
    tips.push([bx, y1, bz]);
    // galho secundário
    const a2 = a + (r() - 0.5) * 1.4, mx = bx * 0.6, mz = bz * 0.6, my = trunkH + (y1 - trunkH) * 0.6;
    const tx = mx + Math.cos(a2) * crownR * 0.35, tz = mz + Math.sin(a2) * crownR * 0.35, ty = my + crownH * 0.35;
    limb(mx, my, mz, tx, ty, tz, trunkR * 0.25, trunkR * 0.1); tips.push([tx, ty, tz]);
  }
  tips.push([0, crownY + crownH * 0.35, 0]);
  // cartões: planos cruzados orientados ao acaso dentro do elipsoide da copa, mais densos nas pontas dos galhos
  const C = new THREE.Vector3(0, crownY, 0);
  for (let i = 0; i < cards; i++) {
    const t = tips[i % tips.length], sz = crownR * (0.38 + r() * 0.22) * cardScale, spread = lobes ? 0.55 : 0.9;
    // piloto: cachos em volta das pontas dos galhos (lóbulos) — silhueta recortada, com vãos de céu
    let px = t[0] + (r() - 0.5) * crownR * spread, py = t[1] + (r() - 0.4) * crownH * 0.7 * (lobes ? 0.8 : 1), pz = t[2] + (r() - 0.5) * crownR * spread;
    // mantém dentro do elipsoide
    const ex = px / crownR, ey = (py - crownY) / crownH, ez = pz / crownR, e = Math.hypot(ex, ey, ez); if (e > 1) { px /= e; pz /= e; py = crownY + (py - crownY) / e; }
    const g = new THREE.PlaneGeometry(sz, sz).rotateX(r() * PI).rotateY(r() * PI).rotateZ((r() - 0.5) * 0.8).translate(px, py, pz);
    leaves.push(g);
  }
  // normais radiais (85%) + um pouco da normal do cartão
  const leafG = mergeGeometries(leaves.map(clean)), P = leafG.attributes.position, N = leafG.attributes.normal, v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.set(P.getX(i), P.getY(i), P.getZ(i)).sub(C); v.x /= crownR; v.z /= crownR; v.y /= crownH; v.normalize();
    n.set(N.getX(i), N.getY(i), N.getZ(i)); if (n.dot(v) < 0) n.negate();
    n.multiplyScalar(0.15).add(v.multiplyScalar(0.85)).normalize(); N.setXYZ(i, n.x, n.y, n.z);
  }
  withWind(leafG, (x, y, z) => Math.min(1, Math.max(0, (y - trunkH * 0.7) / (crownY + crownH - trunkH * 0.7)) * 0.7 + Math.hypot(x, z) / crownR * 0.4));
  const woodG = mergeGeometries(wood.map(clean));
  withWind(woodG, (x, y) => Math.max(0, (y - trunkH) / (crownY + crownH)) * 0.4);
  // UV do tronco em metros
  return { wood: woodG, leaf: leafG };
}

function palm() {
  const wood = [], leaves = [];
  const H = 7.5;
  for (let i = 0; i < 6; i++) { const y0 = i * H / 6, y1 = (i + 1) * H / 6; wood.push(new THREE.CylinderGeometry(0.17 - i * 0.008, 0.2 - i * 0.008, y1 - y0, 7, 1, true).translate(Math.sin(i * 0.5) * 0.04, (y0 + y1) / 2, 0)); }
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * PI * 2, droop = 0.35 + (i % 3) * 0.2;
    // folha arqueada: dois segmentos
    const f1 = new THREE.PlaneGeometry(1.0, 2.0, 1, 1).translate(0, 1.0, 0).rotateX(-PI / 2 + droop * 0.6).rotateY(a).translate(0, H, 0);
    const f2 = new THREE.PlaneGeometry(0.9, 1.8, 1, 1);
    const uv = f2.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * 0.5 + 0.5);
    const uv1 = f1.attributes.uv; for (let k = 0; k < uv1.count; k++) uv1.setY(k, uv1.getY(k) * 0.5);
    f2.translate(0, 0.9, 0).rotateX(-PI / 2 + droop * 1.4).rotateY(a).translate(Math.sin(a) * 1.9, H + 0.35 - droop * 0.3, Math.cos(a) * 1.9);
    leaves.push(f1, f2);
  }
  const leafG = mergeGeometries(leaves.map(clean));
  const N = leafG.attributes.normal; for (let i = 0; i < N.count; i++) { if (N.getY(i) < 0) N.setXYZ(i, -N.getX(i), -N.getY(i), -N.getZ(i)); }
  withWind(leafG, (x, y, z) => Math.min(1, Math.hypot(x, z) / 3.5) * 1.2);
  const woodG = mergeGeometries(wood.map(clean));
  withWind(woodG, (x, y) => y / H * 0.25);
  return { wood: woodG, leaf: leafG, flat: true };
}

/* ------------------------------ sistema ------------------------------ */
const SPECIES = {
  leafy: () => broadleaf({ trunkH: 2.6, trunkR: 0.2, crownR: 3.3, crownH: 2.2, crownY: 5.0, branches: 5, cards: 46, seed: 3 }),
  big: () => broadleaf({ trunkH: 4.6, trunkR: 0.55, crownR: 8.0, crownH: 3.6, crownY: 10.2, branches: 7, cards: 120, seed: 7 }),
  // piloto (árvores da praça junto ao arroio): mais galhos, 2,5× cartões com metade do tamanho, copa em lóbulos
  bigP: () => broadleaf({ trunkH: 4.2, trunkR: 0.5, crownR: 7.6, crownH: 4.0, crownY: 9.8, branches: 11, cards: 300, seed: 19, cardScale: 0.52, lobes: 1 }),
  palm,
};

/**
 * Árvores detalhadas. `add(t)` registra uma árvore {x, y, z, kind, s, rot, color, far: [[mesh, index], ...]}.
 * update(px, pz) troca as mais próximas (até `cap` por espécie) para o modelo detalhado.
 */
export class TreeLOD {
  constructor(scene, { cap = { leafy: 160, big: 30, palm: 40 }, radius = 130 } = {}) {
    this.radius = radius; this.trees = []; this.grid = new Map(); this.timer = 0; this.alwaysNear = [];
    const leafM = windMaterial({ map: leafTexture(), alphaTest: 0.45, side: THREE.DoubleSide }, true);
    const leafTP = leafTextureP(), leafMP = windMaterial({ map: leafTP, alphaTest: 0.4, side: THREE.DoubleSide }, true, true);
    const depthP = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTP, alphaTest: 0.4 });   // sombra recortada pelas folhas
    const frondM = windMaterial({ map: frondTexture(), alphaTest: 0.4, side: THREE.DoubleSide }, true);
    const barkM = windMaterial({ map: barkTexture() }, false);
    this.pools = {};
    for (const [kind, make] of Object.entries(SPECIES)) {
      const g = make(), n = cap[kind] ?? (kind === 'bigP' ? 8 : 10);
      const wood = new THREE.InstancedMesh(g.wood, barkM, n), leaf = new THREE.InstancedMesh(g.leaf, kind === 'palm' ? frondM : kind === 'bigP' ? leafMP : leafM, n);
      if (kind === 'bigP') leaf.customDepthMaterial = depthP;
      for (const m of [wood, leaf]) { m.count = 0; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; m.userData.dynamic = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
      leaf.setColorAt(0, new THREE.Color(1, 1, 1));
      wood.castShadow = false;                     // a sombra da copa domina; tronco sem sombra economiza draw calls
      this.pools[kind] = { wood, leaf, cap: n, used: [] };
    }
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(); this._c = new THREE.Color(); this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this._e = new THREE.Euler();
  }
  add(t, always = false) {
    this.trees.push(t);
    if (always) { this.alwaysNear.push(t); return; }
    const k = Math.floor(t.x / 50) + ',' + Math.floor(t.z / 50); (this.grid.get(k) || this.grid.set(k, []).get(k)).push(t);
  }
  update(dt, px, pz, elapsed) {
    wind.time.value = elapsed;
    this.timer -= dt; if (this.timer > 0) return; this.timer = 0.3;
    const R = this.radius, near = [...this.alwaysNear];
    for (let i = Math.floor((px - R) / 50); i <= Math.floor((px + R) / 50); i++) for (let j = Math.floor((pz - R) / 50); j <= Math.floor((pz + R) / 50); j++)
      for (const t of this.grid.get(i + ',' + j) || []) { const d = Math.hypot(t.x - px, t.z - pz); if (d < R) { t._d = d; near.push(t); } }
    near.sort((a, b) => (a._d || 0) - (b._d || 0));
    const want = new Set(), count = {};
    for (const t of near) { const kind = SPECIES[t.kind] ? t.kind : 'leafy'; count[kind] = count[kind] || 0; if (count[kind] < this.pools[kind].cap) { count[kind]++; want.add(t); } }
    // devolve a copa simples para quem saiu; esconde a copa simples de quem entrou
    for (const t of this.trees) {
      const isNear = want.has(t);
      if (t.far && !t._farM) t._farM = t.far.map(([m, i]) => this._farMatrix(m, i));   // guarda a matriz original antes de esconder
      if (t._near !== isNear && t.far) t.far.forEach(([m, i], j) => { m.setMatrixAt(i, isNear ? this.zero : t._farM[j]); m.instanceMatrix.needsUpdate = true; });
      t._near = isNear;
    }
    for (const [kind, P] of Object.entries(this.pools)) {
      let n = 0;
      for (const t of want) {
        const k2 = SPECIES[t.kind] ? t.kind : 'leafy'; if (k2 !== kind) continue;
        this._e.set(0, t.rot || 0, 0); this._q.setFromEuler(this._e); this._s.setScalar(t.s || 1); this._v.set(t.x, t.y, t.z);
        this._m.compose(this._v, this._q, this._s);
        P.wood.setMatrixAt(n, this._m); P.leaf.setMatrixAt(n, this._m); P.leaf.setColorAt(n, this._c.setHex(t.color ?? 0x5a8a3c));
        n++;
      }
      P.wood.count = P.leaf.count = n;
      P.wood.instanceMatrix.needsUpdate = P.leaf.instanceMatrix.needsUpdate = true; if (P.leaf.instanceColor) P.leaf.instanceColor.needsUpdate = true;
    }
  }
  _farMatrix(m, i) { const M = new THREE.Matrix4(); m.getMatrixAt(i, M); return M; }
}

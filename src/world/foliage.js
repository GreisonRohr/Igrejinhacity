// Vegetação e pedras naturais (piloto de qualidade da praça): folhas desenhadas com transparência em planos cruzados,
// colmos de bambu curvos com nós, pedras irregulares. Tudo instanciado (uma malha por tipo), cor e escala por instância.
// Reutilizável: buildFoliage(parent, { shrubs, bamboo, rocks, tufts }) com listas de posições.
import * as THREE from 'three';

const PI = Math.PI;
let seed = 17; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const canvasTex = (w, h, draw, srgb = true) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
};

/** Folhagem larga (arbusto): muitas folhas ovais em 3 tons, borda irregular, fundo transparente. */
const leafTex = () => canvasTex(256, 256, (g, w, h) => {
  seed = 23;
  for (let i = 0; i < 520; i++) {
    const a = rnd() * PI * 2, r = Math.sqrt(rnd()) * 112, x = w / 2 + Math.cos(a) * r, y = h * 0.55 + Math.sin(a) * r * 0.8;
    const v = rnd(), col = v < 0.3 ? '#2f5a24' : v < 0.7 ? '#43742f' : '#6a9a45';
    g.save(); g.translate(x, y); g.rotate(rnd() * PI * 2); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 5 + rnd() * 6, 2.5 + rnd() * 2.5, 0, 0, 7); g.fill();
    g.fillStyle = 'rgba(20,40,15,0.35)'; g.fillRect(-4, -0.4, 8, 0.8); g.restore();
  }
});
/** Folhas de bambu: lanças finas, verde-amarelado, em leque. */
const bambooLeafTex = () => canvasTex(128, 256, (g, w, h) => {
  seed = 31;
  for (let i = 0; i < 70; i++) {
    const x = w / 2 + (rnd() - 0.5) * 30, y = 20 + rnd() * (h - 40), a = (rnd() - 0.5) * 2.2, L = 22 + rnd() * 26;
    const v = rnd(); g.fillStyle = v < 0.4 ? '#4f7f2e' : v < 0.8 ? '#6f9a3a' : '#8db04e';
    g.save(); g.translate(x, y); g.rotate(a + PI / 2); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.5, 4, L, 0); g.quadraticCurveTo(L * 0.5, -3, 0, 0); g.fill(); g.restore();
  }
});
/** Tufo de grama: lâminas finas. */
const tuftTex = () => canvasTex(128, 128, (g, w, h) => {
  seed = 41;
  for (let i = 0; i < 90; i++) {
    const x = 10 + rnd() * (w - 20), L = 40 + rnd() * 70, bend = (rnd() - 0.5) * 30, v = rnd();
    g.strokeStyle = v < 0.4 ? '#4a7a2c' : v < 0.85 ? '#6a9640' : '#9ab05a'; g.lineWidth = 1.5 + rnd() * 1.5;
    g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + bend * 0.3, h - L * 0.6, x + bend, h - L); g.stroke();
  }
});
/** Colmo de bambu: verde com nós claros e manchas, ao longo da altura (v). */
const culmTex = () => canvasTex(16, 512, (g, w, h) => {
  const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#6f8a3c'); gr.addColorStop(0.5, '#7fa34a'); gr.addColorStop(1, '#8fb055'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let y = 6; y < h; y += 23) { g.fillStyle = 'rgba(230,225,170,0.7)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(40,50,20,0.35)'; g.fillRect(0, y + 2, w, 2); }
  for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(90,80,40,0.25)'; g.fillRect(0, (i * 53) % h, w, 6); }
});

/** Planos cruzados com folhas (3 verticais + 1 inclinado), base no chão, ~1 m. */
function crossCards(w, h, n = 3, tilt = true) {
  const parts = [];
  for (let i = 0; i < n; i++) { const p = new THREE.PlaneGeometry(w, h); p.translate(0, h / 2, 0); p.rotateY(i * PI / n + 0.2); parts.push(p); }
  if (tilt) { const p = new THREE.PlaneGeometry(w * 0.9, w * 0.9); p.rotateX(-PI / 2 + 0.35); p.translate(0, h * 0.78, 0); parts.push(p); }
  return merge(parts);
}
function merge(parts) {
  let n = 0; for (const p of parts) n += p.index.count;
  const pos = [], nor = [], uv = [];
  for (const p of parts) { const q = p.toNonIndexed(); pos.push(...q.attributes.position.array); nor.push(...q.attributes.normal.array); uv.push(...q.attributes.uv.array); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // normais apontando para cima/fora: folhagem iluminada como volume, não como placa
  const N = g.attributes.normal, P = g.attributes.position;
  for (let i = 0; i < N.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), l = Math.hypot(x, y * 0.6 + 0.4, z) || 1; N.setXYZ(i, x / l, (y * 0.6 + 0.4) / l, z / l); }
  return g;
}
/** Colmo de bambu de 8 m, afinando e curvando para fora no alto, com as folhas no terço superior. */
function bambooGeometry() {
  const culm = new THREE.CylinderGeometry(0.028, 0.05, 8, 6, 16, true).translate(0, 4, 0), P = culm.attributes.position;
  const bend = y => 0.55 * (y / 8) ** 2;
  for (let i = 0; i < P.count; i++) P.setX(i, P.getX(i) + bend(P.getY(i)));
  culm.computeVertexNormals();
  const leaves = [];
  for (let k = 0; k < 7; k++) {
    const y = 4.2 + k * 0.55, p = new THREE.PlaneGeometry(1.1, 1.6); p.rotateZ(PI / 2 * (k % 2 ? 1 : -1) * 0.6); p.rotateY(k * 2.1); p.translate(bend(y) + (k % 2 ? 0.35 : -0.35), y, (k % 3 - 1) * 0.3); leaves.push(p);
  }
  return { culm, leaves: merge(leaves) };
}
/** Pedra irregular: icosaedro com vértices deslocados de forma suave (mesma posição → mesmo deslocamento). */
function rockGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 2), P = g.attributes.position, cache = new Map();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let s = cache.get(k); if (s === undefined) { s = 0.78 + 0.22 * Math.sin(x * 3.1 + 1.7) * Math.cos(z * 2.3) + 0.12 * Math.sin(y * 5.7 + x); cache.set(k, s); }
    P.setXYZ(i, x * s, y * s * 0.62, z * s);
  }
  g.computeVertexNormals(); return g;
}
const rockTex = () => canvasTex(128, 128, (g, w, h) => {
  seed = 57; g.fillStyle = '#8a8478'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 500; i++) { const v = 105 + rnd() * 70; g.fillStyle = `rgba(${v},${v - 4},${v - 12},0.5)`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 4, 1 + rnd() * 3); }
  for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(70,90,50,0.25)'; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 14, 4 + rnd() * 8, rnd() * 3, 0, 7); g.fill(); }   // líquen
});

const alphaMat = (map, color = 0xffffff) => {
  const m = new THREE.MeshLambertMaterial({ map, color, alphaTest: 0.45, side: THREE.DoubleSide });
  return m;
};
const depthMat = map => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45 });

/** Monta as malhas instanciadas. Listas: shrubs [x,y,z,escala,tom], bamboo [x,y,z,escala,inclinação,rot],
 *  rocks [x,y,z,sx,sy,sz,rot,tom], tufts [x,y,z,escala,rot]. Devolve as malhas (para medir/ocultar). */
export function buildFoliage(parent, { shrubs = [], bamboo = [], rocks = [], tufts = [] }) {
  const d = new THREE.Object3D(), c = new THREE.Color(), out = [];
  const inst = (geo, mat, list, place, color, shadowMap = null) => {
    if (!list.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((q, i) => { place(d, q); d.updateMatrix(); im.setMatrixAt(i, d.matrix); if (color) im.setColorAt(i, color(c, q)); });
    im.castShadow = true; im.receiveShadow = true; if (shadowMap) im.customDepthMaterial = depthMat(shadowMap);
    im.computeBoundingSphere(); parent.add(im); out.push(im); return im;
  };
  const lt = leafTex(), bt = bambooLeafTex(), tt = tuftTex(), ct = culmTex(), rt = rockTex();
  ct.wrapT = THREE.RepeatWrapping; rt.wrapS = rt.wrapT = THREE.RepeatWrapping;
  inst(crossCards(1.3, 1.1), alphaMat(lt), shrubs, (o, [x, y, z, s, , r = 0]) => { o.position.set(x, y - 0.05, z); o.rotation.set(0, r, 0); o.scale.set(s, s * (0.8 + (r % 1) * 0.4), s); }, (cc, q) => cc.setHSL(0.27 + (q[4] - 0.5) * 0.06, 0.3, 0.78 + (q[4] - 0.5) * 0.16), lt);
  if (bamboo.length) {
    const { culm, leaves } = bambooGeometry();
    const place = (o, [x, y, z, s, tilt, r]) => { o.position.set(x, y - 0.1, z); o.rotation.set(tilt * 0.6, r, tilt); o.scale.setScalar(s); };
    inst(culm, new THREE.MeshLambertMaterial({ map: ct }), bamboo, place, (cc, q) => cc.setHSL(0.2, 0.2, 0.82 + q[4] * 0.2));
    inst(leaves, alphaMat(bt), bamboo, place, (cc, q) => cc.setHSL(0.25 + q[4] * 0.06, 0.3, 0.8), bt);
  }
  inst(rockGeometry(), new THREE.MeshLambertMaterial({ map: rt }), rocks, (o, [x, y, z, sx, sy, sz, r]) => { o.position.set(x, y, z); o.rotation.set(0, r, 0); o.scale.set(sx, sy, sz); }, (cc, q) => cc.setHSL(0.09, 0.06 + q[7] * 0.08, 0.78 + q[7] * 0.16));
  inst(crossCards(0.6, 0.45, 3, false), alphaMat(tt), tufts, (o, [x, y, z, s, r]) => { o.position.set(x, y - 0.03, z); o.rotation.set(0, r, 0); o.scale.setScalar(s); }, (cc, q) => cc.setHSL(0.25, 0.25, 0.8 + (q[4] % 1) * 0.12));
  return out;
}

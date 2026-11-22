// Av. Presidente Castelo Branco: no canteiro central, onde a faixa de pedestre atravessa, há uma "casinha"
// (pórtico enxaimel: dois esteios, telhado de telha bem inclinado, oitão de tábuas com treliça e floreira).
// Também as palmeiras em vaso do canteiro. Referência: fotos do diretor (Street View abr/2026, TripAdvisor).
import * as THREE from 'three';
import { Kit, lambert, tex, segClosest } from './landmarks3d.js';

const PI = Math.PI;
const AVENIDA = /Castelo Branco/;

/** Oitão (triângulo) de tábuas na cor da casinha, com mão-francesa, treliça e lambrequim recortado. */
function gableTexture(board, trim) {
  return tex(256, 256, (c, w, h) => {
    c.fillStyle = board; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = 2;
    for (let x = 6; x < w; x += 14) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }   // tábuas verticais
    c.strokeStyle = trim; c.lineWidth = 9;                                                            // enxaimel do oitão
    c.beginPath(); c.moveTo(w / 2, 38); c.lineTo(w / 2, h * 0.55); c.moveTo(w / 2, 70); c.lineTo(w * 0.3, h * 0.42); c.moveTo(w / 2, 70); c.lineTo(w * 0.7, h * 0.42); c.stroke();
    c.fillStyle = trim; c.fillRect(w / 2 - 26, h * 0.5, 52, 52);                                     // janelinha de treliça
    c.strokeStyle = board; c.lineWidth = 3;
    for (let k = -60; k < 60; k += 12) { c.beginPath(); c.moveTo(w / 2 - 26 + k, h * 0.5); c.lineTo(w / 2 + 26 + k, h * 0.5 + 52); c.moveTo(w / 2 + 26 - k, h * 0.5); c.lineTo(w / 2 - 26 - k, h * 0.5 + 52); c.stroke(); }
    c.fillStyle = board; c.fillRect(0, h * 0.5 - 2, w / 2 - 28, 4);
    // lambrequim (barra recortada em meia-lua) na base
    c.fillStyle = trim; c.fillRect(0, h - 34, w, 8);
    c.fillStyle = board; for (let x = 0; x < w; x += 22) { c.beginPath(); c.arc(x + 11, h - 26, 10, 0, PI); c.fill(); }
    c.clearRect(0, h - 4, w, 4);
  });
}

/** Faixa de telha cerâmica (fileiras com sombra entre as telhas). */
const tileTexture = () => tex(128, 128, (c, w, h) => {
  c.fillStyle = '#9c4430'; c.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 0 : 8; x < w; x += 16) {
    const g = c.createLinearGradient(x, y, x + 16, y); g.addColorStop(0, '#7a3222'); g.addColorStop(0.5, '#b8563b'); g.addColorStop(1, '#7a3222');
    c.fillStyle = g; c.fillRect(x, y, 15, 14);
  }
}, true);

export function buildAvenida(world, terrain, city, root) {
  const H = (x, z) => terrain.heightAt(x, z);
  const roads = world.roads.filter(r => r.n && AVENIDA.test(r.n) && r.ow && r.med && !r.br);
  if (!roads.length) return { colliders: [] };
  const colliders = [];
  /* ---------- casinhas nas faixas de pedestre ---------- */
  const portals = [];
  for (const zb of city.zebras || []) {
    if (!zb.dual || !AVENIDA.test(zb.name || '')) continue;
    // raio perpendicular para o lado do canteiro (esquerda do sentido do trânsito) até a outra pista
    const dx = zb.uz, dz = -zb.ux;
    let best = null;
    for (const q of roads) for (let i = 0; i < q.p.length - 1; i++) {
      const a = q.p[i], b = q.p[i + 1], ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex;
      if (Math.abs(den) < 1e-6) continue;
      const t = ((a[0] - zb.x) * ez - (a[1] - zb.z) * ex) / den, u = ((a[0] - zb.x) * dz - (a[1] - zb.z) * dx) / den;
      if (u < 0 || u > 1 || t < 2 * zb.half + 1 || t > 25) continue;
      if (!best || t < best.d) best = { d: t, p: [zb.x + dx * t, zb.z + dz * t] };
    }
    if (!best || best.d < 2 * zb.half + 1.5) continue;                    // sem canteiro de verdade aqui
    const mx = (zb.x + best.p[0]) / 2, mz = (zb.z + best.p[1]) / 2;
    if (portals.some(q => Math.hypot(q.x - mx, q.z - mz) < 12)) continue; // a mesma travessia vista da outra pista
    const cx = (best.p[0] - zb.x) / best.d, cz = (best.p[1] - zb.z) / best.d;  // direção da travessia
    // o pórtico precisa ficar na grama: longe do asfalto de todas as pistas da avenida
    let clear = Infinity; for (const q of roads) for (let j = 0; j < q.p.length - 1; j++) { const pp = segClosest(mx, mz, q.p[j], q.p[j + 1]); clear = Math.min(clear, Math.hypot(pp[0] - mx, pp[1] - mz)); }
    if (clear < zb.half + 0.9) continue;
    portals.push({ x: mx, z: mz, cx, cz, gap: best.d - 2 * zb.half });
  }
  const variants = [['#f2d66b', '#5a3422'], ['#f4f1e6', '#5e9bd0'], ['#f1e4b8', '#6b3a26']]
    .map(([b, t]) => new THREE.MeshLambertMaterial({ map: gableTexture(b, t), side: THREE.DoubleSide, alphaTest: 0.5, transparent: false }));
  const roofMat = new THREE.MeshLambertMaterial({ map: tileTexture() });
  roofMat.map.repeat.set(2, 2);
  const wood = lambert(0x4a2c1e), path = lambert(0xb7b2a8), flowerBox = lambert(0x3b2a1e), flower = lambert(0xd8283a), leafM = lambert(0x3f7f34);
  // oitão: triângulo com UV 0..1
  const W = 3.3, GH = 2.9, POST = 2.7;
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-W / 2, 0, 0, W / 2, 0, 0, 0, GH, 0], 3));
  tri.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
  const slopeL = Math.hypot(W / 2 + 0.25, GH + 0.2), slopeA = Math.atan2(GH + 0.2, W / 2 + 0.25);
  const slab = new THREE.BoxGeometry(slopeL, 0.09, 1.7);
  // telhado: a textura corre ao longo da água
  const roofGeo = slab.clone();
  portals.forEach((p, i) => {
    const y = Math.max(H(p.x, p.z), H(p.x + p.cx * 2, p.z + p.cz * 2), H(p.x - p.cx * 2, p.z - p.cz * 2)) + 0.15;
    const g = new THREE.Group(); g.position.set(p.x, y, p.z); g.rotation.y = Math.atan2(p.cx, p.cz); root.add(g);
    const k = new Kit();
    // caminho de lajotas atravessando o canteiro
    k.add(new THREE.BoxGeometry(2.2, 0.06, Math.max(2, p.gap + 0.4)), path, 0, 0.0, 0);
    for (const s of [-1, 1]) {
      k.add(new THREE.BoxGeometry(0.22, POST, 0.22), wood, s * 1.3, POST / 2, 0);
      k.add(new THREE.BoxGeometry(0.42, 0.25, 0.42), lambert(0xd8d4cc), s * 1.3, 0.12, 0);   // sapata de concreto
      k.add(new THREE.BoxGeometry(0.16, 0.16, 1.5), wood, s * 1.3, POST, 0);                // frechal
      // águas do telhado
      k.add(roofGeo, roofMat, s * (W / 4 + 0.06), POST + GH / 2 + 0.12, 0, 0, 0, -s * slopeA);
      // tábua de beiral escura acompanhando a água (frente e fundo)
      for (const f of [-1, 1]) k.add(new THREE.BoxGeometry(slopeL, 0.22, 0.05), wood, s * (W / 4 + 0.02), POST + GH / 2 + 0.02, f * 0.86, 0, 0, -s * slopeA);
    }
    k.add(new THREE.BoxGeometry(W + 0.2, 0.18, 0.16), wood, 0, POST + 0.05, 0.6);          // linha do oitão
    k.add(new THREE.BoxGeometry(W + 0.2, 0.18, 0.16), wood, 0, POST + 0.05, -0.6);
    const vm = variants[i % variants.length];
    for (const f of [-1, 1]) k.add(tri, vm, 0, POST + 0.1, f * 0.62, f > 0 ? 0 : PI);
    // floreira com gerânios na frente da janelinha (nos dois lados)
    for (const f of [-1, 1]) {
      k.add(new THREE.BoxGeometry(1.1, 0.18, 0.22), flowerBox, 0, POST + 1.15, f * 0.78);
      for (let j = 0; j < 7; j++) k.add(new THREE.IcosahedronGeometry(0.1, 0), j % 2 ? flower : leafM, -0.45 + j * 0.15, POST + 1.32, f * 0.8);
    }
    k.build(g);
    for (const s of [-1, 1]) { const px = p.x + Math.cos(g.rotation.y) * s * 1.3, pz = p.z - Math.sin(g.rotation.y) * s * 1.3; colliders.push({ circle: [px, pz, 0.22] }); }
  });

  /* ---------- palmeiras em vaso ao longo do canteiro ---------- */
  const pots = [];
  for (const r of roads) {
    if (r.p[0][1] < r.p[r.p.length - 1][1]) continue;                     // uma pista só (a que sobe para o norte)
    let acc = 0, next = 10;
    for (let i = 0; i < r.p.length - 1; i++) {
      const a = r.p[i], b = r.p[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (; next < acc + L; next += 26) {
        const t = (next - acc) / L, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        if (Math.hypot(x, z) > 900) continue;
        let best = null;
        for (const q of roads) { if (q === r) continue; for (let j = 0; j < q.p.length - 1; j++) { const p = segClosest(x, z, q.p[j], q.p[j + 1]), d = Math.hypot(p[0] - x, p[1] - z); if (!best || d < best.d) best = { d, p }; } }
        const half = Math.max(3.5, (r.w - r.med) / 2) / 2;
        if (!best || best.d < 2 * half + 2.2 || best.d > 2 * half + 12) continue;
        const mx = (x + best.p[0]) / 2, mz = (z + best.p[1]) / 2;
        if (portals.some(p => Math.hypot(p.x - mx, p.z - mz) < 9) || (city.zebras || []).some(zb => Math.hypot(zb.x - mx, zb.z - mz) < 9)) continue;
        pots.push([mx, mz]);
      }
      acc += L;
    }
  }
  if (pots.length) {
    const pot = new THREE.CylinderGeometry(0.5, 0.36, 0.75, 10).translate(0, 0.375, 0);
    const leaves = [];
    for (let s = 0; s < 6; s++) {
      const a = s / 6 * PI * 2, lean = 0.18 + (s % 2) * 0.1;
      const stem = new THREE.CylinderGeometry(0.035, 0.05, 2.2, 5).translate(0, 1.1, 0).rotateZ(lean).rotateY(a).translate(0, 0.7, 0);
      leaves.push(stem);
      for (let f = 0; f < 4; f++) {
        const fr = new THREE.ConeGeometry(0.22, 1.6, 4).rotateX(PI / 2).translate(0, 0, 0.8).scale(1, 0.25, 1).rotateX(0.5).rotateY(a + f * 1.57 + 0.3)
          .translate(Math.sin(a) * Math.sin(lean) * 2.2, 0.7 + Math.cos(lean) * 2.2, Math.cos(a) * Math.sin(lean) * 2.2);
        leaves.push(fr);
      }
    }
    const strip = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
    const palmG = mergeGeo(leaves.map(strip));
    const potM = new THREE.InstancedMesh(pot, lambert(0x8a5a36), pots.length), palmM = new THREE.InstancedMesh(palmG, lambert(0x4f8a3a), pots.length);
    const d = new THREE.Object3D();
    pots.forEach(([x, z], i) => { d.position.set(x, H(x, z) + 0.15, z); d.rotation.y = i * 1.7; d.scale.setScalar(0.9 + (i % 3) * 0.1); d.updateMatrix(); potM.setMatrixAt(i, d.matrix); palmM.setMatrixAt(i, d.matrix); colliders.push({ circle: [x, z, 0.5] }); });
    for (const m of [potM, palmM]) { m.castShadow = true; m.receiveShadow = true; m.computeBoundingSphere(); root.add(m); }
  }
  return { colliders, portals: portals.length, pots: pots.length };
}

function mergeGeo(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

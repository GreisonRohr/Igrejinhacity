// Mobiliário e infraestrutura urbana (upgrade visual, piloto do centro):
//  - abrigos de ônibus nas paradas reais do GEO Igrejinha (camada paradas_onibus, cidade toda)
//  - rede elétrica: fios entre os postes vizinhos (até PILOT_R da praça), com catenária
//  - lixeiras nas calçadas, junto a parte dos postes (piloto)
// Tudo instanciado ou numa malha só: 3 chamadas de desenho no total.
import * as THREE from 'three';
import { Kit, lambert } from './landmarks3d.js';
import { PILOT_R } from './city.js';

/** Trecho de rua mais próximo (grade de pisos da cidade): ponto no eixo, meia largura, calçada e direção. */
function nearestRoad(city, x, z) {
  let best = null;
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const sgm of city.surfBins?.get((Math.floor(x / 50) + di) + ',' + (Math.floor(z / 50) + dj)) || []) {
    const [ax, az, bx, bz, half, sl, sr] = sgm, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(x - qx, z - qz);
    if (!best || d < best.d) { const l = Math.sqrt(l2); best = { d, qx, qz, half, side: Math.max(sl, sr) || 1.5, ux: dx / l, uz: dz / l }; }
  }
  return best;
}
/** Geometria única (cores por vértice) de um Kit, para instanciar. */
function kitGeometry(fill) { const k = new Kit(); fill(k); const g = new THREE.Group(); k.build(g, false); return g.children[0].geometry; }
const VC = new THREE.MeshLambertMaterial({ vertexColors: true });

export function buildUrbano({ world, terrain, city, scene }) {
  const H = (x, z) => terrain.heightAt(x, z), d = new THREE.Object3D();
  const group = new THREE.Group(); scene.add(group);

  /* ---------- abrigos de ônibus (paradas do GEO) ---------- */
  const stops = [];
  for (const p of world.places) if (p.k === 'onibus') {
    const r = nearestRoad(city, p.x, p.z); if (!r || r.d > 25) continue;
    let nx = -r.uz, nz = r.ux; if ((p.x - r.qx) * nx + (p.z - r.qz) * nz < 0) { nx = -nx; nz = -nz; }   // lado da rua onde está a parada
    const o = r.half + Math.min(r.side, 3) - 0.8, x = r.qx + nx * o, z = r.qz + nz * o;
    if (city.blocked(x, z, 0.6)) continue;
    stops.push([x, H(x, z) + city.surfOffset(x, z), z, Math.atan2(-nx, -nz)]);   // frente (z local +) virada para a rua
  }
  if (stops.length) {
    const metal = lambert(0x5d646b), roof = lambert(0x9fa7ad), glass = lambert(0xa9c3cf), wood = lambert(0x8a6a48), sign = lambert(0x1f5fa8);
    const geo = kitGeometry(k => {
      for (const sx of [-1.6, 1.6]) k.box(0.08, 2.5, 0.08, metal, sx, 0, -0.55);
      for (const sx of [-1.6, 1.6]) k.box(0.08, 2.4, 0.08, metal, sx, 0, 0.45);
      k.add(new THREE.BoxGeometry(3.6, 0.08, 1.6), roof, 0, 2.5, -0.05, 0, -0.08);
      k.add(new THREE.BoxGeometry(3.1, 1.7, 0.03), glass, 0, 1.35, -0.6);                 // painel do fundo
      k.box(2.6, 0.06, 0.4, wood, 0, 0.45, -0.35); for (const sx of [-1.1, 1.1]) k.box(0.06, 0.45, 0.3, metal, sx, 0, -0.35);   // banco
      k.box(0.05, 2.6, 0.05, metal, 2.1, 0, 0.5); k.box(0.45, 0.3, 0.04, sign, 2.1, 2.3, 0.5);   // placa da parada
    });
    const im = new THREE.InstancedMesh(geo, VC, stops.length);
    stops.forEach(([x, y, z, ry], i) => { d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); city.addCollider([[x - 0.3, z - 0.3], [x + 0.3, z - 0.3], [x + 0.3, z + 0.3], [x - 0.3, z + 0.3]], x, z, -1); });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); group.add(im);
  }

  /* ---------- rede elétrica e lixeiras (piloto) ---------- */
  const lamps = (city.lampPos || []).filter(([x, , z]) => Math.hypot(x, z) < PILOT_R);
  const pos = [], seen = new Set();
  lamps.forEach(([x, y, z], i) => {
    let j = -1, bd = 46;
    lamps.forEach(([x2, , z2], k) => { if (k === i) return; const dd = Math.hypot(x2 - x, z2 - z); if (dd > 14 && dd < bd) { bd = dd; j = k; } });
    if (j < 0) return; const key = Math.min(i, j) + ':' + Math.max(i, j); if (seen.has(key)) return; seen.add(key);
    const [x2, y2, z2] = lamps[j];
    for (const [dh, lat] of [[7.35, 0], [7.0, 0.25], [6.65, -0.25]]) {          // três fios, levemente afastados
      const nx = -(z2 - z) / bd * lat, nz = (x2 - x) / bd * lat, sag = 0.25 + bd * 0.008, N = 8;
      for (let s = 0; s < N; s++) for (const t of [s / N, (s + 1) / N]) pos.push(x + (x2 - x) * t + nx, y + (y2 - y) * t + dh - sag * 4 * t * (1 - t), z + (z2 - z) * t + nz);
    }
  });
  if (pos.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeBoundingSphere();
    group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1c1d20 })));
  }
  const bins = lamps.filter((_, i) => i % 3 === 0).map(([x, y, z, yaw]) => { const bx = x + Math.cos(yaw) * 1.3, bz = z - Math.sin(yaw) * 1.3; return [bx, H(bx, bz) + city.surfOffset(bx, bz), bz, yaw]; })
    .filter(([x, , z]) => !city.blocked(x, z, 0.3));
  if (bins.length) {
    const geo = kitGeometry(k => {
      k.add(new THREE.CylinderGeometry(0.28, 0.24, 0.85, 10).translate(0, 0.43, 0), lambert(0x2f5d3a));
      k.add(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 10).translate(0, 0.88, 0), lambert(0x22452b));
      k.add(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 5).translate(0, 0.45, -0.3), lambert(0x55595e));
    });
    const im = new THREE.InstancedMesh(geo, VC, bins.length);
    bins.forEach(([x, y, z, ry], i) => { d.position.set(x, y, z); d.rotation.set(0, ry, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.receiveShadow = true; im.computeBoundingSphere(); group.add(im);
  }
  return { group, stops: stops.length, wires: pos.length / 6, bins: bins.length };
}

// Vida nas ruas: árvores nas calçadas (sibipirunas, ipês floridos, jerivás) e carros estacionados junto ao meio-fio.
// Tudo instanciado por célula de 800 m (poucas draw calls, corte por distância) e com colisão.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const CELL = 800;
const URBAN = new Set(['primary', 'secondary', 'tertiary', 'residential', 'living_street', 'unclassified']);
const STREET_TREES = new Set(['secondary', 'tertiary', 'residential', 'living_street']);
const PARK_ON = new Set(['tertiary', 'residential', 'living_street', 'secondary']);

function resample(p, step) {
  const out = [p[0]];
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i], [bx, bz] = p[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  return out;
}
const mergeAt = (parts) => mergeGeometries(parts.map(([g, x, y, z, rx = 0, sx = 1, sy = 1, sz = 1]) => { const q = (g.index ? g.toNonIndexed() : g.clone()); if (rx) q.rotateX(rx); q.scale(sx, sy, sz); q.translate(x, y, z); return q; }));

export function buildStreetLife(world, terrain, city, Q, extraCars = []) {
  const group = new THREE.Group();
  let seed = 1234; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // cruzamentos (vértices compartilhados por 3+ pontas de via)
  const deg = new Map(), key = q => Math.round(q[0] * 2) + ',' + Math.round(q[1] * 2);
  for (const r of world.roads) if (URBAN.has(r.k) || r.k === 'service') r.p.forEach((q, i) => deg.set(key(q), (deg.get(key(q)) || 0) + (i === 0 || i === r.p.length - 1 ? 1 : 2)));
  const nodes = []; for (const r of world.roads) for (const q of r.p) if ((deg.get(key(q)) || 0) >= 3) nodes.push(q);
  const nodeGrid = new Map(); for (const q of nodes) { const k = Math.floor(q[0] / 30) + ',' + Math.floor(q[1] / 30); (nodeGrid.get(k) || nodeGrid.set(k, []).get(k)).push(q); }
  const nearNode = (x, z, d) => { const i = Math.floor(x / 30), j = Math.floor(z / 30); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const q of nodeGrid.get((i + a) + ',' + (j + b)) || []) if (Math.hypot(q[0] - x, q[1] - z) < d) return true; return false; };
  const lampNear = (x, z) => city.lampPos.some(l => Math.abs(l[0] - x) < 3 && Math.abs(l[2] - z) < 3);
  const occupied = new Map(), okSpot = (x, z, r) => { const k = Math.floor(x / 10) + ',' + Math.floor(z / 10); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const kk = (Math.floor(x / 10) + a) + ',' + (Math.floor(z / 10) + b); for (const o of occupied.get(kk) || []) if (Math.hypot(o[0] - x, o[1] - z) < o[2] + r) return false; } (occupied.get(k) || occupied.set(k, []).get(k)).push([x, z, r]); return true; };
  const bridgeEnds = []; for (const r of world.roads) if (r.br) bridgeEnds.push(r.p[0], r.p[r.p.length - 1]);
  const nearBridge = (x, z) => bridgeEnds.some(q => Math.hypot(q[0] - x, q[1] - z) < 25);
  const townR = 2800;
  const trees = [], cars = [];
  for (const r of world.roads) {
    if (r.br || !URBAN.has(r.k) || r.pav === 'terra') continue;
    if (Math.min(...r.p.map(q => Math.hypot(q[0], q[1]))) > townR) continue;
    const dual = r.ow && r.med, width = dual ? Math.max(3.5, (r.w - r.med) / 2) : r.w, half = width / 2;
    const sw = r.sw || [2.2, 2.2];
    const pts = resample(r.p, 2);
    let acc = 0, nextTree = [6 + rnd() * 8, 10 + rnd() * 8], nextCar = [4 + rnd() * 10, 8 + rnd() * 10];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
      acc += L;
      for (const [si, s] of [[0, 1], [1, -1]]) {
        if (dual && s < 0) continue;   // pista dupla: só o lado de fora (à direita do sentido do trânsito)
        // árvore na borda externa da calçada
        if (STREET_TREES.has(r.k) && acc >= nextTree[si] && sw[si] >= 1.8) {
          nextTree[si] = acc + 11 + rnd() * 12;
          const off = half + sw[si] - 0.55, x = ax + nx * s * off, z = az + nz * s * off;
          if (!nearNode(x, z, 11) && !nearBridge(x, z) && !lampNear(x, z) && !city.blocked(x, z, 1.2) && rnd() < 0.8 && okSpot(x, z, 3)) {
            const t = rnd(), kind = t < 0.12 ? 'palm' : t < 0.24 ? 'ipe' : t < 0.3 ? 'ipeA' : 'leafy';
            trees.push({ x, z, y: terrain.heightAt(x, z) + 0.15, kind, s: 0.75 + rnd() * 0.5, rot: rnd() * 6.28 });
          }
        }
        // carro estacionado junto ao meio-fio
        if (PARK_ON.has(r.k) && width >= 7 && acc >= nextCar[si]) {
          nextCar[si] = acc + 6 + rnd() * 16;
          const off = half - 1.15, x = ax + nx * s * off, z = az + nz * s * off;
          if (rnd() < 0.55 && !nearNode(x, z, 14) && !nearBridge(x, z) && okSpot(x, z, 2.6)) {
            const yaw = Math.atan2(ux * s, uz * s);
            cars.push({ x, z, y: terrain.heightAt(x, z) + 0.08, yaw, c: rnd() });
          }
        }
      }
    }
  }

  // vagas extras (estacionamento em ângulo sob a Rua Coberta etc.)
  for (const c of extraCars) cars.push({ x: c.x, z: c.z, y: terrain.heightAt(c.x, c.z) + 0.08, yaw: c.yaw, c: rnd() });
  // geometrias
  const trunk = new THREE.CylinderGeometry(0.16, 0.26, 3.2, 6).translate(0, 1.6, 0);
  const crownLeafy = mergeAt([[new THREE.IcosahedronGeometry(2.6, 0), 0, 5.2, 0, 0, 1.25, 0.72, 1.25], [new THREE.IcosahedronGeometry(1.8, 0), 1.4, 4.6, 0.6, 0, 1.1, 0.7, 1.0], [new THREE.IcosahedronGeometry(1.7, 0), -1.3, 4.8, -0.5, 0, 1.0, 0.75, 1.1]]);
  const palmTrunk = new THREE.CylinderGeometry(0.14, 0.22, 7.5, 6).translate(0, 3.75, 0);
  const frond = new THREE.ConeGeometry(0.45, 3.6, 4).rotateX(Math.PI / 2).translate(0, 0, 1.8);
  const palmCrown = mergeGeometries(Array.from({ length: 8 }, (_, i) => { const f = frond.clone(); f.rotateX(0.55); f.rotateY(i / 8 * Math.PI * 2); f.scale(1, 0.35, 1); f.translate(0, 7.4, 0); return f; }));
  // carro: carroceria (cor por instância), vidros e rodas
  const body = mergeAt([[new THREE.BoxGeometry(1.75, 0.6, 4.1), 0, 0.62, 0], [new THREE.BoxGeometry(1.7, 0.18, 1.0), 0, 0.98, 1.45], [new THREE.BoxGeometry(1.7, 0.18, 0.8), 0, 0.98, -1.55]]);
  const glass = mergeAt([[new THREE.BoxGeometry(1.55, 0.55, 2.1), 0, 1.2, -0.15]]);
  const wheels = mergeAt([[new THREE.CylinderGeometry(0.33, 0.33, 0.24, 7).rotateZ(Math.PI / 2), 0.82, 0.33, 1.3], [new THREE.CylinderGeometry(0.33, 0.33, 0.24, 7).rotateZ(Math.PI / 2), -0.82, 0.33, 1.3],
    [new THREE.CylinderGeometry(0.33, 0.33, 0.24, 7).rotateZ(Math.PI / 2), 0.82, 0.33, -1.3], [new THREE.CylinderGeometry(0.33, 0.33, 0.24, 7).rotateZ(Math.PI / 2), -0.82, 0.33, -1.3]]);
  const M = {
    bark: new THREE.MeshLambertMaterial({ color: 0x6a5040 }), leaf: new THREE.MeshLambertMaterial({ color: 0xffffff }),
    paint: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.05 }), glass: new THREE.MeshStandardMaterial({ color: 0x2a3540, roughness: 0.2, metalness: 0 }),
    tyre: new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
  };
  const LEAF = { leafy: [0x4d7a35, 0x5a8a3c, 0x3f6e30, 0x6a8f3e], ipe: [0xd9569b, 0xe070b0, 0xc44a8a], ipeA: [0xf2c12e, 0xe8b020], palm: [0x5d8a3a] };
  const PAINT = [0xf2f2f2, 0xd9d9d9, 0x8c8f94, 0x2b2d31, 0x1d1f22, 0xb02a2a, 0x2a4f8a, 0xc9c1b0, 0x5a6b5a];
  const col = new THREE.Color(), d = new THREE.Object3D();
  const cells = new Map();
  const cellOf = (x, z) => { const k = Math.floor(x / CELL) + ',' + Math.floor(z / CELL); let c = cells.get(k); if (!c) cells.set(k, c = { cx: (Math.floor(x / CELL) + 0.5) * CELL, cz: (Math.floor(z / CELL) + 0.5) * CELL, trees: [], cars: [], meshes: [] }); return c; };
  for (const t of trees) { cellOf(t.x, t.z).trees.push(t); t.far = []; const a = LEAF[t.kind]; t.color = a[Math.floor((t.rot * 10) % a.length)]; }
  for (const c of cars) cellOf(c.x, c.z).cars.push(c);
  const inst = (cell, geo, mat, list, place, color, shadow = true) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((o, i) => { place(d, o); d.updateMatrix(); im.setMatrixAt(i, d.matrix); if (color) im.setColorAt(i, col.set(color(o))); if (o.far) o.far.push([im, i]); });
    im.computeBoundingSphere(); im.castShadow = shadow; im.receiveShadow = true;
    group.add(im); cell.meshes.push(im);
  };
  for (const cell of cells.values()) {
    const round = cell.trees.filter(t => t.kind !== 'palm'), palms = cell.trees.filter(t => t.kind === 'palm');
    inst(cell, trunk, M.bark, round, (d, t) => { d.position.set(t.x, t.y, t.z); d.rotation.set(0, t.rot, 0); d.scale.setScalar(t.s); });
    inst(cell, crownLeafy, M.leaf, round, (d, t) => { d.position.set(t.x, t.y, t.z); d.rotation.set(0, t.rot, 0); d.scale.setScalar(t.s); }, t => t.color);
    inst(cell, palmTrunk, M.bark, palms, (d, t) => { d.position.set(t.x, t.y, t.z); d.rotation.set(0.04, t.rot, 0); d.scale.setScalar(t.s); });
    inst(cell, palmCrown, M.leaf, palms, (d, t) => { d.position.set(t.x, t.y, t.z); d.rotation.set(0.04, t.rot, 0); d.scale.setScalar(t.s); }, () => LEAF.palm[0]);
    const place = (d, c) => { d.position.set(c.x, c.y, c.z); d.rotation.set(0, c.yaw, 0); d.scale.setScalar(1); };
    inst(cell, body, M.paint, cell.cars, place, c => PAINT[Math.floor(c.c * PAINT.length)]);
    inst(cell, glass, M.glass, cell.cars, place, null, false);
    inst(cell, wheels, M.tyre, cell.cars, place, null, false);
  }
  // colisão: tronco e carro
  for (const t of trees) { city._top = t.y + 3; const r = 0.3; city.addCollider([[t.x - r, t.z - r], [t.x + r, t.z - r], [t.x + r, t.z + r], [t.x - r, t.z + r]], t.x, t.z, -1); }
  for (const c of cars) {
    city._top = c.y + 1.5; const s = Math.sin(c.yaw), co = Math.cos(c.yaw), P = (a, b) => [c.x + a * co + b * s, c.z - a * s + b * co];
    city.addCollider([P(-0.9, -2.05), P(0.9, -2.05), P(0.9, 2.05), P(-0.9, 2.05)], c.x, c.z, -1);
  }
  const dist = Math.min(1100, Q.buildDist * 0.4);
  return {
    group, trees, counts: { arvores: trees.length, carros: cars.length, celulas: cells.size },
    update(px, pz) { for (const c of cells.values()) { const v = Math.hypot(px - c.cx, pz - c.cz) < dist + CELL * 0.7; for (const m of c.meshes) m.visible = v; } },
  };
}

// Mobiliário e infraestrutura urbana (upgrade visual, piloto do centro):
//  - abrigos de ônibus nas paradas reais do GEO Igrejinha (camada paradas_onibus, cidade toda)
//  - rede elétrica: fios entre os postes vizinhos (até PILOT_R da praça), com catenária
//  - lixeiras nas calçadas, junto a parte dos postes (piloto)
// Tudo instanciado ou numa malha só: 3 chamadas de desenho no total.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  /* ---------- placas com o nome das ruas nas esquinas (piloto) ---------- */
  // nós compartilhados por ruas de nomes diferentes (dados do mapa); a placa vai na esquina, sobre a calçada
  const nodes = new Map(), K = (x, z) => Math.round(x * 2) + ',' + Math.round(z * 2);
  for (const r of world.roads) {
    if (!r.n || /^(path|footway|steps|cycleway|track|service)$/.test(r.k)) continue;
    r.p.forEach((q, i) => {
      if (Math.hypot(q[0], q[1]) > PILOT_R) return;
      const nb = [r.p[i - 1], r.p[i + 1]].filter(Boolean);
      for (const o of nb) { const L = Math.hypot(o[0] - q[0], o[1] - q[1]) || 1; const k = K(q[0], q[1]); if (!nodes.has(k)) nodes.set(k, { x: q[0], z: q[1], arms: [] }); nodes.get(k).arms.push({ n: r.n, dx: (o[0] - q[0]) / L, dz: (o[1] - q[1]) / L, w: r.w || 8 }); }
    });
  }
  const signs = [], names = [];
  for (const nd of nodes.values()) {
    const byName = new Map(); for (const a2 of nd.arms) if (!byName.has(a2.n)) byName.set(a2.n, a2);
    if (byName.size < 2) continue;
    const [A1, A2] = [...byName.values()];
    let cx = A1.dx + A2.dx, cz = A1.dz + A2.dz, cl = Math.hypot(cx, cz); if (cl < 0.2) { cx = -A1.dz; cz = A1.dx; cl = 1; }
    const off = Math.max(A1.w, A2.w) / 2 + 1.6, x = nd.x + cx / cl * off, z = nd.z + cz / cl * off;
    if (city.blocked(x, z, 0.4) || city.surfOffset(x, z) < 0.2) continue;                     // só sobre a calçada, fora de prédios
    if (signs.some(s2 => Math.hypot(s2.x - x, s2.z - z) < 12)) continue;
    for (const a2 of [A1, A2]) if (!names.includes(a2.n)) names.push(a2.n);
    signs.push({ x, z, y: H(x, z) + city.surfOffset(x, z), A1, A2 });
  }
  if (signs.length && names.length) {
    const RH = 48, rows = Math.min(names.length, 80), cv = document.createElement('canvas'); cv.width = 512; cv.height = RH * (rows + 1);
    const g = cv.getContext('2d'); g.fillStyle = '#8d9196'; g.fillRect(0, 0, 512, RH);       // linha 0: cinza do poste
    names.slice(0, rows).forEach((n, i) => { const y = RH * (i + 1); g.fillStyle = '#1d4fa0'; g.fillRect(0, y, 512, RH); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(4, y + 4, 504, RH - 8);
      let fs = 26; g.font = `bold ${fs}px sans-serif`; const txt = n.replace(/^Rua /, 'R. ').replace(/^Avenida /, 'Av. ').toUpperCase(); while (g.measureText(txt).width > 480 && fs > 12) g.font = `bold ${--fs}px sans-serif`;
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 256, y + RH / 2 + 1); });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const parts = [], R = rows + 1;
    const plane = (w, h, row, x, y, z, ry) => { const pg = new THREE.PlaneGeometry(w, h), uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - (row + 1 - uv.getY(i)) / R); pg.rotateY(ry); pg.translate(x, y, z); return pg; };
    for (const sg of signs) {
      const pole = new THREE.CylinderGeometry(0.04, 0.04, 2.9, 6), uv = pole.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 1 - 0.5 / R);
      pole.translate(sg.x, sg.y + 1.45, sg.z); parts.push(pole);
      [sg.A1, sg.A2].forEach((a2, j) => {
        const row = names.indexOf(a2.n) + 1; if (row < 1 || row > rows) return;
        const ry = Math.atan2(a2.dx, a2.dz) + Math.PI / 2, y = sg.y + 2.65 - j * 0.3;      // placa paralela à rua
        parts.push(plane(1.1, 0.2, row, sg.x, y, sg.z, ry), plane(1.1, 0.2, row, sg.x, y, sg.z, ry + Math.PI));
      });
    }
    const nonIdx = parts.map(q => q.toNonIndexed());
    for (const q of nonIdx) for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k);
    const geo = mergeGeometries(nonIdx); geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex })); m.castShadow = false; group.add(m);
    for (const sg of signs) city.addCollider([[sg.x - 0.08, sg.z - 0.08], [sg.x + 0.08, sg.z - 0.08], [sg.x + 0.08, sg.z + 0.08], [sg.x - 0.08, sg.z + 0.08]], sg.x, sg.z, -1);
  }
  /* ---------- centro (C5, fotos Street View abr/2026) ---------- */
  let centroItens = 0;
  {
    const k = new Kit(), stone = lambert(0x8f8577), yellow = lambert(0xe9b828), soil = lambert(0x5a4632), conc = lambert(0xb9b6ae), wood = lambert(0x9a6b3f), metal = lambert(0x3a3d42);
    const green = lambert(0x4f7d34), purple = lambert(0x6b2a5a), pink = lambert(0xd9569b), red = lambert(0xc8322b), white = lambert(0xf2eee6);
    const col = (x, z, r) => { const p = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; p.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); } city.addCollider(p, x, z, -1); };
    // rotatória da Av. Pres. Castelo Branco × R. João Corrêa: base de pedra em cone, anel amarelo e floreira
    const R = [-55.0, 47.0], y0 = H(R[0], R[1]) + 0.08;
    k.add(new THREE.CylinderGeometry(1.25, 1.85, 0.4, 20), stone, R[0], y0 + 0.2, R[1]);
    k.add(new THREE.CylinderGeometry(1.05, 1.0, 0.42, 20), yellow, R[0], y0 + 0.6, R[1]);
    k.add(new THREE.CylinderGeometry(0.98, 0.98, 0.06, 20), soil, R[0], y0 + 0.8, R[1]);
    for (let i = 0; i < 14; i++) { const a = i * 2.39, r = 0.25 + (i % 4) * 0.18, x = R[0] + Math.cos(a) * r, z = R[1] + Math.sin(a) * r;
      k.add(new THREE.IcosahedronGeometry(0.24, 0), i % 3 === 0 ? pink : i % 3 === 1 ? green : red, x, y0 + 0.95, z, a, 0, 0, 1, 0.7, 1); }
    col(R[0], R[1], 1.7); centroItens++;
    // praçinha da calçada da R. João Corrêa (697): floreiras de concreto com folhagem roxa e bancos de madeira
    const r = nearestRoad(city, -28, 62);
    if (r && r.d < 20) {
      let nx = -r.uz, nz = r.ux; if ((-28 - r.qx) * nx + (62 - r.qz) * nz < 0) { nx = -nx; nz = -nz; }
      const off = r.half + Math.min(r.side, 3) - 0.7, ry = Math.atan2(r.ux, r.uz);
      for (let i = -1; i <= 1; i++) {
        const x = r.qx + nx * off + r.ux * i * 5.5, z = r.qz + nz * off + r.uz * i * 5.5, y = H(x, z) + city.surfOffset(x, z);
        if (city.blocked(x, z, 0.25)) continue;
        k.add(new THREE.BoxGeometry(2.2, 0.6, 0.75), conc, x, y + 0.3, z, ry);
        for (let j = 0; j < 6; j++) { const t = (j - 2.5) / 2.5 * 0.85; k.add(new THREE.IcosahedronGeometry(0.32, 0), j % 2 ? purple : lambert(0x7d3468), x + r.ux * t, y + 0.72, z + r.uz * t, j, 0, 0, 1, 0.6, 0.9); }
        const p = []; for (const [a, b] of [[-1.1, -0.4], [1.1, -0.4], [1.1, 0.4], [-1.1, 0.4]]) p.push([x + r.ux * a + nx * b, z + r.uz * a + nz * b]); city.addCollider(p, x, z, -1);
        if (i < 1) { const bx = x + r.ux * 2.75, bz = z + r.uz * 2.75;   // banco entre as floreiras
          k.add(new THREE.BoxGeometry(1.6, 0.06, 0.45), wood, bx, y + 0.45, bz, ry); k.add(new THREE.BoxGeometry(1.6, 0.35, 0.05), wood, bx - nx * 0.22, y + 0.68, bz - nz * 0.22, ry);
          for (const s of [-0.65, 0.65]) k.add(new THREE.BoxGeometry(0.06, 0.45, 0.42), metal, bx + r.ux * s, y + 0.22, bz + r.uz * s, ry); }
        centroItens++;
      }
    }
    k.build(group);
  }
  return { group, centroItens, stops: stops.length, wires: pos.length / 6, bins: bins.length, streetSigns: signs.length, streetNames: names.length };
}

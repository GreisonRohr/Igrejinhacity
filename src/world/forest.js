// Mata real: copas detectadas na imagem aérea da Prefeitura fora das árvores urbanas (scripts/build-trees.py →
// public/data/forest.data.json). Uma copa simples (20 triângulos) por árvore, sem sombra, em células de 400 m
// visíveis até ~1,2 km: dá volume aos morros e matas ciliares sem pesar no celular.
import * as THREE from 'three';

const CELL = 400;
export function buildForest(list, terrain, scene, { dist = 1200 } = {}) {
  const geo = new THREE.IcosahedronGeometry(1, 0).scale(1, 0.85, 1).translate(0, 0.6, 0);
  const leaf = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const cells = new Map(), group = new THREE.Group(); scene.add(group);
  for (const t of list) { const k = Math.floor(t[0] / CELL) + ',' + Math.floor(t[1] / CELL); (cells.get(k) || cells.set(k, []).get(k)).push(t); }
  const d = new THREE.Object3D(), c = new THREE.Color(), GREENS = [0x355a2a, 0x3f6630, 0x2f5226, 0x4a6e34];
  const out = [];
  for (const [k, ts] of cells) {
    const crowns = new THREE.InstancedMesh(geo, leaf, ts.length);   // sem tronco: na mata ele não aparece (e economiza draw calls)
    ts.forEach(([x, z, r], i) => {
      const y = terrain.heightAt(x, z), h = r * 1.5 + 2;
      d.position.set(x, y + h * 0.35, z); d.scale.set(r * 1.2, h * 0.55, r * 1.2);   // copa até o chão (mata fechada) d.rotation.set(0, (x * 7 + z) % 6.28, 0); d.updateMatrix(); crowns.setMatrixAt(i, d.matrix);
      crowns.setColorAt(i, c.setHex(GREENS[(Math.abs(Math.round(x + z))) % 4]));
    });
    for (const m of [crowns]) { m.computeBoundingSphere(); m.castShadow = false; m.receiveShadow = false; group.add(m); }
    const [i, j] = k.split(',').map(Number);
    out.push({ cx: (i + 0.5) * CELL, cz: (j + 0.5) * CELL, meshes: [crowns] });
  }
  return {
    group, count: list.length,
    update(px, pz) { for (const o of out) { const v = Math.hypot(px - o.cx, pz - o.cz) - CELL * 0.7 < dist; for (const m of o.meshes) m.visible = v; } },
  };
}

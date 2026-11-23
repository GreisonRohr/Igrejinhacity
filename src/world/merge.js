// Otimizações de cena: junta malhas estáticas por material e por região (menos draw calls, corte por distância)
// e libera a cópia CPU das geometrias depois que a GPU as recebeu (menos memória).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Depois do primeiro envio à GPU, descarta os arrays de vértices em memória (a GPU guarda a cópia dela). */
export function freeAfterUpload(geometry) {
  if (globalThis.__keepGeo) return;   // ?keepgeo: mantém os vértices (testes que medem a geometria, ex.: piso da praça)
  const free = function () { this.array = null; };
  for (const k in geometry.attributes) geometry.attributes[k].onUpload(free);
  if (geometry.index) geometry.index.onUpload(free);
}

/**
 * Junta todas as malhas estáticas abaixo de `root` por (material, célula de `cell` metros).
 * Ficam de fora: InstancedMesh, Sprite e qualquer coisa sob um nó com userData.dynamic.
 * Devolve as células (para cortar por distância).
 */
export function mergeStatic(root, cell = 250) {
  root.updateMatrixWorld(true);
  const buckets = new Map(), remove = [];
  const visit = (o, dynamic) => {
    dynamic = dynamic || o.userData.dynamic;
    if (o.isMesh && !o.isInstancedMesh && !dynamic && !Array.isArray(o.material)) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      const keep = o.material.vertexColors ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];   // cor por vértice (Kit)
      for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(o.matrixWorld);
      g.computeBoundingSphere();
      const c = g.boundingSphere.center;
      const key = o.material.uuid + '|' + Math.floor(c.x / cell) + ',' + Math.floor(c.z / cell) + '|' + (o.castShadow ? 1 : 0);
      let b = buckets.get(key); if (!b) buckets.set(key, b = { mat: o.material, geos: [], shadow: o.castShadow, cx: (Math.floor(c.x / cell) + 0.5) * cell, cz: (Math.floor(c.z / cell) + 0.5) * cell });
      b.geos.push(g); remove.push(o);
      return;
    }
    for (const ch of o.children) visit(ch, dynamic);
  };
  visit(root, false);
  for (const o of remove) o.parent.remove(o);
  const cells = new Map();
  for (const b of buckets.values()) {
    const g = mergeGeometries(b.geos); for (const q of b.geos) q.dispose();
    if (!g) continue;
    g.computeBoundingSphere();
    freeAfterUpload(g);
    const m = new THREE.Mesh(g, b.mat);
    // sombra só quando a peça tem volume: placas e plaquinhas (≤ 36 vértices, até uma caixa) não fazem sombra visível
    // e cada malha com sombra é desenhada de novo no mapa de sombras
    m.castShadow = b.shadow && !b.mat.transparent && g.attributes.position.count > 36; m.receiveShadow = true; m.matrixAutoUpdate = false;
    if (b.mat.transparent) m.renderOrder = 2;
    root.add(m);
    const ck = b.cx + ',' + b.cz; let c = cells.get(ck); if (!c) cells.set(ck, c = { cx: b.cx, cz: b.cz, meshes: [] });
    c.meshes.push(m);
  }
  return [...cells.values()];
}

// Carros estacionados perto do jogador com o modelo 3D real (Kenney Car Kit, CC0); longe ficam os simplificados do
// streetlife. Uma malha instanciada por modelo (carroceria + rodas fundidas numa geometria): no máximo 9 chamadas de
// desenho e N carros. A cada 0,4 s escolhe os mais próximos (até `cap`, dentro de `radius`).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildModelCar } from './vehicle.js';

export class ParkedLOD {
  constructor(scene, models, names, street, { cap = 32, radius = 60 } = {}) {
    this.street = street; this.cap = cap; this.radius = radius; this.names = names; this.t = 0; this.shown = new Set(); this.skip = new Set();
    this.pools = names.map(n => {
      const M = buildModelCar(models[n], n); M.group.updateMatrixWorld(true);
      const geos = []; let map = null;
      M.group.traverse(o => { if (o.isMesh) { const g = o.geometry.clone().applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); geos.push(g.index ? g.toNonIndexed() : g); map ||= o.material.map; } });
      const im = new THREE.InstancedMesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ map, roughness: 0.42, metalness: 0.15 }), cap);
      im.count = 0; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.userData.dynamic = true; scene.add(im);
      return { name: n, im };
    });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1);
    this.hide = null;   // (car, hidden) => void — esconde/mostra o carro simplificado (main.js)
  }
  modelOf(c) { return this.pools[Math.floor(c.c * 7 % 1 * this.pools.length)]; }
  update(dt, px, pz) {
    if ((this.t -= dt) > 0) return; this.t = 0.4;
    const R = this.radius, near = [];
    for (const c of this.street.cars) { if (this.skip.has(c)) continue; const d = Math.hypot(c.x - px, c.z - pz); if (d < R) near.push([d, c]); }
    near.sort((a, b) => a[0] - b[0]);
    const want = new Set(near.slice(0, this.cap).map(n => n[1]));
    for (const c of this.shown) if (!want.has(c)) { this.hide?.(c, false); this.shown.delete(c); }
    for (const c of want) if (!this.shown.has(c)) { this.hide?.(c, true); this.shown.add(c); }
    for (const P of this.pools) P.im.count = 0;
    for (const c of this.shown) {
      const P = this.modelOf(c); this._e.set(0, c.yaw, 0); this._q.setFromEuler(this._e); this._v.set(c.x, c.y - 0.05, c.z);
      this._m.compose(this._v, this._q, this._s); P.im.setMatrixAt(P.im.count++, this._m);
    }
    for (const P of this.pools) { P.im.instanceMatrix.needsUpdate = true; P.im.computeBoundingSphere(); }
  }
}

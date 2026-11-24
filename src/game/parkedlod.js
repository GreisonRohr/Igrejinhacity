// Carros estacionados perto do jogador com o modelo 3D real (nível leve "lod1" do mesmo arquivo do carro dirigível);
// longe ficam os simplificados do streetlife. Uma InstancedMesh por material de cada modelo (a pintura recebe a cor
// por instância): poucas chamadas de desenho para N carros. A cada 0,4 s escolhe os mais próximos (até `cap`).
import * as THREE from 'three';
import { REAL_PAINT } from './vehicle.js';

export class ParkedLOD {
  constructor(scene, models, names, street, { cap = 14, radius = 50 } = {}) {
    this.street = street; this.cap = cap; this.radius = radius; this.names = names; this.t = 0; this.shown = new Set(); this.skip = new Set();
    this.pools = names.map(n => {
      const lod = models[n].getObjectByName('lod1'); lod.updateMatrixWorld(true);
      const ims = [];
      lod.traverse(o => {
        if (!o.isMesh) return;
        const im = new THREE.InstancedMesh(o.geometry, o.material, cap);   // geometria e material do próprio arquivo
        im.count = 0; im.castShadow = o.material.name === 'paint';   // sombra só da lataria (silhueta) — economiza o passe de sombra
         im.receiveShadow = true; im.frustumCulled = false; im.userData.dynamic = true;
        im.userData.paint = o.material.name === 'paint';
        if (im.userData.paint) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
        scene.add(im); ims.push(im);
      });
      return { name: n, ims, n: 0 };
    });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._c = new THREE.Color();
    this.hide = null;   // (car, hidden) => void — esconde/mostra o carro simplificado (main.js)
  }
  modelOf(c) { return this.pools[Math.floor(c.c * 7 % 1 * this.pools.length)]; }
  colorOf(c) { return REAL_PAINT[Math.floor(c.c * 13 % 1 * REAL_PAINT.length)]; }
  update(dt, px, pz) {
    if ((this.t -= dt) > 0) return; this.t = 0.4;
    const R = this.radius, near = [];
    for (const c of this.street.cars) { if (this.skip.has(c)) continue; const d = Math.hypot(c.x - px, c.z - pz); if (d < R) near.push([d, c]); }
    near.sort((a, b) => a[0] - b[0]);
    const want = new Set(near.slice(0, this.cap).map(n => n[1]));
    for (const c of this.shown) if (!want.has(c)) { this.hide?.(c, false); this.shown.delete(c); }
    for (const c of want) if (!this.shown.has(c)) { this.hide?.(c, true); this.shown.add(c); }
    for (const P of this.pools) P.n = 0;
    for (const c of this.shown) {
      const P = this.modelOf(c), i = P.n++;
      this._e.set(0, c.yaw, 0); this._q.setFromEuler(this._e); this._v.set(c.x, c.y - 0.05, c.z);
      this._m.compose(this._v, this._q, this._s); this._c.setHex(this.colorOf(c));
      for (const im of P.ims) { im.setMatrixAt(i, this._m); if (im.userData.paint) im.setColorAt(i, this._c); }
    }
    for (const P of this.pools) for (const im of P.ims) { im.count = P.n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
}

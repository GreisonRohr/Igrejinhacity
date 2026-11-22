// Jogador a pé: movimento relativo à câmera, andar e correr, bonequinho com pernas animadas.
import * as THREE from 'three';

const L = c => new THREE.MeshLambertMaterial({ color: c });

export function makePerson(shirt) {
  const g = new THREE.Group();
  const legG = new THREE.BoxGeometry(0.28, 0.9, 0.28).translate(0, -0.45, 0);
  const legM = L(0x2d3340);
  const l1 = new THREE.Mesh(legG, legM); l1.position.set(-0.18, 0.9, 0);
  const l2 = new THREE.Mesh(legG, legM); l2.position.set(0.18, 0.9, 0);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.8, 0.42), L(shirt)); body.position.y = 1.3;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), L(0xe2b48c)); head.position.y = 1.95;
  for (const m of [l1, l2, body, head]) { m.castShadow = true; g.add(m); }
  g.userData = { legs: [l1, l2], ph: 0 };
  return g;
}

export class Walker {
  constructor(scene, terrain, x, z) {
    this.terrain = terrain;
    this.x = x; this.z = z; this.ang = 0; this.speed = 0;
    this.mesh = makePerson(0x1d4e9e);
    scene.add(this.mesh);
    this.blocked = () => false;          // substituído quando houver colisão com prédios
  }

  get y() { return this.terrain.heightAt(this.x, this.z); }

  update(dt, { f, t, run }, camYaw) {
    const mag = Math.min(1, Math.hypot(f, t));
    const target = mag * (run ? 9 : 4.5);
    this.speed += (target - this.speed) * Math.min(1, dt * 8);
    if (mag > 0.05) {
      // direção desejada no mundo, relativa à câmera
      const want = camYaw + Math.atan2(-t, f);
      let d = want - this.ang; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.ang += d * Math.min(1, dt * 10);
    }
    if (this.speed > 0.01) {
      // ladeira: sobe mais devagar
      const sx = Math.sin(this.ang), sz = Math.cos(this.ang);
      const slope = (this.terrain.heightAt(this.x + sx, this.z + sz) - this.y);
      const v = this.speed * (slope > 0 ? Math.max(0.45, 1 - slope * 0.9) : 1);
      const nx = this.x + sx * v * dt, nz = this.z + sz * v * dt;
      if (this.terrain.inside(nx, this.z, 5) && !this.blocked(nx, this.z, 0.45)) this.x = nx;
      if (this.terrain.inside(this.x, nz, 5) && !this.blocked(this.x, nz, 0.45)) this.z = nz;
    }
    const m = this.mesh;
    m.position.set(this.x, this.y, this.z);
    m.rotation.y = this.ang;
    m.userData.ph += dt * this.speed * 1.7;
    const sw = this.speed > 0.2 ? Math.sin(m.userData.ph) * 0.7 : 0;
    m.userData.legs[0].rotation.x = sw; m.userData.legs[1].rotation.x = -sw;
  }
}

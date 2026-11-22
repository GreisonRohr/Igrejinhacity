// Jogador a pé: movimento relativo à câmera, andar e correr, bonequinho com pernas animadas.
import { makePerson } from './person.js';

export { makePerson } from './person.js';

export class Walker {
  constructor(scene, terrain, x, z) {
    this.terrain = terrain;
    this.x = x; this.z = z; this.ang = 0; this.speed = 0;
    this.mesh = makePerson({ shirt: 0x1d4e9e, pants: 0x34507a, hair: 0x3a2618, skin: 0xe2b48c, shoes: 0xf4f4f4 });
    this.run = false;
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
    m.userData.animate(dt, this.speed, this.speed > 6);
  }
}

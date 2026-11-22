// Jogador a pé: movimento relativo à câmera, andar e correr, bonequinho com pernas animadas.
import { makePerson } from './person.js';

export { makePerson } from './person.js';

// Protagonista: Greison Rohr (aparência de referência do autor do jogo)
export const PROTAGONISTA = {
  skin: 0xe9bf9e, hair: 0x2a1c14, beard: 0x2e2018, eyes: 0x6f8f8c, hairStyle: 'fade', smile: true,
  shirt: 0x161616, jacket: 0x1c1c1e, pants: 0x1f1f21, cargo: true, shoes: 0xb9bec5, sole: 0xf3f3f3, watch: true, build: 1.05, height: 1.03,
};
export const SPEED = { walk: 3.2, run: 6.2, sprint: 9.0 };

export class Walker {
  constructor(scene, terrain, x, z) {
    this.terrain = terrain;
    this.x = x; this.z = z; this.ang = 0; this.speed = 0;
    this.mesh = makePerson(PROTAGONISTA);
    this.runTime = 0; this.y0 = 0; this.vy = 0; this.air = 0; this.onGround = true;
    scene.add(this.mesh);
    this.blocked = () => false;          // substituído quando houver colisão com prédios
  }

  get y() { return this.terrain.heightAt(this.x, this.z); }

  /** Pulo: só no chão. */
  jump() { if (this.onGround) { this.vy = 5.2; this.onGround = false; } }

  update(dt, { f, t, run }, camYaw) {
    const mag = Math.min(1, Math.hypot(f, t));
    // correr por mais de 1,2 s vira sprint
    this.runTime = run && mag > 0.5 ? this.runTime + dt : 0;
    const sprint = this.runTime > 1.2;
    const target = mag * (sprint ? SPEED.sprint : run ? SPEED.run : SPEED.walk);
    this.speed += (target - this.speed) * Math.min(1, dt * (this.onGround ? 6 : 1.5));
    this.mode = sprint ? 'sprint' : run && mag > 0.1 ? 'run' : mag > 0.1 ? 'walk' : 'idle';
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
    // pulo / gravidade
    const ground = this.y;
    if (!this.onGround) {
      this.vy -= 15 * dt; this.y0 += this.vy * dt;
      if (this.y0 <= 0) { this.y0 = 0; this.vy = 0; this.onGround = true; }
    }
    this.air += ((this.onGround ? 0 : 1) - this.air) * Math.min(1, dt * 12);
    const m = this.mesh;
    m.position.set(this.x, ground + this.y0, this.z);
    m.rotation.y = this.ang;
    m.userData.animate(dt, this.onGround ? this.speed : this.speed * 0.3, this.speed > 5, this.air);
  }
}

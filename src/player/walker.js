// Jogador a pé: movimento relativo à câmera, andar e correr, bonequinho com pernas animadas.
import { makePerson, makeContactShadow } from './person.js';

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
    this.blob = makeContactShadow(); scene.add(this.blob);
    this.blocked = () => false;          // substituído quando houver colisão com prédios
    this.groundAt = (x, z) => terrain.heightAt(x, z);   // substituído para incluir pontes
    this.surf = terrain.heightAt(x, z);
    this.lean = 0;
  }

  get y() { return this.surf; }
  /** Chão em (x, z) visto de onde o jogador está agora (sobe em ponte só pela cabeceira). */
  floor(x, z) { return this.groundAt(x, z, this.surf); }

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
      const turn = d * Math.min(1, dt * 10);
      this.ang += turn;
      this.lean += (Math.max(-0.25, Math.min(0.25, -turn / Math.max(dt, 1e-3) * 0.02 * this.speed / 4)) - this.lean) * Math.min(1, dt * 6);
    } else this.lean *= 1 - Math.min(1, dt * 6);
    if (this.speed > 0.01) {
      // ladeira: sobe mais devagar
      const sx = Math.sin(this.ang), sz = Math.cos(this.ang);
      const slope = (this.floor(this.x + sx, this.z + sz) - this.y);
      const v = this.speed * (slope > 0 ? Math.max(0.45, 1 - slope * 0.9) : 1);
      const nx = this.x + sx * v * dt, nz = this.z + sz * v * dt;
      // não cai de desnível > 1,2 m (guarda-corpo de ponte, barrancos) nem sobe degrau > 0,6 m
      const ok = (x, z) => { const h = this.floor(x, z) - this.surf; return this.terrain.inside(x, z, 5) && !this.blocked(x, z, 0.45) && h > -1.2 && h < 0.9 + this.y0; };
      if (ok(nx, this.z)) this.x = nx;
      if (ok(this.x, nz)) this.z = nz;
    }
    // pulo / gravidade
    const ground = this.surf = this.floor(this.x, this.z);
    if (!this.onGround) {
      this.vy -= 15 * dt; this.y0 += this.vy * dt;
      if (this.y0 <= 0) { this.y0 = 0; this.vy = 0; this.onGround = true; }
    }
    this.air += ((this.onGround ? 0 : 1) - this.air) * Math.min(1, dt * 12);
    const m = this.mesh;
    m.position.set(this.x, ground + this.y0, this.z);
    this.blob.position.set(this.x, ground + 0.03, this.z);
    const bs = 1 / (1 + this.y0 * 0.6); this.blob.scale.set(bs, 1, bs); this.blob.material.opacity = bs;
    m.rotation.set(0, this.ang, 0);
    m.rotation.z = this.lean;
    m.userData.animate(dt, this.onGround ? this.speed : 0, this.speed > 5, this.air);
  }
}

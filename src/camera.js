// Câmera em terceira pessoa: orbita o alvo, gira com arraste, volta suavemente para trás do jogador.
import * as THREE from 'three';

export class FollowCam {
  constructor(camera, terrain) {
    this.cam = camera; this.terrain = terrain;
    this.yaw = 0; this.pitch = 0.22; this.dist = 7;
    this.minDist = 3.5; this.maxDist = 40;
    this.idle = 0;
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3();
    this.first = true;
  }

  update(dt, target, look, { followYaw = null, height = 1.6, autoBehind = true } = {}) {
    const touched = look.dx || look.dy;
    this.yaw -= look.dx * 0.006;
    this.pitch = Math.min(1.2, Math.max(-0.15, this.pitch + look.dy * 0.004));
    if (look.zoom) this.dist = Math.min(this.maxDist, Math.max(this.minDist, this.dist * (1 + look.zoom * 0.12)));
    this.idle = touched ? 0 : this.idle + dt;
    // depois de 2 s sem girar, a câmera volta para trás do jogador (só quando ele anda)
    if (autoBehind && followYaw !== null && this.idle > 2) {
      let d = followYaw - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 1.5);
    }
    const ty = target.y + height;
    const cp = Math.cos(this.pitch);
    let x = target.x - Math.sin(this.yaw) * cp * this.dist;
    let z = target.z - Math.cos(this.yaw) * cp * this.dist;
    let y = ty + Math.sin(this.pitch) * this.dist;
    y = Math.max(y, this.terrain.heightAt(x, z) + 1.2);
    const k = this.first ? 1 : 1 - Math.exp(-dt * 12);
    this.pos.x += (x - this.pos.x) * k; this.pos.y += (y - this.pos.y) * k; this.pos.z += (z - this.pos.z) * k;
    this.pos.y = Math.max(this.pos.y, this.terrain.heightAt(this.pos.x, this.pos.z) + 1.0);
    this.first = false;
    this.cam.position.copy(this.pos);
    this.look.set(target.x, ty, target.z);
    this.cam.lookAt(this.look);
  }
}

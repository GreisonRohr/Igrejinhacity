// Minimapa redondo que gira com a câmera. O fundo é pré-renderizado uma vez (relevo sombreado).
import { LANDMARKS } from '../landmarks.js';

export class Minimap {
  constructor(canvas, terrain, ground = null) {
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.terrain = terrain;
    this.range = 300;                       // metros do centro até a borda
    this.bg = ground || this.renderBackground();
  }

  renderBackground() {
    const t = this.terrain, c = document.createElement('canvas');
    c.width = t.nx; c.height = t.nz;   // (fundo reserva, se não houver textura do chão)
    const g = c.getContext('2d'), im = g.createImageData(t.nx, t.nz);
    for (let j = 0; j < t.nz; j++) for (let i = 0; i < t.nx; i++) {
      const e = t.hi(i, j), sh = Math.max(0.55, Math.min(1.2, 0.92 - (t.hi(i + 1, j) - t.hi(i - 1, j) + t.hi(i, j + 1) - t.hi(i, j - 1)) * 0.03));
      const u = Math.min(1, (e - 20) / 650);
      const k = (j * t.nx + i) * 4;
      im.data[k] = (125 - 40 * u + 90 * u * u) * sh; im.data[k + 1] = (170 - 50 * u + 40 * u * u) * sh; im.data[k + 2] = (90 - 30 * u + 70 * u * u) * sh; im.data[k + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return c;
  }

  /** Desenha camadas extras no fundo (ruas, rio…) usando coordenadas do mundo. */
  paint(fn) {
    const t = this.terrain, g = this.bg.getContext('2d');
    g.save(); g.scale(1 / t.cell, 1 / t.cell); g.translate(-t.x0, -t.z0); fn(g); g.restore();
  }

  draw(px, pz, yaw, heading, extras = []) {
    const g = this.ctx, W = this.W, c = W / 2, s = c / this.range;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
    const T = (x, z) => { const dx = x - px, dz = z - pz; return [c + (dx * rx + dz * rz) * s, c - (dx * fx + dz * fz) * s]; };
    g.save();
    g.beginPath(); g.arc(c, c, c, 0, 7); g.clip();
    g.fillStyle = '#6f9f4b'; g.fillRect(0, 0, W, W);
    const t = this.terrain;
    g.setTransform(s * rx, -s * fx, s * rz, -s * fz, c - s * (rx * px + rz * pz), c + s * (fx * px + fz * pz));
    g.imageSmoothingEnabled = true;
    // desenha só o recorte em volta do jogador (o fundo pode ter 4096 px)
    const sxp = this.bg.width / t.W, szp = this.bg.height / t.H, R = this.range * 1.5;
    const wx0 = Math.max(t.x0, px - R), wz0 = Math.max(t.z0, pz - R), wx1 = Math.min(t.x0 + t.W, px + R), wz1 = Math.min(t.z0 + t.H, pz + R);
    if (wx1 > wx0 && wz1 > wz0) g.drawImage(this.bg, (wx0 - t.x0) * sxp, (wz0 - t.z0) * szp, (wx1 - wx0) * sxp, (wz1 - wz0) * szp, wx0, wz0, wx1 - wx0, wz1 - wz0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = '900 15px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const l of [...LANDMARKS, ...extras]) {
      let [a, b] = T(l.x, l.z);
      const dx = a - c, dy = b - c, d = Math.hypot(dx, dy);
      if (d > c - 12) { if (!l.pin) continue; a = c + dx / d * (c - 12); b = c + dy / d * (c - 12); }
      g.fillStyle = l.cor; g.strokeStyle = '#10224a'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(a, b, 10, 0, 7); g.fill(); g.stroke();
      g.fillStyle = l.cor === '#ffffff' || l.cor === '#f4b41a' ? '#10224a' : '#fff';
      g.fillText(l.icon, a, b + 1);
    }
    g.restore();
    // seta do jogador (aponta para onde ele está virado, relativo à câmera)
    g.save(); g.translate(c, c); g.rotate(-(heading - yaw));
    g.fillStyle = '#fff'; g.strokeStyle = '#10224a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -14); g.lineTo(10, 10); g.lineTo(0, 5); g.lineTo(-10, 10); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // N
    // norte = -z no mundo → na tela fica na direção (-sen yaw, cos yaw)
    const nx = c - Math.sin(yaw) * (c - 14), ny = c + Math.cos(yaw) * (c - 14);
    g.fillStyle = '#d6322c'; g.beginPath(); g.arc(nx, ny, 11, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = '900 13px Rubik, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', nx, ny + 1);
  }
}

// Placas flutuantes com o nome dos pontos marcantes.
import * as THREE from 'three';

export function makeLabel(text, width = 24) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = '900 52px Rubik, sans-serif';
  const tw = Math.ceil(ctx.measureText(text).width);
  c.width = Math.max(256, tw + 90); c.height = 112;
  const W = c.width, H = c.height;
  ctx.fillStyle = 'rgba(29,78,158,.92)';
  ctx.beginPath(); ctx.roundRect(4, 4, W - 8, H - 8, 28); ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#f4b41a'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = '900 52px Rubik, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, W / 2, H / 2 + 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, fog: false }));
  const w = width * W / 512;
  s.scale.set(w, w * H / W, 1);
  return s;
}

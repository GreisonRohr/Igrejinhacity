// Ciclo de dia e noite: cor do céu, neblina, sol/lua e sombra que acompanha o jogador.
import * as THREE from 'three';

export const DAY_SECONDS = 720;          // um dia inteiro do jogo = 12 minutos reais
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const DAY = new THREE.Color(0x8fc8ef), NIGHT = new THREE.Color(0x0c1530), DUSK = new THREE.Color(0xf08a4b);
const SUN = new THREE.Color(0xfff1d6), MOON = new THREE.Color(0x8ea6ff);

export class Sky {
  constructor(scene, { shadowSize = 1024, shadowRange = 60, fogFar = 7000 } = {}) {
    this.scene = scene;
    this.tod = 8 / 24;                    // hora do dia em fração (começa às 8h)
    this.night = 0;                       // 0 = dia, 1 = noite (outros módulos usam para acender luzes)
    this.sky = new THREE.Color().copy(DAY);
    scene.background = this.sky;
    scene.fog = new THREE.Fog(this.sky.clone(), fogFar * 0.2, fogFar);
    this.fogFar = fogFar;
    this.hemi = new THREE.HemisphereLight(0xdff1ff, 0x4f6b35, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const s = shadowRange;
    Object.assign(this.sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 800 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.4;
    scene.add(this.sun, this.sun.target);
  }

  get hours() { return this.tod * 24; }

  update(dt, focus) {
    this.tod = (this.tod + dt / DAY_SECONDS) % 1;
    const a = (this.tod - 0.25) * Math.PI * 2, el = Math.sin(a);
    const day = smooth(-0.1, 0.25, el);
    this.night = 1 - day;
    this.sky.copy(NIGHT).lerp(DAY, day).lerp(DUSK, Math.max(0, 1 - Math.abs(el - 0.04) / 0.18) * 0.5);
    this.scene.fog.color.copy(this.sky);
    this.hemi.intensity = 0.25 + 0.75 * day;
    this.sun.intensity = 0.25 + 1.4 * day;
    this.sun.color.copy(MOON).lerp(SUN, day);
    // sol (ou lua) gira de leste para oeste; a sombra é um quadrado pequeno centrado no jogador
    const dir = new THREE.Vector3(Math.cos(a), Math.max(0.35, Math.abs(el)), 0.35).normalize();
    // "encaixa" a câmera de sombra em texels para a sombra não tremer
    const snap = (this.sun.shadow.camera.right * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / snap) * snap, fz = Math.round(focus.z / snap) * snap;
    this.sun.position.set(fx + dir.x * 300, focus.y + dir.y * 300, fz + dir.z * 300);
    this.sun.target.position.set(fx, focus.y, fz);
  }
}

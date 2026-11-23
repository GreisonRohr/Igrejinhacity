// Ciclo de dia e noite com atmosfera física: céu de espalhamento (Preetham), sol e lua, estrelas,
// nuvens que derivam, névoa exponencial com a cor do horizonte e luz que muda de cor com a hora.
import * as THREE from 'three';
import { Sky as SkyShader } from 'three/examples/jsm/objects/Sky.js';

export const DAY_SECONDS = 720;          // um dia inteiro do jogo = 12 minutos reais
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// cores-chave por elevação do sol (−1 = meia-noite, 0 = horizonte, 1 = meio-dia)
const KEYS = [
  [-1.0, { fog: 0x070b18, hemiS: 0x1a2a55, hemiG: 0x0b0f14, sun: 0x8ea6ff, sunI: 0.35, hemiI: 0.35 }],
  [-0.12, { fog: 0x141c35, hemiS: 0x2a3a6a, hemiG: 0x10141a, sun: 0x8ea6ff, sunI: 0.3, hemiI: 0.4 }],
  [0.0, { fog: 0xd88a5c, hemiS: 0x8a7aa0, hemiG: 0x3a3028, sun: 0xff8a4a, sunI: 0.9, hemiI: 0.65 }],
  [0.12, { fog: 0xe8c6a2, hemiS: 0xb9c8e0, hemiG: 0x5b5a3c, sun: 0xffc98a, sunI: 2.0, hemiI: 0.95 }],
  [0.35, { fog: 0xbdd4e6, hemiS: 0xc9defa, hemiG: 0x7d8a5c, sun: 0xfff1dc, sunI: 2.55, hemiI: 1.4 }],
  [1.0, { fog: 0xb4cde3, hemiS: 0xcfe2ff, hemiG: 0x808c5e, sun: 0xfff6ea, sunI: 2.8, hemiI: 1.45 }],
];
const C1 = new THREE.Color(), C2 = new THREE.Color();
function sample(el, key, out) {
  let i = 0; while (i < KEYS.length - 2 && el > KEYS[i + 1][0]) i++;
  const [a, A] = KEYS[i], [b, B] = KEYS[i + 1], t = Math.min(1, Math.max(0, (el - a) / (b - a)));
  if (out) return out.copy(C1.set(A[key])).lerp(C2.set(B[key]), t);
  return A[key] + (B[key] - A[key]) * t;
}

function radialTex(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Sky {
  constructor(scene, { shadowSize = 1024, shadowRange = 60, fogFar = 7000 } = {}) {
    this.scene = scene;
    this.tod = 8 / 24;                    // hora do dia em fração (começa às 8h)
    this.night = 0;                       // 0 = dia, 1 = noite (outros módulos usam para acender luzes)
    this.cloudiness = 0.35;               // 0 = limpo, 1 = encoberto (clima, etapa 7)
    this.fogFar = fogFar;
    const R = fogFar * 0.62;              // meia-aresta da cúpula: os cantos ficam dentro do plano distante da câmera

    // céu físico
    this.dome = new SkyShader();
    this.dome.scale.setScalar(R * 2);
    this.dome.frustumCulled = false;
    const u = this.dome.material.uniforms;
    // o céu de espalhamento sai em HDR (muito claro para a exposição da cidade): escala antes do tone mapping
    this.dome.material.fragmentShader = this.dome.material.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * 0.42, 1.0 );');
    u.turbidity.value = 5.5; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.82;
    scene.add(this.dome);
    scene.background = new THREE.Color(0x070b18);

    // névoa exponencial: o relevo some suave na distância (perspectiva aérea)
    this.fogDensity = 2.2 / fogFar;
    scene.fog = new THREE.FogExp2(0xbdd4e6, this.fogDensity);

    // estrelas
    const N = 1400, pos = new Float32Array(N * 3); let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < N; i++) { const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 0.95); pos.set([Math.sin(ph) * Math.cos(th) * R * 0.95, Math.cos(ph) * R * 0.95, Math.sin(ph) * Math.sin(th) * R * 0.95], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    this.stars = new THREE.Points(sg, this.starMat); this.stars.frustumCulled = false; scene.add(this.stars);

    // lua (disco com halo)
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, '#ffffff'], [0.28, '#f2f4ff'], [0.32, 'rgba(200,210,255,.35)'], [1, 'rgba(120,140,255,0)']]), fog: false, depthWrite: false, transparent: true }));
    this.moon.scale.setScalar(R * 0.09); scene.add(this.moon);

    // nuvens: aglomerados achatados, derivando com o vento (instanciados: uma draw call)
    const NC = 26, puff = new THREE.IcosahedronGeometry(1, 1);
    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.25, transparent: true, opacity: 0.92, fog: false, depthWrite: false });
    this.clouds = new THREE.InstancedMesh(puff, this.cloudMat, NC * 5);
    this.clouds.frustumCulled = false;
    this.cloudData = [];
    for (let c = 0; c < NC; c++) {
      const a = rnd() * Math.PI * 2, d = R * (0.25 + rnd() * 0.55), h = 900 + rnd() * 700, sc = 90 + rnd() * 160;
      const puffs = []; for (let k = 0; k < 5; k++) puffs.push([(k - 2) * sc * 0.75 + (rnd() - 0.5) * sc * 0.4, (rnd() - 0.3) * sc * 0.25, (rnd() - 0.5) * sc * 0.6, sc * (0.6 + rnd() * 0.5)]);
      this.cloudData.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, h, puffs });
    }
    scene.add(this.clouds);
    this.wind = new THREE.Vector2(6, 2);  // m/s
    this.cloudOrigin = new THREE.Vector3();

    // luzes
    this.hemi = new THREE.HemisphereLight(0xcfe2ff, 0x6f7d4c, 1.2);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const sr = shadowRange;
    Object.assign(this.sun.shadow.camera, { left: -sr, right: sr, top: sr, bottom: -sr, near: 1, far: 800 });
    this.sun.shadow.bias = -0.0005; this.sun.shadow.radius = 2.5;   // borda mais suave (PCF)
    this.sun.shadow.normalBias = 0.4;
    scene.add(this.sun, this.sun.target);
    this.dir = new THREE.Vector3(); this._m = new THREE.Object3D();
    this._fog = new THREE.Color(); this._t = 0;
  }

  get hours() { return this.tod * 24; }

  update(dt, focus, camPos = focus) {
    this.tod = (this.tod + dt / DAY_SECONDS) % 1;
    this._t += dt;
    // sol: nasce a leste (+x), passa ao norte (-z, hemisfério sul) e se põe a oeste
    const a = (this.tod - 0.25) * Math.PI * 2, el = Math.sin(a);
    const sunDir = this.dir.set(Math.cos(a), el, -0.45).normalize();
    const day = smooth(-0.1, 0.2, el);
    this.night = 1 - day;
    const cloudDim = 1 - this.cloudiness * 0.35;

    // céu físico segue a câmera; abaixo do horizonte o espalhamento escurece sozinho
    this.dome.position.copy(camPos);
    this.dome.material.uniforms.sunPosition.value.copy(sunDir);
    this.dome.material.uniforms.rayleigh.value = 1.2 + (1 - Math.abs(el)) * 1.5;
    this.dome.visible = el > -0.25;

    // névoa da cor do horizonte; mais densa ao amanhecer (neblina do vale)
    sample(el, 'fog', this._fog);
    this.scene.fog.color.copy(this._fog);
    this.scene.background.copy(this._fog).multiplyScalar(0.6);
    const morning = Math.max(0, 1 - Math.abs(this.tod - 0.27) / 0.05);
    this.scene.fog.density = this.fogDensity * (1 + morning * 1.4 + this.cloudiness * 0.5);

    // luz: cor e intensidade pela elevação; à noite a "lua" faz o papel do sol
    sample(el, 'hemiS', this.hemi.color); sample(el, 'hemiG', this.hemi.groundColor);
    this.hemi.intensity = sample(el, 'hemiI') * (0.8 + 0.2 * cloudDim);
    sample(el, 'sun', this.sun.color);
    this.sun.intensity = sample(el, 'sunI') * cloudDim;
    const lightDir = el > -0.05 ? sunDir : this._m.position.set(-Math.cos(a) * 0.6, 0.7, 0.35).normalize();
    const snap = (this.sun.shadow.camera.right * 2) / this.sun.shadow.mapSize.x;
    const fx = Math.round(focus.x / snap) * snap, fz = Math.round(focus.z / snap) * snap;
    const L = Math.max(0.3, lightDir.y);
    this.sun.position.set(fx + lightDir.x * 300, focus.y + L * 300, fz + lightDir.z * 300);
    this.sun.target.position.set(fx, focus.y, fz);

    // estrelas e lua
    this.starMat.opacity = smooth(0.3, 0.9, this.night) * (1 - this.cloudiness * 0.6);
    this.stars.position.copy(camPos); this.stars.rotation.y = this.tod * Math.PI * 2;
    const R = this.fogFar * 0.6;
    this.moon.position.set(camPos.x - Math.cos(a) * R * 0.8, camPos.y + Math.max(-0.2, -el) * R * 0.6 + R * 0.08, camPos.z + R * 0.3);
    this.moon.material.opacity = smooth(0.2, 0.8, this.night);

    // nuvens: derivam com o vento, iluminadas pela cor do céu
    this.cloudOrigin.set(camPos.x, 0, camPos.z);
    const span = R * 1.6, m = this._m;
    this.cloudMat.color.copy(this._fog).lerp(C1.set(0xffffff), day * 0.85);
    this.cloudMat.emissive.copy(this._fog); this.cloudMat.emissiveIntensity = 0.15 + 0.2 * (1 - day);
    this.cloudMat.opacity = 0.55 + this.cloudiness * 0.4;
    let n = 0;
    for (const c of this.cloudData) {
      let x = ((c.x + this.wind.x * this._t - camPos.x) % span + span * 1.5) % span - span / 2;
      let z = ((c.z + this.wind.y * this._t - camPos.z) % span + span * 1.5) % span - span / 2;
      for (const [px, py, pz, ps] of c.puffs) {
        m.position.set(camPos.x + x + px, c.h + py, camPos.z + z + pz); m.scale.set(ps, ps * 0.45, ps * 0.8); m.updateMatrix();
        this.clouds.setMatrixAt(n++, m.matrix);
      }
    }
    this.clouds.instanceMatrix.needsUpdate = true;
  }
}

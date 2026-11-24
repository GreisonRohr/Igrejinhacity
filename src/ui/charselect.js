// Seleção de personagem (entrada do jogo e menu): Lukas (lederhosen) e Anna (dirndl), lado a lado em 3D.
// Um único renderizador pequeno desenha os dois (metade da tela cada), com giro por arraste; ele só existe enquanto a
// tela está aberta (fechou → descartado, sem custo no jogo). Os modelos das prévias dividem geometria e animações
// com o protagonista (humans.make).
import * as THREE from 'three';
import { PERSONAGENS } from '../player/costumes.js';

const KEYS = ['m', 'f'];

export class CharSelect {
  /** humans: fábrica de pessoas; onChange(key): chamado ao escolher. */
  constructor(humans, { selected = 'm', onChange = () => {} } = {}) {
    this.humans = humans; this.sel = selected; this.onChange = onChange; this.open = false;
    const el = this.el = document.createElement('div'); el.className = 'charsel';
    el.innerHTML = `<h2>Escolha seu personagem</h2>
      <div class="cs-stage"><canvas></canvas>
        ${KEYS.map(k => `<div class="cs-card" data-k="${k}"><div class="cs-hit"></div><div class="cs-info"><b>${PERSONAGENS[k].nome}</b><small>${PERSONAGENS[k].desc}</small>
          <button type="button" class="cs-pick">Escolher personagem</button></div></div>`).join('')}
      </div><p class="cs-hint">Arraste para girar · traje da Oktoberfest de Igrejinha</p>`;
    this.canvas = el.querySelector('canvas');
    for (const card of el.querySelectorAll('.cs-card')) {
      const k = card.dataset.k;
      card.querySelector('.cs-pick').addEventListener('click', e => { e.stopPropagation(); this.pick(k); });
      const hit = card.querySelector('.cs-hit');
      hit.addEventListener('pointerdown', e => { this.drag = { k, x: e.clientX, moved: 0 }; hit.setPointerCapture(e.pointerId); });
      hit.addEventListener('pointermove', e => { const d = this.drag; if (!d || d.k !== k) return; const dx = e.clientX - d.x; d.x = e.clientX; d.moved += Math.abs(dx); this.rot[k] += dx * 0.012; this.spin[k] = 0; });
      hit.addEventListener('pointerup', () => { const d = this.drag; this.drag = null; if (d && d.moved < 6) this.pick(k); });
    }
    this.rot = { m: -0.35, f: 0.35 }; this.spin = { m: 0.25, f: 0.25 };
    this._mark();
  }
  pick(k) { if (!PERSONAGENS[k]) return; this.sel = k; this._mark(); this.onChange(k); }
  _mark() { for (const c of this.el.querySelectorAll('.cs-card')) { const on = c.dataset.k === this.sel; c.classList.toggle('on', on); c.querySelector('.cs-pick').textContent = on ? '✓ Escolhido' : 'Escolher personagem'; } }

  /** Mostra dentro de `parent` e começa a desenhar. */
  mount(parent) {
    parent.appendChild(this.el); this.open = true;
    if (!this.renderer) this._initGL();
    const loop = t => { if (!this.open) return; this._frame(t); this.raf = requestAnimationFrame(loop); };
    this._t = performance.now(); this.raf = requestAnimationFrame(loop);
  }
  /** Para de desenhar e solta a placa de vídeo (contexto WebGL próprio). */
  unmount() {
    this.open = false; cancelAnimationFrame(this.raf); this.el.remove();
    if (this.renderer) {
      this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer = null;
      const c = this.canvas.cloneNode(false); this.canvas.replaceWith(c); this.canvas = c;   // contexto perdido não volta: canvas novo na próxima vez
    }
    for (const p of Object.values(this.people || {})) p.root.removeFromParent();
    this.people = null;
  }
  _initGL() {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.shadowMap.enabled = false;
    const sc = this.scene = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xfdf6ea, 0x4a5a40, 1.4));
    const key = new THREE.DirectionalLight(0xfff1dc, 2.4); key.position.set(1.5, 3, 3); sc.add(key);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 1.3); rim.position.set(-2, 2.5, -2.5); sc.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.55, 40), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }));
    floor.rotation.x = -Math.PI / 2;
    this.people = {}; this.stands = {};
    for (const k of KEYS) {
      const p = this.humans.make(PERSONAGENS[k].look); const g = new THREE.Group(); g.add(p.root);
      const f = floor.clone(); f.position.y = 0.002; g.add(f);
      sc.add(g); this.people[k] = p; this.stands[k] = g;
      p.root.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    }
    this.cam = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
  }
  _frame(t) {
    const dt = Math.min(0.05, (t - this._t) / 1000); this._t = t;
    const r = this.renderer, c = this.canvas, w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.round(w * r.getPixelRatio()) || c.height !== Math.round(h * r.getPixelRatio())) r.setSize(w, h, false);
    r.setScissorTest(false); r.setClearColor(0x000000, 0); r.clear(); r.setScissorTest(true);
    KEYS.forEach((k, i) => {
      const p = this.people[k], g = this.stands[k];
      p.play(dt, { speed: 0, air: 0, talk: false });
      if (!this.drag || this.drag.k !== k) this.rot[k] += this.spin[k] * dt;
      g.rotation.y = this.rot[k];
      for (const o of KEYS) this.stands[o].visible = o === k;
      const vw = w / 2, aspect = vw / (h - Math.min(h * 0.3, 96));
      this.cam.aspect = aspect; this.cam.fov = aspect < 0.62 ? 34 : 26; this.cam.updateProjectionMatrix();
      const H = 1.85, dist = (H * 0.58) / Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * (aspect < 0.62 ? 0.62 / aspect * 0.8 : 1);
      this.cam.position.set(0, 1.0, dist); this.cam.lookAt(0, 0.93, 0);
      const bottom = Math.min(h * 0.3, 96), vh = h - bottom;   // embaixo fica o nome e o botão do cartão
      r.setViewport(i * vw, bottom, vw, vh); r.setScissor(i * vw, bottom, vw, vh);
      r.render(this.scene, this.cam);
    });
  }
}

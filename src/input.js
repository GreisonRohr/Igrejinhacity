// Teclado, joystick virtual e arrastar para girar a câmera (mouse ou dedo).
const $ = id => document.getElementById(id);

export const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

export class Input {
  constructor(canvas) {
    this.keys = {};
    this.joy = { x: 0, y: 0, id: null };
    this.look = { dx: 0, dy: 0, zoom: 0 };     // acumulado entre frames, consumido pela câmera
    this.handlers = {};                       // 'act', 'fly', 'map' …

    addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      const h = { KeyE: 'act', KeyF: 'fly', KeyM: 'map', Space: 'jump' }[e.code];
      if (h) this.emit(h);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { for (const k in this.keys) this.keys[k] = false; });

    // joystick
    const jb = $('joy'), kn = $('knob'), joy = this.joy;
    const move = e => {
      const r = jb.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const max = r.width / 2, l = Math.hypot(dx, dy);
      if (l > max) { dx *= max / l; dy *= max / l; }
      joy.x = dx / max; joy.y = dy / max;
      kn.style.transform = `translate(${dx}px,${dy}px)`;
    };
    jb.addEventListener('pointerdown', e => { joy.id = e.pointerId; jb.setPointerCapture(e.pointerId); move(e); });
    jb.addEventListener('pointermove', e => { if (e.pointerId === joy.id) move(e); });
    const end = e => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; kn.style.transform = ''; } };
    jb.addEventListener('pointerup', end); jb.addEventListener('pointercancel', end);

    // arrastar no canvas gira a câmera (vários dedos: cada um rastreado)
    const drags = new Map();
    canvas.addEventListener('pointerdown', e => { drags.set(e.pointerId, [e.clientX, e.clientY]); canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      const p = drags.get(e.pointerId); if (!p) return;
      this.look.dx += e.clientX - p[0]; this.look.dy += e.clientY - p[1];
      p[0] = e.clientX; p[1] = e.clientY;
    });
    const dend = e => drags.delete(e.pointerId);
    canvas.addEventListener('pointerup', dend); canvas.addEventListener('pointercancel', dend);
    canvas.addEventListener('wheel', e => { this.look.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });

    $('bAct').addEventListener('click', () => this.emit('act'));
    $('bFly').addEventListener('click', () => this.emit('fly'));
    $('bJump').addEventListener('click', () => this.emit('jump'));
  }

  on(name, fn) { this.handlers[name] = fn; }
  emit(name) { this.handlers[name]?.(); }

  /** Eixos de movimento: f (frente), t (lado), run. */
  axes() {
    const k = this.keys, j = this.joy;
    let f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - j.y;
    let t = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + j.x;
    f = Math.max(-1, Math.min(1, f)); t = Math.max(-1, Math.min(1, t));
    return { f, t, run: !!(k.ShiftLeft || k.ShiftRight) || Math.hypot(j.x, j.y) > 0.92 };
  }

  takeLook() { const l = { ...this.look }; this.look.dx = this.look.dy = this.look.zoom = 0; return l; }
}

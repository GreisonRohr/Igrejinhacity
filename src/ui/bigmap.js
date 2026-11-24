// Mapa em tela cheia (M) com busca e GPS — Etapa 1 do plano (docs/estudo-bahcity.md).
// Vetorial e interativo: ruas reais (OSM/GEO) por categoria, prédios, rio, parques, nomes das ruas, lugares; busca por
// rua, rua + número (cadastro imobiliário do GEO Igrejinha), lugar ou ponto turístico; clique marca destino e o GPS traça
// a rota pelo grafo de navegação (a pé ou de carro); arrastar move, roda/pinça dá zoom, botão direito remove o destino,
// duplo clique/toque leva até lá (como o Uber). Os dados são copiados na criação (o main.js libera o mundo bruto depois).
import { LANDMARKS, PLACE_STYLE } from '../landmarks.js';

const $ = id => document.getElementById(id);
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const CLASS = k => /motorway|trunk/.test(k) ? 'exp' : /primary|secondary/.test(k) ? 'av' : /tertiary|residential|unclassified|living|service|road/.test(k) ? 'rua'
  : /cycleway/.test(k) ? 'cic' : /path|footway|steps|pedestrian|track/.test(k) ? 'cam' : 'rua';
const STYLE = {   // cor e largura mínima em px (a largura real vem do dado, em metros)
  exp: ['#f2b84b', 3.2], av: ['#f4f1e8', 2.6], rua: ['#d9dce0', 1.4], cam: ['#b9a98a', 1], cic: ['#4fc37a', 1.2],
};

export class BigMap {
  /** world/geoX ainda com os dados brutos; nav = grafo; ctx: { player, terrain, onTeleport(x,z), isTouch } */
  constructor({ world, geoX, nav, places, terrain, player, onTeleport, onChange }) {
    this.nav = nav; this.player = player; this.terrain = terrain; this.onTeleport = onTeleport; this.onChange = onChange || (() => {});
    this.open = false; this.mode = 'ped'; this.dest = null; this.route = null; this.routeLen = 0; this._rt = 0;
    this.view = { x: 0, z: 0, s: 0.35 };                         // centro (m) e escala (px por m)
    this.places = places;
    // índice de busca já (rápido); o desenho vetorial é montado aos poucos depois da carga (sem travar a tela)
    this._raw = { roads: world.roads, buildings: world.buildings, areas: world.areas, water: world.water };
    this._names(world.roads);
    this._buildIndex(world, geoX, places);
    this._dom();
  }

  /* ---------- camadas vetoriais (Path2D em coordenadas do mundo) ---------- */
  _names(roads) {
    const sp = this._streetPts = new Map(), names = new Map();
    for (const r of roads || []) {
      if (!r.n || !r.p || r.p.length < 2 || CLASS(r.k) === 'cam') continue;
      let best = null; for (let i = 0; i < r.p.length - 1; i++) { const a = r.p[i], b = r.p[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!best || l > best.l) best = { a, b, l }; }
      const cur = names.get(r.n); if (!cur || best.l > cur.l) names.set(r.n, { n: r.n, ...best, cls: CLASS(r.k) });
      if (!sp.has(r.n)) sp.set(r.n, []); const L = sp.get(r.n); for (let i = 0; i < r.p.length; i += 3) L.push(r.p[i]);
    }
    this.streetLabels = [...names.values()];
  }
  /** Monta as camadas em fatias (chamar com um orçamento de ms); devolve true quando terminou. */
  buildStep(budgetMs = 6) {
    if (this.layers?.done) return true;
    const t0 = performance.now();
    if (!this.layers) { this._buildLayers({ roads: this._raw.roads, areas: this._raw.areas, water: this._raw.water, buildings: [] }); this._bi = 0; }
    // prédios em arrays compactos (x,z em Float32) com grade de 200 m: desenha só o que está na tela
    const B = this._raw.buildings || [];
    let n = 0; for (const b of B) n += b.p ? b.p.length : 0;
    const xy = new Float32Array(n * 2), off = new Uint32Array(B.length + 1), grid = new Map(); let k = 0, m = 0;
    for (const b of B) {
      const p = b.p; if (!p || p.length < 3) continue; off[m] = k;
      for (const q of p) { xy[k * 2] = q[0]; xy[k * 2 + 1] = q[1]; k++; }
      const key = Math.floor(p[0][0] / 200) + ',' + Math.floor(p[0][1] / 200); let L = grid.get(key); if (!L) grid.set(key, L = []); L.push(m); m++;
    }
    off[m] = k; this.bldg = { xy, off, grid, n: m };
    this.layers.done = true; this._raw = null;   // solta os dados brutos
    return this.layers.done;
  }
  _buildLayers(world) {
    const L = this.layers = { water: new Path2D(), park: new Path2D(), bld: new Path2D(), roads: {} };
    for (const k of Object.keys(STYLE)) L.roads[k] = { path: new Path2D(), w: 0, n: 0 };
    const poly = (P, p) => { P.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) P.lineTo(p[i][0], p[i][1]); P.closePath(); };
    for (const a of world.areas || []) if (a.p && a.p.length > 2) { if (/water|river|lake|riverbank/.test(a.k)) poly(L.water, a.p); else if (/park|garden|grass|forest|wood|meadow|pitch|playground|cemetery/.test(a.k)) poly(L.park, a.p); }
    this.waterLines = (world.water || []).map(w => ({ p: w.p, w: Math.max(2, w.w || (w.k === 'river' ? 40 : 4)) }));
    const names = new Map();
    for (const r of world.roads || []) {
      if (!r.p || r.p.length < 2) continue;
      const c = CLASS(r.k), R = L.roads[c];
      R.path.moveTo(r.p[0][0], r.p[0][1]); for (let i = 1; i < r.p.length; i++) R.path.lineTo(r.p[i][0], r.p[i][1]);
      R.w = Math.max(R.w, 0); R.n++; (R.ws ||= []).push(r.w || 6);
    }
    for (const k of Object.keys(L.roads)) { const ws = L.roads[k].ws || [6]; ws.sort((a, b) => a - b); L.roads[k].w = ws[ws.length >> 1]; }
  }

  /* ---------- índice de busca: ruas, endereços (rua + número), lugares, pontos marcantes ---------- */
  _buildIndex(world, geoX, places) {
    const I = this.index = [];
    for (const [n, pts] of this._streetPts || []) { const m = pts[pts.length >> 1]; I.push({ t: 'rua', n, k: norm(n), x: m[0], z: m[1] }); }
    for (const l of LANDMARKS) I.push({ t: 'ponto', n: l.nome, k: norm(l.nome), x: l.x, z: l.z, icon: l.icon, cor: l.cor });
    for (const p of places || []) if (p.n && p.k !== 'onibus') I.push({ t: p.k, n: p.n, k: norm(p.n), x: p.x, z: p.z });
    this.addr = new Map();   // rua normalizada → [[número, x, z]]
    for (const a of geoX?.addr || []) { const k = norm(a[2]); if (!this.addr.has(k)) { const l = []; l.title = fixStreet(a[2], this._streetPts); this.addr.set(k, l); } this.addr.get(k).push(a); }   // mesmo array do geoX (sem cópia: memória)
  }
  search(q) {
    const s = norm(q); if (s.length < 2) return [];
    const m = s.match(/^(.*?)[ ,]+(\d{1,5})$/), num = m ? parseInt(m[2], 10) : null, words = (m ? m[1] : s).split(' ').filter(w => w.length > 1 || /\d/.test(w));
    const score = k => { let sc = 0; for (const w of words) { const i = k.indexOf(w); if (i < 0) return -1; sc += i === 0 || k[i - 1] === ' ' ? 2 : 1; } return sc - k.length * 0.01; };
    const out = [];
    for (const e of this.index) { const sc = score(e.k); if (sc >= 0) out.push({ ...e, sc: sc + (e.t === 'ponto' ? 1 : 0) }); }
    out.sort((a, b) => b.sc - a.sc);
    if (num !== null) {                                              // rua + número: endereço do cadastro mais próximo do número
      const res = [];
      for (const [k, list] of this.addr) {
        if (score(k) < 0) continue;
        let best = null, bn = 0; for (const a of list) { const n = parseInt(a[3], 10) || 0; if (!best || Math.abs(n - num) < Math.abs(bn - num)) { best = a; bn = n; } }
        if (best) res.push({ t: 'endereço', n: `${list.title}, ${best[3]}`, x: best[0], z: best[1], exact: bn === num, sc: 10 + score(k) + (bn === num ? 5 : 0) });
      }
      res.sort((a, b) => b.sc - a.sc); return [...res.slice(0, 5), ...out.slice(0, 3)];
    }
    return out.slice(0, 8);
  }

  /* ---------- GPS ---------- */
  setDest(x, z, name = 'Destino marcado') {
    this.dest = { x, z, name }; this._rt = 0; this.recalc(true); this.onChange(this.dest);
  }
  clearDest() { this.dest = null; this.route = null; this.onChange(null); }
  recalc(force = false) {
    if (!this.dest) return;
    const p = this.player, N = this.nav, s = N.nearest(p.x, p.z, this.mode, 400), t = N.nearest(this.dest.x, this.dest.z, this.mode, 600);
    const path = s >= 0 && t >= 0 ? N.route(s, t, this.mode) : null;
    this.route = path ? [[p.x, p.z], ...N.polyline(path), [this.dest.x, this.dest.z]] : [[p.x, p.z], [this.dest.x, this.dest.z]];
    this.routeLen = 0; for (let i = 1; i < this.route.length; i++) this.routeLen += Math.hypot(this.route[i][0] - this.route[i - 1][0], this.route[i][1] - this.route[i - 1][1]);
  }
  /** Chamado a cada quadro: chegada, desvio da rota (recalcula) e distância restante. */
  update(dt) {
    if (!this.dest || !this.route) return null;
    const p = this.player, d = Math.hypot(this.dest.x - p.x, this.dest.z - p.z);
    if (d < 12) { const n = this.dest.name; this.clearDest(); return { arrived: n }; }
    // ponto da rota mais próximo; corta o que já passou; desviou mais de 30 m → recalcula (no máximo a cada 1,5 s)
    let bi = 0, bd = Infinity; for (let i = 0; i < Math.min(this.route.length - 1, 60); i++) { const [a, b] = [this.route[i], this.route[i + 1]], q = segPt(p.x, p.z, a, b), dd = Math.hypot(q[0] - p.x, q[1] - p.z); if (dd < bd) { bd = dd; bi = i; } }
    this._rt -= dt;
    if (bd > 30 && this._rt <= 0) { this._rt = 1.5; this.recalc(); }
    else if (bi > 0) { this.route.splice(0, bi); this.route[0] = [p.x, p.z]; }
    else this.route[0] = [p.x, p.z];
    let L = 0; for (let i = 1; i < this.route.length; i++) L += Math.hypot(this.route[i][0] - this.route[i - 1][0], this.route[i][1] - this.route[i - 1][1]);
    this.routeLen = L; return { dist: L };
  }

  /* ---------- interface ---------- */
  _dom() {
    const el = document.createElement('div'); el.id = 'bigmap'; el.hidden = true;
    el.innerHTML = `<canvas id="bmC"></canvas>
      <div class="bmTop"><div class="bmTitle"><b>IGREJINHA</b><span id="bmWhere"></span></div>
        <div class="bmSearch"><input id="bmQ" placeholder="Buscar rua, número, lugar ou ponto turístico" autocomplete="off"><div id="bmRes"></div></div>
        <span id="bmClock"></span></div>
      <div class="bmLegend"><b>LEGENDA</b><i style="--c:#f2b84b"></i>Rodovias<i style="--c:#f4f1e8"></i>Avenidas<i style="--c:#d9dce0"></i>Ruas<i style="--c:#b9a98a"></i>Caminhos<i style="--c:#4fc37a"></i>Ciclovias<i style="--c:#3f7a3a"></i>Parques<i style="--c:#3b6fa8"></i>Rio e arroios<i style="--c:#c13cff"></i>Rota do GPS<i style="--c:#ff3b5c"></i>Destino</div>
      <div class="bmZoom"><button id="bmIn">+</button><button id="bmOut">−</button><button id="bmMe" title="Centralizar em mim">◎</button></div>
      <div class="bmHelp" id="bmHelp"></div>
      <div class="bmScale"><i id="bmScaleBar"></i><span id="bmScaleT"></span></div>
      <button class="bmClose" id="bmClose">FECHAR</button>`;
    document.body.appendChild(el); this.el = el; this.cv = $('bmC'); this.g = this.cv.getContext('2d');
    const touch = matchMedia('(pointer: coarse)').matches;
    $('bmHelp').innerHTML = touch ? '<b>Toque</b> marca destino · <b>Toque duplo</b> vai até lá · <b>Pinça</b> zoom · <b>Arrastar</b> move'
      : '<b>Clique</b> marca destino · <b>Duplo clique</b> vai até lá · <b>Arrastar</b> move · <b>Roda</b> zoom · <b>Botão direito</b> remove · <b>M</b> fecha';
    $('bmClose').onclick = () => this.toggle(false);
    $('bmIn').onclick = () => this.zoom(1.5); $('bmOut').onclick = () => this.zoom(1 / 1.5);
    $('bmMe').onclick = () => { this.view.x = this.player.x; this.view.z = this.player.z; this.draw(); };
    const q = $('bmQ'), res = $('bmRes');
    q.addEventListener('keydown', e => e.stopPropagation());   // digitar não move o personagem nem fecha o mapa
    q.addEventListener('input', () => {
      res.textContent = '';
      for (const r of this.search(q.value)) {
        const b = document.createElement('button'); b.innerHTML = `${r.n}<small>${r.t}${r.exact === false ? ' · número mais próximo' : ''}</small>`;
        b.onclick = () => { this.view.x = r.x; this.view.z = r.z; this.view.s = Math.max(this.view.s, 1.2); this.setDest(r.x, r.z, r.n); res.textContent = ''; q.value = r.n; q.blur(); this.draw(); };
        res.appendChild(b);
      }
    });
    // ponteiro: arrastar, pinça, clique, duplo clique/toque
    const pts = new Map(); let moved = 0, lastTap = 0, pinch = 0;
    const W2M = (cx, cy) => { const r = this.cv.getBoundingClientRect(); return [this.view.x + (cx - r.left - r.width / 2) / this.view.s, this.view.z + (cy - r.top - r.height / 2) / this.view.s]; };
    this.cv.addEventListener('pointerdown', e => { pts.set(e.pointerId, [e.clientX, e.clientY]); this.cv.setPointerCapture(e.pointerId); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
    this.cv.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId); if (!p) return;
      if (pts.size === 2) { const o = [...pts.entries()].find(([k]) => k !== e.pointerId)[1], d0 = pinch, d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]); if (d0 > 0) this.zoom(d1 / d0, false); pinch = d1; }
      else { const dx = e.clientX - p[0], dy = e.clientY - p[1]; this.view.x -= dx / this.view.s; this.view.z -= dy / this.view.s; }
      moved += Math.abs(e.clientX - p[0]) + Math.abs(e.clientY - p[1]); p[0] = e.clientX; p[1] = e.clientY; this.draw();
    });
    const up = e => {
      const was = pts.has(e.pointerId); pts.delete(e.pointerId); if (!was || moved > 8 || pts.size) return;
      if (e.button === 2) { this.clearDest(); this.draw(); return; }
      const [x, z] = W2M(e.clientX, e.clientY), now = performance.now();
      if (now - lastTap < 350) { this.toggle(false); this.onTeleport?.(x, z); lastTap = 0; return; }
      lastTap = now; this.setDest(x, z, this._labelAt(x, z)); this.draw();
    };
    this.cv.addEventListener('pointerup', up); this.cv.addEventListener('pointercancel', e => pts.delete(e.pointerId));
    this.cv.addEventListener('contextmenu', e => e.preventDefault());
    this.cv.addEventListener('wheel', e => { e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.25 : 0.8); }, { passive: false });
    addEventListener('resize', () => this.open && this.draw());
  }
  _labelAt(x, z) { let best = null, bd = 60; for (const e of this.index) { const d = Math.hypot(e.x - x, e.z - z); if (d < bd && e.t !== 'rua') { bd = d; best = e.n; } } return best || 'Destino marcado'; }
  zoom(f, redraw = true) { this.view.s = Math.min(6, Math.max(0.05, this.view.s * f)); if (redraw) this.draw(); }
  toggle(on = !this.open, where = '') {
    this.open = on; this.el.hidden = !on;
    if (on) { while (!this.buildStep(50)); this.view.x = this.player.x; this.view.z = this.player.z; $('bmWhere').textContent = where; this.draw(); }
    else { $('bmQ').blur(); $('bmRes').textContent = ''; }
  }

  /* ---------- desenho ---------- */
  /** Chamado a cada quadro com o mapa aberto: redesenha se algo mudou ou a cada 0,5 s. */
  tick(dt) { this._dt = (this._dt || 0) + dt; if (this.dirty || this._dt > 0.5) { this._dt = 0; this.dirty = false; this.draw(); } }
  draw() {
    if (!this.open) return;
    const cv = this.cv, dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = this.g, v = this.view, s = v.s, L = this.layers;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.fillStyle = '#1b2a22'; g.fillRect(0, 0, W, H);
    const T = () => g.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - v.x * s), dpr * (H / 2 - v.z * s));
    T();
    // relevo/área do município
    const t = this.terrain; g.fillStyle = '#25362b'; g.fillRect(t.minX, t.minZ, t.maxX - t.minX, t.maxZ - t.minZ);
    g.fillStyle = '#2f5a35'; g.fill(L.park);
    g.fillStyle = '#3b6fa8'; g.fill(L.water);
    g.strokeStyle = '#3b6fa8'; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const w of this.waterLines) { g.lineWidth = Math.max(w.w, 1.5 / s); g.beginPath(); g.moveTo(w.p[0][0], w.p[0][1]); for (let i = 1; i < w.p.length; i++) g.lineTo(w.p[i][0], w.p[i][1]); g.stroke(); }
    if (s > 0.22 && this.bldg) {
      const { xy, off, grid } = this.bldg, hw = W / 2 / s + 200, hh = H / 2 / s + 200;
      g.fillStyle = s > 0.6 ? '#4a4f57' : '#3a4048'; g.beginPath();
      for (let i = Math.floor((v.x - hw) / 200); i <= Math.floor((v.x + hw) / 200); i++) for (let j = Math.floor((v.z - hh) / 200); j <= Math.floor((v.z + hh) / 200); j++)
        for (const b of grid.get(i + ',' + j) || []) { const a = off[b], e = off[b + 1]; g.moveTo(xy[a * 2], xy[a * 2 + 1]); for (let q = a + 1; q < e; q++) g.lineTo(xy[q * 2], xy[q * 2 + 1]); g.closePath(); }
      g.fill();
    }
    for (const k of ['cam', 'cic', 'rua', 'av', 'exp']) { const R = L.roads[k]; if ((k === 'cam' || k === 'cic') && s < 0.15) continue; g.strokeStyle = STYLE[k][0]; g.lineWidth = Math.max(R.w * 0.85, STYLE[k][1] / s); g.stroke(R.path); }
    // rota do GPS
    if (this.route && this.route.length > 1) {
      g.strokeStyle = '#c13cff'; g.lineWidth = Math.max(6, 5 / s); g.beginPath(); g.moveTo(this.route[0][0], this.route[0][1]);
      for (const q of this.route) g.lineTo(q[0], q[1]); g.stroke();
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = (x, z) => [W / 2 + (x - v.x) * s, H / 2 + (z - v.z) * s], on = ([a, b]) => a > -40 && b > -40 && a < W + 40 && b < H + 40;
    // nomes das ruas (ao longo do trecho mais longo)
    if (s > 0.5) {
      g.font = `600 ${s > 1.4 ? 13 : 11}px Inter, Rubik, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const lb of this.streetLabels) {
        if (lb.cls === 'rua' && s < 0.9) continue;
        const [a1, b1] = S(...lb.a), [a2, b2] = S(...lb.b), len = Math.hypot(a2 - a1, b2 - b1), txt = short(lb.n);
        if (len < g.measureText(txt).width + 10 || !on([(a1 + a2) / 2, (b1 + b2) / 2])) continue;
        let ang = Math.atan2(b2 - b1, a2 - a1); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
        g.save(); g.translate((a1 + a2) / 2, (b1 + b2) / 2); g.rotate(ang); g.lineWidth = 3; g.strokeStyle = '#1b2a22'; g.strokeText(txt, 0, 0); g.fillStyle = '#f1efe8'; g.fillText(txt, 0, 0); g.restore();
      }
    }
    // lugares e pontos marcantes
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (s > 0.6) for (const p of this.places) { if (!p.icon || p.k === 'onibus') continue; const P = S(p.x, p.z); if (!on(P)) continue; dot(g, P, 7, p.cor, p.icon); if (s > 1.6) { g.font = '600 11px Inter, sans-serif'; g.fillStyle = '#fff'; g.fillText(p.nome || p.n || '', P[0], P[1] + 14); } }
    for (const l of LANDMARKS) { const P = S(l.x, l.z); if (!on(P)) continue; dot(g, P, 10, l.cor, l.icon); if (s > 0.25) { g.font = '700 12px Inter, sans-serif'; g.lineWidth = 3; g.strokeStyle = '#000a'; g.strokeText(l.nome, P[0], P[1] - 17); g.fillStyle = '#fff'; g.fillText(l.nome, P[0], P[1] - 17); } }
    // destino e você
    if (this.dest) { const [a, b] = S(this.dest.x, this.dest.z); g.fillStyle = '#ff3b5c'; g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(a, b); g.arc(a, b - 18, 9, Math.PI * 0.8, Math.PI * 2.2); g.closePath(); g.fill(); g.stroke(); }
    { const [a, b] = S(this.player.x, this.player.z), h = this.player.ang || 0; g.save(); g.translate(a, b); g.rotate(-h + Math.PI);
      g.fillStyle = '#ffd23f'; g.strokeStyle = '#10224a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -13); g.lineTo(9, 9); g.lineTo(0, 4); g.lineTo(-9, 9); g.closePath(); g.fill(); g.stroke(); g.restore(); }
    // escala
    const m = niceMeters(120 / s); $('bmScaleBar').style.width = (m * s) + 'px'; $('bmScaleT').textContent = m >= 1000 ? m / 1000 + ' km' : m + ' m';
  }
}

const segPt = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)); return [a[0] + dx * t, a[1] + dz * t]; };
const short = n => n.replace(/^Rua /, 'R. ').replace(/^Avenida /, 'Av. ').replace(/^Estrada /, 'Estr. ').replace(/^Travessa /, 'Tv. ');
const niceMeters = v => { const p = 10 ** Math.floor(Math.log10(v)), f = v / p; return (f < 2 ? 1 : f < 5 ? 2 : 5) * p; };
/** Nome do cadastro ("Da Independencia") → nome da rua no mapa ("Rua da Independência") quando houver correspondência. */
function fixStreet(n, streets) {
  const k = norm(n).replace(/^(rua|avenida|av|estrada|travessa|tv) /, '');
  for (const s of streets?.keys() || []) { const ks = norm(s); if (ks.endsWith(' ' + k) || ks === k) return s; }
  return n;
}
function titleOf(k, index) { const e = index.find(q => q.t === 'rua' && q.k === k); return e ? e.n : k.replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()); }
function dot(g, [a, b], r, cor, icon) {
  g.fillStyle = cor || '#fff'; g.strokeStyle = '#10224a'; g.lineWidth = 2; g.beginPath(); g.arc(a, b, r, 0, 7); g.fill(); g.stroke();
  g.fillStyle = cor === '#ffffff' || cor === '#f4b41a' || cor === '#f2c12e' ? '#10224a' : '#fff'; g.font = `900 ${r + 3}px Rubik, sans-serif`; g.fillText(icon || '', a, b + 1);
}
export { PLACE_STYLE };

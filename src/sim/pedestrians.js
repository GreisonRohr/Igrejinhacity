// Pedestres: população em volta do jogador, rotinas por perfil e hora, calçadas do grafo de navegação,
// espera na esquina, travessia, atividades (banco da praça, conversa, chimarrão, entrar em prédios), reações.
// Spec: docs/spec-pedestres.md. Simulação no passo fixo (step) e desenho interpolado (present).
import * as THREE from 'three';
import { Crowd } from './crowd.js';
import { mulberry32 } from '../core/rng.js';
import { events } from '../core/events.js';

export const PED = {
  max: { high: 140, medium: 90, low: 50 },
  radius: 200, despawn: 240, spawnMin: 60,
  walk: 1.35, walkVar: 0.15, oldWalk: 0.95,
  curbWait: [0.6, 2.0], activity: [6, 40], sit: [25, 70],
  lookDist: 4, sepDist: 0.9, talkDist: 2.5,
  routesPerStep: 2, animFull: 70,
};

// curvas de movimento por hora (WORLD_DESIGN "Vida planejada")
const CENTER = [[0, 0.03], [6, 0.05], [7, 0.4], [8, 0.85], [12, 1], [14, 0.8], [17, 1], [19, 0.7], [22, 0.25], [24, 0.03]];
const BAIRRO = [[0, 0.02], [6, 0.05], [7, 0.5], [9, 0.3], [12, 0.5], [14, 0.3], [17, 0.6], [19, 0.35], [22, 0.1], [24, 0.02]];
const curve = (K, h) => { for (let i = 1; i < K.length; i++) if (h <= K[i][0]) { const [h0, v0] = K[i - 1], [h1, v1] = K[i]; return v0 + (v1 - v0) * (h - h0) / (h1 - h0); } return K[0][1]; };

// perfis: peso de cada tipo de destino conforme a hora
const PROFILES = {
  morador: { w: 0.4, dest: h => ({ comercio: 1.2, praca: 0.7, casa: h > 17 ? 1.5 : 0.6, igreja: 0.2, bar: h > 17 ? 0.5 : 0 }) },
  trabalhador: { w: 0.3, dest: h => ({ comercio: h < 18 ? 2 : 0.4, casa: h > 16 ? 2 : 0.3, bar: h > 17 ? 1 : 0, praca: 0.3 }) },
  estudante: { w: 0.15, dest: h => ({ escola: (h > 6.5 && h < 8) || (h > 12 && h < 13.5) ? 3 : 0.3, praca: 0.8, comercio: 0.6, casa: h > 17 ? 1.5 : 0.5 }) },
  idoso: { w: 0.15, dest: h => ({ praca: 2, igreja: 0.6, comercio: 0.7, casa: h > 17 ? 2 : 0.4 }) },
};

const SKINS = [0xf1c6a0, 0xe8b996, 0xd9a47c, 0xb57b55, 0x8a5a3c, 0x5f3d29];
const SKIN_W = [0.3, 0.28, 0.2, 0.1, 0.07, 0.05];
const HAIR = [0x2b1d14, 0x4a2f1d, 0x7a5532, 0xb98a4b, 0x1a1a1a, 0xc9a26a];
const SHIRTS = [0x22324f, 0xf2f2ee, 0x7d8188, 0xb3262e, 0x2f6fb5, 0x3f6a3c, 0xcbb894, 0x222222, 0x6b2335, 0xe0a13a, 0x5aa7c9, 0xd8d0c3, 0x9b5ea8, 0x2e8b7a];
const PANTS = [0x2f4a6e, 0x3a5680, 0x1f2a3d, 0x222222, 0x5d5f63, 0xb8a37e, 0x4b4038];
const SKIRTS = [0x2f4a6e, 0x7a1f2b, 0x222222, 0x8d6e4f, 0x4a6b8a, 0xd8cfc0];
const SHOES = [0xf2f2f2, 0x222222, 0x5a3b26, 0x9aa0a8, 0xe5e0d6];

const FALAS = {
  todos: ['Opa, tudo tri?', 'Bah, que dia bonito, tchê!', 'Tu é daqui? Nunca te vi pela volta.', 'Vai na Oktoberfest esse ano? É tri bom!',
    'O Waldir tem o chope mais gelado do centro, tchê.', 'Já subiu no Morro da Cruz? Lá de cima se vê a cidade inteira.'],
  manha: ['Bom dia! Tá passeando pela cidade?', 'Bom dia, tchê! Cedo assim já na rua?'],
  tarde: ['Boa tarde! Calor bom pra um chimarrão, né?'],
  noite: ['Boa noite, guri! Bah, já tá tarde, vou pra casa.', 'De noite a cruz lá no morro acende, já viu?'],
  trabalhador: ['Tô correndo pro serviço, depois a gente se fala!', 'Bah, hoje o dia tá puxado na firma.', 'Saio às seis, aí vou direto no Waldir.'],
  estudante: ['Bah, prova de matemática hoje, me deseja sorte!', 'Depois da aula vou pra praça com a gurizada.'],
  idoso: ['Aceita um chimarrão? Tá recém cevado.', 'No meu tempo a Oktoberfest era bem menorzinha, sabia?', 'Essa praça eu vi crescer, guri.'],
  morador: ['Vou ali no mercado e já volto.', 'Igrejinha é pequena, mas é tri acolhedora.'],
  esbarrao: ['Ô, cuidado aí, tchê!', 'Opa! Devagar, guri!', 'Bah, quase me derruba!'],
};

const POSE = () => ({ x: 0, y: 0, z: 0, gy: 0, ang: 0, bob: 0, pelvisX: 0, hipYaw: 0, chestX: 0, chestYaw: 0, headX: 0, headYaw: 0,
  sh: [0, 0], shZ: [0.07, 0.07], el: [0, 0], hip: [0, 0], knee: [0, 0], foot: [0, 0], cuia: false });

export class Pedestrians {
  /**
   * ctx: { scene, nav, spatial, terrain, city, world, landmarks, places, quality ('high'|'medium'|'low'),
   *        groundAt(x, z), hours() }
   */
  constructor(ctx) {
    Object.assign(this, ctx);
    this.rnd = mulberry32(20261122);
    this.cap = PED.max[ctx.quality] || PED.max.medium;
    this.crowd = new Crowd(ctx.scene, this.cap);
    this.agents = [];
    this.nextId = 1; this.popT = 0; this.routeBudget = 0; this.toast = () => {};
    this.player = { x: 0, z: 0, speed: 0, sprint: false };
    this.camDir = { x: 0, z: -1 };
    this._near = []; this._p = POSE();
    this._buildDestinations();
    this._buildDensity();
    // raio da esquina de cada nó: a calçada de uma rua termina no meio-fio da rua mais larga que chega ali
    const nav = this.nav; this.corner = new Float32Array(nav.nodeCount);
    nav.edges.forEach(e => { if (!(e.f & nav.CAR)) return; const r = Math.min(14, this._offset(e) + (e.sw > 0 ? e.sw / 2 : 0.3)); for (const n of [e.a, e.b]) this.corner[n] = Math.max(this.corner[n], r); });
    // grade de segmentos de pista (para saber se um ponto está no meio da rua)
    this.lanes = new Map();
    for (const e of nav.edges) {
      if (!(e.f & nav.CAR) || e.br) continue;
      const half = (e.med > 0 ? Math.max(3.5, (e.w - e.med) / 2) : e.w) / 2;
      const P = [nav.nodePos(e.a)]; for (let j = 0; j < e.m.length; j += 2) P.push([e.m[j], e.m[j + 1]]); P.push(nav.nodePos(e.b));
      for (let i = 1; i < P.length; i++) {
        const sg = [P[i - 1][0], P[i - 1][1], P[i][0], P[i][1], half];
        const x0 = Math.floor((Math.min(sg[0], sg[2]) - half) / 50), x1 = Math.floor((Math.max(sg[0], sg[2]) + half) / 50), z0 = Math.floor((Math.min(sg[1], sg[3]) - half) / 50), z1 = Math.floor((Math.max(sg[1], sg[3]) + half) / 50);
        for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) { const k = a + ',' + b; (this.lanes.get(k) || this.lanes.set(k, []).get(k)).push(sg); }
      }
    }
  }

  /** O ponto está sobre a pista de carros (com margem m do meio-fio para dentro)? */
  inLane(x, z, m = 0.4) {
    const L = this.lanes.get(Math.floor(x / 50) + ',' + Math.floor(z / 50)); if (!L) return false;
    for (const s of L) {
      const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / l2));
      if (Math.hypot(x - s[0] - dx * t, z - s[1] - dz * t) < s[4] - m) return true;
    }
    return false;
  }
  /** O caminho reto de (x0,z0) a (x1,z1) passa pela pista? */
  crossesLane(x0, z0, x1, z1) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 1.5);
    for (let i = 1; i < n; i++) if (this.inLane(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, 1.2)) return true;   // entra de fato na pista
    return false;
  }

  /* ------------------------------ dados do mundo ------------------------------ */
  _buildDestinations() {
    const D = this.dest = { comercio: [], praca: [], escola: [], igreja: [], casa: [], bar: [] };
    const door = b => { let cx = 0, cz = 0; for (const q of b.p) { cx += q[0]; cz += q[1]; } return { x: cx / b.p.length, z: cz / b.p.length, poly: b.p }; };
    for (const b of this.world.buildings) {
      if (b.kind === 'commercial') D.comercio.push(door(b));
      else if (b.kind === 'house' && (b.p.length * 7 + D.casa.length) % 9 === 0) D.casa.push(door(b));   // amostra de casas
    }
    for (const p of this.places) {
      if (p.k === 'praca') D.praca.push({ x: p.x, z: p.z, open: true });
      else if (p.k === 'escola') D.escola.push({ x: p.x, z: p.z });
      else if (p.k === 'loja' || p.k === 'banco' || p.k === 'farmacia' || p.k === 'saude') D.comercio.push({ x: p.x, z: p.z });
    }
    for (const p of this.world.pois) if (p.k === 'place_of_worship') D.igreja.push({ x: p.x, z: p.z });
    const w = this.landmarks.waldir; if (w) D.bar.push({ x: w.x, z: w.z, bar: true });
    this.seats = (this.landmarks.seats || []).map(s => ({ ...s, busy: 0 }));
    if (this.seats.length) { const s0 = this.seats[0]; D.praca.push({ x: s0.x, z: s0.z, open: true, seats: true }); }
    // grade de destinos (busca por perto)
    this.destGrid = new Map();
    for (const [k, list] of Object.entries(D)) for (const d of list) { d.k = k; const key = Math.floor(d.x / 200) + ',' + Math.floor(d.z / 200); (this.destGrid.get(key) || this.destGrid.set(key, []).get(key)).push(d); }
  }
  /** Densidade local: comércio e casas a até 150 m de cada nó do grafo. */
  _buildDensity() {
    const g = new Map(), add = (x, z, k) => { const key = Math.floor(x / 50) + ',' + Math.floor(z / 50); const c = g.get(key) || g.set(key, [0, 0]).get(key); c[k]++; };
    for (const b of this.world.buildings) { const q = b.p[0]; if (b.kind === 'commercial') add(q[0], q[1], 0); else if (b.kind === 'house') add(q[0], q[1], 1); }
    this.dens = g;
  }
  densityAt(x, z) {
    let c = 0, h = 0; const i0 = Math.floor(x / 50), j0 = Math.floor(z / 50);
    for (let i = i0 - 3; i <= i0 + 3; i++) for (let j = j0 - 3; j <= j0 + 3; j++) { const v = this.dens.get(i + ',' + j); if (v) { c += v[0]; h += v[1]; } }
    return { comm: c, house: h };
  }

  /* ------------------------------ população ------------------------------ */
  targetCount(px, pz) {
    const hr = this.hours(), d = this.densityAt(px, pz);
    const center = Math.min(1, d.comm / 60), bairro = Math.min(1, d.house / 250);
    const want = center * curve(CENTER, hr) + bairro * curve(BAIRRO, hr) * 0.35;
    return Math.round(this.cap * Math.min(1, want));
  }

  _look(profile) {
    const r = this.rnd, pick = a => a[Math.floor(r() * a.length)];
    const female = r() < 0.5, old = profile === 'idoso', young = profile === 'estudante';
    let si = 0, acc = r(); for (let i = 0; i < SKIN_W.length; i++) { acc -= SKIN_W[i]; if (acc <= 0) { si = i; break; } }
    const skirt = female && r() < 0.3;
    const look = {
      skin: SKINS[si], hair: old ? (r() < 0.5 ? 0xd9d9d9 : 0x9a9a9a) : pick(HAIR), shirt: pick(SHIRTS), pants: skirt ? pick(SKIRTS) : pick(PANTS), shoes: pick(SHOES),
      hairStyle: female ? (r() < 0.75 ? 'long' : 'short') : (old && r() < 0.35) || r() < 0.08 ? 'bald' : 'short',
      skirt, h: (female ? 0.94 : 1.0) * (young ? 0.95 : 1) * (0.95 + r() * 0.1), b: (female ? 0.92 : 1.02) * (0.94 + r() * 0.16), sh: female ? 0.92 : 1,
      cuia: old ? r() < 0.6 : r() < 0.08, old,
    };
    look.rgb = Crowd.rgb(look);
    return look;
  }

  /** Primeira população (antes do jogador ver): pode nascer em qualquer lugar do raio; ocupa bancos da praça. */
  prefill(px, pz) {
    this.want = this.targetCount(px, pz);
    for (let k = 0; k < this.want * 3 && this.agents.length < this.want; k++) this._spawn(px, pz, true);
    const busy = curve(CENTER, this.hours());
    for (const s of this.seats) {
      if (s.busy || this.agents.length >= this.cap || Math.hypot(s.x - px, s.z - pz) > PED.radius || this.rnd() > 0.55 * busy) continue;
      const a = this._make(s.x, s.z, this.rnd() < 0.5 ? 'idoso' : 'morador');
      a.seat = s; s.busy = a.id; this._arrive(a);
    }
  }

  _make(x, z, pr) {
    const r = this.rnd, look = this._look(pr);
    const ag = { id: this.nextId++, x, z, px: x, pz: z, ang: r() * 6.28, pang: 0, y: 0, py: 0, profile: pr, look,
      speed: 0, vmax: (look.old ? PED.oldWalk : PED.walk) * (1 - PED.walkVar + r() * PED.walkVar * 2), state: 'pensar', t: 0, wp: null, wi: 0,
      ph: r() * 10, amp: 0, headYaw: 0, lookT: 0, stuck: 0, lastProg: 0, talkCD: 0, lift: 0.23, cross: false, seat: null, gest: r() * 10 };
    ag.pang = ag.ang; ag.y = ag.py = this.groundAt(x, z) + ag.lift;
    this.agents.push(ag);
    return ag;
  }

  _spawn(px, pz, anywhere = false) {
    const r = this.rnd, nav = this.nav;
    // nó do grafo 60–200 m do jogador, de preferência fora da vista (atrás da câmera ou longe)
    for (let tries = 0; tries < 12; tries++) {
      const a = r() * Math.PI * 2, d0 = anywhere ? 5 : PED.spawnMin, d = d0 + r() * (PED.radius - d0);
      const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
      const n = nav.nearest(x, z, 'ped', 60); if (n < 0) continue;
      const [nx, nz] = nav.nodePos(n), dd = Math.hypot(nx - px, nz - pz);
      if (dd < d0 * 0.8 || dd > PED.radius) continue;
      const ahead = ((nx - px) * this.camDir.x + (nz - pz) * this.camDir.z) / dd;
      if (!anywhere && ahead > 0.35 && dd < 140) continue;                  // na frente e perto: apareceria do nada
      let pr = 'morador', acc = r(); for (const [k, v] of Object.entries(PROFILES)) { acc -= v.w; if (acc <= 0) { pr = k; break; } }
      const [sx, sz] = this._sideOffset(n, anywhere);
      if (this.spatial.blocked(sx, sz, 0.3) || this.inLane(sx, sz, 0)) continue;
      const ag = this._make(sx, sz, pr); ag.edge = this._lastEdge;
      return ag;
    }
    return null;
  }
  /** Um ponto de calçada num trecho que sai do nó (perto do nó, ou em qualquer ponto do trecho se `spread`). */
  _sideOffset(n, spread = false) {
    const nav = this.nav, r = this.rnd, list = nav.adj[n], e = nav.edges[list[Math.floor(r() * list.length)]];
    const P = [nav.nodePos(e.a)]; for (let j = 0; j < e.m.length; j += 2) P.push([e.m[j], e.m[j + 1]]); P.push(nav.nodePos(e.b));
    if (e.a !== n) P.reverse();
    this._lastEdge = [n, e.a === n ? e.b : e.a];
    let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    let f = spread ? r() * L : Math.min(6, L * 0.3);
    for (let i = 1; i < P.length; i++) {
      const dx = P[i][0] - P[i - 1][0], dz = P[i][1] - P[i - 1][1], l = Math.hypot(dx, dz) || 1;
      if (f > l && i < P.length - 1) { f -= l; continue; }
      const t = Math.min(1, f / l), o = this._offset(e) * (e.med > 0 ? (e.a === n ? 1 : -1) : r() < 0.5 ? 1 : -1);
      return [P[i - 1][0] + dx * t - dz / l * o, P[i - 1][1] + dz * t + dx / l * o];
    }
    return P[0];
  }
  _offset(e) {
    if (!(e.f & this.nav.CAR)) return 0;                                    // calçadão, trilha: anda no meio
    const half = (e.med > 0 ? Math.max(3.5, (e.w - e.med) / 2) : e.w) / 2;
    return e.sw > 0 ? half + Math.min(1.1, e.sw / 2) : half + 0.6;
  }

  /* ------------------------------ rotas ------------------------------ */
  _chooseDestination(ag) {
    const r = this.rnd, hr = this.hours(), wants = PROFILES[ag.profile].dest(hr);
    let total = 0; for (const k in wants) total += wants[k];
    let pick = r() * total, kind = 'casa'; for (const k in wants) { pick -= wants[k]; if (pick <= 0) { kind = k; break; } }
    // candidatos do tipo num raio de 150–700 m (preferência pelos mais próximos)
    const cand = [], i0 = Math.floor(ag.x / 200), j0 = Math.floor(ag.z / 200);
    for (let i = i0 - 4; i <= i0 + 4; i++) for (let j = j0 - 4; j <= j0 + 4; j++) for (const d of this.destGrid.get(i + ',' + j) || []) {
      if (d.k !== kind) continue; const dist = Math.hypot(d.x - ag.x, d.z - ag.z); if (dist < 30 || dist > 800) continue; cand.push([dist, d]);
    }
    if (!cand.length) return null;
    cand.sort((a, b) => a[0] - b[0]);
    return cand[Math.floor(Math.pow(r(), 2) * Math.min(cand.length, 8))][1];
  }

  /** Converte a rota do grafo em pontos na calçada, marcando esquinas que exigem atravessar. */
  _waypoints(path, start, final, finalMax) {
    const nav = this.nav, out = [];
    let last = start;
    for (let i = 1; i < path.length; i++) {
      const u = path[i - 1], v = path[i], e = nav.edgeBetween(u, v);
      let P = [nav.nodePos(e.a)]; for (let j = 0; j < e.m.length; j += 2) P.push([e.m[j], e.m[j + 1]]); P.push(nav.nodePos(e.b));
      const o = this._offset(e), fwd = e.a === u;
      if (o > 0) P = resample(trim(P, this.corner[e.a], this.corner[e.b]), 8);
      const offPts = s => {
        const Q = [];
        for (let k = 0; k < P.length; k++) {
          const a = P[Math.max(0, k - 1)], b = P[k], c = P[Math.min(P.length - 1, k + 1)];
          let t1x = b[0] - a[0], t1z = b[1] - a[1], t2x = c[0] - b[0], t2z = c[1] - b[1];
          const l1 = Math.hypot(t1x, t1z) || 1, l2 = Math.hypot(t2x, t2z) || 1; t1x /= l1; t1z /= l1; t2x /= l2; t2z /= l2;
          if (k === 0) { t1x = t2x; t1z = t2z; } if (k === P.length - 1) { t2x = t1x; t2z = t1z; }
          let tx = t1x + t2x, tz = t1z + t2z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
          const cosH = Math.max(0.5, tx * t1x + tz * t1z), oo = o * s / cosH;
          let x = b[0] - tz * oo, z = b[1] + tx * oo;
          // calçada encostada em prédio (dado aproximado): chega mais perto do meio-fio
          for (let tries = 0; tries < 3 && o > 0 && this.spatial.blocked(x, z, 0.3); tries++) { const f = 1 - (tries + 1) * 0.18; x = b[0] - tz * oo * f; z = b[1] + tx * oo * f; }
          Q.push([x, z]);
        }
        return fwd ? Q : Q.reverse();
      };
      let side;
      if (o === 0) side = 0;
      else if (e.med > 0) side = 1;                                          // pista dupla: calçada só do lado de fora (direita do sentido)
      else {
        // fica do lado mais perto de onde está (último trecho: do lado do destino)
        const ref = i === path.length - 1 && final ? final : last;
        const A = offPts(1), B = offPts(-1);
        side = Math.hypot(A[0][0] - ref[0], A[0][1] - ref[1]) + (i === path.length - 1 && final ? 0 : 0) <= Math.hypot(B[0][0] - ref[0], B[0][1] - ref[1]) ? 1 : -1;
        if (i === path.length - 1 && final) side = Math.hypot(A[A.length - 1][0] - final[0], A[A.length - 1][1] - final[1]) < Math.hypot(B[B.length - 1][0] - final[0], B[B.length - 1][1] - final[1]) ? 1 : -1;
      }
      const Q = side === 0 ? (fwd ? P.slice() : P.slice().reverse()) : offPts(side);
      // transição pelo nó: mesma esquina (anda) ou outra esquina (para no meio-fio e atravessa)
      const lift = o > 0 && e.sw > 0 ? 0.23 : 0.08;
      const pl = out[out.length - 1];
      if (pl && Math.hypot(pl.x - Q[0][0], pl.z - Q[0][1]) < 35 && this.crossesLane(pl.x, pl.z, Q[0][0], Q[0][1])) {
        out.push({ x: Q[0][0], z: Q[0][1], lift, crossEnd: true });        // trecho de travessia: espera no meio-fio antes
      }
      for (let k = 0; k < Q.length; k++) {
        const q = Q[k], p = out[out.length - 1];
        if (p && Math.hypot(p.x - q[0], p.z - q[1]) < 0.8) continue;
        if (o > 0 && this.inLane(q[0], q[1], 0.2)) continue;               // ponto de calçada caiu dentro de outra rua
        out.push({ x: q[0], z: q[1], lift });
      }
      last = Q[Q.length - 1];
    }
    // último trecho a pé fora da calçada: curto (porta, banco), senão atravessaria ruas em linha reta
    if (final && Math.hypot(final[0] - last[0], final[1] - last[1]) < (finalMax || 15)) out.push({ x: final[0], z: final[1], lift: 0.23, final: true });
    return out;
  }

  _plan(ag) {
    if (this.routeBudget <= 0) return false;
    this.routeBudget--;
    const d = this._chooseDestination(ag);
    if (!d) { ag.state = 'sair'; return true; }
    const nav = this.nav, t = nav.nearest(d.x, d.z, 'ped', 120);
    let path = null;
    if (t >= 0 && ag.edge) {
      // começa pelo trecho de calçada onde a pessoa está: segue até a ponta que dá o caminho mais curto
      const [n0, n1] = ag.edge, R = n => (n === t ? Object.assign([n], { cost: 0 }) : nav.route(n, t, 'ped'));
      const p0 = R(n0), p1 = R(n1), c = (p, n) => (p ? p.cost + Math.hypot(ag.x - nav.nodePos(n)[0], ag.z - nav.nodePos(n)[1]) : Infinity);
      path = c(p0, n0) <= c(p1, n1) ? (p0 && [n1, ...p0]) : (p1 && [n0, ...p1]);
    } else if (t >= 0) {
      const s0 = nav.nearest(ag.x, ag.z, 'ped', 80);
      path = s0 < 0 ? null : s0 === t ? [s0] : nav.route(s0, t, 'ped');
    }
    if (!path) { ag.state = 'sair'; return true; }
    // ponto final: porta (borda do prédio mais perto da rua), banco livre da praça, ou o próprio lugar
    let final = null; ag.goal = d;
    if (d.poly) { const [tx, tz] = nav.nodePos(t); let best = null, bd = 1e9; for (let i = 0; i < d.poly.length; i++) { const p0 = d.poly[i], p1 = d.poly[(i + 1) % d.poly.length], m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], dd = Math.hypot(m[0] - tx, m[1] - tz); if (dd < bd) { bd = dd; best = m; } } if (bd < 40) final = best; }
    else if (d.k === 'praca') {
      const free = this.seats.filter(s => !s.busy && Math.hypot(s.x - d.x, s.z - d.z) < 80);
      if (free.length && this.rnd() < 0.7) { ag.seat = free[Math.floor(this.rnd() * free.length)]; ag.seat.busy = ag.id; final = [ag.seat.x + Math.sin(ag.seat.face) * 0.5, ag.seat.z + Math.cos(ag.seat.face) * 0.5]; }
    } else if (d.bar) final = [d.x + (this.rnd() - 0.5) * 3, d.z + 1.5 + this.rnd() * 2];
    if (final && ((this.spatial.blocked(final[0], final[1], 0.05) && !d.poly) || this.inLane(final[0], final[1], 0))) final = null;
    ag.wp = this._waypoints(path, [ag.x, ag.z], final, ag.seat ? 40 : 15); ag.wi = 0;
    if (path.length > 1) ag.edge = [path[path.length - 2], path[path.length - 1]];
    if (!ag.wp.length) { ag.state = 'atividade'; ag.t = 3 + this.rnd() * 5; ag.wp = null; return true; }   // já está lá: olha em volta
    if (ag.seat && !ag.wp.some(w => w.final)) { ag.seat.busy = 0; ag.seat = null; }
    // o primeiro ponto pode ficar atrás: começa do mais próximo
    let bi = 0, bd = 1e9; for (let i = 0; i < Math.min(6, ag.wp.length); i++) { const dd = Math.hypot(ag.wp[i].x - ag.x, ag.wp[i].z - ag.z); if (dd < bd) { bd = dd; bi = i; } }
    ag.wi = bi; ag.state = 'andar'; ag.stuck = 0;
    return true;
  }

  /* ------------------------------ simulação ------------------------------ */
  step(h) {
    const P = this.player, sp = this.spatial;
    this.routeBudget = PED.routesPerStep;
    // população (a cada 0,5 s)
    this.popT -= h;
    if (this.popT <= 0) {
      this.popT = 0.5;
      this.want = this.targetCount(P.x, P.z);
      for (let k = 0; k < 3 && this.agents.length < Math.min(this.cap, this.want); k++) this._spawn(P.x, P.z);
    }
    // agentes na consulta espacial (para desvio mútuo)
    sp.clearAgents();
    for (const a of this.agents) sp.addAgent(a.id, a.x, a.z, 0.28, a);
    const hr = this.hours();
    for (let i = this.agents.length - 1; i >= 0; i--) {
      const a = this.agents[i];
      a.px = a.x; a.pz = a.z; a.pang = a.ang; a.py = a.y;
      const dp = Math.hypot(a.x - P.x, a.z - P.z);
      const gone = dp > PED.despawn || (dp > PED.radius && this.agents.length > this.want + 4) || a.state === 'some';
      if (gone || (a.state === 'sair' && dp > 90)) { this._remove(i); continue; }
      a.t -= h; a.talkCD -= h;
      switch (a.state) {
        case 'pensar': case 'sair': if (a.state === 'pensar') this._plan(a); else this._wander(a, h); break;
        case 'andar': case 'atravessar': this._walk(a, h); break;
        case 'esquina': a.speed *= 0.8; if (a.t <= 0) { a.state = 'atravessar'; a.cross = true; } break;
        case 'atividade': case 'sentado': case 'grupo':
          a.speed *= 0.8;
          if (a.t <= 0) { if (a.seat) { a.seat.busy = 0; a.seat = null; a.lift = 0.23; } a.state = hr > 22.5 || hr < 5 ? 'sair' : 'pensar'; }
          break;
        case 'entrar': this._walk(a, h); if (a.t <= 0) a.state = 'some'; break;
        case 'falar': a.speed = 0; a.ang = turn(a.ang, Math.atan2(P.x - a.x, P.z - a.z), h * 6); if (a.t <= 0) a.state = a.resume || 'pensar'; break;
        case 'desviar': this._move(a, a.dodge[0], a.dodge[1], 2.2, h); if (a.t <= 0) a.state = a.resume || 'pensar'; break;
      }
      // reação: jogador correndo para cima → passo para o lado + reclamação
      if (P.sprint && dp < 2.2 && a.state !== 'desviar' && a.state !== 'sentado' && a.talkCD <= 0) {
        const ax = a.x - P.x, az = a.z - P.z, L = Math.hypot(ax, az) || 1, side = (ax * P.vz - az * P.vx) > 0 ? 1 : -1;
        a.dodge = [-P.vz / (Math.hypot(P.vx, P.vz) || 1) * side + ax / L * 0.5, P.vx / (Math.hypot(P.vx, P.vz) || 1) * side + az / L * 0.5];
        a.resume = a.state === 'falar' ? 'pensar' : a.state; a.state = 'desviar'; a.t = 0.5; a.talkCD = 8;
        this.toast(FALAS.esbarrao[Math.floor(this.rnd() * FALAS.esbarrao.length)]);
        events.emit('ped:esbarrao', a);
      }
      // altura: calçada / pista / ponte / banco
      const tgtLift = a.state === 'atravessar' || a.cross ? 0.08 : (a.wp && a.wp[a.wi] ? a.wp[a.wi].lift : a.lift);
      a.lift += (tgtLift - a.lift) * Math.min(1, h * 8);
      a.y = this.groundAt(a.x, a.z) + a.lift;
      // olhar o jogador quando ele passa perto
      a.lookP = dp < PED.lookDist && a.state !== 'esquina';
    }
  }

  _remove(i) {
    const a = this.agents[i], last = this.agents.length - 1;
    if (a.seat) a.seat.busy = 0;
    if (i !== last) this.agents[i] = this.agents[last];
    this.agents.pop();
  }

  _wander(a, h) { a.speed *= 0.9; }   // sem rota: fica parado até sumir de vista

  _walk(a, h) {
    const w = a.wp && a.wp[a.wi];
    if (!w) { this._arrive(a); return; }
    // começo de um trecho que corta a rua fora da esquina: para no meio-fio, olha e atravessa
    if (a.legOf !== w) {
      a.legOf = w;
      const legL = Math.hypot(w.x - a.x, w.z - a.z);
      if (a.state === 'andar' && !a.cross && legL < 35 && (w.crossEnd || this.crossesLane(a.x, a.z, w.x, w.z))) {
        if (this.inLane(a.x, a.z, 0)) { a.cross = true; a.legCross = true; }   // já está na rua: termina de atravessar
        else { a.state = 'esquina'; a.t = PED.curbWait[0] + this.rnd() * (PED.curbWait[1] - PED.curbWait[0]); a.legCross = true; return; }
      }
    }
    const dx = w.x - a.x, dz = w.z - a.z, d = Math.hypot(dx, dz);
    if (d < (w.final ? 0.25 : 0.55)) {
      if (w.crossEnd || a.legCross) { a.state = 'andar'; a.cross = false; a.legCross = false; }
      a.wi++;
      if (a.wi >= a.wp.length) this._arrive(a);
      return;
    }
    const v = a.vmax * (a.state === 'atravessar' ? 1.15 : 1) * (a.wi === a.wp.length - 1 && d < 2 ? 0.6 : 1);
    this._move(a, dx / d, dz / d, v, h);
    // preso (obstáculo que o desvio não resolve): desiste e procura outro destino
    if (a.speed < 0.15) { a.stuck += h; if (a.stuck > 4) { a.stuck = 0; a.state = 'pensar'; a.wp = null; a.cross = false; } } else a.stuck = 0;
  }

  /** Movimento com desvio de pessoas, do jogador e de obstáculos estáticos (árvores, postes, prédios). */
  _move(a, dx, dz, v, h) {
    const sp = this.spatial, P = this.player;
    let sx = 0, sz = 0;
    for (const o of sp.agentsNear(a.x, a.z, PED.sepDist, this._near)) {
      if (o.id === a.id) continue;
      const ox = a.x - o.x, oz = a.z - o.z, L = Math.hypot(ox, oz) || 0.01, f = (PED.sepDist + 0.3 - L) / PED.sepDist;
      if (f > 0) { sx += ox / L * f; sz += oz / L * f; sx += -dz * 0.3 * f; sz += dx * 0.3 * f; }   // contorna pela direita
    }
    const pdx = a.x - P.x, pdz = a.z - P.z, pd = Math.hypot(pdx, pdz);
    if (pd < 1.4) { const f = (1.4 - pd) / 1.4 * 1.6; sx += pdx / (pd || 0.01) * f; sz += pdz / (pd || 0.01) * f; }
    let mx = dx + sx, mz = dz + sz; const ml = Math.hypot(mx, mz) || 1; mx /= ml; mz /= ml;
    // obstáculo à frente: tenta ângulos alternados
    const probe = 0.7;
    if (sp.blocked(a.x + mx * probe, a.z + mz * probe, 0.25)) {
      let ok = false;
      for (const ang of [0.5, -0.5, 1.0, -1.0, 1.5, -1.5]) {
        const c = Math.cos(ang), s = Math.sin(ang), rx = mx * c - mz * s, rz = mx * s + mz * c;
        if (!sp.blocked(a.x + rx * probe, a.z + rz * probe, 0.25)) { mx = rx; mz = rz; ok = true; break; }
      }
      if (!ok) { a.speed *= 0.5; return; }
    }
    a.speed += (v - a.speed) * Math.min(1, h * 4);
    const nx = a.x + mx * a.speed * h, nz = a.z + mz * a.speed * h;
    const hitP = Math.hypot(nx - P.x, nz - P.z) < 0.65;
    // meio-fio: fora de travessia ninguém desce para a pista (nem empurrado no desvio)
    const curb = !a.cross && this.inLane(nx, nz, 0.6) && !this.inLane(a.x, a.z, 0.6);
    if (!hitP && !curb && !sp.blocked(nx, nz, 0.2)) { a.x = nx; a.z = nz; }
    else a.speed *= 0.5;
    if (a.speed > 0.05) a.ang = turn(a.ang, Math.atan2(mx, mz), h * 8);
  }

  _arrive(a) {
    if (a.state === 'entrar') { a.wp = null; a.speed = 0; return; }   // chegou na porta: some quando o tempo acabar
    const g = a.goal, r = this.rnd;
    a.wp = null; a.cross = false;
    if (a.seat && Math.hypot(a.seat.x - a.x, a.seat.z - a.z) < 1.2) {
      a.state = 'sentado'; a.t = PED.sit[0] + r() * (PED.sit[1] - PED.sit[0]);
      a.x = a.seat.x; a.z = a.seat.z; a.ang = a.seat.face; a.lift = a.seat.y - this.groundAt(a.x, a.z) - 0.42; return;
    }
    if (a.seat) { a.seat.busy = 0; a.seat = null; }
    if (g && g.poly) { a.state = 'entrar'; a.t = 1.2; a.wp = [{ x: g.x * 0.15 + a.x * 0.85, z: g.z * 0.15 + a.z * 0.85, lift: 0.23 }]; a.wi = 0; return; }
    a.state = 'atividade'; a.t = PED.activity[0] + r() * (PED.activity[1] - PED.activity[0]);
    // conversa: chama quem está passando perto para um papo
    for (const o of this.spatial.agentsNear(a.x, a.z, 6, this._near)) {
      const b = o.data; if (b === a || b.state !== 'andar' || r() > 0.4) continue;
      b.state = 'grupo'; b.t = a.t = 8 + r() * 14; b.wp = null; b.partner = a; a.partner = b;
      b.ang = Math.atan2(a.x - b.x, a.z - b.z); a.ang = Math.atan2(b.x - a.x, b.z - a.z); a.state = 'grupo';
      break;
    }
  }

  /* ------------------------------ interação ------------------------------ */
  /** Pessoa mais próxima para conversar (ou null). */
  nearestTalker(px, pz) {
    let best = null, bd = PED.talkDist;
    for (const a of this.agents) { const d = Math.hypot(a.x - px, a.z - pz); if (d < bd && a.state !== 'desviar') { bd = d; best = a; } }
    return best;
  }
  talk(a) {
    const hr = this.hours(), r = this.rnd;
    const pool = [...FALAS.todos, ...(FALAS[a.profile] || []), ...(hr < 12 && hr > 5 ? FALAS.manha : hr < 18 ? FALAS.tarde : FALAS.noite)]
      .filter(f => !(f.includes('chimarrão') && a.profile === 'idoso' && !a.look.cuia));
    a.resume = a.state === 'esquina' || a.state === 'falar' ? 'andar' : a.state; a.state = 'falar'; a.t = 5; a.talkCD = 3;
    if (a.resume === 'andar' && !a.wp) a.resume = 'pensar';
    events.emit('ped:conversa', a);
    return pool[Math.floor(r() * pool.length)];
  }

  /* ------------------------------ desenho ------------------------------ */
  /** Desenha só quem está na vista da câmera (ou a até 25 m, por causa da sombra): vagas compactadas. */
  present(alpha, dt, camera) {
    const P = this._p, C = this.crowd, camX = camera.position.x, camZ = camera.position.z;
    const F = this._frustum || (this._frustum = new THREE.Frustum()), M = this._pm || (this._pm = new THREE.Matrix4()), S = this._sph || (this._sph = new THREE.Sphere(new THREE.Vector3(), 1.3));
    M.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); F.setFromProjectionMatrix(M);
    this._fr = (this._fr || 0) + 1;
    let k = 0;
    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i], dist = Math.hypot(a.x - camX, a.z - camZ);
      S.center.set(a.x, a.y + 0.9, a.z);
      if (dist > 25 && (dist > 170 || !F.intersectsSphere(S))) { a.slot = -1; continue; }
      const far = dist > PED.animFull;   // longe: sem olhar/gesto fino
      P.x = a.px + (a.x - a.px) * alpha; P.z = a.pz + (a.z - a.pz) * alpha; P.y = a.py + (a.y - a.py) * alpha; P.gy = P.y - a.lift;
      let d = a.ang - a.pang; d = Math.atan2(Math.sin(d), Math.cos(d)); P.ang = a.pang + d * alpha;
      animate(a, P, dt, this.player, far);
      C.dress(k, a.look); C.pose(k, a, P); a.slot = k++;
    }
    C.commit(k);
    this.drawn = k;
  }
}

/** Pontos a cada no máximo `step` metros (trechos retos longos viram vários pontos). */
function resample(P, step) {
  const out = [P[0]];
  for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step); for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  return out;
}

/** Polilinha sem as pontas: começa a `ra` m do início e termina a `rb` m do fim (trecho curto: só o meio). */
function trim(P, ra, rb) {
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const L = cum[cum.length - 1], at = s => { for (let i = 1; i < P.length; i++) if (s <= cum[i] || i === P.length - 1) { const t = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t]; } };
  if (L < ra + rb + 1) { const m = at(L * ra / ((ra + rb) || 1)), d = at(Math.min(L, L * ra / ((ra + rb) || 1) + 0.5)); return [m, d]; }
  const out = [at(ra)]; for (let i = 1; i < P.length - 1; i++) if (cum[i] > ra && cum[i] < L - rb) out.push(P[i]); out.push(at(L - rb));
  return out;
}

const turn = (a, b, k) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * Math.min(1, k); };

/** Pose do corpo a partir do estado (passada ligada à velocidade, como o protagonista). */
function animate(a, P, dt, player, far = false) {
  const L = a.look, v = a.speed, sitting = a.state === 'sentado';
  a.ph += dt * v / 1.4 * Math.PI * 2;
  const target = v > 0.15 ? Math.min(0.42, 0.18 + v * 0.17) : 0;
  a.amp += (target - a.amp) * Math.min(1, dt * 6);
  const amp = a.amp, ph = a.ph;
  for (let s = 0; s < 2; s++) {
    const ang = ph + (s ? Math.PI : 0), sa = Math.sin(ang), ca = Math.cos(ang), swing = Math.max(0, ca);
    const hip = -sa * amp, knee = 0.06 + amp * (0.2 * (1 - swing) * Math.max(0, -sa) + Math.pow(swing, 1.4) * 1.6);
    P.hip[s] = hip; P.knee[s] = knee; P.foot[s] = -(hip + knee) * 0.9;
    const aa = ph + (s ? 0 : Math.PI);
    P.sh[s] = -Math.sin(aa) * amp * 0.7; P.shZ[s] = 0.07 + amp * 0.05; P.el[s] = -0.15 - Math.max(0, Math.sin(aa)) * amp * 0.35;
  }
  P.bob = (Math.abs(Math.cos(ph)) - 0.65) * 0.035 * amp / 0.4; P.pelvisX = 0; P.hipYaw = Math.sin(ph) * 0.14 * amp;
  P.chestX = L.old ? 0.16 : 0.02; P.chestYaw = -P.hipYaw * 1.3; P.headX = L.old ? -0.1 : 0; P.cuia = L.cuia;
  a.gest += dt;
  if (sitting) {
    P.bob = -0.47; for (let s = 0; s < 2; s++) { P.hip[s] = -1.5; P.knee[s] = 1.45; P.foot[s] = 0.05; P.sh[s] = -0.25; P.el[s] = -0.9; }
    P.chestX = L.old ? 0.12 : -0.04;
  } else if (v < 0.15) {
    // parado: respira, troca o peso; conversa gesticula; quem tem cuia toma chimarrão de vez em quando
    P.bob = Math.sin(a.gest * 1.7) * 0.004; P.hipYaw = Math.sin(a.gest * 0.3) * 0.05;
    if (a.state === 'grupo' || a.state === 'falar') { const g = Math.max(0, Math.sin(a.gest * 1.3)); P.sh[0] = -0.3 - g * 0.5; P.el[0] = -0.6 - g * 0.9; P.shZ[0] = 0.15; }
    if (L.cuia) { const sip = (a.gest % 9) < 2 ? 1 : 0; P.sh[1] = -0.12 - sip * 0.35; P.el[1] = -1.85 - sip * 0.5; P.shZ[1] = 0.12; }
  } else if (L.cuia) { P.sh[1] = -0.1; P.el[1] = -1.8; P.shZ[1] = 0.12; }
  // cabeça: olhar para os dois lados na esquina; olhar o jogador quando ele está perto
  let want = 0;
  if (a.state === 'esquina') want = Math.sin(a.gest * 2.2) * 0.9;
  else if (a.lookP && !far) { want = Math.atan2(player.x - a.x, player.z - a.z) - a.ang; want = Math.atan2(Math.sin(want), Math.cos(want)); want = Math.max(-1.1, Math.min(1.1, want)); }
  a.headYaw += (want - a.headYaw) * Math.min(1, dt * 4);
  P.headYaw = a.headYaw - P.chestYaw;
}

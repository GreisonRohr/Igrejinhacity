// Grafo de navegação (ruas e calçadas) gerado por scripts/build-nav.mjs. Rotas com A*.
// mode 'car': só vias de carro, respeita mão única, custo = tempo. mode 'ped': todas as vias a pé, custo = distância.
import * as THREE from 'three';

const CELL = 100;

export class NavGraph {
  constructor(data) {
    this.CAR = data.CAR; this.PED = data.PED; this.kinds = data.kinds;
    this.nodes = Float32Array.from(data.nodes);
    this.edges = data.edges;
    const N = this.nodes.length / 2;
    this.adj = Array.from({ length: N }, () => []);   // [edgeIndex, para, sentido +1 a→b / −1 b→a]
    data.edges.forEach((e, i) => { this.adj[e.a].push(i); this.adj[e.b].push(i); });
    this.grid = new Map();
    for (let i = 0; i < N; i++) { const k = this._k(this.nodes[2 * i], this.nodes[2 * i + 1]); (this.grid.get(k) || this.grid.set(k, []).get(k)).push(i); }
  }
  get nodeCount() { return this.nodes.length / 2; }
  _k(x, z) { return Math.floor(x / CELL) + ',' + Math.floor(z / CELL); }
  nodePos(i) { return [this.nodes[2 * i], this.nodes[2 * i + 1]]; }

  /** Pode percorrer a aresta e saindo do nó `from` neste modo? */
  canUse(e, from, mode) {
    const f = mode === 'car' ? this.CAR : this.PED;
    if (!(e.f & f)) return false;
    return !(mode === 'car' && e.ow && from !== e.a);
  }

  /** Nó mais próximo de (x, z) com alguma aresta usável no modo (busca em anéis de células). */
  nearest(x, z, mode = 'ped', maxDist = 600) {
    const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    let best = -1, bd = maxDist;
    for (let ring = 0; ring * CELL <= maxDist + CELL; ring++) {
      for (let i = ci - ring; i <= ci + ring; i++) for (let j = cj - ring; j <= cj + ring; j++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== ring) continue;
        for (const n of this.grid.get(i + ',' + j) || []) {
          const d = Math.hypot(this.nodes[2 * n] - x, this.nodes[2 * n + 1] - z);
          if (d < bd && this.adj[n].some(ei => this.edges[ei].f & (mode === 'car' ? this.CAR : this.PED))) { bd = d; best = n; }
        }
      }
      if (best >= 0 && bd < ring * CELL) break;
    }
    return best;
  }

  /** A*: lista de nós de `s` a `t`, ou null. */
  route(s, t, mode = 'ped') {
    if (s < 0 || t < 0) return null;
    const N = this.nodeCount, g = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const vmax = mode === 'car' ? 80 / 3.6 : 1;          // heurística admissível: distância / velocidade máxima
    const [tx, tz] = this.nodePos(t);
    const h = n => Math.hypot(this.nodes[2 * n] - tx, this.nodes[2 * n + 1] - tz) / vmax;
    const heap = new MinHeap(); g[s] = 0; heap.push(s, h(s));
    while (heap.size) {
      const u = heap.pop();
      if (u === t) break;
      if (closed[u]) continue; closed[u] = 1;
      for (const ei of this.adj[u]) {
        const e = this.edges[ei];
        if (!this.canUse(e, u, mode)) continue;
        const v = e.a === u ? e.b : e.a;
        const c = mode === 'car' ? e.len / (e.sp / 3.6) : e.len;
        if (g[u] + c < g[v]) { g[v] = g[u] + c; prev[v] = u; heap.push(v, g[v] + h(v)); }
      }
    }
    if (g[t] === Infinity) return null;
    const path = []; for (let n = t; n >= 0; n = prev[n]) path.push(n);
    path.reverse(); path.cost = g[t];
    return path;
  }

  /** Aresta entre dois nós vizinhos (a mais curta, se houver várias). */
  edgeBetween(u, v) { let best = null; for (const ei of this.adj[u]) { const e = this.edges[ei]; if ((e.a === u && e.b === v) || (e.b === u && e.a === v)) if (!best || e.len < best.len) best = e; } return best; }

  /** Polilinha [[x,z],...] de uma rota (inclui os pontos intermediários das arestas). */
  polyline(path) {
    const out = [this.nodePos(path[0])];
    for (let i = 1; i < path.length; i++) {
      const u = path[i - 1], v = path[i], e = this.edgeBetween(u, v), m = [];
      for (let j = 0; j < e.m.length; j += 2) m.push([e.m[j], e.m[j + 1]]);
      if (e.a !== u) m.reverse();
      out.push(...m, this.nodePos(v));
    }
    return out;
  }

  /** Linhas para o ?debug&nav: azul = carro, laranja = mão única, verde = só pedestre. */
  debugMesh(heightAt) {
    const pos = [], col = [], C = { car: [0.2, 0.5, 1], ow: [1, 0.55, 0.1], ped: [0.2, 0.9, 0.3] };
    for (const e of this.edges) {
      const pts = [this.nodePos(e.a)]; for (let j = 0; j < e.m.length; j += 2) pts.push([e.m[j], e.m[j + 1]]); pts.push(this.nodePos(e.b));
      const c = !(e.f & this.CAR) ? C.ped : e.ow ? C.ow : C.car;
      for (let j = 1; j < pts.length; j++) for (const q of [pts[j - 1], pts[j]]) { pos.push(q[0], heightAt(q[0], q[1]) + 1.5, q[1]); col.push(...c); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, fog: false, toneMapped: false }));
    m.renderOrder = 10; m.frustumCulled = false; m.userData.dynamic = true;
    return m;
  }
}

class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) { const K = this.k, P = this.p; let i = K.length; K.push(k); P.push(p); while (i > 0) { const j = (i - 1) >> 1; if (P[j] <= p) break; K[i] = K[j]; P[i] = P[j]; i = j; } K[i] = k; P[i] = p; }
  pop() {
    const K = this.k, P = this.p, top = K[0], lk = K.pop(), lp = P.pop(), n = K.length;
    if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && P[c + 1] < P[c]) c++; if (P[c] >= lp) break; K[i] = K[c]; P[i] = P[c]; i = c; } K[i] = lk; P[i] = lp; }
    return top;
  }
}

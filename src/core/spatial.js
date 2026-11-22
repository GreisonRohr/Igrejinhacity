// Consulta espacial única do mundo: colisores estáticos (prédios, marcos, árvores, carros parados)
// e agentes dinâmicos (NPCs, veículos, jogador). Todos os sistemas perguntam aqui.
const CELL = 50;
const key = (i, j) => i * 73856093 ^ j * 19349663;
const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };
const segDist = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };

export class Spatial {
  constructor() { this.cells = new Map(); this.count = 0; this.agents = new Map(); }

  /** Polígono fechado [[x,z],...]; top = altura do topo (câmera passa por cima); tag = origem. */
  // cam: a câmera também se afasta deste obstáculo (prédios); marcos pequenos e árvores não.
  addPolygon(p, { top = Infinity, tag = 'static', cam = false, cx, cz } = {}) {
    if (cx === undefined) { cx = 0; cz = 0; for (const q of p) { cx += q[0]; cz += q[1]; } cx /= p.length; cz /= p.length; }
    let r = 0; for (const q of p) r = Math.max(r, Math.hypot(q[0] - cx, q[1] - cz));
    this._insert({ p, cx, cz, r, top, tag, cam });
  }
  addCircle(x, z, radius, { top = Infinity, tag = 'static', cam = false } = {}) { this._insert({ circle: true, cx: x, cz: z, r: radius, top, tag, cam }); }
  _insert(it) {
    const R = it.r + 1;   // folga: consultas com raio pequeno perto da borda da célula
    const i0 = Math.floor((it.cx - R) / CELL), i1 = Math.floor((it.cx + R) / CELL), j0 = Math.floor((it.cz - R) / CELL), j1 = Math.floor((it.cz + R) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); (this.cells.get(k) || this.cells.set(k, []).get(k)).push(it); }
    this.count++;
  }

  /** Há obstáculo estático num círculo de raio r em (x, z)? */
  blocked(x, z, r = 0, camOnly = false) {
    const a = this.cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (!a) return false;
    for (const it of a) {
      if (camOnly && !it.cam) continue;
      const d = Math.hypot(x - it.cx, z - it.cz);
      if (d > it.r + r) continue;
      if (it.circle) return true;
      if (inPoly(x, z, it.p)) return true;
      if (r > 0) for (let i = 0; i < it.p.length; i++) if (segDist(x, z, it.p[i], it.p[(i + 1) % it.p.length]) < r) return true;
    }
    return false;
  }
  /** Altura do topo do obstáculo em (x, z), ou -Infinity. */
  roofAt(x, z, camOnly = false) {
    const a = this.cells.get(key(Math.floor(x / CELL), Math.floor(z / CELL)));
    if (a) for (const it of a) if ((!camOnly || it.cam) && Math.hypot(x - it.cx, z - it.cz) <= it.r && (it.circle || inPoly(x, z, it.p))) return it.top;
    return -Infinity;
  }

  /* ---------- agentes dinâmicos (reconstruídos a cada passo pelo sistema dono) ---------- */
  clearAgents() { for (const a of this.agents.values()) a.length = 0; }   // reaproveita as listas (sem lixo por passo)
  addAgent(id, x, z, r, data) { const k = key(Math.floor(x / CELL), Math.floor(z / CELL)); (this.agents.get(k) || this.agents.set(k, []).get(k)).push({ id, x, z, r, data }); }
  /** Agentes num raio (lista reutilizada: copiar se precisar guardar). */
  agentsNear(x, z, radius, out = []) {
    out.length = 0;
    const i0 = Math.floor((x - radius) / CELL), i1 = Math.floor((x + radius) / CELL), j0 = Math.floor((z - radius) / CELL), j1 = Math.floor((z + radius) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const a of this.agents.get(key(i, j)) || []) if (Math.hypot(a.x - x, a.z - z) < radius + a.r) out.push(a);
    return out;
  }
}

/** Monta a consulta única a partir dos sistemas existentes (cidade + marcos). */
export function buildSpatial(city, landmarkColliders) {
  const sp = new Spatial(), seen = new Set();
  for (const a of city.colGrid.values()) for (const it of a) {
    if (seen.has(it)) continue; seen.add(it);
    // id ≥ 0: prédio (a câmera desvia); id −1: árvore/carro parado
    sp.addPolygon(it.p, { top: it.top, tag: it.id >= 0 ? 'building' : 'prop', cam: it.id >= 0, cx: it.cx, cz: it.cz });
  }
  for (const c of landmarkColliders) {
    if (c.circle) sp.addCircle(c.circle[0], c.circle[1], c.circle[2], { tag: 'landmark' });
    else if (c.p) sp.addPolygon(c.p, { tag: 'landmark' });
  }
  return sp;
}

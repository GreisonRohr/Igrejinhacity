// TESTE (?quadras): calçada e meio-fio gerados a partir das QUADRAS do GEO Igrejinha (alinhamento predial real).
// A calçada é a faixa entre a borda da quadra e o meio-fio, com largura da lei da rua (Passeio do GEO, via r.sw); nas
// esquinas convexas o meio-fio vira arco (esquina arredondada sem regra extra). O asfalto da via vai do eixo até a
// borda da quadra, então não sobra terra entre a pista e a calçada mesmo quando o eixo do OSM está deslocado.
// Só na caixa piloto (PILOTO), para comparar com a versão estável.

export const PILOTO = { x0: -80, z0: -80, x1: 90, z1: 100 };
export const inPiloto = (x, z, m = 0) => x > PILOTO.x0 - m && x < PILOTO.x1 + m && z > PILOTO.z0 - m && z < PILOTO.z1 + m;

const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
const signedArea = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };

export class Quadras {
  /** blocks: polígonos [[x,z]...]; roads: vias urbanas do jogo (para a largura da calçada de cada lado da quadra). */
  constructor(blocks, roads, URBAN) {
    this.blocks = blocks.filter(p => p.some(([x, z]) => inPiloto(x, z, 40))).map(p => signedArea(p) < 0 ? p.slice().reverse() : p.slice());
    const rs = roads.filter(r => !r.br && URBAN.has(r.k) && r.p.some(([x, z]) => inPiloto(x, z, 60)));
    this.segs = [];
    for (const r of rs) for (let i = 0; i < r.p.length - 1; i++) this.segs.push({ a: r.p[i], b: r.p[i + 1], sw: r.sw ? (r.sw[0] + r.sw[1]) / 2 : 3 });
    // largura da calçada por aresta: a da rua mais próxima (até 25 m da borda); sem rua por perto, sem calçada
    this.edges = [];
    for (const p of this.blocks) {
      const W = p.map((a, i) => { const b = p[(i + 1) % p.length], mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; let best = null, bd = 25;
        for (const s of this.segs) { const d = segDist(mx, mz, s.a[0], s.a[1], s.b[0], s.b[1]); if (d < bd) { bd = d; best = s; } }
        return best ? Math.min(best.sw, Math.max(0, bd - 2.5)) : 0; });
      p.W = W;
      p.forEach((a, i) => this.edges.push({ a, b: p[(i + 1) % p.length], w: W[i], p }));
    }
  }
  /** Distância do eixo (x,z) até a borda de quadra na direção (dx,dz); Infinity se não há até `max`. */
  ray(x, z, dx, dz, max = 22) {
    let best = Infinity;
    for (const { a, b } of this.edges) { const ex = b[0] - a[0], ez = b[1] - a[1], den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
      const t = ((a[0] - x) * ez - (a[1] - z) * ex) / den, u = ((a[0] - x) * dz - (a[1] - z) * dx) / den; if (u >= 0 && u <= 1 && t > 0 && t < max && t < best) best = t; }
    return best;
  }
  /** Centraliza o eixo das vias (pista única) no vão real entre as quadras, só dentro do piloto. Devolve quantos vértices. */
  snap(roads, URBAN) {
    let n = 0;
    for (const r of roads) {
      if (r.br || !URBAN.has(r.k) || (r.ow && r.med)) continue;
      const p = r.p, moved = p.map(q => q.slice());
      for (let i = 0; i < p.length; i++) {
        if (!inPiloto(p[i][0], p[i][1])) continue;
        const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L, nz = (b[0] - a[0]) / L;
        const l = this.ray(p[i][0], p[i][1], nx, nz, 25), rr = this.ray(p[i][0], p[i][1], -nx, -nz, 25);
        if (l === Infinity || rr === Infinity) continue;
        const d = (l - rr) / 2; if (Math.abs(d) < 0.3 || Math.abs(d) > 8) continue;
        moved[i] = [p[i][0] + nx * d, p[i][1] + nz * d]; n++;
      }
      r.p = moved;
    }
    return n;
  }
  /** Piso por onde se anda: 0.23 na calçada da quadra, null fora dela. */
  surf(x, z) {
    if (!inPiloto(x, z, 10)) return null;
    for (const e of this.edges) if (e.w > 0 && segDist(x, z, e.a[0], e.a[1], e.b[0], e.b[1]) < e.w && !inPoly(x, z, e.p)) return 0.23;
    return null;
  }
  /** Desenha calçadas (lajota) e meio-fio. o: {heightAt, walk, curbB, colWalk, colCurb, colCorner} */
  draw(o) {
    const up = [0, 1, 0], top = 0.23, Y = (p, dy) => [p[0], o.heightAt(p[0], p[1]) + dy, p[1]], uv = p => [p[0] / 1.2, p[1] / 1.2];
    const curb = (a, b, nx, nz, col) => { const ya = o.heightAt(a[0], a[1]), yb = o.heightAt(b[0], b[1]);
      o.curbB.quad([a[0], ya + 0.08, a[1]], [b[0], yb + 0.08, b[1]], [b[0], yb + top, b[1]], [a[0], ya + top, a[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], col, 0, [nx, 0, nz]); };
    for (const p of this.blocks) {
      const n = p.length, N = p.map((a, i) => { const b = p[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[1] - a[1]) / L, -(b[0] - a[0]) / L, L]; });
      for (let i = 0; i < n; i++) {
        const a = p[i], b = p[(i + 1) % n], [nx, nz, L] = N[i], w = p.W[i]; if (w <= 0.05) continue;
        if (!inPiloto((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) continue;
        // faixa ao longo da aresta, em trechos de até 4 m (segue o terreno)
        const k = Math.max(1, Math.ceil(L / 4));
        for (let s = 0; s < k; s++) {
          const f0 = s / k, f1 = (s + 1) / k, A = [a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0], B = [a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1];
          const Ao = [A[0] + nx * w, A[1] + nz * w], Bo = [B[0] + nx * w, B[1] + nz * w];
          o.walk.quad(Y(A, top), Y(B, top), Y(Bo, top), Y(Ao, top), [uv(A), uv(B), uv(Bo), uv(Ao)], o.colWalk, 0, up);
          curb(Ao, Bo, nx, nz, o.colCurb);
        }
        // esquina: arco do meio-fio em volta do vértice seguinte (quina convexa), com a largura passando de w a w2
        const j = (i + 1) % n, [mx, mz] = N[j], w2 = p.W[j], cross = nx * mz - nz * mx;
        if (cross > 1e-3) {   // quina convexa (quadra anti-horária: as normais giram no mesmo sentido)
          let a0 = Math.atan2(nz, nx), a1 = Math.atan2(mz, mx); while (a1 < a0) a1 += Math.PI * 2;
          const steps = Math.max(2, Math.ceil((a1 - a0) / 0.2)), arc = [];
          for (let s = 0; s <= steps; s++) { const t = s / steps, an = a0 + (a1 - a0) * t, r = w + (w2 - w) * t; arc.push([b[0] + Math.cos(an) * r, b[1] + Math.sin(an) * r]); }
          for (let s = 0; s < steps; s++) {
            o.walk.tri(Y(b, top), Y(arc[s], top), Y(arc[s + 1], top), [uv(b), uv(arc[s]), uv(arc[s + 1])], o.colWalk, 0, up);
            const c0 = arc[s], c1 = arc[s + 1], tx = c1[0] - c0[0], tz = c1[1] - c0[1], l = Math.hypot(tx, tz) || 1;
            curb(c0, c1, tz / l, -tx / l, o.colCorner);
          }
        }
      }
    }
  }
}

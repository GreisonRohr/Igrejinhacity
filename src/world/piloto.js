// PILOTO de reconstrução urbana pelas quadras oficiais (dados de scripts/build-piloto.mjs → data/piloto.data.json).
// Ligado só com ?piloto ou no build experimental (VITE_PILOTO=1); o Centro 7 continua igual sem ele.
// Na caixa piloto, asfalto, calçada, canteiro e meio-fio vêm prontos do build (trapézios sem sobreposição, alinhados
// à grade do terreno); aqui só se levanta cada vértice até o terreno e se distribui nos construtores dos chunks.
export class Piloto {
  constructor(data) {
    this.d = data; this.box = data.box;
    const g = data.grid, bin = atob(g.b64); this.grid = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) this.grid[i] = bin.charCodeAt(i);
    this.gc = g.cell; this.gw = g.w; this.gh = g.h;
    this.ringRoads = new Set((data.rings || []).flat());   // vias do anel das rótulas (sem pintura de faixa)
    this.zebras = [];
  }
  inBox(x, z, m = 0) { const b = this.box; return x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m; }
  /** 0 lote, 1 asfalto, 2 calçada, 3 canteiro de concreto, 4 canteiro gramado; -1 fora da caixa */
  cls(x, z) { const i = Math.floor((x - this.box.x0) / this.gc), j = Math.floor((z - this.box.z0) / this.gc); return i < 0 || j < 0 || i >= this.gw || j >= this.gh ? -1 : this.grid[j * this.gw + i]; }
  /** piso por onde se anda (como City.surfOffset); null fora da caixa */
  surf(x, z) { const c = this.cls(x, z); return c < 0 ? null : c === 1 ? 0.08 : c >= 2 ? 0.23 : 0; }
  /** Troca o traçado das vias corrigidas (só se os dados conferem com o world.json carregado). */
  applyRoads(world) {
    const ok = this.d.orig.every(([ri, p]) => { const r = world.roads[ri]; return r && r.p.length === p.length && r.p[0][0] === p[0][0] && r.p[0][1] === p[0][1]; });
    if (!ok) { console.warn('piloto: world.json diferente do usado no build; piloto desligado'); return false; }
    for (const [ri, p] of this.d.roads) world.roads[ri].p = p;
    // prédios do cadastro que passavam da linha da quadra (até 4 m) voltam para dentro do lote
    for (const [bi, p0] of this.d.borig || []) { const b = world.buildings[bi]; if (!b || b.p[0][0] !== p0[0] || b.p[0][1] !== p0[1]) return true; }
    for (const [bi, p] of this.d.buildings || []) { const b = world.buildings[bi]; b.p = p; delete b.rect; }
    return true;
  }
  /** Faixa de pedestre: no piloto, não repete outra a menos de 5 m (rótulas e cruzamentos com muitos braços). */
  zebraOk(x, z) { if (!this.inBox(x, z)) return true; if (this.zebras.some(([a, b]) => Math.hypot(a - x, b - z) < 5)) return false; this.zebras.push([x, z]); return true; }
  /** Poste: do eixo para fora até a calçada; devolve [x, z] 0,5 m depois do meio-fio, ou null. */
  lampSpot(ax, az, nx, nz, half) {
    for (let t = half; t < half + 14; t += 0.25) { const x = ax + nx * t, z = az + nz * t, c = this.cls(x, z); if (c === 0) return null; if (c === 2) { const x2 = x + nx * 0.5, z2 = z + nz * 0.5; return this.cls(x2, z2) === 2 ? [x2, z2] : [x, z]; } }
    return null;
  }
  /**
   * Desenha na cidade. o: { chunk(x,z), heightAt, inCentro(x,z), C (cores), cobbleAt(x,z) → bool }
   */
  draw(o) {
    const up = [0, 1, 0], { C } = o, d = this.d;
    const lift = (x, z, dy) => [x, o.heightAt(x, z) + dy, z];
    const quads = (arr, pick) => {
      for (let i = 0; i < arr.length; i += 8) {
        const xs = [arr[i], arr[i + 2], arr[i + 4], arr[i + 6]], zs = [arr[i + 1], arr[i + 3], arr[i + 5], arr[i + 7]];
        const mx = (xs[0] + xs[1] + xs[2] + xs[3]) / 4, mz = (zs[0] + zs[1] + zs[2] + zs[3]) / 4, [B, col, dy, s] = pick(mx, mz);
        const P = [0, 1, 2, 3].map(k => lift(xs[k], zs[k], dy)), U = [0, 1, 2, 3].map(k => [xs[k] / s, zs[k] / s]);
        // trapézio com lado degenerado vira triângulo
        if (Math.hypot(xs[0] - xs[1], zs[0] - zs[1]) < 1e-3) B.tri(P[0], P[2], P[3], [U[0], U[2], U[3]], col, 0, up);
        else if (Math.hypot(xs[2] - xs[3], zs[2] - zs[3]) < 1e-3) B.tri(P[0], P[1], P[2], [U[0], U[1], U[2]], col, 0, up);
        else B.quad(P[0], P[1], P[2], P[3], U, col, 0, up);
      }
    };
    const asphC = C.asphalt.clone().multiplyScalar(0.72);
    quads(d.asph, (x, z) => { const ch = o.chunk(x, z); return o.cobbleAt(x, z) ? [ch.cobble, C.pedra, 0.08, 2.5] : [ch.roads, o.inCentro(x, z) ? asphC : C.asphalt, 0.08, 4]; });
    quads(d.walk, (x, z) => { const ch = o.chunk(x, z), c = o.inCentro(x, z); return [c ? ch.walkC : ch.walk, c ? C.sideC : C.side, 0.23, 1.2]; });
    quads(d.med, (x, z) => [o.chunk(x, z).roads, C.island, 0.23, 4]);
    quads(d.medG || [], (x, z) => [o.chunk(x, z).roads, C.median, 0.23, 4]);
    // meio-fio: face vertical voltada para o asfalto (lado de fora do contorno, já decidido no build)
    const cb = d.curbs;
    for (let i = 0; i < cb.length; i += 5) {
      const ax = cb[i], az = cb[i + 1], bx = cb[i + 2], bz = cb[i + 3], mx = (ax + bx) / 2, mz = (az + bz) / 2;
      let nx = bz - az, nz = -(bx - ax); const L = Math.hypot(nx, nz) || 1; nx /= L; nz /= L;
      if (this.cls(mx + nx * 0.3, mz + nz * 0.3) !== 1) { nx = -nx; nz = -nz; }
      const ya = o.heightAt(ax, az), yb = o.heightAt(bx, bz), B = o.chunk(mx, mz).roads;
      B.quad([ax, ya + 0.08, az], [bx, yb + 0.08, bz], [bx, yb + 0.23, bz], [ax, ya + 0.23, az], [[0, 0], [1, 0], [1, 1], [0, 1]], cb[i + 4] ? C.yellow : C.curb, 0, [nx, 0, nz]);
    }
  }
}

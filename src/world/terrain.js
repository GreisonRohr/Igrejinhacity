// Terreno real (Terrarium) em chunks com LOD por distância e "saias" para esconder emendas.
import * as THREE from 'three';

const CH = 64;                 // células por chunk (64 × 10 m = 640 m)
const LODS = [                 // distância máxima do centro do chunk → passo da grade
  [900, 1], [1800, 2], [3600, 4], [Infinity, 8],
];
const SKIRT = 25;

export class Terrain {
  static async load(base) {
    const [meta, buf] = await Promise.all([
      fetch(base + 'data/terrain.json').then(r => r.json()),
      fetch(base + 'data/terrain.bin').then(r => r.arrayBuffer()),
    ]);
    return new Terrain(meta, new Int16Array(buf));
  }

  constructor(meta, q) {
    Object.assign(this, meta);
    this.h = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) this.h[i] = q[i] * meta.scale;
    this.minX = this.x0; this.minZ = this.z0;
    this.maxX = this.x0 + (this.nx - 1) * this.cell; this.maxZ = this.z0 + (this.nz - 1) * this.cell;
    this.group = new THREE.Group();
    this.chunks = [];
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
  }

  /** Altura do grid bruto (índices inteiros, com clamp). */
  hi(i, j) {
    i = i < 0 ? 0 : i >= this.nx ? this.nx - 1 : i;
    j = j < 0 ? 0 : j >= this.nz ? this.nz - 1 : j;
    return this.h[j * this.nx + i];
  }

  /** Altura do chão em metros (interpolação bilinear). */
  heightAt(x, z) {
    const fx = (x - this.x0) / this.cell, fz = (z - this.z0) / this.cell;
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const a = this.hi(i, j), b = this.hi(i + 1, j), c = this.hi(i, j + 1), d = this.hi(i + 1, j + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  inside(x, z, margin = 0) {
    return x > this.minX + margin && x < this.maxX - margin && z > this.minZ + margin && z < this.maxZ - margin;
  }

  build() {
    const ncx = Math.ceil((this.nx - 1) / CH), ncz = Math.ceil((this.nz - 1) / CH);
    for (let cj = 0; cj < ncz; cj++) for (let ci = 0; ci < ncx; ci++) {
      const i0 = ci * CH, j0 = cj * CH, i1 = Math.min(i0 + CH, this.nx - 1), j1 = Math.min(j0 + CH, this.nz - 1);
      const mesh = new THREE.Mesh(undefined, this.material);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      const c = { i0, j0, i1, j1, mesh, lod: -1, geos: {},
        cx: this.x0 + (i0 + i1) / 2 * this.cell, cz: this.z0 + (j0 + j1) / 2 * this.cell };
      this.setLod(c, 3);
      this.group.add(mesh);
      this.chunks.push(c);
    }
    return this.group;
  }

  /** Atualiza LOD conforme a posição da câmera (barato: chamado algumas vezes por segundo). */
  update(px, pz) {
    for (const c of this.chunks) {
      const d = Math.max(0, Math.hypot(px - c.cx, pz - c.cz) - CH * this.cell * 0.5);
      let lod = 0; while (d > LODS[lod][0]) lod++;
      if (lod !== c.lod) this.setLod(c, lod);
    }
  }

  setLod(c, lod) {
    if (!c.geos[lod]) c.geos[lod] = this.chunkGeometry(c, LODS[lod][1]);
    // libera a geometria de alta resolução que não está mais em uso
    if (c.lod === 0 && lod !== 0) { c.geos[0].dispose(); delete c.geos[0]; }
    c.mesh.geometry = c.geos[lod];
    c.lod = lod;
  }

  chunkGeometry({ i0, j0, i1, j1 }, step) {
    const is = [], js = [];
    for (let i = i0; i < i1; i += step) is.push(i); is.push(i1);
    for (let j = j0; j < j1; j += step) js.push(j); js.push(j1);
    const W = is.length, Hn = js.length;
    const nv = W * Hn + 2 * (W + Hn);
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const idx = [];
    const tmp = new THREE.Color();
    let k = 0;
    const put = (i, j, drop) => {
      const x = this.x0 + i * this.cell, z = this.z0 + j * this.cell, y = this.hi(i, j);
      pos[k * 3] = x; pos[k * 3 + 1] = y - drop; pos[k * 3 + 2] = z;
      // normal analítica no grid original (igual em todos os LODs → menos emendas visíveis)
      const dx = this.hi(i + 1, j) - this.hi(i - 1, j), dz = this.hi(i, j + 1) - this.hi(i, j - 1);
      const nx = -dx, ny = 2 * this.cell, nz = -dz, l = Math.hypot(nx, ny, nz);
      nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
      groundColor(y, ny / l, i * 7.13 + j * 3.71, tmp);
      col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
      return k++;
    };
    for (const j of js) for (const i of is) put(i, j, 0);
    for (let b = 0; b < Hn - 1; b++) for (let a = 0; a < W - 1; a++) {
      const p = b * W + a;
      idx.push(p, p + W, p + 1, p + 1, p + W, p + W + 1);
    }
    // saias nas quatro bordas
    const skirt = (list) => {
      const base = k;
      for (const [i, j] of list) put(i, j, SKIRT);
      return base;
    };
    const edge = (ids, coords, flip) => {
      const s = skirt(coords);
      for (let n = 0; n < ids.length - 1; n++) {
        const a = ids[n], b = ids[n + 1], c = s + n, d = s + n + 1;
        if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
      }
    };
    const top = is.map((_, a) => a), bottom = is.map((_, a) => (Hn - 1) * W + a);
    const left = js.map((_, b) => b * W), right = js.map((_, b) => b * W + W - 1);
    edge(top, is.map(i => [i, js[0]]), true);
    edge(bottom, is.map(i => [i, js[Hn - 1]]), false);
    edge(left, js.map(j => [is[0], j]), false);
    edge(right, js.map(j => [is[W - 1], j]), true);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, k * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, k * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, k * 3), 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
  }
}

const RAMP = [
  [20, 0x8fbf5a], [60, 0x76a64e], [160, 0x5b8f3f], [350, 0x4a7a36], [550, 0x587a3c], [750, 0x7f8a5a],
].map(([h, c]) => [h, new THREE.Color(c)]);
const ROCK = new THREE.Color(0x8a8270);

function groundColor(h, ny, seed, out) {
  let q = 0; while (q < RAMP.length - 2 && h > RAMP[q + 1][0]) q++;
  const [a0, c0] = RAMP[q], [a1, c1] = RAMP[q + 1];
  out.copy(c0).lerp(c1, Math.min(1, Math.max(0, (h - a0) / (a1 - a0))));
  const steep = Math.min(1, Math.max(0, (0.82 - ny) / 0.2));  // encostas íngremes → pedra
  if (steep > 0) out.lerp(ROCK, steep * 0.7);
  const n = Math.sin(seed * 12.9898) * 43758.5453;
  out.offsetHSL(0, 0, ((n - Math.floor(n)) - 0.5) * 0.04);
  return out;
}

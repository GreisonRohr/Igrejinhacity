// Acumulador de geometria: junta milhares de peças num único BufferGeometry (1 draw call).
import * as THREE from 'three';

export class GeoBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.lit = []; this.idx = []; this.count = 0; }

  vert(x, y, z, nx, ny, nz, u, v, col, lit = 0) {
    this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v);
    this.c.push(col.r, col.g, col.b); this.lit.push(lit);
    return this.count++;
  }

  /** Quadrilátero plano a,b,c,d (sentido anti-horário visto de fora). */
  quad(a, b, c, d, uvs, col, lit = 0, face = null) {
    let n = normal(a, b, c);
    // garante que a face aponte para "face" (vetor aproximado para fora)
    if (face && n[0] * face[0] + n[1] * face[1] + n[2] * face[2] < 0) { [b, d] = [d, b]; uvs = [uvs[0], uvs[3], uvs[2], uvs[1]]; n = n.map(v => -v); }
    const i = this.count;
    for (let k = 0; k < 4; k++) { const q = [a, b, c, d][k]; this.vert(q[0], q[1], q[2], n[0], n[1], n[2], uvs[k][0], uvs[k][1], col, lit); }
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  tri(a, b, c, uvs, col, lit = 0, face = null) {
    let n = normal(a, b, c);
    if (face && n[0] * face[0] + n[1] * face[1] + n[2] * face[2] < 0) { [b, c] = [c, b]; uvs = [uvs[0], uvs[2], uvs[1]]; n = n.map(v => -v); }
    const i = this.count;
    for (let k = 0; k < 3; k++) { const q = [a, b, c][k]; this.vert(q[0], q[1], q[2], n[0], n[1], n[2], uvs[k][0], uvs[k][1], col, lit); }
    this.idx.push(i, i + 1, i + 2);
  }

  /** Caixa orientada: centro (cx, cy = base, cz), largura w (ao longo de ux,uz), altura h, profundidade d. */
  box(cx, cy, cz, w, h, d, ux, uz, col, uvScale = 1) {
    const vx = -uz, vz = ux, hw = w / 2, hd = d / 2;
    const P = (a, b, y) => [cx + ux * a + vx * b, cy + y, cz + uz * a + vz * b];
    const u = (a, b) => [[0, 0], [a * uvScale, 0], [a * uvScale, b * uvScale], [0, b * uvScale]];
    this.quad(P(-hw, -hd, h), P(hw, -hd, h), P(hw, hd, h), P(-hw, hd, h), u(w, d), col, 0, [0, 1, 0]);
    this.quad(P(-hw, -hd, 0), P(hw, -hd, 0), P(hw, hd, 0), P(-hw, hd, 0), u(w, d), col, 0, [0, -1, 0]);
    this.quad(P(-hw, hd, 0), P(hw, hd, 0), P(hw, hd, h), P(-hw, hd, h), u(w, h), col, 0, [vx, 0, vz]);
    this.quad(P(-hw, -hd, 0), P(hw, -hd, 0), P(hw, -hd, h), P(-hw, -hd, h), u(w, h), col, 0, [-vx, 0, -vz]);
    this.quad(P(hw, -hd, 0), P(hw, hd, 0), P(hw, hd, h), P(hw, -hd, h), u(d, h), col, 0, [ux, 0, uz]);
    this.quad(P(-hw, -hd, 0), P(-hw, hd, 0), P(-hw, hd, h), P(-hw, -hd, h), u(d, h), col, 0, [-ux, 0, -uz]);
  }

  build() {
    if (!this.count) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('lit', new THREE.Float32BufferAttribute(this.lit, 1));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

function normal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
  const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l];
}

/** Material Lambert com emissivo multiplicado por um atributo por vértice ("lit": janela acesa ou não). */
export function litMaterial(opts, styles = 1, region = null) {
  // atributo "lit": parte inteira/2 = estilo de janela (coluna do atlas, quando styles > 1); resto = janela acesa à noite
  const m = new THREE.MeshLambertMaterial(opts);
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float lit;\nvarying float vLit;\nvarying float vStyle;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLit = mod(lit, 2.0);\nvStyle = floor(lit / 2.0 + 0.01);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLit;\nvarying float vStyle;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vLit;');
    if (region) {
      // região de detalhe (centro): reboco com grão e manchas, base da parede mais suja (respingo da chuva)
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      const R = region, f = v => v.toFixed(1);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP;
float hR(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nR(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hR(i), hR(i + vec2(1, 0)), f.x), mix(hR(i + vec2(0, 1)), hR(i + vec2(1, 1)), f.x), f.y); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
if (vWP.x > ${f(R.x0)} && vWP.x < ${f(R.x1)} && vWP.z > ${f(R.z0)} && vWP.z < ${f(R.z1)}) {
  vec2 q = vec2(vWP.x + vWP.z, vWP.y);
  float grain = 0.94 + 0.06 * hR(floor(q * 60.0)) + 0.07 * (nR(q * 0.9) - 0.5) + 0.05 * (nR(q * 4.0) - 0.5);
  float streak = 1.0 - 0.06 * smoothstep(0.55, 1.0, nR(vec2(q.x * 3.0, q.y * 0.25)));
  float base = mix(0.8, 1.0, smoothstep(0.0, 0.32, vMapUv.y));
  diffuseColor.rgb *= grain * streak * base;
}`);
    }
    if (styles > 1) {
      const N = styles.toFixed(1);
      // amostra a coluna do estilo; textureGrad com as derivadas do UV contínuo evita linha na emenda das baias
      const S = (tex, uv) => `textureGrad(${tex}, vec2((fract(${uv}.x) + vStyle) / ${N}, ${uv}.y), dFdx(${uv}) * vec2(1.0 / ${N}, 1.0), dFdy(${uv}) * vec2(1.0 / ${N}, 1.0))`;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <map_fragment>', `#ifdef USE_MAP\n diffuseColor *= ${S('map', 'vMapUv')};\n#endif`)
        .replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP\n totalEmissiveRadiance *= ${S('emissiveMap', 'vEmissiveMapUv')}.rgb;\n#endif`);
    }
  };
  if (styles > 1 || region) m.customProgramCacheKey = () => 'lit-styles-' + styles + (region ? '-r' : '');
  return m;
}

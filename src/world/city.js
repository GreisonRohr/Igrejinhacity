// Cidade em 3D a partir do world.json: rio escavado no terreno, ruas com calçada, pontes e prédios.
// Tudo é mesclado por região (chunks de 400 m) → poucas draw calls; regiões distantes somem.
import * as THREE from 'three';
import { GeoBuilder, litMaterial } from './geo-builder.js';
import { editHeights } from './terrain.js';
import { freeAfterUpload } from './merge.js';
import { inCentro, CENTRO } from './centro.js';
import { signAtlas, SOBRADO_CORES, LOJAS_FOTOS } from './fachadas.js';

const CHUNK = 600, FAR_CHUNK = 1500, FAR_R = 1500;
// Piloto do upgrade visual (centro): sombra de contato, lojas no térreo e muros/portões das casas até PILOT_R da praça
export const PILOT_R = 650;
const LAMP_R = 380;   // postes desenhados só até esta distância da câmera
const WIN_STYLES = 4;
const DOORS = [0x5a3d2b, 0x7a4e2e, 0xf2f0ea, 0x2f5d3a, 0x2b2e33, 0x8c5a3c].map(c => new THREE.Color(c));
const TRIM = { white: new THREE.Color(0xf2f0ea), wood: new THREE.Color(0x5a4030), gutter: new THREE.Color(0xa9adb0), tank: new THREE.Color(0x5f9ccf) };
const SHOP_TINTS = [0xd8352a, 0x1f6fb5, 0xf2b01e, 0x2e8b57, 0x8e44ad, 0xe67e22, 0x16a085, 0xc0392b, 0xf4f1ea, 0x34495e, 0xff6f61, 0x27ae60];
const hash = (x, z) => { const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return v - Math.floor(v); };   // sorteio fixo por posição
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const segDist = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2)) : 0;
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
};
const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; };

let seed = 99;
const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = a => a[Math.floor(rand() * a.length)];

const WALLS = [0xf4f0e6, 0xf2e6c4, 0xf0dcc8, 0xe4ece3, 0xf7f2dc, 0xecd2b0, 0xdbe6f0, 0xd5e3cc, 0xf6e9d8, 0xffffff, 0xf3d9d9].map(c => new THREE.Color(c));
const COM_WALLS = [0xf4f0e6, 0xe9e2d4, 0xf2e6c4, 0xdedad2, 0xf0dcc8, 0xd9e2ea].map(c => new THREE.Color(c));
const IND_WALLS = [0xe9ebee, 0xdfe3e8, 0xf2f2f0, 0xd8dde3].map(c => new THREE.Color(c));
const ROOFS = [0xa4452c, 0x8a3b26, 0xb5553a, 0x9a5a3b, 0x7a3a28, 0xa85a32, 0x6b4a3a].map(c => new THREE.Color(c));
const FLAT = [0x9d9a92, 0xb0aca4, 0x8c8a86].map(c => new THREE.Color(c));
const METAL = [0x8e98a4, 0xa9b2bb, 0x6f8fa8].map(c => new THREE.Color(c));
const C = {
  asphalt: new THREE.Color(0x55585c), dirt: new THREE.Color(0xa08660), path: new THREE.Color(0xc2ad86),
  side: new THREE.Color(0xd4d0c8), sideC: new THREE.Color(0xa9a6a0), curb: new THREE.Color(0xdcd8cf), line: new THREE.Color(0xf0f0ea), yellow: new THREE.Color(0xf2d24b),
  concrete: new THREE.Color(0xb9b6ae), plain: new THREE.Color(0xffffff), pool: new THREE.Color(0x7fd6ff),
  pedra: new THREE.Color(0x8a8378), metal: new THREE.Color(0x9aa0a6), concreteDark: new THREE.Color(0x8f8c85), bloco: new THREE.Color(0xa29d94), median: new THREE.Color(0x6f9e4c),
};

const URBAN = new Set(['primary', 'secondary', 'tertiary', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link']);
const MARKED = new Set(['primary', 'secondary', 'tertiary']);

function windowTextures() {
  // atlas de 4 estilos de janela lado a lado (64 px cada; o shader escolhe a coluna pelo estilo do prédio):
  // 0 janela com moldura branca · 1 venezianas de madeira · 2 par alto com verga em arco (influência germânica)
  // 3 de correr moderna, alumínio. Uma "baia" de 3,5 m × 1 andar de 3,1 m; embaixo (v < 0,25) fica parede lisa em todos.
  const W = 64 * WIN_STYLES;
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = W; c.height = 64; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const map = mk(g => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, 64); g.fillStyle = '#e8e2d6'; g.fillRect(0, 60, W, 4);
    // 0
    g.fillStyle = '#f3efe8'; g.fillRect(17, 11, 30, 34); g.fillStyle = '#56667a'; g.fillRect(20, 14, 24, 28);
    g.fillStyle = '#7d8fa3'; g.fillRect(20, 14, 24, 8); g.fillStyle = '#eeeae2'; g.fillRect(31, 14, 2, 28); g.fillRect(16, 44, 32, 3);
    // 1 venezianas
    let x = 64; g.fillStyle = '#4a3a2c'; g.fillRect(x + 22, 13, 20, 30); g.fillStyle = '#5d7080'; g.fillRect(x + 24, 15, 16, 26);
    for (const sx of [x + 9, x + 43]) { g.fillStyle = '#3e6b4c'; g.fillRect(sx, 12, 12, 32); g.fillStyle = '#2f553b'; for (let y = 14; y < 43; y += 3) g.fillRect(sx + 1, y, 10, 1); }
    g.fillStyle = '#d9d2c3'; g.fillRect(x + 8, 44, 48, 3);
    // 2 par alto com arco
    x = 128; for (const sx of [x + 14, x + 35]) { g.fillStyle = '#5a3e2b'; g.fillRect(sx - 2, 12, 19, 33); g.beginPath(); g.arc(sx + 7.5, 12, 9.5, Math.PI, 0); g.fill();
      g.fillStyle = '#4e6272'; g.fillRect(sx, 13, 15, 30); g.beginPath(); g.arc(sx + 7.5, 13, 7.5, Math.PI, 0); g.fill(); g.fillStyle = '#5a3e2b'; g.fillRect(sx + 6.5, 6, 2, 37); }
    g.fillStyle = '#cfc6b4'; g.fillRect(x + 10, 44, 44, 3);
    // 3 de correr
    x = 192; g.fillStyle = '#b9bcbf'; g.fillRect(x + 8, 16, 48, 26); g.fillStyle = '#2d3b46'; g.fillRect(x + 10, 18, 21, 22); g.fillRect(x + 33, 18, 21, 22);
    g.fillStyle = '#56707f'; g.fillRect(x + 10, 18, 21, 6); g.fillRect(x + 33, 18, 21, 6); g.fillStyle = '#a7a9ab'; g.fillRect(x + 7, 42, 50, 2);
  });
  const emissive = mk(g => { g.fillStyle = '#000'; g.fillRect(0, 0, W, 64); g.fillStyle = '#ffc874';
    g.fillRect(20, 14, 24, 28); g.fillRect(64 + 24, 15, 16, 26); g.fillRect(128 + 14, 13, 15, 30); g.fillRect(128 + 35, 13, 15, 30); g.fillRect(192 + 10, 18, 44, 22); });
  return { map, emissive };
}

const noiseTex = (size, draw) => { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
/** Asfalto: grão fino, manchas de desgaste e remendos (multiplica a cor do vértice). */
function asphaltTexture() {
  // asfalto usado: agregado fino, manchas de óleo, remendos retangulares mais escuros, trincas e desgaste claro
  return noiseTex(512, (g, S) => {
    const im = g.createImageData(S, S); let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < S * S; i++) { const v = 200 + r() * 45 - (r() < 0.05 ? 55 : 0) + (r() < 0.02 ? 30 : 0); im.data[i * 4] = v; im.data[i * 4 + 1] = v; im.data[i * 4 + 2] = v - 2; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    for (let k = 0; k < 26; k++) { g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.06})`; g.beginPath(); g.ellipse(r() * S, r() * S, 14 + r() * 70, 8 + r() * 40, r() * 3, 0, 7); g.fill(); }        // manchas
    for (let k = 0; k < 10; k++) { g.fillStyle = `rgba(255,255,250,${0.03 + r() * 0.05})`; g.beginPath(); g.ellipse(r() * S, r() * S, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, 7); g.fill(); }   // desgaste claro
    for (let k = 0; k < 4; k++) { const w = 30 + r() * 90, h = 20 + r() * 50, x = r() * S, y = r() * S; g.fillStyle = 'rgba(20,20,22,0.18)'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.strokeRect(x, y, w, h); }   // remendos
    for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(10,10,12,${0.12 + r() * 0.12})`; g.beginPath(); g.ellipse(r() * S, r() * S, 4 + r() * 9, 3 + r() * 6, r() * 3, 0, 7); g.fill(); }   // óleo
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; for (let k = 0; k < 7; k++) { g.beginPath(); let x = r() * S, y = r() * S; g.moveTo(x, y); for (let j = 0; j < 8; j++) { x += (r() - 0.5) * 34; y += (r() - 0.3) * 22; g.lineTo(x, y); } g.stroke(); }   // trincas
  });
}
/** Fachada de loja (térreo): letreiro claro (tingido pela cor do vértice), vidro, porta e beiral; 1 baia = 5 m. */
function shopTextures() {
  const mk = (draw) => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const map = mk(g => {
    g.fillStyle = '#e9e6df'; g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#ffffff'; g.fillRect(4, 3, 120, 13);                                   // letreiro (cor da loja)
    g.fillStyle = 'rgba(0,0,0,0.55)'; for (let i = 0; i < 7; i++) g.fillRect(14 + i * 14, 7, 9, 5);   // letras
    g.fillStyle = '#2c3a44'; g.fillRect(6, 20, 74, 40); g.fillStyle = '#5d7686'; g.fillRect(6, 20, 74, 10);   // vitrine
    g.fillStyle = '#d8d4cc'; g.fillRect(42, 20, 3, 40);
    g.fillStyle = '#3a3f44'; g.fillRect(88, 22, 30, 42); g.fillStyle = '#6b7580'; for (let y = 24; y < 64; y += 4) g.fillRect(89, y, 28, 1);   // porta de enrolar
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(10, 60); g.lineTo(30, 20); g.lineTo(38, 20); g.lineTo(18, 60); g.fill();
  });
  const emissive = mk(g => { g.fillStyle = '#000'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#fff2d0'; g.fillRect(4, 3, 120, 13); g.fillStyle = '#ffd9a0'; g.fillRect(6, 20, 74, 40); });
  return { map, emissive };
}
/** Degradê da sombra de contato (oclusão ambiente "assada" no chão junto às paredes). */
function aoTexture() { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 64, 0, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#777'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(c); }
/** Calçada de lajotas/blocos de concreto (1,2 m por repetição). */
function paverTexture() {
  return noiseTex(128, (g, S) => {
    let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = '#8f8a82'; g.fillRect(0, 0, S, S);
    const q = S / 3;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { const v = 228 + r() * 22; g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(x * q + 1.5, y * q + 1.5, q - 3, q - 3); }
  });
}
function concreteTexture() {
  return noiseTex(128, (g, S) => {
    const im = g.createImageData(S, S); let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < S * S; i++) { const v = 222 + r() * 33; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, S - 3, S, 3);
  });
}

/** Pedra irregular (paralelepípedo de basalto), típica das ruas de Igrejinha. */
function cobbleTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#6d6a64'; g.fillRect(0, 0, 128, 128);
  let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 128; y += 16) for (let x = -8; x < 128; x += 16) {
    const ox = (y / 16) % 2 ? 8 : 0, l = 150 + r() * 70;
    g.fillStyle = `rgb(${l},${l * 0.97},${l * 0.92})`;
    g.beginPath(); g.roundRect(x + ox + 1 + r() * 2, y + 1 + r() * 2, 12 + r() * 2, 12 + r() * 2, 4); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function roofTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 32; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, 28, 32, 4);
  g.fillStyle = 'rgba(0,0,0,0.07)'; for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 1, 28);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/**
 * Texturas reais (Poly Haven, CC0 — public/textures/ground/CREDITOS.txt): mapa de detalhe em luminância (média 0,5) +
 * mapa normal. A cor continua vindo do vértice (cada rua/calçada/telhado com seu tom); o material dobra o detalhe.
 * `unit` = metros por unidade de UV da malha; `size` = metros que a foto cobre.
 */
const TEX_DIR = (import.meta.env?.BASE_URL || '/') + 'textures/ground/';
function realSurface(mat, name, unit, size, { normal = 0.9, repeat = null } = {}) {
  const L = new THREE.TextureLoader(), rep = repeat || [unit / size, unit / size];
  const prep = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; return t; };
  const map = prep(L.load(TEX_DIR + name + '.webp')); map.colorSpace = THREE.NoColorSpace;   // detalhe linear (não é cor)
  const nrm = prep(L.load(TEX_DIR + name + '_n.webp'));
  mat.map = map; mat.normalMap = nrm; mat.normalScale.set(normal, normal); mat.color.setScalar(2); mat.needsUpdate = true;
  return mat;
}

export class City {
  constructor(world, terrain, { buildDist = 3500, roadDist = 950 } = {}, exclusions = []) {
    this.world = world; this.t = terrain;
    this.exclusions = exclusions;     // pontos marcantes com modelo próprio: o prédio genérico sai
    this.buildDist = buildDist; this.roadDist = roadDist; this.detailDist = Math.min(400, roadDist * 0.5);
    this.group = new THREE.Group();
    this.chunks = new Map();
    this.colGrid = new Map();
    const tex = windowTextures();
    this.wallMat = litMaterial({ vertexColors: true, map: tex.map, emissive: 0xffffff, emissiveMap: tex.emissive, emissiveIntensity: 0 }, WIN_STYLES, CENTRO);
    const st = shopTextures();
    this.shopMat = litMaterial({ vertexColors: true, map: st.map, emissive: 0xffffff, emissiveMap: st.emissive, emissiveIntensity: 0 });
    this.aoMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, alphaMap: aoTexture(), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    this._fronts = []; this._plants = [];
    this.roofMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: roofTexture() });
    this.roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: asphaltTexture(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    this.walkMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: paverTexture(), polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
    this.markMat = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    this.bridgeMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: concreteTexture() });
    this.cobbleMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: cobbleTexture(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
    // superfícies com foto real + relevo (asfalto 4 m/UV, paralelepípedo 2,5 m, calçada 1,2 m, telha 1,2 × 0,4 m)
    realSurface(this.roadMat, 'asfalto', 4, 3.0, { normal: 0.7 });
    realSurface(this.cobbleMat, 'paralelepipedo', 2.5, 2.4, { normal: 1.1 });
    realSurface(this.walkMat, 'bloquete', 1.2, 2.0, { normal: 0.9 });
    // centro: letreiros (atlas com nomes reais do cadastro + tipos de comércio) e sobrados do patrimônio
    const places = (this.world.places || []).filter(q => inCentro(q.x, q.z, 10));
    this._shopsC = [...LOJAS_FOTOS.map(l => ({ ...l, k: 'loja' })), ...places.filter(q => /loja|banco|farmacia|mercado|restaurante|bar|cafe/.test(q.k) && q.n && q.n.length < 26)];
    this._heritage = places.filter(q => q.k === 'patrimonio' && !/pra[cç]a/i.test(q.n));
    this.signs = signAtlas(['PICCADILLY', ...this._shopsC.map(q => q.n.toUpperCase().replace(' %', ''))]);
    this.signMat = new THREE.MeshLambertMaterial({ map: this.signs.tex, emissive: 0xffffff, emissiveMap: this.signs.tex, emissiveIntensity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    // centro: lajota de concreto cinza em placas (como nas fotos da praça e do entorno)
    this.walkCMat = realSurface(new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }), 'lajota', 1.2, 1.8, { normal: 1.0 });
    realSurface(this.roofMat, 'telha', 1, 2.5, { normal: 1.0, repeat: [1.2 / 2.5, 0.4 / 2.5] });
    this.waterMat = new THREE.MeshPhongMaterial({ vertexColors: true, color: 0x3f7fb0, specular: 0x9fc6e8, shininess: 60, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  }

  /** Região de 600 m. Prédios longe do centro (far) vão para regiões de 1,5 km: menos malhas (chamadas de desenho)
   *  onde não há sombra nem detalhe de perto. */
  chunk(x, z, far = false) {
    const S = far && Math.hypot(x, z) > FAR_R ? FAR_CHUNK : CHUNK;
    const k = (S === CHUNK ? '' : 'F') + Math.floor(x / S) + ',' + Math.floor(z / S);
    let c = this.chunks.get(k);
    if (!c) this.chunks.set(k, c = { walls: new GeoBuilder(), roofs: new GeoBuilder(), shops: new GeoBuilder(), ao: new GeoBuilder(), roads: new GeoBuilder(), cobble: new GeoBuilder(), walk: new GeoBuilder(), walkC: new GeoBuilder(), signs: new GeoBuilder(), marks: new GeoBuilder(), bridge: new GeoBuilder(), cx: (Math.floor(x / S) + 0.5) * S, cz: (Math.floor(z / S) + 0.5) * S, size: S, meshes: [] });
    return c;
  }

  /** Fim da carga: a cópia do relevo original (11 MB) vira só as células que mudaram (rio, valão, praça). */
  compactOrig() {
    const tt = this._orig, t = this.t; if (!tt || !tt.h) return 0;
    const diff = new Map(), a = tt.h, b = t.h;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.set(i, a[i]);
    tt.h = null; this._orig = null;
    tt.hi = function (i, j) { i = i < 0 ? 0 : i >= t.nx ? t.nx - 1 : i; j = j < 0 ? 0 : j >= t.nz ? t.nz - 1 : j; const k = j * t.nx + i, v = diff.get(k); return v === undefined ? t.h[k] : v; };
    return diff.size;
  }

  /* ---------- 1. rio: calcula o nível da água e escava o leito (antes de montar o terreno) ---------- */
  carveWater() {
    const t = this.t;
    this.orig = (x, z) => t.heightAt(x, z);          // será trocado por cópia antes de escavar
    const copy = new Float32Array(t.h), tt = Object.create(t); tt.h = copy;
    this.orig = (x, z) => t.heightAt.call(tt, x, z);
    this._orig = tt;
    this.waterLines = [];
    // máscara do rio (polígono da Prefeitura) na grade do terreno, por varredura de linhas
    this.riverAreas = this.world.areas.filter(a => a.k === 'river');
    this.mask = new Uint8Array(t.nx * t.nz);
    for (const a of this.riverAreas) rasterize(a.p, t, this.mask);
    const masked = (x, z) => { const i = Math.round((x - t.x0) / t.cell), j = Math.round((z - t.z0) / t.cell); return i >= 0 && j >= 0 && i < t.nx && j < t.nz && this.mask[j * t.nx + i]; };
    this.masked = masked;
    // cabeceiras de ponte: o terreno ali não é escavado (a rua chega no nível do tabuleiro)
    this.bridgeEnds = [];
    for (const r of this.world.roads) if (r.br) this.bridgeEnds.push(r.p[0], r.p[r.p.length - 1]);
    // bueiros: onde um arroio cruza uma rua comum (sem ponte), a rua passa por cima e o terreno não é escavado
    this.culverts = [];
    const segX = (a, b, c, d) => { const r = [b[0] - a[0], b[1] - a[1]], s2 = [d[0] - c[0], d[1] - c[1]], den = r[0] * s2[1] - r[1] * s2[0]; if (Math.abs(den) < 1e-9) return null; const t = ((c[0] - a[0]) * s2[1] - (c[1] - a[1]) * s2[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + r[0] * t, a[1] + r[1] * t] : null; };
    const box = p => { let a = Infinity, b2 = Infinity, c = -Infinity, d = -Infinity; for (const q of p) { a = Math.min(a, q[0]); b2 = Math.min(b2, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); } return [a, b2, c, d]; };
    const hit = (A, B) => A[0] <= B[2] && B[0] <= A[2] && A[1] <= B[3] && B[1] <= A[3];
    const cRoads = this.world.roads.filter(r => !r.br && (URBAN.has(r.k) || r.k === 'unclassified' || r.k === 'service')).map(r => ({ r, bb: box(r.p) }));
    for (const w of this.world.water) {
      if (w.k !== 'stream' && w.k !== 'ditch' && w.k !== 'drain') continue;
      const wb = box(w.p);
      for (const { r, bb } of cRoads) {
        if (!hit(wb, bb)) continue;
        for (let i = 0; i < w.p.length - 1; i++) {
          const sb = box([w.p[i], w.p[i + 1]]); if (!hit(sb, bb)) continue;
          for (let j = 0; j < r.p.length - 1; j++) {
          const q = segX(w.p[i], w.p[i + 1], r.p[j], r.p[j + 1]); if (!q) continue;
          const sw = r.sw ? Math.max(r.sw[0], r.sw[1]) : (URBAN.has(r.k) ? 2.2 : 0.5);
          const L = Math.hypot(r.p[j + 1][0] - r.p[j][0], r.p[j + 1][1] - r.p[j][1]) || 1;
          const sL = Math.hypot(w.p[i + 1][0] - w.p[i][0], w.p[i + 1][1] - w.p[i][1]) || 1;
          this.culverts.push({ x: q[0], z: q[1], r: r.w / 2 + sw + 0.6, half: w.w / 2, rd: [(r.p[j + 1][0] - r.p[j][0]) / L, (r.p[j + 1][1] - r.p[j][1]) / L], sd: [(w.p[i + 1][0] - w.p[i][0]) / sL, (w.p[i + 1][1] - w.p[i][1]) / sL], road: r.n });
          }
        }
      }
    }
    const cg = new Map(), CG = 32;   // grade dos bueiros e cabeceiras (consulta por célula, não lista inteira)
    for (const c of this.culverts) for (let i = Math.floor((c.x - 24) / CG); i <= Math.floor((c.x + 24) / CG); i++) for (let j = Math.floor((c.z - 24) / CG); j <= Math.floor((c.z + 24) / CG); j++) { const k = i + ',' + j; (cg.get(k) || cg.set(k, []).get(k)).push(c); }
    const bg = new Map();
    for (const e of this.bridgeEnds) for (let i = Math.floor((e[0] - 16) / CG); i <= Math.floor((e[0] + 16) / CG); i++) for (let j = Math.floor((e[1] - 16) / CG); j <= Math.floor((e[1] + 16) / CG); j++) { const k = i + ',' + j; (bg.get(k) || bg.set(k, []).get(k)).push(e); }
    const keep = (x, z) => {
      let m = 1; const key = Math.floor(x / CG) + ',' + Math.floor(z / CG);
      for (const e of bg.get(key) || []) { const d = Math.hypot(x - e[0], z - e[1]); if (d < 16) m = Math.min(m, smooth(5, 16, d)); }
      for (const c of cg.get(key) || []) {
        // distância ao longo do arroio até o eixo da rua: dentro da largura da rua (+calçada) não escava
        const dx = x - c.x, dz = z - c.z, across = Math.abs(dx * c.sd[1] - dz * c.sd[0]);   // afastamento do eixo do arroio
        if (across > 12) continue;
        const proj = Math.abs(dx * -c.rd[1] + dz * c.rd[0]);                                  // distância perpendicular à rua
        m = Math.min(m, smooth(c.r, c.r + 1.5, proj));
      }
      return m;
    };
    this.keep = keep;
    for (const w of this.world.water) {
      if (w.k !== 'river' && w.k !== 'stream' && w.k !== 'canal') continue;
      const big = w.k === 'river', half = w.w / 2;
      const pts = resample(w.p, 8);
      const ys = pts.map(([x, z], i) => {
        const [nx, nz] = perp(pts, i);
        return Math.min(this.orig(x, z), this.orig(x + nx * (half + 4), z + nz * (half + 4)), this.orig(x - nx * (half + 4), z - nz * (half + 4))) - (big ? 0.8 : 0.3);
      });
      for (let i = 1; i < ys.length; i++) ys[i] = Math.min(ys[i], ys[i - 1] + 0.02);   // água não sobe rio abaixo
      for (let i = ys.length - 2; i >= 0; i--) ys[i] = Math.max(ys[i], ys[i + 1] - 0.6); // sem degraus bruscos
      // valão de paredes retas (arroio canalizado na praça): escavação larga e plana; paredes vêm do praca.js
      const val = pts.map(([x, z]) => !big && (this.valaoZones || []).some(v => Math.hypot(x - v.x, z - v.z) < v.r));
      this.waterLines.push({ pts, ys, half, big, val });
      const depth = big ? 2.2 : 0.8, bank = big ? 7 : 3;
      for (let i = 0; i < pts.length - 1; i++) {
        if (masked((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2)) continue;   // trecho coberto pelo polígono
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], R = (val[i] || val[i + 1]) ? half + 6 : half + bank;
        editHeights(t, Math.min(ax, bx) - R, Math.min(az, bz) - R, Math.max(ax, bx) + R, Math.max(az, bz) + R, (x, z, h) => {
          const d = segDist(x, z, ax, az, bx, bz);
          if (d > R) return h;
          const V = val[i] || val[i + 1];
          const target = Math.min(ys[i], ys[i + 1]) - (V ? 1.9 : depth);
          const carved = Math.min(h, target + (h - target) * (V ? smooth(half + 3.5, half + 5.5, d) : smooth(half - 1, R, d)));
          return h + (carved - h) * keep(x, z);
        });
      }
    }

    // nível da água em qualquer ponto = amostra mais próxima da linha central do rio
    this.levelGrid = new Map();
    for (const wl of this.waterLines) if (wl.big) wl.pts.forEach((p, i) => { const k = Math.floor(p[0] / 50) + ',' + Math.floor(p[1] / 50); (this.levelGrid.get(k) || this.levelGrid.set(k, []).get(k)).push([p[0], p[1], wl.ys[i]]); });
    // escava tudo o que está dentro do polígono do rio
    for (let j = 0; j < t.nz; j++) for (let i = 0; i < t.nx; i++) {
      const k = j * t.nx + i; if (!this.mask[k]) continue;
      const x = t.x0 + i * t.cell, z = t.z0 + j * t.cell, lv = this.levelAt(x, z);
      if (lv !== null) { const c = Math.min(t.h[k], lv - 2.2); t.h[k] += (c - t.h[k]) * keep(x, z); }
    }
  }

  /** Nível da água: o MENOR nível da linha central do rio num raio de 45 m (evita água "subindo" nas curvas). */
  levelAt(x, z) {
    let best = null, nearest = null, nd = Infinity;
    const ci = Math.floor(x / 50), cj = Math.floor(z / 50);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++)
      for (const q of this.levelGrid.get((ci + a) + ',' + (cj + b)) || []) {
        const d = Math.hypot(q[0] - x, q[1] - z);
        if (d < nd) { nd = d; nearest = q[2]; }
        if (d < 45 && (best === null || q[2] < best)) best = q[2];
      }
    return best ?? nearest ?? (this.orig(x, z) - 0.5);
  }

  /* ---------- 2. tudo o mais (depois que o terreno está pronto) ---------- */
  /** Monta tudo, cedendo a thread entre etapas (tick(fração) é chamado e aguardado). */
  async build(tick = async () => {}) {
    this.buildWater();
    await tick(0.1);
    this.buildRoads();
    await tick(0.3);
    await this.buildBuildings(f => tick(0.3 + f * 0.6));
    this.buildFronts();
    this.buildLamps();
    await tick(0.95);
    for (const c of this.chunks.values()) {
      for (const [key, mat, shadow] of [['walls', this.wallMat, true], ['roofs', this.roofMat, true], ['shops', this.shopMat, false], ['ao', this.aoMat, false], ['roads', this.roadMat, false], ['cobble', this.cobbleMat, false], ['walk', this.walkMat, false], ['walkC', this.walkCMat, false], ['signs', this.signMat, false], ['marks', this.markMat, false], ['bridge', this.bridgeMat, true]]) {
        const g = c[key].build(); c[key] = null;
        if (!g) continue;
        freeAfterUpload(g);
        const m = new THREE.Mesh(g, mat);
        m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false;
        m.userData.kind = key;
        c.meshes.push(m); this.group.add(m);
      }
    }
    return this.group;
  }

  buildWater() {
    const b = new GeoBuilder(), col = C.plain;   // água: cor do material × cor do vértice
    for (const { pts, ys: ys0, half, val } of this.waterLines) {
      // valão: lâmina d'água rasa no fundo do canal (o leito de cascalho fica 10 cm abaixo)
      const ys = ys0.map((y, i) => (val && val[i] ? y - 1.5 : y));
      for (let i = 0; i < pts.length - 1; i++) {
        if (this.masked((pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2)) continue;
        const V = val && (val[i] || val[i + 1]);
        if (V) continue;   // valão: a água é desenhada junto com o leito (praca.js)
        const [n0x, n0z] = perp(pts, i), [n1x, n1z] = perp(pts, i + 1), w0 = V ? half * 0.6 : half + 1.5, w1 = w0;
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        b.quad([ax + n0x * w0, ys[i], az + n0z * w0], [bx + n1x * w1, ys[i + 1], bz + n1z * w1], [bx - n1x * w1, ys[i + 1], bz - n1z * w1], [ax - n0x * w0, ys[i], az - n0z * w0],
          [[0, 0], [1, 0], [1, 1], [0, 1]], col, 0, [0, 1, 0]);
      }
    }
    // rio Paranhana pelo polígono real (Prefeitura): cada vértice no nível da água mais próximo
    for (const a of this.riverAreas) {
      const ys = a.p.map(([x, z]) => this.levelAt(x, z));
      const tris = THREE.ShapeUtils.triangulateShape(a.p.map(([x, z]) => new THREE.Vector2(x, z)), []);
      for (const [i, j, k] of tris) b.tri([a.p[i][0], ys[i], a.p[i][1]], [a.p[j][0], ys[j], a.p[j][1]], [a.p[k][0], ys[k], a.p[k][1]], [[0, 0], [1, 0], [0, 1]], col, 0, [0, 1, 0]);
    }
    // piscinas
    for (const p of this.world.pools || []) {
      let y = -Infinity; for (const [x, z] of p) y = Math.max(y, this.t.heightAt(x, z));
      const tris = THREE.ShapeUtils.triangulateShape(p.map(([x, z]) => new THREE.Vector2(x, z)), []);
      for (const [i, j, k] of tris) b.tri([p[i][0], y + 0.12, p[i][1]], [p[j][0], y + 0.12, p[j][1]], [p[k][0], y + 0.12, p[k][1]], [[0, 0], [1, 0], [0, 1]], C.pool, 0, [0, 1, 0]);
    }
    // lagos e açudes
    for (const a of this.world.areas) if (a.k === 'water' || a.k === 'pool') {
      const cx = a.p.reduce((s2, q) => s2 + q[0], 0) / a.p.length, cz = a.p.reduce((s2, q) => s2 + q[1], 0) / a.p.length;
      if (this.masked(cx, cz)) continue;               // já coberto pelo polígono do rio
      let y = Infinity; for (const [x, z] of a.p) y = Math.min(y, this.t.heightAt(x, z));
      const tris = THREE.ShapeUtils.triangulateShape(a.p.map(([x, z]) => new THREE.Vector2(x, z)), []);
      for (const [i, j, k] of tris) b.tri([a.p[i][0], y + 0.15, a.p[i][1]], [a.p[j][0], y + 0.15, a.p[j][1]], [a.p[k][0], y + 0.15, a.p[k][1]], [[0, 0], [1, 0], [0, 1]], col, 0, [0, 1, 0]);
    }
    const g = b.build();
    if (g) { freeAfterUpload(g); const m = new THREE.Mesh(g, this.waterMat); m.receiveShadow = true; this.group.add(m); this.water = m; }
  }

  buildRoads() {
    const t = this.t, up = [0, 1, 0];
    this.lampPos = [];
    const lampGrid = new Set(), lampKey = (x, z) => Math.round(x / 10) + ',' + Math.round(z / 10);
    const addLamp = (x, z, y, yaw) => { const k = lampKey(x, z); if (lampGrid.has(k)) return; lampGrid.add(k); this.lampPos.push([x, y, z, yaw]); };
    const crossings = this.findCrossings();
    this.zebras = [];                                  // faixas de pedestre (para decoração: casinhas da avenida)
    const duals = this.world.roads.filter(q => q.ow && q.med && !q.br);
    // distância do ponto até a outra pista da mesma avenida (largura real do canteiro)
    const otherDist = (r, x, z) => { let best = Infinity; for (const q of duals) { if (q === r || q.n !== r.n) continue; for (let i = 0; i < q.p.length - 1; i++) { const a = q.p[i], b = q.p[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)); best = Math.min(best, Math.hypot(x - a[0] - dx * u, z - a[1] - dz * u)); } } return best; };
    const cornerKey = q => Math.round(q[0] / 3) + ',' + Math.round(q[1] / 3), ends = new Map();
    for (const r of this.world.roads) if (URBAN.has(r.k) && inCentro(r.p[0][0], r.p[0][1], 40)) for (const q of [r.p[0], r.p[r.p.length - 1]]) { const k = cornerKey(q); ends.set(k, (ends.get(k) || 0) + 1); }
    const corners = []; for (const r of this.world.roads) if (URBAN.has(r.k)) for (const q of [r.p[0], r.p[r.p.length - 1]]) if ((ends.get(cornerKey(q)) || 0) >= 2 && inCentro(q[0], q[1], 20)) corners.push(q);
    const nearCorner = (x, z, d) => corners.some(q => Math.abs(q[0] - x) < d && Math.abs(q[1] - z) < d && Math.hypot(q[0] - x, q[1] - z) < d);
    for (const r of this.world.roads) {
      const pts = resample(r.p, 4), n = pts.length;
      const unpaved = r.pav === 'terra' || (!r.pav && (r.k === 'track' || ['unpaved', 'gravel', 'dirt', 'ground', 'compacted'].includes(r.sf)));
      const cobble = r.pav === 'pedra' || r.pav === 'bloco';
      const foot = r.k === 'path' || r.k === 'footway' || r.k === 'steps' || r.k === 'cycleway';
      const surf = foot ? C.path : unpaved ? C.dirt : r.pav === 'pedra' ? C.pedra : r.pav === 'bloco' ? C.bloco : C.asphalt;
      const asphalt = !foot && !unpaved && !cobble;
      // tom próprio por rua (asfalto novo/velho, recapeado): ±8% sobre a cor base, fixo pela posição
      const surfJ = surf.clone().multiplyScalar(0.92 + 0.16 * hash(r.p[0][0], r.p[0][1]));
      const urban = URBAN.has(r.k) && !unpaved;
      // pista dupla só se a pista irmã (mesmo nome, mão única com canteiro) estiver ao lado; senão desenha a rua inteira
      const dual = r.ow && r.med && !r.br && this._hasTwin(r);
      const width = dual ? Math.max(3.5, (r.w - r.med) / 2) : r.w;
      const half = width / 2;
      const swAvg = r.sw ? (r.sw[0] + r.sw[1]) / 2 : (urban ? 2.2 : 0);
      const side = r.br ? (urban ? 1.5 : 0.4) : swAvg;
      const sideL = side, sideR = dual && !r.br ? 0 : side;   // pista dupla (sentido do OSM = sentido do trânsito): canteiro à esquerda (−), calçada à direita (+)
      // ponte: pista reta entre as cabeceiras (altura original, antes de escavar o rio)
      let Y = null;
      if (r.br) {
        const h0 = t.heightAt(...pts[0]) + 0.08, h1 = t.heightAt(...pts[n - 1]) + 0.08, L = pathLen(pts);
        const arch = Math.min(0.8, L * 0.015);
        let acc = 0; Y = pts.map((p, i) => { if (i) acc += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); const f = acc / L; return h0 + (h1 - h0) * f + arch * Math.sin(Math.PI * f); });
      }
      const hy = (p, i) => (Y ? Y[i] : t.heightAt(p[0], p[1]) + 0.08);
      // piso por onde se anda: pista +8 cm e calçada +23 cm sobre o terreno (pontes: deckAt)
      if (!Y) { const sb = this.surfBins || (this.surfBins = new Map());
        for (let i = 0; i < r.p.length - 1; i++) { const a = r.p[i], b = r.p[i + 1], noMed = /Jo.o Corr/.test(r.n || '') && Math.min(...r.p.map(q => Math.hypot(q[0], q[1] - 47))) < 60,
            seg = [a[0], a[1], b[0], b[1], half, sideL, sideR, dual && !foot ? r.med / 2 + 1 : 0, r.med && !dual && !noMed ? r.med / 2 : 0], R = half + Math.max(sideL, sideR, dual ? r.med / 2 + 1 : 0) + 1;
          for (let bi = Math.floor((Math.min(a[0], b[0]) - R) / 50); bi <= Math.floor((Math.max(a[0], b[0]) + R) / 50); bi++) for (let bj = Math.floor((Math.min(a[1], b[1]) - R) / 50); bj <= Math.floor((Math.max(a[1], b[1]) + R) / 50); bj++) { const k = bi + ',' + bj; let L = sb.get(k); if (!L) sb.set(k, L = []); L.push(seg); } } }
      const NRM = pts.map((_, i) => perp(pts, i, true));
      const off = (i, o) => { const [nx, nz, m] = NRM[i]; return [pts[i][0] + nx * o * m, pts[i][1] + nz * o * m]; };
      const wuv = (q, s) => [q[0] / s, q[1] / s];
      const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      // tira contínua entre deslocamentos o0 e o1 (o > 0 = esquerda), altura dy, no construtor B
      const strip = (B, o0, o1, dy, col, uvs = 4, filt = null) => {
        for (let i = 0; i < n - 1; i++) {
          if (filt && !filt(cum[i], cum[i + 1])) continue;
          const a0 = off(i, o0), a1 = off(i + 1, o0), b1 = off(i + 1, o1), b0 = off(i, o1);
          B.quad([a0[0], hy(a0, i) + dy, a0[1]], [a1[0], hy(a1, i + 1) + dy, a1[1]], [b1[0], hy(b1, i + 1) + dy, b1[1]], [b0[0], hy(b0, i) + dy, b0[1]],
            [wuv(a0, uvs), wuv(a1, uvs), wuv(b1, uvs), wuv(b0, uvs)], col, 0, up);
        }
      };
      const wall = (B, o, y0, y1, col, outSign) => {
        for (let i = 0; i < n - 1; i++) {
          const a = off(i, o), b = off(i + 1, o), [nx, nz] = NRM[i];
          B.quad([a[0], hy(a, i) + y0, a[1]], [b[0], hy(b, i + 1) + y0, b[1]], [b[0], hy(b, i + 1) + y1, b[1]], [a[0], hy(a, i) + y1, a[1]],
            [[cum[i] / 2, y0], [cum[i + 1] / 2, y0], [cum[i + 1] / 2, y1], [cum[i] / 2, y1]], col, 0, [nx * outSign, 0, nz * outSign]);
        }
      };
      // os pedaços vão para o chunk do ponto médio da via inteira (vias longas: por trecho)
      const pieces = [];
      for (let i0 = 0; i0 < n - 1; i0 += 40) pieces.push([i0, Math.min(n - 1, i0 + 40)]);
      for (const [i0, i1] of pieces) {
        const mid = pts[(i0 + i1) >> 1], ch = this.chunk(mid[0], mid[1]), centro = inCentro(mid[0], mid[1]);
        const range = (s0) => s0 >= cum[i0] - 1e-6 && s0 < cum[i1] - 1e-6;
        const F = (f) => (a, b2) => range(a) && (!f || f(a, b2));
        // pista
        // centro: asfalto mais escuro (cinza-grafite das fotos) e calçada de lajota cinza
        const surfC = centro && asphalt ? surfJ.clone().multiplyScalar(0.72) : surfJ;
        if (centro && half > 2) {
          // centro: pista em faixas de até 3,5 m (com uma no eixo), cada uma seguindo o terreno — uma pista larga num quad
          // só ficava abaixo do terreno no meio (bueiro do arroio na João Corrêa, até 0,5 m)
          const n2 = Math.max(1, Math.ceil(half / 3.5)), ofs = []; for (let q = -n2; q <= n2; q++) ofs.push(half * q / n2);
          for (let q = ofs.length - 1; q > 0; q--) strip(cobble ? ch.cobble : ch.roads, ofs[q], ofs[q - 1], 0, surfC, cobble ? 2.5 : 4, F());
        } else strip(cobble ? ch.cobble : ch.roads, half, -half, 0, surfC, cobble ? 2.5 : 4, F());
        // calçadas (lajota) + meio-fio de concreto (no centro, amarelo nas esquinas)
        const curbH = 0.15, W = centro ? ch.walkC : ch.walk, sideCol = centro ? C.sideC.clone().multiplyScalar(0.94 + 0.12 * hash(r.p[0][1], r.p[0][0])) : C.side;
        if (sideL) { strip(W, half + sideL, half, curbH, sideCol, 1.2, F()); }
        if (sideR) { strip(W, -half, -half - sideR, curbH, sideCol, 1.2, F()); }
        const curbCol = (a, b) => centro && nearCorner((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, half + side + 7) ? C.yellow : C.curb;
        if (sideL || r.br) for (let i = i0; i < i1; i++) { const a = off(i, half), b = off(i + 1, half), [nx, nz] = NRM[i];
          ch.roads.quad([a[0], hy(a, i), a[1]], [b[0], hy(b, i + 1), b[1]], [b[0], hy(b, i + 1) + curbH, b[1]], [a[0], hy(a, i) + curbH, a[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], curbCol(a, b), 0, [-nx, 0, -nz]); }
        if (sideR) for (let i = i0; i < i1; i++) { const a = off(i, -half), b = off(i + 1, -half), [nx, nz] = NRM[i];
          ch.roads.quad([a[0], hy(a, i), a[1]], [b[0], hy(b, i + 1), b[1]], [b[0], hy(b, i + 1) + curbH, b[1]], [a[0], hy(a, i) + curbH, a[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], curbCol(a, b), 0, [nx, 0, nz]); }
        // canteiro central (pista única com canteiro)
        // exceções conferidas em foto: o cadastro marca canteiro onde hoje é só asfalto
        const noMedian = /Jo.o Corr/.test(r.n || '') && Math.min(...r.p.map(q => Math.hypot(q[0], q[1] - 47))) < 60;
        if (r.med && !dual && !noMedian) { strip(ch.roads, r.med / 2, -r.med / 2, 0.2, C.median, 4, F()); }
        // pista dupla: canteiro gramado até o meio do vão entre as pistas, meio-fio pintado de amarelo
        if (dual && !r.br && !foot) {
          const G = []; for (let i = i0; i <= i1; i++) { const d = otherDist(r, pts[i][0], pts[i][1]); G.push(d === Infinity ? 0 : Math.max(0, Math.min(r.med / 2 + 1, (d - 2 * half) / 2))); }
          for (let i = i0; i < i1; i++) {
            const g0 = G[i - i0], g1 = G[i + 1 - i0]; if (g0 < 0.4 || g1 < 0.4) continue;
            const a0 = off(i, -half), a1 = off(i + 1, -half), b0 = off(i, -half - g0), b1 = off(i + 1, -half - g1), [nx, nz] = NRM[i];
            ch.roads.quad([a0[0], hy(a0, i) + 0.15, a0[1]], [a1[0], hy(a1, i + 1) + 0.15, a1[1]], [b1[0], hy(b1, i + 1) + 0.15, b1[1]], [b0[0], hy(b0, i) + 0.15, b0[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], C.median, 0, up);
            ch.roads.quad([a0[0], hy(a0, i), a0[1]], [a1[0], hy(a1, i + 1), a1[1]], [a1[0], hy(a1, i + 1) + 0.15, a1[1]], [a0[0], hy(a0, i) + 0.15, a0[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], C.yellow, 0, [nx, 0, nz]);
          }
        }
        // sinalização horizontal (padrão brasileiro: amarelo separa sentidos, branco separa faixas/bordas)
        if (asphalt && !foot && width >= 5.5) {
          const M = ch.marks, lw = 0.12;
          // centro: as faixas param antes da faixa de pedestre (não atravessam o cruzamento)
          const xs = centro ? (crossings.get(r) || []).map(ci => cum[ci]) : [], clear = (a, b2) => xs.every(s0 => Math.abs((a + b2) / 2 - s0) > 9.5);
          const dash = (a, b2) => Math.floor(a / 4) % 2 === 0 && clear(a, b2);
          const twoWay = !r.ow;
          if (twoWay) {
            if (r.main || r.k === 'primary' || r.k === 'secondary') { strip(M, 0.2, 0.2 - lw, 0.03, C.yellow, 4, F(clear)); strip(M, -0.2 + lw, -0.2, 0.03, C.yellow, 4, F(clear)); }
            else strip(M, lw / 2, -lw / 2, 0.03, C.yellow, 4, F(dash));
          } else if (width >= 6.5) strip(M, lw / 2, -lw / 2, 0.03, C.line, 4, F(dash));
          if (MARKED.has(r.k) || r.br) { strip(M, half - 0.3, half - 0.3 - lw, 0.03, C.line, 4, F(clear)); strip(M, -half + 0.3 + lw, -half + 0.3, 0.03, C.line, 4, F(clear)); }
        }
      }
      // faixas de pedestre perto dos cruzamentos (zebrado)
      if ((asphalt || cobble) && urban && !r.br) for (const ci of crossings.get(r) || []) {
        for (const dir of [1, -1]) {
          if ((ci === 0 && dir < 0) || (ci === n - 1 && dir > 0)) continue;
          const s0 = cum[Math.min(n - 1, Math.max(0, ci))] + dir * 7;
          if (s0 < 3 || s0 > cum[n - 1] - 3) continue;
          let k = 0; while (k < n - 2 && cum[k + 1] < s0) k++;
          const f = (s0 - cum[k]) / Math.max(1e-6, cum[k + 1] - cum[k]);
          const cx = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, cz = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f;
          const L = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]) || 1, ux = (pts[k + 1][0] - pts[k][0]) / L, uz = (pts[k + 1][1] - pts[k][1]) / L;
          const ch = this.chunk(cx, cz), y = t.heightAt(cx, cz) + 0.115;
          this.zebras.push({ x: cx, z: cz, ux, uz, half, name: r.n, dual, med: r.med || 0 });
          for (let o = -half + 0.5; o <= half - 0.4; o += 0.9) {
            const px = cx - uz * o, pz = cz + ux * o;
            const P = (a, b) => [px + ux * a - uz * b, y, pz + uz * a + ux * b];
            ch.marks.quad(P(-1.5, -0.22), P(1.5, -0.22), P(1.5, 0.22), P(-1.5, 0.22), [[0, 0], [1, 0], [1, 1], [0, 1]], C.line, 0, up);
          }
        }
      }
      // postes de iluminação nas vias urbanas do centro e nas pontes
      const nearTown = Math.hypot(pts[0][0], pts[0][1]) < 2600 || Math.hypot(pts[n - 1][0], pts[n - 1][1]) < 2600;
      if ((urban && nearTown && !foot) || r.br) {
        const step = r.br ? 18 : 30;
        for (let s0 = 8, j = 0; s0 < cum[n - 1] - 4; s0 += step, j++) {
          let k = 0; while (k < n - 2 && cum[k + 1] < s0) k++;
          const sgn = r.br ? (j % 2 ? 1 : -1) : (j % 2 ? 1 : -1);
          const o = sgn * (half + Math.max(0.5, Math.min(side, 2.5) - 0.4));
          const q = off(k, o), [nx, nz] = NRM[k];
          addLamp(q[0], q[1], hy(q, k) + (side ? 0.15 : 0), Math.atan2(-nx * sgn, -nz * sgn));
          if (r.br) { const q2 = off(k, -o); addLamp(q2[0], q2[1], hy(q2, k) + 0.15, Math.atan2(nx * sgn, nz * sgn)); }
        }
      }
      if (r.br) this.buildBridge(r, pts, NRM, cum, hy, half, side, off, wall);
    }
  }

  /** Ponte: laje com espessura, calçadas, guarda-corpo metálico com montantes e pilares até o leito. */
  buildBridge(r, pts, NRM, cum, hy, half, side, off, wall) {
    const t = this.t, n = pts.length, W = half + side;
    const mid = pts[n >> 1], ch = this.chunk(mid[0], mid[1]);
    const B = ch.bridge, deck = 0.9;
    // tabuleiro caminhável (para o jogador e, depois, os carros)
    this.decks ??= new Map();
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i], b = pts[i + 1], seg = { a, b, ya: hy(a, i), yb: hy(b, i + 1), W };
      for (const q of [a, b]) { const k = Math.floor(q[0] / 50) + ',' + Math.floor(q[1] / 50); (this.decks.get(k) || this.decks.set(k, []).get(k)).push(seg); }
    }
    // faces laterais da laje e fundo
    wall(B, W, -deck, 0.18, C.concrete, 1);
    wall(B, -W, -deck, 0.18, C.concrete, -1);
    for (let i = 0; i < n - 1; i++) {
      const a0 = off(i, W), a1 = off(i + 1, W), b1 = off(i + 1, -W), b0 = off(i, -W);
      B.quad([a0[0], hy(a0, i) - deck, a0[1]], [a1[0], hy(a1, i + 1) - deck, a1[1]], [b1[0], hy(b1, i + 1) - deck, b1[1]], [b0[0], hy(b0, i) - deck, b0[1]],
        [[0, 0], [1, 0], [1, 1], [0, 1]], C.concreteDark, 0, [0, -1, 0]);
    }
    // guarda-corpo: montantes a cada 2 m e dois corrimãos
    for (const s of [1, -1]) {
      const o = s * (W - 0.12);
      for (let s0 = 0; s0 <= cum[n - 1]; s0 += 2) {
        let k = 0; while (k < n - 2 && cum[k + 1] < s0) k++;
        const f = (s0 - cum[k]) / Math.max(1e-6, cum[k + 1] - cum[k]);
        const a = off(k, o), b = off(k + 1, o), x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f, y = hy(a, k) + (hy(b, k + 1) - hy(a, k)) * f + 0.18;
        const [nx, nz] = NRM[k];
        B.box(x, y, z, 0.08, 1.05, 0.08, nz, -nx, C.metal);
      }
      for (const yy of [1.05, 0.55]) for (let i = 0; i < n - 1; i++) {
        const a = off(i, o), b = off(i + 1, o), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
        const ya = hy(a, i), yb = hy(b, i + 1);
        B.box((a[0] + b[0]) / 2, (ya + yb) / 2 + 0.18 + yy - 0.03, (a[1] + b[1]) / 2, L + 0.02, 0.06, 0.06, ux, uz, C.metal);
      }
    }
    // pilares onde o vão é alto
    for (let s0 = 10; s0 < cum[n - 1] - 6; s0 += 14) {
      let k = 0; while (k < n - 2 && cum[k + 1] < s0) k++;
      const p = pts[k], y = hy(p, k) - deck, g = t.heightAt(p[0], p[1]);
      if (y - g < 1.5) continue;
      const [nx, nz] = NRM[k], ux = nz, uz = -nx;
      for (const o of [-half * 0.55, half * 0.55]) {
        const q = off(k, o);
        B.box(q[0], g - 1.5, q[1], 0.9, y - g + 1.5, 0.9, ux, uz, C.concreteDark);
      }
      B.box(p[0], y - 0.6, p[1], 1.0, 0.6, W * 2 - 0.4, ux, uz, C.concreteDark);
    }
  }

  /** Altura do tabuleiro de ponte em (x, z), ou null se não há ponte ali. */
  /** Altura do piso de ruas e calçadas acima do terreno neste ponto (0 fora delas). */
  surfOffset(x, z) {
    const L = this.surfBins?.get(Math.floor(x / 50) + ',' + Math.floor(z / 50)); if (!L) return 0;
    let best = 0;
    for (const [ax, az, bx, bz, half, sl, sr, md, mm] of L) {
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1, t = ((x - ax) * dx + (z - az) * dz) / l2; if (t < -0.02 || t > 1.02) continue;
      const tt = Math.max(0, Math.min(1, t)), px = ax + dx * tt, pz = az + dz * tt, l = Math.sqrt(l2);
      const o = ((x - px) * -dz + (z - pz) * dx) / l;          // > 0 = à esquerda (mesma convenção de perp)
      if (mm && Math.abs(o) <= mm) return 0.28;                  // canteiro central de pista única
      if (Math.abs(o) <= half) { if (best < 0.08) best = 0.08; }
      else if ((o > 0 && o <= half + sl) || (o < 0 && -o <= half + sr)) return 0.23;
      else if (md && o < 0 && -o <= half + md) best = Math.max(best, 0.23);   // canteiro gramado da pista dupla
    }
    return best;
  }

  deckAt(x, z) {
    const list = this.decks?.get(Math.floor(x / 50) + ',' + Math.floor(z / 50)); if (!list) return null;
    let best = null;
    for (const s of list) {
      const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], l2 = dx * dx + dz * dz || 1;
      const t = ((x - s.a[0]) * dx + (z - s.a[1]) * dz) / l2; if (t < -0.05 || t > 1.05) continue;
      const tt = Math.max(0, Math.min(1, t)), d = Math.hypot(x - s.a[0] - dx * tt, z - s.a[1] - dz * tt);
      if (d < s.W - 0.15) { const y = s.ya + (s.yb - s.ya) * tt + (d > s.W - 1.6 ? 0.18 : 0); if (best === null || y > best) best = y; }
    }
    return best;
  }

  /** Vértices compartilhados por 3+ trechos de via (cruzamentos), por via → índices (na via reamostrada). */
  findCrossings() {
    const deg = new Map(), key = q => Math.round(q[0] * 2) + ',' + Math.round(q[1] * 2);
    const DRIVE = new Set([...URBAN, 'unclassified', 'service']);
    for (const r of this.world.roads) if (DRIVE.has(r.k)) r.p.forEach((q, i) => { deg.set(key(q), (deg.get(key(q)) || 0) + (i === 0 || i === r.p.length - 1 ? 1 : 2)); });
    const out = new Map();
    for (const r of this.world.roads) {
      if (!URBAN.has(r.k)) continue;
      const rs = resample(r.p, 4), idx = [];
      for (const q of r.p) if ((deg.get(key(q)) || 0) >= 3 && Math.hypot(q[0], q[1]) < 2200) {
        let bi = 0, bd = Infinity; rs.forEach((p, i) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; bi = i; } }); idx.push(bi);
      }
      if (idx.length) out.set(r, idx);
    }
    return out;
  }

  /** Postes: três malhas instanciadas (poste, braço, luminária). */
  buildLamps() {
    const N = this.lampPos.length; if (!N) return;
    const pole = new THREE.CylinderGeometry(0.07, 0.11, 8, 6).translate(0, 4, 0);
    const arm = new THREE.BoxGeometry(0.08, 0.08, 1.6).translate(0, 7.9, 0.75);
    const head = new THREE.BoxGeometry(0.32, 0.12, 0.6).translate(0, 7.85, 1.55);
    const mPole = new THREE.MeshLambertMaterial({ color: 0x8d9196 });
    this.lampMat = new THREE.MeshLambertMaterial({ color: 0xf4f1e6, emissive: 0xffd9a0, emissiveIntensity: 0 });
    const d = new THREE.Object3D(); this._lampIMs = [];
    for (const [geo, mat] of [[pole, mPole], [arm, mPole], [head, this.lampMat]]) {
      const im = new THREE.InstancedMesh(geo, mat, N);
      this.lampPos.forEach(([x, y, z, yaw], i) => { d.position.set(x, y, z); d.rotation.set(0, yaw, 0); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
      im.castShadow = geo === pole; this.group.add(im); this._lampIMs.push(im);
    }
    // mancha de luz no chão sob cada poste (aditiva, só à noite): ilusão barata de luz real
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.45, 'rgba(255,190,120,.45)'); gr.addColorStop(1, 'rgba(255,170,100,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const pt = new THREE.CanvasTexture(c); pt.colorSpace = THREE.SRGBColorSpace;
    this.poolMat = new THREE.MeshBasicMaterial({ map: pt, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16, fog: true });
    const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), this.poolMat, N);
    this.lampPos.forEach(([x, y, z, yaw], i) => { d.position.set(x + Math.sin(yaw) * 1.5, this.t.heightAt(x + Math.sin(yaw) * 1.5, z + Math.cos(yaw) * 1.5) + 0.2, z + Math.cos(yaw) * 1.5); d.rotation.set(0, 0, 0); d.updateMatrix(); pool.setMatrixAt(i, d.matrix); });
    pool.renderOrder = 3; this.pools = pool; this.group.add(pool); this._lampIMs.push(pool);
    // só os postes perto da câmera são desenhados (eram ~5.300 sempre: ~400 mil triângulos com a sombra)
    this._lampAll = this._lampIMs.map(im => im.instanceMatrix.array.slice());
    for (const im of this._lampIMs) { im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.count = 0; }
    this._lampAt = null;
  }

  /** Postes visíveis: até LAMP_R da câmera (refeito quando a câmera anda 25 m). */
  _updateLamps(px, pz) {
    if (!this._lampIMs || (this._lampAt && Math.hypot(px - this._lampAt[0], pz - this._lampAt[1]) < 25)) return;
    this._lampAt = [px, pz];
    const R2 = LAMP_R * LAMP_R, P = this.lampPos; let k = 0;
    const sel = this._lampSel || (this._lampSel = new Int32Array(P.length));
    for (let i = 0; i < P.length; i++) { const dx = P[i][0] - px, dz = P[i][2] - pz; if (dx * dx + dz * dz < R2) sel[k++] = i; }
    this._lampIMs.forEach((im, j) => {
      const src = this._lampAll[j], dst = im.instanceMatrix.array;
      for (let q = 0; q < k; q++) dst.set(src.subarray(sel[q] * 16, sel[q] * 16 + 16), q * 16);
      im.count = k; im.instanceMatrix.needsUpdate = true;
    });
  }

  async buildBuildings(tick = null) {
    const t = this.t;
    let i = 0, n = 0;
    let wi = -1;
    for (const b of this.world.buildings) {
      wi++;
      if (tick && ++n % 2500 === 0) await tick(n / this.world.buildings.length);
      if (this.exclusions.length) {
        const cx = b.p.reduce((s2, q) => s2 + q[0], 0) / b.p.length, cz = b.p.reduce((s2, q) => s2 + q[1], 0) / b.p.length;
        if (this.exclusions.some(f => f(cx, cz))) continue;
      }
      let p = b.p.slice();
      if (signedArea(p) > 0) p.reverse();
      let rect = null, pushed = false;
      // centro: nenhum prédio avança sobre a pista ou a calçada (o contorno do GEO/OSM às vezes passa da rua)
      if (b.kind !== 'roof' && this.surfBins) {
        const cx0 = p.reduce((q, v) => q + v[0], 0) / p.length, cz0 = p.reduce((q, v) => q + v[1], 0) / p.length;
        if (inCentro(cx0, cz0, 40)) {
          // paredes longas podem cruzar a rua sem vértice dentro dela: subdivide a cada 2 m, afasta e tira os colineares
          const dense = []; for (let i = 0; i < p.length; i++) { const A = p[i], B = p[(i + 1) % p.length], n2 = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / 2)); for (let q = 0; q < n2; q++) dense.push([A[0] + (B[0] - A[0]) * q / n2, A[1] + (B[1] - A[1]) * q / n2]); }
          const np = dense.map(v => this._outOfStreet(v[0], v[1]));
          pushed = np.some((v, i) => Math.abs(v[0] - dense[i][0]) + Math.abs(v[1] - dense[i][1]) > 1e-6);
          if (pushed) { const out = []; for (let i = 0; i < np.length; i++) { const A = np[(i + np.length - 1) % np.length], B = np[i], C = np[(i + 1) % np.length];
              const cr = (B[0] - A[0]) * (C[1] - B[1]) - (B[1] - A[1]) * (C[0] - B[0]); if (Math.abs(cr) > 0.05) out.push(B); }
            if (out.length >= 3 && Math.abs(signedArea(out)) > 4) { p = out; if (signedArea(p) > 0) p.reverse(); } else pushed = false; }
        }
      }
      if (b.rect && !pushed) {
        const [cx, cz, ux, uz, hu, hv] = b.rect, U = [ux, uz], V = [-uz, ux];
        rect = hu >= hv ? { cx, cz, a: hu, b: hv, ua: U, ub: V } : { cx, cz, a: hv, b: hu, ua: V, ub: U };
      } else rect = asRect(p);
      const k = b.kind || 'house';
      const ind = /industrial|warehouse|shed/.test(k), com = /commercial|retail|office|apartments|school|church/.test(k);
      let roof = !rect ? 'flat' : ind ? 'shed' : com ? 'flat' : rect.a * rect.b * 4 > 520 ? 'flat' : 'gable';
      // formato lido na imagem aérea (scripts/build-roofshape.py): 1 laje, 2 duas águas, 3 quatro águas
      const rs = rect && this.roofShapes ? this.roofShapes[wi] : 0;
      if (rs === 1) roof = 'flat'; else if (rs === 2 && !ind) roof = 'gable'; else if (rs === 3 && !ind) roof = 'hip';
      this._roofReal = this.roofColors && this.roofColors[wi] >= 0 ? this.roofColors[wi] : -1;   // cor da foto aérea
      this.addBuilding(p, b.h, roof, ind ? 'i' : com ? 'c' : k === 'annex' ? 'a' : 'h', rect, i++);
      this._roofReal = -1;
    }
    for (const [x, z, , w, d, r, h, k] of this.world.gen) {
      const c = Math.cos(r), s = Math.sin(r);
      const p = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([u, v]) => [x + u * c + v * s, z - u * s + v * c]);
      if (signedArea(p) > 0) p.reverse();
      const ua = [c, -s], ub = [s, c];
      const rect = w >= d ? { cx: x, cz: z, a: w / 2, b: d / 2, ua, ub } : { cx: x, cz: z, a: d / 2, b: w / 2, ua: ub, ub: ua };
      this.addBuilding(p, h, k === 'h' ? 'gable' : k === 'i' ? 'shed' : 'flat', k, rect, i++);
    }
    void t;
  }

  _hasTwin(r) {
    const m = r.p[r.p.length >> 1];
    for (const q of this.world.roads) {
      if (q === r || !q.ow || !q.med || q.n !== r.n) continue;
      for (let i = 0; i < q.p.length - 1; i++) { if (segDist(m[0], m[1], q.p[i][0], q.p[i][1], q.p[i + 1][0], q.p[i + 1][1]) < r.w * 1.2) return true; }
    }
    return false;
  }

  /** Cor real do telhado (foto aérea 2016), com leve ganho: a foto vem mais escura que a luz do jogo. */
  _realRoof() {
    if (!(this._roofReal >= 0)) return null;
    const c = this._rc || (this._rc = new THREE.Color());
    c.setHex(this._roofReal).multiplyScalar(1.3);   // setHex já converte de sRGB
    // a foto puxa para o magenta nos cinzas: telhados que não são de telha vermelha ficam neutros
    const r = this._roofReal >> 16 & 255, g = this._roofReal >> 8 & 255;
    if (r - g < 28) { const l = (c.r + c.g + c.b) / 3; c.r += (l - c.r) * 0.75; c.g += (l - c.g) * 0.75; c.b += (l - c.b) * 0.75; }
    return c;
  }

  addBuilding(p, h, roof, kind, rect, id) {
    const t = this.t;
    let ymin = Infinity, ymax = -Infinity, cx = 0, cz = 0;
    for (const [x, z] of p) { const y = t.heightAt(x, z); ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); cx += x; cz += z; }
    cx /= p.length; cz /= p.length;
    const floor = ymax + 0.15, top = floor + h, base = ymin - 0.6;
    this._top = top + (roof === 'gable' && rect ? rect.b * 0.75 : roof === 'hip' && rect ? rect.b * 0.55 : 0.6);
    const ch = this.chunk(cx, cz, true);
    const centro = inCentro(cx, cz);
    const sobrado = centro && kind !== 'i' && this._heritage?.some(q => Math.abs(q.x - cx) < 14 && Math.abs(q.z - cz) < 14 && Math.hypot(q.x - cx, q.z - cz) < 14);
    let wall = kind === 'i' ? pick(IND_WALLS) : kind === 'c' ? pick(COM_WALLS) : pick(WALLS);
    if (sobrado) wall = SOBRADO_CORES[Math.floor(hash(cx * 3.1, cz * 1.3) * SOBRADO_CORES.length)];
    const lit = kind === 'a' ? 0 : rand() < (kind === 'i' ? 0.15 : 0.6) ? 1 : 0;
    const floors = Math.max(1, Math.round(h / 3.1));
    // piloto: estilo de janela por prédio (residência: moldura, veneziana, arco; comércio: moldura, de correr, arco)
    const pilot = Math.hypot(cx, cz) < PILOT_R, hs = hash(cx * 1.7, cz * 0.9);
    const style = sobrado ? 2 : !pilot || kind === 'i' ? 0 : kind === 'c' ? [0, 3, 3, 2, 0][Math.floor(hs * 5)] : [0, 1, 1, 2, 0, 1][Math.floor(hs * 6)];
    const litS = lit + 2 * style;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const out = [-(b[1] - a[1]), 0, b[0] - a[0]];   // polígono com área negativa → normal à esquerda é para fora
      const bays = Math.max(1, Math.round(len / (kind === 'i' ? 6 : 3.5)));
      if (centro && kind === 'i' && h > 5 && len > 6) {
        // centro: pavilhão de fábrica como a Piccadilly (fotos abr/2026): base de pedra, por andar faixa ocre, faixa de
        // janelas basculantes e faixa creme, marquise branca contínua entre os andares
        this._factoryWall(ch, a, b, len, out, floor, top, base, lit);
        continue;
      }
      if (kind === 'i' && h > 5) {
        // pavilhão: parede lisa (faixa sem janela da textura) e uma fileira de janelas altas no topo
        const ys = top - 2.4;
        ch.walls.quad([a[0], floor, a[1]], [b[0], floor, b[1]], [b[0], ys, b[1]], [a[0], ys, a[1]], [[0, 0.08], [bays, 0.08], [bays, 0.24], [0, 0.24]], wall, 0, out);
        ch.walls.quad([a[0], ys, a[1]], [b[0], ys, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], [[0, 0.1], [bays, 0.1], [bays, 0.95], [0, 0.95]], wall, lit, out);
      } else ch.walls.quad([a[0], floor, a[1]], [b[0], floor, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], [[0, 0], [bays, 0], [bays, floors], [0, floors]], wall, litS, out);
      if (floor - base > 0.05) ch.walls.quad([a[0], base, a[1]], [b[0], base, b[1]], [b[0], floor, b[1]], [a[0], floor, a[1]], [[0, 0.02], [bays, 0.02], [bays, 0.05], [0, 0.05]], wall, 0, out);
    }
    // ---- piloto do centro: sombra de contato, lojas no térreo, muro/portão das casas ----
    if (Math.hypot(cx, cz) < PILOT_R) {
      const n = p.length, H = this.t;
      for (let i = 0; i < n; i++) {
        const a = p[i], b = p[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], len = Math.hypot(ex, ez); if (len < 0.5) continue;
        const ox = -ez / len, oz = ex / len;   // normal para fora (mesma convenção de "out" acima: esquerda da aresta)
        // sombra de contato no chão, 1,3 m para fora da parede (no piso da calçada quando houver)
        const gy = (x, z) => H.heightAt(x, z) + this.surfOffset(x + ox * 0.6, z + oz * 0.6) + 0.03;
        const A1 = [a[0] + ox * 1.3, a[1] + oz * 1.3], B1 = [b[0] + ox * 1.3, b[1] + oz * 1.3];
        ch.ao.quad([a[0], gy(a[0], a[1]), a[1]], [b[0], gy(b[0], b[1]), b[1]], [B1[0], gy(B1[0], B1[1]), B1[1]], [A1[0], gy(A1[0], A1[1]), A1[1]], [[0, 0], [1, 0], [1, 1], [0, 1]], C.plain, 0, [0, 1, 0]);
        if (centro ? (kind === 'i' || len < 3.5 || h < 3.2) : (kind !== 'c' || len < 4 || h < 4)) continue;
        // loja no térreo quando a parede dá para a rua (sonda 2–6 m para fora: calçada ou pista)
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        let street = false; for (let k = 2; k <= 6 && !street; k += 2) street = this.surfOffset(mx + ox * k, mz + oz * k) > 0;
        if (!street) continue;
        const hv = hash(mx, mz), tint = new THREE.Color(0xffffff).lerp(new THREE.Color(SHOP_TINTS[Math.floor(hv * SHOP_TINTS.length)]), 0.55), bays = Math.max(1, Math.round(len / 5));
        const o2 = 0.04, P0 = [a[0] + ox * o2, floor, a[1] + oz * o2], P1 = [b[0] + ox * o2, floor, b[1] + oz * o2];
        ch.shops.quad(P0, P1, [P1[0], floor + 3.0, P1[2]], [P0[0], floor + 3.0, P0[2]], [[0, 0], [bays, 0], [bays, 1], [0, 1]], tint, 1, [ox, 0, oz]);
        // toldo/marquise sobre a calçada (1,2 m), na cor da loja; por baixo, cinza
        if (centro) this._signAndBalconies(ch, a, b, len, ox, oz, floor, top, h, kind, mx, mz, hv, sobrado);
        if (hv < 0.75) {
          const aw = new THREE.Color(SHOP_TINTS[Math.floor(hash(mz, mx) * SHOP_TINTS.length)]).multiplyScalar(0.85), y0 = floor + 3.05, y1 = floor + 2.75, d = 1.2;
          const Q = (q, k, y) => [q[0] + ox * k, y, q[1] + oz * k];
          ch.walls.quad(Q(a, 0.05, y0), Q(b, 0.05, y0), Q(b, d, y1), Q(a, d, y1), [[0, 0.1], [1, 0.1], [1, 0.2], [0, 0.2]], aw, 0, [ox * 0.3, 1, oz * 0.3]);
          ch.walls.quad(Q(a, 0.05, y0 - 0.02), Q(b, 0.05, y0 - 0.02), Q(b, d, y1 - 0.02), Q(a, d, y1 - 0.02), [[0, 0.1], [1, 0.1], [1, 0.2], [0, 0.2]], C.concreteDark, 0, [0, -1, 0]);
        }
      }
      // casas: guarda a frente para o muro/portão (montado depois, quando todos os prédios já existem)
      if (kind === 'h' && rect && rect.a * rect.b * 4 < 400) this._fronts.push({ p: p.map(q => q.slice()), cx, cz, floor, ch });
    }
    if (roof === 'flat' || !rect) {
      const col = this._realRoof() || pick(FLAT), y = top + 0.05;
      const tris = THREE.ShapeUtils.triangulateShape(p.map(([x, z]) => new THREE.Vector2(x, z)), []);
      for (const [i, j, k] of tris) ch.roofs.tri([p[i][0], y, p[i][1]], [p[j][0], y, p[j][1]], [p[k][0], y, p[k][1]], [[0.02, 0.6], [0.02, 0.6], [0.02, 0.6]], col, 0, [0, 1, 0]);   // laje: sem telha
      // platibanda
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length], out = [-(b[1] - a[1]), 0, b[0] - a[0]];
        ch.walls.quad([a[0], top, a[1]], [b[0], top, b[1]], [b[0], top + 0.6, b[1]], [a[0], top + 0.6, a[1]], [[0, 0.02], [1, 0.02], [1, 0.05], [0, 0.05]], wall, 0, out);
      }
      if (pilot && kind === 'c' && hash(cx - 9, cz + 4) < 0.65 && p.length >= 4) {   // caixa d'água azul de fibra sobre a laje
        const q = p[Math.floor(hash(cx, cz + 1) * p.length)], tx = q[0] + (cx - q[0]) * 0.25, tz = q[1] + (cz - q[1]) * 0.25;
        ch.walls.box(tx, top + 0.05, tz, 1.6, 0.25, 1.6, 1, 0, C.concreteDark, 0.0001);
        ch.walls.box(tx, top + 0.3, tz, 1.4, 1.1, 1.4, 1, 0, TRIM.tank, 0.0001);
        ch.walls.box(tx, top + 1.4, tz, 1.5, 0.12, 1.5, 1, 0, TRIM.tank, 0.0001);
      }
      return this.addCollider(p, cx, cz, id);
    }
    // telhado de duas águas (ou meia-água nos galpões) sobre o retângulo orientado
    const { a, b, ua, ub } = rect, o = roof === 'shed' ? 0.4 : 0.55, pitch = roof === 'shed' ? 0.18 : roof === 'hip' ? 0.55 : 0.75;
    let col = this._realRoof() || (roof === 'shed' ? pick(METAL) : pick(ROOFS)); const rh = b * pitch;
    if (pilot) col = col.clone().multiplyScalar(0.92 + 0.14 * hash(cx + 7, cz - 3));   // telhas mais novas/velhas
    const P = (sa, sb, y) => [rect.cx + ua[0] * sa + ub[0] * sb, y, rect.cz + ua[1] * sa + ub[1] * sb];
    const ye = top - o * pitch, yr = top + rh;
    if (roof === 'hip') {
      // quatro águas: cumeeira encurtada (recua b nas pontas), 2 trapézios + 2 triângulos
      const ra = Math.max(0, a - b);
      for (const s of [1, -1]) {
        const e1 = P(a + o, s * (b + o), ye), e2 = P(-a - o, s * (b + o), ye), r2 = P(-ra, 0, yr), r1 = P(ra, 0, yr);
        ch.roofs.quad(e1, e2, r2, r1, [[0, 0], [(2 * a + 2 * o) / 1.2, 0], [(2 * ra) / 1.2, (b + o) / 0.4], [0, (b + o) / 0.4]], col, 0, [ub[0] * s, 1, ub[1] * s]);
        ch.roofs.tri(P(s * (a + o), -(b + o), ye), P(s * (a + o), b + o, ye), P(s * ra, 0, yr), [[0, 0], [(2 * b + 2 * o) / 1.2, 0], [(b + o) / 1.2, (b + o) / 0.4]], col, 0, [ua[0] * s, 1, ua[1] * s]);
      }
      ch.roofs.quad(P(a + o, b + o, ye), P(-a - o, b + o, ye), P(-a - o, -b - o, ye), P(a + o, -b - o, ye), [[0, 0], [1, 0], [1, 1], [0, 1]], col, 0, [0, -1, 0]);
      if (pilot) this._roofTrim(ch, P, ua, a, b, o, ye, yr, Math.max(0, a - b), 'hip', cx, cz, floor, col);
      return this.addCollider(p, cx, cz, id);
    }
    for (const s of [1, -1]) {
      const e1 = P(a + o, s * (b + o), ye), e2 = P(-a - o, s * (b + o), ye), r2 = P(-a - o, 0, yr), r1 = P(a + o, 0, yr);
      const sl = Math.hypot(b + o, rh + o * pitch);
      ch.roofs.quad(e1, e2, r2, r1, [[0, 0], [(2 * a + 2 * o) / 1.2, 0], [(2 * a + 2 * o) / 1.2, sl / 0.4], [0, sl / 0.4]], col, 0, [ub[0] * s, 1, ub[1] * s]);
      // empena (triângulo de parede) nas pontas
      const g1 = P(s * a, b, top), g2 = P(s * a, -b, top), g3 = P(s * a, 0, top + rh);
      ch.walls.tri(g1, g2, g3, [[0.1, 0.02], [0.9, 0.02], [0.5, 0.05]], wall, 0, [ua[0] * s, 0, ua[1] * s]);
    }
    // forro sob o beiral (face de baixo) para não ver o telhado "oco"
    ch.roofs.quad(P(a + o, b + o, ye), P(-a - o, b + o, ye), P(-a - o, -b - o, ye), P(a + o, -b - o, ye), [[0, 0], [1, 0], [1, 1], [0, 1]], col, 0, [0, -1, 0]);
    if (pilot && roof !== 'shed') this._roofTrim(ch, P, ua, a, b, o, ye, yr, a + o, 'gable', cx, cz, floor, col);
    this.addCollider(p, cx, cz, id);
  }

  /** Ponto fora da rua: se cair na pista/calçada de algum trecho, vai para a borda externa da calçada (+5 cm). */
  _outOfStreet(x, z) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      for (const sg of this.surfBins.get(Math.floor(x / 50) + ',' + Math.floor(z / 50)) || []) {
        const [ax, az, bx, bz, half, sl, sr] = sg, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
        const t = ((x - ax) * dx + (z - az) * dz) / l2; if (t < 0 || t > 1) continue;
        const qx = ax + dx * t, qz = az + dz * t, l = Math.sqrt(l2), nx = -dz / l, nz = dx / l;
        const side = (x - qx) * nx + (z - qz) * nz, lim = half + (side >= 0 ? sl : sr) + 0.05;
        if (Math.abs(side) < lim) { const sg2 = side >= 0 ? 1 : -1; x = qx + nx * lim * sg2; z = qz + nz * lim * sg2; moved = true; }
      }
      if (!moved) break;
    }
    return [x, z];
  }

  /** Fachada de fábrica do centro (uma parede a→b). */
  _factoryWall(ch, a, b, len, out, floor, top, base, lit) {
    const F = this._fc || (this._fc = { stone: new THREE.Color(0xb6ab98), ocre: new THREE.Color(0xd9c59a), cream: new THREE.Color(0xf0ebde), white: new THREE.Color(0xf6f6f2) });
    const nf = Math.max(1, Math.round((top - floor) / 4.4)), fh = (top - floor) / nf, bays = Math.max(1, Math.round(len / 3.2));
    const Q = (y0, y1, col, uv, l = 0) => ch.walls.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], uv, col, l, out);
    const flat = [[0, 0.02], [1, 0.02], [1, 0.05], [0, 0.05]];   // faixa sem janela do atlas (cor lisa)
    Q(base, floor + 0.7, F.stone, flat);
    // letreiro da fábrica na fachada voltada para a R. Gen. Ernesto Dorneles (leste), no alto, perto da esquina
    const on = Math.hypot(out[0], out[2]), ex = out[0] / on, ez = out[2] / on;
    const mxp = (a[0] + b[0]) / 2, mzp = (a[1] + b[1]) / 2;   // só no pavilhão ao norte da Rua Coberta (Piccadilly)
    if (!this._picSign && ex > 0.9 && len > 12 && this.signs && mxp > 20 && mxp < 60 && mzp > -115 && mzp < -50) {
      this._picSign = true; const inf = this.signs.info.get('PICCADILLY');
      // na foto o letreiro é vertical, lido de baixo para cima, numa faixa clara perto da esquina
      if (inf) { const sw = 1.3, sh = Math.min(top - floor - 2.5, sw * inf.aspect), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, y0 = top - sh - 1.0, s0 = Math.min(len - 2, Math.max(3, len * 0.2));
        const P = (sd, y) => [a[0] + ux * (s0 + sd * sw / 2) + ex * 0.08, y, a[1] + uz * (s0 + sd * sw / 2) + ez * 0.08];
        ch.signs.quad(P(-1, y0), P(1, y0), P(1, y0 + sh), P(-1, y0 + sh), [[0, inf.v1], [0, inf.v0], [inf.u1, inf.v0], [inf.u1, inf.v1]], C.plain, 0, [ex, 0, ez]); }
    }
    for (let k = 0; k < nf; k++) {
      const y0 = floor + k * fh, w0 = y0 + 1.15, w1 = Math.min(y0 + fh - 0.9, w0 + 1.8);
      Q(k ? y0 : floor + 0.7, w0, F.ocre, flat);
      Q(w0, w1, F.cream, [[0, 0.28], [bays, 0.28], [bays, 0.78], [0, 0.78]], lit);   // janelas (atlas, estilo 0)
      Q(w1, y0 + fh, F.cream, flat);
      if (k < nf - 1 || nf === 1) {   // marquise: laje branca saindo 1 m da parede
        const ox = out[0] / Math.hypot(out[0], out[2]), oz = out[2] / Math.hypot(out[0], out[2]), yM = y0 + fh - 0.55;
        ch.walls.quad([a[0], yM, a[1]], [b[0], yM, b[1]], [b[0] + ox, yM, b[1] + oz], [a[0] + ox, yM, a[1] + oz], flat, F.white, 0, [0, 1, 0]);
        ch.walls.quad([a[0] + ox, yM - 0.18, a[1] + oz], [b[0] + ox, yM - 0.18, b[1] + oz], [b[0] + ox, yM, b[1] + oz], [a[0] + ox, yM, a[1] + oz], flat, F.white, 0, [ox, 0, oz]);
        ch.walls.quad([a[0] + ox, yM - 0.18, a[1] + oz], [b[0] + ox, yM - 0.18, b[1] + oz], [b[0], yM - 0.18, b[1]], [a[0], yM - 0.18, a[1]], flat, F.cream, 0, [0, -1, 0]);
      }
    }
  }

  /** Centro: letreiro legível acima da loja (nome real do cadastro a até 25 m, senão tipo de comércio) e sacadas. */
  _signAndBalconies(ch, a, b, len, ox, oz, floor, top, h, kind, mx, mz, hv, sobrado) {
    const S = this.signs; if (!S) return;
    const real = this._shopsC.filter(q => Math.hypot(q.x - mx, q.z - mz) < 25 && !this._usedSign?.has(q)).sort((p1, p2) => Math.hypot(p1.x - mx, p1.z - mz) - Math.hypot(p2.x - mx, p2.z - mz))[0];
    let txt; if (real) { (this._usedSign ||= new Set()).add(real); txt = real.n.toUpperCase().replace(' %', ''); } else txt = S.pick(hash(mx * 0.7, mz * 1.3));
    const inf = S.info.get(txt);
    if (inf) {
      const sh = 0.95, sw = Math.min(len - 0.4, sh * inf.aspect * 1.2), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
      const cxs = (a[0] + b[0]) / 2 + ux * (hash(mz, mx * 2) - 0.5) * Math.max(0, len - sw - 1), czs = (a[1] + b[1]) / 2 + uz * (hash(mz, mx * 2) - 0.5) * Math.max(0, len - sw - 1);
      const y0 = floor + 3.14, y1 = y0 + sh, o = 0.1;
      const P = (s, y) => [cxs + ux * s * sw / 2 + ox * o, y, czs + uz * s * sw / 2 + oz * o];
      ch.signs.quad(P(-1, y0), P(1, y0), P(1, y1), P(-1, y1), [[0, inf.v0], [inf.u1, inf.v0], [inf.u1, inf.v1], [0, inf.v1]], C.plain, 0, [ox, 0, oz]);
      // caixa do letreiro (espessura) na cor escura, para não parecer adesivo
      ch.walls.quad([cxs - ux * sw / 2, y0 - 0.04, czs - uz * sw / 2], [cxs + ux * sw / 2, y0 - 0.04, czs + uz * sw / 2], P(1, y0 - 0.04), P(-1, y0 - 0.04), [[0, 0.1], [1, 0.1], [1, 0.2], [0, 0.2]], C.concreteDark, 0, [0, -1, 0]);
    }
    // sacadas: prédios de 3+ andares (residenciais e comerciais), do 2º andar para cima, em parte das baias
    const floors = Math.max(1, Math.round(h / 3.1));
    if (floors < 3 || sobrado || len < 5) return;
    const nb = Math.max(1, Math.floor(len / 4.2)), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, glass = hash(mx + 3, mz) < 0.5;
    const slab = C.concrete, rail = glass ? new THREE.Color(0x9fb4bf) : new THREE.Color(0x3a3d42);
    for (let f = 1; f < floors; f++) for (let k = 0; k < nb; k++) {
      if (hash(mx + k * 1.7, mz + f) < 0.25) continue;
      const s0 = (k + 0.5) * len / nb, w = Math.min(3.2, len / nb - 0.6), y = floor + f * (h / floors) + 0.02;
      const qx = a[0] + ux * s0 + ox * 0.55, qz = a[1] + uz * s0 + oz * 0.55, ry = Math.atan2(ux, uz);
      ch.walls.box(qx, y - 0.14, qz, w, 0.14, 1.1, ux, uz, slab, 0.0001);   // laje
      const fx = qx + ox * 0.52, fz = qz + oz * 0.52;
      ch.walls.box(fx, y, fz, w, 1.0, 0.05, ux, uz, rail, 0.0001);            // guarda-corpo
    }
  }

  /** Acabamento do telhado (piloto): testeira/beiral com espessura, cumeeira, calha e condutor. Vai para as malhas de
   *  paredes/telhados existentes (nenhuma chamada de desenho a mais). */
  _roofTrim(ch, P, ua, a, b, o, ye, yr, ridgeHalf, type, cx, cz, floor, col) {
    const hv = hash(cx + 3, cz - 2), fasc = hv < 0.6 ? TRIM.white : TRIM.wood, pl = [[0, 0.1], [1, 0.1], [1, 0.2], [0, 0.2]], T = 0.22;
    const band = (p0, p1, face) => ch.walls.quad(p0, p1, [p1[0], p1[1] - T, p1[2]], [p0[0], p0[1] - T, p0[2]], pl, fasc, 0, face);
    const ub = [-ua[1], ua[0]];
    for (const s of [1, -1]) {
      band(P(a + o, s * (b + o), ye), P(-a - o, s * (b + o), ye), [ub[0] * s, 0, ub[1] * s]);                                  // beirais compridos
      if (type === 'hip') band(P(s * (a + o), -(b + o), ye), P(s * (a + o), b + o, ye), [ua[0] * s, 0, ua[1] * s]);
      else for (const t of [1, -1]) band(P(s * (a + o), t * (b + o), ye), P(s * (a + o), 0, yr), [ua[0] * s, 0, ua[1] * s]);   // testeiras das empenas
    }
    // cumeeira (telha capa mais escura)
    const rc = col.clone().multiplyScalar(0.78), r0 = P(0, 0, yr - 0.06);
    if (ridgeHalf > 0.2) ch.roofs.box(r0[0], r0[1], r0[2], ridgeHalf * 2, 0.13, 0.34, ua[0], ua[1], rc, 0.0001);
    // calha + condutor em parte das casas
    if (hash(cz, cx + 5) < 0.65) {
      const gc = hv < 0.6 ? TRIM.gutter : TRIM.white;
      for (const s of [1, -1]) {
        const g0 = P(0, s * (b + o + 0.07), ye - T - 0.12); ch.walls.box(g0[0], g0[1], g0[2], 2 * a + 2 * o, 0.13, 0.14, ua[0], ua[1], gc, 0.0001);
        const d0 = P(s * (a + o - 0.15), s * (b + o + 0.07), floor); if (s > 0) ch.walls.box(d0[0], floor, d0[2], 0.09, Math.max(0.5, ye - T - 0.1 - floor), 0.09, ua[0], ua[1], gc, 0.0001);
      }
    }
  }


  addCollider(p, cx, cz, id) {
    let r = 0; for (const [x, z] of p) r = Math.max(r, Math.hypot(x - cx, z - cz));
    const it = { p, cx, cz, r, id, top: this._top };
    const c0 = Math.floor((cx - r) / 50), c1 = Math.floor((cx + r) / 50), d0 = Math.floor((cz - r) / 50), d1 = Math.floor((cz + r) / 50);
    for (let i = c0; i <= c1; i++) for (let j = d0; j <= d1; j++) { const k = i + ',' + j; let a = this.colGrid.get(k); if (!a) this.colGrid.set(k, a = []); a.push(it); }
  }

  /** Altura do topo do prédio no ponto (ou -Infinity). */
  roofAt(x, z) {
    const a = this.colGrid.get(Math.floor(x / 50) + ',' + Math.floor(z / 50));
    if (a) for (const it of a) if (Math.hypot(x - it.cx, z - it.cz) < it.r + 1 && inPoly(x, z, it.p)) return it.top;
    return -Infinity;
  }

  /** Colisão com prédios: ponto (x,z) com raio r. */
  blocked(x, z, r) {
    const a = this.colGrid.get(Math.floor(x / 50) + ',' + Math.floor(z / 50));
    if (!a) return false;
    for (const it of a) {
      if (Math.hypot(x - it.cx, z - it.cz) > it.r + r) continue;
      if (inPoly(x, z, it.p)) return true;
      for (let i = 0; i < it.p.length; i++) { const p0 = it.p[i], p1 = it.p[(i + 1) % it.p.length]; if (segDist(x, z, p0[0], p0[1], p1[0], p1[1]) < r) return true; }
    }
    return false;
  }

  /** Muro baixo com portão na frente das casas do piloto (casas brasileiras: muro de alvenaria ou grade, portão de
   *  ferro). A frente é o lado cuja sonda encontra calçada/pista; o muro fica no limite do lote, antes da calçada, e só
   *  é feito se não cruzar outro prédio nem a calçada. Entra na malha das paredes (nenhuma chamada de desenho a mais). */
  buildFronts() {
    const H = this.t, plainUV = [[0, 0.1], [1, 0.1], [1, 0.2], [0, 0.2]], gateC = new THREE.Color(0x2b2e33), up = [0, 1, 0];
    for (const f of this._fronts) {
      const p = f.p, n = p.length; let best = null;
      for (let i = 0; i < n; i++) {
        const a = p[i], b = p[(i + 1) % n], ex = b[0] - a[0], ez = b[1] - a[1], len = Math.hypot(ex, ez); if (len < 4) continue;
        const ox = -ez / len, oz = ex / len, mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        for (let k = 1; k <= 9; k += 0.5) if (this.surfOffset(mx + ox * k, mz + oz * k) > 0) { if (!best || k < best.k) best = { a, b, ox, oz, k, len, ux: ex / len, uz: ez / len }; break; }
      }
      if (!best) continue;
      const { a, b, ox, oz, k, len, ux, uz } = best, off = k - 0.45, ext = 1.2;
      // porta da frente (cor variada) com degrau de concreto, na parede voltada para a rua
      const td = 0.25 + hash(f.cx, f.cz + 2) * 0.5, dx0 = a[0] + (b[0] - a[0]) * td, dz0 = a[1] + (b[1] - a[1]) * td;
      const dcol = DOORS[Math.floor(hash(f.cz + 2, f.cx) * DOORS.length)], dw = 0.48, D = (q, s2, y) => [q[0] + ux * s2 + ox * 0.03, y, q[1] + uz * s2 + oz * 0.03];
      f.ch.walls.quad(D([dx0, dz0], -dw, f.floor), D([dx0, dz0], dw, f.floor), D([dx0, dz0], dw, f.floor + 2.1), D([dx0, dz0], -dw, f.floor + 2.1), plainUV, dcol, 0, [ox, 0, oz]);
      f.ch.walls.box(dx0 + ox * 0.35, f.floor - 0.25, dz0 + oz * 0.35, 1.4, 0.25, 0.6, ux, uz, C.concreteDark, 0.0001);
      if (k < 2) continue;                                                           // casa colada na calçada: sem muro
      const A = [a[0] + ox * off - ux * ext, a[1] + oz * off - uz * ext], B = [b[0] + ox * off + ux * ext, b[1] + oz * off + uz * ext], L = len + 2 * ext;
      let ok = true; for (let t = 0; t <= 1.0001 && ok; t += 0.1) { const x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t; if (this.blocked(x, z, 0.25) || this.surfOffset(x, z) > 0) ok = false; }
      if (!ok) continue;
      const hv = hash(f.cx, f.cz), wallH = 0.9 + hv * 0.9, grade = hash(f.cz, f.cx) < 0.45, col = new THREE.Color(WALLS[Math.floor(hv * WALLS.length)]).multiplyScalar(0.95);
      const gate0 = 0.12 + hash(f.cx + 1, f.cz) * 0.4, gate1 = gate0 + Math.min(3.2, L * 0.35) / L;   // trecho do portão (fração)
      const seg = (t0, t1, h, c, thick) => {
        const P = t => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t], p0 = P(t0), p1 = P(t1), cx = (p0[0] + p1[0]) / 2, cz = (p0[1] + p1[1]) / 2;
        const y = Math.min(H.heightAt(p0[0], p0[1]), H.heightAt(p1[0], p1[1])) - 0.1;
        f.ch.walls.box(cx, y, cz, L * (t1 - t0), h + 0.1, thick, ux, uz, c, 0.0001);
      };
      seg(0, gate0, wallH, col, 0.18); seg(gate1, 1, wallH, col, 0.18);
      if (grade) { seg(0, gate0, 0.08, C.concreteDark, 0.22); for (const [t0, t1] of [[0, gate0], [gate1, 1]]) seg(t0, t1, wallH + 0.7, gateC, 0.03); }   // grade sobre muro baixo
      seg(gate0, gate1, 1.7, gateC, 0.05);                                                                                                        // portão de ferro
      // canteiro junto ao muro (lado de dentro): arbustos, cones e flores, deixando livre o portão e a frente da porta
      for (let t = 0.04; t < 0.97; t += 1.6 / L) {
        if (t > gate0 - 0.6 / L && t < gate1 + 0.6 / L) continue;
        const wx = A[0] + (B[0] - A[0]) * t - ox * 0.6, wz = A[1] + (B[1] - A[1]) * t - oz * 0.6, hv = hash(wx, wz);
        if (this.blocked(wx, wz, 0.45) || Math.hypot(wx - dx0, wz - dz0) < 1.6) continue;
        this._plants.push([wx, H.heightAt(wx, wz), wz, 0.6 + hv * 0.7, hv < 0.55 ? 0 : hv < 0.78 ? 1 : 2, hash(wz, wx)]);
      }
      // um arbusto de cada lado da porta, encostado na parede
      for (const sd of [-1.2, 1.2]) { const px = dx0 + ux * sd + ox * 0.55, pz = dz0 + uz * sd + oz * 0.55; if (!this.blocked(px, pz, 0.3)) this._plants.push([px, H.heightAt(px, pz), pz, 0.55 + hash(px, pz) * 0.3, hash(pz, px) < 0.5 ? 0 : 2, hash(px + 1, pz)]); }
      const W2 = 0.12, poly = [[A[0] - ox * W2, A[1] - oz * W2], [B[0] - ox * W2, B[1] - oz * W2], [B[0] + ox * W2, B[1] + oz * W2], [A[0] + ox * W2, A[1] + oz * W2]];
      this.addCollider(poly, (A[0] + B[0]) / 2, (A[1] + B[1]) / 2, -1);
    }
    this._fronts = null;
    this.buildPlants();
  }

  /** Plantas dos quintais do piloto: 3 malhas instanciadas (arbusto redondo, cone, flores), cor e escala por planta. */
  buildPlants() {
    const L = this._plants; this._plants = null; if (!L.length) return;
    const geos = [new THREE.IcosahedronGeometry(0.6, 0).scale(1, 0.75, 1).translate(0, 0.4, 0), new THREE.ConeGeometry(0.42, 1.7, 6, 1, true).translate(0, 0.85, 0), new THREE.IcosahedronGeometry(0.3, 0).scale(1, 0.6, 1).translate(0, 0.25, 0)];
    const greens = [0x3f6e2c, 0x4f7f33, 0x5b8a3a, 0x37602a, 0x6b8f3e], flowers = [0xd9569b, 0xd23a2a, 0xf2c12e, 0xf4f1ea, 0x9b59b6, 0xff8a3d];
    const d = new THREE.Object3D(), c = new THREE.Color();
    geos.forEach((geo, kind) => {
      const list = L.filter(q => q[4] === kind); if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), list.length);
      list.forEach(([x, y, z, sc, , hv], i) => {
        d.position.set(x, y, z); d.rotation.set(0, hv * 6.28, 0); d.scale.set(sc * (0.85 + hv * 0.3), sc * (0.8 + (1 - hv) * 0.4), sc * (0.9 + hv * 0.2)); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
        im.setColorAt(i, c.setHex(kind === 2 ? flowers[Math.floor(hv * flowers.length)] : greens[Math.floor(hv * greens.length)]).multiplyScalar(0.85 + hv * 0.3));
      });
      im.castShadow = false; im.receiveShadow = true;   // plantas baixas: a sombra de contato basta (orçamento de triângulos) im.computeBoundingSphere(); im.userData.kind = 'plants'; this.group.add(im);
    });
    this.plantCount = L.length;
  }

  /** Mostra/esconde regiões pela distância da câmera. */
  update(px, pz) {
    this._updateLamps(px, pz);
    for (const c of this.chunks.values()) {
      const d = Math.max(0, Math.hypot(px - c.cx, pz - c.cz) - c.size * 0.7);
      for (const m of c.meshes) {
        const k = m.userData.kind;
        m.visible = d < (k === 'marks' || k === 'walk' || k === 'ao' ? this.detailDist : k === 'roads' || k === 'cobble' ? this.roadDist : this.buildDist);
      }
    }
  }

  setNight(n) { this.wallMat.emissiveIntensity = n * 0.95; this.shopMat.emissiveIntensity = n * 0.8; if (this.signMat) this.signMat.emissiveIntensity = n * 0.7; if (this.lampMat) this.lampMat.emissiveIntensity = n * 1.6; if (this.poolMat) { this.poolMat.opacity = n * 0.55; this.pools.visible = n > 0.05; } }
}

/** Marca na máscara as células da grade do terreno dentro do polígono (varredura por linha). */
function rasterize(p, t, mask) {
  let z0 = Infinity, z1 = -Infinity; for (const q of p) { z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
  const j0 = Math.max(0, Math.ceil((z0 - t.z0) / t.cell)), j1 = Math.min(t.nz - 1, Math.floor((z1 - t.z0) / t.cell));
  // arestas por linha da grade
  const rows = Array.from({ length: j1 - j0 + 1 }, () => []);
  for (let i = 0, k = p.length - 1; i < p.length; k = i++) {
    const [ax, az] = p[k], [bx, bz] = p[i]; if (az === bz) continue;
    const lo = Math.max(j0, Math.ceil((Math.min(az, bz) - t.z0) / t.cell)), hi = Math.min(j1, Math.floor((Math.max(az, bz) - t.z0) / t.cell));
    for (let j = lo; j <= hi; j++) { const z = t.z0 + j * t.cell; if (z === Math.max(az, bz)) continue; rows[j - j0].push(ax + (bx - ax) * (z - az) / (bz - az)); }
  }
  rows.forEach((xs, r) => {
    xs.sort((a, b) => a - b); const j = j0 + r;
    for (let q = 0; q + 1 < xs.length; q += 2) {
      const i0 = Math.max(0, Math.ceil((xs[q] - t.x0) / t.cell) - 1), i1 = Math.min(t.nx - 1, Math.floor((xs[q + 1] - t.x0) / t.cell) + 1);
      for (let i = i0; i <= i1; i++) mask[j * t.nx + i] = 1;   // +1 célula de folga nas margens
    }
  });
}

/* ---------- utilidades de polilinha ---------- */
function resample(p, step) {
  const out = [p[0]];
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i], [bx, bz] = p[i + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  return out;
}
function pathLen(p) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s || 1; }
/** Normal (à esquerda) no vértice i; com miter=true devolve também o fator de esquina. */
function perp(p, i, miter = false) {
  const a = p[Math.max(0, i - 1)], b = p[i], c = p[Math.min(p.length - 1, i + 1)];
  let d1x = b[0] - a[0], d1z = b[1] - a[1], d2x = c[0] - b[0], d2z = c[1] - b[1];
  const l1 = Math.hypot(d1x, d1z) || 1, l2 = Math.hypot(d2x, d2z) || 1;
  d1x /= l1; d1z /= l1; d2x /= l2; d2z /= l2;
  if (i === 0) { d1x = d2x; d1z = d2z; } if (i === p.length - 1) { d2x = d1x; d2z = d1z; }
  let tx = d1x + d2x, tz = d1z + d2z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
  const nx = -tz, nz = tx;
  if (!miter) return [nx, nz];
  const m = Math.min(2, 1 / Math.max(0.5, nx * -d1z + nz * d1x));
  return [nx, nz, m];
}
function signedArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
/** Se o polígono é (quase) um retângulo, devolve o retângulo orientado. */
function asRect(p) {
  if (p.length !== 4) return null;
  const e = i => [p[(i + 1) % 4][0] - p[i][0], p[(i + 1) % 4][1] - p[i][1]];
  const e0 = e(0), e1 = e(1), l0 = Math.hypot(...e0), l1 = Math.hypot(...e1);
  if (Math.abs(e0[0] * e1[0] + e0[1] * e1[1]) / (l0 * l1) > 0.2) return null;
  const cx = p.reduce((s, q) => s + q[0], 0) / 4, cz = p.reduce((s, q) => s + q[1], 0) / 4;
  const u0 = [e0[0] / l0, e0[1] / l0], u1 = [e1[0] / l1, e1[1] / l1];
  return l0 >= l1 ? { cx, cz, a: l0 / 2, b: l1 / 2, ua: u0, ub: u1, area: l0 * l1 } : { cx, cz, a: l1 / 2, b: l0 / 2, ua: u1, ub: u0, area: l0 * l1 };
}

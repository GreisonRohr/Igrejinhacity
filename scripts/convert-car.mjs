// Converte um carro baixado do Sketchfab (GLB original do autor) para o formato do jogo:
//  - remove o que não é carro (chão de estúdio, sombra pintada), aplica as transformações nos vértices;
//  - frente em +z, centro em x/z = 0, pneus no chão (y = 0), escala pelo comprimento real (m);
//  - separa as 4 rodas (pneu + aro, pelo cilindro de cada pneu) em nós "wheel_*" com o pivô no centro da roda;
//  - junta materiais escuros sem textura, renomeia a pintura para "paint" (cor por instância no jogo);
//  - simplifica (meshoptimizer) até `faces` e reduz as texturas (webp, `tex` px).
// Uso: node scripts/convert-car.mjs entrada.glb saida.glb '<json de configuração>'
// (precisa de @gltf-transform/core|functions|extensions, meshoptimizer e sharp — só na hora de converter).
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, clearNodeTransform, weld, dedup, prune, simplify, simplifyPrimitive, join, textureCompress, getBounds, normals } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [inp, out, cfgJson] = process.argv.slice(2);
const cfg = JSON.parse(cfgJson);
// cfg: { length, drop:[nomes de nós], paint:'material', tyre:'material', rimMats:[...], rear:'material das lanternas',
//        dark:[materiais escuros a juntar], dropMats:[materiais a remover], faces, tex }
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const R = doc.getRoot(), scene = R.listScenes()[0];

// 1. remove nós que não são o carro
for (const n of R.listNodes()) if ((cfg.drop || []).includes(n.getName())) n.dispose();
for (const m of R.listMaterials()) if ((cfg.dropMats || []).includes(m.getName())) for (const mesh of R.listMeshes()) for (const p of mesh.listPrimitives()) if (p.getMaterial() === m) p.dispose();
await doc.transform(prune());

// 2. transformações nos vértices (tudo em coordenadas do mundo)
await doc.transform(flatten());
for (const n of scene.listChildren()) clearNodeTransform(n);
for (const n of R.listNodes()) if (n.getMesh()) clearNodeTransform(n);

// percorre triângulos de todas as primitivas
const prims = () => R.listMeshes().flatMap(m => m.listPrimitives());
function eachVertex(fn) { for (const p of prims()) { const a = p.getAttribute('POSITION'), v = []; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); fn(v); a.setElement(i, v); } } }
function transformNormals(fn) { for (const p of prims()) { const a = p.getAttribute('NORMAL'); if (!a) continue; const v = []; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); fn(v); a.setElement(i, v); } } }
const bounds = () => getBounds(scene);
const centroidOf = matName => { let s = [0, 0, 0], n = 0; for (const p of prims()) if (p.getMaterial()?.getName() === matName) { const a = p.getAttribute('POSITION'), v = []; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); s[0] += v[0]; s[1] += v[1]; s[2] += v[2]; n++; } } return n ? s.map(x => x / n) : null; };

// 3. eixo do comprimento → z; frente → +z
let b = bounds(); const size = b.max.map((v, i) => v - b.min[i]);
if (size[0] > size[2]) { eachVertex(v => { const x = v[0]; v[0] = -v[2]; v[2] = x; }); transformNormals(v => { const x = v[0]; v[0] = -v[2]; v[2] = x; }); }
if (size[1] > size[2] && size[1] > size[0]) throw new Error('eixo vertical inesperado');
b = bounds(); const cz = (b.min[2] + b.max[2]) / 2;
const rear = centroidOf(cfg.rear);
if (!rear) throw new Error('material das lanternas não encontrado: ' + cfg.rear);
if (rear[2] > cz) { eachVertex(v => { v[0] = -v[0]; v[2] = -v[2]; }); transformNormals(v => { v[0] = -v[0]; v[2] = -v[2]; }); }

// 4. escala real e posição (centro x/z, rodas no chão)
b = bounds(); const L = b.max[2] - b.min[2], k = cfg.length / L;
const c = [(b.min[0] + b.max[0]) / 2, b.min[1], (b.min[2] + b.max[2]) / 2];
eachVertex(v => { v[0] = (v[0] - c[0]) * k; v[1] = (v[1] - c[1]) * k; v[2] = (v[2] - c[2]) * k; });

// 5. rodas: pneus por quadrante → centro e raio de cada roda
const tri = p => { const idx = p.getIndices(); const n = idx ? idx.getCount() : p.getAttribute('POSITION').getCount(); const out = []; for (let i = 0; i < n; i += 3) out.push(idx ? [idx.getScalar(i), idx.getScalar(i + 1), idx.getScalar(i + 2)] : [i, i + 1, i + 2]); return out; };
const quads = { fl: [1, 1], fr: [-1, 1], rl: [1, -1], rr: [-1, -1] }, W = {};
for (const q of Object.keys(quads)) W[q] = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
const quadOf = (x, z) => (z >= 0 ? 'f' : 'r') + (x >= 0 ? 'l' : 'r');
for (const p of prims()) if (p.getMaterial()?.getName() === cfg.tyre) {
  const a = p.getAttribute('POSITION'), v = [];
  for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); const w = W[quadOf(v[0], v[2])]; for (let j = 0; j < 3; j++) { w.min[j] = Math.min(w.min[j], v[j]); w.max[j] = Math.max(w.max[j], v[j]); } }
}
for (const [q, w] of Object.entries(W)) { w.c = w.min.map((v, i) => (v + w.max[i]) / 2); w.r = (w.max[1] - w.min[1]) / 2; w.hw = (w.max[0] - w.min[0]) / 2; if (!(w.r > 0.15 && w.r < 0.6)) throw new Error(`roda ${q} com raio ${w.r}`); }

// separa triângulos (pneu inteiro + aros dentro do cilindro) em primitivas novas por roda
function subPrim(p, tris) {
  const map = new Map(), order = [];
  for (const t of tris) for (const i of t) if (!map.has(i)) { map.set(i, order.length); order.push(i); }
  const np = doc.createPrimitive().setMaterial(p.getMaterial()).setMode(p.getMode());
  for (const sem of p.listSemantics()) {
    const a = p.getAttribute(sem), sz = a.getElementSize(), arr = new (a.getArray().constructor)(order.length * sz), v = [];
    order.forEach((src, j) => { a.getElement(src, v); arr.set(v, j * sz); });
    np.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(arr).setNormalized(a.getNormalized()).setBuffer(R.listBuffers()[0]));
  }
  const ix = new Uint32Array(tris.length * 3); tris.forEach((t, j) => { ix[j * 3] = map.get(t[0]); ix[j * 3 + 1] = map.get(t[1]); ix[j * 3 + 2] = map.get(t[2]); });
  np.setIndices(doc.createAccessor().setType('SCALAR').setArray(ix).setBuffer(R.listBuffers()[0]));
  return np;
}
const wheelPrims = { fl: [], fr: [], rl: [], rr: [] };
for (const mesh of R.listMeshes()) for (const p of [...mesh.listPrimitives()]) {
  const name = p.getMaterial()?.getName(), isTyre = name === cfg.tyre, isRim = (cfg.rimMats || []).includes(name);
  if (!isTyre && !isRim) continue;
  const a = p.getAttribute('POSITION'), v = [], P = i => (a.getElement(i, v), [...v]);
  const keep = [], per = { fl: [], fr: [], rl: [], rr: [] };
  for (const t of tri(p)) {
    const g = [0, 1, 2].map(j => (P(t[0])[j] + P(t[1])[j] + P(t[2])[j]) / 3), q = quadOf(g[0], g[2]), w = W[q];
    const inside = isTyre || (Math.hypot(g[1] - w.c[1], g[2] - w.c[2]) < w.r * 0.97 && Math.abs(g[0] - w.c[0]) < w.hw * 1.3);
    (inside ? per[q] : keep).push(t);
  }
  for (const q of Object.keys(per)) if (per[q].length) wheelPrims[q].push(subPrim(p, per[q]));
  if (keep.length) mesh.addPrimitive(subPrim(p, keep));
  p.dispose();
}
for (const [q, list] of Object.entries(wheelPrims)) {
  const w = W[q], mesh = doc.createMesh('wheel_' + q);
  for (const p of list) { const a = p.getAttribute('POSITION'), v = []; for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); a.setElement(i, [v[0] - w.c[0], v[1] - w.c[1], v[2] - w.c[2]]); } mesh.addPrimitive(p); }
  scene.addChild(doc.createNode('wheel_' + q).setMesh(mesh).setTranslation(w.c));
}

// 6. materiais: escuros juntos, pintura nomeada
const dark = R.listMaterials().filter(m => (cfg.dark || []).includes(m.getName()));
if (dark.length) { const d = dark[0].setName('trim_dark').setBaseColorFactor([0.02, 0.02, 0.022, 1]).setMetallicFactor(0.2).setRoughnessFactor(0.55); for (const p of prims()) if (dark.includes(p.getMaterial())) p.setMaterial(d); }
const paint = R.listMaterials().find(m => m.getName() === cfg.paint); if (paint) paint.setName('paint').setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0.55).setRoughnessFactor(0.28);
for (const m of R.listMaterials()) for (const e of m.listExtensions()) if (e.extensionName === 'KHR_materials_specular') e.dispose();

// 7. corpo junto num nó; simplificação e texturas
const body = doc.createMesh('body'), bodyNode = doc.createNode('body').setMesh(body);
for (const n of [...scene.listChildren()]) if (!/^wheel_/.test(n.getName())) { const m = n.getMesh(); if (m) for (const p of m.listPrimitives()) body.addPrimitive(p); n.dispose(); }
scene.addChild(bodyNode);
await doc.transform(dedup(), weld(), join({ keepNamed: true }), prune());
const untextured = p => !p.getMaterial()?.getBaseColorTexture();
const strip = p => { for (const sem of p.listSemantics()) if (sem !== 'POSITION') p.setAttribute(sem, null); };
const faces = () => prims().reduce((s, p) => s + p.getIndices().getCount() / 3, 0);
const f0 = faces();
if (cfg.ratios) {
  for (const p of prims()) if ((cfg.stripMats || []).includes(p.getMaterial()?.getName())) strip(p);
  await doc.transform(weld());
  // por material: a lataria (pintura) fica intacta; peças internas, aros e pretos são reduzidos com erro pequeno
  await MeshoptSimplifier.ready;
  for (const p of prims()) { const r = cfg.ratios[p.getMaterial()?.getName()] ?? cfg.ratios['*'] ?? 1; if (r < 1) simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: r, error: p.getMaterial()?.getName() === 'paint' ? (cfg.err || 0.002) : (cfg.err2 || cfg.err || 0.002), lockBorder: true }); }
  await doc.transform(prune(), normals({ overwrite: false }), weld());
} else if (cfg.faces && f0 > cfg.faces) {
  await MeshoptSimplifier.ready;
  await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: cfg.faces / f0, error: cfg.err || 0.002, lockBorder: true }));
}
// 8. nível leve ("lod1", no mesmo arquivo) para os carros estacionados: carroceria + rodas numa malha só, sem
//    interior, vidro opaco escuro, simplificado até ~cfg.lodFaces triângulos
if (cfg.lodFaces) {
  await MeshoptSimplifier.ready;
  const lod = doc.createMesh('lod1');
  let glassOpaque = null;
  for (const n of scene.listChildren()) {
    const m = n.getMesh(); if (!m || n.getName() === 'lod1') continue; const t = n.getTranslation();
    for (const p of m.listPrimitives()) {
      const mat = p.getMaterial(), name = mat?.getName();
      if ((cfg.lodDrop || []).includes(name)) continue;
      const np = subPrim(p, tri(p)), a = np.getAttribute('POSITION'), v = [];
      for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); a.setElement(i, [v[0] + t[0], v[1] + t[1], v[2] + t[2]]); }
      if ((cfg.glass || []).includes(name)) { glassOpaque ||= doc.createMaterial('glass_lod').setBaseColorFactor([0.03, 0.035, 0.04, 1]).setMetallicFactor(0.6).setRoughnessFactor(0.15); np.setMaterial(glassOpaque); }
      if (untextured(np)) strip(np);
      lod.addPrimitive(np);
    }
  }
  await doc.transform(weld());
  const total = lod.listPrimitives().reduce((s, p) => s + p.getIndices().getCount() / 3, 0);
  for (const p of lod.listPrimitives()) simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: Math.min(1, cfg.lodFaces / total), error: cfg.lodErr || 0.04, lockBorder: false });
  scene.addChild(doc.createNode('lod1').setMesh(lod));
  await doc.transform(join({ keepNamed: true }), prune(), normals({ overwrite: false }), weld());
}
await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [cfg.tex || 512, cfg.tex || 512], quality: 82 }), prune());
await io.write(out, doc);
const facesOf = nm => R.listNodes().filter(n => n.getName() === nm || (nm === 'lod0' && n.getName() !== 'lod1')).reduce((s, n) => s + (n.getMesh()?.listPrimitives().reduce((t, p) => t + p.getIndices().getCount() / 3, 0) || 0), 0);
console.log(JSON.stringify({ faces0: f0, lod0: facesOf('lod0'), lod1: facesOf('lod1'), drawsLod1: R.listNodes().find(n => n.getName() === 'lod1')?.getMesh().listPrimitives().length, rodas: Object.fromEntries(Object.entries(W).map(([q, w]) => [q, { c: w.c.map(x => +x.toFixed(3)), r: +w.r.toFixed(3) }])), materiais: R.listMaterials().map(m => m.getName()) }));

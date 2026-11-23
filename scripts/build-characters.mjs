// Prepara os personagens humanos CC0 da Quaternius para o jogo (celular primeiro).
// Fonte (CC0 1.0, domínio público): "Universal Base Characters [Standard]" e "Universal Animation Library [Standard]",
// https://quaternius.com  (itch.io: quaternius.itch.io/universal-base-characters e /universal-animation-library).
// Uso: node scripts/build-characters.mjs <pasta com os .zip extraídos>   →  public/models/people/*.glb
// O que faz: tira atributos que o jogo não usa, reduz texturas (WebP 1024/512), separa só as animações usadas.
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, textureCompress, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = process.argv[2];
if (!SRC) { console.error('uso: node scripts/build-characters.mjs <pasta>'); process.exit(1); }
const OUT = 'public/models/people';
fs.mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const find = (re) => { const r = []; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (re.test(p)) r.push(p); } }; walk(SRC); return r; };

/** Mantém só posição, normal, UV0, ossos e pesos. */
function slim(doc) {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives())
    for (const s of prim.listSemantics()) if (!['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0'].includes(s)) prim.setAttribute(s, null);
}
/** Lê um .gltf corrigindo nomes de textura trocados no pacote (ex.: "T_Hair_1_Normal_png.png" → "T_Hair_1_Normal.png"). */
async function read(f) {
  if (f.endsWith('.gltf')) {
    const j = JSON.parse(fs.readFileSync(f, 'utf8')), dir = path.dirname(f);
    for (const im of j.images || []) {
      if (!im.uri || fs.existsSync(path.join(dir, decodeURIComponent(im.uri)))) continue;
      const alt = decodeURIComponent(im.uri).replace(/_png(\.png)$/, '$1');
      if (fs.existsSync(path.join(dir, alt))) fs.copyFileSync(path.join(dir, alt), path.join(dir, decodeURIComponent(im.uri)));
    }
  }
  return io.read(f);
}
async function finish(doc, file, size, ratio = 1) {
  slim(doc);
  if (ratio < 1) { await MeshoptSimplifier.ready; await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: true })); }
  await doc.transform(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 82 }), dedup(), prune());
  await io.write(path.join(OUT, file), doc);
  console.log(file, Math.round(fs.statSync(path.join(OUT, file)).size / 1024), 'KB');
}

// corpos (masculino e feminino), com olhos e sobrancelhas
for (const [name, re] of [['male.glb', /Godot - UE[\\/]Superhero_Male_FullBody\.gltf$/], ['female.glb', /Godot - UE[\\/]Superhero_Female_FullBody\.gltf$/]]) {
  const f = find(re)[0]; if (!f) { console.warn('faltou', name); continue; }
  const doc = await read(f);
  // pele clara como base (o jogo escurece por pessoa multiplicando a cor; clarear não funciona)
  for (const t of doc.getRoot().listTextures()) {
    const uri = t.getURI() || '';
    if (!/Dark/.test(uri)) continue;
    const light = find(/Base Characters[\\/]Textures[\\/]T_Superhero_(Male_Ligh|Female_Light_BaseColor)\.png$/).find(p => /Female/.test(p) === /Female/.test(uri));
    if (light) { t.setImage(fs.readFileSync(light)); t.setURI(path.basename(light)); console.log('  pele clara:', path.basename(light)); }
  }
  await finish(doc, name, 1024, 0.5);   // metade dos triângulos (celular)
}
// cabelos e barba presos ao osso da cabeça (o jogo religa ao esqueleto do corpo pelo nome dos ossos)
for (const f of find(/Rigged to Head Bone[\\/]glTF[^\\/]*[\\/](Hair_\w+|Eyebrows_\w+)\.gltf$/)) {
  await finish(await read(f), path.basename(f, '.gltf').toLowerCase() + '.glb', 512);
}
// animações: só as usadas pelo jogo, sem malha
const KEEP = ['Idle_Loop', 'Walk_Loop', 'Walk_Formal_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land',
  'Sitting_Idle_Loop', 'Sitting_Talking_Loop', 'Idle_Talking_Loop', 'Interact', 'Dance_Loop'];
{
  const f = find(/UAL1_Standard\.glb$/)[0];
  const doc = await io.read(f), root = doc.getRoot();
  for (const a of root.listAnimations()) if (!KEEP.includes(a.getName())) a.dispose();
  for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
  // trilhas que quase não aparecem: dedos (a mão fica na pose do primeiro quadro), escala, e posição fora da bacia
  for (const a of root.listAnimations()) for (const ch of a.listChannels()) {
    const n = ch.getTargetNode()?.getName() || '', p = ch.getTargetPath();
    if (/index|middle|pinky|ring|thumb|leaf/.test(n) || p === 'scale' || (p === 'translation' && !/pelvis|root/.test(n))) { ch.getSampler()?.dispose(); ch.dispose(); }
  }
  for (const m of root.listMeshes()) m.dispose();
  await doc.transform(resample(), dedup(), prune({ keepLeaves: true }));
  // acessores órfãos (das animações e malhas descartadas)
  for (const acc of root.listAccessors()) if (!acc.listParents().some(p => p.propertyType !== 'Root')) acc.dispose();
  await io.write(path.join(OUT, 'anims.glb'), doc);
  // segunda passada num grafo limpo: some com acessores que só a raiz referencia
  const d2 = await io.read(path.join(OUT, 'anims.glb'));
  for (const acc of d2.getRoot().listAccessors()) if (!acc.listParents().some(p => p.propertyType !== 'Root')) acc.dispose();
  await io.write(path.join(OUT, 'anims.glb'), d2);
  console.log('anims.glb', Math.round(fs.statSync(path.join(OUT, 'anims.glb')).size / 1024), 'KB', root.listAnimations().map(a => a.getName()).join(', '));
}
fs.writeFileSync(path.join(OUT, 'LICENSE.txt'), 'Personagens e animações: Quaternius (quaternius.com), CC0 1.0 Universal (domínio público).\nhttps://creativecommons.org/publicdomain/zero/1.0/\nConvertidos por scripts/build-characters.mjs.\n');

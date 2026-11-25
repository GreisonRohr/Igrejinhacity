import * as THREE from 'three';
import './style.css';
import { Terrain } from './world/terrain.js';
import { Sky } from './world/sky.js';
import { makeLabel } from './world/labels.js';
import { Input, isTouch } from './input.js';
import { Walker, makePerson } from './player/walker.js';
import { makeContactShadow } from './player/person.js';
import { tryLoadGLB } from './player/glbmodel.js';
import { FollowCam } from './camera.js';
import { Minimap } from './ui/minimap.js';
import { LANDMARKS, byId, PLACE_STYLE } from './landmarks.js';
import { City } from './world/city.js';
import { buildStreetLife } from './world/streetlife.js';
import { buildGroundCanvas, groundTexture } from './world/ground.js';
import { fetchPackedJSON } from './util/load.js';
import { placeLandmarks, buildLandmarks } from './world/landmarks3d.js';
import { FixedLoop } from './core/loop.js';
import { buildSpatial } from './core/spatial.js';
import { events } from './core/events.js';
import { NavGraph } from './nav/graph.js';
import { Pedestrians } from './sim/pedestrians.js';
import { Interactions } from './interact/interact.js';
import { TreeLOD } from './world/trees.js';
import { buildUrbano } from './world/urbano.js';
import { BigMap } from './ui/bigmap.js';
import { CharSelect } from './ui/charselect.js';
import { Vehicle, CAR_TYPES, loadRealCars } from './game/vehicle.js';
import { ParkedLOD } from './game/parkedlod.js';
import { buildForest } from './world/forest.js';
import { loadHumans } from './player/humans.js';
import { PERSONAGENS } from './player/costumes.js';
import { MAP_MALE_CASUAL } from './player/retarget.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
export const VERSAO = 'Centro 5 · Bordas da praça e do arroio';
if (params.has('keepgeo')) globalThis.__keepGeo = true;

/* ---------- qualidade (celular x computador) ---------- */
const Q = isTouch
  ? { pixelRatio: 1.25, shadowSize: 1024, shadowRange: 45, fogFar: 4000, antialias: false, ground: 2048, buildDist: 1700, roadDist: 600 }
  : { pixelRatio: 1.5, shadowSize: 2048, shadowRange: 60, fogFar: 8000, antialias: true, ground: 4096, buildDist: 3000, roadDist: 900 };

const renderer = new THREE.WebGLRenderer({ antialias: Q.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // curva filmica: altas luzes suaves, cores naturais
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.5, Q.fogFar * 1.2);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

if (isTouch) {
  document.body.classList.add('touch');
  $('keysDesk').innerHTML = '<kbd>Joystick</kbd><span>andar (empurre tudo para correr; segure para sprint)</span><kbd>Pular</kbd><span>pular</span><kbd>Arrastar a tela</kbd><span>girar a câmera</span>';
}

/* ---------- toast e HUD ---------- */
let toastT = 0;
function toast(title, txt = '', sec = 4) {
  const el = $('toast'); el.textContent = '';
  const b = document.createElement('b'); b.textContent = title;
  el.append(b, document.createTextNode(txt)); el.classList.add('on'); toastT = sec;
}

/* ---------- carregamento ---------- */
const BASE = import.meta.env.BASE_URL;
const [terrain, world, navData, geoX] = await Promise.all([Terrain.load(BASE), fetchPackedJSON(BASE + 'data/world.data.json'), fetchPackedJSON(BASE + 'data/nav.data.json'),
  fetchPackedJSON(BASE + 'data/geoextra.data.json').catch(() => null)]);
// pontos do mapa interativo do site de turismo (scripts/fetch-turismo.mjs)
const turismo = await fetch(BASE + 'data/turismo.json').then(r => r.json()).catch(() => null);
// dados do cadastro e zoneamento do GEO Igrejinha (scripts/build-geo-extra.mjs): pavimentos reais e zona industrial
if (geoX) world.buildings.forEach((b, i) => {
  const fl = geoX.floors[i] || 0, area = b.rect ? b.rect[4] * b.rect[5] * 4 : 0;
  // prédios da Prefeitura já trazem pavimentos; o cadastro só sobe quando o prédio é grande (apartamentos/salas)
  const lv = b.src === 'pref' ? (fl > (b.lv || 1) && area > 120 ? fl : b.lv || 1) : fl || b.lv || 1;
  if (lv !== b.lv && b.kind === 'industrial' && area > 600) b.h = Math.max(b.h, Math.min(14, lv * 4)); // pavilhão: pé-direito alto, sem andares
  else if (lv !== b.lv) { b.lv = lv; b.h = lv * 3.0 + 0.4; if (lv >= 3 && b.kind === 'house') b.kind = 'commercial'; }
  if (geoX.ind[i] && area > 300 && b.kind !== 'industrial') { b.kind = 'industrial'; b.h = Math.max(b.h, 8); }
});
if (geoX) for (const p of geoX.places) world.places.push(p);
if (turismo) for (const p of turismo.places) world.places.push(p);
const nav = new NavGraph(navData);                     // grafo de ruas e calçadas (src/nav/graph.js)
// carregamento em etapas: a thread é liberada entre elas, a tela mostra o progresso e nunca congela
const bar = $('loadbar'), barTxt = $('loadtxt');
const yieldUI = () => new Promise(r => setTimeout(r, 0));
const stage = async (label, from, to, fn) => {
  const t0 = performance.now();
  const set = f => { const v = from + (to - from) * f; bar.style.width = (v * 100).toFixed(0) + '%'; barTxt.textContent = label; };
  set(0); await yieldUI();
  const r = await fn(async f => { set(f); await yieldUI(); });
  set(1);
  if (DEBUG) console.log('@' + Math.round(t0), label, Math.round(performance.now() - t0) + ' ms', performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : '');
  return r;
};
const LM = placeLandmarks(world, terrain);
const city = new City(world, terrain, Q, LM.exclusions);
// cores reais dos telhados, tiradas da imagem aérea da Prefeitura (scripts/build-roofs.py)
city.roofColors = await fetchPackedJSON(BASE + 'data/roofs.data.json').catch(() => null);
city.roofShapes = await fetchPackedJSON(BASE + 'data/roofshape.data.json').catch(() => null);   // laje, duas ou quatro águas
city.valaoZones = [{ x: 10, z: 22, r: 42 }];   // Arroio Koetz canalizado na Praça Dona Luísa (paredes retas)
await stage('Escavando o Paranhana…', 0.05, 0.1, () => city.carveWater());
const landuseImg = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = BASE + 'data/landuse.webp'; });
const groundCanvas = await stage('Pintando o chão…', 0.1, 0.18, () => buildGroundCanvas(terrain, world, Math.min(Q.ground, renderer.capabilities.maxTextureSize), landuseImg));
terrain.material.map = groundTexture(groundCanvas, renderer);
// foto aérea da Prefeitura (GEO Igrejinha 2016) no chão perto da câmera
fetch(BASE + 'ortho/index.json').then(r => r.ok ? r.json() : null).then(ix => { if (ix) terrain.setOrtho(ix, BASE, isTouch ? { near: 650, far: 1000 } : { near: 1000, far: 1400 }, groundCanvas); }).catch(() => {});
await stage('Erguendo a Serra…', 0.18, 0.22, () => scene.add(terrain.build()));
await stage('Construindo a cidade…', 0.22, 0.7, async tick => scene.add(await city.build(tick)));
const landmarks = await stage('Montando a Igreja, a praça e a Oktoberfest…', 0.7, 0.82, () => buildLandmarks(LM, world, terrain, scene, city));
const realTrees = await fetchPackedJSON(BASE + 'data/trees.data.json').catch(() => null);
const street = await stage('Plantando árvores…', 0.82, 0.88, () => buildStreetLife(world, terrain, city, Q, landmarks.parking, realTrees, (x, z) => (landmarks.inPraca && landmarks.inPraca(x, z)) || landmarks.blocked(x, z, 2.5)));   // sem árvore dentro dos pontos (copa ~2,5 m)
// árvores detalhadas perto da câmera (cartões de folha, vento); longe ficam as copas simples
const treeLOD = new TreeLOD(scene, { cap: isTouch ? { leafy: 70, big: 24, palm: 26, bigP: 16, fig: 20 } : { leafy: 110, big: 30, palm: 34, bigP: 16, fig: 22 }, radius: isTouch ? 90 : 110 });
for (const t of street.trees) treeLOD.add(t);
for (const t of landmarks.trees) treeLOD.add(t, true);
const forestData = await fetchPackedJSON(BASE + 'data/forest.data.json').catch(() => null);
const forest = forestData ? buildForest(forestData, terrain, scene, { dist: isTouch ? 800 : 1200 }) : null;
scene.add(street.group);
if (DEBUG) console.log('rua:', JSON.stringify(street.counts));
const sky = new Sky(scene, Q);

// placas dos pontos marcantes
const labels = [];
for (const l of LANDMARKS) {
  if (['ruacoberta', 'igreja', 'waldir'].includes(l.id)) continue;   // têm placa no próprio modelo
  const far = l.id === 'cruz' || l.id === 'asadelta';
  const s = makeLabel(l.nome, far ? 120 : 22);
  s.position.set(l.x, terrain.heightAt(l.x, l.z) + (far ? 90 : 22), l.z);
  s.userData.maxDist = far ? 1e9 : 2500;
  scene.add(s); labels.push(s);
}

// nome dos edifícios do cadastro: placa pequena perto do topo, visível de perto
if (geoX) for (const [x, z, n, i] of geoX.names) { const b = world.buildings[i]; const s = makeLabel(n, 5); s.position.set(x, terrain.heightAt(x, z) + (b?.h || 12) + 3, z); s.userData.maxDist = 160; scene.add(s); labels.push(s); }
// lugares do OSM (escolas, bancos, postos…): placa pequena, visível de perto, e ícone no minimapa
const places = world.places
  .filter(p => !LANDMARKS.some(l => Math.hypot(l.x - p.x, l.z - p.z) < 60))
  .map(p => ({ ...p, ...PLACE_STYLE[p.k], nome: p.n }));
for (const p of places) {
  if (p.k === 'onibus' || p.k === 'patrimonio') continue;   // paradas e patrimônio: só o ícone no minimapa
  const big = p.k === 'localidade';                    // morros e localidades: placa grande, vista de longe
  const s = makeLabel(p.n, big ? 60 : 9);
  s.position.set(p.x, terrain.heightAt(p.x, p.z) + (big ? 60 : 12), p.z);
  s.userData.maxDist = big ? 6000 : 350;
  scene.add(s); labels.push(s);
}

/* ---------- jogador ---------- */
let spawn = byId.praca;
if (params.get('spawn') && byId[params.get('spawn')]) spawn = byId[params.get('spawn')];
const player = new Walker(scene, terrain, spawn.x + 6, spawn.z + 6);
// consulta espacial única (prédios, árvores, carros parados, marcos) — src/core/spatial.js
// mobiliário urbano (upgrade visual): abrigos nas paradas do GEO, rede elétrica e lixeiras no centro
const urbano = buildUrbano({ world, terrain, city, scene });
const spatial = buildSpatial(city, landmarks.colliders);
city.colGrid.clear();                                  // os dados agora vivem só no spatial
city.blocked = (x, z, r) => spatial.blocked(x, z, r);
city.roofAt = (x, z) => spatial.roofAt(x, z, true);
const _near = [];
// pessoas também são sólidas para o jogador
player.blocked = (x, z, r) => spatial.blocked(x, z, r) || spatial.agentsNear(x, z, r + 0.05, _near).length > 0;
player.groundAt = (x, z, cur) => {
  let g = terrain.heightAt(x, z) + city.surfOffset(x, z);   // pista +8 cm, calçada +23 cm
  const s = landmarks.surfaceAt(x, z); if (s !== null && s > g) g = s;                     // margens do valão da praça (piso sobre a escavação)
  const f = landmarks.deckAt(x, z); if (f !== null && f > g - 0.3 && f - cur < 1.2) g = Math.max(f, g);   // passarela: só quem chega por cima
  const d = city.deckAt(x, z); return d !== null && d > g - 0.3 && d - cur < 1.2 ? Math.max(d, g) : g;
};
player.surf = player.groundAt(player.x, player.z, terrain.heightAt(player.x, player.z));
// se nasceu dentro de um prédio, procura um lugar livre em espiral
for (let k = 0; k < 400 && player.blocked(player.x, player.z, 0.6); k++) { const a = k * 0.7, r = 1 + k * 0.25; player.x = spawn.x + Math.cos(a) * r; player.z = spawn.z + Math.sin(a) * r; }
if (params.has('x')) { player.x = +params.get('x'); player.z = +params.get('z'); }
// modelo realista opcional (public/models/protagonista.glb): substitui o procedural se existir
tryLoadGLB(BASE + 'models/protagonista.glb', 1.8).then(glb => {
  if (!glb) return;
  const m = player.mesh;
  for (const c of [...m.children]) c.visible = false;
  m.add(glb.model);
  m.userData.animate = (dt, speed, run, air) => glb.animate(dt, speed, player.mode, air);
});
/* ---------- pessoas realistas (Quaternius CC0, src/player/humans.js) ---------- */
const humans = await loadHumans(BASE).catch(e => { console.warn('personagens realistas não carregados:', e.message); return null; });
// Protagonista: o jogador escolhe na entrada entre Lukas (lederhosen) e Anna (dirndl) — trajes da Oktoberfest de
// Igrejinha sobre o corpo CC0 da Quaternius (src/player/costumes.js). A escolha fica salva no aparelho e pode ser
// trocada no menu (Esc / ☰). O modelo "male_casual" do diretor (licença a confirmar) só abre com ?heroi=fbx.
const SAVE_PERS = 'igrejinha.personagem';
const savedPers = (() => { try { return localStorage.getItem(SAVE_PERS); } catch { return null; } })();
let persKey = PERSONAGENS[params.get('personagem')] ? params.get('personagem') : PERSONAGENS[savedPers] ? savedPers : 'm';
const heroes = {};
let hero = null;
const _UP = new THREE.Vector3(0, 1, 0);
function setHero(key) {
  if (!humans) return;
  const h = heroes[key] ||= humans.make(PERSONAGENS[key].look);
  if (h === hero) return;
  const m = player.mesh;
  if (hero) hero.root.removeFromParent();
  for (const c of [...m.children]) c.visible = false;
  m.add(h.root); h.root.visible = true;
  h.root.traverse(o => { if (o.isMesh) { o.castShadow = o.isSkinnedMesh ? o.geometry.attributes.position.count > 3000 : true; o.frustumCulled = false; } });   // sombra: corpo e traje
  hero = h; persKey = key; window.__hero = h;
}
if (humans && params.get('heroi') === 'fbx') {
  hero = await humans.makeFromFBX(BASE + 'models/hero/male_casual.fbx', MAP_MALE_CASUAL, { height: 1.80 }).catch(e => { console.warn('protagonista:', e.message); return null; });
  if (hero) { for (const c of [...player.mesh.children]) c.visible = false; player.mesh.add(hero.root); window.__hero = hero; }
} else setHero(persKey);
player.mesh.userData.animate = (dt, speed, run, air, ex) => {
  if (!hero) return;
  hero.play(dt, { speed, mode: player.mode, air, vy: player.vy });
  // por cima da animação: olhar para quem está perto e inclinar com o peso (arrancada, freada, ladeira)
  if (ex) {
    const hb = hero.bones, ly = ex.lookYaw == null ? 0 : Math.max(-1, Math.min(1, ex.lookYaw));
    hero.lookCur = (hero.lookCur || 0) + (ly - (hero.lookCur || 0)) * Math.min(1, dt * 5);
    const head = hb.head || hb.Head, spine = hb.spine || hb.spine_02;
    if (head) head.rotateOnWorldAxis(_UP, hero.lookCur * 0.6);
    if (spine) spine.rotateX(ex.lean || 0);
  }
};
const input = new Input(renderer.domElement);
const cam = new FollowCam(camera, terrain);
cam.blocked = (x, z, r) => spatial.blocked(x, z, r, true);
cam.roofAt = (x, z) => spatial.roofAt(x, z, true);
if (DEBUG && params.has('nav')) scene.add(nav.debugMesh((x, z) => terrain.heightAt(x, z)));
cam.yaw = Math.PI;                                   // começa olhando para o norte (morros)
const minimap = new Minimap($('map'), terrain, groundCanvas);

/* ---------- o Waldir ---------- */
const FALAS_WALDIR = [
  'Bah, tchê! Chega mais, a Brahma tá trincando de gelada!',
  'Tri legal te ver por aqui! Senta aí na calçada que eu já levo.',
  'Bah, na Oktoberfest isso aqui lota, guri. Não tem nem onde estacionar!',
  'Tu já subiu no Morro da Cruz? De noite a cruz acende, é tri bonito.',
  'Aqui é o ponto de encontro do centro, desde sempre. Bah!',
  'Capaz que tu vai embora sem tomar um chope? Nem pensar, tchê!',
];
let waldir = null, falaI = 0;
if (landmarks.waldir) {
  const w = landmarks.waldir;
  waldir = makePerson({ shirt: 0xf6f6f6, pants: 0x3b3b3b, skin: 0xdcae86, hair: 0x9c9c9c, shoes: 0x2b2b2b, mustache: true, apron: 0xd9161e, build: 1.18 });
  waldir.position.set(w.x, w.y, w.z); waldir.rotation.y = w.face + Math.PI / 2;
  scene.add(waldir);
  const wb = makeContactShadow(0.6); wb.position.set(w.x, w.y + 0.03, w.z); scene.add(wb);
  const tag = makeLabel('Waldir', 3); tag.position.set(w.x, w.y + 2.9, w.z); tag.userData.maxDist = 40; scene.add(tag); labels.push(tag);
}
input.on('jump', () => { if (running && !drive.car) player.jump(); });
const interact = new Interactions();
if (waldir) interact.add((px, pz) => {
  const d = Math.hypot(px - waldir.position.x, pz - waldir.position.z);
  return d < 4 ? { dist: d - 1.5, label: 'E · conversar com o Waldir', touchLabel: 'Toque em FALAR para conversar com o Waldir', button: 'Falar', run() {
    toast('Waldir', ': “' + FALAS_WALDIR[falaI++ % FALAS_WALDIR.length] + '”', 5);
    waldir.rotation.y = Math.atan2(player.x - waldir.position.x, player.z - waldir.position.z);
  } } : null;
});
/* ---------- o tio da pipoca (esquina da praça com a Castelo Branco) ---------- */
let pipoqueiro = null, pipocaI = 0;
const FALAS_PIPOCA = ['Olha a pipoca quentinha! Doce ou salgada, tchê?', 'Batata frita na hora, guri! Bah, tá tri crocante.',
  'Trinta anos nessa esquina, conheço todo mundo da praça.', 'Na Oktoberfest a fila aqui dobra a quadra!'];
if (landmarks.pipoca) {
  const pc = landmarks.pipoca;
  pipoqueiro = makePerson({ shirt: 0xf2f2ee, pants: 0x6d6f73, skin: 0xd9a77e, hair: 0x9a9a9a, shoes: 0x2b2b2b, hairStyle: 'bald', mustache: true, build: 1.12 });
  pipoqueiro.position.set(pc.x, pc.y, pc.z); pipoqueiro.rotation.y = pc.face;
  scene.add(pipoqueiro);
  const sh = makeContactShadow(0.55); sh.position.set(pc.x, pc.y + 0.03, pc.z); scene.add(sh);
  interact.add((px, pz) => {
    const d = Math.hypot(px - pc.cart[0], pz - pc.cart[1]);
    return d < 3.2 ? { dist: d - 0.5, label: 'E · comprar pipoca', touchLabel: 'Toque em FALAR para comprar pipoca', button: 'Falar', run() {
      const buy = pipocaI % 2 === 1;
      toast('Pipoqueiro', buy ? ': “Saiu uma pipoca salgada no capricho! Bom proveito, tchê!”' : ': “' + FALAS_PIPOCA[(pipocaI >> 1) % FALAS_PIPOCA.length] + '”', 5);
      pipocaI++; events.emit('pipoca', { comprou: buy });
      pipoqueiro.rotation.y = Math.atan2(player.x - pc.x, player.z - pc.z);
    } } : null;
  });
}

/* ---------- pedestres (src/sim/pedestrians.js, spec em docs/spec-pedestres.md) ---------- */
const peds = new Pedestrians({ scene, nav, spatial, terrain, city, world, landmarks, places: world.places, quality: isTouch ? 'medium' : 'high',
  groundAt: (x, z) => player.groundAt(x, z, terrain.heightAt(x, z)), hours: () => sky.hours });
if (geoX && geoX.censo) {
  const sectors = geoX.censo;
  peds.censusAt = (x, z) => { for (const [d, p] of sectors) if (inPolyXZ(x, z, p)) return d; return null; };
}
peds.prefill(player.x, player.z);
if (humans) peds.useHumans(humans, scene, isTouch ? { male: 4, female: 4, radius: 24 } : { male: 5, female: 5, radius: 28 });
peds.toast = line => { if (toastT <= 0) toast('', '“' + line + '”', 2.5); };
interact.add((px, pz) => {
  const a = peds.nearestTalker(px, pz); if (!a) return null;
  return { dist: Math.hypot(a.x - px, a.z - pz), label: 'E · conversar', touchLabel: 'Toque em FALAR para conversar', button: 'Falar',
    run() { toast('', '“' + peds.talk(a) + '”', 5); } };
});
/* ---------- Uber: ponto na praça e chamada em qualquer lugar (U / botão) para visitar os pontos marcantes ---------- */
const uberSpot = landmarks.pipoca ? [landmarks.pipoca.cart[0] + 1.5, landmarks.pipoca.cart[1] + 5] : [byId.praca.x - 30, byId.praca.z + 10];
function freeSpotNear(x, z) {
  for (let k = 0; k < 600; k++) {
    const a = k * 0.7, r = 4 + k * 0.35, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    if (terrain.inside(px, pz, 10) && !spatial.blocked(px, pz, 1.2)) return [px, pz];
  }
  return [x, z];
}
// placa de Uber (poste preto) — uma na praça e uma em cada ponto marcante, onde o carro deixa e busca
const uberTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, 256, 160); x.fillStyle = '#fff'; x.font = 'bold 64px system-ui'; x.textAlign = 'center'; x.fillText('Uber', 128, 82); x.font = '22px system-ui'; x.fillText('ponto de embarque', 128, 126);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const uberPoleGeo = new THREE.CylinderGeometry(0.05, 0.06, 2.8, 8), uberPoleMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
const uberSignGeo = new THREE.PlaneGeometry(1.1, 0.7), uberSignMat = new THREE.MeshBasicMaterial({ map: uberTex });
const uberSigns = [];
function uberSign(ux, uz, ry) { uberSigns.push([ux, player.groundAt(ux, uz, terrain.heightAt(ux, uz)), uz, ry]); spatial.addCircle(ux, uz, 0.1); }
const uberDests = [{ id: 'praca', nome: 'Praça Dona Luísa', x: uberSpot[0], z: uberSpot[1], spot: uberSpot }];
for (const l of LANDMARKS) if (l.id !== 'praca') uberDests.push({ ...l, spot: freeSpotNear(l.x, l.z) });
for (const d of uberDests) uberSign(d.spot[0], d.spot[1], Math.atan2(d.x - d.spot[0], d.z - d.spot[1]) || Math.PI / 4);
{ // todas as placas em 3 malhas instanciadas (poste, frente, verso)
  const poles = new THREE.InstancedMesh(uberPoleGeo, uberPoleMat, uberSigns.length), fr = new THREE.InstancedMesh(uberSignGeo, uberSignMat, uberSigns.length * 2), o = new THREE.Object3D();
  uberSigns.forEach(([x, y, z, ry], i) => {
    o.position.set(x, y + 1.4, z); o.rotation.set(0, ry, 0); o.updateMatrix(); poles.setMatrixAt(i, o.matrix);
    for (const k of [0, 1]) { o.position.set(x, y + 2.5, z); o.rotation.set(0, ry + k * Math.PI, 0); o.updateMatrix(); fr.setMatrixAt(i * 2 + k, o.matrix); }
  });
  poles.castShadow = true; for (const m of [poles, fr]) { m.computeBoundingSphere(); m.frustumCulled = false; scene.add(m); }
}
function openUber() {
  if (!running) return;
  const list = $('uberList'); list.textContent = '';
  for (const d of uberDests) {
    const b = document.createElement('button'), km = Math.hypot(d.x - player.x, d.z - player.z) / 1000;
    b.innerHTML = `${d.nome}<small>${km < 1 ? Math.round(km * 1000) + ' m' : km.toFixed(1) + ' km'} · R$ ${Math.max(7, 5 + km * 2.4).toFixed(2).replace('.', ',')}</small>`;
    b.onclick = () => uberTo(d);
    list.appendChild(b);
  }
  $('uber').hidden = false;
}
$('uberClose').onclick = () => { $('uber').hidden = true; };
function uberTo(d) {
  $('uber').hidden = true; $('fade').classList.add('on');
  setTimeout(() => {
    // desce ao lado da placa, de frente para o ponto
    const a = Math.atan2(d.x - d.spot[0], d.z - d.spot[1]), x0 = d.spot[0] + Math.sin(a) * 1.6, z0 = d.spot[1] + Math.cos(a) * 1.6;
    let x = x0, z = z0;
    for (let k = 0; k < 16 && spatial.blocked(x, z, 0.5); k++) { const b = a + k * 0.4, r = 1.6 + (k >> 3) * 0.8; x = d.spot[0] + Math.sin(b) * r; z = d.spot[1] + Math.cos(b) * r; }   // em volta da placa
    player.x = player.prev.x = x; player.z = player.prev.z = z;
    player.surf = player.prev.y = player.groundAt(x, z, terrain.heightAt(x, z)); player.speed = 0;
    cam.yaw = a; cam.first = true;
    peds.prefill(x, z);
    $('fade').classList.remove('on');
    toast('Uber', `: “Chegamos: ${d.nome}. Bah, valeu pela corrida, tchê!” (a placa do Uber aqui do lado leva de volta)`, 5);
  }, 650);
}
input.on('uber', openUber);
interact.add((px, pz) => {
  let dd = Infinity; for (const d of uberDests) dd = Math.min(dd, Math.hypot(px - d.spot[0], pz - d.spot[1]));
  return dd < 3.5 ? { dist: dd - 0.3, label: 'E · chamar Uber', touchLabel: 'Toque em UBER para escolher o destino', button: 'Uber', run: openUber } : null;
});
/* ---------- mapa em tela cheia (M) com busca e GPS — src/ui/bigmap.js ---------- */
function teleportTo(x, z, nome = 'o ponto marcado') {
  const [fx, fz] = freeSpotNear(x, z);
  $('fade').classList.add('on');
  setTimeout(() => {
    player.x = player.prev.x = fx; player.z = player.prev.z = fz;
    player.surf = player.prev.y = player.groundAt(fx, fz, terrain.heightAt(fx, fz)); player.speed = 0; cam.first = true;
    peds.prefill(fx, fz); $('fade').classList.remove('on'); toast('', `Você foi até ${nome}.`, 3);
  }, 450);
}
const bigmap = new BigMap({ world, geoX, nav, places, terrain, player, onTeleport: (x, z) => teleportTo(x, z, bigmap._labelAt(x, z)), onChange: d => { gpsBeam.visible = !!d; if (d) gpsBeam.position.set(d.x, terrain.heightAt(d.x, d.z), d.z); } });
const gpsBeam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 160, 16, 1, true).translate(0, 80, 0), new THREE.MeshBasicMaterial({ color: 0xc13cff, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
gpsBeam.visible = false; gpsBeam.renderOrder = 3; scene.add(gpsBeam);
input.on('map', () => { if (running) bigmap.toggle(undefined, whereAmI(player.x, player.z)); });
addEventListener('keydown', e => {
  if (e.code !== 'Escape') return;
  if (bigmap.open) bigmap.toggle(false);
  else if (!$('selModal').hidden) closeCharModal();
  else if (!$('menu').hidden) closeMenu();
  else if (running) openMenu();
});
$('map').addEventListener('click', () => { if (running) bigmap.toggle(true, whereAmI(player.x, player.z)); });   // toque no radar abre o mapa
/* ---------- Etapa 2: dirigir — src/game/vehicle.js ---------- */
const CAR_PAINT = [0xf2f2f2, 0xd9d9d9, 0x8c8f94, 0x2b2d31, 0x1d1f22, 0xb02a2a, 0x2a4f8a, 0xc9c1b0, 0x5a6b5a];
const drive = { car: null, parked: null, front: false, hb: false };
// carros reais (Sketchfab, CC BY 4.0): Honda City 2017 (dewa) e Peugeot 206 (DisneyCars) — public/models/cars3d
const carModels = await loadRealCars(BASE).catch(() => ({}));
const MODEL_NAMES = Object.keys(carModels);
const vctx = { models: carModels, groundAt: (x, z, cur) => player.groundAt(x, z, cur), blocked: (x, z, r) => spatial.blocked(x, z, r), surfOffset: (x, z) => city.surfOffset(x, z), terrain };
function nearestParked(x, z, R = 3.2) { let best = null, bd = R; for (const c of street.cars) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } } return best; }
const _cm = new THREE.Matrix4();
function parkedMesh(c, on) { const M = on ? street.carMatrix(c, _cm) : ZERO_M; for (let k = 0; k < c.inst.length; k += 2) { c.inst[k].setMatrixAt(c.inst[k + 1], M); c.inst[k].instanceMatrix.needsUpdate = true; } }
const parkedLOD = MODEL_NAMES.length ? new ParkedLOD(scene, carModels, MODEL_NAMES, street, isTouch ? { cap: 8, radius: 35 } : { cap: 10, radius: 42 }) : null;
if (parkedLOD) parkedLOD.hide = (c, hidden) => parkedMesh(c, !hidden);
function setParkedVisible(c, on) {
  if (parkedLOD) { if (on) parkedLOD.skip.delete(c); else { parkedLOD.skip.add(c); if (parkedLOD.shown.delete(c)) parkedLOD.t = 0; } }
  parkedMesh(c, on && !(parkedLOD && parkedLOD.shown.has(c))); spatial.setPropsOff(c.x, c.z, !on); if (parkedLOD) parkedLOD.t = 0;
}
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
function enterCar(c) {
  if (drive.car) return;
  // o carro que o jogador deixou em outro lugar volta para a vaga de onde saiu
  if (drive.left) { scene.remove(drive.left.car.mesh); setParkedVisible(drive.left.parked, true); drive.left = null; }
  setParkedVisible(c, false);
  drive.car = new Vehicle(scene, { type: parkedLOD ? parkedLOD.modelOf(c).name : MODEL_NAMES.length ? MODEL_NAMES[Math.floor(c.c * 7 % 1 * MODEL_NAMES.length)] : CAR_TYPES[Math.floor(c.c * 3 % 1 * 3)], color: parkedLOD ? parkedLOD.colorOf(c) : CAR_PAINT[Math.floor(c.c * CAR_PAINT.length)], x: c.x, z: c.z, yaw: c.yaw }, vctx);
  drive.parked = c; player.mesh.visible = false; player.blob.visible = false; bigmap.mode = 'car'; if (bigmap.dest) bigmap.recalc();
  $('speedo').hidden = false; toast('', isTouch ? 'Joystick: acelerar/frear e virar · CARRO para sair' : 'W/S acelera e freia · A/D vira · Espaço freio de mão · H buzina · C câmera · F sai', 4);
}
function exitCar() {
  const v = drive.car; if (!v) return;
  if (v.kmh > 12) { toast('', 'Pare o carro para descer.', 2); return; }
  // desce pelo lado do motorista; se estiver bloqueado, procura um lugar livre em volta
  const sx = Math.sin(v.yaw), sz = Math.cos(v.yaw); let x = v.x + sz * 1.6, z = v.z - sx * 1.6;
  if (spatial.blocked(x, z, 0.4)) [x, z] = freeSpotNear(v.x, v.z);
  player.x = player.prev.x = x; player.z = player.prev.z = z; player.surf = player.prev.y = player.groundAt(x, z, v.y + 0.5); player.speed = 0; player.ang = v.yaw;
  player.mesh.visible = true; player.blob.visible = true; bigmap.mode = 'ped'; if (bigmap.dest) bigmap.recalc();
  drive.left = { car: v, parked: drive.parked }; drive.car = null; $('speedo').hidden = true; drive.front = false;
}
input.on('fly', () => { if (!running || bigmap.open) return; if (drive.car) exitCar(); else { const c = nearestParked(player.x, player.z); if (c) enterCar(c); else if (drive.left && Math.hypot(drive.left.car.x - player.x, drive.left.car.z - player.z) < 3.5) { const L = drive.left; drive.left = null; drive.car = L.car; drive.parked = L.parked; player.mesh.visible = false; player.blob.visible = false; bigmap.mode = 'car'; $('speedo').hidden = false; } } });
interact.add((px, pz) => {
  if (drive.car) return null;
  const c = nearestParked(px, pz) || (drive.left && Math.hypot(drive.left.car.x - px, drive.left.car.z - pz) < 3.5 ? drive.left.car : null);
  return c ? { dist: Math.hypot(c.x - px, c.z - pz) - 0.8, label: 'F · entrar no carro', touchLabel: 'Toque em CARRO para dirigir', button: 'Carro', run: () => input.emit('fly') } : null;
});
addEventListener('keydown', e => {
  if (!drive.car || !running || bigmap.open) return;
  if (e.code === 'KeyH') honk();
  if (e.code === 'KeyC') drive.front = !drive.front;
  if (e.code === 'KeyR') { const v = drive.car; v.pitch = v.roll = 0; v.v = 0; const [x, z] = freeSpotNear(v.x, v.z); v.x = v.prev.x = x; v.z = v.prev.z = z; }
});
let audioCtx = null;
function honk() {
  try { audioCtx ||= new AudioContext(); const o = audioCtx.createOscillator(), o2 = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = o2.type = 'square'; o.frequency.value = 415; o2.frequency.value = 523; g.gain.setValueAtTime(0.12, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
    o.connect(g); o2.connect(g); g.connect(audioCtx.destination); o.start(); o2.start(); o.stop(audioCtx.currentTime + 0.45); o2.stop(audioCtx.currentTime + 0.45); } catch (e) { /* sem áudio */ }
  peds.honk?.(drive.car.x, drive.car.z);
}
input.on('act', () => { if (!running || bigmap.open) return; const c = interact.best(player.x, player.z); if (c) c.run(); else openUber(); });   // longe de tudo: chama o Uber

/* ---------- onde estou: rua, número e bairro (cadastro e bairros do GEO Igrejinha) ---------- */
const addrGrid = new Map();
if (geoX) for (const a of geoX.addr) { const k = Math.floor(a[0] / 50) + ',' + Math.floor(a[1] / 50); (addrGrid.get(k) || addrGrid.set(k, []).get(k)).push(a); }
function inPolyXZ(x, z, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if ((p[i][1] > z) !== (p[j][1] > z) && x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]) c = !c; return c; }   // declarada como função: usada antes desta linha
let whereT = 0, whereS = '';
function whereAmI(x, z) {
  if (!geoX) return `${Math.round(player.y)} m`;
  if ((whereT -= 1) > 0) return whereS; whereT = 20;
  let best = null, bd = 35;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const q of addrGrid.get((Math.floor(x / 50) + a) + ',' + (Math.floor(z / 50) + b)) || []) { const d = Math.hypot(q[0] - x, q[1] - z); if (d < bd) { bd = d; best = q; } }
  const bairro = geoX.bairros.find(([, p]) => inPolyXZ(x, z, p));
  const b = bairro ? bairro[0].toLowerCase().replace(/(^|\s)(\S)/g, (m, s, c) => s + c.toUpperCase()) : '';
  whereS = best ? `${best[2]}, ${best[3]}${b ? ' · ' + b : ''}` : b || `${Math.round(player.y)} m`;
  return whereS;
}

/* ---------- laço ---------- */
let running = false, last = performance.now(), lodT = 0, lastMin = -1;
let fpsN = 0, fpsT = 0;
if (DEBUG) $('fps').hidden = false;

let frameNo = 0, frameAx = { f: 0, t: 0, run: false };
// núcleo: passo fixo (lógica igual a 30, 60 ou 144 fps) — ver src/core/loop.js
const sim = new FixedLoop(h => {
  const x0 = player.x, z0 = player.z;
  if (drive.car) {
    const v = drive.car; v._braking = frameAx.f < -0.05 && v.v > 0.5; v.step(h, frameAx, !!input.keys.Space || drive.hb);
    player.x = player.prev.x = v.x; player.z = player.prev.z = v.z; player.surf = player.prev.y = v.y; player.ang = v.yaw; player.mode = 'drive';
  } else player.step(h, frameAx, cam.yaw);
  Object.assign(peds.player, { x: player.x, z: player.z, vx: (player.x - x0) / h, vz: (player.z - z0) / h, sprint: player.mode === 'sprint' || player.mode === 'run' || (drive.car && drive.car.kmh > 8) });
  peds.camDir.x = Math.sin(cam.yaw); peds.camDir.z = Math.cos(cam.yaw);
  peds.step(h);
  events.emit('step', h);
});
function frame(now) {
  const rawDt = Math.max(0, (now - last) / 1000), dt = Math.min(0.05, rawDt); last = now;
  const look = input.takeLook();
  const ax = running && !bigmap.open ? input.axes() : { f: 0, t: 0, run: false };
  frameAx = ax;
  const alpha = sim.advance(rawDt);                 // simulação em passos fixos de 1/60 s
  // olhar do protagonista: pessoa ou Waldir mais perto (até 6 m)
  let la = null, ld = 6;
  for (const a of peds.agents) { const d = Math.hypot(a.x - player.x, a.z - player.z); if (d < ld) { ld = d; la = a; } }
  if (waldir) { const d = Math.hypot(waldir.position.x - player.x, waldir.position.z - player.z); if (d < ld) { ld = d; la = waldir.position; } }
  player.lookAt = la;
  let pv;
  if (drive.car) { const c = drive.car.present(alpha, sky.night); pv = { x: c.x, y: c.y, z: c.z, ground: c.y, y0: 0, ang: c.yaw }; }
  else pv = player.present(alpha, dt);             // desenho interpolado
  peds.present(alpha, dt, camera);
  const moving = Math.hypot(ax.f, ax.t) > 0.1;
  if (drive.car && drive.front) {
    // câmera do capô
    const v = drive.car, sx = Math.sin(pv.ang), sz = Math.cos(pv.ang);
    camera.position.set(pv.x + sx * 0.4, pv.y + 1.25, pv.z + sz * 0.4); camera.lookAt(pv.x + sx * 20, pv.y + 1.0, pv.z + sz * 20);
  } else if (drive.car) {
    // perseguição: mais longe e mais alto, volta para trás do carro rápido (o jogador ainda pode girar)
    cam.dist = Math.max(cam.dist, 6.5); cam.idle = Math.max(cam.idle, 2.1);
    cam.update(dt, pv, running ? look : { dx: 0, dy: 0, zoom: 0 }, { followYaw: Math.abs(drive.car.v) > 1 ? (drive.car.v > 0 ? pv.ang : pv.ang + Math.PI) : null, height: 1.5 });
  } else cam.update(dt, pv, running ? look : { dx: dt * 6, dy: 0, zoom: 0 },
    { followYaw: moving && ax.f > 0.5 ? player.ang : null, height: 1.6 });
  sky.update(running ? dt : 0, pv, camera.position);
  landmarks.update(dt, sky);
  if (waldir) waldir.userData.animate(dt, 0);
  if (pipoqueiro) pipoqueiro.userData.animate(dt, 0);
  treeLOD.update(dt, camera.position.x, camera.position.z, now / 1000);
  parkedLOD?.update(dt, player.x, player.z);

  lodT -= dt;
  if (lodT <= 0) {
    lodT = 0.3;
    const tu0 = performance.now();
    terrain.update(camera.position.x, camera.position.z);
    if (DEBUG && frameNo < 6) console.log('@' + Math.round(tu0), 'quadro', frameNo, 'terreno LOD', Math.round(performance.now() - tu0), 'ms');
    city.update(camera.position.x, camera.position.z);
    street.update(camera.position.x, camera.position.z);
    if (forest) forest.update(camera.position.x, camera.position.z);
    landmarks.cull(camera.position.x, camera.position.z, Q.buildDist * 0.45);
    city.setNight(sky.night);
    for (const s of labels) s.visible = s.position.distanceTo(camera.position) < s.userData.maxDist;
  }

  if (running) {
    const h = Math.floor(sky.hours), m = Math.floor((sky.hours - h) * 60);
    if (m !== lastMin) { lastMin = m; $('clockT').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
    $('spd').textContent = `${drive.car ? 'Dirigindo' : { idle: 'Parado', walk: 'Andando', run: 'Correndo', sprint: 'Sprint!' }[player.mode] || 'A pé'} · ${whereAmI(player.x, player.z)}`;
    if (drive.car) { $('spdN').textContent = Math.round(drive.car.kmh); $('spdNeedle').style.transform = `rotate(${-120 + Math.min(240, drive.car.kmh * 2.4)}deg)`; }
    const it = interact.best(player.x, player.z);
    $('prompt').style.display = it ? 'block' : 'none';
    if (it) $('prompt').textContent = isTouch ? it.touchLabel : it.label;
    $('bAct').textContent = it ? it.button : 'Uber';
    const gps = bigmap.update(dt);
    if (gps?.arrived) toast('GPS', `: você chegou — ${gps.arrived}.`, 4);
    minimap.draw(player.x, player.z, cam.yaw, player.ang, places, { route: bigmap.route, dest: bigmap.dest });
    if (bigmap.open) { bigmap.tick(dt); $('bmClock').textContent = $('clockT').textContent; }
    // ponto mais próximo
    let near = null, nd = 1e9;
    for (const l of LANDMARKS) { const d = Math.hypot(l.x - player.x, l.z - player.z); if (d < nd) { nd = d; near = l; } }
    const km = v => v < 1000 ? Math.round(v) + ' m' : (v / 1000).toFixed(1) + ' km';
    if (bigmap.dest) { $('objT').textContent = 'GPS'; $('objS').textContent = bigmap.dest.name; $('objD').textContent = `${km(bigmap.routeLen)} pela rota`; }
    else { $('objT').textContent = 'Explorando Igrejinha'; $('objS').textContent = near.nome; $('objD').textContent = `${km(nd)} daqui`; }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').classList.remove('on'); }
  }

  const r0 = performance.now();
  renderer.render(scene, camera);
  if (DEBUG && frameNo < 6) console.log('@' + Math.round(r0), 'quadro', frameNo, 'render', Math.round(performance.now() - r0), 'ms');
  frameNo++;
  if (DEBUG) {
    // medidor para teste em aparelho real: tempo de quadro (mediana e pior em 2 s), memória, resolução
    const ft = (now - (frame.prev || now)); frame.prev = now; (frame.ts ||= []).push(ft);
    fpsN++; fpsT += dt;
    if (fpsT > 2) {
      const a = frame.ts.slice().sort((x, y) => x - y), med = a[a.length >> 1], worst = a[a.length - 1], i = renderer.info.render;
      const mem = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB' : 'n/d';
      $('fps').textContent = `${Math.round(1000 / med)} fps · quadro ${med.toFixed(1)} ms (pior ${worst.toFixed(0)} ms) · ${i.calls} draws · ${(i.triangles / 1000).toFixed(0)}k tris · mem ${mem} · ${peds.agents.length} pessoas (${peds.drawn || 0} na tela) · ${renderer.domElement.width}×${renderer.domElement.height} @${renderer.getPixelRatio()}x`;
      frame.ts = []; fpsN = fpsT = 0;
    }
  }
  requestAnimationFrame(frame);
}

// mapa em tela cheia: desenho montado em fatias durante a carga (sem travar), depois solta os dados brutos
await stage('Desenhando o mapa…', 0.87, 0.88, async tick => { let n = 0; while (!bigmap.buildStep(250)) await tick(Math.min(1, ++n / 2)); });
// libera os dados brutos do mapa já transformados em malhas (mantém pontes e o centro, usados pelos testes)
world.buildings = world.buildings.filter(b => Math.hypot(b.p[0][0], b.p[0][1]) < 800);
world.roads = world.roads.filter(r => r.br);
world.areas = []; world.water = []; world.gen = [];
if (geoX) { geoX.floors = null; geoX.ind = null; geoX.names = null; }

const origCells = city.compactOrig?.() ?? 0;   // relevo original só onde foi escavado
window.__origCells = origCells;   // células do relevo original guardadas (diagnóstico)
await stage('Preparando a placa de vídeo…', 0.88, 1, async tick => {
  // envia a geometria à GPU em lotes (libera a cópia em memória sem um travamento único longo)
  const all = []; scene.traverse(o => { if (o.isMesh || o.isInstancedMesh || o.isPoints) all.push([o, o.visible]); });
  for (const [o] of all) o.visible = false;
  // enquadra tudo (inclui bairros além do relevo carregado: sem isso a cópia deles ficava na memória)
  const bb = new THREE.Box3(); for (const [o] of all) if (!o.isSkinnedMesh) bb.expandByObject(o);
  const t = { minX: Math.min(terrain.minX, bb.min.x) - 50, maxX: Math.max(terrain.maxX, bb.max.x) + 50, minZ: Math.min(terrain.minZ, bb.min.z) - 50, maxZ: Math.max(terrain.maxZ, bb.max.z) + 50 };
  const ortho = new THREE.OrthographicCamera(t.minX, t.maxX, -t.minZ, -t.maxZ, -5000, 5000);
  ortho.position.set(0, 2000, 0); ortho.up.set(0, 0, -1); ortho.lookAt(0, 0, 0); ortho.updateMatrixWorld();
  const rt = new THREE.WebGLRenderTarget(8, 8), sh = renderer.shadowMap.enabled, gl = renderer.getContext();
  renderer.shadowMap.enabled = false; renderer.setRenderTarget(rt);
  const B = 60;
  for (let i = 0; i < all.length; i += B) {
    for (let j = i; j < Math.min(all.length, i + B); j++) all[j][0].visible = true;
    renderer.render(scene, ortho); gl.finish();
    for (let j = i; j < Math.min(all.length, i + B); j++) all[j][0].visible = false;
    await tick(i / all.length);
  }
  renderer.setRenderTarget(null); renderer.shadowMap.enabled = sh; rt.dispose();
  // pré-compila os shaders de tudo (com sombra, névoa e luzes da cena) sem travar: compileAsync
  for (const [o] of all) o.visible = true;
  scene.traverse(o => { if (o.isSprite) o.visible = true; });
  await renderer.compileAsync(scene, camera);
  for (const [o, v] of all) o.visible = v;
});
$('loading').hidden = true;
// seleção de personagem: na entrada (já vem marcado o salvo) e no menu
const savePers = k => { try { localStorage.setItem(SAVE_PERS, k); } catch { /* modo privado */ } };
const charSel = humans && params.get('heroi') !== 'fbx' ? new CharSelect(humans, { selected: persKey, onChange: k => { setHero(k); savePers(k); } }) : null;
if (charSel && !params.has('autostart')) { $('start').classList.add('sel'); charSel.mount($('selStart')); }
function openMenu() { running = false; $('menu').hidden = false; $('mContinue').focus(); }
function closeMenu() { $('menu').hidden = true; running = true; }
function openCharModal() { if (!charSel) return; $('menu').hidden = true; $('selModal').hidden = false; charSel.sel = persKey; charSel._mark(); charSel.mount($('selHost')); $('selHost').appendChild($('selDone')); }
function closeCharModal() { charSel?.unmount(); $('selModal').hidden = true; running = true; }
$('bMenu').addEventListener('click', () => { if (running) openMenu(); });
$('mContinue').addEventListener('click', closeMenu);
$('mChar').addEventListener('click', openCharModal);
$('selDone').addEventListener('click', closeCharModal);
$('versao').textContent = 'Versão de teste: ' + VERSAO;
$('play').disabled = false; $('play').textContent = 'Jogar';
window.__readyAt = performance.now();   // fim do carregamento (testes medem travamentos até aqui)
$('play').addEventListener('click', () => {
  charSel?.unmount(); savePers(persKey);
  $('start').hidden = true; $('hud').hidden = false; running = true;
  toast('Bem-vindo a Igrejinha!', isTouch ? ' Use o joystick para andar e arraste a tela para olhar.' : ' WASD para andar, Shift corre, arraste o mouse para olhar.', 6);
});
if (params.has('autostart')) $('play').click();
requestAnimationFrame(frame);

// acesso para testes automatizados
window.__game = { bigmap, drive, parkedLOD, setHero, get persKey() { return persKey; }, enterCar, exitCar, peds, interact, nav, spatial, sim, events, waldir, street, urbano, scene, camera, renderer, terrain, player, cam, sky, city, world, landmarks, LM };

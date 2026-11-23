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
import { loadHumans } from './player/humans.js';
import { MAP_MALE_CASUAL } from './player/retarget.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

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
const [terrain, world, navData] = await Promise.all([Terrain.load(BASE), fetchPackedJSON(BASE + 'data/world.data.json'), fetchPackedJSON(BASE + 'data/nav.data.json')]);
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
city.valaoZones = [{ x: 10, z: 22, r: 42 }];   // Arroio Koetz canalizado na Praça Dona Luísa (paredes retas)
await stage('Escavando o Paranhana…', 0.05, 0.1, () => city.carveWater());
const groundCanvas = await stage('Pintando o chão…', 0.1, 0.18, () => buildGroundCanvas(terrain, world, Math.min(Q.ground, renderer.capabilities.maxTextureSize)));
terrain.material.map = groundTexture(groundCanvas, renderer);
// foto aérea da Prefeitura (GEO Igrejinha 2016) no chão perto da câmera
fetch(BASE + 'ortho/index.json').then(r => r.ok ? r.json() : null).then(ix => { if (ix) terrain.setOrtho(ix, BASE, isTouch ? { near: 650, far: 1000 } : { near: 1000, far: 1400 }); }).catch(() => {});
await stage('Erguendo a Serra…', 0.18, 0.22, () => scene.add(terrain.build()));
await stage('Construindo a cidade…', 0.22, 0.7, async tick => scene.add(await city.build(tick)));
const landmarks = await stage('Montando a Igreja, a praça e a Oktoberfest…', 0.7, 0.82, () => buildLandmarks(LM, world, terrain, scene, city));
const street = await stage('Plantando árvores…', 0.82, 0.88, () => buildStreetLife(world, terrain, city, Q, landmarks.parking));
// árvores detalhadas perto da câmera (cartões de folha, vento); longe ficam as copas simples
const treeLOD = new TreeLOD(scene, { cap: isTouch ? { leafy: 90, big: 24, palm: 24 } : { leafy: 160, big: 30, palm: 40 }, radius: isTouch ? 100 : 130 });
for (const t of street.trees) treeLOD.add(t);
for (const t of landmarks.trees) treeLOD.add(t, true);
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

// lugares do OSM (escolas, bancos, postos…): placa pequena, visível de perto, e ícone no minimapa
const places = world.places
  .filter(p => !LANDMARKS.some(l => Math.hypot(l.x - p.x, l.z - p.z) < 60))
  .map(p => ({ ...p, ...PLACE_STYLE[p.k], nome: p.n }));
for (const p of places) {
  if (p.k === 'onibus') continue;                      // paradas: só o ícone no minimapa
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
const spatial = buildSpatial(city, landmarks.colliders);
city.colGrid.clear();                                  // os dados agora vivem só no spatial
city.blocked = (x, z, r) => spatial.blocked(x, z, r);
city.roofAt = (x, z) => spatial.roofAt(x, z, true);
const _near = [];
// pessoas também são sólidas para o jogador
player.blocked = (x, z, r) => spatial.blocked(x, z, r) || spatial.agentsNear(x, z, r + 0.05, _near).length > 0;
player.groundAt = (x, z, cur) => { const g = terrain.heightAt(x, z), d = city.deckAt(x, z); return d !== null && d > g - 0.3 && d - cur < 1.2 ? Math.max(d, g) : g; };
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
// Protagonista: modelo "male_casual" enviado pelo diretor (public/models/hero), com as animações da biblioteca
// Quaternius transferidas para o esqueleto dele (src/player/retarget.js). Sem ele, fica o procedural.
const hero = humans ? await humans.makeFromFBX(BASE + 'models/hero/male_casual.fbx', MAP_MALE_CASUAL, { height: 1.80 }).catch(e => { console.warn('protagonista:', e.message); return null; }) : null;
if (hero) {
  const m = player.mesh;
  for (const c of [...m.children]) c.visible = false;
  m.add(hero.root);
  const hb = hero.bones;
  m.userData.animate = (dt, speed, run, air, ex) => {
    hero.play(dt, { speed, mode: player.mode, air, vy: player.vy });
    // por cima da animação: olhar para quem está perto e inclinar com o peso (arrancada, freada, ladeira)
    if (ex) {
      const ly = ex.lookYaw == null ? 0 : Math.max(-1, Math.min(1, ex.lookYaw));
      hero.lookCur = (hero.lookCur || 0) + (ly - (hero.lookCur || 0)) * Math.min(1, dt * 5);
      if (hb.head) hb.head.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), hero.lookCur * 0.6);
      if (hb.spine) hb.spine.rotateX(ex.lean || 0);
    }
  };
  window.__hero = hero;
}
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
input.on('jump', () => { if (running) player.jump(); });
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
peds.prefill(player.x, player.z);
if (humans) peds.useHumans(humans, scene, isTouch ? { male: 4, female: 4, radius: 24 } : { male: 5, female: 5, radius: 28 });
peds.toast = line => { if (toastT <= 0) toast('', '“' + line + '”', 2.5); };
interact.add((px, pz) => {
  const a = peds.nearestTalker(px, pz); if (!a) return null;
  return { dist: Math.hypot(a.x - px, a.z - pz), label: 'E · conversar', touchLabel: 'Toque em FALAR para conversar', button: 'Falar',
    run() { toast('', '“' + peds.talk(a) + '”', 5); } };
});
input.on('act', () => { if (!running) return; const c = interact.best(player.x, player.z); if (c) c.run(); });

/* ---------- laço ---------- */
let running = false, last = performance.now(), lodT = 0, lastMin = -1;
let fpsN = 0, fpsT = 0;
if (DEBUG) $('fps').hidden = false;

let frameNo = 0, frameAx = { f: 0, t: 0, run: false };
// núcleo: passo fixo (lógica igual a 30, 60 ou 144 fps) — ver src/core/loop.js
const sim = new FixedLoop(h => {
  const x0 = player.x, z0 = player.z;
  player.step(h, frameAx, cam.yaw);
  Object.assign(peds.player, { x: player.x, z: player.z, vx: (player.x - x0) / h, vz: (player.z - z0) / h, sprint: player.mode === 'sprint' || player.mode === 'run' });
  peds.camDir.x = Math.sin(cam.yaw); peds.camDir.z = Math.cos(cam.yaw);
  peds.step(h);
  events.emit('step', h);
});
function frame(now) {
  const rawDt = Math.max(0, (now - last) / 1000), dt = Math.min(0.05, rawDt); last = now;
  const look = input.takeLook();
  const ax = running ? input.axes() : { f: 0, t: 0, run: false };
  frameAx = ax;
  const alpha = sim.advance(rawDt);                 // simulação em passos fixos de 1/60 s
  // olhar do protagonista: pessoa ou Waldir mais perto (até 6 m)
  let la = null, ld = 6;
  for (const a of peds.agents) { const d = Math.hypot(a.x - player.x, a.z - player.z); if (d < ld) { ld = d; la = a; } }
  if (waldir) { const d = Math.hypot(waldir.position.x - player.x, waldir.position.z - player.z); if (d < ld) { ld = d; la = waldir.position; } }
  player.lookAt = la;
  const pv = player.present(alpha, dt);             // desenho interpolado
  peds.present(alpha, dt, camera);
  const moving = Math.hypot(ax.f, ax.t) > 0.1;
  cam.update(dt, pv, running ? look : { dx: dt * 6, dy: 0, zoom: 0 },
    { followYaw: moving && ax.f > 0.5 ? player.ang : null, height: 1.6 });
  sky.update(running ? dt : 0, pv, camera.position);
  landmarks.update(dt, sky);
  if (waldir) waldir.userData.animate(dt, 0);
  if (pipoqueiro) pipoqueiro.userData.animate(dt, 0);
  treeLOD.update(dt, camera.position.x, camera.position.z, now / 1000);

  lodT -= dt;
  if (lodT <= 0) {
    lodT = 0.3;
    const tu0 = performance.now();
    terrain.update(camera.position.x, camera.position.z);
    if (DEBUG && frameNo < 6) console.log('@' + Math.round(tu0), 'quadro', frameNo, 'terreno LOD', Math.round(performance.now() - tu0), 'ms');
    city.update(camera.position.x, camera.position.z);
    street.update(camera.position.x, camera.position.z);
    landmarks.cull(camera.position.x, camera.position.z, Q.buildDist * 0.45);
    city.setNight(sky.night);
    for (const s of labels) s.visible = s.position.distanceTo(camera.position) < s.userData.maxDist;
  }

  if (running) {
    const h = Math.floor(sky.hours), m = Math.floor((sky.hours - h) * 60);
    if (m !== lastMin) { lastMin = m; $('clockT').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
    $('spd').textContent = `${{ idle: 'Parado', walk: 'Andando', run: 'Correndo', sprint: 'Sprint!' }[player.mode] || 'A pé'} · ${Math.round(player.y)} m`;
    const it = interact.best(player.x, player.z);
    $('prompt').style.display = it ? 'block' : 'none';
    if (it) $('prompt').textContent = isTouch ? it.touchLabel : it.label;
    $('bAct').textContent = it ? it.button : 'Carro';
    minimap.draw(player.x, player.z, cam.yaw, player.ang, places);
    // ponto mais próximo
    let near = null, nd = 1e9;
    for (const l of LANDMARKS) { const d = Math.hypot(l.x - player.x, l.z - player.z); if (d < nd) { nd = d; near = l; } }
    $('objS').textContent = near.nome;
    $('objD').textContent = `${nd < 1000 ? Math.round(nd) + ' m' : (nd / 1000).toFixed(1) + ' km'} daqui`;
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

await stage('Preparando a placa de vídeo…', 0.88, 1, async tick => {
  // envia a geometria à GPU em lotes (libera a cópia em memória sem um travamento único longo)
  const all = []; scene.traverse(o => { if (o.isMesh || o.isInstancedMesh || o.isPoints) all.push([o, o.visible]); });
  for (const [o] of all) o.visible = false;
  const t = terrain, ortho = new THREE.OrthographicCamera(t.minX, t.maxX, -t.minZ, -t.maxZ, -5000, 5000);
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
$('play').disabled = false; $('play').textContent = 'Jogar';
window.__readyAt = performance.now();   // fim do carregamento (testes medem travamentos até aqui)
$('play').addEventListener('click', () => {
  $('start').hidden = true; $('hud').hidden = false; running = true;
  toast('Bem-vindo a Igrejinha!', isTouch ? ' Use o joystick para andar e arraste a tela para olhar.' : ' WASD para andar, Shift corre, arraste o mouse para olhar.', 6);
});
if (params.has('autostart')) $('play').click();
requestAnimationFrame(frame);

// acesso para testes automatizados
window.__game = { peds, interact, nav, spatial, sim, events, waldir, street, scene, camera, renderer, terrain, player, cam, sky, city, world, landmarks, LM };
